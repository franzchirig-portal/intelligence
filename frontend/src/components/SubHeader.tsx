import './SubHeader.css'

type Tab = 'mercado' | 'tipologias' | 'proyectos' | 'geoespacial' | 'hipotecario' | 'chapter_dossier'

interface SubTab {
  id: Tab
  label: string
}

const SUB_TABS: SubTab[] = [
  { id: 'proyectos',   label: 'Proyectos'  },
  { id: 'tipologias',  label: 'Tipologías' },
  { id: 'geoespacial', label: 'Mapa'       },
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
          >
            {t.label}
          </button>
        ))}
      </nav>
    </div>
  )
}
