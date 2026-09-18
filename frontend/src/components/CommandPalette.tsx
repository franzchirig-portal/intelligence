import React, { useState, useEffect, useRef } from 'react'
import type { IndicadorFull } from '../lib/supabase'

interface Props {
  isOpen: boolean
  onClose: () => void
  indicadores: IndicadorFull[]
  currentCiudad: string
  onSelectProject: (proj: IndicadorFull) => void
  onSelectCiudad: (ciudad: 'SCZ' | 'LPZ' | 'CBB' | 'ALL') => void
  onSelectZona: (zona: string) => void
  onSwitchTab: (tab: any) => void
  onOpenApp?: (appId: string) => void
}

interface CommandItem {
  id: string
  title: string
  subtitle?: string
  badge?: string
  category: 'Proyectos' | 'Zonas' | 'Vistas' | 'Herramientas' | 'Ciudades'
  icon: string
  action: () => void
}

export default function CommandPalette({
  isOpen,
  onClose,
  indicadores,
  currentCiudad,
  onSelectProject,
  onSelectCiudad,
  onSelectZona,
  onSwitchTab,
  onOpenApp,
}: Props) {
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (isOpen) {
      setQuery('')
      setSelectedIndex(0)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [isOpen])

  // Extract unique zones
  const zonas = React.useMemo(() => {
    const set = new Set<string>()
    indicadores.forEach((i) => {
      if (i.ZONAS && i.ZONAS.trim()) set.add(i.ZONAS.trim())
    })
    return Array.from(set).sort()
  }, [indicadores])

  // Build command list based on query
  const items: CommandItem[] = React.useMemo(() => {
    const q = query.trim().toLowerCase()
    const result: CommandItem[] = []

    // 1. Navigation / Views
    const views: CommandItem[] = [
      {
        id: 'view_workspace_os',
        title: 'Workspace OS — Centro de Mando Institucional',
        subtitle: 'Dock de aplicaciones, comparador y control de pipeline',
        category: 'Vistas',
        badge: 'OS',
        icon: '⚡',
        action: () => {
          onSwitchTab('workspace_os')
          onClose()
        },
      },
      {
        id: 'view_comparador',
        title: 'Abrir Comparador Multidimensional',
        subtitle: 'Comparar proyectos y zonas frente a frente en métricas y radar',
        category: 'Herramientas',
        badge: 'Herramienta',
        icon: '⚖️',
        action: () => {
          onSwitchTab('workspace_os')
          if (onOpenApp) onOpenApp('comparador')
          onClose()
        },
      },
      {
        id: 'view_dossier',
        title: 'Generar Dossier & Ficha Ejecutiva',
        subtitle: 'Exportar informe corporativo PDF / CSV',
        category: 'Herramientas',
        badge: 'Exportar',
        icon: '📑',
        action: () => {
          onSwitchTab('workspace_os')
          if (onOpenApp) onOpenApp('dossier')
          onClose()
        },
      },
      {
        id: 'view_pipeline',
        title: 'Data & Pipeline Control (Medallion ETL)',
        subtitle: 'Monitoreo Bronze → Silver → Gold y visor de datos Supabase',
        category: 'Herramientas',
        badge: 'Data',
        icon: '🔄',
        action: () => {
          onSwitchTab('workspace_os')
          if (onOpenApp) onOpenApp('pipeline')
          onClose()
        },
      },
      {
        id: 'view_mercado',
        title: '01 · Oferta Nueva (Mercado General)',
        subtitle: 'Gráficos de stock, ritmo de absorción y evolución temporal',
        category: 'Vistas',
        badge: 'Vista',
        icon: '📊',
        action: () => {
          onSwitchTab('mercado')
          onClose()
        },
      },
      {
        id: 'view_tipologias',
        title: '01-E · Tipologías & Precios',
        subtitle: 'Mix de tipologías, m² promedio, precios USD y USD/m²',
        category: 'Vistas',
        badge: 'Vista',
        icon: '📐',
        action: () => {
          onSwitchTab('tipologias')
          onClose()
        },
      },
      {
        id: 'view_proyectos',
        title: 'Directorio de Proyectos',
        subtitle: 'Catálogo con deep dive individual y radar',
        category: 'Vistas',
        badge: 'Vista',
        icon: '🏢',
        action: () => {
          onSwitchTab('proyectos')
          onClose()
        },
      },
      {
        id: 'view_geo',
        title: 'Mapa Geoespacial',
        subtitle: 'Distribución geográfica, polígonos y ubicaciones',
        category: 'Vistas',
        badge: 'Vista',
        icon: '🗺️',
        action: () => {
          onSwitchTab('geoespacial')
          onClose()
        },
      },
    ]

    // 2. Quick City Switch
    const cities: CommandItem[] = [
      {
        id: 'city_scz',
        title: 'Filtrar por Santa Cruz (SCZ)',
        subtitle: currentCiudad === 'SCZ' ? 'Actualmente seleccionado' : 'Cambiar foco a mercado Santa Cruz',
        category: 'Ciudades',
        badge: 'Ciudad',
        icon: '📍',
        action: () => {
          onSelectCiudad('SCZ')
          onClose()
        },
      },
      {
        id: 'city_lpz',
        title: 'Filtrar por La Paz (LPZ)',
        subtitle: currentCiudad === 'LPZ' ? 'Actualmente seleccionado' : 'Cambiar foco a mercado La Paz',
        category: 'Ciudades',
        badge: 'Ciudad',
        icon: '📍',
        action: () => {
          onSelectCiudad('LPZ')
          onClose()
        },
      },
      {
        id: 'city_cbb',
        title: 'Filtrar por Cochabamba (CBB)',
        subtitle: currentCiudad === 'CBB' ? 'Actualmente seleccionado' : 'Cambiar foco a mercado Cochabamba',
        category: 'Ciudades',
        badge: 'Ciudad',
        icon: '📍',
        action: () => {
          onSelectCiudad('CBB')
          onClose()
        },
      },
      {
        id: 'city_all',
        title: 'Ver Todo Bolivia (Consolidado)',
        subtitle: currentCiudad === 'ALL' ? 'Actualmente seleccionado' : 'Consolidar las 3 ciudades principales',
        category: 'Ciudades',
        badge: 'Nacional',
        icon: '🇧🇴',
        action: () => {
          onSelectCiudad('ALL')
          onClose()
        },
      },
    ]

    // 3. Zones matching query
    const matchedZonas: CommandItem[] = zonas
      .filter((z) => !q || z.toLowerCase().includes(q))
      .slice(0, 5)
      .map((z) => ({
        id: `zona_${z}`,
        title: `Zona: ${z}`,
        subtitle: `Filtrar análisis por la zona ${z}`,
        category: 'Zonas',
        badge: 'Zona',
        icon: '📌',
        action: () => {
          onSelectZona(z)
          onClose()
        },
      }))

    // 4. Projects matching query
    const matchedProjects: CommandItem[] = indicadores
      .filter((p) => {
        if (!q) return true
        return (
          p.proyecto.toLowerCase().includes(q) ||
          (p.ZONAS && p.ZONAS.toLowerCase().includes(q)) ||
          (p.desarrollador && p.desarrollador.toLowerCase().includes(q))
        )
      })
      .slice(0, 15)
      .map((p) => ({
        id: `proj_${p.proyecto_id}`,
        title: p.proyecto,
        subtitle: `${p.ciudad} · Zona: ${p.ZONAS || '—'} · Etapa: ${p.etapa || '—'} · Stock: ${p.und_por_vender ?? 0} unds`,
        category: 'Proyectos',
        badge: p.ciudad,
        icon: '🏢',
        action: () => {
          onSelectProject(p)
          onClose()
        },
      }))

    // Filter view & cities if query present
    const filteredViews = views.filter((v) => !q || v.title.toLowerCase().includes(q) || v.subtitle?.toLowerCase().includes(q))
    const filteredCities = cities.filter((c) => !q || c.title.toLowerCase().includes(q) || c.subtitle?.toLowerCase().includes(q))

    // Assemble ordered
    result.push(...filteredViews)
    if (q) {
      result.push(...matchedProjects)
      result.push(...matchedZonas)
      result.push(...filteredCities)
    } else {
      result.push(...matchedProjects.slice(0, 8))
      result.push(...filteredCities)
      result.push(...matchedZonas.slice(0, 4))
    }

    return result
  }, [query, indicadores, currentCiudad, zonas, onSelectProject, onSelectCiudad, onSelectZona, onSwitchTab, onOpenApp, onClose])

  useEffect(() => {
    setSelectedIndex(0)
  }, [query])

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex((prev) => (prev + 1) % (items.length || 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex((prev) => (prev - 1 + items.length) % (items.length || 1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (items[selectedIndex]) {
        items[selectedIndex].action()
      }
    } else if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
    }
  }

  if (!isOpen) return null

  return (
    <div
      className="cmd-palette-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}>
      <div className="cmd-palette-modal" onKeyDown={handleKeyDown}>
        {/* Search Input Bar */}
        <div className="cmd-palette-search-bar">
          <span className="cmd-palette-icon">⌘</span>
          <input
            ref={inputRef}
            type="text"
            className="cmd-palette-input"
            placeholder="Buscar proyecto, zona, desarrollador o comando..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <kbd className="cmd-palette-kbd">ESC</kbd>
        </div>

        {/* Results List */}
        <div className="cmd-palette-list" ref={listRef}>
          {items.length === 0 ? (
            <div className="cmd-palette-empty">
              No se encontraron proyectos, zonas ni comandos que coincidan con "{query}".
            </div>
          ) : (
            items.map((item, idx) => {
              const isSelected = idx === selectedIndex
              return (
                <div
                  key={item.id}
                  className={`cmd-palette-item ${isSelected ? 'selected' : ''}`}
                  onClick={() => item.action()}
                  onMouseEnter={() => setSelectedIndex(idx)}>
                  <div className="cmd-item-icon">{item.icon}</div>
                  <div className="cmd-item-content">
                    <div className="cmd-item-title-row">
                      <span className="cmd-item-title">{item.title}</span>
                      {item.badge && <span className="cmd-item-badge">{item.badge}</span>}
                    </div>
                    {item.subtitle && <div className="cmd-item-subtitle">{item.subtitle}</div>}
                  </div>
                  {isSelected && <span className="cmd-item-enter">↵</span>}
                </div>
              )
            })
          )}
        </div>

        {/* Footer shortcuts */}
        <div className="cmd-palette-footer">
          <div className="cmd-footer-keys">
            <span><kbd>↑</kbd> <kbd>↓</kbd> Navegar</span>
            <span><kbd>↵</kbd> Seleccionar</span>
            <span><kbd>ESC</kbd> Cerrar</span>
          </div>
          <div className="cmd-footer-brand">
            CITRINO <strong>WORKSPACE OS</strong>
          </div>
        </div>
      </div>
    </div>
  )
}
