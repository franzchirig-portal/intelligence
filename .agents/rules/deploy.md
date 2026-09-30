# Regla: Actualizar / Publicar en Vercel

Cuando el usuario pida **"actualizar"**, **"publicar"**, **"subir a Vercel"**, **"actualizar Vercel"**, **"que cualquiera pueda verla"** o frases similares relacionadas con desplegar la plataforma, ejecuta SIEMPRE este flujo completo en orden:

## Flujo obligatorio de deploy

### 1. Verificar estado del repositorio
```
git status -sb
git log -n 3 --oneline
```

### 2. Stagear TODOS los cambios
```
git add -A
```

### 3. Hacer commit con mensaje descriptivo
```
git commit -m "feat(deploy): sync latest changes for Vercel production"
```
Si no hay nada que committear (`nothing to commit`), saltar al paso 4.

### 4. Push al repositorio remoto (requiere BypassSandbox: true)
```
git push origin master
```
IMPORTANTE: Usar siempre `BypassSandbox: true` en este comando porque requiere acceso a la red.

### 5. Confirmar al usuario
Después del push exitoso, reportar:
- Hash del commit pusheado
- Archivos que se incluyeron
- Que Vercel iniciará el rebuild automáticamente (~1-2 minutos)
- URL del dashboard: https://vercel.com/dashboard

## Datos clave del proyecto
- Repositorio remoto: https://github.com/franzchirig-portal/intelligence.git
- Rama de producción: master
- Vercel auto-despliega en cada push a master (no requiere comando adicional)
- No ejecutar npm run build manualmente — Vercel lo hace con la config de vercel.json
- Los visitantes acceden sin cuenta (guestMode = true en App.tsx)
