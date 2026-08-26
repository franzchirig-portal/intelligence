-- ============================================================
-- 002_silver_tables.sql
-- SILVER LAYER: Datos limpios, tipados y normalizados
-- Consolidados de las 3 ciudades (SCZ, LPZ, CBB)
-- ============================================================

-- --------------------------------------------------------
-- Catálogos: ciudades y zonas
-- --------------------------------------------------------

CREATE TABLE IF NOT EXISTS silver_cities (
    id    SMALLINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    code  TEXT     UNIQUE NOT NULL,
    name  TEXT     NOT NULL
);

INSERT INTO silver_cities (code, name) VALUES
    ('SCZ', 'Santa Cruz de la Sierra'),
    ('LPZ', 'La Paz'),
    ('CBB', 'Cochabamba')
ON CONFLICT (code) DO NOTHING;

-- --------------------------------------------------------
-- Proyectos (tabla de dimensión principal)
-- --------------------------------------------------------

CREATE TABLE IF NOT EXISTS silver_projects (
    id                  SERIAL PRIMARY KEY,
    name                TEXT            NOT NULL,
    city_code           TEXT            NOT NULL REFERENCES silver_cities(code),
    zone_name           TEXT,
    sub_zone            TEXT,
    type                TEXT,           -- 'Departamentos', 'Casas', etc.
    quality             TEXT,           -- 'Standard', 'Premium', 'Luxe'
    latitude            DOUBLE PRECISION,
    longitude           DOUBLE PRECISION,
    google_maps_id      TEXT,
    floors              SMALLINT,
    total_units_design  INT,            -- Unidades totales del proyecto
    launch_date         DATE,
    delivery_date       DATE,
    developer           TEXT,
    constructor         TEXT,
    commercializer      TEXT,
    created_at          TIMESTAMPTZ     DEFAULT NOW(),
    updated_at          TIMESTAMPTZ     DEFAULT NOW(),
    UNIQUE(name, city_code)
);

-- Trigger para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_projects_updated_at ON silver_projects;
CREATE TRIGGER trg_projects_updated_at
    BEFORE UPDATE ON silver_projects
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- --------------------------------------------------------
-- Snapshots: estado del proyecto por fecha (Datos & Margenes)
-- --------------------------------------------------------

CREATE TABLE IF NOT EXISTS silver_project_snapshots (
    id                  SERIAL          PRIMARY KEY,
    -- Claves de relación (se usan los nombres como proxy hasta tener IDs)
    project_name        TEXT            NOT NULL,
    city_code           TEXT            NOT NULL REFERENCES silver_cities(code),
    snapshot_date       DATE            NOT NULL,
    -- Estado del proyecto
    stage               TEXT,           -- Preventa | Obra bruta | Obra fina | Terminada | Vendida
    total_units         INT,
    units_for_sale      INT,
    units_sold          INT,
    pct_for_sale        REAL,           -- 0.0 a 1.0
    pct_sold            REAL,           -- 0.0 a 1.0
    stock_sold_usd      DOUBLE PRECISION,
    stock_for_sale_usd  DOUBLE PRECISION,
    stock_total_usd     DOUBLE PRECISION,
    sales_velocity      REAL,           -- Unidades vendidas por mes
    months_stock        REAL,           -- Meses de stock disponible
    parking_price_usd   DOUBLE PRECISION,
    storage_price_usd   DOUBLE PRECISION,
    -- Financiamiento
    cash_payment        BOOLEAN,
    direct_credit       BOOLEAN,
    bank_credit         BOOLEAN,
    tether_usdt         BOOLEAN,
    installment_plan    TEXT,
    exchange_rate       REAL,
    initial_pct         TEXT,
    monthly_payment     DOUBLE PRECISION,
    finance_months      INT,
    increment_pct       TEXT,
    lien                TEXT,
    bank_name           TEXT,
    -- Metadata
    created_at          TIMESTAMPTZ     DEFAULT NOW(),
    UNIQUE(project_name, city_code, snapshot_date)
);

-- --------------------------------------------------------
-- Unidades individuales (Tipología & Precios)
-- --------------------------------------------------------

CREATE TABLE IF NOT EXISTS silver_units (
    id                    SERIAL          PRIMARY KEY,
    project_name          TEXT            NOT NULL,
    city_code             TEXT            NOT NULL REFERENCES silver_cities(code),
    snapshot_date         DATE            NOT NULL,
    bedrooms              SMALLINT,
    bathrooms             SMALLINT,
    area_m2               REAL,
    price_per_m2_usd      REAL,
    price_usd             DOUBLE PRECISION,
    status                TEXT,           -- Disponible | Reservado | VENDIDO
    typology              TEXT,           -- '2 Dormitorios', 'Monoambiente', etc.
    bathrooms_label       TEXT,
    exchange_rate         REAL,           -- T/C Oficial
    exchange_rate_parallel REAL,          -- T/C Paralelo
    price_per_m2_bob      REAL,
    price_usd_per_bob     REAL,
    quality               TEXT,
    created_at            TIMESTAMPTZ     DEFAULT NOW(),
    UNIQUE(project_name, city_code, snapshot_date, area_m2, price_usd)
);

-- --------------------------------------------------------
-- Amenidades (tab Amenidades)
-- --------------------------------------------------------

CREATE TABLE IF NOT EXISTS silver_amenities (
    id              SERIAL          PRIMARY KEY,
    project_name    TEXT            NOT NULL,
    city_code       TEXT            NOT NULL REFERENCES silver_cities(code),
    snapshot_date   DATE            NOT NULL,
    amenity_name    TEXT            NOT NULL,
    has_amenity     BOOLEAN         DEFAULT TRUE,
    created_at      TIMESTAMPTZ     DEFAULT NOW(),
    UNIQUE(project_name, city_code, snapshot_date, amenity_name)
);

-- --------------------------------------------------------
-- Índices para performance en queries analíticos
-- --------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_silver_projects_city      ON silver_projects(city_code);
CREATE INDEX IF NOT EXISTS idx_silver_projects_zone      ON silver_projects(zone_name);
CREATE INDEX IF NOT EXISTS idx_silver_projects_quality   ON silver_projects(quality);

CREATE INDEX IF NOT EXISTS idx_silver_snapshots_project  ON silver_project_snapshots(project_name, city_code);
CREATE INDEX IF NOT EXISTS idx_silver_snapshots_date     ON silver_project_snapshots(snapshot_date DESC);
CREATE INDEX IF NOT EXISTS idx_silver_snapshots_stage    ON silver_project_snapshots(stage);
CREATE INDEX IF NOT EXISTS idx_silver_snapshots_city     ON silver_project_snapshots(city_code);

CREATE INDEX IF NOT EXISTS idx_silver_units_project      ON silver_units(project_name, city_code);
CREATE INDEX IF NOT EXISTS idx_silver_units_date         ON silver_units(snapshot_date DESC);
CREATE INDEX IF NOT EXISTS idx_silver_units_status       ON silver_units(status);
CREATE INDEX IF NOT EXISTS idx_silver_units_bedrooms     ON silver_units(bedrooms);

CREATE INDEX IF NOT EXISTS idx_silver_amenities_project  ON silver_amenities(project_name, city_code);
