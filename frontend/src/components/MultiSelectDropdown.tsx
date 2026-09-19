import { useState, useRef, useEffect } from 'react'

interface MultiSelectProps {
  label: string
  icon?: string
  options: string[]
  counts?: Record<string, number>
  selected: string[]
  onChange: (selected: string[]) => void
}

export default function MultiSelectDropdown({
  label,
  options,
  counts = {},
  selected,
  onChange,
}: MultiSelectProps) {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  const isAllSelected = selected.length === 0 || selected.length === options.length

  const handleToggle = (option: string) => {
    if (selected.includes(option)) {
      const next = selected.filter((o) => o !== option)
      onChange(next)
    } else {
      onChange([...selected, option])
    }
  }

  const handleSelectAll = () => {
    onChange([]) // empty array represents all
  }

  const handleClear = () => {
    onChange([])
  }

  // Label to show on the pill button
  let buttonText = `${label}: Todas`
  if (!isAllSelected && selected.length > 0) {
    if (selected.length === 1) {
      buttonText = selected[0]
    } else if (selected.length === 2) {
      buttonText = `${selected[0]} + 1`
    } else {
      buttonText = `${label} (${selected.length})`
    }
  }

  const isActive = !isAllSelected && selected.length > 0

  return (
    <div ref={containerRef} style={{ position: 'relative', display: 'inline-block' }}>
      {/* Trigger Pill Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        style={{
          background: 'var(--bg-card)',
          color: isActive ? 'var(--accent-cyan)' : 'var(--text-secondary)',
          border: `1px solid ${isActive ? 'var(--accent-cyan)' : 'var(--border-default)'}`,
          boxShadow: isActive ? '0 0 10px rgba(34, 211, 238, 0.25)' : 'none',
          padding: '4px 12px',
          borderRadius: 20,
          fontSize: 11,
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          cursor: 'pointer',
          transition: 'all 0.15s ease',
          outline: 'none',
          whiteSpace: 'nowrap',
        }}>
        <span style={{ maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis' }}>{buttonText}</span>
        <span style={{ fontSize: 9, opacity: 0.7, transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}>▼</span>
      </button>

      {/* Popover Dropdown */}
      {isOpen && (
        <div style={{
          position: 'absolute',
          top: 'calc(100% + 6px)',
          right: 0,
          minWidth: 230,
          maxWidth: 290,
          background: 'var(--bg-card, #252526)',
          border: '1px solid var(--border-bright, #4a4a4a)',
          borderRadius: 10,
          boxShadow: '0 12px 32px rgba(0, 0, 0, 0.65), 0 0 16px rgba(0, 120, 212, 0.15)',
          padding: '10px 8px',
          zIndex: 9999,
          backdropFilter: 'blur(12px)',
          fontFamily: "'Inter', sans-serif",
        }}>
          {/* Header & Quick Action Buttons */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '2px 6px 8px',
            borderBottom: '1px solid var(--border-subtle, #133340)',
            marginBottom: 6,
          }}>
            <span style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--text-muted, #94a3b8)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Filtrar por {label}
            </span>
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                type="button"
                onClick={handleSelectAll}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: isAllSelected ? 'var(--text-primary)' : 'var(--text-muted)',
                  fontSize: 10,
                  fontWeight: 600,
                  cursor: 'pointer',
                  padding: '2px 4px',
                }}>
                Todas
              </button>
              <button
                type="button"
                onClick={handleClear}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-muted)',
                  fontSize: 10,
                  fontWeight: 600,
                  cursor: 'pointer',
                  padding: '2px 4px',
                }}>
                Limpiar
              </button>
            </div>
          </div>

          {/* Options Checkbox List */}
          <div style={{ maxHeight: 220, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
            {options.map((opt) => {
              const checked = !isAllSelected && selected.includes(opt)
              const count = counts[opt]

              return (
                <label
                  key={opt}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '6px 8px',
                    borderRadius: 6,
                    cursor: 'pointer',
                    fontSize: 11.5,
                    color: checked ? 'var(--text-primary)' : 'var(--text-secondary)',
                    background: checked ? 'var(--bg-active)' : 'transparent',
                    userSelect: 'none',
                    transition: 'background 0.12s',
                  }}>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => handleToggle(opt)}
                    style={{
                      accentColor: 'var(--text-primary)',
                      cursor: 'pointer',
                      width: 14,
                      height: 14,
                    }}
                  />
                  <span style={{ flex: 1 }}>{opt}</span>
                  {count != null && (
                    <span style={{
                      fontSize: 10,
                      color: 'var(--text-muted, #64748b)',
                      fontFamily: "'JetBrains Mono', monospace",
                    }}>
                      {count}
                    </span>
                  )}
                </label>
              )
            })}
          </div>

          {/* Footer Active Summary */}
          <div style={{
            marginTop: 6,
            paddingTop: 6,
            borderTop: '1px solid var(--border-subtle, #133340)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: 10,
            color: 'var(--text-muted, #64748b)',
            paddingLeft: 6,
            paddingRight: 6,
          }}>
            <span>
              {isAllSelected
                ? `Mostrando todas (${options.length})`
                : `${selected.length} seleccionada${selected.length > 1 ? 's' : ''}`}
            </span>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              style={{
                background: 'var(--citrino-petrol, #032e35)',
                border: '1px solid var(--citrino-teal-light, #14b8a6)',
                color: '#ffffff',
                borderRadius: 4,
                padding: '2px 8px',
                fontSize: 10,
                fontWeight: 600,
                cursor: 'pointer',
              }}>
              Listo
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
