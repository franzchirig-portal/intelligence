"""
pipeline/transform.py
======================
Transformación y limpieza de datos (Modelo Diamante).
"""

from typing import Dict, List, Any
import uuid
from loguru import logger
from datetime import date

from .config import DATOS_MARGENES_COLUMNS, TIPOLOGIA_PRECIOS_COLUMNS, AMENIDADES_COLUMNS, INVALID_PROJECT_VALUES
from .utils import parse_number, parse_percentage, parse_date, parse_coordinates, clean_text
from .geospatial import KMZMatcher

# Namespace for deterministic UUIDs
NAMESPACE = uuid.uuid5(uuid.NAMESPACE_DNS, "inteligencia-inmobiliaria.com")

def make_uuid(*args) -> str:
    """Generate a deterministic UUID from a set of strings."""
    key = "|".join(str(a).strip().lower() for a in args)
    return str(uuid.uuid5(NAMESPACE, key))

class DiamondTransformer:
    def __init__(self, kmz_dir: str = "datakmz"):
        self.kmz_matcher = KMZMatcher(kmz_dir)
        
    def _remap(self, row: dict, col_map: dict) -> dict:
        result = {}
        for sheet_col, py_field in col_map.items():
            val = None
            for k, v in row.items():
                if k.strip() == sheet_col.strip():
                    val = v
                    break
            result[py_field] = val
        return result

    def transform_all(self, scz_data, lpz_data, cbb_data) -> Dict[str, List[Dict[str, Any]]]:
        all_data = {"SCZ": scz_data, "LPZ": lpz_data, "CBB": cbb_data}
        
        proyectos = {} 
        indicadores = {} 
        tipologias = {}
        condiciones = {}
        amenidades = {}
        
        # 1. "Datos & Margenes"
        for city_code, city_tabs in all_data.items():
            if "datos_margenes" not in city_tabs:
                continue
                
            for row in city_tabs["datos_margenes"]:
                remapped = self._remap(row, DATOS_MARGENES_COLUMNS)
                
                proj = clean_text(remapped.get("project_name"))
                if not proj or proj in INVALID_PROJECT_VALUES:
                    continue
                    
                proj_id = make_uuid("proyecto", proj, city_code)
                
                if proj_id not in proyectos:
                    lat, lng = parse_coordinates(remapped.get("google_maps_id"))
                    zona_kmz = clean_text(remapped.get("zone"))
                    
                    if lat and lng:
                        zona_calc = self.kmz_matcher.find_zone(lat, lng, city_code)
                        if zona_calc:
                            zona_kmz = zona_calc
                            
                    proyectos[proj_id] = {
                        "proyecto_id": proj_id,
                        "proyecto": proj,
                        "ZONAS": zona_kmz,
                        "SUBZONAS": clean_text(remapped.get("sub_zone")),
                        "ciudad": city_code,
                        "zona_aux": "",
                        "tipo_inmueble": clean_text(remapped.get("type")),
                        "calidad": clean_text(remapped.get("quality")),
                        "desarrollador": clean_text(remapped.get("developer")),
                        "constructor": clean_text(remapped.get("constructor")),
                        "comercializador": clean_text(remapped.get("commercializer")),
                        "id_google_maps": clean_text(remapped.get("google_maps_id")),
                        "latitud": lat,
                        "longitud": lng,
                        "lanzamiento": parse_date(remapped.get("launch_date")),
                        "entrega": parse_date(remapped.get("delivery_date")),
                        "pisos": int(f) if (f := parse_number(remapped.get("floors"))) else None,
                        "uv": ""
                    }
                
                snap_date_raw = parse_date(remapped.get("snapshot_date"))
                if not snap_date_raw:
                    continue
                snap_date = str(snap_date_raw)
                
                ind_id = make_uuid("indicador", proj_id, snap_date)
                
                if ind_id not in indicadores:
                    indicadores[ind_id] = {
                        "indicador_censo_id": ind_id,
                        "proyecto_id": proj_id,
                        "fecha_snapshot": snap_date,
                        "etapa": clean_text(remapped.get("stage")),
                        "und_totales": int(x) if (x := parse_number(remapped.get("total_units"))) else None,
                        "und_vendidas": int(x) if (x := parse_number(remapped.get("units_sold"))) else None,
                        "und_por_vender": int(x) if (x := parse_number(remapped.get("units_for_sale"))) else None,
                        "pct_por_vender": parse_percentage(remapped.get("pct_for_sale")),
                        "pct_vendido": parse_percentage(remapped.get("pct_sold")),
                        "stock_vendido": parse_number(remapped.get("stock_sold_usd")),
                        "stock_x_vender": parse_number(remapped.get("stock_for_sale_usd")),
                        "stock_total": parse_number(remapped.get("stock_total_usd")),
                        "ritmo_venta": parse_number(remapped.get("sales_velocity")),
                        "meses_stock": parse_number(remapped.get("months_stock")),
                        "parqueo_sus": parse_number(remapped.get("parking_price_usd")),
                        "baulera_sus": parse_number(remapped.get("storage_price_usd"))
                    }
                    
                    modalidad = clean_text(remapped.get("bank_name", ""))
                    if modalidad:
                        cond_id = make_uuid("condicion", ind_id, modalidad)
                        condiciones[cond_id] = {
                            "condicion_financiera_id": cond_id,
                            "indicador_censo_id": ind_id,
                            "modalidad_pago": "Bancario",
                            "aporte_inicial": parse_percentage(remapped.get("initial_pct")),
                            "cuota_mensual": parse_number(remapped.get("monthly_payment")),
                            "meses": int(m) if (m := parse_number(remapped.get("finance_months"))) else None,
                            "banco": modalidad
                        }

        # 2. "Tipología & Precios"
        for city_code, city_tabs in all_data.items():
            if "tipologia_precios" not in city_tabs:
                continue
                
            for row in city_tabs["tipologia_precios"]:
                remapped = self._remap(row, TIPOLOGIA_PRECIOS_COLUMNS)
                proj = clean_text(remapped.get("project_name"))
                if not proj or proj in INVALID_PROJECT_VALUES:
                    continue
                    
                proj_id = make_uuid("proyecto", proj, city_code)
                if proj_id not in proyectos:
                    continue
                    
                snap_date_raw = parse_date(remapped.get("snapshot_date"))
                if not snap_date_raw:
                    continue
                snap_date = str(snap_date_raw)
                
                ind_id = make_uuid("indicador", proj_id, snap_date)
                if ind_id not in indicadores:
                    continue
                    
                tipologia_nombre = clean_text(remapped.get("typology", ""))
                tipologia_id = make_uuid("tipologia", ind_id, tipologia_nombre)
                
                tipologias[tipologia_id] = {
                    "tipologia_id": tipologia_id,
                    "indicador_censo_id": ind_id,
                    "tipologia": tipologia_nombre,
                    "dormitorios": int(x) if (x := parse_number(remapped.get("bedrooms"))) else None,
                    "banos": int(x) if (x := parse_number(remapped.get("bathrooms"))) else None,
                    "construccion_m2": parse_number(remapped.get("area_m2")),
                    "sus_m2": parse_number(remapped.get("price_per_m2_usd")),
                    "precio": parse_number(remapped.get("price_usd")),
                    "bs_m2": parse_number(remapped.get("price_per_m2_bob")),
                    "usd_m2": parse_number(remapped.get("price_usd_per_bob")),
                    "estado": clean_text(remapped.get("status")),
                    "tc_oficial": parse_number(remapped.get("exchange_rate")),
                    "tc": parse_number(remapped.get("exchange_rate_parallel"))
                }
                
        # 3. "Amenidades"
        for city_code, city_tabs in all_data.items():
            if "amenidades" not in city_tabs:
                continue
                
            for row in city_tabs["amenidades"]:
                remapped = self._remap(row, AMENIDADES_COLUMNS)
                proj = clean_text(remapped.get("project_name"))
                if not proj or proj in INVALID_PROJECT_VALUES:
                    continue
                    
                proj_id = make_uuid("proyecto", proj, city_code)
                amenity_name = clean_text(remapped.get("amenity_name"))
                
                if amenity_name:
                    amenity_id = make_uuid("amenidad", proj_id, amenity_name)
                    amenidades[amenity_id] = {
                        "amenidad_id": amenity_id,
                        "proyecto_id": proj_id,
                        "areas_comunes": amenity_name
                    }
                    
        return {
            "oferta_proyectos": list(proyectos.values()),
            "oferta_indicadores_censo": list(indicadores.values()),
            "oferta_tipologias": list(tipologias.values()),
            "oferta_condiciones_financieras": list(condiciones.values()),
            "oferta_amenidades": list(amenidades.values()),
        }
