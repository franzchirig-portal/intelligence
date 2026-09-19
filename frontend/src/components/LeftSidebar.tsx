import { useState, useEffect, useRef } from 'react'
import ChatPanel from './ChatPanel'
import type { IndicadorFull } from '../lib/supabase'

export type PanelId = 'assistant' | 'notifications' | 'settings' | 'close' | null

interface Props {
  ciudad: string
  activeTab?: string
  onFilterZona: (zona: string) => void
  onFilterEtapas: (etapas: string[]) => void
  onSelectIndicador: (ind: IndicadorFull | null) => void
  onSwitchTab: (tab: string) => void
  forcedPanel?: PanelId
  onForcedPanelConsumed?: () => void
  onPanelChange?: (panel: PanelId) => void
}

/* ── Supabase-style SVG icons (Lucide stroke, 20×20) ───────────────────────── */
const IconIWS = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="3" width="20" height="14" rx="2.5" />
    <path d="M8 21h8" />
    <path d="M12 17v4" />
    <path d="M7 8.5l3 2.5-3 2.5" />
    <line x1="12" y1="13.5" x2="16.5" y2="13.5" />
  </svg>
)

export const IconAssistant = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2a10 10 0 0 1 10 10c0 5.52-4.48 10-10 10S2 17.52 2 12 6.48 2 12 2z"/>
    <path d="M8 10h.01M12 10h.01M16 10h.01"/>
    <path d="M9 16c1-.5 2-.75 3-.75s2 .25 3 .75"/>
  </svg>
)

const IconBell = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
    <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
  </svg>
)

const IconSettings = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/>
    <circle cx="12" cy="12" r="3"/>
  </svg>
)

const ICONS: { id: string; Icon: React.FC; label: string }[] = [
  { id: 'notifications', Icon: IconBell,        label: 'Notificaciones' },
  { id: 'settings',      Icon: IconSettings,    label: 'Ajustes'       },
]

const PANEL_WIDTH = 340

export default function LeftSidebar({
  ciudad,
  activeTab,
  onFilterZona,
  onFilterEtapas,
  onSelectIndicador,
  onSwitchTab,
  forcedPanel,
  onForcedPanelConsumed,
  onPanelChange,
}: Props) {
  const [activePanel, setActivePanel] = useState<PanelId>(null)

  useEffect(() => {
    if (forcedPanel) {
      if ((forcedPanel as string) === 'close') {
        setActivePanel(null)
      } else {
        setActivePanel(forcedPanel as PanelId)
      }
      onForcedPanelConsumed?.()
    }
  }, [forcedPanel, onForcedPanelConsumed])

  useEffect(() => {
    onPanelChange?.(activePanel)
  }, [activePanel, onPanelChange])

  const handleIconClick = (id: string) => {
    setActivePanel((prev) => (prev === id ? null : id as PanelId))
  }

  const isOpen = activePanel !== null

  return (
    <div style={{ display: 'flex', flexDirection: 'row', height: '100%' }}>

      {/* ─── Icon Rail — LEFT EDGE (Antigravity IDE Activity Bar: 48px) ──── */}
      <div style={{
        width: 48,
        minWidth: 48,
        maxWidth: 48,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        paddingTop: 0,
        paddingBottom: 0,
        gap: 0,
        background: 'var(--bg-base)',
        borderRight: '1px solid var(--border-subtle)',
        height: '100%',
        zIndex: 10,
      }}>
        {/* ─── IWS Workspace OS Icon (Primary Sidebar Trigger) ─── */}
        <button
          title="IWS — Workspace OS"
          onClick={() => {
            setActivePanel(null)
            onSwitchTab('workspace_os')
          }}
          style={{
            width: 48,
            height: 48,
            borderRadius: 0,
            border: 'none',
            background: 'transparent',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: activeTab === 'workspace_os' ? 'var(--text-primary)' : 'var(--text-muted)',
            transition: 'all 0.12s ease',
            outline: 'none',
            position: 'relative',
          }}
          onMouseEnter={(e) => {
            if (activeTab !== 'workspace_os') {
              const btn = e.currentTarget as HTMLButtonElement
              btn.style.color = 'var(--text-primary)'
            }
          }}
          onMouseLeave={(e) => {
            if (activeTab !== 'workspace_os') {
              const btn = e.currentTarget as HTMLButtonElement
              btn.style.color = 'var(--text-muted)'
            }
          }}
        >
          <IconIWS />
          {/* Active indicator bar on left edge */}
          {activeTab === 'workspace_os' && (
            <span style={{
              position: 'absolute',
              left: 0,
              top: 0,
              bottom: 0,
              width: 2,
              background: 'var(--text-primary)',
            }} />
          )}
        </button>

        {/* Separator */}
        <div style={{
          width: 32,
          height: 1,
          background: 'var(--border-subtle)',
          margin: '2px 0',
        }} />

        {ICONS.map(({ id, Icon, label }) => (
          <button
            key={id}
            title={label}
            onClick={() => handleIconClick(id)}
            style={{
              width: 48,
              height: 48,
              borderRadius: 0,
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: activePanel === id ? 'var(--text-primary)' : 'var(--text-muted)',
              transition: 'all 0.12s ease',
              outline: 'none',
              position: 'relative',
            }}
            onMouseEnter={(e) => {
              if (activePanel !== id) {
                const btn = e.currentTarget as HTMLButtonElement
                btn.style.color = 'var(--text-primary)'
              }
            }}
            onMouseLeave={(e) => {
              if (activePanel !== id) {
                const btn = e.currentTarget as HTMLButtonElement
                btn.style.color = 'var(--text-muted)'
              }
            }}
          >
            <Icon />
            {/* Active indicator — left-edge bar */}
            {activePanel === id && (
              <span style={{
                position: 'absolute',
                left: 0,
                top: 0,
                bottom: 0,
                width: 2,
                background: 'var(--text-primary)',
              }} />
            )}
          </button>
        ))}

        <div style={{ flex: 1 }} />

        {isOpen && (
          <button
            title="Cerrar panel"
            onClick={() => setActivePanel(null)}
            style={{
              width: 48, height: 40, borderRadius: 0, border: 'none',
              background: 'transparent', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--text-muted)', transition: 'all 0.12s ease',
            }}
            onMouseEnter={(e) => {
              const btn = e.currentTarget as HTMLButtonElement
              btn.style.color = 'var(--text-primary)'
            }}
            onMouseLeave={(e) => {
              const btn = e.currentTarget as HTMLButtonElement
              btn.style.color = 'var(--text-muted)'
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        )}
      </div>

      {/* ─── Sliding Panel — opens RIGHT of icon rail ──────────── */}
      <div style={{
        width: isOpen ? PANEL_WIDTH : 0,
        minWidth: isOpen ? PANEL_WIDTH : 0,
        maxWidth: PANEL_WIDTH,
        overflow: 'hidden',
        transition: 'width 0.25s cubic-bezier(0.4, 0, 0.2, 1), min-width 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
        borderRight: isOpen ? '1px solid var(--border-subtle)' : 'none',
        background: 'var(--bg-panel)',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
      }}>
        <div style={{
          width: PANEL_WIDTH,
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          opacity: isOpen ? 1 : 0,
          transition: 'opacity 0.2s ease',
        }}>
          {activePanel === 'assistant' && (
            <ChatPanel
              ciudad={ciudad}
              onFilterZona={onFilterZona}
              onFilterEtapas={onFilterEtapas}
              onSelectIndicador={onSelectIndicador}
              onSwitchTab={onSwitchTab}
              isEmbedded={true}
            />
          )}
          {activePanel === 'notifications' && <NotificationsPanel />}
          {activePanel === 'settings' && <SettingsPanel />}
        </div>
      </div>
    </div>
  )
}

/* ── Notifications Panel ─────────────────────────────────────────────────── */
function NotificationsPanel() {
  const notifications = [
    { id: 1, title: 'Datos actualizados',       desc: 'Pipeline ETL completado exitosamente',      time: 'Hace 2h' },
    { id: 2, title: 'Sobreoferta detectada',    desc: 'Zona Equipetrol supera umbral del 35%',     time: 'Hace 4h' },
    { id: 3, title: 'Sync completado',           desc: 'SCZ · LPZ · CBB sincronizadas',            time: 'Ayer' },
    { id: 4, title: 'Nuevo layer geoespacial',  desc: 'Polígonos de zonas actualizados',           time: 'Ayer' },
  ]
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg-panel-header)' }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Notificaciones</span>
        <span style={{ marginLeft: 'auto', fontSize: 9.5, fontWeight: 700, background: 'var(--bg-active)', color: 'var(--text-primary)', border: '1px solid var(--border-default)', borderRadius: 4, padding: '1px 6px' }}>{notifications.length}</span>
      </div>
      <div style={{ flex: 1, overflow: 'auto', padding: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
        {notifications.map((n) => (
          <div key={n.id} style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)', borderRadius: 6, padding: '10px 12px', display: 'flex', gap: 10, alignItems: 'flex-start', cursor: 'pointer', transition: 'border-color 0.15s' }}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--border-bright)')}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border-default)')}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 2 }}>{n.title}</div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.4 }}>{n.desc}</div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>{n.time}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ── Settings Panel ──────────────────────────────────────────────────────── */
function SettingsPanel() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg-panel-header)' }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Ajustes</span>
      </div>
      <div style={{ flex: 1, overflow: 'auto', padding: 14, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Section title="Visualización">
          <Row label="Densidad de datos" control={<Sel options={['Compacta','Normal','Amplia']} />} />
          <Row label="Unidad de precio"  control={<Sel options={['$US Dólares','Bs. Bolivianos']} />} />
          <Row label="Decimales"         control={<Sel options={['0','1','2']} />} />
        </Section>
        <Section title="Actualización de datos">
          <Row label="Frecuencia de sync"    control={<Sel options={['Cada 6h (default)','Cada 12h','Diario']} />} />
          <Row label="Alertas de sobreoferta" control={<Toggle defaultOn />} />
        </Section>
        <Section title="IA Asistente">
          <Row label="Modelo activo"          control={<Sel options={['Gemini 1.5 Pro','Gemini 1.5 Flash','GPT-4o']} />} />
          <Row label="Respuestas con gráficos" control={<Toggle defaultOn />} />
          <Row label="Historial de chat"       control={<Toggle defaultOn />} />
        </Section>
        <Section title="Notificaciones">
          <Row label="Alertas de mercado"          control={<Toggle defaultOn />} />
          <Row label="Actualizaciones del pipeline" control={<Toggle />} />
        </Section>
      </div>
    </div>
  )
}

const selStyle: React.CSSProperties = { background: 'var(--bg-base)', color: 'var(--text-primary)', border: '1px solid var(--border-default)', borderRadius: 6, padding: '3px 8px', fontSize: 11, outline: 'none', cursor: 'pointer' }

function Sel({ options }: { options: string[] }) {
  return <select style={selStyle}>{options.map(o => <option key={o}>{o}</option>)}</select>
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--citrino-teal, #0d9488)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8, paddingBottom: 6, borderBottom: '1px solid var(--border-subtle)' }}>{title}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{children}</div>
    </div>
  )
}

function Row({ label, control }: { label: string; control: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
      <span style={{ fontSize: 11.5, color: 'var(--text-secondary)', flex: 1 }}>{label}</span>
      {control}
    </div>
  )
}

function Toggle({ defaultOn = false }: { defaultOn?: boolean }) {
  const [on, setOn] = useState(defaultOn)
  return (
    <button onClick={() => setOn(!on)} style={{ width: 36, height: 20, borderRadius: 10, border: 'none', background: on ? 'var(--citrino-teal, #0d9488)' : 'var(--border-default)', position: 'relative', cursor: 'pointer', transition: 'background 0.2s', flexShrink: 0 }}>
      <span style={{ position: 'absolute', top: 3, left: on ? 18 : 3, width: 14, height: 14, borderRadius: '50%', background: '#fff', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.3)' }} />
    </button>
  )
}
