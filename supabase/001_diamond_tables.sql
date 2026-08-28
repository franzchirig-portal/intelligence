-- ==============================================================================================
-- 001_diamond_tables.sql
-- Modelo Diamante - Tablas directas para el pipeline de Inteligencia Inmobiliaria
-- ==============================================================================================

-- 1. oferta_proyectos
CREATE TABLE IF NOT EXISTS public.oferta_proyectos (
    proyecto_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    proyecto VARCHAR NOT NULL,
    "ZONAS" VARCHAR,
    "SUBZONAS" VARCHAR,
    ciudad VARCHAR,
    zona_aux VARCHAR,
    tipo_inmueble VARCHAR,
    calidad VARCHAR,
    desarrollador VARCHAR,
    constructor VARCHAR,
    comercializador VARCHAR,
    id_google_maps VARCHAR,
    latitud NUMERIC,
    longitud NUMERIC,
    lanzamiento DATE,
    entrega DATE,
    pisos INT2,
    uv VARCHAR,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(proyecto, ciudad)
);

-- 2. oferta_indicadores_censo
CREATE TABLE IF NOT EXISTS public.oferta_indicadores_censo (
    indicador_censo_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    proyecto_id UUID REFERENCES public.oferta_proyectos(proyecto_id) ON DELETE CASCADE,
    fecha_snapshot DATE NOT NULL,
    etapa VARCHAR,
    und_totales INT4,
    und_vendidas INT4,
    und_por_vender INT4,
    pct_por_vender NUMERIC,
    pct_vendido NUMERIC,
    stock_vendido NUMERIC,
    stock_x_vender NUMERIC,
    stock_total NUMERIC,
    ritmo_venta NUMERIC,
    ritmo_venta_por_subzona NUMERIC,
    meses_stock NUMERIC,
    parqueo_sus NUMERIC,
    baulera_sus NUMERIC,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(proyecto_id, fecha_snapshot)
);

-- 3. oferta_tipologias
CREATE TABLE IF NOT EXISTS public.oferta_tipologias (
    tipologia_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    indicador_censo_id UUID REFERENCES public.oferta_indicadores_censo(indicador_censo_id) ON DELETE CASCADE,
    tipologia VARCHAR,
    dormitorios INT2,
    banos INT2,
    construccion_m2 NUMERIC,
    sus_m2 NUMERIC,
    precio NUMERIC,
    bs_m2 NUMERIC,
    usd_m2 NUMERIC,
    estado VARCHAR,
    tipo_operacion VARCHAR,
    tc_oficial NUMERIC,
    tc NUMERIC,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. oferta_avg_tipologias
CREATE TABLE IF NOT EXISTS public.oferta_avg_tipologias (
    id_avg_tipologia SERIAL PRIMARY KEY,
    indicador_censo_id UUID REFERENCES public.oferta_indicadores_censo(indicador_censo_id) ON DELETE CASCADE,
    avg_tipologia VARCHAR,
    und_vendidas INT4,
    und_por_vender INT4,
    und_totales INT4,
    ritmo_venta NUMERIC,
    meses_stock NUMERIC,
    avg_construccion_m2 NUMERIC,
    avg_sus_m2 NUMERIC,
    avg_precio NUMERIC,
    avg_bs_m2 NUMERIC,
    avg_usd_m2 NUMERIC,
    avg_tc_oficial NUMERIC,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(indicador_censo_id, avg_tipologia)
);

-- 5. oferta_condiciones_financieras
CREATE TABLE IF NOT EXISTS public.oferta_condiciones_financieras (
    condicion_financiera_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    indicador_censo_id UUID REFERENCES public.oferta_indicadores_censo(indicador_censo_id) ON DELETE CASCADE,
    modalidad_pago VARCHAR,
    forma_de_pago VARCHAR,
    aporte_inicial NUMERIC,
    cuota_mensual NUMERIC,
    meses INT2,
    incremento NUMERIC,
    gravamen NUMERIC,
    banco VARCHAR,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. oferta_amenidades
CREATE TABLE IF NOT EXISTS public.oferta_amenidades (
    amenidad_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    proyecto_id UUID REFERENCES public.oferta_proyectos(proyecto_id) ON DELETE CASCADE,
    areas_comunes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
