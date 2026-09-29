import { useCallback, useEffect, useRef, useState, type WheelEvent } from 'react'
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
  const scrollRef = useRef<HTMLDivElement>(null)
  const [canScroll, setCanScroll] = useState({ left: false, right: false })

  // Muestra las flechas ‹ › solo si hay pestañas ocultas hacia ese lado
  const updateArrows = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    const left = el.scrollLeft > 2
    const right = el.scrollLeft + el.clientWidth < el.scrollWidth - 2
    setCanScroll((prev) => (prev.left === left && prev.right === right ? prev : { left, right }))
  }, [])

  useEffect(() => {
    updateArrows()
    window.addEventListener('resize', updateArrows)
    return () => window.removeEventListener('resize', updateArrows)
  }, [updateArrows])

  const scrollByPage = (dir: -1 | 1) => {
    const el = scrollRef.current
    if (el) el.scrollBy({ left: dir * el.clientWidth * 0.7, behavior: 'smooth' })
  }

  // Mantiene visible la pestaña activa cuando la tira se desplaza (móvil)
  useEffect(() => {
    scrollRef.current
      ?.querySelector('.sub-header-tab.active')
      ?.scrollIntoView({ block: 'nearest', inline: 'center' })
    updateArrows()
  }, [activeTab, updateArrows])

  // Rueda vertical del mouse → desplazamiento horizontal
  const handleWheel = (e: WheelEvent<HTMLDivElement>) => {
    const el = scrollRef.current
    if (el && el.scrollWidth > el.clientWidth && Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
      el.scrollLeft += e.deltaY
    }
  }

  return (
    <div className="sub-header-wrap">
      {canScroll.left && (
        <button
          type="button"
          className="sub-header-arrow left"
          aria-label="Ver pestañas anteriores"
          onClick={() => scrollByPage(-1)}
        >
          ‹
        </button>
      )}
      <div
        ref={scrollRef}
        className="sub-header"
        role="navigation"
        aria-label="Módulos de análisis"
        onWheel={handleWheel}
        onScroll={updateArrows}
      >
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
      {canScroll.right && (
        <button
          type="button"
          className="sub-header-arrow right"
          aria-label="Ver más pestañas"
          onClick={() => scrollByPage(1)}
        >
          ›
        </button>
      )}
    </div>
  )
}

