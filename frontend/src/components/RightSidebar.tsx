import { useState, useEffect, useRef } from 'react'
import ChatPanel from './ChatPanel'
import AnalysisPanel from './AnalysisPanel'
import type { IndicadorFull } from '../lib/supabase'

type PanelId = 'assistant' | 'inspector' | 'notifications' | 'settings' | null

interface Props {
  ciudad: string
  selectedIndicador: IndicadorFull | null
  onFilterZona: (zona: string) => void
  onFilterEtapas: (etapas: string[]) => void
  onSelectIndicador: (ind: IndicadorFull | null) => void
  onClearSelection: () => void
  onSwitchTab: (tab: string) => void
  // Controlled externally to allow topbar button to open the assistant
  forcedPanel?: PanelId
  onForcedPanelConsumed?: () => void
}

const ICONS: { id: PanelId & string; label: string }[] = [
  { id: 'assistant',     label: 'IA Asistente' },
  { id: 'inspector',     label: 'Inspector'    },
  { id: 'notifications', label: 'Notificaciones' },
  { id: 'settings',      label: 'Ajustes'     },
]

const PANEL_WIDTH = 340

export default function RightSidebar({
  ciudad,
  selectedIndicador,
  onFilterZona,
  onFilterEtapas,
  onSelectIndicador,
  onClearSelection,
  onSwitchTab,
  forcedPanel,
  onForcedPanelConsumed,
}: Props) {
  const [activePanel, setActivePanel] = useState<PanelId>(null)
  const prevForcedPanel = useRef<PanelId>(null)

  // React to external forced open (e.g. topbar button)
  useEffect(() => {
    if (forcedPanel && forcedPanel !== prevForcedPanel.current) {
      setActivePanel(forcedPanel)
      prevForcedPanel.current = forcedPanel
      onForcedPanelConsumed?.()
    }
  }, [forcedPanel, onForcedPanelConsumed])

  const handleIconClick = (id: PanelId) => {
    setActivePanel((prev) => (prev === id ? null : id))
  }

  const isOpen = activePanel !== null

  return (
    <div style={{ display: 'flex', flexDirection: 'row', height: '100%', position: 'relative' }}>
      {/* ─── Sliding Panel ──────────────────────────────────── */}
      <div
        style={{
          width: isOpen ? PANEL_WIDTH : 0,
          minWidth: isOpen ? PANEL_WIDTH : 0,
          maxWidth: PANEL_WIDTH,
          overflow: 'hidden',
          transition: 'width 0.25s cubic-bezier(0.4, 0, 0.2, 1), min-width 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
          borderLeft: isOpen ? '1px solid var(--border-subtle)' : 'none',
          background: 'var(--bg-panel)',
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
        }}
      >
        {/* Panel content rendered by activePanel */}
        <div
          style={{
            width: PANEL_WIDTH,
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            opacity: isOpen ? 1 : 0,
            transition: 'opacity 0.2s ease',
          }}
        >
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

          {activePanel === 'inspector' && (
            <AnalysisPanel
              selectedIndicador={selectedIndicador}
              ciudad={ciudad}
              onClearSelection={onClearSelection}
            />
          )}

          {activePanel === 'notifications' && (
            <NotificationsPanel />
          )}

          {activePanel === 'settings' && (
            <SettingsPanel />
          )}
        </div>
      </div>

      {/* ─── Icon Rail ──────────────────────────────────────── */}
      <div
        style={{
          width: 44,
          minWidth: 44,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          paddingTop: 8,
          paddingBottom: 8,
          gap: 4,
          background: 'var(--bg-panel-header)',
          borderLeft: '1px solid var(--border-subtle)',
          height: '100%',
        }}
      >
        {ICONS.map(({ id, emoji, label }) => (
          <button
            key={id}
            title={label}
            onClick={() => handleIconClick(id as PanelId)}
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
              if (activePanel !== id) {
                (e.currentTarget as HTMLButtonElement).style.background = 'var(--bg-card, rgba(255,255,255,0.06))'
              }
            }}
            onMouseLeave={(e) => {
              if (activePanel !== id) {
                (e.currentTarget as HTMLButtonElement).style.background = 'transparent'
              }
            }}
          >
            <span role="img" aria-label={label}>{emoji}</span>
            {/* Active indicator dot */}
            {activePanel === id && (
              <span style={{
                position: 'absolute',
                left: -1,
                top: '50%',
                transform: 'translateY(-50%)',
                width: 3,
                height: 16,
                borderRadius: '0 2px 2px 0',
                background: 'var(--text-primary)',
              }} />
            )}
          </button>
        ))}

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* Collapse indicator when panel is open */}
        {isOpen && (
          <button
            title="Cerrar panel"
            onClick={() => setActivePanel(null)}
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 12,
              color: 'var(--text-muted)',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = 'var(--bg-card, rgba(255,255,255,0.06))'
              ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--text-primary)'
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = 'transparent'
              ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--text-muted)'
            }}
          >
            ✕
          </button>
        )}
      </div>
    </div>
  )
}

/* ── Embedded Notification Panel ─────────────────────────────────────────── */
function NotificationsPanel() {
  const notifications = [
    { id: 1, type: 'info', title: 'Datos actualizados', desc: 'Pipeline ETL completado exitosamente', time: 'Hace 2h' },
    { id: 2, type: 'warn', title: 'Sobreoferta detectada', desc: 'Zona Equipetrol supera umbral del 35%', time: 'Hace 4h' },
    { id: 3, type: 'ok',   title: 'Sync completado',      desc: 'SCZ · LPZ · CBB sincronizadas', time: 'Ayer' },
    { id: 4, type: 'info', title: 'Nuevo layer geoespacial', desc: 'Polígonos de zonas actualizados', time: 'Ayer' },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div style={{
        padding: '10px 14px',
        borderBottom: '1px solid var(--border-subtle)',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        background: 'var(--bg-panel-header)',
      }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
          Notificaciones
        </span>
        <span style={{
          marginLeft: 'auto',
          fontSize: 9.5,
          fontWeight: 700,
          background: 'var(--bg-active)',
          color: '#fff',
          borderRadius: 4,
          padding: '1px 6px',
        }}>
          {notifications.length}
        </span>
      </div>

      {/* List */}
      <div style={{ flex: 1, overflow: 'auto', padding: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
        {notifications.map((n) => (
          <div key={n.id} style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-default)',
            borderRadius: 6,
            padding: '10px 12px',
            display: 'flex',
            gap: 10,
            alignItems: 'flex-start',
            cursor: 'pointer',
            transition: 'border-color 0.15s',
          }}
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

/* ── Embedded Settings Panel ─────────────────────────────────────────────── */
function SettingsPanel() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div style={{
        padding: '10px 14px',
        borderBottom: '1px solid var(--border-subtle)',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        background: 'var(--bg-panel-header)',
      }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
          Ajustes
        </span>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'auto', padding: 14, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <SettingsSection title="Visualización">
          <SettingsRow label="Densidad de datos" control={
            <select style={selectStyle}>
              <option>Compacta</option>
              <option>Normal</option>
              <option>Amplia</option>
            </select>
          } />
          <SettingsRow label="Unidad de precio" control={
            <select style={selectStyle}>
              <option>$US Dólares</option>
              <option>Bs. Bolivianos</option>
            </select>
          } />
          <SettingsRow label="Decimales en métricas" control={
            <select style={selectStyle}>
              <option>0</option>
              <option>1</option>
              <option>2</option>
            </select>
          } />
        </SettingsSection>

        <SettingsSection title="Actualización de datos">
          <SettingsRow label="Frecuencia de sync" control={
            <select style={selectStyle}>
              <option>Cada 6h (default)</option>
              <option>Cada 12h</option>
              <option>Diario</option>
            </select>
          } />
          <SettingsRow label="Alertas de sobreoferta" control={
            <ToggleSwitch defaultOn />
          } />
        </SettingsSection>

        <SettingsSection title="IA Asistente">
          <SettingsRow label="Modelo activo" control={
            <select style={selectStyle}>
              <option>Gemini 1.5 Pro</option>
              <option>Gemini 1.5 Flash</option>
              <option>GPT-4o</option>
            </select>
          } />
          <SettingsRow label="Respuestas con gráficos" control={
            <ToggleSwitch defaultOn />
          } />
          <SettingsRow label="Historial de chat" control={
            <ToggleSwitch defaultOn />
          } />
        </SettingsSection>

        <SettingsSection title="Notificaciones">
          <SettingsRow label="Alertas de mercado" control={<ToggleSwitch defaultOn />} />
          <SettingsRow label="Actualizaciones del pipeline" control={<ToggleSwitch />} />
        </SettingsSection>
      </div>
    </div>
  )
}

const selectStyle: React.CSSProperties = {
  background: 'var(--bg-base)',
  color: 'var(--text-primary)',
  border: '1px solid var(--border-default)',
  borderRadius: 6,
  padding: '3px 8px',
  fontSize: 11,
  outline: 'none',
  cursor: 'pointer',
}

function SettingsSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{
        fontSize: 10,
        fontWeight: 700,
        color: 'var(--citrino-teal, #0d9488)',
        letterSpacing: '0.1em',
        textTransform: 'uppercase',
        marginBottom: 8,
        paddingBottom: 6,
        borderBottom: '1px solid var(--border-subtle)',
      }}>
        {title}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {children}
      </div>
    </div>
  )
}

function SettingsRow({ label, control }: { label: string; control: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
      <span style={{ fontSize: 11.5, color: 'var(--text-secondary)', flex: 1 }}>{label}</span>
      {control}
    </div>
  )
}

function ToggleSwitch({ defaultOn = false }: { defaultOn?: boolean }) {
  const [on, setOn] = useState(defaultOn)
  return (
    <button
      onClick={() => setOn(!on)}
      style={{
        width: 36,
        height: 20,
        borderRadius: 10,
        border: 'none',
        background: on ? 'var(--citrino-teal, #0d9488)' : 'var(--border-default)',
        position: 'relative',
        cursor: 'pointer',
        transition: 'background 0.2s',
        flexShrink: 0,
      }}
    >
      <span style={{
        position: 'absolute',
        top: 3,
        left: on ? 18 : 3,
        width: 14,
        height: 14,
        borderRadius: '50%',
        background: '#fff',
        transition: 'left 0.2s',
        boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
      }} />
    </button>
  )
}
