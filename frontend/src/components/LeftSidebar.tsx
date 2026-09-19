import { useState, useEffect, useRef } from 'react'
import ChatPanel from './ChatPanel'
import type { IndicadorFull } from '../lib/supabase'

type PanelId = 'assistant' | 'notifications' | 'settings' | null

interface Props {
  ciudad: string
  onFilterZona: (zona: string) => void
  onFilterEtapas: (etapas: string[]) => void
  onSelectIndicador: (ind: IndicadorFull | null) => void
  onSwitchTab: (tab: string) => void
  forcedPanel?: PanelId
  onForcedPanelConsumed?: () => void
}

const ICONS: { id: string; emoji: string; label: string }[] = [
  { id: 'assistant',     emoji: '🤖', label: 'IA Asistente'   },
  { id: 'notifications', emoji: '🔔', label: 'Notificaciones' },
  { id: 'settings',      emoji: '⚙️', label: 'Ajustes'       },
]

const PANEL_WIDTH = 340

export default function LeftSidebar({
  ciudad,
  onFilterZona,
  onFilterEtapas,
  onSelectIndicador,
  onSwitchTab,
  forcedPanel,
  onForcedPanelConsumed,
}: Props) {
  const [activePanel, setActivePanel] = useState<PanelId>(null)
  const prevForcedPanel = useRef<PanelId>(null)

  useEffect(() => {
    if (forcedPanel && forcedPanel !== prevForcedPanel.current) {
      setActivePanel(forcedPanel as PanelId)
      prevForcedPanel.current = forcedPanel
      onForcedPanelConsumed?.()
    }
  }, [forcedPanel, onForcedPanelConsumed])

  const handleIconClick = (id: string) => {
    setActivePanel((prev) => (prev === id ? null : id as PanelId))
  }

  const isOpen = activePanel !== null

  return (
    <div style={{ display: 'flex', flexDirection: 'row', height: '100%' }}>

      {/* ─── Icon Rail — LEFT EDGE ──────────────────────────────── */}
      <div style={{
        width: 44,
        minWidth: 44,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        paddingTop: 8,
        paddingBottom: 8,
        gap: 4,
        background: 'var(--bg-panel-header)',
        borderRight: '1px solid var(--border-subtle)',
        height: '100%',
        zIndex: 10,
      }}>
        {ICONS.map(({ id, emoji, label }) => (
          <button
            key={id}
            title={label}
            onClick={() => handleIconClick(id)}
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              border: 'none',
              background: activePanel === id
                ? 'var(--citrino-teal, #0d9488)'
                : 'transparent',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 15,
              transition: 'all 0.15s ease',
              outline: 'none',
              boxShadow: activePanel === id
                ? '0 0 10px var(--citrino-glow, rgba(34,211,238,0.35))'
                : 'none',
              position: 'relative',
            }}
            onMouseEnter={(e) => {
              if (activePanel !== id)
                (e.currentTarget as HTMLButtonElement).style.background = 'var(--bg-card, rgba(255,255,255,0.06))'
            }}
            onMouseLeave={(e) => {
              if (activePanel !== id)
                (e.currentTarget as HTMLButtonElement).style.background = 'transparent'
            }}
          >
            <span role="img" aria-label={label}>{emoji}</span>
            {/* Active indicator — right-edge bar */}
            {activePanel === id && (
              <span style={{
                position: 'absolute',
                right: -1,
                top: '50%',
                transform: 'translateY(-50%)',
                width: 3,
                height: 16,
                borderRadius: '2px 0 0 2px',
                background: 'var(--citrino-accent, #22d3ee)',
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
              width: 32, height: 32, borderRadius: 8, border: 'none',
              background: 'transparent', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 12, color: 'var(--text-muted)', transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = 'var(--bg-card, rgba(255,255,255,0.06))'
              ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--text-primary)'
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = 'transparent'
              ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--text-muted)'
            }}
          >✕</button>
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
    { id: 1, icon: '📊', title: 'Datos actualizados',       desc: 'Pipeline ETL completado exitosamente',      time: 'Hace 2h' },
    { id: 2, icon: '⚠️', title: 'Sobreoferta detectada',    desc: 'Zona Equipetrol supera umbral del 35%',     time: 'Hace 4h' },
    { id: 3, icon: '✅', title: 'Sync completado',           desc: 'SCZ · LPZ · CBB sincronizadas',            time: 'Ayer' },
    { id: 4, icon: '🗺️', title: 'Nuevo layer geoespacial',  desc: 'Polígonos de zonas actualizados',           time: 'Ayer' },
  ]
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg-panel-header)' }}>
        <span style={{ fontSize: 12 }}>🔔</span>
        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Notificaciones</span>
        <span style={{ marginLeft: 'auto', fontSize: 9.5, fontWeight: 700, background: 'var(--citrino-teal, #0d9488)', color: '#fff', borderRadius: 10, padding: '1px 6px' }}>{notifications.length}</span>
      </div>
      <div style={{ flex: 1, overflow: 'auto', padding: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
        {notifications.map((n) => (
          <div key={n.id} style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)', borderRadius: 10, padding: '10px 12px', display: 'flex', gap: 10, alignItems: 'flex-start', cursor: 'pointer', transition: 'border-color 0.15s' }}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--border-bright)')}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border-default)')}
          >
            <span style={{ fontSize: 18, lineHeight: 1 }}>{n.icon}</span>
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
        <span style={{ fontSize: 12 }}>⚙️</span>
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
