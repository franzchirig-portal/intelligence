import { useState } from 'react'
import './LeftAnalyticsBar.css'

export interface SubChapter {
  id: string
  title: string
  isAvailable?: boolean
}

export interface AnalysisSection {
  id: string
  num: number
  title: string
  icon: React.ReactNode
  chapters: SubChapter[]
}

const IconMercado = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
  </svg>
)

const IconDemanda = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
)

const IconFinanciero = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="1" x2="12" y2="23" />
    <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
  </svg>
)

const IconHipotecario = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <path d="M3 9h18" />
    <path d="M9 21V9" />
  </svg>
)

const IconIndicadores = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
  </svg>
)

export const ANALYSIS_SECTIONS: AnalysisSection[] = [
  {
    id: 'mercado',
    num: 1,
    title: 'Análisis de Mercado',
    icon: <IconMercado />,
    chapters: [
      { id: '1.1', title: 'Cuantificación de la Oferta Nueva', isAvailable: true },
      { id: '1.2', title: 'Evolución de la Oferta Nueva', isAvailable: true },
      { id: '1.3', title: 'Cuantificación de la Oferta de Particulares', isAvailable: false },
      { id: '1.4', title: 'Bienes Adjudicados', isAvailable: false },
    ],
  },
  {
    id: 'demanda',
    num: 2,
    title: 'Análisis de la Demanda',
    icon: <IconDemanda />,
    chapters: [
      { id: '2.1', title: 'Composición Económica y Voluntad de Compra', isAvailable: false },
      { id: '2.2', title: 'Compra como Inversión', isAvailable: false },
      { id: '2.3', title: 'Compra de Vivienda/Uso Propio', isAvailable: false },
    ],
  },
  {
    id: 'financiero',
    num: 3,
    title: 'Análisis Financiero',
    icon: <IconFinanciero />,
    chapters: [
      { id: '3.1', title: 'Evolución del Financiamiento al Sector Inmobiliario', isAvailable: false },
      { id: '3.2', title: 'Evolución de la Mora del Inmobiliario', isAvailable: false },
    ],
  },
  {
    id: 'hipotecario',
    num: 4,
    title: 'Análisis del Endeudamiento Hipotecario',
    icon: <IconHipotecario />,
    chapters: [
      { id: '4.1', title: 'Perfil del Consumidor de Créditos Hipotecarios', isAvailable: false },
      { id: '4.2', title: 'Estado de la Cartera Hipotecaria', isAvailable: false },
      { id: '4.3', title: 'Perspectivas del Comprador', isAvailable: false },
    ],
  },
  {
    id: 'indicadores',
    num: 5,
    title: 'Indicadores Inmobiliarios',
    icon: <IconIndicadores />,
    chapters: [
      { id: '5.1', title: 'Ciclo Inmobiliario', isAvailable: true },
    ],
  },
]

interface LeftAnalyticsBarProps {
  activeChapter: string
  onSelectChapter: (chapterId: string, sectionId: string) => void
}

export default function LeftAnalyticsBar({
  activeChapter,
  onSelectChapter,
}: LeftAnalyticsBarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [expandedSections, setExpandedSections] = useState<Set<string>>(() => {
    // Open the section that contains activeChapter by default, or 'mercado'
    const initial = new Set<string>()
    const matchingSection = ANALYSIS_SECTIONS.find((s) =>
      s.chapters.some((c) => c.id === activeChapter)
    )
    initial.add(matchingSection ? matchingSection.id : 'mercado')
    return initial
  })

  const toggleSection = (sectionId: string) => {
    if (isCollapsed) {
      setIsCollapsed(false)
      setExpandedSections(new Set([sectionId]))
      return
    }
    setExpandedSections((prev) => {
      const next = new Set(prev)
      if (next.has(sectionId)) {
        next.delete(sectionId)
      } else {
        next.add(sectionId)
      }
      return next
    })
  }

  const handleChapterClick = (chapterId: string, sectionId: string) => {
    onSelectChapter(chapterId, sectionId)
  }

  return (
    <aside
      className={`left-analytics-bar ${isCollapsed ? 'collapsed' : 'expanded'}`}
      aria-label="Capítulos de análisis"
    >
      {/* Sidebar Header */}
      <div className="lab-header">
        {!isCollapsed && (
          <div className="lab-header-title">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="7" height="7" />
              <rect x="14" y="3" width="7" height="7" />
              <rect x="14" y="14" width="7" height="7" />
              <rect x="3" y="14" width="7" height="7" />
            </svg>
            <span>Capítulos</span>
          </div>
        )}
        <button
          type="button"
          className="lab-collapse-btn"
          onClick={() => setIsCollapsed((prev) => !prev)}
          title={isCollapsed ? 'Expandir menú de capítulos' : 'Contraer menú'}
          aria-label={isCollapsed ? 'Expandir menú de capítulos' : 'Contraer menú'}
        >
          {isCollapsed ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          )}
        </button>
      </div>

      {/* Sections List */}
      <div className="lab-sections-container">
        {ANALYSIS_SECTIONS.map((section) => {
          const isOpen = expandedSections.has(section.id)
          const hasActiveChapter = section.chapters.some((c) => c.id === activeChapter)

          return (
            <div
              key={section.id}
              className={`lab-section-group ${isOpen ? 'open' : ''} ${hasActiveChapter ? 'has-active' : ''}`}
            >
              {/* Section Header Button */}
              <button
                type="button"
                className={`lab-section-header ${hasActiveChapter ? 'active' : ''}`}
                onClick={() => toggleSection(section.id)}
                title={section.title}
                aria-expanded={isOpen}
              >
                <span className="lab-section-icon">{section.icon}</span>
                {!isCollapsed && (
                  <>
                    <span className="lab-section-title">
                      {section.num}. {section.title}
                    </span>
                    <span className={`lab-chevron ${isOpen ? 'rotated' : ''}`}>
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="9 18 15 12 9 6" />
                      </svg>
                    </span>
                  </>
                )}
              </button>

              {/* Sub-chapters list (desplegable) */}
              {!isCollapsed && isOpen && (
                <div className="lab-chapters-list" role="menu">
                  {section.chapters.map((ch) => {
                    const isSelected = activeChapter === ch.id
                    return (
                      <button
                        key={ch.id}
                        type="button"
                        className={`lab-chapter-item ${isSelected ? 'selected' : ''}`}
                        onClick={() => handleChapterClick(ch.id, section.id)}
                        role="menuitem"
                        aria-current={isSelected ? 'true' : undefined}
                      >
                        <span className="lab-chapter-num">{ch.id}</span>
                        <span className="lab-chapter-name" title={ch.title}>
                          {ch.title}
                        </span>
                        {!ch.isAvailable && (
                          <span className="lab-chapter-soon-dot" title="En integración" />
                        )}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </aside>
  )
}
