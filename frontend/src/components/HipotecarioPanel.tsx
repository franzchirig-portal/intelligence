import './HipotecarioPanel.css'

export default function HipotecarioPanel() {
  return (
    <div className="hipotecario-panel">
      <div className="hipotecario-content">
        <div className="hipotecario-icon">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <path d="M3 9h18" />
            <path d="M9 21V9" />
          </svg>
        </div>
        <div className="hipotecario-badge">Próximamente</div>
        <h2 className="hipotecario-title">Endeudamiento Hipotecario</h2>
        <p className="hipotecario-desc">
          Módulo institucional de análisis de capacidad crediticia, tasas hipotecarias,
          ratios de endeudamiento y proyecciones de absorción crediticia del mercado inmobiliario.
        </p>
        <div className="hipotecario-features">
          <div className="hip-feature">
            <span className="hip-feature-dot" />
            Capacidad de crédito por segmento
          </div>
          <div className="hip-feature">
            <span className="hip-feature-dot" />
            Tasas hipotecarias comparativas
          </div>
          <div className="hip-feature">
            <span className="hip-feature-dot" />
            Ratio deuda / ingreso por tipología
          </div>
          <div className="hip-feature">
            <span className="hip-feature-dot" />
            Proyección de absorción crediticia
          </div>
        </div>
      </div>
    </div>
  )
}
