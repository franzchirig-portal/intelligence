import './LeftAnalyticsBar.css'

type Tab = 'mercado' | 'tipologias' | 'proyectos' | 'geoespacial' | 'hipotecario'

interface NavItem {
  id: Tab
  label: string
  icon: React.ReactNode
}

interface LeftAnalyticsBarProps {
  activeTab: string
  onTabChange: (tab: Tab) => void
}

const IconMercado = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
  </svg>
)

const IconProyectos = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="7" width="20" height="14" rx="2" />
    <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
    <line x1="12" y1="12" x2="12" y2="17" />
    <line x1="9" y1="14.5" x2="15" y2="14.5" />
  </svg>
)

const IconTipologias = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="1" x2="12" y2="23" />
    <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
  </svg>
)

const IconHipotecario = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <path d="M3 9h18" />
    <path d="M9 21V9" />
  </svg>
)

const IconMapa = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
    <line x1="8" y1="2" x2="8" y2="18" />
    <line x1="16" y1="6" x2="16" y2="22" />
  </svg>
)

const NAV_ITEMS: NavItem[] = [
  { id: 'mercado',     label: 'Análisis de Mercado',         icon: <IconMercado /> },
  { id: 'proyectos',  label: 'Análisis de Demanda',          icon: <IconProyectos /> },
  { id: 'tipologias', label: 'Análisis Financiero',          icon: <IconTipologias /> },
  { id: 'hipotecario',label: 'Endeudamiento Hipotecario',    icon: <IconHipotecario /> },
  { id: 'geoespacial',label: 'Indicadores Inmobiliarios',    icon: <IconMapa /> },
]

export default function LeftAnalyticsBar({ activeTab, onTabChange }: LeftAnalyticsBarProps) {
  return (
    <nav className="left-analytics-bar" aria-label="Analíticas">
      {NAV_ITEMS.map((item) => (
        <div key={item.id} className="lab-item-wrapper">
          <button
            type="button"
            className={`lab-icon-btn ${activeTab === item.id ? 'active' : ''}`}
            onClick={() => onTabChange(item.id)}
            aria-label={item.label}
            aria-current={activeTab === item.id ? 'page' : undefined}
          >
            {item.icon}
            {item.id === 'hipotecario' && (
              <span className="lab-soon-dot" title="Próximamente" />
            )}
          </button>
          <div className="lab-tooltip" role="tooltip">
            {item.label}
            {item.id === 'hipotecario' && (
              <span className="lab-tooltip-badge">Próximamente</span>
            )}
          </div>
        </div>
      ))}
    </nav>
  )
}
