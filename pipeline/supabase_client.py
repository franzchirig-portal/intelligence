"""
pipeline/supabase_client.py
============================
Cliente para interactuar con Supabase via REST API (Modelo Diamante).
"""

import json
import os
import httpx
from loguru import logger


class SupabaseLoader:
    def __init__(self, url: str, service_key: str):
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
            "Prefer": "resolution=merge-duplicates"
        }
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
                "SUPABASE_URL y SUPABASE_SERVICE_KEY son requeridas."
            )
        return cls(url, key)

    def __del__(self):
        try:
            self._http.close()
        except Exception:
            pass

    def upsert_batch(self, table: str, records: list[dict], on_conflict: str):
        if not records:
            return

        batch_size = 500
        total_records = len(records)
        
        for i in range(0, total_records, batch_size):
            chunk = records[i:i + batch_size]
            params = {"on_conflict": on_conflict} if on_conflict else {}
            
            r = self._http.post(
                f"{self._rest}/{table}",
                params=params,
                content=json.dumps(chunk, default=str),
            )
            
            if not r.is_success:
                logger.error(f"Error {r.status_code} upserting to {table}: {r.text[:500]}")
                r.raise_for_status()
                
        logger.success(f"Upsert {total_records} rows to {table}")

