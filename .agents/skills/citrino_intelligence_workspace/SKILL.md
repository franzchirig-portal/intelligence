---
name: citrino-intelligence-workspace
description: >
  Especificación de arquitectura y capacidades del Workspace de Inteligencia Analítica
  Citrino Platform. Sistema operativo de datos inmobiliarios y multi-industria que
  sustituye dashboards tradicionales por un entorno de productividad integral (Explore,
  Analyze, Predict, Report) con arquitectura Medallion ETL, motor geoespacial GIS,
  copiloto de IA generativo y dossiers ejecutivos de grado institucional.
tags:
  - intelligence-platform
  - workspace-os
  - real-estate-analytics
  - medallion-architecture
  - supabase-postgresql
  - react-vite-nextjs
  - echarts
  - leaflet-gis
  - ai-copilot
  - bolivia-market
---

# 🌐 CITRINO INTELLIGENCE PLATFORM
### *Enterprise Workspace OS for Real Estate & Multi-Industry Intelligence*

> **Documento Ejecutivo de Arquitectura y Capacidades de Producto**  
> Diseñado para presentación ante Comités de Inversión, Fondos de Capital, Desarrolladores y Socios Tecnológicos.

---

## 1. Visión Estratégica & Filosofía de Producto

La mayoría de las herramientas de Business Intelligence en el mercado (como Power BI o Tableau) cometen un error crítico: **venden dashboards estáticos llenos de tarjetas desconectadas**. 

**Citrino Intelligence Platform** rompe radicalmente con ese paradigma. Está concebido como un **Operating System de Inteligencia Analítica (Workspace OS)**, inspirado en la filosofía de interfaces de alta productividad como **VS Code, Figma, Linear y Notion**:

```
┌─────────────────┬──────────────────────────────────────────┬──────────────────┐
│                 │                                          │                  │
│  NAVBAR /       │          WORKSPACE CANVAS (80%)          │    INSPECTOR     │
│  MÓDULOS        │                                          │    CONTEXTUAL    │
│                 │  • Mapas Vectoriales Interactivos (GIS)  │                  │
│  🏠 Inicio      │  • Radar Multidimensional Competitivo    │  • Diagnóstico   │
│  📊 Inteligencia│  • Matrices de Tipología y Precios ($/m²)│  • Métricas Micro│
│  🗺️ Geoespacial │  • Command Palette (⌘K / Ctrl+K)         │  • IA Copilot    │
│  📑 Dossiers    │  • Simulación de Escenarios y Absorción  │  • Historial     │
│                 │                                          │                  │
└─────────────────┴──────────────────────────────────────────┴──────────────────┘
```

### Principio Fundamental: "Todo funciona como Aplicaciones, nunca como Páginas"
En lugar de forzar al usuario a saltar entre URLs y recargar pantallas:
* El analista selecciona un proyecto en el mapa vectorial.
* El inspector lateral abre instantáneamente el diagnóstico de tracción comercial.
* Con un clic se compara lado a lado contra sus competidores directos en un radar 5D.
* Con otro clic se genera un dossier ejecutivo descargable en PDF de grado institucional.
* **Todo a 60 FPS, sin recargar la página.**

---

## 2. Los 4 Espacios de Trabajo (The 4 Workspaces)

La plataforma organiza el flujo analítico profesional en 4 etapas cognitivas:

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  1. EXPLORE │ ──> │ 2. ANALYZE  │ ──> │  3. PREDICT │ ──> │  4. REPORT  │
│  Datos, GIS │     │ Comparador, │     │ Simulación, │     │ Dossiers,   │
│  y Filtros  │     │ Tipologías  │     │ Absorción IA│     │ PDF, Excel  │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
```

### 1. `Explore` (Exploración Territorial & Censal)
* **Motor Geoespacial GIS en Tiempo Real**: Mapas vectoriales con tecnología ESRI Canvas (adaptables automáticamente a modo Diurno y Nocturno).
* **Volumetría y Semáforos de Riesgo**: Marcadores circulares proporcionales al inventario, coloreados según velocidad de venta (`<12 meses`, `12-18 meses`, `>24 meses` sobreoferta).
* **Filtros Dinámicos Multidimensionales**: Filtrado instantáneo por Ciudad (Santa Cruz, La Paz, Cochabamba, Nacional), Zona urbana y Etapa de construcción (Preventa, Obra gruesa, Obra fina, Terminado).

### 2. `Analyze` (Competitividad & Producto Inmobiliario)
* **Comparador Head-to-Head**: Contraste lado a lado de 2 a 4 proyectos con matriz de atributos y etiquetas de desempeño (`🏆 Mayor Tracción`, `⚡ Menor Exposición`).
* **Radar Multidimensional 5D**: Evaluación gráfica de:
  1. *Ritmo de Venta* (unidades/mes).
  2. *Stock Disponible* (unidades remanentes).
  3. *% Vendido* (avance sobre el total).
  4. *Escala del Desarrollo* (unidades totales proyectadas).
  5. *Capital Monetizado Expuesto* ($US en inventario).
* **Matriz Oficial de Tipologías (Módulo 01-E)**: Desglose por modelo (Monoambiente, 1D, 2D, 3D+) analizando metrajes mínimos, medios y máximos junto al ticket promedio y valor $/m².

### 3. `Predict` (Inteligencia Predictiva & Copiloto IA)
* **Algoritmos de Absorción y Meses de Stock**: Proyección matemática del horizonte de liquidación de inventario zonal y por proyecto.
* **Copiloto IA Generativo**: Asistente conversacional especializado en finanzas e inversiones inmobiliarias capaz de calcular correlaciones, detectar anomalías de precio y generar gráficos Apache ECharts en tiempo real según la consulta del usuario.

### 4. `Report` (Dossiers Ejecutivos de Inversión)
* **Generador de Memorándums en PDF**: Diseñado específicamente para directorios y comités bancarios. Integra el diagnóstico cualitativo automatizado, KPIs cuantitativos y visualizaciones en formato A4 limpio.
* **Exportación de Datos Crudos (CSV/Excel)**: Descarga directa de datos consolidados para modelación financiera avanzada.

---

## 3. Arquitectura de Datos: Medallion Pipeline (ETL Idempotente)

La base de datos sigue el estándar de las grandes plataformas de datos empresariales (**Arquitectura Medallion**):

```
┌────────────────────────────────────────────────────────────────────────┐
│                        FUENTES DE INGESTIÓN                            │
│  Google Sheets API v4 (9 libros consolidados) + Data Studio + Relevamientos│
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │  GitHub Actions (Cron cada 6h)
                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│ 🥉 BRONZE LAYER (Raw Ingestion)                                        │
│  • Tabla: bronze_raw_sheets                                            │
│  • Hashes SHA-256 por fila para idempotencia absoluta (0 duplicados)   │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │  Python Transform Pipeline
                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│ 🥈 SILVER LAYER (Cleaned & Validated)                                  │
│  • Limpieza de anomalías de divisas ($US vs Bs)                        │
│  • Geocodificación y normalización de tipologías                       │
│  • Tablas: silver_projects, silver_tipologias, silver_amenidades       │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │  Materialized Views / Aggregators
                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│ 🥇 GOLD & DIAMOND LAYER (Analytical Core - Supabase PostgreSQL)        │
│  • Tablas: diamond_properties, oferta_proyectos, oferta_tipologias     │
│  • Índices geoespaciales y consultas optimizadas para sub-segundo      │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Stack Tecnológico de Grado Institucional

| Capa | Tecnologías Seleccionadas | Razón Técnica y de Negocio |
|---|---|---|
| **Frontend Framework** | **React 19 / Next.js 15 (App Router)** | Renderizado ultra-fluido, arquitectura modular por componentes, SEO institucional. |
| **Diseño & Styling** | **Modern CSS Design Tokens + TailwindCSS** | Control milimétrico de paleta de marca (*Citrino Petrol & Amber*), sin dependencias pesadas. |
| **Visualización Gráfica** | **Apache ECharts** | El motor de gráficos más potente del mercado; soporta gráficos radar, barras, líneas y visualización masiva sin degradación de memoria. |
| **Cartografía GIS** | **Leaflet GIS + ESRI World Canvas** | Rendimiento 10x superior a librerías propietarias costosas; soporte nativo para capas diurnas y nocturnas sin costo de API key. |
| **Base de Datos & Auth** | **Supabase (PostgreSQL 15)** | Motor SQL relacional maduro, Row Level Security (RLS), soporte geoespacial PostGIS y autenticación robusta. |
| **Pipeline ETL** | **Python 3.11 + GitHub Actions** | Ingestión autónoma programada cada 6 horas, con tolerancia a fallos y alertas de sincronización. |
| **Hosting & Edge Delivery**| **Vercel Global Edge Network** | Disponibilidad del 99.99%, despliegue continuo (CI/CD) conectado a GitHub y latencia mínima. |

---

## 5. Capacidades Institucionales Exclusivas

1. **Conmutador de Tema Diurno / Nocturno (Daylight & Night Mode):**
   - **Modo Diurno (☀️ Daylight Slate):** Diseñado para salas de juntas con alta iluminación, proyectores o trabajo de oficina diurno. Paleta pizarra de máximo contraste (`#0f172a` sobre `#f1f5f9`).
   - **Modo Nocturno (🌙 Deep Petrol Dark):** Diseñado para analistas de datos en sesiones de trabajo intensivas, minimizando el cansancio ocular.
   - **Mapas y gráficos adaptativos:** Los azulejos satelitales y los ejes de los gráficos ECharts cambian de paleta en tiempo real.

2. **Command Palette Global (`⌘K` / `Ctrl+K`):**
   - Búsqueda tipo Spotlight/Linear: localiza proyectos, cambia de ciudad, filtra por zonas o ejecuta comandos sin tocar el ratón.

3. **Arquitectura Multi-Rubro (Agnóstica al Sector):**
   - Diseñada desde el primer día para escalar no solo en el sector **Inmobiliario**, sino también en **Automotriz, Retail, Agroindustria y Banca/Crédito**, adaptando únicamente las capas Silver y Gold.

---

## 6. Casos de Negocio para Stakeholders & Clientes

* **Para Desarrolladores Inmobiliarios:** Identificación precisa de qué tipologías están saturadas y en qué zonas existe demanda insatisfecha antes de comprar terrenos o diseñar planos.
* **Para Fondos de Inversión y Bancos:** Monitoreo del ritmo de colocación de garantías hipotecarias, alertas tempranas de sobreoferta y valoración realista de carteras de activos adjudicados.
* **Para Brokers y Asesores Patrimoniales:** Capacidad de generar dossiers ejecutivos en 3 segundos para cerrar negociaciones con inversionistas institucionales y compradores de alto patrimonio.

---

*Desarrollado y optimizado en la plataforma de desarrollo agéntico Google Antigravity.*
