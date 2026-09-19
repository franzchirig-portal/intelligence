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
          // If Supabase has email confirmation enabled
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
      background: 'radial-gradient(circle at 50% 30%, #061e24 0%, #040a0d 80%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 16,
      fontFamily: "'Inter', sans-serif",
    }}>
      {/* Glow effect background */}
      <div style={{
        position: 'absolute',
        width: 450,
        height: 450,
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(34, 211, 238, 0.08) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      <div style={{
        width: '100%',
        maxWidth: 420,
        background: 'rgba(9, 27, 34, 0.85)',
        backdropFilter: 'blur(16px)',
        border: '1px solid rgba(20, 184, 166, 0.35)',
        borderRadius: 12,
        padding: '32px 28px',
        boxShadow: '0 20px 50px rgba(0, 0, 0, 0.7), 0 0 30px rgba(20, 184, 166, 0.1)',
        position: 'relative',
        zIndex: 1,
      }}>
        {/* Brand Header */}
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 48,
            height: 48,
            borderRadius: 10,
            background: 'var(--bg-card)',
            border: '1px solid var(--border-default)',
            boxShadow: 'none',
            marginBottom: 12,
          }}>
            <svg width="26" height="26" viewBox="0 0 100 100" fill="none">
              <path d="M 50 10 A 40 40 0 1 0 85 75 L 70 65 A 25 25 0 1 1 50 25 Z" fill="#ffffff" />
              <polygon points="50,38 60,50 50,62 40,50" fill="#9d9d9d" />
            </svg>
          </div>
          <h1 style={{
            fontSize: 20,
            fontWeight: 800,
            color: '#f1f5f9',
            margin: 0,
            letterSpacing: 1.5,
          }}>
            CITRINO
          </h1>
          <div style={{
            fontSize: 10,
            fontWeight: 700,
            color: 'var(--text-muted)',
            letterSpacing: 1.8,
            textTransform: 'uppercase',
            marginTop: 3,
          }}>
            Inteligencia Inmobiliaria
          </div>
        </div>

        {/* Mode Switcher Tabs */}
        <div style={{
          display: 'flex',
          background: 'var(--bg-surface)',
          padding: 3,
          borderRadius: 8,
          marginBottom: 20,
          border: '1px solid var(--border-subtle)',
        }}>
          <button
            type="button"
            onClick={() => { setMode('login'); setErrorMsg(null); setSuccessMsg(null); }}
            style={{
              flex: 1,
              padding: '8px 0',
              fontSize: 12,
              fontWeight: 600,
              background: mode === 'login' ? 'var(--bg-active)' : 'transparent',
              color: mode === 'login' ? '#ffffff' : '#94a3b8',
              border: mode === 'login' ? '1px solid var(--border-bright)' : 'none',
              borderRadius: 6,
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}>
            Iniciar Sesión
          </button>
          <button
            type="button"
            onClick={() => { setMode('register'); setErrorMsg(null); setSuccessMsg(null); }}
            style={{
              flex: 1,
              padding: '8px 0',
              fontSize: 12,
              fontWeight: 600,
              background: mode === 'register' ? 'var(--bg-active)' : 'transparent',
              color: mode === 'register' ? '#ffffff' : '#94a3b8',
              border: mode === 'register' ? '1px solid var(--border-bright)' : 'none',
              borderRadius: 6,
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}>
            Crear Cuenta
          </button>
        </div>

        {/* Error Alert */}
        {errorMsg && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.12)',
            border: '1px solid rgba(239, 68, 68, 0.35)',
            color: '#fca5a5',
            padding: '10px 12px',
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
            padding: '10px 12px',
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
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#94a3b8', marginBottom: 5 }}>
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
                  background: 'var(--bg-input, #061318)',
                  border: '1px solid var(--border-default, #1a4354)',
                  borderRadius: 6,
                  color: '#f1f5f9',
                  fontSize: 12.5,
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>
          )}

          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#94a3b8', marginBottom: 5 }}>
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
                background: 'var(--bg-input, #061318)',
                border: '1px solid var(--border-default, #1a4354)',
                borderRadius: 6,
                color: '#f1f5f9',
                fontSize: 12.5,
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#94a3b8', marginBottom: 5 }}>
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
                background: 'var(--bg-input, #061318)',
                border: '1px solid var(--border-default, #1a4354)',
                borderRadius: 6,
                color: '#f1f5f9',
                fontSize: 12.5,
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              marginTop: 6,
              padding: '11px 16px',
              fontSize: 13,
              fontWeight: 700,
              background: 'linear-gradient(135deg, #0e7490, #14b8a6)',
              color: '#ffffff',
              border: 'none',
              borderRadius: 6,
              cursor: loading ? 'not-allowed' : 'pointer',
              boxShadow: '0 4px 15px rgba(20, 184, 166, 0.3)',
              transition: 'all 0.2s',
              opacity: loading ? 0.7 : 1,
            }}>
            {loading ? 'Procesando...' : mode === 'login' ? 'Entrar a la Plataforma' : 'Completar Registro'}
          </button>

          {/* Quick Demo Access Divider */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            margin: '6px 0 2px',
          }}>
            <div style={{ flex: 1, height: 1, background: 'var(--border-subtle, #133340)' }} />
            <span style={{ fontSize: 10, color: 'var(--text-muted, #4e6b78)', textTransform: 'uppercase', letterSpacing: 1 }}>o</span>
            <div style={{ flex: 1, height: 1, background: 'var(--border-subtle, #133340)' }} />
          </div>

          <button
            type="button"
            onClick={onSuccess}
            style={{
              padding: '9px 14px',
              fontSize: 12,
              fontWeight: 600,
              background: 'var(--bg-card)',
              color: 'var(--text-primary)',
              border: '1px dashed var(--border-default)',
              borderRadius: 6,
              cursor: 'pointer',
              transition: 'all 0.2s',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
            }}>
            <span>Acceso Rápido (Modo Demostración / Invitado)</span>
          </button>
        </form>

        {/* Footer info & Supabase Auth note */}
        <div style={{ marginTop: 20, textAlign: 'center', fontSize: 10.5, color: '#64748b', lineHeight: 1.5 }}>
          <span>Control de accesos y perfiles empresariales con Supabase Auth.</span>
        </div>
      </div>
    </div>
  )
}
