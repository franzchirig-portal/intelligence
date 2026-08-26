-- ============================================================
-- 001_bronze_tables.sql
-- BRONZE LAYER: Espejo raw de Google Sheets
-- Ejecutar primero. Nunca modificar datos ya insertados.
-- ============================================================

-- Habilitar extensión UUID
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- --------------------------------------------------------
-- Tablas Bronze: una por tab, consolidadas por ciudad
-- --------------------------------------------------------

CREATE TABLE IF NOT EXISTS bronze_datos_margenes (
    id            UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
    city_code     TEXT        NOT NULL CHECK (city_code IN ('SCZ', 'LPZ', 'CBB')),
    row_hash      TEXT        NOT NULL UNIQUE,   -- SHA256 del contenido completo
    raw_data      JSONB       NOT NULL,           -- Fila cruda del sheet sin modificar
    project_name  TEXT,                           -- Extraído para indexación rápida
    snapshot_date TEXT,                           -- Como texto, parseo en Silver
    ingested_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bronze_tipologia_precios (
    id            UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
    city_code     TEXT        NOT NULL CHECK (city_code IN ('SCZ', 'LPZ', 'CBB')),
    row_hash      TEXT        NOT NULL UNIQUE,
    raw_data      JSONB       NOT NULL,
    project_name  TEXT,
    snapshot_date TEXT,
    ingested_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bronze_amenidades (
    id            UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
    city_code     TEXT        NOT NULL CHECK (city_code IN ('SCZ', 'LPZ', 'CBB')),
    row_hash      TEXT        NOT NULL UNIQUE,
    raw_data      JSONB       NOT NULL,
    project_name  TEXT,
    snapshot_date TEXT,
    ingested_at   TIMESTAMPTZ DEFAULT NOW()
);

-- --------------------------------------------------------
-- Log de cada ejecución del pipeline
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS bronze_sync_log (
    id              SERIAL      PRIMARY KEY,
    sync_timestamp  TIMESTAMPTZ DEFAULT NOW(),
    source_tab      TEXT        NOT NULL,   -- 'datos_margenes' | 'tipologia_precios' | 'amenidades'
    city_code       TEXT        NOT NULL,   -- 'SCZ' | 'LPZ' | 'CBB'
    rows_fetched    INT         DEFAULT 0,
    rows_inserted   INT         DEFAULT 0,
    rows_skipped    INT         DEFAULT 0,  -- duplicados (sin cambios)
    duration_ms     INT,
    status          TEXT        DEFAULT 'success',  -- 'success' | 'error' | 'no_changes'
    error_message   TEXT
);

-- Índices para búsqueda eficiente
CREATE INDEX IF NOT EXISTS idx_bronze_dm_city     ON bronze_datos_margenes(city_code);
CREATE INDEX IF NOT EXISTS idx_bronze_dm_project  ON bronze_datos_margenes(project_name);
CREATE INDEX IF NOT EXISTS idx_bronze_dm_date     ON bronze_datos_margenes(snapshot_date);
CREATE INDEX IF NOT EXISTS idx_bronze_dm_raw      ON bronze_datos_margenes USING gin(raw_data);

CREATE INDEX IF NOT EXISTS idx_bronze_tp_city     ON bronze_tipologia_precios(city_code);
CREATE INDEX IF NOT EXISTS idx_bronze_tp_project  ON bronze_tipologia_precios(project_name);

CREATE INDEX IF NOT EXISTS idx_bronze_am_city     ON bronze_amenidades(city_code);
CREATE INDEX IF NOT EXISTS idx_bronze_am_project  ON bronze_amenidades(project_name);

CREATE INDEX IF NOT EXISTS idx_sync_log_tab       ON bronze_sync_log(source_tab, city_code);
CREATE INDEX IF NOT EXISTS idx_sync_log_ts        ON bronze_sync_log(sync_timestamp DESC);
