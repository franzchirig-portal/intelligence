# Intelligence Pipeline — README

## ¿Qué es esto?

Pipeline ETL automatizado que sincroniza datos del mercado inmobiliario boliviano
desde Google Sheets hacia Supabase, con arquitectura **Medallion** (Bronze → Silver → Gold).

Se ejecuta automáticamente cada 6 horas vía **GitHub Actions**.

---

## Stack

| Componente | Tecnología |
|-----------|-----------|
| Fuente de datos | Google Sheets API v4 |
| Autenticación | Service Account (Google Cloud) |
| Destino | Supabase (PostgreSQL) |
| Automatización | GitHub Actions |
| Lenguaje pipeline | Python 3.11 |
| Schema ML | Materialized Views |

---

## Ciudades y Tabs

Consolida **9 fuentes** (3 ciudades × 3 tabs):

- **SCZ** (Santa Cruz), **LPZ** (La Paz), **CBB** (Cochabamba)
- Tabs: `Datos & Margenes`, `Tipologia & Precios`, `Amenidades`

---

## Setup Rápido

Ver `.env.example` y la documentación completa en:
`.agents/skills/sheets_supabase_pipeline/SKILL.md`

---

## Ejecución

```bash
# Local
pip install -r requirements.txt
python -m pipeline.sync

# GitHub Actions
# Actions → "📊 Sync: Sheets → Supabase" → Run workflow
```

---

## Estructura

```
.
├── .github/workflows/sync-pipeline.yml   # GitHub Actions
├── pipeline/
│   ├── config.py          # Configuración de fuentes
│   ├── sheets_client.py   # Google Sheets API v4
│   ├── transform.py       # Limpieza y normalización
│   ├── supabase_client.py # Upsert a Supabase
│   ├── sync.py            # Orquestador
│   └── utils.py           # Parseo numérico boliviano
├── supabase/
│   ├── 001_bronze_tables.sql
│   ├── 002_silver_tables.sql
│   ├── 003_gold_views.sql
│   └── 004_functions.sql
└── .agents/skills/sheets_supabase_pipeline/SKILL.md
```
