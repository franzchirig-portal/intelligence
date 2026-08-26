---
name: sheets-supabase-pipeline
description: >
  Pipeline ETL automatizado que sincroniza datos del mercado inmobiliario
  boliviano desde Google Sheets (API v4) hacia Supabase, usando arquitectura
  Medallion (Bronze → Silver → Gold). Ejecutado automáticamente por GitHub Actions
  cada 6 horas. Soporta sync incremental (solo filas nuevas) y full (re-sync completo).
  Consolida 3 ciudades (SCZ, LPZ, CBB) × 3 tabs por ciudad = 9 fuentes.
tags:
  - etl
  - google-sheets
  - supabase
  - github-actions
  - medallion-architecture
  - real-estate
  - bolivia
---

# Skill: Google Sheets → Supabase Pipeline

Pipeline ETL automatizado para el proyecto **Intelligence** de datos del mercado
inmobiliario boliviano. Sincroniza Google Sheets hacia Supabase con arquitectura
Medallion (Bronze/Silver/Gold).

---

## Arquitectura General

```
Google Sheets API v4
    ↓  (Service Account auth)
GitHub Actions (cron cada 6h o dispatch manual)
    ↓
pipeline/sync.py  ← orquestador
    ├── sheets_client.py   ← fetch de datos
    ├── transform.py       ← limpieza y normalización
    └── supabase_client.py ← upsert idempotente
         ├── Bronze: raw JSON con row_hash
         ├── Silver: tablas normalizadas tipadas
         └── Gold: REFRESH MATERIALIZED VIEWS
```

---

## Fuentes de Datos

| Ciudad | Spreadsheet | Tab | Rows (aprox) |
|--------|------------|-----|-------------|
| SCZ | `1ayF4ZM3wzd8CM8TN0sZYZb6ypiYl0fX2cthx0q__DIM` | Datos & Margenes | ~240 |
| SCZ | mismo | Tipologia & Precios | ~5,500 |
| SCZ | mismo | Amenidades | ~200 |
| LPZ | `1MMONWgebCk39l7YMSzZG2q-JaNxWsDbDLoJVLItXhB0` | Datos & Margenes | ~240 |
| LPZ | mismo | Tipologia & Precios | ~25,000 |
| LPZ | mismo | Amenidades | ~4,200 |
| CBB | `1eUP3bMfy9NIGicsNlsKLc9UWo89Iw3qUl8cpUON-J3w` | Datos & Margenes | ~55 |
| CBB | mismo | Tipologia & Precios | ~5,500 |
| CBB | mismo | Amenidades | ~200 |

---

## Setup Inicial (una sola vez)

### 1. Google Cloud Service Account

```bash
# En Google Cloud Console:
# 1. Crear proyecto (o usar uno existente)
# 2. APIs & Services → Enable → "Google Sheets API"
# 3. Credentials → Create Service Account
#    - Nombre: intelligence-pipeline
#    - Rol: ninguno (no necesita roles GCP)
# 4. Descargar JSON key
# 5. Compartir cada spreadsheet con el email del SA:
#    intelligence-pipeline@TU-PROYECTO.iam.gserviceaccount.com
#    Permiso: Viewer (solo lectura)
```

### 2. GitHub Secrets

En tu repo → Settings → Secrets and variables → Actions:

| Secret | Cómo obtenerlo |
|--------|---------------|
| `GOOGLE_CREDENTIALS` | Contenido completo del JSON de la Service Account |
| `SUPABASE_URL` | Dashboard Supabase → Settings → API → Project URL |
| `SUPABASE_SERVICE_KEY` | Dashboard Supabase → Settings → API → service_role key |

### 3. Supabase Schema

Ejecutar en orden en el SQL Editor de Supabase:

```sql
-- Copiar y ejecutar cada archivo en orden:
-- supabase/001_bronze_tables.sql
-- supabase/002_silver_tables.sql
-- supabase/003_gold_views.sql
-- supabase/004_functions.sql
```

---

## Ejecución Manual Local

```bash
# Setup
pip install -r requirements.txt
cp .env.example .env
# Editar .env con tus credenciales

# Sync completo de todo
python -m pipeline.sync --mode full

# Solo una ciudad
python -m pipeline.sync --city SCZ

# Solo un tab de LPZ
python -m pipeline.sync --city LPZ --tab tipologia_precios

# Sync incremental (default)
python -m pipeline.sync
```

---

## Ejecución en GitHub Actions

El workflow se ejecuta automáticamente cada 6h. Para ejecutar manualmente:

```
GitHub → Actions → "📊 Sync: Sheets → Supabase" → Run workflow
```

Parámetros disponibles:
- **city**: ALL | SCZ | LPZ | CBB
- **tab**: ALL | datos_margenes | tipologia_precios | amenidades
- **mode**: incremental | full

---

## Detección de Cambios (Idempotencia)

Cada fila se hashea con SHA256:
```python
hash = SHA256(city + tab + sorted(row_content))
```

Si el hash ya existe en Bronze → `IGNORE` (no duplica).
Si el hash es nuevo → INSERT en Bronze → transform → upsert Silver → refresh Gold.

Esto significa que puedes ejecutar el pipeline N veces sin duplicar datos.

---

## Agregar Nueva Ciudad o Tab

1. En `pipeline/config.py`, agregar la entrada en `SHEETS_CONFIG`
2. Si es un tab nuevo, agregar el mapeo de columnas
3. Si es un tab con estructura distinta, agregar función en `transform.py`
4. Actualizar `BRONZE_TABLES` si el tab va a una tabla nueva

---

## Formato Boliviano de Números

Los sheets usan formato boliviano (punto=miles, coma=decimal):
- `"1.234.567,89"` → `1234567.89`
- `"78,05%"` → `0.7805`
- `"15/07/2023"` → `date(2023, 7, 15)`
- `"-17.377, -66.166"` → `lat=-17.377, lng=-66.166`

Todas las conversiones están en `pipeline/utils.py`.

---

## Tablas Supabase

### Bronze (raw)
- `bronze_datos_margenes` — JSONB crudo + hash
- `bronze_tipologia_precios` — JSONB crudo + hash
- `bronze_amenidades` — JSONB crudo + hash
- `bronze_sync_log` — log de cada ejecución

### Silver (normalizado)
- `silver_cities` — catálogo de ciudades
- `silver_projects` — proyectos (dimensión)
- `silver_project_snapshots` — estado por fecha (hechos)
- `silver_units` — unidades individuales
- `silver_amenities` — amenidades por proyecto/fecha

### Gold (ML-ready)
- `gold_project_features` — feature matrix proyecto × snapshot
- `gold_unit_features` — feature matrix por unidad individual
- `gold_zone_features` — agregados por zona × snapshot

---

## Monitoreo

```sql
-- Ver estado del último sync
SELECT * FROM get_last_sync_summary();

-- Ver estadísticas completas del pipeline
SELECT get_pipeline_stats();

-- Ver logs recientes
SELECT * FROM bronze_sync_log ORDER BY sync_timestamp DESC LIMIT 20;
```
