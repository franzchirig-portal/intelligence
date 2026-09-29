import './SubHeader.css'

export type Tab =
  | 'proyectos'
  | 'tipologias'
  | 'geoespacial'
  | 'resumen_general'
  | 'stock_unidades'
  | 'stock_usd'
  | 'ritmo_ventas'
  | 'meses_stock'
  | 'analisis_producto'
  | 'mercado'
  | 'hipotecario'
  | 'chapter_dossier'

export interface SubTab {
  id: Tab
  label: string
  unit?: string
}

export const SUB_TABS: SubTab[] = [
  { id: 'proyectos',         label: 'Proyectos' },
  { id: 'tipologias',        label: 'Tipologías' },
  { id: 'geoespacial',       label: 'Mapa' },
  { id: 'resumen_general',   label: 'Resumen General' },
  { id: 'stock_unidades',    label: 'Stock en Ventas', unit: '(Unidades)' },
  { id: 'stock_usd',         label: 'Stock en Ventas', unit: '(USD)' },
  { id: 'ritmo_ventas',      label: 'Ritmo de Ventas' },
  { id: 'meses_stock',       label: 'Meses de Stock' },
  { id: 'analisis_producto', label: 'Análisis de Producto' },
]

interface SubHeaderProps {
  activeTab: string
  onTabChange: (tab: Tab) => void
}

export default function SubHeader({ activeTab, onTabChange }: SubHeaderProps) {
  return (
    <div className="sub-header" role="navigation" aria-label="Módulos de análisis">
      <nav className="sub-header-tabs">
        {SUB_TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`sub-header-tab ${activeTab === t.id ? 'active' : ''}`}
            aria-current={activeTab === t.id ? 'page' : undefined}
            onClick={() => onTabChange(t.id)}
            title={t.unit ? `${t.label} ${t.unit}` : t.label}
          >
            <span className="sub-header-tab-text">
              <span className="sub-header-tab-label">{t.label}</span>
              {t.unit && <span className="sub-header-tab-unit">{t.unit}</span>}
            </span>
          </button>
        ))}
      </nav>
    </div>
  )
}

