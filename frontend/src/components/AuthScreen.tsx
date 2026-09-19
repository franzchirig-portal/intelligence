import { useState } from 'react'
import { supabase } from '../lib/supabase'

interface AuthScreenProps {
  onSuccess: () => void
}

export default function AuthScreen({ onSuccess }: AuthScreenProps) {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg(null)
    setSuccessMsg(null)
    setLoading(true)

    try {
      if (mode === 'login') {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        })
        if (error) {
          if (error.message.includes('Invalid login credentials')) {
            throw new Error('Correo o contraseña incorrectos. Verifica tus datos o regístrate si no tienes cuenta.')
          }
          throw error
        }
        if (data.session) {
          onSuccess()
        }
      } else {
        // Mode: Register
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: {
              full_name: fullName.trim(),
            },
          },
        })
        if (error) throw error

        if (data.session) {
          setSuccessMsg('¡Cuenta creada e iniciada con éxito!')
          setTimeout(() => onSuccess(), 1000)
        } else if (data.user) {
          setSuccessMsg('¡Usuario registrado exitosamente! Si tienes confirmación de correo habilitada en Supabase, revisa tu bandeja de entrada o intenta iniciar sesión.')
          setMode('login')
        }
      }
    } catch (err: any) {
      console.error('Auth error:', err)
      setErrorMsg(err.message || 'Error al autenticar. Inténtalo nuevamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 9999,
      background: 'var(--bg-base, #181818)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 16,
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    }}>
      <div style={{
        width: '100%',
        maxWidth: 400,
        background: 'var(--bg-surface, #1e1e1e)',
        border: '1px solid var(--border-subtle, #2b2d30)',
        borderRadius: 8,
        padding: '32px 28px',
        boxShadow: '0 16px 48px rgba(0, 0, 0, 0.65)',
        position: 'relative',
        zIndex: 1,
      }}>
        {/* Brand Header */}
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 46,
            height: 46,
            borderRadius: 8,
            background: 'var(--bg-card, #252526)',
            border: '1px solid var(--border-subtle, #2b2d30)',
            marginBottom: 14,
          }}>
            <svg width="24" height="24" viewBox="0 0 100 100" fill="none">
              <path d="M 50 10 A 40 40 0 1 0 85 75 L 70 65 A 25 25 0 1 1 50 25 Z" fill="#ffffff" />
              <polygon points="50,38 60,50 50,62 40,50" fill="#9d9d9d" />
            </svg>
          </div>

          <h1 style={{
            fontSize: 18,
            fontWeight: 700,
            color: 'var(--text-primary, #f3f3f3)',
            margin: 0,
            letterSpacing: 2,
          }}>
            CITRINO
          </h1>
          <div style={{
            fontSize: 10,
            fontWeight: 600,
            color: 'var(--text-muted, #8e8e8e)',
            letterSpacing: 1.8,
            textTransform: 'uppercase',
            marginTop: 4,
          }}>
            Inteligencia Inmobiliaria
          </div>
        </div>

        {/* Mode Switcher Tabs */}
        <div style={{
          display: 'flex',
          background: 'var(--bg-base, #181818)',
          padding: 3,
          borderRadius: 6,
          marginBottom: 20,
          border: '1px solid var(--border-subtle, #2b2d30)',
        }}>
          <button
            type="button"
            onClick={() => { setMode('login'); setErrorMsg(null); setSuccessMsg(null); }}
            style={{
              flex: 1,
              padding: '7px 0',
              fontSize: 11.5,
              fontWeight: mode === 'login' ? 600 : 500,
              background: mode === 'login' ? 'var(--bg-card, #252526)' : 'transparent',
              color: mode === 'login' ? 'var(--text-primary, #ffffff)' : 'var(--text-secondary, #9d9d9d)',
              border: mode === 'login' ? '1px solid var(--border-default, #333842)' : '1px solid transparent',
              borderRadius: 4,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}>
            Iniciar Sesión
          </button>
          <button
            type="button"
            onClick={() => { setMode('register'); setErrorMsg(null); setSuccessMsg(null); }}
            style={{
              flex: 1,
              padding: '7px 0',
              fontSize: 11.5,
              fontWeight: mode === 'register' ? 600 : 500,
              background: mode === 'register' ? 'var(--bg-card, #252526)' : 'transparent',
              color: mode === 'register' ? 'var(--text-primary, #ffffff)' : 'var(--text-secondary, #9d9d9d)',
              border: mode === 'register' ? '1px solid var(--border-default, #333842)' : '1px solid transparent',
              borderRadius: 4,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}>
            Crear Cuenta
          </button>
        </div>

        {/* Error Alert */}
        {errorMsg && (
          <div style={{
            background: 'rgba(244, 63, 94, 0.12)',
            border: '1px solid rgba(244, 63, 94, 0.35)',
            color: '#fda4af',
            padding: '9px 12px',
            borderRadius: 6,
            fontSize: 11.5,
            marginBottom: 16,
          }}>
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Success Alert */}
        {successMsg && (
          <div style={{
            background: 'rgba(16, 185, 129, 0.12)',
            border: '1px solid rgba(16, 185, 129, 0.35)',
            color: '#86efac',
            padding: '9px 12px',
            borderRadius: 6,
            fontSize: 11.5,
            marginBottom: 16,
          }}>
            <span>{successMsg}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {mode === 'register' && (
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 500, color: 'var(--text-secondary, #9d9d9d)', marginBottom: 5 }}>
                Nombre Completo
              </label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Ej. Juan Pérez"
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  background: 'var(--bg-input, #1f1f1f)',
                  border: '1px solid var(--border-subtle, #2b2d30)',
                  borderRadius: 6,
                  color: 'var(--text-primary, #f3f3f3)',
                  fontSize: 12,
                  outline: 'none',
                  boxSizing: 'border-box',
                  transition: 'border-color 0.15s ease',
                }}
                onFocus={(e) => (e.target.style.borderColor = 'var(--border-bright, #444c56)')}
                onBlur={(e) => (e.target.style.borderColor = 'var(--border-subtle, #2b2d30)')}
              />
            </div>
          )}

          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 500, color: 'var(--text-secondary, #9d9d9d)', marginBottom: 5 }}>
              Correo Electrónico
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="usuario@empresa.com"
              style={{
                width: '100%',
                padding: '9px 12px',
                background: 'var(--bg-input, #1f1f1f)',
                border: '1px solid var(--border-subtle, #2b2d30)',
                borderRadius: 6,
                color: 'var(--text-primary, #f3f3f3)',
                fontSize: 12,
                outline: 'none',
                boxSizing: 'border-box',
                transition: 'border-color 0.15s ease',
              }}
              onFocus={(e) => (e.target.style.borderColor = 'var(--border-bright, #444c56)')}
              onBlur={(e) => (e.target.style.borderColor = 'var(--border-subtle, #2b2d30)')}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 500, color: 'var(--text-secondary, #9d9d9d)', marginBottom: 5 }}>
              Contraseña
            </label>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mínimo 6 caracteres"
              style={{
                width: '100%',
                padding: '9px 12px',
                background: 'var(--bg-input, #1f1f1f)',
                border: '1px solid var(--border-subtle, #2b2d30)',
                borderRadius: 6,
                color: 'var(--text-primary, #f3f3f3)',
                fontSize: 12,
                outline: 'none',
                boxSizing: 'border-box',
                transition: 'border-color 0.15s ease',
              }}
              onFocus={(e) => (e.target.style.borderColor = 'var(--border-bright, #444c56)')}
              onBlur={(e) => (e.target.style.borderColor = 'var(--border-subtle, #2b2d30)')}
            />
          </div>

          {/* Primary Submit Button */}
          <button
            type="submit"
            disabled={loading}
            style={{
              marginTop: 4,
              padding: '10px 16px',
              fontSize: 12.5,
              fontWeight: 600,
              background: '#f3f3f3',
              color: '#181818',
              border: 'none',
              borderRadius: 6,
              cursor: loading ? 'not-allowed' : 'pointer',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.4)',
              transition: 'all 0.15s ease',
              opacity: loading ? 0.7 : 1,
            }}
            onMouseEnter={(e) => {
              if (!loading) (e.currentTarget as HTMLButtonElement).style.background = '#ffffff'
            }}
            onMouseLeave={(e) => {
              if (!loading) (e.currentTarget as HTMLButtonElement).style.background = '#f3f3f3'
            }}>
            {loading ? 'Procesando...' : mode === 'login' ? 'Entrar a la Plataforma' : 'Completar Registro'}
          </button>

          {/* Quick Demo Access Divider */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            margin: '4px 0 0',
          }}>
            <div style={{ flex: 1, height: 1, background: 'var(--border-subtle, #2b2d30)' }} />
            <span style={{ fontSize: 10, color: 'var(--text-muted, #6e6e6e)', textTransform: 'uppercase', letterSpacing: 1 }}>o</span>
            <div style={{ flex: 1, height: 1, background: 'var(--border-subtle, #2b2d30)' }} />
          </div>

          {/* Quick Demo Access Button */}
          <button
            type="button"
            onClick={onSuccess}
            style={{
              padding: '9px 14px',
              fontSize: 11.5,
              fontWeight: 500,
              background: 'var(--bg-card, #252526)',
              color: 'var(--text-primary, #f3f3f3)',
              border: '1px solid var(--border-subtle, #2b2d30)',
              borderRadius: 6,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
            }}
            onMouseEnter={(e) => {
              const btn = e.currentTarget as HTMLButtonElement
              btn.style.background = 'var(--bg-hover, #2a2d2e)'
              btn.style.borderColor = 'var(--border-bright, #444c56)'
            }}
            onMouseLeave={(e) => {
              const btn = e.currentTarget as HTMLButtonElement
              btn.style.background = 'var(--bg-card, #252526)'
              btn.style.borderColor = 'var(--border-subtle, #2b2d30)'
            }}>
            <span>Acceso Rápido (Modo Demostración / Invitado)</span>
          </button>
        </form>

        {/* Footer info & Supabase Auth note */}
        <div style={{ marginTop: 20, textAlign: 'center', fontSize: 10.5, color: 'var(--text-muted, #6e6e6e)', lineHeight: 1.5 }}>
          <span>Control de accesos y perfiles empresariales con Supabase Auth.</span>
        </div>
      </div>
    </div>
  )
}
