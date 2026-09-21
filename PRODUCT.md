# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Desarrolladores inmobiliarios en Bolivia (Santa Cruz, La Paz, Cochabamba) que comparan su oferta contra la competencia por zona y tipología para decidir precio, mezcla de unidades y ubicación. Trabajan principalmente en escritorio. Otras audiencias posibles (equipo interno Citrino, comités de inversión que reciben dossiers PDF, invitados en modo guest) existen en el código pero no se confirmaron como primarias.

## Product Purpose

Citrino "Intelligence" / Workspace OS: inteligencia de mercado inmobiliario para Bolivia. Muestra salud del mercado (proyectos activos, stock, valor de stock, ritmo de venta, meses de stock), compara 2–4 proyectos, analiza tipologías y precios por m², y genera reportes/dossiers ejecutivos (PDF/CSV). Éxito: que un desarrollador tome decisiones de precio y producto respaldadas por datos de mercado.

## Positioning

Datos propios de oferta (márgenes, tipologías, amenidades, snapshots por proyecto) cruzados con indicadores de censo y capas geoespaciales (KMZ/QGIS, mapas de calor y burbujas) en un solo workspace. Un competidor sin ese relevamiento propio no puede copiarlo.

## Operating Context

- Fuente: Google Sheets (3 pestañas por ciudad) → pipeline Python → Supabase (modelo "Diamond", tablas `oferta_*`), sincronizado cada 6 h.
- Frontend React 19 + Vite lee Supabase directo; estilo de shell tipo Antigravity IDE (sidebars, command palette Ctrl/⌘+K, chat panel).
- Filtro de ciudad: SCZ, LPZ, CBB o consolidado nacional (ALL).
- Reportes se imprimen a PDF en formato A4 para juntas directivas.

## Capabilities and Constraints

- Módulos: Mission Control, Comparador multidimensional, Generador de reportes, Análisis, Tipologías, Workspace, Geoespacial.
- Acceso por Supabase auth o modo invitado.
- UI y copy en español; moneda de referencia USD.
- Sin suite de tests; el build no verifica tipos.

## Brand Commitments

Nombre Citrino. Tema claro por defecto para todos los usuarios (decisión reciente, commit 891fd2a). Estética de shell tipo Antigravity IDE ya adoptada en el producto.

## Evidence on Hand

Datos reales en Supabase y polígonos en `datakmz/`. Guía operativa en `docs/WORKSPACE_OS_GUIDE.md`. No hay testimonios, casos de éxito ni métricas de uso documentados; no inventarlos.

## Product Principles

1. El dato manda: cada cifra debe ser trazable a un proyecto, zona o snapshot.
2. Comparar es la acción central: todo flujo debe facilitar contrastar proyectos, zonas y tipologías.
3. Del análisis al documento: lo visto en pantalla debe poder exportarse limpio para comités y desarrolladores.
4. Escaneable en escritorio, denso pero legible.

## Accessibility & Inclusion

Sin estándar formal confirmado. Interfaz en español; debe funcionar bien en escritorio, con tema claro como predeterminado.
