-- ============================================================
-- 003_gold_views.sql
-- GOLD LAYER: Materialized Views ML-ready
-- Refrescar con: SELECT refresh_gold_layer();
-- ============================================================

-- --------------------------------------------------------
-- Feature matrix principal: proyecto × snapshot
-- Una fila = estado de un proyecto en una fecha
-- Incluye features temporales, deltas y contexto de zona
-- --------------------------------------------------------

CREATE MATERIALIZED VIEW IF NOT EXISTS gold_project_features AS
SELECT
    -- Identificadores
    ps.project_name,
    ps.city_code                                AS city,
    sp.zone_name                                AS zone,
    ps.snapshot_date,

    -- Atributos estáticos del proyecto
    sp.type                                     AS project_type,
    sp.quality,
    sp.floors,
    sp.total_units_design,
    sp.latitude,
    sp.longitude,

    -- Encoding ordinal de calidad
    CASE sp.quality
        WHEN 'Económico'  THEN 1
        WHEN 'Standard'   THEN 2
        WHEN 'Premium'    THEN 3
        WHEN 'Luxe'       THEN 4
        ELSE 0
    END                                         AS quality_ordinal,

    -- Estado en el snapshot
    ps.stage,
    CASE ps.stage
        WHEN 'Preventa'              THEN 1
        WHEN 'Obra bruta'            THEN 2
        WHEN 'Obra fina'             THEN 3
        WHEN 'Terminada'             THEN 4
        WHEN 'Terminado'             THEN 4
        WHEN 'Vendida'               THEN 5
        ELSE 0
    END                                         AS stage_ordinal,

    -- Métricas de inventario y ventas
    ps.total_units,
    ps.units_for_sale,
    ps.units_sold,
    ROUND(ps.pct_sold::NUMERIC, 4)              AS pct_sold,
    ROUND(ps.pct_for_sale::NUMERIC, 4)          AS pct_for_sale,
    ps.stock_total_usd,
    ps.stock_sold_usd,
    ps.stock_for_sale_usd,
    ROUND(ps.sales_velocity::NUMERIC, 2)        AS sales_velocity,
    ROUND(ps.months_stock::NUMERIC, 1)          AS months_stock,

    -- Precio promedio por unidad (derivado)
    CASE WHEN ps.total_units > 0
        THEN ROUND((ps.stock_total_usd / ps.total_units)::NUMERIC, 2)
        ELSE NULL
    END                                         AS avg_price_per_unit_usd,

    -- Precios adicionales
    ps.parking_price_usd,
    ps.storage_price_usd,

    -- Features temporales
    EXTRACT(YEAR  FROM ps.snapshot_date)::INT   AS year,
    EXTRACT(QUARTER FROM ps.snapshot_date)::INT AS quarter,
    EXTRACT(MONTH FROM ps.snapshot_date)::INT   AS month,

    -- Meses desde lanzamiento (proxy de madurez del proyecto)
    CASE WHEN sp.launch_date IS NOT NULL
        THEN ROUND(((ps.snapshot_date - sp.launch_date) / 30.0)::NUMERIC, 1)
        ELSE NULL
    END                                         AS months_since_launch,

    -- Meses hasta entrega (urgencia de compra, clave para precio)
    CASE WHEN sp.delivery_date IS NOT NULL
        THEN ROUND(((sp.delivery_date - ps.snapshot_date) / 30.0)::NUMERIC, 1)
        ELSE NULL
    END                                         AS months_to_delivery,

    -- Deltas: variación vs snapshot anterior del mismo proyecto
    LAG(ps.pct_sold) OVER w                     AS prev_pct_sold,
    LAG(ps.sales_velocity) OVER w               AS prev_velocity,
    LAG(ps.stock_total_usd) OVER w              AS prev_stock_usd,
    LAG(ps.months_stock) OVER w                 AS prev_months_stock,

    -- Variación absoluta de % vendido entre snapshots
    ROUND(
        (ps.pct_sold - LAG(ps.pct_sold) OVER w)::NUMERIC, 4
    )                                           AS delta_pct_sold,

    -- Financiamiento (boolean encoding directo para ML)
    ps.cash_payment,
    ps.direct_credit,
    ps.bank_credit,
    ps.tether_usdt,
    ps.exchange_rate,

    -- Conteo de amenidades disponibles en ese snapshot
    (
        SELECT COUNT(*)
        FROM silver_amenities sa
        WHERE sa.project_name  = ps.project_name
          AND sa.city_code     = ps.city_code
          AND sa.has_amenity   = TRUE
          AND sa.snapshot_date = ps.snapshot_date
    )                                           AS amenity_count

FROM silver_project_snapshots ps
LEFT JOIN silver_projects sp
    ON sp.name = ps.project_name AND sp.city_code = ps.city_code
WHERE ps.stage NOT IN ('Paralizada/Clandestina', 'Clandestina')
WINDOW w AS (PARTITION BY ps.project_name, ps.city_code ORDER BY ps.snapshot_date);


-- --------------------------------------------------------
-- Feature matrix de unidades individuales
-- Una fila = unidad (depto/casa) en un snapshot
-- Granularidad más fina: útil para modelos de pricing
-- --------------------------------------------------------

CREATE MATERIALIZED VIEW IF NOT EXISTS gold_unit_features AS
SELECT
    -- Identificadores
    su.id                                       AS unit_id,
    su.project_name,
    su.city_code                                AS city,
    sp.zone_name                                AS zone,
    su.snapshot_date,

    -- Características de la unidad
    su.bedrooms,
    su.bathrooms,
    ROUND(su.area_m2::NUMERIC, 2)               AS area_m2,
    ROUND(su.price_per_m2_usd::NUMERIC, 2)      AS price_per_m2_usd,
    ROUND(su.price_usd::NUMERIC, 2)             AS price_usd,
    su.status,
    su.typology,
    su.quality,

    -- Status encoding
    CASE su.status
        WHEN 'Disponible' THEN 0
        WHEN 'Reservado'  THEN 1
        WHEN 'VENDIDO'    THEN 2
        ELSE -1
    END                                         AS status_ordinal,

    -- Tipo de cambio (contexto económico)
    su.exchange_rate,
    su.exchange_rate_parallel,
    ROUND(su.price_per_m2_bob::NUMERIC, 2)      AS price_per_m2_bob,

    -- Atributos del proyecto padre
    sp.type                                     AS project_type,
    sp.floors,
    CASE sp.quality
        WHEN 'Económico'  THEN 1
        WHEN 'Standard'   THEN 2
        WHEN 'Premium'    THEN 3
        WHEN 'Luxe'       THEN 4
        ELSE 0
    END                                         AS project_quality_ordinal,

    -- Features temporales
    EXTRACT(YEAR  FROM su.snapshot_date)::INT   AS year,
    EXTRACT(MONTH FROM su.snapshot_date)::INT   AS month,

    -- Precio relativo al promedio del proyecto en ese snapshot
    ROUND(
        (su.price_per_m2_usd /
         NULLIF(AVG(su.price_per_m2_usd) OVER (
             PARTITION BY su.project_name, su.city_code, su.snapshot_date
         ), 0))::NUMERIC, 4
    )                                           AS price_relative_to_project_avg

FROM silver_units su
LEFT JOIN silver_projects sp
    ON sp.name = su.project_name AND sp.city_code = su.city_code;


-- --------------------------------------------------------
-- Agregados por zona × snapshot
-- Features de contexto de mercado para enriquecer modelos
-- --------------------------------------------------------

CREATE MATERIALIZED VIEW IF NOT EXISTS gold_zone_features AS
SELECT
    sp.zone_name                                AS zone,
    ps.city_code                                AS city,
    ps.snapshot_date,

    -- Inventario de la zona
    COUNT(DISTINCT ps.project_name)             AS active_projects,
    SUM(ps.total_units)                         AS total_inventory_units,
    ROUND(SUM(ps.stock_total_usd)::NUMERIC, 0)  AS total_inventory_usd,

    -- Precios promedio de la zona
    ROUND(
        AVG(
            CASE WHEN ps.total_units > 0
                THEN ps.stock_total_usd / ps.total_units
                ELSE NULL
            END
        )::NUMERIC, 2
    )                                           AS avg_price_per_unit_usd,

    -- Velocidad de ventas de la zona
    ROUND(
        AVG(ps.sales_velocity) FILTER (WHERE ps.sales_velocity > 0)::NUMERIC, 2
    )                                           AS avg_velocity,
    ROUND(
        AVG(ps.months_stock) FILTER (WHERE ps.months_stock > 0)::NUMERIC, 1
    )                                           AS avg_months_stock,

    -- Distribución por etapa
    COUNT(*) FILTER (WHERE ps.stage = 'Preventa')               AS projects_presale,
    COUNT(*) FILTER (WHERE ps.stage IN ('Obra bruta','Obra fina')) AS projects_construction,
    COUNT(*) FILTER (WHERE ps.stage IN ('Terminada','Terminado')) AS projects_finished,
    COUNT(*) FILTER (WHERE ps.stage = 'Vendida')                AS projects_sold_out,

    -- Mix de calidad
    COUNT(*) FILTER (WHERE sp.quality = 'Standard')             AS projects_standard,
    COUNT(*) FILTER (WHERE sp.quality = 'Premium')              AS projects_premium,
    COUNT(*) FILTER (WHERE sp.quality = 'Luxe')                 AS projects_luxe

FROM silver_project_snapshots ps
LEFT JOIN silver_projects sp
    ON sp.name = ps.project_name AND sp.city_code = ps.city_code
WHERE ps.stage NOT IN ('Paralizada/Clandestina', 'Clandestina')
GROUP BY sp.zone_name, ps.city_code, ps.snapshot_date;


-- --------------------------------------------------------
-- Índices en las Materialized Views (performance)
-- --------------------------------------------------------

CREATE UNIQUE INDEX IF NOT EXISTS idx_gold_pf_key
    ON gold_project_features(project_name, city, snapshot_date);

CREATE INDEX IF NOT EXISTS idx_gold_pf_city
    ON gold_project_features(city, snapshot_date DESC);

CREATE INDEX IF NOT EXISTS idx_gold_uf_project
    ON gold_unit_features(project_name, city, snapshot_date);

CREATE INDEX IF NOT EXISTS idx_gold_zf_zone
    ON gold_zone_features(zone, city, snapshot_date DESC);
