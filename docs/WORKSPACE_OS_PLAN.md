# Workspace OS de Inteligencia Inmobiliaria — Plan y Arquitectura

## 1. Visión General
Transformación de Citrino Intelligence Platform en un **Workspace OS (Sistema Operativo de Inteligencia Inmobiliaria)** de nivel institucional, combinando un Command Palette global (`Cmd+K`), un entorno de aplicaciones con OS Dock, Comparador Multidimensional (Head-to-Head), Generador de Reportes & Dossiers Ejecutivos listos para exportar/imprimir, y Data & Pipeline Control con telemetría del flujo ETL Medallion.

---

## 2. Pilares de la Suite Workspace OS

### 🌟 1. Mission Control (Centro de Mando & Live Pulse)
- **KPIs Vivos en Tiempo Real**: Proyectos activos, unidades disponibles en oferta, volumen monetizado en USD, ritmo de absorción promedio mensual y proyección de meses de stock.
- **Distribución Sectorial**: Gráfico interactivo ECharts de oferta y ritmos por zona geográfica.
- **Detección de Tracción & Riesgo de Inventario**: Tablas con ranking de proyectos con mayor velocidad comercial frente a proyectos con alta exposición de stock ocioso.

### ⚖️ 2. Comparador Multidimensional (Head-to-Head)
- **Contraste de 2 a 4 Proyectos / Zonas en Simultáneo**:
  - Matriz con badges automáticos de benchmark (`🏆 Mayor Tracción`, `⚡ Menor Exposición`).
  - Radar Multidimensional (ECharts) que normaliza 5 variables críticas: Ritmo de Venta, Stock Disponible, % Vendido, Escala de Unidades y Valor Monetario.
  - Desglose y contraste cruzado de tipologías (Estudio, 1D, 2D, 3D) con superficie m², precio USD y $/m².

### 📑 3. Generador de Reportes & Dossiers Ejecutivos
- **Dossier Institucional Print-Ready**: Formato editorial corporativo para comités de inversión y directivos.
- **Alcances Dinámicos**: Por proyecto individual seleccionado, por zona consolidada o por todo el mercado de la ciudad (SCZ, LPZ, CBB, ALL).
- **Diagnóstico Analítico Automatizado**: Comentario ejecutivo generado mediante reglas cuantitativas sobre absorción y riesgo de inventario.
- **Exportaciones**:
  - `🖨️ Imprimir / Guardar en PDF`: Layout `@media print` optimizado a tamaño A4 sin elementos innecesarios de UI.
  - `📥 Descarga en CSV`: Exportación tabular con delimitadores para Excel.
  - `📷 Exportación PNG`: Gráficos radar y distribución exportables en alta resolución.

### 🔄 4. Data & Pipeline Control (Medallion Studio)
- **Monitoreo de Arquitectura Medallion ETL**:
  - **Bronze Layer**: Ingesta cruda desde Google Sheets API v4 (9 fuentes).
  - **Silver Layer**: Normalización, limpieza numérica boliviana, validación de coordenadas y slugs.
  - **Gold/Diamond Layer**: Tablas en Supabase (`oferta_proyectos`, `oferta_indicadores_censo`, `oferta_avg_tipologias`, `oferta_amenidades`, `oferta_condiciones_financieras`).
- **Data Inspector en Vivo**: Consulta paginada y filtrable de registros de cualquier tabla del backend.
- **Telemetría**: Conteo exacto de registros en tiempo real y estado de conectividad.

### ⌨️ 5. Command Center & Palette (`⌘K` / `Ctrl+K`)
- Búsqueda instantánea estilo Spotlight / Raycast accesible desde cualquier pantalla.
- Navegación por teclado (`↑`, `↓`, `Enter`, `Esc`).
- Filtros rápidos por proyectos, zonas, ciudades y salto directo a cualquier herramienta del OS.

---

## 3. Estructura de Archivos
```
frontend/src/
├── components/
│   ├── CommandPalette.tsx     # Buscador global y disparador de acciones (Cmd+K)
│   ├── WorkspaceOSPanel.tsx   # Panel central del Workspace OS y Dock de apps
│   ├── WorkspacePanel.tsx     # Vista analítica tabular y series históricas
│   ├── TipologiasPanel.tsx    # Análisis de dormitorios, m2 y $/m2
│   ├── GeoespacialPanel.tsx   # Visualización en mapas y polígonos
│   ├── ChatPanel.tsx          # Copiloto analítico con ECharts dinámicos
│   ├── AnalysisPanel.tsx      # Deep dive individual por proyecto
│   └── MultiSelectDropdown.tsx# Filtro de etapas multi-selección
├── App.tsx                    # Shell principal con routing del OS y shortcut global
└── index.css                  # Tokens visuales Citrino, glassmorphism y print rules
```
