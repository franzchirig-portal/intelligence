import { useState, useEffect } from 'react'
import './index.css'
import LeftSidebar, { IconAssistant, type PanelId } from './components/LeftSidebar'
import AnalysisPanel from './components/AnalysisPanel'
import WorkspacePanel from './components/WorkspacePanel'
import TipologiasPanel from './components/TipologiasPanel'
import GeoespacialPanel from './components/GeoespacialPanel'
import WorkspaceOSPanel from './components/WorkspaceOSPanel'
import CommandPalette from './components/CommandPalette'
import AuthScreen from './components/AuthScreen'
import { supabase, fetchIndicadores, getLatestPerProject } from './lib/supabase'
import type { IndicadorFull } from './lib/supabase'

type Ciudad = 'SCZ' | 'LPZ' | 'CBB' | 'ALL'
type Tab = 'workspace_os' | 'mercado' | 'tipologias' | 'proyectos' | 'geoespacial'

const CIUDAD_LABELS: Record<Ciudad, string> = {
  SCZ: 'Santa Cruz',
  LPZ: 'La Paz',
  CBB: 'Cochabamba',
  ALL: 'Bolivia',
}

const TABS: { id: Tab; label: string }[] = [
  { id: 'mercado',     label: '01 · Oferta Nueva' },
  { id: 'tipologias', label: '01-E · Tipologías' },
  { id: 'proyectos',  label: 'Proyectos' },
  { id: 'geoespacial',label: 'Geoespacial' },
]

export default function App() {
  const [session, setSession] = useState<any>(null)
  const [guestMode, setGuestMode] = useState<boolean>(false)
  const [authLoading, setAuthLoading] = useState(true)

  const [ciudad, setCiudad] = useState<Ciudad>('SCZ')
  const [activeTab, setActiveTab] = useState<Tab>('mercado')
  const [selectedIndicador, setSelectedIndicador] = useState<IndicadorFull | null>(null)

  // Citrino Global Filters
  const [zonaFilter, setZonaFilter] = useState<string>('ALL')
  const [selectedEtapas, setSelectedEtapas] = useState<string[]>([])
  const [availableZonas, setAvailableZonas] = useState<string[]>([])
  const [availableEtapas, setAvailableEtapas] = useState<string[]>([])
  const [etapaCounts, setEtapaCounts] = useState<Record<string, number>>({})

  // Workspace OS & Command Palette States
  const [isCmdOpen, setIsCmdOpen] = useState(false)
  const [osInitialApp, setOsInitialApp] = useState<string>('mission')
  const [allIndicadoresForCmd, setAllIndicadoresForCmd] = useState<IndicadorFull[]>([])

  // Theme State: 'dark' (Nocturno) | 'light' (Diurno)
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    const saved = localStorage.getItem('citrino_theme')
    return (saved === 'light' || saved === 'dark') ? saved : 'dark'
  })

  // Left sidebar — panel to force open (triggered by topbar button)
  const [forcedLeftPanel, setForcedLeftPanel] = useState<PanelId>(null)
  const [activeLeftPanel, setActiveLeftPanel] = useState<PanelId>(null)

  const toggleAssistant = () => {
    if (activeLeftPanel === 'assistant') {
      setForcedLeftPanel('close')
    } else {
      setForcedLeftPanel('assistant')
    }
  }

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('citrino_theme', theme)
  }, [theme])

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))
  }

  // Auth Session Listener
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setAuthLoading(false)
    }).catch(() => {
      setAuthLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setAuthLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    fetchIndicadores(ciudad === 'ALL' ? undefined : ciudad).then((inds) => {
      const latest = getLatestPerProject(inds)
      setAllIndicadoresForCmd(latest)
      const zonas = Array.from(new Set(latest.map((p) => p.ZONAS).filter((z): z is string => Boolean(z && z.trim()))))
      zonas.sort()
      setAvailableZonas(zonas)

      const etapas = Array.from(new Set(latest.map((p) => p.etapa).filter((e): e is string => Boolean(e && e.trim()))))
      etapas.sort()
      setAvailableEtapas(etapas)

      const counts: Record<string, number> = {}
      for (const p of latest) {
        if (p.etapa) {
          counts[p.etapa] = (counts[p.etapa] || 0) + 1
        }
      }
      setEtapaCounts(counts)
    }).catch(console.error)
  }, [ciudad])

  // Global Command Palette Shortcut (Cmd+K / Ctrl+K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setIsCmdOpen((prev) => !prev)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const handleCiudadChange = (c: Ciudad) => {
    setCiudad(c)
    setSelectedIndicador(null)
    setZonaFilter('ALL')
    setSelectedEtapas([])
  }

  const resetFilters = () => {
    setZonaFilter('ALL')
    setSelectedEtapas([])
    setSelectedIndicador(null)
  }

  if (authLoading) {
    return (
      <div style={{
        height: '100vh',
        width: '100vw',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg-base, #040a0d)',
        gap: 12,
      }}>
        <div className="loading-shimmer" style={{ width: 180, height: 18 }} />
        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Iniciando Citrino Platform...</div>
      </div>
    )
  }

  if (!session && !guestMode) {
    return <AuthScreen onSuccess={() => setGuestMode(true)} />
  }

  return (
    <div className="app-shell">
      <header className="ide-topbar">
        {/* Left: Logo + Navigation Tabs */}
        <div className="ide-topbar-left">
          <div
            className="ide-topbar-logo"
            title="Citrino"
            onClick={() => setActiveTab('mercado')}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M 18.5 7.5 A 8 8 0 1 0 18.5 16.5" />
              <polygon points="12 8.5 15.5 12 12 15.5 8.5 12" />
            </svg>
          </div>

          <div className="ide-topbar-tabs">
            {TABS.map((t) => (
              <div
                key={t.id}
                className={`ide-tab ${activeTab === t.id ? 'active' : ''}`}
                onClick={() => setActiveTab(t.id)}
              >
                <span>{t.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Center: Institutional Title */}
        <div className="ide-topbar-center">
          proyecto intelligence · Antigravity IDE · {TABS.find(t => t.id === activeTab)?.label || 'Bolivia Platform'}
        </div>

        {/* Right: Quick Command + Cities + Theme + AI + User + Window Controls */}
        <div className="ide-topbar-right">
          <button
            className="topbar-cmd-btn"
            onClick={() => setIsCmdOpen(true)}
            title="Abrir Command Palette (Ctrl+K / Cmd+K)">
            <span className="topbar-cmd-badge">⌘K</span>
            <span className="topbar-cmd-text">Buscar o comando...</span>
          </button>

          <div className="topbar-right" style={{ marginLeft: 0 }}>
            {(['SCZ', 'LPZ', 'CBB', 'ALL'] as Ciudad[]).map((c) => (
              <button
                key={c}
                className={`city-badge ${c.toLowerCase()} ${ciudad === c ? 'active' : ''}`}
                onClick={() => handleCiudadChange(c)}>
                {c === 'ALL' ? 'Bolivia' : c}
              </button>
            ))}
          </div>

          <div className="topbar-divider" />

          <button
            className="theme-toggle-btn"
            onClick={toggleTheme}
            title={theme === 'dark' ? 'Cambiar a Modo Diurno' : 'Cambiar a Modo Nocturno'}
          >
            {theme === 'dark' ? (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="5"/>
                <line x1="12" y1="1" x2="12" y2="3"/>
                <line x1="12" y1="21" x2="12" y2="23"/>
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
                <line x1="1" y1="12" x2="3" y2="12"/>
                <line x1="21" y1="12" x2="23" y2="12"/>
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
              </svg>
            ) : (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
              </svg>
            )}
          </button>

          <button
            className={`topbar-icon-btn ${activeLeftPanel === 'assistant' ? 'active' : ''}`}
            onClick={toggleAssistant}
            title={activeLeftPanel === 'assistant' ? 'Cerrar IA Asistente' : 'Abrir IA Asistente'}
          >
            <IconAssistant />
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              background: 'var(--bg-card)',
              border: '1px solid var(--border-default)',
              borderRadius: 4,
              padding: '3px 10px',
              fontSize: 11,
              color: 'var(--text-secondary)',
            }}>
              <span style={{ maxWidth: 130, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 600, color: 'var(--text-primary)' }}>
                {session?.user?.user_metadata?.full_name || session?.user?.email || 'Usuario Invitado'}
              </span>
            </div>

            <button
              onClick={async () => {
                await supabase.auth.signOut().catch(() => {})
                setSession(null)
                setGuestMode(false)
              }}
              title="Cerrar sesión"
              style={{
                background: 'transparent',
                border: '1px solid var(--border-default)',
                color: 'var(--text-muted)',
                borderRadius: 4,
                padding: '3px 7px',
                fontSize: 10,
                cursor: 'pointer',
              }}
            >
              Salir
            </button>
          </div>

          <div className="topbar-divider" />

          <button className="ide-window-btn" title="Toggle Primary Side Bar">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18"/></svg>
          </button>
          <button className="ide-window-btn" title="Toggle Secondary Side Bar">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M15 3v18"/></svg>
          </button>
          <button className="ide-window-btn" title="Minimizar">―</button>
          <button className="ide-window-btn" title="Maximizar">□</button>
          <button className="ide-window-btn close" title="Cerrar">✕</button>
        </div>
      </header>

      {/* Workspace OS (Modular Command Center) */}
      {activeTab === 'workspace_os' && (
        <main className="workspace">
          <LeftSidebar
            ciudad={ciudad}
            activeTab={activeTab}
            onFilterZona={setZonaFilter}
            onFilterEtapas={setSelectedEtapas}
            onSelectIndicador={setSelectedIndicador}
            onSwitchTab={setActiveTab}
            forcedPanel={forcedLeftPanel}
            onForcedPanelConsumed={() => setForcedLeftPanel(null)}
            onPanelChange={setActiveLeftPanel}
          />
          <div style={{ flex: 1, overflow: 'hidden', height: '100%', display: 'flex', flexDirection: 'column' }}>
            <WorkspaceOSPanel
              ciudad={ciudad}
              zonaFilter={zonaFilter}
              etapaFilter={selectedEtapas}
              selectedIndicador={selectedIndicador}
              onSelectIndicador={setSelectedIndicador}
              onSwitchTab={setActiveTab}
              initialApp={osInitialApp}
              onOpenCommandPalette={() => setIsCmdOpen(true)}
              theme={theme}
            />
          </div>
        </main>
      )}

      {/* 3-Panel Workspace — Mercado tab (main) */}
      {activeTab === 'mercado' && (
        <main className="workspace">
          <LeftSidebar
            ciudad={ciudad}
            activeTab={activeTab}
            onFilterZona={setZonaFilter}
            onFilterEtapas={setSelectedEtapas}
            onSelectIndicador={setSelectedIndicador}
            onSwitchTab={setActiveTab}
            forcedPanel={forcedLeftPanel}
            onForcedPanelConsumed={() => setForcedLeftPanel(null)}
            onPanelChange={setActiveLeftPanel}
          />
          <WorkspacePanel
            ciudad={ciudad}
            zonaFilter={zonaFilter}
            etapaFilter={selectedEtapas}
            selectedIndicador={selectedIndicador}
            onSelectIndicador={setSelectedIndicador}
          />
          <AnalysisPanel
            selectedIndicador={selectedIndicador}
            ciudad={ciudad}
            onClearSelection={() => setSelectedIndicador(null)}
          />
        </main>
      )}

      {/* Proyectos tab */}
      {activeTab === 'proyectos' && (
        <main className="workspace">
          <LeftSidebar
            ciudad={ciudad}
            activeTab={activeTab}
            onFilterZona={setZonaFilter}
            onFilterEtapas={setSelectedEtapas}
            onSelectIndicador={setSelectedIndicador}
            onSwitchTab={setActiveTab}
            forcedPanel={forcedLeftPanel}
            onForcedPanelConsumed={() => setForcedLeftPanel(null)}
            onPanelChange={setActiveLeftPanel}
          />
          <WorkspacePanel
            ciudad={ciudad}
            zonaFilter={zonaFilter}
            etapaFilter={selectedEtapas}
            selectedIndicador={selectedIndicador}
            onSelectIndicador={setSelectedIndicador}
          />
          <AnalysisPanel
            selectedIndicador={selectedIndicador}
            ciudad={ciudad}
            onClearSelection={() => setSelectedIndicador(null)}
          />
        </main>
      )}

      {/* Tipologías tab */}
      {activeTab === 'tipologias' && (
        <main className="workspace">
          <LeftSidebar
            ciudad={ciudad}
            activeTab={activeTab}
            onFilterZona={setZonaFilter}
            onFilterEtapas={setSelectedEtapas}
            onSelectIndicador={setSelectedIndicador}
            onSwitchTab={setActiveTab}
            forcedPanel={forcedLeftPanel}
            onForcedPanelConsumed={() => setForcedLeftPanel(null)}
            onPanelChange={setActiveLeftPanel}
          />
          <TipologiasPanel
            ciudad={ciudad}
            etapaFilter={selectedEtapas}
            selectedIndicador={selectedIndicador}
            onSelectIndicador={setSelectedIndicador}
          />
          <AnalysisPanel
            selectedIndicador={selectedIndicador}
            ciudad={ciudad}
            onClearSelection={() => setSelectedIndicador(null)}
          />
        </main>
      )}

      {/* Geoespacial tab */}
      {activeTab === 'geoespacial' && (
        <main className="workspace">
          <LeftSidebar
            ciudad={ciudad}
            activeTab={activeTab}
            onFilterZona={setZonaFilter}
            onFilterEtapas={setSelectedEtapas}
            onSelectIndicador={setSelectedIndicador}
            onSwitchTab={setActiveTab}
            forcedPanel={forcedLeftPanel}
            onForcedPanelConsumed={() => setForcedLeftPanel(null)}
            onPanelChange={setActiveLeftPanel}
          />
          <GeoespacialPanel
            ciudad={ciudad}
            zonaFilter={zonaFilter}
            etapaFilter={selectedEtapas}
            selectedIndicador={selectedIndicador}
            onSelectIndicador={setSelectedIndicador}
            theme={theme}
          />
          <AnalysisPanel
            selectedIndicador={selectedIndicador}
            ciudad={ciudad}
            onClearSelection={() => setSelectedIndicador(null)}
          />
        </main>
      )}

      {/* Status Bar (Antigravity IDE Style) */}
      <footer className="status-bar">
        <div className="status-bar-item" title="Git Branch: master">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
            <line x1="6" y1="3" x2="6" y2="15"/>
            <circle cx="18" cy="6" r="3"/>
            <circle cx="6" cy="18" r="3"/>
            <path d="M18 9a9 9 0 0 1-9 9"/>
          </svg>
          <span>master</span>
        </div>

        <div className="status-bar-divider" />

        <div className="status-bar-item" title="Estado de Supabase">
          <span>Supabase — Conectado</span>
        </div>

        <div className="status-bar-divider" />

        <div className="status-bar-item" title="Plataforma Citrino">
          <span>Bolivia Intelligence Platform v1.0</span>
        </div>

        <div className="status-bar-divider" />

        <div className="status-bar-item">
          <span>
            {selectedIndicador
              ? `Proyecto activo: ${selectedIndicador.proyecto}`
              : `Vista: ${CIUDAD_LABELS[ciudad]}`}
          </span>
        </div>

        <div style={{ marginLeft: 'auto' }}>
          <div className="status-bar-item" title="Sincronización automatizada Medallion">
            <span>Pipeline: ETL GitHub Actions · 6h sync</span>
          </div>
        </div>
      </footer>

      {/* Global Command Palette (Cmd+K / Ctrl+K) */}
      <CommandPalette
        isOpen={isCmdOpen}
        onClose={() => setIsCmdOpen(false)}
        indicadores={allIndicadoresForCmd}
        currentCiudad={ciudad}
        onSelectProject={(proj) => {
          setSelectedIndicador(proj)
          if (proj.ciudad && proj.ciudad !== ciudad) {
            handleCiudadChange(proj.ciudad as Ciudad)
          }
        }}
        onSelectCiudad={(c) => handleCiudadChange(c)}
        onSelectZona={(z) => setZonaFilter(z)}
        onSwitchTab={(t) => setActiveTab(t)}
        onOpenApp={(appId) => {
          setOsInitialApp(appId)
          setActiveTab('workspace_os')
        }}
      />
    </div>
  )
}
