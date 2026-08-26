"""
pipeline/config.py
==================
Configuración central del pipeline ETL.
Define las fuentes de datos (Google Sheets) y sus mappings.

Skill: sheets_supabase_pipeline
"""

# ============================================================
# FUENTES DE DATOS: Google Sheets por ciudad y tab
# Usar nombre exacto del tab (case-sensitive)
# ============================================================
SHEETS_CONFIG = {
    "SCZ": {
        "spreadsheet_id": "1ayF4ZM3wzd8CM8TN0sZYZb6ypiYl0fX2cthx0q__DIM",
        "city_name": "Santa Cruz de la Sierra",
        "tabs": {
            "datos_margenes":    "Datos & Margenes",
            "tipologia_precios": "Tipología & Precios",
            "amenidades":        "Amenidades",
        },
    },
    "LPZ": {
        "spreadsheet_id": "1MMONWgebCk39l7YMSzZG2q-JaNxWsDbDLoJVLItXhB0",
        "city_name": "La Paz",
        "tabs": {
            "datos_margenes":    "Datos & Margenes",
            "tipologia_precios": "Tipología & Precios",
            "amenidades":        "Amenidades",
        },
    },
    "CBB": {
        "spreadsheet_id": "1eUP3bMfy9NIGicsNlsKLc9UWo89Iw3qUl8cpUON-J3w",
        "city_name": "Cochabamba",
        "tabs": {
            "datos_margenes":    "Datos & Margenes",
            "tipologia_precios": "Tipología & Precios",
            "amenidades":        "Amenidades",
        },
    },
}

# ============================================================
# COLUMNAS ESPERADAS POR TAB
# Usadas para validación y mapeo al schema Silver
# ============================================================

# Columnas del tab "Datos & Margenes" (fuente principal de snapshots)
DATOS_MARGENES_COLUMNS = {
    "Proyecto:":         "project_name",
    "Calidad:":          "quality",
    "Zona:":             "zone",
    "Sub-zona:":         "sub_zone",
    "ID google maps:":   "google_maps_id",
    "Tipo:":             "type",
    "Lanzamiento:":      "launch_date",
    "Entrega:":          "delivery_date",
    "Pisos:":            "floors",
    "UND totales:":      "total_units",
    "Desarrollador:":    "developer",
    "Constructor:":      "constructor",
    "Comercializador:":  "commercializer",
    "Fecha":             "snapshot_date",
    "Etapa":             "stage",
    "UND por vender":    "units_for_sale",
    "UND vendidas":      "units_sold",
    "% Por vender":      "pct_for_sale",
    "%Vendido":          "pct_sold",
    "Stock Vendido $":   "stock_sold_usd",
    "Stock x Vender $":  "stock_for_sale_usd",
    "Stock Total $":     "stock_total_usd",
    "Ritmo de venta":    "sales_velocity",
    "Meses Stock":       "months_stock",
    "Parqueo $us:":      "parking_price_usd",
    "Baulera $us:":      "storage_price_usd",
    "Al Contado":        "cash_payment",
    "Credito Directo":   "direct_credit",
    "Credito Bancario":  "bank_credit",
    "Tether Usdt":       "tether_usdt",
    "Pago a Plazos":     "installment_plan",
    "Tipo de Cambio":    "exchange_rate",
    "Aporte inicial:":   "initial_pct",
    "Cuota Mensual:":    "monthly_payment",
    "Meses:":            "finance_months",
    "Incremento:":       "increment_pct",
    "Gravamen:":         "lien",
    "Banco:":            "bank_name",
}

# Columnas del tab "Tipología & Precios" (unidades individuales)
TIPOLOGIA_PRECIOS_COLUMNS = {
    "Proyecto:":         "project_name",
    "Fecha":             "snapshot_date",
    "Dormitorio":        "bedrooms",
    "Baño":              "bathrooms",
    "m2":                "area_m2",
    "($US./m2)":         "price_per_m2_usd",
    "Precio $us":        "price_usd",
    "Estado":            "status",
    "Zona":              "zone",
    "Subzona":           "sub_zone",
    "Etapa":             "stage",
    "Tipo":              "type",
    "Tipología":         "typology",
    "Cantidad de baños": "bathrooms_label",
    "T/C Oficial":       "exchange_rate",
    "T/C Paralelo $":    "exchange_rate_parallel",
    "(Bs./m2)":          "price_per_m2_bob",
    "($us/Bs)":          "price_usd_per_bob",
    "Calidad:":          "quality",
}

# Columnas del tab "Amenidades"
AMENIDADES_COLUMNS = {
    "Proyecto":                       "project_name",
    "Áreas comunes en los proyectos": "amenity_name",
    "Proyecto:":                      "project_name",
    "Àreas comunes en los proyectos": "amenity_name",  # typo en LPZ
    "Tipo":                           "type",
    "Zona:":                          "zone",
    "Sub-zona:":                      "sub_zone",
    "Fecha":                          "snapshot_date",
    "Etapa":                          "stage",
}

# ============================================================
# VALORES A IGNORAR / FILTRAR
# ============================================================

# Filas donde el proyecto es vacío o no es un proyecto real
INVALID_PROJECT_VALUES = {"", "Falso", "FALSE", "#N/A", None}

# Etapas a excluir del Silver layer (van a Bronze pero no a Silver)
EXCLUDED_STAGES = {"Paralizada/Clandestina", "Clandestina"}

# ============================================================
# TABLAS DESTINO EN SUPABASE
# ============================================================
BRONZE_TABLES = {
    "datos_margenes":    "bronze_datos_margenes",
    "tipologia_precios": "bronze_tipologia_precios",
    "amenidades":        "bronze_amenidades",
}

SILVER_TABLES = {
    "snapshots":  "silver_project_snapshots",
    "units":      "silver_units",
    "amenities":  "silver_amenities",
    "projects":   "silver_projects",
    "zones":      "silver_zones",
}

GOLD_VIEWS = [
    "gold_project_features",
    "gold_unit_features",
    "gold_zone_features",
]
