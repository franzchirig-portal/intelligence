"""
pipeline/transform.py
======================
Transformación y limpieza de datos desde el formato crudo de Google Sheets
al formato normalizado para las tablas Silver de Supabase.

Cada función `transform_<tab>` recibe la lista cruda de dicts (Bronze)
y devuelve registros listos para insertar en Silver.

Skill: sheets_supabase_pipeline
"""

from datetime import date
from typing import Optional
from loguru import logger

from .config import (
    DATOS_MARGENES_COLUMNS,
    TIPOLOGIA_PRECIOS_COLUMNS,
    AMENIDADES_COLUMNS,
    INVALID_PROJECT_VALUES,
)
from .utils import (
    parse_number,
    parse_percentage,
    parse_date,
    parse_boolean,
    parse_coordinates,
    clean_text,
)


def _remap_columns(row: dict, column_map: dict) -> dict:
    """
    Renombrar columnas de un dict usando un mapa {nombre_sheet: nombre_python}.
    Columnas no mapeadas se ignoran (datos derivados / cálculos del sheet).
    """
    result = {}
    for sheet_col, python_field in column_map.items():
        # Buscar la columna (puede tener espacios extra o variaciones)
        value = None
        for k, v in row.items():
            if k.strip() == sheet_col.strip():
                value = v
                break
        result[python_field] = value
    return result


def transform_datos_margenes(
    raw_rows: list[dict],
    city_code: str,
) -> list[dict]:
    """
    Transformar filas del tab "Datos & Margenes" al schema Silver.

    Produce registros para:
        - silver_projects (atributos estáticos del proyecto)
        - silver_project_snapshots (estado del proyecto en la fecha del snapshot)

    Args:
        raw_rows: Lista de dicts crudos del tab.
        city_code: 'SCZ', 'LPZ' o 'CBB'.

    Returns:
        Lista de dicts con el schema de silver_project_snapshots
        (incluye campos de proyecto para upsert).
    """
    result = []
    skipped = 0

    for row in raw_rows:
        remapped = _remap_columns(row, DATOS_MARGENES_COLUMNS)

        project_name = clean_text(remapped.get("project_name"))
        if not project_name or project_name in INVALID_PROJECT_VALUES:
            skipped += 1
            continue

        snapshot_date = parse_date(remapped.get("snapshot_date"))
        if not snapshot_date:
            skipped += 1
            logger.debug(f"Fila sin fecha de snapshot, ignorada: {project_name}")
            continue

        # Parsear coordenadas del campo google_maps_id ("lat, lng")
        lat, lng = parse_coordinates(remapped.get("google_maps_id"))

        record = {
            # --- Campos de proyecto (para upsert en silver_projects) ---
            "project_name":      project_name,
            "city_code":         city_code,
            "zone":              clean_text(remapped.get("zone")),
            "sub_zone":          clean_text(remapped.get("sub_zone")),
            "type":              clean_text(remapped.get("type")),
            "quality":           clean_text(remapped.get("quality")),
            "latitude":          lat,
            "longitude":         lng,
            "google_maps_id":    clean_text(remapped.get("google_maps_id")),
            "floors":            int(f) if (f := parse_number(remapped.get("floors"))) else None,
            "total_units_design": int(u) if (u := parse_number(remapped.get("total_units"))) else None,
            "launch_date":       parse_date(remapped.get("launch_date")),
            "delivery_date":     parse_date(remapped.get("delivery_date")),
            "developer":         clean_text(remapped.get("developer")),
            "constructor":       clean_text(remapped.get("constructor")),
            "commercializer":    clean_text(remapped.get("commercializer")),

            # --- Campos del snapshot ---
            "snapshot_date":     snapshot_date,
            "stage":             clean_text(remapped.get("stage")),
            "total_units":       int(u) if (u := parse_number(remapped.get("total_units"))) else None,
            "units_for_sale":    int(u) if (u := parse_number(remapped.get("units_for_sale"))) else None,
            "units_sold":        int(u) if (u := parse_number(remapped.get("units_sold"))) else None,
            "pct_for_sale":      parse_percentage(remapped.get("pct_for_sale")),
            "pct_sold":          parse_percentage(remapped.get("pct_sold")),
            "stock_sold_usd":    parse_number(remapped.get("stock_sold_usd")),
            "stock_for_sale_usd": parse_number(remapped.get("stock_for_sale_usd")),
            "stock_total_usd":   parse_number(remapped.get("stock_total_usd")),
            "sales_velocity":    parse_number(remapped.get("sales_velocity")),
            "months_stock":      parse_number(remapped.get("months_stock")),
            "parking_price_usd": parse_number(remapped.get("parking_price_usd")),
            "storage_price_usd": parse_number(remapped.get("storage_price_usd")),

            # --- Financiamiento ---
            "cash_payment":      parse_boolean(remapped.get("cash_payment")),
            "direct_credit":     parse_boolean(remapped.get("direct_credit")),
            "bank_credit":       parse_boolean(remapped.get("bank_credit")),
            "tether_usdt":       parse_boolean(remapped.get("tether_usdt")),
            "installment_plan":  clean_text(remapped.get("installment_plan")),
            "exchange_rate":     parse_number(remapped.get("exchange_rate")),
            "initial_pct":       clean_text(remapped.get("initial_pct")),
            "monthly_payment":   parse_number(remapped.get("monthly_payment")),
            "finance_months":    int(m) if (m := parse_number(remapped.get("finance_months"))) else None,
            "increment_pct":     clean_text(remapped.get("increment_pct")),
            "lien":              clean_text(remapped.get("lien")),
            "bank_name":         clean_text(remapped.get("bank_name")),
        }
        result.append(record)

    logger.info(
        f"[{city_code}] datos_margenes: {len(result)} registros transformados, {skipped} ignorados"
    )
    return result


def transform_tipologia_precios(
    raw_rows: list[dict],
    city_code: str,
) -> list[dict]:
    """
    Transformar filas del tab "Tipología & Precios" al schema Silver.

    Cada fila representa una unidad individual (departamento/casa)
    dentro de un proyecto en una fecha específica.

    Produce registros para silver_units.
    """
    result = []
    skipped = 0

    for row in raw_rows:
        remapped = _remap_columns(row, TIPOLOGIA_PRECIOS_COLUMNS)

        project_name = clean_text(remapped.get("project_name"))
        if not project_name or project_name in INVALID_PROJECT_VALUES:
            skipped += 1
            continue

        snapshot_date = parse_date(remapped.get("snapshot_date"))
        if not snapshot_date:
            skipped += 1
            continue

        # Ignorar unidades sin m² o precio
        area_m2 = parse_number(remapped.get("area_m2"))
        price_usd = parse_number(remapped.get("price_usd"))
        if not area_m2 and not price_usd:
            skipped += 1
            continue

        record = {
            "project_name":          project_name,
            "city_code":             city_code,
            "zone":                  clean_text(remapped.get("zone")),
            "sub_zone":              clean_text(remapped.get("sub_zone")),
            "snapshot_date":         snapshot_date,
            "bedrooms":              int(b) if (b := parse_number(remapped.get("bedrooms"))) is not None else None,
            "bathrooms":             int(b) if (b := parse_number(remapped.get("bathrooms"))) is not None else None,
            "area_m2":               area_m2,
            "price_per_m2_usd":      parse_number(remapped.get("price_per_m2_usd")),
            "price_usd":             price_usd,
            "status":                clean_text(remapped.get("status")),
            "stage":                 clean_text(remapped.get("stage")),
            "type":                  clean_text(remapped.get("type")),
            "typology":              clean_text(remapped.get("typology")),
            "bathrooms_label":       clean_text(remapped.get("bathrooms_label")),
            "exchange_rate":         parse_number(remapped.get("exchange_rate")),
            "exchange_rate_parallel": parse_number(remapped.get("exchange_rate_parallel")),
            "price_per_m2_bob":      parse_number(remapped.get("price_per_m2_bob")),
            "price_usd_per_bob":     parse_number(remapped.get("price_usd_per_bob")),
            "quality":               clean_text(remapped.get("quality")),
        }
        result.append(record)

    logger.info(
        f"[{city_code}] tipologia_precios: {len(result)} unidades transformadas, {skipped} ignoradas"
    )
    return result


def transform_amenidades(
    raw_rows: list[dict],
    city_code: str,
) -> list[dict]:
    """
    Transformar filas del tab "Amenidades" al schema Silver.

    Cada fila representa una amenidad de un proyecto.
    Las filas con amenity_name = "Falso" son amenidades ausentes,
    se conservan como has_amenity=False para completitud.

    Produce registros para silver_amenities.
    """
    result = []
    skipped = 0

    for row in raw_rows:
        # El tab "Amenidades" tiene variación de nombres de columna entre ciudades
        remapped = _remap_columns(row, AMENIDADES_COLUMNS)

        project_name = clean_text(remapped.get("project_name"))
        if not project_name or project_name in INVALID_PROJECT_VALUES:
            skipped += 1
            continue

        snapshot_date = parse_date(remapped.get("snapshot_date"))
        if not snapshot_date:
            skipped += 1
            continue

        amenity_raw = remapped.get("amenity_name")
        amenity_name = clean_text(amenity_raw)

        # "Falso" significa que la amenidad NO está presente
        has_amenity = amenity_name not in (None, "", "Falso", "FALSE")
        if not has_amenity:
            # Podemos omitir los "Falso" o guardarlos — los omitimos para ahorrar espacio
            skipped += 1
            continue

        record = {
            "project_name":  project_name,
            "city_code":     city_code,
            "zone":          clean_text(remapped.get("zone")),
            "sub_zone":      clean_text(remapped.get("sub_zone")),
            "snapshot_date": snapshot_date,
            "amenity_name":  amenity_name,
            "has_amenity":   True,
            "stage":         clean_text(remapped.get("stage")),
        }
        result.append(record)

    logger.info(
        f"[{city_code}] amenidades: {len(result)} amenidades transformadas, {skipped} ignoradas (incluye 'Falso')"
    )
    return result
