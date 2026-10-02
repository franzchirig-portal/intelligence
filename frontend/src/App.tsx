import { useState, useEffect, useRef } from 'react'
import './index.css'
import { IconAssistant } from './components/LeftSidebar'
import ChatPanel from './components/ChatPanel'
import AnalysisPanel from './components/AnalysisPanel'
import WorkspacePanel from './components/WorkspacePanel'
import TipologiasPanel from './components/TipologiasPanel'
import GeoespacialPanel from './components/GeoespacialPanel'
import WorkspaceOSPanel from './components/WorkspaceOSPanel'
import AuthScreen from './components/AuthScreen'
import LeftAnalyticsBar from './components/LeftAnalyticsBar'
import SubHeader, { type Tab } from './components/SubHeader'
import FilterBar from './components/FilterBar'
import HipotecarioPanel from './components/HipotecarioPanel'
import ChapterDossierPanel from './components/ChapterDossierPanel'
import { supabase } from './lib/supabase'
import { fetchPeriodos } from './lib/supabase'
import type { IndicadorFull } from './lib/supabase'
import citrinoLogoLight from './assets/citrino-full-logo-cropped.png'
import citrinoLogoDark from './assets/citrino-full-logo-dark.png'
import './mobile.css'

/* ─── Icons ──────────────────────────────────────────────────────────────── */
const IconUser = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
)

const IconSwitchUser = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
)

const IconLogout = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <polyline points="16 17 21 12 16 7" />
    <line x1="21" y1="12" x2="9" y2="12" />
  </svg>
)

const IconAnalysis = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <path d="M3 9h18" />
    <path d="M9 21V9" />
  </svg>
)

/* ─── Types ──────────────────────────────────────────────────────────────── */
type Ciudad = 'SCZ' | 'LPZ' | 'CBB' | 'ALL'

const CIUDAD_LABELS: Record<Ciudad, string> = {
  SCZ: 'Santa Cruz',
  LPZ: 'La Paz',
  CBB: 'Cochabamba',
  ALL: 'Bolivia (Nacional)',
}

export default function App() {
  const [session, setSession] = useState<any>(null)
  const [guestMode, setGuestMode] = useState<boolean>(true)
  const [authLoading, setAuthLoading] = useState(true)

  // Navigation state
  const [ciudad, setCiudad] = useState<Ciudad>('SCZ')
  const [activeTab, setActiveTab] = useState<Tab>('resumen_general')
  const [activeChapter, setActiveChapter] = useState<string>('1.1')
  const [selectedIndicador, setSelectedIndicador] = useState<IndicadorFull | null>(null)

  // Analysis panel toggle
  const [analysisOpen, setAnalysisOpen] = useState(false)

  // ── Global Filters ──────────────────────────────────────────────────────
  const [periodoFilter, setPeriodoFilter] = useState<string>('ALL')
  const [periodos, setPeriodos] = useState<string[]>([])
  const [moneda, setMoneda] = useState<'USD' | 'BS'>('USD')
  const [zonaFilter, setZonaFilter] = useState<string>('ALL')
  const [subzonaFilter, setSubzonaFilter] = useState<string>('ALL')
  const [tipoInmuebleFilter, setTipoInmuebleFilter] = useState<string>('ALL')
  const [etapaFilter, setEtapaFilter] = useState<string>('ALL')
  const [tipologiaFilter, setTipologiaFilter] = useState<string>('ALL')
  // Legacy: kept for chat compatibility
  const [selectedEtapas, setSelectedEtapas] = useState<string[]>([])

  // Theme
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    const saved = localStorage.getItem('citrino_theme_v2')
    return (saved === 'light' || saved === 'dark') ? saved : 'light'
  })

  // Chat
  const [chatOpen, setChatOpen] = useState(false)

  // Profile dropdown
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false)
  // Móvil: drawer de capítulos o bottom-sheet de filtros
  const [mobileSheet, setMobileSheet] = useState<'none' | 'menu' | 'filters'>('none')
  const profileMenuRef = useRef<HTMLDivElement>(null)

  // ── Effects ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
        setIsProfileMenuOpen(false)
      }
    }
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsProfileMenuOpen(false)
    }
    if (isProfileMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      document.addEventListener('keydown', handleKeyDown)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isProfileMenuOpen])

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('citrino_theme_v2', theme)
  }, [theme])

  // Load periodo options whenever city changes
  useEffect(() => {
    fetchPeriodos(ciudad).then(setPeriodos).catch(() => setPeriodos([]))
    setPeriodoFilter('ALL')
  }, [ciudad])

  // Auth session listener
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

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleCiudadChange = (c: Ciudad) => {
    setCiudad(c)
    setSelectedIndicador(null)
    setZonaFilter('ALL')
    setSubzonaFilter('ALL')
    setTipoInmuebleFilter('ALL')
    setEtapaFilter('ALL')
    setTipologiaFilter('ALL')
    setSelectedEtapas([])
  }

  const handleClearFilters = () => {
    setZonaFilter('ALL')
    setSubzonaFilter('ALL')
    setTipoInmuebleFilter('ALL')
    setEtapaFilter('ALL')
    setTipologiaFilter('ALL')
    setSelectedEtapas([])
  }

  const toggleTheme = () => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))

  const handleSelectChapter = (chapterId: string, _sectionId: string) => {
    setActiveChapter(chapterId)
    setMobileSheet('none')
    if (chapterId === '1.1' || chapterId === '1.2') {
      const chapter1Tabs: Tab[] = [
        'proyectos',
        'tipologias',
        'geoespacial',
        'resumen_general',
        'stock_unidades',
        'stock_usd',
        'ritmo_ventas',
        'meses_stock',
        'analisis_producto',
      ]
      if (!chapter1Tabs.includes(activeTab)) {
        setActiveTab('resumen_general')
      }
    } else if (chapterId === '5.1') {
      setActiveTab('geoespacial')
    } else {
      setActiveTab('chapter_dossier')
    }
  }

  const handleSubTabChange = (t: Tab) => {
    setActiveTab(t)
    setMobileSheet('none')
    if (
      t === 'proyectos' ||
      t === 'resumen_general' ||
      t === 'stock_unidades' ||
      t === 'stock_usd' ||
      t === 'ritmo_ventas' ||
      t === 'meses_stock' ||
      t === 'analisis_producto'
    ) {
      setActiveChapter('1.1')
    } else if (t === 'tipologias') {
      setActiveChapter('3.1')
    } else if (t === 'geoespacial') {
      setActiveChapter('5.1')
    }
  }

  // Format a raw fecha_snapshot (YYYY-MM-DD) for display (DD/MM/YYYY)
  const formatPeriodo = (d: string) => {
    if (!d || d === 'ALL') return 'Todos los períodos'
    const [y, m, dd] = d.split('-')
    return `${dd}/${m}/${y}`
  }

  // Selector de periodo: en la topbar (escritorio) y en el menú móvil
  const periodoControl = (
    <div className="topbar-periodo-wrapper">
      <label className="topbar-filter-label">Periodo</label>
      <select
        className="topbar-periodo-select"
        value={periodoFilter}
        onChange={(e) => setPeriodoFilter(e.target.value)}
        aria-label="Filtrar por período"
      >
        <option value="ALL">Todos</option>
        {periodos.map((p) => (
          <option key={p} value={p}>{formatPeriodo(p)}</option>
        ))}
      </select>
    </div>
  )

  // ── Loading & Auth guards ─────────────────────────────────────────────────
  if (authLoading) {
    return (
      <div style={{
        height: '100vh', width: '100vw', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', background: 'var(--bg-base)', gap: 12,
      }}>
        <div className="loading-shimmer" style={{ width: 180, height: 18 }} />
        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Iniciando Citrino…</div>
      </div>
    )
  }

  if (!session && !guestMode) {
    return <AuthScreen onSuccess={() => setGuestMode(true)} />
  }

  const etapaFilterArr = etapaFilter !== 'ALL' ? [etapaFilter] : selectedEtapas

  return (
    <div className={`app-shell mobile-sheet-${mobileSheet}`}>
      {mobileSheet !== 'none' && (
        <div className="mobile-backdrop" onClick={() => setMobileSheet('none')} aria-hidden="true" />
      )}

      {/* ── Header 1: Principal (HeaderSidebar) ─────────────────────────── */}
      <header className="ide-topbar">
        {/* Left: Logo */}
        <div className="ide-topbar-left">
          <button
            type="button"
            className="ide-topbar-logo"
            title="Citrino — Inicio"
            aria-label="Citrino Capitales Inmobiliarios"
            onClick={() => setActiveTab('proyectos')}
          >
            <img
              src={theme === 'dark' ? citrinoLogoDark : citrinoLogoLight}
              alt="Citrino Capitales Inmobiliarios"
              className="citrino-header-logo-img"
            />
          </button>
        </div>

        {/* Right: Cities + Periodo + Moneda + Analysis + Chat + Theme + User */}
        <div className="ide-topbar-right">
          {/* City selector: nombres completos y sin cuadros */}
          <div className="topbar-cities-wrapper">
            {[
              { id: 'SCZ', label: 'Santa Cruz' },
              { id: 'LPZ', label: 'La Paz' },
              { id: 'CBB', label: 'Cochabamba' },
              { id: 'ALL', label: 'Bolivia' },
            ].map(({ id, label }) => (
              <button
                key={id}
                type="button"
                className={`topbar-city-link ${ciudad === id ? 'active' : ''}`}
                aria-pressed={ciudad === id}
                onClick={() => handleCiudadChange(id as Ciudad)}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="topbar-divider" />

          {/* Periodo selector */}
          {periodoControl}

          {/* Moneda toggle (sin recuadros) */}
          <div className="topbar-moneda-wrapper">
            <button
              type="button"
              className={`topbar-moneda-btn ${moneda === 'USD' ? 'active' : ''}`}
              onClick={() => setMoneda('USD')}
              aria-pressed={moneda === 'USD'}
              title="Mostrar en dólares (USD)"
            >
              USD
            </button>
            <span className="topbar-moneda-sep">/</span>
            <button
              type="button"
              className={`topbar-moneda-btn ${moneda === 'BS' ? 'active' : ''} disabled-soon`}
              onClick={() => setMoneda('BS')}
              aria-pressed={moneda === 'BS'}
              title="Bolivianos — Próximamente"
            >
              Bs
              <span className="moneda-soon-dot" />
            </button>
          </div>

          <div className="topbar-divider" />

          {/* Analysis & Diagnóstico toggle (texto simple que resalta) */}
          <button
            type="button"
            className={`topbar-text-btn ${analysisOpen ? 'active' : ''}`}
            onClick={() => setAnalysisOpen((v) => !v)}
            aria-label={analysisOpen ? 'Cerrar análisis y diagnóstico' : 'Abrir análisis y diagnóstico'}
            aria-pressed={analysisOpen}
            title={analysisOpen ? 'Cerrar análisis y diagnóstico' : 'Análisis y diagnóstico'}
          >
            Análisis y Diagnóstico
          </button>

          {/* Chat assistant (texto simple que resalta) */}
          <button
            type="button"
            className={`topbar-text-btn ${chatOpen ? 'active' : ''}`}
            onClick={() => setChatOpen((v) => !v)}
            aria-label={chatOpen ? 'Cerrar Asistente AI' : 'Abrir Asistente AI'}
            aria-pressed={chatOpen}
            title={chatOpen ? 'Cerrar Asistente AI' : 'Asistente AI'}
          >
            Asistente AI
          </button>

          <div className="topbar-divider" />

          {/* Profile menu */}
          <div className="topbar-profile-wrapper" ref={profileMenuRef}>
            <button
              className={`topbar-profile-btn ${isProfileMenuOpen ? 'active' : ''}`}
              onClick={() => setIsProfileMenuOpen((prev) => !prev)}
              title={session?.user?.user_metadata?.full_name || session?.user?.email || 'Perfil (Invitado)'}
              aria-label="Perfil de usuario"
            >
              <IconUser />
            </button>

            {isProfileMenuOpen && (
              <div className="topbar-profile-dropdown">
                <div className="profile-dropdown-header">
                  <div className="profile-dropdown-avatar">
                    {session?.user
                      ? (session.user.user_metadata?.full_name?.[0] || session.user.email?.[0] || 'U').toUpperCase()
                      : 'I'}
                  </div>
                  <div className="profile-dropdown-info">
                    <span className="profile-dropdown-name">
                      {session?.user
                        ? (session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || 'Usuario Registrado')
                        : 'Invitado'}
                    </span>
                    <span className="profile-dropdown-role">
                      {session?.user?.email || 'Modo Demostración'}
                    </span>
                  </div>
                </div>

                <div className="profile-dropdown-divider" />

                <button
                  type="button"
                  className="profile-dropdown-item"
                  onClick={async () => {
                    setIsProfileMenuOpen(false)
                    await supabase.auth.signOut().catch(() => {})
                    setSession(null)
                    setGuestMode(false)
                  }}
                  title="Iniciar sesión con otra cuenta"
                >
                  <IconSwitchUser />
                  <span>Cambiar de usuario</span>
                </button>

                {/* Modo diurno/nocturno integrado en el menú de usuario */}
                <button
                  type="button"
                  className="profile-dropdown-item"
                  onClick={toggleTheme}
                  title={theme === 'dark' ? 'Cambiar a modo diurno' : 'Cambiar a modo nocturno'}
                >
                  {theme === 'dark' ? (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
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
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
                    </svg>
                  )}
                  <span>{theme === 'dark' ? 'Modo diurno' : 'Modo nocturno'}</span>
                </button>

                <button
                  type="button"
                  className="profile-dropdown-item danger"
                  onClick={async () => {
                    setIsProfileMenuOpen(false)
                    await supabase.auth.signOut().catch(() => {})
                    setSession(null)
                    setGuestMode(false)
                  }}
                  title="Cerrar la sesión actual"
                >
                  <IconLogout />
                  <span>Salir / Cerrar sesión</span>
                </button>
              </div>
            )}
          </div>
        </div>

        <button
          type="button"
          className="mobile-only mobile-icon-btn mobile-menu-btn"
          aria-label={mobileSheet === 'menu' ? 'Cerrar menú' : 'Abrir menú'}
          aria-expanded={mobileSheet === 'menu'}
          onClick={() => setMobileSheet((m) => (m === 'menu' ? 'none' : 'menu'))}
        >
          {mobileSheet === 'menu' ? '✕' : '☰'}
        </button>
      </header>

      {/* ── Body: Analytics Bar + Main Workspace ────────────────────────── */}
      <div className="app-body">
        {/* Left Analytics Bar (se extiende hasta el topbar principal con capítulos desplegables) */}
        <div className="mobile-drawer">
          <div className="mobile-drawer-actions">
            {periodoControl}
            <button
              type="button"
              className={`mobile-drawer-btn ${analysisOpen ? 'active' : ''}`}
              onClick={() => { setAnalysisOpen((v) => !v); setMobileSheet('none') }}
            >
              Análisis y Diagnóstico
            </button>
            <button
              type="button"
              className={`mobile-drawer-btn ${chatOpen ? 'active' : ''}`}
              onClick={() => { setChatOpen((v) => !v); setMobileSheet('none') }}
            >
              Asistente AI
            </button>
          </div>
          <LeftAnalyticsBar
            activeChapter={activeChapter}
            onSelectChapter={handleSelectChapter}
          />
        </div>

        {/* Contenedor derecho: Fila de Paneles Analíticos + FilterBar delimitado con el Sidebar Izquierdo */}
        <div className="app-workspace-wrapper">
          <div className="app-panels-row">
            {/* Chat aside (desplegable directamente bajo el topbar principal) */}
            {chatOpen && (
              <aside className="chat-aside" aria-label="Asistente AI">
                <ChatPanel
                  ciudad={ciudad}
                  onFilterZona={setZonaFilter}
                  onFilterEtapas={setSelectedEtapas}
                  onSelectIndicador={setSelectedIndicador}
                  onSwitchTab={(t) => setActiveTab(t as Tab)}
                  isEmbedded
                />
              </aside>
            )}

            {/* Main workspace area */}
            <div className="app-main">
              {/* ── Header 2: Sub-header Azul (Módulos en el panel central) ─── */}
              <SubHeader activeTab={activeTab} onTabChange={handleSubTabChange} />

              {/* Panel content */}
              <div className="workspace">
                {activeTab === 'proyectos' && (
                  <WorkspacePanel
                    ciudad={ciudad}
                    zonaFilter={zonaFilter}
                    subzonaFilter={subzonaFilter}
                    tipoInmuebleFilter={tipoInmuebleFilter}
                    etapaFilter={etapaFilterArr}
                    periodoFilter={periodoFilter}
                    tipologiaFilter={tipologiaFilter}
                    moneda={moneda}
                    selectedIndicador={selectedIndicador}
                    onSelectIndicador={setSelectedIndicador}
                    theme={theme}
                  />
                )}

                {activeTab === 'resumen_general' && (
                  <WorkspacePanel
                    key="resumen_general"
                    ciudad={ciudad}
                    zonaFilter={zonaFilter}
                    subzonaFilter={subzonaFilter}
                    tipoInmuebleFilter={tipoInmuebleFilter}
                    etapaFilter={etapaFilterArr}
                    periodoFilter={periodoFilter}
                    tipologiaFilter={tipologiaFilter}
                    moneda={moneda}
                    selectedIndicador={selectedIndicador}
                    onSelectIndicador={setSelectedIndicador}
                    initialMetric="stock_zona"
                    kpiMode="resumen_general"
                    theme={theme}
                  />
                )}

                {activeTab === 'stock_unidades' && (
                  <WorkspacePanel
                    key="stock_unidades"
                    ciudad={ciudad}
                    zonaFilter={zonaFilter}
                    subzonaFilter={subzonaFilter}
                    tipoInmuebleFilter={tipoInmuebleFilter}
                    etapaFilter={etapaFilterArr}
                    periodoFilter={periodoFilter}
                    tipologiaFilter={tipologiaFilter}
                    moneda={moneda}
                    selectedIndicador={selectedIndicador}
                    onSelectIndicador={setSelectedIndicador}
                    initialMetric="stock_und_bar"
                    kpiMode="stock_unidades"
                    theme={theme}
                  />
                )}

                {activeTab === 'stock_usd' && (
                  <WorkspacePanel
                    key="stock_usd"
                    ciudad={ciudad}
                    zonaFilter={zonaFilter}
                    subzonaFilter={subzonaFilter}
                    tipoInmuebleFilter={tipoInmuebleFilter}
                    etapaFilter={etapaFilterArr}
                    periodoFilter={periodoFilter}
                    tipologiaFilter={tipologiaFilter}
                    moneda={moneda}
                    selectedIndicador={selectedIndicador}
                    onSelectIndicador={setSelectedIndicador}
                    initialMetric="stock_usd_bar"
                    kpiMode="stock_usd"
                    theme={theme}
                  />
                )}

                {activeTab === 'ritmo_ventas' && (
                  <WorkspacePanel
                    key="ritmo_ventas"
                    ciudad={ciudad}
                    zonaFilter={zonaFilter}
                    subzonaFilter={subzonaFilter}
                    tipoInmuebleFilter={tipoInmuebleFilter}
                    etapaFilter={etapaFilterArr}
                    periodoFilter={periodoFilter}
                    tipologiaFilter={tipologiaFilter}
                    moneda={moneda}
                    selectedIndicador={selectedIndicador}
                    onSelectIndicador={setSelectedIndicador}
                    initialMetric="ritmo_zona"
                    kpiMode="ritmo_ventas"
                    theme={theme}
                  />
                )}

                {activeTab === 'meses_stock' && (
                  <WorkspacePanel
                    key="meses_stock"
                    ciudad={ciudad}
                    zonaFilter={zonaFilter}
                    subzonaFilter={subzonaFilter}
                    tipoInmuebleFilter={tipoInmuebleFilter}
                    etapaFilter={etapaFilterArr}
                    periodoFilter={periodoFilter}
                    tipologiaFilter={tipologiaFilter}
                    moneda={moneda}
                    selectedIndicador={selectedIndicador}
                    onSelectIndicador={setSelectedIndicador}
                    initialMetric="meses_zona"
                    theme={theme}
                  />
                )}

                {activeTab === 'analisis_producto' && (
                  <TipologiasPanel
                    ciudad={ciudad}
                    zonaFilter={zonaFilter}
                    subzonaFilter={subzonaFilter}
                    tipoInmuebleFilter={tipoInmuebleFilter}
                    etapaFilter={etapaFilterArr}
                    periodoFilter={periodoFilter}
                    tipologiaFilter={tipologiaFilter}
                    moneda={moneda}
                    selectedIndicador={selectedIndicador}
                    onSelectIndicador={setSelectedIndicador}
                  />
                )}

                {activeTab === 'tipologias' && (
                  <TipologiasPanel
                    ciudad={ciudad}
                    zonaFilter={zonaFilter}
                    subzonaFilter={subzonaFilter}
                    tipoInmuebleFilter={tipoInmuebleFilter}
                    etapaFilter={etapaFilterArr}
                    periodoFilter={periodoFilter}
                    tipologiaFilter={tipologiaFilter}
                    moneda={moneda}
                    selectedIndicador={selectedIndicador}
                    onSelectIndicador={setSelectedIndicador}
                  />
                )}

                {activeTab === 'geoespacial' && (
                  <GeoespacialPanel
                    ciudad={ciudad}
                    zonaFilter={zonaFilter}
                    subzonaFilter={subzonaFilter}
                    tipoInmuebleFilter={tipoInmuebleFilter}
                    etapaFilter={etapaFilterArr}
                    periodoFilter={periodoFilter}
                    tipologiaFilter={tipologiaFilter}
                    moneda={moneda}
                    selectedIndicador={selectedIndicador}
                    onSelectIndicador={setSelectedIndicador}
                    theme={theme}
                  />
                )}

                {activeTab === 'mercado' && (
                  <WorkspacePanel
                    ciudad={ciudad}
                    zonaFilter={zonaFilter}
                    subzonaFilter={subzonaFilter}
                    tipoInmuebleFilter={tipoInmuebleFilter}
                    etapaFilter={etapaFilterArr}
                    periodoFilter={periodoFilter}
                    tipologiaFilter={tipologiaFilter}
                    moneda={moneda}
                    selectedIndicador={selectedIndicador}
                    onSelectIndicador={setSelectedIndicador}
                  />
                )}

                {activeTab === 'hipotecario' && (
                  <HipotecarioPanel />
                )}

                {activeTab === 'chapter_dossier' && (
                  <ChapterDossierPanel chapterId={activeChapter} />
                )}
              </div>
            </div>

            {/* Analysis & Diagnóstico Panel (right, toggled, directamente bajo el topbar principal) */}
            {analysisOpen && activeTab !== 'hipotecario' && activeTab !== 'chapter_dossier' && (
              <AnalysisPanel
                selectedIndicador={selectedIndicador}
                ciudad={ciudad}
                onClearSelection={() => setSelectedIndicador(null)}
              />
            )}
          </div>

          {/* ── Footer Secundario: Filter Bar (delimita con el sidebar izquierdo y cubre la base de chat, main y análisis) ── */}
          <button
            type="button"
            className="mobile-only mobile-filters-btn"
            onClick={() => setMobileSheet((m) => (m === 'filters' ? 'none' : 'filters'))}
          >
            Filtros
          </button>
          <FilterBar
            ciudad={ciudad}
            zonaFilter={zonaFilter}
            subzonaFilter={subzonaFilter}
            tipoInmuebleFilter={tipoInmuebleFilter}
            etapaFilter={etapaFilter}
            tipologiaFilter={tipologiaFilter}
            onZonaChange={setZonaFilter}
            onSubzonaChange={setSubzonaFilter}
            onTipoInmuebleChange={setTipoInmuebleFilter}
            onEtapaChange={(v) => {
              setEtapaFilter(v)
              setSelectedEtapas(v !== 'ALL' ? [v] : [])
            }}
            onTipologiaChange={setTipologiaFilter}
            onClear={handleClearFilters}
          />
        </div>
      </div>

      {/* ── Footer original: Status Bar ───────────────────────────────── */}
      <footer className="status-bar">
        <div className="status-dot" />
        <span>Supabase — Conectado</span>
        <span className="status-sep">|</span>
        <span>Bolivia Intelligence Platform v1.0</span>
        <span className="status-sep">|</span>
        <span>
          {selectedIndicador
            ? `Proyecto activo: ${selectedIndicador.proyecto}`
            : `Vista: ${CIUDAD_LABELS[ciudad]}`}
        </span>
        <div className="status-right">
          Pipeline: ETL GitHub Actions · 6h sync
        </div>
      </footer>
    </div>
  )
}
