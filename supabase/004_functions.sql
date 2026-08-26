-- ============================================================
-- 004_functions.sql
-- Funciones PL/pgSQL: refresh del Gold layer y helpers
-- ============================================================

-- --------------------------------------------------------
-- Función principal: refrescar todas las Gold views
-- Llamada desde el pipeline via: supabase.rpc('refresh_gold_layer')
-- --------------------------------------------------------

CREATE OR REPLACE FUNCTION refresh_gold_layer()
RETURNS JSONB AS $$
DECLARE
    start_time TIMESTAMPTZ;
    result     JSONB;
BEGIN
    start_time := clock_timestamp();

    REFRESH MATERIALIZED VIEW CONCURRENTLY gold_project_features;
    REFRESH MATERIALIZED VIEW CONCURRENTLY gold_unit_features;
    REFRESH MATERIALIZED VIEW CONCURRENTLY gold_zone_features;

    result := jsonb_build_object(
        'status',       'success',
        'duration_ms',  EXTRACT(EPOCH FROM (clock_timestamp() - start_time)) * 1000,
        'refreshed_at', NOW()
    );

    RETURN result;
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
        'status', 'error',
        'message', SQLERRM
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- --------------------------------------------------------
-- Función: resumen del último sync
-- Útil para monitoreo y dashboards
-- --------------------------------------------------------

CREATE OR REPLACE FUNCTION get_last_sync_summary()
RETURNS TABLE (
    city_code    TEXT,
    source_tab   TEXT,
    last_sync    TIMESTAMPTZ,
    rows_fetched INT,
    rows_inserted INT,
    status       TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT DISTINCT ON (sl.city_code, sl.source_tab)
        sl.city_code,
        sl.source_tab,
        sl.sync_timestamp AS last_sync,
        sl.rows_fetched,
        sl.rows_inserted,
        sl.status
    FROM bronze_sync_log sl
    ORDER BY sl.city_code, sl.source_tab, sl.sync_timestamp DESC;
END;
$$ LANGUAGE plpgsql STABLE;

-- --------------------------------------------------------
-- Función: estadísticas del pipeline
-- --------------------------------------------------------

CREATE OR REPLACE FUNCTION get_pipeline_stats()
RETURNS JSONB AS $$
DECLARE
    result JSONB;
BEGIN
    SELECT jsonb_build_object(
        'bronze', jsonb_build_object(
            'datos_margenes',    (SELECT COUNT(*) FROM bronze_datos_margenes),
            'tipologia_precios', (SELECT COUNT(*) FROM bronze_tipologia_precios),
            'amenidades',        (SELECT COUNT(*) FROM bronze_amenidades)
        ),
        'silver', jsonb_build_object(
            'projects',   (SELECT COUNT(*) FROM silver_projects),
            'snapshots',  (SELECT COUNT(*) FROM silver_project_snapshots),
            'units',      (SELECT COUNT(*) FROM silver_units),
            'amenities',  (SELECT COUNT(*) FROM silver_amenities)
        ),
        'gold', jsonb_build_object(
            'project_features', (SELECT COUNT(*) FROM gold_project_features),
            'unit_features',    (SELECT COUNT(*) FROM gold_unit_features),
            'zone_features',    (SELECT COUNT(*) FROM gold_zone_features)
        ),
        'last_sync', (
            SELECT jsonb_agg(jsonb_build_object(
                'city', city_code, 'tab', source_tab,
                'at', last_sync, 'status', status
            ))
            FROM get_last_sync_summary()
        )
    ) INTO result;

    RETURN result;
END;
$$ LANGUAGE plpgsql STABLE;
