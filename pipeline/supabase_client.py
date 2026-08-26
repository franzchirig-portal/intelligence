"""
pipeline/supabase_client.py
============================
Cliente para interactuar con Supabase via REST API directamente (httpx).
Evita los problemas de construcción de URL de supabase-py v2 (PGRST125).

Skill: sheets_supabase_pipeline
"""

import json
import os
from typing import Any
import httpx
from loguru import logger

from .utils import hash_row, clean_text


class SupabaseLoader:
    """
    Cargador de datos hacia Supabase usando REST API directa.
    Usa SUPABASE_SERVICE_KEY (service_role) para escritura sin restricciones de RLS.
    """

    def __init__(self, url: str, service_key: str):
        # Normalizar URL: remover trailing slash y /rest/v1 si ya está incluido
        _url = url.rstrip("/")
        if _url.endswith("/rest/v1"):
            _url = _url[: -len("/rest/v1")]
        self._url = _url
        self._key = service_key
        self._rest = f"{self._url}/rest/v1"
        self._headers = {
            "apikey": service_key,
            "Authorization": f"Bearer {service_key}",
            "Content-Type": "application/json",
        }
        # Cliente httpx reutilizable
        self._http = httpx.Client(
            headers=self._headers,
            timeout=60.0,
        )
        logger.debug(f"Supabase loader listo → {self._url}")

    @classmethod
    def from_env(cls) -> "SupabaseLoader":
        url = os.environ.get("SUPABASE_URL")
        key = os.environ.get("SUPABASE_SERVICE_KEY")
        if not url or not key:
            raise EnvironmentError(
                "SUPABASE_URL y SUPABASE_SERVICE_KEY son requeridas. "
                "Configúralas en .env o en los GitHub Secrets."
            )
        return cls(url, key)

    def __del__(self):
        try:
            self._http.close()
        except Exception:
            pass

    # --------------------------------------------------------
    # Helpers internos
    # --------------------------------------------------------

    def _post(self, table: str, records: list[dict], prefer: str, on_conflict: str = "") -> httpx.Response:
        """POST a la REST API de Supabase con manejo de errores detallado."""
        params = {}
        if on_conflict:
            params["on_conflict"] = on_conflict

        r = self._http.post(
            f"{self._rest}/{table}",
            params=params,
            headers={"Prefer": prefer},
            content=json.dumps(records, default=str),
        )
        if not r.is_success:
            body = r.text[:500]
            logger.error(
                f"Supabase POST /{table} → HTTP {r.status_code}: {body}"
            )
            r.raise_for_status()
        return r

    def _select(self, table: str, columns: str = "*", filters: dict = None) -> list[dict]:
        """SELECT simple desde una tabla."""
        params = {"select": columns}
        if filters:
            params.update(filters)
        r = self._http.get(f"{self._rest}/{table}", params=params)
        r.raise_for_status()
        return r.json()

    # --------------------------------------------------------
    # BRONZE LAYER
    # --------------------------------------------------------

    def upsert_bronze(
        self,
        table: str,
        rows: list[dict],
        city_code: str,
        tab_name: str,
    ) -> tuple[int, int]:
        """
        Insertar filas crudas en el Bronze layer.
        Ignora duplicados basado en la restricción UNIQUE(row_hash).

        Returns: (rows_inserted, rows_skipped)
        """
        if not rows:
            return 0, 0

        records = []
        for row in rows:
            rh = hash_row(city_code, tab_name, row)
            records.append({
                "city_code":    city_code,
                "row_hash":     rh,
                "raw_data":     row,
                "project_name": clean_text(
                    row.get("Proyecto:") or row.get("Proyecto") or ""
                ),
                "snapshot_date": str(
                    row.get("Fecha") or row.get("Fecha ") or ""
                ) or None,
            })

        inserted = 0
        for chunk in _chunked(records, 500):
            self._post(
                table, chunk,
                prefer="resolution=ignore-duplicates,return=minimal",
                on_conflict="row_hash",
            )
            inserted += len(chunk)

        # En modo ignore-duplicates no sabemos exactamente cuántas se insertaron
        # vs cuántas ya existían. Usamos el total como aproximación.
        logger.info(f"[Bronze/{table}] {inserted} filas enviadas (nuevas insertadas, duplicadas ignoradas)")
        return inserted, 0

    def log_sync(
        self,
        source_tab: str,
        city_code: str,
        rows_fetched: int,
        rows_inserted: int,
        rows_skipped: int,
        duration_ms: int,
        status: str = "success",
        error_message: str = None,
    ) -> None:
        """Registrar resultado del sync en bronze_sync_log."""
        try:
            self._post(
                "bronze_sync_log",
                [{
                    "source_tab":    source_tab,
                    "city_code":     city_code,
                    "rows_fetched":  rows_fetched,
                    "rows_inserted": rows_inserted,
                    "rows_skipped":  rows_skipped,
                    "duration_ms":   duration_ms,
                    "status":        status,
                    "error_message": error_message,
                }],
                prefer="return=minimal",
            )
        except Exception as e:
            logger.warning(f"No se pudo registrar en sync_log: {e}")

    # --------------------------------------------------------
    # SILVER LAYER
    # --------------------------------------------------------

    def upsert_projects(self, records: list[dict]) -> int:
        """Upsert de proyectos en silver_projects. Conflict: (name, city_code)."""
        if not records:
            return 0

        seen = set()
        project_records = []
        for r in records:
            key = (r["project_name"], r["city_code"])
            if key in seen:
                continue
            seen.add(key)
            project_records.append({
                "name":               r["project_name"],
                "city_code":          r["city_code"],
                "zone_name":          r.get("zone"),
                "sub_zone":           r.get("sub_zone"),
                "type":               r.get("type"),
                "quality":            r.get("quality"),
                "latitude":           r.get("latitude"),
                "longitude":          r.get("longitude"),
                "google_maps_id":     r.get("google_maps_id"),
                "floors":             r.get("floors"),
                "total_units_design": r.get("total_units_design"),
                "launch_date":        str(r["launch_date"]) if r.get("launch_date") else None,
                "delivery_date":      str(r["delivery_date"]) if r.get("delivery_date") else None,
                "developer":          r.get("developer"),
                "constructor":        r.get("constructor"),
                "commercializer":     r.get("commercializer"),
            })

        count = 0
        for chunk in _chunked(project_records, 500):
            self._post(
                "silver_projects", chunk,
                prefer="resolution=merge-duplicates,return=minimal",
                on_conflict="name,city_code",
            )
            count += len(chunk)

        logger.info(f"[Silver/projects] {count} proyectos upserted")
        return count

    def upsert_snapshots(self, records: list[dict]) -> int:
        """Upsert de snapshots en silver_project_snapshots."""
        if not records:
            return 0

        snapshot_records = []
        for r in records:
            snapshot_records.append({
                "project_name":       r["project_name"],
                "city_code":          r["city_code"],
                "snapshot_date":      str(r["snapshot_date"]),
                "stage":              r.get("stage"),
                "total_units":        r.get("total_units"),
                "units_for_sale":     r.get("units_for_sale"),
                "units_sold":         r.get("units_sold"),
                "pct_for_sale":       r.get("pct_for_sale"),
                "pct_sold":           r.get("pct_sold"),
                "stock_sold_usd":     r.get("stock_sold_usd"),
                "stock_for_sale_usd": r.get("stock_for_sale_usd"),
                "stock_total_usd":    r.get("stock_total_usd"),
                "sales_velocity":     r.get("sales_velocity"),
                "months_stock":       r.get("months_stock"),
                "parking_price_usd":  r.get("parking_price_usd"),
                "storage_price_usd":  r.get("storage_price_usd"),
                "cash_payment":       r.get("cash_payment"),
                "direct_credit":      r.get("direct_credit"),
                "bank_credit":        r.get("bank_credit"),
                "tether_usdt":        r.get("tether_usdt"),
                "installment_plan":   r.get("installment_plan"),
                "exchange_rate":      r.get("exchange_rate"),
                "initial_pct":        r.get("initial_pct"),
                "monthly_payment":    r.get("monthly_payment"),
                "finance_months":     r.get("finance_months"),
                "increment_pct":      r.get("increment_pct"),
                "lien":               r.get("lien"),
                "bank_name":          r.get("bank_name"),
            })

        count = 0
        for chunk in _chunked(snapshot_records, 500):
            self._post(
                "silver_project_snapshots", chunk,
                prefer="resolution=merge-duplicates,return=minimal",
                on_conflict="project_name,city_code,snapshot_date",
            )
            count += len(chunk)

        logger.info(f"[Silver/snapshots] {count} snapshots upserted")
        return count

    def upsert_units(self, records: list[dict]) -> int:
        """Upsert de unidades en silver_units."""
        if not records:
            return 0

        unit_records = []
        for r in records:
            unit_records.append({
                "project_name":           r["project_name"],
                "city_code":              r["city_code"],
                "snapshot_date":          str(r["snapshot_date"]),
                "bedrooms":               r.get("bedrooms"),
                "bathrooms":              r.get("bathrooms"),
                "area_m2":                r.get("area_m2"),
                "price_per_m2_usd":       r.get("price_per_m2_usd"),
                "price_usd":              r.get("price_usd"),
                "status":                 r.get("status"),
                "typology":               r.get("typology"),
                "bathrooms_label":        r.get("bathrooms_label"),
                "exchange_rate":          r.get("exchange_rate"),
                "exchange_rate_parallel": r.get("exchange_rate_parallel"),
                "price_per_m2_bob":       r.get("price_per_m2_bob"),
                "price_usd_per_bob":      r.get("price_usd_per_bob"),
                "quality":                r.get("quality"),
            })

        count = 0
        for chunk in _chunked(unit_records, 500):
            self._post(
                "silver_units", chunk,
                prefer="resolution=ignore-duplicates,return=minimal",
                on_conflict="project_name,city_code,snapshot_date,area_m2,price_usd",
            )
            count += len(chunk)

        logger.info(f"[Silver/units] {count} unidades upserted")
        return count

    def upsert_amenities(self, records: list[dict]) -> int:
        """Upsert de amenidades en silver_amenities."""
        if not records:
            return 0

        amenity_records = []
        for r in records:
            amenity_records.append({
                "project_name":  r["project_name"],
                "city_code":     r["city_code"],
                "snapshot_date": str(r["snapshot_date"]),
                "amenity_name":  r["amenity_name"],
                "has_amenity":   r.get("has_amenity", True),
            })

        count = 0
        for chunk in _chunked(amenity_records, 500):
            self._post(
                "silver_amenities", chunk,
                prefer="resolution=ignore-duplicates,return=minimal",
                on_conflict="project_name,city_code,snapshot_date,amenity_name",
            )
            count += len(chunk)

        logger.info(f"[Silver/amenities] {count} amenidades upserted")
        return count

    # --------------------------------------------------------
    # GOLD LAYER
    # --------------------------------------------------------

    def refresh_gold_layer(self) -> None:
        """Llamar a la función SQL refresh_gold_layer() via RPC."""
        logger.info("Refrescando Gold layer (materialized views)...")
        r = self._http.post(
            f"{self._rest}/rpc/refresh_gold_layer",
            headers={"Prefer": "return=minimal"},
            content="{}",
        )
        if not r.is_success:
            raise Exception(f"HTTP {r.status_code}: {r.text[:300]}")
        logger.success("Gold layer refrescado ✓")


# --------------------------------------------------------
# Helpers
# --------------------------------------------------------

def _chunked(lst: list, size: int):
    for i in range(0, len(lst), size):
        yield lst[i: i + size]
