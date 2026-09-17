-- =====================================================================
-- 002_rls_public_read.sql
-- Habilita lectura pública (anon) en todas las tablas del modelo diamante.
-- Ejecutar en Supabase → SQL Editor.
-- =====================================================================

-- 1. oferta_proyectos
ALTER TABLE public.oferta_proyectos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read proyectos" ON public.oferta_proyectos;
CREATE POLICY "Public read proyectos" ON public.oferta_proyectos
  FOR SELECT USING (true);

-- 2. oferta_indicadores_censo
ALTER TABLE public.oferta_indicadores_censo ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read indicadores" ON public.oferta_indicadores_censo;
CREATE POLICY "Public read indicadores" ON public.oferta_indicadores_censo
  FOR SELECT USING (true);

-- 3. oferta_tipologias
ALTER TABLE public.oferta_tipologias ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read tipologias" ON public.oferta_tipologias;
CREATE POLICY "Public read tipologias" ON public.oferta_tipologias
  FOR SELECT USING (true);

-- 4. oferta_avg_tipologias
ALTER TABLE public.oferta_avg_tipologias ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read avg_tipologias" ON public.oferta_avg_tipologias;
CREATE POLICY "Public read avg_tipologias" ON public.oferta_avg_tipologias
  FOR SELECT USING (true);

-- 5. oferta_condiciones_financieras
ALTER TABLE public.oferta_condiciones_financieras ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read condiciones" ON public.oferta_condiciones_financieras;
CREATE POLICY "Public read condiciones" ON public.oferta_condiciones_financieras
  FOR SELECT USING (true);

-- 6. oferta_amenidades
ALTER TABLE public.oferta_amenidades ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read amenidades" ON public.oferta_amenidades;
CREATE POLICY "Public read amenidades" ON public.oferta_amenidades
  FOR SELECT USING (true);

-- Verificar que las políticas están activas:
SELECT tablename, policyname, cmd, permissive
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename LIKE 'oferta_%'
ORDER BY tablename, policyname;
