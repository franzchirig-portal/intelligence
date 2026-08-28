"""
pipeline/sync.py
=================
Orquestador principal del pipeline ETL (Modelo Diamante).
Coordina el flujo completo: Extract (Sheets) → Transform (Diamond) → Load (Supabase).
"""

import os
import sys
import time
from loguru import logger
from dotenv import load_dotenv

from .config import SHEETS_CONFIG, DIAMOND_TABLES
from .sheets_client import SheetsClient
from .supabase_client import SupabaseLoader
from .transform import DiamondTransformer

def _setup_logging():
    logger.remove()
    logger.add(
        sys.stderr,
        format="<green>{time:HH:mm:ss}</green> | <level>{level:<8}</level> | {message}",
        level="INFO",
        colorize=True,
    )

def main():
    _setup_logging()
    logger.info("=" * 60)
    logger.info(f"🚀 Intelligence Pipeline (Diamond) — Sync")
    logger.info("=" * 60)
    
    load_dotenv()
    
    # 1. Connect
    try:
        sheets = SheetsClient()
        loader = SupabaseLoader.from_env()
        transformer = DiamondTransformer()
    except Exception as e:
        logger.error(f"Error inicializando clientes: {e}")
        sys.exit(1)
        
    # 2. Extract
    scz_data = {}
    lpz_data = {}
    cbb_data = {}
    
    cities = {"SCZ": scz_data, "LPZ": lpz_data, "CBB": cbb_data}
    
    for city, data_dict in cities.items():
        conf = SHEETS_CONFIG.get(city)
        if not conf:
            continue
            
        spreadsheet_id = conf["spreadsheet_id"]
        for tab_key, tab_name in conf["tabs"].items():
            logger.info(f"[{city}] Extracting '{tab_name}'...")
            try:
                rows = sheets.get_all_rows(spreadsheet_id, tab_name)
                data_dict[tab_key] = rows
                logger.success(f"[{city}] '{tab_name}': {len(rows)} filas obtenidas")
            except Exception as e:
                logger.error(f"[{city}] Error obteniendo '{tab_name}': {e}")
                data_dict[tab_key] = []
                
    # 3. Transform
    logger.info("Transformando datos al Modelo Diamante...")
    diamond_data = transformer.transform_all(scz_data, lpz_data, cbb_data)
    
    # 4. Load
    logger.info("Cargando a Supabase...")
    
    # Orden de inserción para respetar Foreign Keys
    tables_to_load = [
        ("proyectos", "proyecto_id"),
        ("indicadores_censo", "indicador_censo_id"),
        ("tipologias", "tipologia_id"),
        ("condiciones_financieras", "condicion_financiera_id"),
        ("amenidades", "amenidad_id"),
    ]
    
    for tab_key, pk_col in tables_to_load:
        records = diamond_data.get(DIAMOND_TABLES[tab_key], [])
        if not records:
            continue
        try:
            loader.upsert_batch(
                table=DIAMOND_TABLES[tab_key],
                records=records,
                on_conflict=pk_col
            )
        except Exception as e:
            logger.error(f"Error cargando {DIAMOND_TABLES[tab_key]}: {e}")

    logger.success("✅ Sync completado exitosamente.")

if __name__ == "__main__":
    main()
