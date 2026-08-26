"""
pipeline/supabase_client.py
============================
Cliente para interactuar con Supabase via supabase-py.
Maneja upserts a Bronze, Silver y refresh del Gold layer.

Usa SUPABASE_SERVICE_KEY (service_role) para operaciones de escritura
masiva sin restricciones de RLS.

Skill: sheets_supabase_pipeline
"""

import os
import json
from typing import Any
from loguru import logger
from supabase import create_client, Client


class SupabaseLoader:
    """
    Cargador de datos hacia Supabase.
    Maneja upserts idempotentes a Bronze y Silver.
    """

    def __init__(self, url: str, service_key: str):
        """
        Args:
            url: URL del proyecto Supabase.
            service_key: service_role key (bypasa RLS para escritura masiva).
        """
        self.client: Client = create_client(url, service_key)
        logger.debug(f"Supabase client conectado a {url}")

    @classmethod
    def from_env(cls) -> "SupabaseLoader":
        """Crear loader desde variables de entorno."""
        url = os.environ.get("SUPABASE_URL")
        key = os.environ.get("SUPABASE_SERVICE_KEY")
        if not url or not key:
            raise EnvironmentError(
                "SUPABASE_URL y SUPABASE_SERVICE_KEY son requeridas. "
                "Configúralas en .env o en los GitHub Secrets."
            )
        return cls(url, key)

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
        Usa ON CONFLICT (row_hash) DO NOTHING para idempotencia.

        Args:
            table: Nombre de la tabla bronze (ej: "bronze_datos_margenes").
            rows: Lista de dicts crudos de Google Sheets.
            city_code: 'SCZ', 'LPZ' o 'CBB'.
            tab_name: Nombre del tab (para el hash y el log).

        Returns:
            Tuple (rows_inserted, rows_skipped).
        """
        from .utils import hash_row, clean_text

        if not rows:
            return 0, 0

        records = []
        for row in rows:
            row_hash = hash_row(city_code, tab_name, row)
            records.append({
                "city_code":    city_code,
                "row_hash":     row_hash,
                "raw_data":     row,
                # Extraer campos clave para indexación rápida
                "project_name": clean_text(
                    row.get("Proyecto:") or row.get("Proyecto") or ""
                ),
                "snapshot_date": (
                    row.get("Fecha") or row.get("Fecha ") or None
                ),
            })

        # Batch upsert en chunks de 500 (límite seguro de Supabase)
        inserted = 0
        for chunk in _chunked(records, 500):
            response = (
                self.client.table(table)
                .upsert(chunk, ignore_duplicates=True)
                .execute()
            )
            inserted += len(response.data) if response.data else 0

        skipped = len(rows) - inserted
        logger.info(f"[Bronze/{table}] {inserted} insertadas, {skipped} duplicadas (sin cambios)")
        return inserted, skipped

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
        self.client.table("bronze_sync_log").insert({
            "source_tab":    source_tab,
            "city_code":     city_code,
            "rows_fetched":  rows_fetched,
            "rows_inserted": rows_inserted,
            "rows_skipped":  rows_skipped,
            "duration_ms":   duration_ms,
            "status":        status,
            "error_message": error_message,
        }).execute()

    # --------------------------------------------------------
    # SILVER LAYER
    # --------------------------------------------------------

    def upsert_projects(self, records: list[dict]) -> int:
        """
        Upsert de proyectos en silver_projects.
        Conflict: (name, city_id) — pero usamos (project_name, city_code) como proxy.
        """
        if not records:
            return 0

        # Extraer solo los campos de proyecto (deduplicados por nombre+ciudad)
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
            response = (
                self.client.table("silver_projects")
                .upsert(chunk, ignore_duplicates=False)
                .execute()
            )
            count += len(response.data) if response.data else 0

        logger.info(f"[Silver/projects] {count} proyectos upserted")
        return count

    def upsert_snapshots(self, records: list[dict]) -> int:
        """Upsert de snapshots en silver_project_snapshots."""
        if not records:
            return 0

        snapshot_records = []
        for r in records:
            snapshot_records.append({
                "project_name":      r["project_name"],
                "city_code":         r["city_code"],
                "snapshot_date":     str(r["snapshot_date"]),
                "stage":             r.get("stage"),
                "total_units":       r.get("total_units"),
                "units_for_sale":    r.get("units_for_sale"),
                "units_sold":        r.get("units_sold"),
                "pct_for_sale":      r.get("pct_for_sale"),
                "pct_sold":          r.get("pct_sold"),
                "stock_sold_usd":    r.get("stock_sold_usd"),
                "stock_for_sale_usd": r.get("stock_for_sale_usd"),
                "stock_total_usd":   r.get("stock_total_usd"),
                "sales_velocity":    r.get("sales_velocity"),
                "months_stock":      r.get("months_stock"),
                "parking_price_usd": r.get("parking_price_usd"),
                "storage_price_usd": r.get("storage_price_usd"),
                "cash_payment":      r.get("cash_payment"),
                "direct_credit":     r.get("direct_credit"),
                "bank_credit":       r.get("bank_credit"),
                "tether_usdt":       r.get("tether_usdt"),
                "installment_plan":  r.get("installment_plan"),
                "exchange_rate":     r.get("exchange_rate"),
                "initial_pct":       r.get("initial_pct"),
                "monthly_payment":   r.get("monthly_payment"),
                "finance_months":    r.get("finance_months"),
                "increment_pct":     r.get("increment_pct"),
                "lien":              r.get("lien"),
                "bank_name":         r.get("bank_name"),
            })

        count = 0
        for chunk in _chunked(snapshot_records, 500):
            response = (
                self.client.table("silver_project_snapshots")
                .upsert(chunk, ignore_duplicates=False)
                .execute()
            )
            count += len(response.data) if response.data else 0

        logger.info(f"[Silver/snapshots] {count} snapshots upserted")
        return count

    def upsert_units(self, records: list[dict]) -> int:
        """Insert de unidades en silver_units (sin conflict key única, se insertan)."""
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
            response = (
                self.client.table("silver_units")
                .upsert(chunk, ignore_duplicates=True)
                .execute()
            )
            count += len(response.data) if response.data else 0

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
            response = (
                self.client.table("silver_amenities")
                .upsert(chunk, ignore_duplicates=True)
                .execute()
            )
            count += len(response.data) if response.data else 0

        logger.info(f"[Silver/amenities] {count} amenidades upserted")
        return count

    # --------------------------------------------------------
    # GOLD LAYER
    # --------------------------------------------------------

    def refresh_gold_layer(self) -> None:
        """
        Refrescar todas las Materialized Views del Gold layer.
        Llama a la función SQL `refresh_gold_layer()` via RPC.
        """
        logger.info("Refrescando Gold layer (materialized views)...")
        self.client.rpc("refresh_gold_layer").execute()
        logger.success("Gold layer refrescado ✓")


# --------------------------------------------------------
# Helpers
# --------------------------------------------------------

def _chunked(lst: list, size: int):
    """Dividir lista en chunks de tamaño máximo `size`."""
    for i in range(0, len(lst), size):
        yield lst[i : i + size]
