import { useState, useEffect } from 'react'
import './index.css'
import ChatPanel from './components/ChatPanel'
import WorkspacePanel from './components/WorkspacePanel'
import TipologiasPanel from './components/TipologiasPanel'
import AnalysisPanel from './components/AnalysisPanel'
import GeoespacialPanel from './components/GeoespacialPanel'
import WorkspaceOSPanel from './components/WorkspaceOSPanel'
import CommandPalette from './components/CommandPalette'
import AuthScreen from './components/AuthScreen'
import MultiSelectDropdown from './components/MultiSelectDropdown'
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
  { id: 'workspace_os', label: '⚡ Workspace OS' },
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
  const [activeTab, setActiveTab] = useState<Tab>('workspace_os')
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
      {/* Top Bar */}
      <header className="topbar">
        {/* Citrino Brand Logo */}
        <div className="topbar-logo" style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10 }} onClick={() => setActiveTab('mercado')}>
          <div style={{
            width: 28, height: 28, borderRadius: 6,
            background: 'var(--citrino-dark)',
            border: '1px solid var(--citrino-teal-light)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 10px var(--citrino-glow)',
          }}>
            <svg width="18" height="18" viewBox="0 0 100 100" fill="none">
              <path d="M 50 10 A 40 40 0 1 0 85 75 L 70 65 A 25 25 0 1 1 50 25 Z" fill="#22d3ee" />
              <polygon points="50,38 60,50 50,62 40,50" fill="#14b8a6" />
            </svg>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.1 }}>
            <span style={{ fontWeight: 900, letterSpacing: 1.2, color: '#ffffff', fontSize: 14 }}>
              CITRINO
            </span>
            <span style={{ fontSize: 7.5, color: 'var(--citrino-teal-light)', fontWeight: 700, letterSpacing: 1.2, textTransform: 'uppercase' }}>
              Inteligencia Inmobiliaria
            </span>
          </div>
        </div>

        <div className="topbar-divider" />

        {/* Navigation Tabs */}
        <nav className="topbar-nav">
          {TABS.map((t) => (
            <div key={t.id}
              className={`topbar-nav-item ${activeTab === t.id ? 'active' : ''}`}
              onClick={() => setActiveTab(t.id)}>
              {t.label}
            </div>
          ))}
        </nav>

        {/* Command Palette Quick Search Button */}
        <button
          className="topbar-cmd-btn"
          onClick={() => setIsCmdOpen(true)}
          title="Abrir Command Palette (Ctrl+K / Cmd+K)">
          <span className="topbar-cmd-badge">⌘K</span>
          <span className="topbar-cmd-text">Buscar o comando...</span>
        </button>

        {/* Citrino Filters (Zona, Etapa & Reset) */}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Zona Filter Pill */}
          <div style={{ position: 'relative' }}>
            <select
              value={zonaFilter}
              onChange={(e) => setZonaFilter(e.target.value)}
              style={{
                background: 'var(--bg-card)',
                color: zonaFilter !== 'ALL' ? 'var(--citrino-accent)' : 'var(--text-secondary)',
                border: `1px solid ${zonaFilter !== 'ALL' ? 'var(--citrino-teal-light)' : 'var(--border-default)'}`,
                padding: '4px 10px',
                borderRadius: 20,
                fontSize: 11,
                fontWeight: 600,
                outline: 'none',
                cursor: 'pointer',
                boxShadow: zonaFilter !== 'ALL' ? '0 0 8px var(--citrino-glow)' : 'none',
              }}>
              <option value="ALL">📍 Zona: Todas ({availableZonas.length})</option>
              {availableZonas.map((z) => (
                <option key={z} value={z}>📍 {z}</option>
              ))}
            </select>
          </div>

          {/* Etapa Multi-Select Filter Pill */}
          <MultiSelectDropdown
            label="Etapa"
            icon="🏗️"
            options={availableEtapas}
            counts={etapaCounts}
            selected={selectedEtapas}
            onChange={(newSelected) => {
              setSelectedEtapas(newSelected)
              setSelectedIndicador(null)
            }}
          />

          {/* Reset Button */}
          {(zonaFilter !== 'ALL' || selectedEtapas.length > 0 || selectedIndicador) && (
            <button
              onClick={resetFilters}
              style={{
                background: 'transparent',
                border: '1px solid var(--border-default)',
                borderRadius: 20,
                color: 'var(--text-muted)',
                padding: '3px 10px',
                fontSize: 10.5,
                fontWeight: 600,
                cursor: 'pointer',
              }}
              title="Restablecer todos los filtros">
              ✕ Reset
            </button>
          )}

          <div className="topbar-divider" />

          {/* City Badges */}
          <div className="topbar-right" style={{ marginLeft: 0 }}>
            {(['SCZ', 'LPZ', 'CBB', 'ALL'] as Ciudad[]).map((c) => (
              <button key={c}
                className={`city-badge ${c.toLowerCase()} ${ciudad === c ? 'active' : ''}`}
                onClick={() => handleCiudadChange(c)}>
                <span className="dot" />
                {c === 'ALL' ? 'Bolivia' : c}
              </button>
            ))}
          </div>

          <div className="topbar-divider" />

          {/* User Profile & Logout */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              background: 'var(--bg-card)',
              border: '1px solid var(--border-default)',
              borderRadius: 20,
              padding: '3px 10px',
              fontSize: 11,
              color: 'var(--text-secondary)',
            }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--color-positive, #10b981)' }} />
              <span style={{ maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 600, color: 'var(--text-primary)' }}>
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
                borderRadius: 6,
                padding: '4px 8px',
                fontSize: 11,
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}>
              Salir ⎋
            </button>
          </div>
        </div>
      </header>

      {/* Workspace OS tab (Modular Command Center) */}
      {activeTab === 'workspace_os' && (
        <main className="workspace-os-wrapper">
          <WorkspaceOSPanel
            ciudad={ciudad}
            zonaFilter={zonaFilter}
            etapaFilter={selectedEtapas}
            selectedIndicador={selectedIndicador}
            onSelectIndicador={setSelectedIndicador}
            onSwitchTab={setActiveTab}
            initialApp={osInitialApp}
            onOpenCommandPalette={() => setIsCmdOpen(true)}
          />
        </main>
      )}

      {/* 3-Panel Workspace — Mercado tab (main) */}
      {activeTab === 'mercado' && (
        <main className="workspace">
          <ChatPanel
            ciudad={ciudad}
            onFilterZona={setZonaFilter}
            onFilterEtapas={setSelectedEtapas}
            onSelectIndicador={setSelectedIndicador}
            onSwitchTab={setActiveTab}
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
          <ChatPanel
            ciudad={ciudad}
            onFilterZona={setZonaFilter}
            onFilterEtapas={setSelectedEtapas}
            onSelectIndicador={setSelectedIndicador}
            onSwitchTab={setActiveTab}
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
          <ChatPanel
            ciudad={ciudad}
            onFilterZona={setZonaFilter}
            onFilterEtapas={setSelectedEtapas}
            onSelectIndicador={setSelectedIndicador}
            onSwitchTab={setActiveTab}
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
          <ChatPanel
            ciudad={ciudad}
            onFilterZona={setZonaFilter}
            onFilterEtapas={setSelectedEtapas}
            onSelectIndicador={setSelectedIndicador}
            onSwitchTab={setActiveTab}
          />
          <GeoespacialPanel
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

      {/* Status Bar */}
      <footer className="status-bar">
        <div className="status-dot" />
        <span>Supabase — Conectado</span>
        <span style={{ color: 'var(--border-bright)' }}>|</span>
        <span>Bolivia Intelligence Platform v1.0</span>
        <span style={{ color: 'var(--border-bright)' }}>|</span>
        <span>
          {selectedIndicador
            ? `Proyecto activo: ${selectedIndicador.proyecto}`
            : `Vista: ${CIUDAD_LABELS[ciudad]}`}
        </span>
        <div style={{ marginLeft: 'auto', color: 'var(--text-muted)' }}>
          Pipeline: ETL GitHub Actions · 6h sync
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
