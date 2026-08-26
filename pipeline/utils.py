"""
pipeline/utils.py
==================
Utilidades compartidas: hasheo de filas, parseo de formatos bolivianos,
logging configurado.

Los datos de los Sheets bolivianos tienen convenciones de formato
distintas al estándar: punto como separador de miles, coma como decimal.

Skill: sheets_supabase_pipeline
"""

import hashlib
import json
import re
from datetime import date, datetime
from typing import Any, Optional
from loguru import logger


# ============================================================
# HASH DE FILAS
# Detectar si una fila cambió entre syncs sin comparar campo a campo
# ============================================================

def hash_row(city_code: str, tab_name: str, row: dict) -> str:
    """
    Calcular un hash SHA256 de una fila para detectar cambios.

    El hash incluye ciudad + tab + contenido de la fila serializado.
    Si el contenido de cualquier campo cambia, el hash cambia.

    Returns:
        Hex string de 64 chars (SHA256).
    """
    canonical = json.dumps(
        {"city": city_code, "tab": tab_name, "row": row},
        sort_keys=True,
        ensure_ascii=False,
        default=str,
    )
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


# ============================================================
# PARSEO DE NÚMEROS — Formato Bolivia
# Los sheets bolivianos usan punto como separador de miles
# y coma como separador decimal.
# Ejemplos: "1.234.567,89" → 1234567.89 | "78,05%" → 0.7805
# ============================================================

def parse_number(value: Any) -> Optional[float]:
    """
    Parsear número en formato boliviano a float.

    Soporta:
        - "1.234.567,89" → 1234567.89
        - "1,234,567.89" → 1234567.89 (ya en formato US)
        - 1234567.89    → 1234567.89 (ya es número, API devuelve UNFORMATTED)
        - "0,00"        → 0.0
        - ""            → None
        - "-"           → None
    """
    if value is None or value == "" or value == "-":
        return None

    # Si ya es número (la API devuelve UNFORMATTED_VALUE cuando puede)
    if isinstance(value, (int, float)):
        return float(value)

    text = str(value).strip()

    if not text or text in ("-", "N/A", "#N/A", "#REF!"):
        return None

    # Remover espacios y el símbolo de moneda si aparece
    text = text.replace(" ", "").replace("$", "").replace("USD", "")

    # Detectar formato: si termina con ",XX" (decimal con coma boliviana)
    # vs si termina con ".XX" (decimal con punto anglosajón)
    if "," in text and "." in text:
        # Ambos: determinar cuál es el decimal por posición
        last_comma = text.rfind(",")
        last_dot = text.rfind(".")
        if last_comma > last_dot:
            # La coma es el decimal: "1.234.567,89"
            text = text.replace(".", "").replace(",", ".")
        else:
            # El punto es el decimal: "1,234,567.89"
            text = text.replace(",", "")
    elif "," in text:
        # Solo coma: puede ser decimal boliviano "1234567,89" o miles "1,234"
        # Si hay exactamente 3 dígitos después de la última coma → probablemente miles
        after_comma = text.split(",")[-1]
        if len(after_comma) == 3 and text.count(",") == 1:
            # Ambiguo, asumimos decimal boliviano (más común en estos sheets)
            text = text.replace(",", ".")
        else:
            text = text.replace(",", ".")
    # Si solo tiene punto, ya está en formato estándar

    try:
        return float(text)
    except ValueError:
        logger.debug(f"No se pudo parsear número: '{value}'")
        return None


def parse_percentage(value: Any) -> Optional[float]:
    """
    Parsear porcentaje a float entre 0 y 1.

    Ejemplos:
        "78,05%"  → 0.7805
        "100,00%" → 1.0
        "0,0%"    → 0.0
        0.78      → 0.78 (ya es float entre 0 y 1, de la API)
    """
    if value is None or value == "":
        return None

    if isinstance(value, (int, float)):
        # Si la API devolvió un número, puede ser 0.78 o 78.05 dependiendo del formato
        v = float(value)
        return v / 100.0 if v > 1.0 else v

    text = str(value).strip().replace("%", "").replace(" ", "")
    num = parse_number(text)
    if num is None:
        return None
    return num / 100.0


def parse_date(value: Any) -> Optional[date]:
    """
    Parsear fecha en varios formatos al tipo date de Python.

    Formatos soportados:
        "15/7/2023"     → date(2023, 7, 15)
        "15/07/2023"    → date(2023, 7, 15)
        "2023-07-15"    → date(2023, 7, 15)
        "feb 2025"      → date(2025, 2, 1)   (mes-año, día=1)
        "jul-2027"      → date(2027, 7, 1)
        "jul-2027"      → date(2027, 7, 1)
    """
    if value is None or value == "":
        return None

    if isinstance(value, (date, datetime)):
        return value.date() if isinstance(value, datetime) else value

    text = str(value).strip()

    # Formato DD/MM/YYYY o D/M/YYYY
    m = re.match(r"^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$", text)
    if m:
        try:
            return date(int(m.group(3)), int(m.group(2)), int(m.group(1)))
        except ValueError:
            pass

    # Formato YYYY-MM-DD
    m = re.match(r"^(\d{4})[/\-.](\d{1,2})[/\-.](\d{1,2})$", text)
    if m:
        try:
            return date(int(m.group(1)), int(m.group(2)), int(m.group(3)))
        except ValueError:
            pass

    # Formato "feb 2025" o "jul-2027"
    month_map = {
        "ene": 1, "jan": 1,
        "feb": 2,
        "mar": 3,
        "abr": 4, "apr": 4,
        "may": 5,
        "jun": 6,
        "jul": 7,
        "ago": 8, "aug": 8,
        "sep": 9, "sept": 9,
        "oct": 10,
        "nov": 11,
        "dic": 12, "dec": 12,
    }
    m = re.match(r"^([a-zA-Z]+)[\s\-](\d{4})$", text.lower())
    if m:
        month_str = m.group(1)[:3]
        month_num = month_map.get(month_str)
        if month_num:
            try:
                return date(int(m.group(2)), month_num, 1)
            except ValueError:
                pass

    logger.debug(f"No se pudo parsear fecha: '{value}'")
    return None


def parse_boolean(value: Any) -> Optional[bool]:
    """
    Parsear booleans de los sheets.

    True:  True, "TRUE", "true", "Verdadero", 1, "Si", "Sí"
    False: False, "FALSE", "false", "Falso", 0, "No", ""
    """
    if value is None or value == "":
        return None
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)):
        return bool(value)

    text = str(value).strip().lower()
    if text in ("true", "verdadero", "si", "sí", "1", "yes"):
        return True
    if text in ("false", "falso", "no", "0"):
        return False
    return None


def parse_coordinates(value: Any) -> tuple[Optional[float], Optional[float]]:
    """
    Parsear coordenadas GPS del formato de los sheets.

    Input: '"-17.37772720488363, -66.16632106351516"'
    Output: (-17.37772720488363, -66.16632106351516)

    Returns:
        Tuple (latitude, longitude) o (None, None) si no se puede parsear.
    """
    if not value:
        return None, None

    text = str(value).strip().strip('"').strip("'")
    m = re.match(r"^\s*(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)\s*$", text)
    if m:
        try:
            return float(m.group(1)), float(m.group(2))
        except ValueError:
            pass

    logger.debug(f"No se pudieron parsear coordenadas: '{value}'")
    return None, None


def clean_text(value: Any) -> Optional[str]:
    """
    Limpiar y normalizar texto: strip, collapse espacios múltiples.
    Retorna None para strings vacíos.
    """
    if value is None:
        return None
    text = " ".join(str(value).split()).strip()
    return text if text else None
