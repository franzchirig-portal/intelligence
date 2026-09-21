---
name: Citrino Intelligence
description: Workspace OS de inteligencia inmobiliaria para Bolivia, con la estética sobria y monocroma de un IDE.
colors:
  ink: "#0f172a"
  slate-text: "#334155"
  slate-muted: "#64748b"
  canvas: "#f8fafc"
  surface: "#ffffff"
  hover-wash: "#f1f5f9"
  active-wash: "#e2e8f0"
  line: "#e2e8f0"
  line-strong: "#cbd5e1"
  line-bright: "#94a3b8"
  positive: "#059669"
  negative: "#dc2626"
  warning: "#d97706"
  night-canvas: "#181818"
  night-surface: "#1e1e1e"
  night-card: "#252526"
  night-ink: "#f3f3f3"
typography:
  body:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.5
  tab:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "11.5px"
    fontWeight: 500
  kpi-value:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "20px"
    fontWeight: 700
    lineHeight: 1
  label:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "10px"
    fontWeight: 600
    letterSpacing: "0.07em"
  data:
    fontFamily: "JetBrains Mono, monospace"
    fontSize: "11px"
    fontWeight: 400
rounded:
  sm: "4px"
  md: "6px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
components:
  ide-tab:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.slate-text}"
    typography: "{typography.tab}"
    height: "35px"
    padding: "0 14px"
  ide-tab-active:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
  kpi-card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    padding: "12px 16px"
  badge-positive:
    textColor: "{colors.positive}"
    rounded: "{rounded.sm}"
    padding: "2px 7px"
  btn-send:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.surface}"
    rounded: "{rounded.md}"
    size: "32px"
---

# Design System: Citrino Intelligence

## Overview

**Creative North Star: "El Tablero del Analista"**

Una herramienta de trabajo, no una vitrina. La interfaz se retira para que las cifras de mercado (stock, precio por m², meses de stock) sean lo único con peso visual. Sobria y precisa: paneles planos separados por líneas finas en lugar de sombras.

La estructura nace de una decisión del autor: el producto se navega **solo por cuatro páginas** (Oferta Nueva, Tipologías, Proyectos, Mapa) desde una barra superior, sin panel izquierdo. Se mantienen el panel derecho de chat y el de diagnóstico/análisis. No hay paleta de comandos. Se conserva la barra superior con pestañas heredada del shell tipo IDE, pero el sistema **no** debe leerse como un editor de código: es una herramienta inmobiliaria.

La densidad es alta pero controlada: texto base de 13px, etiquetas de 10px, datos numéricos en monoespaciada. Se diseña para escritorio y para el desarrollador que compara proyectos durante minutos. El tema claro es el predeterminado; el oscuro (carbón neutro) sigue como variante.

**Key Characteristics:**
- Monocromo: la tinta oscura es el único "acento". El color de marca Citrino está **por resolver**; hasta entonces no se inventa uno.
- Color solo con significado: verde, rojo y ámbar comunican variación o alerta de datos.
- Estructura por líneas de 1px, no por sombras ni tarjetas flotantes.
- Cifras tabulares; monoespaciada para valores en tablas.
- Menos es más: cada control visible debe justificar su lugar; se prefiere ocultar o eliminar antes que decorar.

## Colors

Paleta pizarra fría casi sin croma; el color semántico es la única señal cromática.

### Primary
- **Tinta Pizarra** (#0f172a): texto principal, botón de envío, pestaña activa, y el "acento" de la interfaz (`--accent-blue` resuelve a este valor en claro).

### Secondary
- **Pizarra Media** (#334155): texto secundario y series de gráficos de apoyo.
- **Pizarra Apagada** (#64748b): etiquetas, texto silenciado, metadatos.

### Tertiary (semánticos)
- **Verde Mercado** (#059669): variación positiva, insignias `badge-pos`.
- **Rojo Alerta** (#dc2626): variación negativa, `badge-neg`.
- **Ámbar Cautela** (#d97706): advertencias, `badge-warn`.

### Neutral
- **Lienzo Frío** (#f8fafc): fondo base y cabeceras de panel.
- **Superficie Blanca** (#ffffff): paneles, tarjetas, inputs.
- **Lavado Hover** (#f1f5f9) y **Lavado Activo** (#e2e8f0): estados de fila y botón.
- **Línea Fina** (#e2e8f0), **Línea Firme** (#cbd5e1), **Línea Brillante** (#94a3b8): bordes en tres niveles.
- Variante oscura: Carbón (#181818) de base, (#1e1e1e) superficie, (#252526) tarjeta, texto (#f3f3f3).

### Named Rules
**The Semantic-Only Color Rule.** Verde, rojo y ámbar aparecen solo cuando el dato es bueno, malo o dudoso. Nunca como decoración.
**The Token Rule.** Los componentes leen `var(--…)`; un hex literal en un componente rompe el tema oscuro. (Hoy hay excepciones: insignias y `.ide-tab.active` usan hex fijos.)

## Typography

**Display Font:** ninguna; no hay titulares expresivos.
**Body Font:** Inter (con system-ui, sans-serif)
**Label/Mono Font:** JetBrains Mono, para valores tabulares y metadatos numéricos.

**Character:** Inter neutra y compacta, con JetBrains Mono para los números. Suena a herramienta técnica.

### Hierarchy
- **KPI Value** (700, 20px, 1): la cifra grande de cada tarjeta KPI, con `tabular-nums`.
- **Body** (400, 13px, 1.5): cuerpo general de la aplicación.
- **Tab** (500, 11.5px): pestañas del topbar y textos de barra.
- **Label** (600, 10px, 0.07em, mayúsculas): etiquetas de KPI y cabeceras de sección.
- **Data** (400–500, 11px, JetBrains Mono): celdas numéricas (`td-num`) y valores de métricas.

### Named Rules
**The Tabular Numbers Rule.** Toda cifra comparable usa `tabular-nums` o monoespaciada para que las columnas alineen.

## Layout

Shell de pantalla completa (100vh, sin scroll de página): topbar de 35px, panel central flexible y panel derecho de 330px (chat y diagnóstico/análisis). **No hay sidebar izquierdo**: se elimina, junto con notificaciones, configuración y los dos iconos superiores que lo acompañaban. Cada panel scrollea por dentro. Los KPI van en una grilla de 4 columnas y los gráficos en 2 columnas, separados por huecos de 1px que dejan ver el color de borde (cuadrícula "de hairlines"). Espaciado: 4/8/12/16px. Hay un único breakpoint relevante, `max-width: 1100px`; el producto está pensado para escritorio. La impresión (`@media print`) reformatea reportes a A4 para comités.

## Elevation & Depth

Plano por defecto: la profundidad viene de capas tonales (lienzo, superficie, cabecera de panel) y de líneas de 1px. Las sombras existen pero son discretas.

### Shadow Vocabulary
- **Panel** (`0 0 0 1px var(--border-subtle), 0 2px 16px rgba(15,23,42,0.08)`): menús flotantes y diálogos.
- **Card** (`0 1px 3px rgba(15,23,42,0.08), 0 4px 12px rgba(15,23,42,0.04)`): tarjetas elevadas puntuales.

### Named Rules
**The Hairline Rule.** Separar con una línea de 1px o un cambio tonal antes que con una sombra. Los glows están desactivados (`--glow-*: none`).

## Shapes

Esquinas casi rectas: 4px en insignias y controles pequeños, 6px en botones, inputs y tarjetas. Sin píldoras ni formas circulares salvo avatares e iconos. Bordes de 1px en todo contenedor.

## Components

### Navigation (pestañas superiores)
Navegación única del producto: cuatro pestañas, **Oferta Nueva, Tipologías, Proyectos, Mapa** (hoy "Geoespacial"; renombrar). Sin numeraciones tipo "01 · " ni "01-E ·" en las etiquetas. Pestañas de 35px de alto, separadas por líneas verticales de 1px. Inactiva: fondo lienzo, texto pizarra media. Hover: lavado gris. Activa: fondo superficie, texto tinta, filete superior de 2px. Transición 0.12s.

### Buttons
- **Shape:** 6px de radio.
- **Send / primario:** cuadrado de 32px, fondo tinta, icono blanco; en hover invierte a fondo claro.
- **Icono topbar:** transparente, hover con lavado gris.
- **Disabled:** opacidad 0.4.

### KPI Card
Fondo superficie, padding 12×16, etiqueta de 10px en mayúsculas arriba, valor de 20px, subtexto de 10px con variación en verde/rojo. Sin borde propio: la separación son huecos de 1px.

### Badges
Insignia semántica de 4px de radio, 10px en negrita, fondo con 15% de opacidad del color y borde al 30%.

### Inputs
Fondo superficie, borde de 1px, radio 6px. Foco: el borde pasa al color de acento (tinta), sin glow.

## Do's and Don'ts

### Do:
- **Do** mantener la navegación en exactamente cuatro páginas: Oferta Nueva, Tipologías, Proyectos y Mapa.
- **Do** usar `var(--…)` para todo color, para que claro y oscuro funcionen.
- **Do** separar zonas con líneas de 1px y cambios tonales.
- **Do** reservar verde/rojo/ámbar para variación y alerta de datos.
- **Do** usar cifras tabulares o JetBrains Mono para valores comparables.

### Don't:
- **Don't** volver a añadir panel izquierdo, notificaciones, configuración visible ni paleta de comandos (Ctrl+K).
- **Don't** imitar un editor de código (pestañas de archivo, jerga de IDE, texto tipo "Antigravity IDE" en la UI).
- **Don't** sobrecargar: sin paneles, métricas o controles que no sirvan a la decisión de precio, mezcla o ubicación.
- **Don't** introducir un color de marca saturado o azules/violetas; el sistema es deliberadamente monocromo.
- **Don't** añadir glows, gradientes o sombras pesadas.
- **Don't** hardcodear hex en componentes ni en configuraciones de ECharts sin ramas claro/oscuro.
- **Don't** usar tipografía de más de 20px dentro de paneles de trabajo.
