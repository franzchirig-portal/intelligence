-- ============================================================================
-- CITRINO PLATFORM: CONTROL DE ACCESOS Y USUARIOS (Supabase Auth)
-- ============================================================================

-- 1. Si registraste un usuario y te dice "Invalid login credentials" debido a que
--    Supabase requiere confirmación por correo, ejecuta esta consulta para
--    confirmar automáticamente todos los usuarios registrados:

UPDATE auth.users
SET email_confirmed_at = now()
WHERE email_confirmed_at IS NULL;

-- 2. RECOMENDACIÓN PARA ACCESO INMEDIATO SIN CORREO DE CONFIRMACIÓN:
--    En tu panel de Supabase (https://supabase.com/dashboard/project/dgbemibfisneieiiexzg):
--    a) Ve a: Authentication -> Providers -> Email
--    b) Desmarca la casilla: "Confirm email"
--    c) Haz clic en "Save"
--    Con esto, cualquier persona que cree su usuario y contraseña en la pantalla
--    de registro de la plataforma podrá ingresar al instante sin tener que
--    abrir su correo.
