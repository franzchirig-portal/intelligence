"""
pipeline/sync.py
=================
Orquestador principal del pipeline ETL.
Coordina el flujo completo: Fetch → Transform → Load (Bronze + Silver) → Refresh Gold.

Uso:
    python -m pipeline.sync                         # Sync incremental de todo
    python -m pipeline.sync --city SCZ             # Solo Santa Cruz
    python -m pipeline.sync --tab datos_margenes   # Solo ese tab
    python -m pipeline.sync --mode full            # Re-sync completo

Variables de entorno:
    SYNC_CITY:  SCZ | LPZ | CBB | ALL
    SYNC_MODE:  incremental | full
    SYNC_TAB:   datos_margenes | tipologia_precios | amenidades | ALL
    GOOGLE_APPLICATION_CREDENTIALS: ruta al JSON de Service Account
    SUPABASE_URL, SUPABASE_SERVICE_KEY

Skill: sheets_supabase_pipeline
"""

import os
import sys
import time
import argparse
import json
from datetime import datetime
from pathlib import Path
from loguru import logger

from .config import SHEETS_CONFIG, BRONZE_TABLES, GOLD_VIEWS
from .sheets_client import SheetsClient
from .transform import (
    transform_datos_margenes,
    transform_tipologia_precios,
    transform_amenidades,
)
from .supabase_client import SupabaseLoader


# ============================================================
# CONFIGURACIÓN DE LOGGING
# ============================================================

def _setup_logging(run_id: str) -> None:
    """Configurar loguru: consola + archivo de reporte."""
    reports_dir = Path(__file__).parent / "reports"
    reports_dir.mkdir(exist_ok=True)

    logger.remove()
    logger.add(
        sys.stderr,
        format="<green>{time:HH:mm:ss}</green> | <level>{level:<8}</level> | {message}",
        level="INFO",
        colorize=True,
    )
    logger.add(
        reports_dir / f"sync_{run_id}.log",
        format="{time:YYYY-MM-DD HH:mm:ss} | {level:<8} | {message}",
        level="DEBUG",
        rotation="50 MB",
    )


# ============================================================
# PIPELINE POR TAB
# ============================================================

TRANSFORM_FUNCTIONS = {
    "datos_margenes":    transform_datos_margenes,
    "tipologia_precios": transform_tipologia_precios,
    "amenidades":        transform_amenidades,
}

SILVER_LOADERS = {
    "datos_margenes":    ("upsert_projects", "upsert_snapshots"),
    "tipologia_precios": ("upsert_units",),
    "amenidades":        ("upsert_amenities",),
}


def sync_tab(
    sheets: SheetsClient,
    loader: SupabaseLoader,
    city_code: str,
    tab_key: str,
    spreadsheet_id: str,
    tab_name: str,
    mode: str,
    report: dict,
) -> None:
    """
    Sincronizar un tab específico de un spreadsheet.

    Args:
        sheets: Cliente de Google Sheets API.
        loader: Cliente de Supabase.
        city_code: 'SCZ', 'LPZ' o 'CBB'.
        tab_key: 'datos_margenes', 'tipologia_precios' o 'amenidades'.
        spreadsheet_id: ID del spreadsheet.
        tab_name: Nombre exacto del tab en el spreadsheet.
        mode: 'incremental' o 'full'.
        report: Dict de reporte mutable para acumular stats.
    """
    start = time.monotonic()
    label = f"{city_code}/{tab_key}"

    try:
        # 1. EXTRACT — Fetch desde Sheets API
        logger.info(f"[{label}] Fetching datos...")
        raw_rows = sheets.fetch_tab(spreadsheet_id, tab_name)

        if not raw_rows:
            logger.warning(f"[{label}] Sin datos, tab puede estar vacío")
            return

        rows_fetched = len(raw_rows)

        # 2. LOAD BRONZE — Upsert raw data
        bronze_table = BRONZE_TABLES[tab_key]
        inserted_bronze, skipped_bronze = loader.upsert_bronze(
            table=bronze_table,
            rows=raw_rows,
            city_code=city_code,
            tab_name=tab_key,
        )

        # En modo incremental, solo transformar filas nuevas
        # En modo full, transformar todas
        if mode == "incremental" and inserted_bronze == 0:
            logger.info(f"[{label}] Sin cambios nuevos, Silver ya está al día")
            duration_ms = int((time.monotonic() - start) * 1000)
            loader.log_sync(
                source_tab=tab_key,
                city_code=city_code,
                rows_fetched=rows_fetched,
                rows_inserted=0,
                rows_skipped=skipped_bronze,
                duration_ms=duration_ms,
                status="no_changes",
            )
            _update_report(report, label, rows_fetched, 0, skipped_bronze, duration_ms)
            return

        # 3. TRANSFORM — Limpiar y normalizar
        transform_fn = TRANSFORM_FUNCTIONS[tab_key]
        transformed = transform_fn(raw_rows, city_code)

        # 4. LOAD SILVER — Upsert a tablas normalizadas
        silver_count = 0
        if tab_key == "datos_margenes":
            silver_count += loader.upsert_projects(transformed)
            silver_count += loader.upsert_snapshots(transformed)
        elif tab_key == "tipologia_precios":
            silver_count += loader.upsert_units(transformed)
        elif tab_key == "amenidades":
            silver_count += loader.upsert_amenities(transformed)

        duration_ms = int((time.monotonic() - start) * 1000)

        # 5. LOG
        loader.log_sync(
            source_tab=tab_key,
            city_code=city_code,
            rows_fetched=rows_fetched,
            rows_inserted=inserted_bronze,
            rows_skipped=skipped_bronze,
            duration_ms=duration_ms,
            status="success",
        )

        _update_report(report, label, rows_fetched, inserted_bronze, skipped_bronze, duration_ms)
        logger.success(f"[{label}] ✓ {rows_fetched} fetched | {inserted_bronze} bronze | {silver_count} silver | {duration_ms}ms")

    except Exception as e:
        duration_ms = int((time.monotonic() - start) * 1000)
        logger.error(f"[{label}] ERROR: {e}")
        loader.log_sync(
            source_tab=tab_key,
            city_code=city_code,
            rows_fetched=0,
            rows_inserted=0,
            rows_skipped=0,
            duration_ms=duration_ms,
            status="error",
            error_message=str(e),
        )
        _update_report(report, label, 0, 0, 0, duration_ms, error=str(e))
        raise


# ============================================================
# ORQUESTADOR PRINCIPAL
# ============================================================

def run(city_filter: str = "ALL", tab_filter: str = "ALL", mode: str = "incremental") -> dict:
    """
    Ejecutar el pipeline completo.

    Args:
        city_filter: 'SCZ' | 'LPZ' | 'CBB' | 'ALL'
        tab_filter: 'datos_margenes' | 'tipologia_precios' | 'amenidades' | 'ALL'
        mode: 'incremental' | 'full'

    Returns:
        Dict con reporte completo del sync.
    """
    run_id = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    _setup_logging(run_id)

    logger.info("=" * 60)
    logger.info(f"🚀 Intelligence Pipeline — Sync #{run_id}")
    logger.info(f"   Modo: {mode} | Ciudades: {city_filter} | Tab: {tab_filter}")
    logger.info("=" * 60)

    pipeline_start = time.monotonic()
    report = {
        "run_id": run_id,
        "mode": mode,
        "city_filter": city_filter,
        "tab_filter": tab_filter,
        "started_at": datetime.utcnow().isoformat(),
        "tabs": {},
        "errors": [],
    }

    # Inicializar clientes
    sheets = SheetsClient.from_env()
    loader = SupabaseLoader.from_env()

    # Determinar qué procesar
    cities = (
        {k: v for k, v in SHEETS_CONFIG.items() if k == city_filter}
        if city_filter != "ALL"
        else SHEETS_CONFIG
    )

    tabs_to_process = (
        [tab_filter]
        if tab_filter != "ALL"
        else ["datos_margenes", "tipologia_precios", "amenidades"]
    )

    # Ejecutar por ciudad y tab
    for city_code, city_config in cities.items():
        spreadsheet_id = city_config["spreadsheet_id"]

        # Verificar que los tabs existen
        expected_tabs = [city_config["tabs"][t] for t in tabs_to_process]
        verification = sheets.verify_tabs(spreadsheet_id, expected_tabs)
        if verification["missing"]:
            logger.warning(
                f"[{city_code}] Tabs faltantes en el spreadsheet: {verification['missing']}"
            )

        for tab_key in tabs_to_process:
            tab_name = city_config["tabs"].get(tab_key)
            if not tab_name:
                continue
            if tab_name in verification["missing"]:
                logger.warning(f"[{city_code}/{tab_key}] Tab '{tab_name}' no encontrado, saltando")
                continue

            try:
                sync_tab(
                    sheets=sheets,
                    loader=loader,
                    city_code=city_code,
                    tab_key=tab_key,
                    spreadsheet_id=spreadsheet_id,
                    tab_name=tab_name,
                    mode=mode,
                    report=report,
                )
            except Exception as e:
                report["errors"].append({"tab": f"{city_code}/{tab_key}", "error": str(e)})
                # Continuar con el siguiente tab aunque falle uno

    # Refresh Gold layer si hubo cambios
    total_inserted = sum(
        v.get("inserted", 0) for v in report["tabs"].values()
    )
    if total_inserted > 0 or mode == "full":
        try:
            loader.refresh_gold_layer()
        except Exception as e:
            logger.error(f"Error refrescando Gold layer: {e}")
            report["errors"].append({"tab": "gold_refresh", "error": str(e)})
    else:
        logger.info("Sin cambios nuevos — Gold layer no necesita refresh")

    # Reporte final
    total_duration = int((time.monotonic() - pipeline_start) * 1000)
    report["finished_at"] = datetime.utcnow().isoformat()
    report["total_duration_ms"] = total_duration
    report["total_fetched"] = sum(v.get("fetched", 0) for v in report["tabs"].values())
    report["total_inserted"] = total_inserted
    report["success"] = len(report["errors"]) == 0

    # Guardar reporte JSON
    _save_report(report, run_id)

    logger.info("=" * 60)
    if report["success"]:
        logger.success(
            f"✅ Pipeline completado en {total_duration}ms | "
            f"{report['total_fetched']} rows fetched | "
            f"{total_inserted} rows nuevas"
        )
    else:
        logger.error(
            f"⚠️  Pipeline con errores ({len(report['errors'])} errores) | "
            f"{total_duration}ms"
        )
    logger.info("=" * 60)

    return report


def _update_report(report, label, fetched, inserted, skipped, duration_ms, error=None):
    report["tabs"][label] = {
        "fetched": fetched,
        "inserted": inserted,
        "skipped": skipped,
        "duration_ms": duration_ms,
        "error": error,
    }


def _save_report(report: dict, run_id: str) -> None:
    reports_dir = Path(__file__).parent / "reports"
    reports_dir.mkdir(exist_ok=True)
    report_path = reports_dir / f"sync_{run_id}.json"
    with open(report_path, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2, default=str)
    logger.info(f"Reporte guardado: {report_path}")


# ============================================================
# ENTRY POINT
# ============================================================

def main():
    parser = argparse.ArgumentParser(description="Intelligence Pipeline — Sync Sheets → Supabase")
    parser.add_argument("--city", default=os.getenv("SYNC_CITY", "ALL"),
                        choices=["SCZ", "LPZ", "CBB", "ALL"],
                        help="Ciudad a sincronizar (default: ALL)")
    parser.add_argument("--tab", default=os.getenv("SYNC_TAB", "ALL"),
                        choices=["datos_margenes", "tipologia_precios", "amenidades", "ALL"],
                        help="Tab a sincronizar (default: ALL)")
    parser.add_argument("--mode", default=os.getenv("SYNC_MODE", "incremental"),
                        choices=["incremental", "full"],
                        help="Modo de sync (default: incremental)")

    args = parser.parse_args()

    report = run(
        city_filter=args.city,
        tab_filter=args.tab,
        mode=args.mode,
    )

    # Salir con código de error si hubo fallos (para que GitHub Actions lo detecte)
    sys.exit(0 if report["success"] else 1)


if __name__ == "__main__":
    main()
