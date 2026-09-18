# Guía de Usuario & Referencia Operativa — Citrino Workspace OS

Bienvenido a la guía oficial de **Citrino Workspace OS (Operating System de Inteligencia Inmobiliaria)** para el mercado de Bolivia (Santa Cruz, La Paz, Cochabamba y consolidado nacional).

---

## 🚀 Acceso Rápido y Atajos de Teclado

| Atajo | Acción |
|---|---|
| `⌘K` / `Ctrl+K` | Abrir el **Command Palette** global desde cualquier vista |
| `↑` / `↓` | Navegar por la lista de proyectos, zonas o comandos |
| `Enter ↵` | Ejecutar acción, cambiar de ciudad o seleccionar proyecto |
| `ESC` | Cerrar el modal flotante |

---

## 🖥️ Módulos Integrados en el Workspace OS

### 1. 🌟 Mission Control
- Permite evaluar al instante la salud del mercado seleccionado:
  - **Proyectos Activos**: Cantidad total en oferta.
  - **Stock Disponible**: Unidades aún sin vender.
  - **Valor de Stock**: Capital total monetizado en dólares de lista.
  - **Ritmo de Venta**: Unidades promedio absorbidas por mes.
  - **Meses de Stock**: Horizonte de agotamiento de inventario.
- Gráficos de barras y líneas para distribución por zona.
- Ranking de proyectos de mayor velocidad versus proyectos de absorción lenta.

### 2. ⚖️ Comparador Multidimensional (Head-to-Head)
- Para contrastar de **2 a 4 proyectos simultáneamente**:
  1. Escribe el nombre del proyecto en el buscador `+ Agregar proyecto...` o haz clic en "Comparar" desde Mission Control.
  2. Revisa la **Matriz Comparativa** con badges automáticos de mejor desempeño (`🏆 Mayor Tracción`, `⚡ Menor Exposición`).
  3. Visualiza el **Radar Multidimensional**: compara ritmo, volumen, meses de stock, % vendido y valor total.
  4. Descarga el gráfico radar como imagen PNG de alta resolución con el botón `📷 Exportar PNG`.
  5. Examina el **desglose de tipologías** cruzadas (precio, m² y $/m²).

### 3. 📑 Generador de Reportes & Dossiers Ejecutivos
- Diseñado para **comités de inversión, juntas directivas y desarrolladores**:
  - **Selector de Alcance**: Ficha de Proyecto Específico, Ficha de Zona o Informe de Mercado Completo.
  - **Diagnóstico Analítico**: Texto ejecutivo redactado dinámicamente según los indicadores cuantitativos.
  - **Exportación PDF**: Haz clic en `🖨️ Imprimir / Guardar en PDF`. El diseño A4 oculta automáticamente barras de navegación y controles para dejar un informe corporativo limpio.
  - **Exportación CSV**: Haz clic en `📥 Exportar Datos (CSV)` para abrir la tabla en Microsoft Excel o Google Sheets.

### 4. 🔄 Data & Pipeline Control (Medallion Studio)
- **Diagrama de Flujo Medallion ETL**:
  - 🥉 **Bronze**: Google Sheets API v4 (9 fuentes cada 6 horas).
  - 🥈 **Silver**: Validación y limpieza con Python 3.11.
  - 🥇 **Gold/Diamond**: Base de datos Supabase PostgreSQL.
- **Data Inspector**:
  - Selecciona cualquier tabla (`oferta_proyectos`, `oferta_indicadores_censo`, `oferta_avg_tipologias`, `oferta_amenidades`).
  - Consulta registros crudos en vivo con buscador instantáneo.

---

## 📦 Sincronización y Repositorios

El repositorio oficial de esta versión avanzada es:
`https://github.com/franzchirig-portal/IWS-intellegence.git`

Para sincronizar o subir cambios localmente:
```bash
git add .
git commit -m "feat: implement Citrino Workspace OS"
git push -u origin master
```
