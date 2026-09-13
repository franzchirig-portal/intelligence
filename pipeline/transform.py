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
from .utils import parse_number, parse_percentage, parse_date, parse_coordinates, clean_text, hash_row
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
                if k.strip().lower() == sheet_col.strip().lower():
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
        avg_tipologias = {}
        
        from collections import defaultdict
        tipologia_hash_counts = defaultdict(int)
        # Acumular datos crudos por (ind_id, avg_tipologia) para luego promediar.
        # Se mantienen dos conjuntos de listas:
        #   _disp: solo unidades NO vendidas (disponibles, por vender, etc.)
        #   _all:  todas las unidades (fallback cuando todas están vendidas)
        _avg_raw: dict = defaultdict(lambda: {
            "und_totales": 0,
            "und_vendidas": 0,
            "und_por_vender": 0,
            # Listas para unidades disponibles (no vendidas)
            "construccion_m2_disp": [],
            "sus_m2_disp": [],
            "precio_disp": [],
            "bs_m2_disp": [],
            "usd_m2_disp": [],
            "tc_oficial_disp": [],
            # Listas para TODAS las unidades (fallback si 100% vendido)
            "construccion_m2_all": [],
            "sus_m2_all": [],
            "precio_all": [],
            "bs_m2_all": [],
            "usd_m2_all": [],
            "tc_oficial_all": [],
        })
        
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
                    
                    # zona_aux: siempre viene de "Zona:" del sheet (para las 3 ciudades)
                    zona_aux_val = clean_text(remapped.get("zone"))
                    
                    # ZONAS y SUBZONAS: dependen de la ciudad
                    if city_code == "SCZ":
                        # SCZ usa columnas "zona2" y "subzona2"
                        zonas_val = clean_text(remapped.get("zone2"))
                        subzonas_val = clean_text(remapped.get("sub_zone2"))
                    else:
                        # LPZ y CBB usan "Zona:" y "Sub-zona:"
                        zonas_val = clean_text(remapped.get("zone"))
                        subzonas_val = clean_text(remapped.get("sub_zone"))
                            
                    raw_uv = row.get("uv") if row.get("uv") is not None else row.get("UV")
                    uv_val = clean_text(remapped.get("uv")) or clean_text(raw_uv)
                    proyectos[proj_id] = {
                        "proyecto_id": proj_id,
                        "proyecto": proj,
                        "ZONAS": zonas_val,
                        "SUBZONAS": subzonas_val,
                        "ciudad": city_code,
                        "zona_aux": zona_aux_val,
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
                        "uv": uv_val,
                    }
                else:
                    # Si el proyecto ya fue registrado pero no tenía UV y esta fila sí tiene, actualizarlo
                    if not proyectos[proj_id].get("uv"):
                        raw_uv = row.get("uv") if row.get("uv") is not None else row.get("UV")
                        curr_uv = clean_text(remapped.get("uv")) or clean_text(raw_uv)
                        if curr_uv:
                            proyectos[proj_id]["uv"] = curr_uv
                
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
                    
                    cond_id = make_uuid("condicion", ind_id)
                    
                    # Detectar modalidades basado en las columnas booleanas/texto
                    modalidades = []
                    if clean_text(remapped.get("cash_payment")) not in ("", "Falso", "FALSE", "0", "No"): modalidades.append("Al Contado")
                    if clean_text(remapped.get("direct_credit")) not in ("", "Falso", "FALSE", "0", "No"): modalidades.append("Crédito Directo")
                    if clean_text(remapped.get("bank_credit")) not in ("", "Falso", "FALSE", "0", "No"): modalidades.append("Crédito Bancario")
                    if clean_text(remapped.get("installment_plan")) not in ("", "Falso", "FALSE", "0", "No"): modalidades.append("Pago a Plazos")
                    
                    mod_pago = ", ".join(modalidades) if modalidades else None
                    
                    condiciones[cond_id] = {
                        "condicion_financiera_id": cond_id,
                        "indicador_censo_id": ind_id,
                        "modalidad_pago": mod_pago,
                        "forma_de_pago": clean_text(remapped.get("bank_name", "")), # A veces se anota el banco como forma
                        "aporte_inicial": parse_percentage(remapped.get("initial_pct")),
                        "cuota_mensual": parse_number(remapped.get("monthly_payment")),
                        "meses": int(m) if (m := parse_number(remapped.get("finance_months"))) else None,
                        "incremento": parse_percentage(remapped.get("increment_pct")),
                        "gravamen": parse_percentage(remapped.get("lien")),
                        "banco": clean_text(remapped.get("bank_name", ""))
                    }

        for c_code in ("SCZ", "LPZ", "CBB"):
            c_projs = [p for p in proyectos.values() if p["ciudad"] == c_code]
            c_with_uv = [p for p in c_projs if p.get("uv")]
            logger.info(f"[{c_code}] Proyectos únicos: {len(c_projs)} | Con UV: {len(c_with_uv)}")

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
                dormitorios = int(d) if (d := parse_number(remapped.get("bedrooms"))) is not None else None
                
                # Determinar el label del modelo (avg_tipologia)
                if tipologia_nombre:
                    avg_label = tipologia_nombre
                elif dormitorios == 0:
                    avg_label = "Monoambiente"
                elif dormitorios is not None:
                    avg_label = f"{dormitorios} Dormitorio{'s' if dormitorios != 1 else ''}"
                else:
                    avg_label = "Sin Tipología"
                
                base_hash = hash_row(city_code, "tipologia", row)
                tipologia_hash_counts[base_hash] += 1
                unique_hash = f"{base_hash}_{tipologia_hash_counts[base_hash]}"
                
                tipologia_id = make_uuid("tipologia", ind_id, unique_hash)
                
                construccion_m2 = parse_number(remapped.get("area_m2"))
                sus_m2        = parse_number(remapped.get("price_per_m2_usd"))
                precio        = parse_number(remapped.get("price_usd"))
                bs_m2         = parse_number(remapped.get("price_per_m2_bob"))
                usd_m2        = parse_number(remapped.get("price_usd_per_bob"))
                tc_oficial    = parse_number(remapped.get("exchange_rate"))
                estado        = clean_text(remapped.get("status")) or ""
                
                tipologias[tipologia_id] = {
                    "tipologia_id": tipologia_id,
                    "indicador_censo_id": ind_id,
                    "tipologia": tipologia_nombre,
                    "dormitorios": dormitorios,
                    "banos": int(x) if (x := parse_number(remapped.get("bathrooms"))) else None,
                    "construccion_m2": construccion_m2,
                    "sus_m2": sus_m2,
                    "precio": precio,
                    "bs_m2": bs_m2,
                    "usd_m2": usd_m2,
                    "estado": estado,
                    "tc_oficial": tc_oficial,
                    "tc": parse_number(remapped.get("exchange_rate_parallel"))
                }
                
                # Acumular para avg_tipologias
                avg_key = (ind_id, avg_label)
                bucket = _avg_raw[avg_key]
                bucket["und_totales"] += 1
                estado_lower = estado.lower()
                is_vendida = "vendid" in estado_lower
                
                if is_vendida:
                    bucket["und_vendidas"] += 1
                else:
                    # Es disponible (por vender, disponible, libre, reservado, etc.)
                    bucket["und_por_vender"] += 1
                
                # Siempre acumular en la lista _all (fallback)
                if construccion_m2: bucket["construccion_m2_all"].append(construccion_m2)
                if sus_m2:          bucket["sus_m2_all"].append(sus_m2)
                if precio:          bucket["precio_all"].append(precio)
                if bs_m2:           bucket["bs_m2_all"].append(bs_m2)
                if usd_m2:          bucket["usd_m2_all"].append(usd_m2)
                if tc_oficial:      bucket["tc_oficial_all"].append(tc_oficial)
                
                # Solo acumular en _disp si la unidad NO está vendida
                if not is_vendida:
                    if construccion_m2: bucket["construccion_m2_disp"].append(construccion_m2)
                    if sus_m2:          bucket["sus_m2_disp"].append(sus_m2)
                    if precio:          bucket["precio_disp"].append(precio)
                    if bs_m2:           bucket["bs_m2_disp"].append(bs_m2)
                    if usd_m2:          bucket["usd_m2_disp"].append(usd_m2)
                    if tc_oficial:      bucket["tc_oficial_disp"].append(tc_oficial)
                
        # Generar avg_tipologias a partir de los datos acumulados.
        # Regla de promedios:
        #   - Si hay unidades disponibles → promediar SOLO con las disponibles.
        #   - Si todas están vendidas (sin disponibles) → promediar con la totalidad.
        def _avg(lst):
            return round(sum(lst) / len(lst), 2) if lst else None
        
        def _pick(bucket, field):
            """Devuelve la lista _disp si tiene datos, sino la lista _all (fallback)."""
            disp = bucket[f"{field}_disp"]
            return disp if disp else bucket[f"{field}_all"]
        
        for (ind_id, avg_label), bucket in _avg_raw.items():
            und_totales    = bucket["und_totales"]
            und_vendidas   = bucket["und_vendidas"]
            und_por_vender = bucket["und_por_vender"]
            
            avg_id = make_uuid("avg_tipologia", ind_id, avg_label)
            avg_tipologias[avg_id] = {
                "indicador_censo_id": ind_id,
                "avg_tipologia":      avg_label,
                "und_totales":        und_totales,
                "und_vendidas":       und_vendidas,
                "und_por_vender":     und_por_vender,
                "ritmo_venta":        None,
                "meses_stock":        None,
                "avg_construccion_m2": _avg(_pick(bucket, "construccion_m2")),
                "avg_sus_m2":          _avg(_pick(bucket, "sus_m2")),
                "avg_precio":          _avg(_pick(bucket, "precio")),
                "avg_bs_m2":           _avg(_pick(bucket, "bs_m2")),
                "avg_usd_m2":          _avg(_pick(bucket, "usd_m2")),
                "avg_tc_oficial":      _avg(_pick(bucket, "tc_oficial")),
            }
        
        logger.info(f"avg_tipologias calculadas: {len(avg_tipologias)} grupos (proyecto × snapshot × modelo)")
        
        # 3. "Amenidades"
        for city_code, city_tabs in all_data.items():
            if "amenidades" not in city_tabs:
                continue
                
            city_amenities_count = 0
            for row in city_tabs["amenidades"]:
                if row == city_tabs["amenidades"][0]:
                    logger.info(f"[{city_code}] Columnas en 'Amenidades': {list(row.keys())}")
                    
                remapped = self._remap(row, AMENIDADES_COLUMNS)
                proj = clean_text(remapped.get("project_name"))
                if not proj or proj in INVALID_PROJECT_VALUES:
                    continue
                    
                proj_id = make_uuid("proyecto", proj, city_code)
                if proj_id not in proyectos:
                    continue
                    
                # El nombre de la amenidad viene del valor de la celda
                amenity_val = clean_text(remapped.get("amenity_name"))
                
                # Fallback: buscar en cualquier columna que contenga "comun" o "amenid"
                if not amenity_val:
                    for k, v in row.items():
                        k_clean = k.strip().lower()
                        if "comun" in k_clean or "amenid" in k_clean:
                            amenity_val = clean_text(v)
                            if amenity_val:
                                break
                                
                if not amenity_val:
                    continue
                    
                val_lower = amenity_val.lower()
                # Filtrar valores que no son amenidades
                if val_lower in ("falso", "false", "no", "0", "ninguno", "n/a", "none", "zona", "tipo", "etapa", "proyecto"):
                    continue
                    
                # UUID determinista por proyecto y amenidad (asegura unicidad por proyecto)
                amenity_id = make_uuid("amenidad", proj_id, amenity_val)
                amenidades[amenity_id] = {
                    "amenidad_id": amenity_id,
                    "proyecto_id": proj_id,
                    "areas_comunes": amenity_val
                }
                city_amenities_count += 1
                
            logger.info(f"[{city_code}] Amenidades registradas: {city_amenities_count}")

        logger.info(f"Total amenidades únicas para Supabase: {len(amenidades)}")
                    
        # ANÁLISIS DE PROYECTOS DUPLICADOS/SIMILARES (BASADO EN COORDENADAS)
        try:
            from collections import defaultdict
            # Agrupar por (ciudad, latitud, longitud)
            coord_groups = defaultdict(list)
            for p in proyectos.values():
                if p["latitud"] and p["longitud"]:
                    coord_key = (p["ciudad"], p["latitud"], p["longitud"])
                    coord_groups[coord_key].append(p["proyecto"])
                
            logger.info("=" * 60)
            logger.info("📍 ANÁLISIS DE PROYECTOS DUPLICADOS (MISMA UBICACIÓN, DIFERENTE NOMBRE)")
            logger.info("=" * 60)
            found_any = False
            for (city, lat, lng), projs in coord_groups.items():
                unique_projs = sorted(list(set(projs)))
                if len(unique_projs) > 1:
                    logger.warning(f"[{city}] Diferentes nombres comparten la misma coordenada (Google Maps ID):")
                    logger.warning(f"      -> {', '.join(unique_projs)}")
                    found_any = True
            
            if not found_any:
                logger.info("No se detectaron proyectos con nombres distintos en la misma coordenada exacta.")
            logger.info("=" * 60)
        except Exception as e:
            logger.error(f"Error en análisis de duplicados por coordenadas: {e}")

        return {
            "oferta_proyectos": list(proyectos.values()),
            "oferta_indicadores_censo": list(indicadores.values()),
            "oferta_tipologias": list(tipologias.values()),
            "oferta_avg_tipologias": list(avg_tipologias.values()),
            "oferta_condiciones_financieras": list(condiciones.values()),
            "oferta_amenidades": list(amenidades.values()),
        }
