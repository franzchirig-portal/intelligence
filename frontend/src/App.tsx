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
import { supabase } from './lib/supabase'
import type { IndicadorFull } from './lib/supabase'

/* ─── Profile & Account Icons  ─────────────────────── */
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

type Ciudad = 'SCZ' | 'LPZ' | 'CBB' | 'ALL'
type Tab = 'workspace_os' | 'mercado' | 'tipologias' | 'proyectos' | 'geoespacial'

const TABS: { id: Tab; label: string }[] = [
  { id: 'mercado',     label: 'Oferta Nueva' },
  { id: 'tipologias', label: 'Tipologías' },
  { id: 'proyectos',  label: 'Proyectos' },
  { id: 'geoespacial',label: 'Mapa' },
]

export default function App() {
  const [session, setSession] = useState<any>(null)
  const [guestMode, setGuestMode] = useState<boolean>(false)
  const [authLoading, setAuthLoading] = useState(true)

  const [ciudad, setCiudad] = useState<Ciudad>('SCZ')
  const [activeTab, setActiveTab] = useState<Tab>('mercado')
  const [selectedIndicador, setSelectedIndicador] = useState<IndicadorFull | null>(null)

  // Filtros globales (los fija el asistente)
  const [zonaFilter, setZonaFilter] = useState<string>('ALL')
  const [selectedEtapas, setSelectedEtapas] = useState<string[]>([])


  // Theme State: 'dark' (Nocturno) | 'light' (Diurno)
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    const saved = localStorage.getItem('citrino_theme_v2')
    return (saved === 'light' || saved === 'dark') ? saved : 'light'
  })

  // Chat assistant (right panel)
  const [chatOpen, setChatOpen] = useState(false)

  // Profile Dropdown Menu State
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false)
  const profileMenuRef = useRef<HTMLDivElement>(null)

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

  const handleCiudadChange = (c: Ciudad) => {
    setCiudad(c)
    setSelectedIndicador(null)
    setZonaFilter('ALL')
    setSelectedEtapas([])
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
        background: 'var(--bg-base)',
        gap: 12,
      }}>
        <div className="loading-shimmer" style={{ width: 180, height: 18 }} />
        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Iniciando Citrino…</div>
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
          <button
            type="button"
            className="ide-topbar-logo"
            title="Citrino"
            aria-label="Citrino, ir a Oferta Nueva"
            onClick={() => setActiveTab('mercado')}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M 18.5 7.5 A 8 8 0 1 0 18.5 16.5" />
              <polygon points="12 8.5 15.5 12 12 15.5 8.5 12" />
            </svg>
          </button>

          <nav className="ide-topbar-tabs" aria-label="Secciones">
            {TABS.map((t) => (
              <button
                type="button"
                key={t.id}
                className={`ide-tab ${activeTab === t.id ? 'active' : ''}`}
                aria-current={activeTab === t.id ? 'page' : undefined}
                onClick={() => setActiveTab(t.id)}
              >
                {t.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Right: Cities + Theme + AI + User + Window Controls */}
        <div className="ide-topbar-right">
          <div className="topbar-right" style={{ marginLeft: 0 }}>
            {(['SCZ', 'LPZ', 'CBB', 'ALL'] as Ciudad[]).map((c) => (
              <button
                key={c}
                className={`city-badge ${c.toLowerCase()} ${ciudad === c ? 'active' : ''}`}
                aria-pressed={ciudad === c}
                onClick={() => handleCiudadChange(c)}>
                {c === 'ALL' ? 'Bolivia' : c}
              </button>
            ))}
          </div>

          <div className="topbar-divider" />

          <button
            className="theme-toggle-btn"
            onClick={toggleTheme}
            aria-label={theme === 'dark' ? 'Cambiar a modo diurno' : 'Cambiar a modo nocturno'}
            title={theme === 'dark' ? 'Cambiar a modo diurno' : 'Cambiar a modo nocturno'}
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
            className={`topbar-icon-btn ${chatOpen ? 'active' : ''}`}
            onClick={() => setChatOpen((v) => !v)}
            aria-label={chatOpen ? 'Cerrar asistente' : 'Abrir asistente'}
            aria-pressed={chatOpen}
            title={chatOpen ? 'Cerrar asistente' : 'Abrir asistente'}
          >
            <IconAssistant />
          </button>

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
                {/* Header with profile name */}
                <div className="profile-dropdown-header">
                  <div className="profile-dropdown-avatar">
                    {session?.user ? (
                      (session.user.user_metadata?.full_name?.[0] || session.user.email?.[0] || 'U').toUpperCase()
                    ) : (
                      'I'
                    )}
                  </div>
                  <div className="profile-dropdown-info">
                    <span className="profile-dropdown-name">
                      {session?.user ? (session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || 'Usuario Registrado') : 'Invitado'}
                    </span>
                    <span className="profile-dropdown-role">
                      {session?.user?.email || 'Modo Demostración'}
                    </span>
                  </div>
                </div>

                <div className="profile-dropdown-divider" />

                {/* Cambiar de usuario */}
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

                {/* Salir / Cerrar sesión */}
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
      </header>

      <main className="workspace">
        {chatOpen && (
          <aside className="chat-aside" aria-label="Asistente">
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

        {activeTab === 'workspace_os' && (
          <div style={{ flex: 1, overflow: 'hidden', height: '100%', display: 'flex', flexDirection: 'column' }}>
            <WorkspaceOSPanel
              ciudad={ciudad}
              zonaFilter={zonaFilter}
              etapaFilter={selectedEtapas}
              selectedIndicador={selectedIndicador}
              onSelectIndicador={setSelectedIndicador}
              onSwitchTab={setActiveTab}
              theme={theme}
            />
          </div>
        )}

        {(activeTab === 'mercado' || activeTab === 'proyectos') && (
          <WorkspacePanel
            ciudad={ciudad}
            zonaFilter={zonaFilter}
            etapaFilter={selectedEtapas}
            selectedIndicador={selectedIndicador}
            onSelectIndicador={setSelectedIndicador}
          />
        )}

        {activeTab === 'tipologias' && (
          <TipologiasPanel
            ciudad={ciudad}
            etapaFilter={selectedEtapas}
            selectedIndicador={selectedIndicador}
            onSelectIndicador={setSelectedIndicador}
          />
        )}

        {activeTab === 'geoespacial' && (
          <GeoespacialPanel
            ciudad={ciudad}
            zonaFilter={zonaFilter}
            etapaFilter={selectedEtapas}
            selectedIndicador={selectedIndicador}
            onSelectIndicador={setSelectedIndicador}
            theme={theme}
          />
        )}

        {activeTab !== 'workspace_os' && (
          <AnalysisPanel
            selectedIndicador={selectedIndicador}
            ciudad={ciudad}
            onClearSelection={() => setSelectedIndicador(null)}
          />
        )}

      </main>
    </div>
  )
}
