"""
pipeline/sheets_client.py
==========================
Cliente para Google Sheets API v4.
Usa Service Account para autenticación segura.

Ventajas sobre CSV export:
  - No depende de permisos públicos del sheet
  - Auth controlada con Service Account
  - Metadata de la hoja (última modificación)
  - Valores sin formatear (UNFORMATTED_VALUE) para parseo limpio

Skill: sheets_supabase_pipeline
"""

import os
from typing import Optional
from google.oauth2 import service_account
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
from loguru import logger


# Permisos de solo lectura para Sheets
SCOPES = ["https://www.googleapis.com/auth/spreadsheets.readonly"]


class SheetsClient:
    """
    Cliente para leer datos de Google Sheets vía API v4.

    Uso:
        client = SheetsClient.from_env()
        rows = client.fetch_tab("SPREADSHEET_ID", "Datos & Margenes")
    """

    def __init__(self, credentials: Credentials):
        """
        Inicializar el cliente con credenciales ya autenticadas.
        Usar `from_env()` o `from_service_account_file()` en la práctica.
        """
        self._service = build("sheets", "v4", credentials=credentials, cache_discovery=False)

    @classmethod
    def from_service_account_file(cls, credentials_path: str) -> "SheetsClient":
        """
        Crear cliente desde archivo JSON de Service Account.

        Args:
            credentials_path: Ruta al archivo JSON descargado desde Google Cloud Console.
        """
        creds = service_account.Credentials.from_service_account_file(
            credentials_path, scopes=SCOPES
        )
        logger.debug(f"Sheets client autenticado con {credentials_path}")
        return cls(creds)

    @classmethod
    def from_env(cls) -> "SheetsClient":
        """
        Crear cliente desde la variable de entorno GOOGLE_APPLICATION_CREDENTIALS.
        Es el método preferido en GitHub Actions (el secret se escribe al disco).
        """
        creds_path = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS")
        if not creds_path:
            raise EnvironmentError(
                "Variable GOOGLE_APPLICATION_CREDENTIALS no definida. "
                "Apunta a tu archivo JSON de Service Account."
            )
        return cls.from_service_account_file(creds_path)

    def fetch_tab(
        self,
        spreadsheet_id: str,
        tab_name: str,
        start_row: int = 1,
    ) -> list[dict]:
        """
        Obtener todas las filas de un tab como lista de dicts {columna: valor}.

        Args:
            spreadsheet_id: ID del spreadsheet (de la URL de Google Sheets).
            tab_name: Nombre exacto del tab (case-sensitive).
            start_row: Fila desde donde empezar (1 = incluye header).

        Returns:
            Lista de dicts donde las keys son los headers y los valores son celdas.
            Filas vacías son omitidas automáticamente.
        """
        range_notation = f"'{tab_name}'"
        logger.info(f"Fetching '{tab_name}' de spreadsheet {spreadsheet_id[:8]}...")

        try:
            result = (
                self._service.spreadsheets()
                .values()
                .get(
                    spreadsheetId=spreadsheet_id,
                    range=range_notation,
                    # UNFORMATTED_VALUE: números como números, no como strings formateados
                    valueRenderOption="UNFORMATTED_VALUE",
                    # FORMATTED_STRING: fechas como "15/7/2023" (más fácil de parsear)
                    dateTimeRenderOption="FORMATTED_STRING",
                )
                .execute()
            )
        except HttpError as e:
            logger.error(f"Error al leer '{tab_name}': {e}")
            raise

        values = result.get("values", [])

        if not values:
            logger.warning(f"Tab '{tab_name}' vacío o sin datos")
            return []

        # Primera fila = headers
        headers = [str(h).strip() for h in values[0]]
        rows = []

        for row_idx, row in enumerate(values[1:], start=2):
            # Rellenar celdas faltantes al final de la fila (Google API omite trailing blanks)
            padded_row = row + [""] * (len(headers) - len(row))
            row_dict = {headers[i]: padded_row[i] for i in range(len(headers))}

            # Omitir filas completamente vacías
            if all(v == "" or v is None for v in row_dict.values()):
                continue

            rows.append(row_dict)

        logger.success(f"'{tab_name}': {len(rows)} filas obtenidas")
        return rows

    def get_spreadsheet_metadata(self, spreadsheet_id: str) -> dict:
        """
        Obtener metadata del spreadsheet: título, lista de tabs y sus propiedades.

        Útil para verificar que los tabs configurados existen antes de hacer fetch.
        """
        try:
            meta = (
                self._service.spreadsheets()
                .get(
                    spreadsheetId=spreadsheet_id,
                    fields="properties.title,sheets.properties",
                )
                .execute()
            )
        except HttpError as e:
            logger.error(f"Error al obtener metadata de {spreadsheet_id}: {e}")
            raise

        tabs = [
            {
                "title": s["properties"]["title"],
                "sheet_id": s["properties"]["sheetId"],
                "index": s["properties"]["index"],
            }
            for s in meta.get("sheets", [])
        ]

        return {
            "title": meta["properties"]["title"],
            "spreadsheet_id": spreadsheet_id,
            "tabs": tabs,
        }

    def verify_tabs(self, spreadsheet_id: str, expected_tab_names: list[str]) -> dict:
        """
        Verificar que los tabs esperados existen en el spreadsheet.

        Returns:
            Dict con 'found' (tabs que existen) y 'missing' (tabs que faltan).
        """
        meta = self.get_spreadsheet_metadata(spreadsheet_id)
        existing_titles = {t["title"] for t in meta["tabs"]}

        found = [t for t in expected_tab_names if t in existing_titles]
        missing = [t for t in expected_tab_names if t not in existing_titles]

        if missing:
            logger.warning(
                f"Spreadsheet '{meta['title']}': tabs no encontrados: {missing}. "
                f"Tabs disponibles: {list(existing_titles)}"
            )
        return {"found": found, "missing": missing}
