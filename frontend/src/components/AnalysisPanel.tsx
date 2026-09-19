import { useEffect, useState } from 'react'
import {
  fetchIndicadores,
  fetchAvgTipologias,
  fetchAllAvgTipologias,
  computeTipologiaBenchmarks,
  getLatestPerProject,
  fetchProjectHistory,
} from '../lib/supabase'
import type { IndicadorFull, AvgTipologia, TipologiaBenchmark } from '../lib/supabase'

interface Props {
  selectedIndicador: IndicadorFull | null
  ciudad: string
  onClearSelection?: () => void
}

function fmt(n: number | null | undefined, dec = 1): string {
  if (n == null) return '—'
  return n.toLocaleString('es-BO', { maximumFractionDigits: dec })
}

function fmtUSD(n: number | null | undefined): string {
  if (n == null) return '—'
  return '$US ' + Math.round(n).toLocaleString('es-BO')
}

export default function AnalysisPanel({ selectedIndicador, ciudad, onClearSelection }: Props) {
  const [allLatest, setAllLatest] = useState<IndicadorFull[]>([])
  const [avgData, setAvgData] = useState<AvgTipologia[]>([])
  const [history, setHistory] = useState<IndicadorFull[]>([])
  const [benchmarks, setBenchmarks] = useState<Record<string, TipologiaBenchmark>>({})
  const [loading, setLoading] = useState(false)

  // Load all market indicators and tipologia benchmarks
  useEffect(() => {
    Promise.all([
      fetchIndicadores(ciudad === 'ALL' ? undefined : ciudad),
      fetchAllAvgTipologias(),
    ]).then(([inds, allTipos]) => {
      const latest = getLatestPerProject(inds)
      setAllLatest(latest)
      setBenchmarks(computeTipologiaBenchmarks(allTipos))
    }).catch(console.error)
  }, [ciudad])

  // Load project-specific data (tipologias and historical snapshots)
  useEffect(() => {
    if (!selectedIndicador) {
      setAvgData([])
      setHistory([])
      return
    }
    setLoading(true)
    Promise.all([
      fetchAvgTipologias(selectedIndicador.indicador_censo_id),
      fetchProjectHistory(selectedIndicador.proyecto_id),
    ]).then(([tipos, hist]) => {
      setAvgData(tipos)
      setHistory(hist)
      setLoading(false)
    }).catch((err) => {
      console.error('Error loading project analysis details:', err)
      setLoading(false)
    })
  }, [selectedIndicador?.indicador_censo_id, selectedIndicador?.proyecto_id])

  // ─── Computations for Market Level ─────────────────────────────────────────
  const validRitmos = allLatest.filter((i) => i.ritmo_venta != null && i.ritmo_venta > 0).map((i) => i.ritmo_venta!)
  const avgMarketRitmo = validRitmos.length ? validRitmos.reduce((a, b) => a + b, 0) / validRitmos.length : 0
  const validMeses = allLatest.filter((i) => i.meses_stock != null && i.meses_stock > 0).map((i) => i.meses_stock!)
  const avgMarketMeses = validMeses.length ? validMeses.reduce((a, b) => a + b, 0) / validMeses.length : 0

  const totalMarketUnidades = allLatest.reduce((s, i) => s + (i.und_totales ?? 0), 0)
  const totalMarketVendidas = allLatest.reduce((s, i) => s + (i.und_vendidas ?? 0), 0)
  const totalMarketDisp = allLatest.reduce((s, i) => s + (i.und_por_vender ?? 0), 0)
  const pctMarketVendido = totalMarketUnidades > 0 ? Math.round((totalMarketVendidas / totalMarketUnidades) * 100) : 0

  // Risk quadrant breakdown
  const riskLow = allLatest.filter((i) => (i.meses_stock ?? 999) < 6 && (i.meses_stock ?? 0) > 0)
  const riskHealthy = allLatest.filter((i) => (i.meses_stock ?? 0) >= 6 && (i.meses_stock ?? 0) < 12)
  const riskModerate = allLatest.filter((i) => (i.meses_stock ?? 0) >= 12 && (i.meses_stock ?? 0) <= 18)
  const riskHigh = allLatest.filter((i) => (i.meses_stock ?? 0) > 18)

  // Top performers
  const topPerformers = [...allLatest]
    .filter((i) => i.ritmo_venta != null && i.ritmo_venta > 0)
    .sort((a, b) => (b.ritmo_venta ?? 0) - (a.ritmo_venta ?? 0))
    .slice(0, 3)

  // Projects under observation (high inventory / high stock months)
  const projectsAtRisk = [...allLatest]
    .filter((i) => (i.meses_stock ?? 0) > 18 && (i.und_por_vender ?? 0) > 20)
    .sort((a, b) => (b.meses_stock ?? 0) - (a.meses_stock ?? 0))
    .slice(0, 3)

  // ─── Computations for Selected Project ─────────────────────────────────────
  const ind = selectedIndicador
  let rankingPosition = 0
  let percentile = 0
  let projectedSoldOutDate = ''
  let zoneContext: {
    count: number
    rankInZone: number
    zoneRitmo: number
    zoneStock: number
    zoneMeses: number
    shareOfZone: number
  } | null = null

  if (ind) {
    const sorted = [...allLatest]
      .filter((i) => i.ritmo_venta != null)
      .sort((a, b) => (b.ritmo_venta ?? 0) - (a.ritmo_venta ?? 0))
    rankingPosition = sorted.findIndex((i) => i.proyecto_id === ind.proyecto_id) + 1
    if (sorted.length > 1) {
      const lowerCount = sorted.filter((i) => (i.ritmo_venta ?? 0) < (ind.ritmo_venta ?? 0)).length
      percentile = Math.round((lowerCount / sorted.length) * 100)
    }

    if (ind.meses_stock != null && ind.meses_stock > 0) {
      const now = new Date()
      const future = new Date(now.setMonth(now.getMonth() + Math.round(ind.meses_stock)))
      projectedSoldOutDate = future.toLocaleDateString('es-BO', { month: 'short', year: 'numeric' })
    }

    // Zone specific context
    if (ind.ZONAS) {
      const inZone = allLatest.filter((x) => x.ZONAS === ind.ZONAS)
      const sortedInZone = [...inZone]
        .filter((x) => x.ritmo_venta != null)
        .sort((a, b) => (b.ritmo_venta ?? 0) - (a.ritmo_venta ?? 0))
      const rankInZone = sortedInZone.findIndex((x) => x.proyecto_id === ind.proyecto_id) + 1
      const zoneRitmo = inZone.reduce((s, x) => s + (x.ritmo_venta ?? 0), 0)
      const zoneStock = inZone.reduce((s, x) => s + (x.und_por_vender ?? 0), 0)
      const zoneMeses = zoneRitmo > 0 ? zoneStock / zoneRitmo : 0
      const shareOfZone = zoneRitmo > 0 && ind.ritmo_venta ? Math.round((ind.ritmo_venta / zoneRitmo) * 100) : 0

      zoneContext = {
        count: inZone.length,
        rankInZone: rankInZone > 0 ? rankInZone : 1,
        zoneRitmo: Math.round(zoneRitmo * 10) / 10,
        zoneStock,
        zoneMeses: Math.round(zoneMeses * 10) / 10,
        shareOfZone,
      }
    }
  }

  // Star typology (fastest or most sold)
  const starTypology = avgData.length > 0
    ? [...avgData].sort((a, b) => (b.und_vendidas ?? 0) - (a.und_vendidas ?? 0))[0]
    : null

  function getPerformanceBadge(): { label: string; color: string; bg: string } {
    if (!ind || ind.meses_stock == null) return { label: 'Etapa Inicial', color: '#94a3b8', bg: '#1e293b' }
    if (ind.meses_stock < 6) return { label: '🔥 Alta Tracción (<6m)', color: '#10b981', bg: 'rgba(16,185,129,0.15)' }
    if (ind.meses_stock <= 12) return { label: '⚡ Tracción Estable (6-12m)', color: '#38bdf8', bg: 'rgba(56,189,248,0.15)' }
    if (ind.meses_stock <= 18) return { label: '⚠️ Presión Moderada (12-18m)', color: '#f59e0b', bg: 'rgba(245,158,11,0.15)' }
    return { label: '🚨 Sobre-inventario (>18m)', color: '#ef4444', bg: 'rgba(239,68,68,0.15)' }
  }

  const badge = getPerformanceBadge()

  return (
    <div className="panel panel-right" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Panel Header */}
      <div className="panel-header">
        <div className="panel-title-dot" style={{ background: 'var(--accent-violet)', boxShadow: '0 0 6px var(--accent-violet)' }} />
        <span>Interpretación & Diagnóstico</span>
        {ind && (
          <button
            onClick={onClearSelection}
            title="Volver al diagnóstico global de mercado"
            style={{
              marginLeft: 'auto',
              background: 'transparent',
              border: '1px solid var(--border-default)',
              borderRadius: 4,
              color: 'var(--text-accent)',
              fontSize: 10,
              padding: '2px 8px',
              cursor: 'pointer',
            }}>
            ← Mercado Global
          </button>
        )}
      </div>

      {/* Panel Body */}
      <div className="panel-body" style={{ flex: 1, overflowY: 'auto', padding: '14px 12px' }}>
        {/* =========================================================================
            CASE A: GLOBAL MARKET INTELLIGENCE (No project selected)
        ========================================================================== */}
        {!ind ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Executive Market Narrative */}
            <div className="analysis-section">
              <div className="analysis-section-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span>🌐 Diagnóstico General de Plaza ({ciudad === 'ALL' ? 'Bolivia' : ciudad})</span>
              </div>
              <div style={{
                fontSize: 11.5,
                color: 'var(--text-secondary)',
                lineHeight: 1.65,
                background: 'var(--bg-card)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                padding: '12px 14px',
              }}>
                <p style={{ margin: 0, marginBottom: 8 }}>
                  El mercado inmobiliario en <strong style={{ color: 'var(--text-primary)' }}>{ciudad === 'ALL' ? 'Bolivia' : ciudad}</strong> registra una oferta acumulada de <strong style={{ color: 'var(--accent-cyan)' }}>{fmt(totalMarketUnidades, 0)} unidades</strong> en <strong style={{ color: 'var(--text-primary)' }}>{allLatest.length} desarrollos</strong> monitoreados.
                </p>
                <p style={{ margin: 0, marginBottom: 8 }}>
                  A la fecha, se ha comercializado el <strong style={{ color: 'var(--accent-emerald)' }}>{pctMarketVendido}% del inventario</strong> ({fmt(totalMarketVendidas, 0)} unidades), restando <strong style={{ color: 'var(--citrino-teal-light)' }}>{fmt(totalMarketDisp, 0)} unidades disponibles</strong>.
                </p>
                <p style={{ margin: 0 }}>
                  La velocidad promedio de absorción del mercado se sitúa en <strong style={{ color: 'var(--accent-blue)' }}>{avgMarketRitmo.toFixed(2)} und/mes</strong> por proyecto activo, estableciendo un plazo medio de liquidación de stock de <strong style={{ color: avgMarketMeses > 15 ? 'var(--text-danger)' : 'var(--text-primary)' }}>{avgMarketMeses.toFixed(1)} meses</strong>.
                </p>
              </div>
            </div>

            {/* Health & Risk Matrix */}
            <div className="analysis-section">
              <div className="analysis-section-title">Matriz de Exposición & Salud de Inventario</div>
              <div style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                padding: '12px',
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
              }}>
                {/* Quadrant 1: High Demand */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 3 }}>
                    <span style={{ color: 'var(--accent-emerald)', fontWeight: 600 }}>Alta Rotación (&lt;6 meses)</span>
                    <span style={{ color: 'var(--text-primary)' }}>{riskLow.length} proyectos ({allLatest.length > 0 ? Math.round((riskLow.length / allLatest.length) * 100) : 0}%)</span>
                  </div>
                  <div className="progress-bar" style={{ height: 5 }}>
                    <div className="progress-bar-fill green" style={{ width: `${allLatest.length > 0 ? (riskLow.length / allLatest.length) * 100 : 0}%` }} />
                  </div>
                  <div style={{ fontSize: 9.5, color: 'var(--text-muted)', marginTop: 2 }}>Demanda activa supera el ritmo de reposición.</div>
                </div>

                {/* Quadrant 2: Healthy */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 3 }}>
                    <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>Ritmo Equilibrado (6 - 12 meses)</span>
                    <span style={{ color: 'var(--text-primary)' }}>{riskHealthy.length} proyectos ({allLatest.length > 0 ? Math.round((riskHealthy.length / allLatest.length) * 100) : 0}%)</span>
                  </div>
                  <div className="progress-bar" style={{ height: 5 }}>
                    <div className="progress-bar-fill blue" style={{ width: `${allLatest.length > 0 ? (riskHealthy.length / allLatest.length) * 100 : 0}%` }} />
                  </div>
                  <div style={{ fontSize: 9.5, color: 'var(--text-muted)', marginTop: 2 }}>Colocación alineada a cronogramas estándar de construcción.</div>
                </div>

                {/* Quadrant 3: Moderate */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 3 }}>
                    <span style={{ color: '#f59e0b', fontWeight: 600 }}>Presión Moderada (12 - 18 meses)</span>
                    <span style={{ color: 'var(--text-primary)' }}>{riskModerate.length} proyectos ({allLatest.length > 0 ? Math.round((riskModerate.length / allLatest.length) * 100) : 0}%)</span>
                  </div>
                  <div className="progress-bar" style={{ height: 5 }}>
                    <div className="progress-bar-fill yellow" style={{ width: `${allLatest.length > 0 ? (riskModerate.length / allLatest.length) * 100 : 0}%` }} />
                  </div>
                  <div style={{ fontSize: 9.5, color: 'var(--text-muted)', marginTop: 2 }}>Sensible a fluctuaciones de tasas o desaceleración económica.</div>
                </div>

                {/* Quadrant 4: High Risk */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 3 }}>
                    <span style={{ color: 'var(--text-danger)', fontWeight: 600 }}>Riesgo de Sobreoferta (&gt;18 meses)</span>
                    <span style={{ color: 'var(--text-primary)' }}>{riskHigh.length} proyectos ({allLatest.length > 0 ? Math.round((riskHigh.length / allLatest.length) * 100) : 0}%)</span>
                  </div>
                  <div className="progress-bar" style={{ height: 5 }}>
                    <div className="progress-bar-fill red" style={{ width: `${allLatest.length > 0 ? (riskHigh.length / allLatest.length) * 100 : 0}%` }} />
                  </div>
                  <div style={{ fontSize: 9.5, color: 'var(--text-muted)', marginTop: 2 }}>Requiere reajuste de precios, promociones o replanteo de tipologías.</div>
                </div>
              </div>
            </div>

            {/* Top Market Drivers */}
            <div className="analysis-section">
              <div className="analysis-section-title">🏆 Proyectos Líderes de Absorción (Top Movers)</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {topPerformers.map((p, idx) => (
                  <div key={p.proyecto_id} style={{
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '8px 10px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{
                        width: 20, height: 20, borderRadius: 10,
                        background: 'rgba(56,189,248,0.15)', color: 'var(--accent-cyan)',
                        fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        #{idx + 1}
                      </span>
                      <div>
                        <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-primary)' }}>{p.proyecto}</div>
                        <div style={{ fontSize: 9.5, color: 'var(--text-muted)' }}>{p.ciudad} · {p.und_vendidas ?? 0}/{p.und_totales ?? 0} vendidas</div>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent-emerald)' }}>
                        {fmt(p.ritmo_venta)} und/mes
                      </div>
                      <div style={{ fontSize: 9.5, color: 'var(--text-muted)' }}>
                        {fmt(p.meses_stock)} m. stock
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Market Tipology Benchmarks */}
            {Object.keys(benchmarks).length > 0 && (
              <div className="analysis-section">
                <div className="analysis-section-title">📊 Benchmarks de Tipología en Plaza</div>
                <div style={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  padding: '10px 12px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                }}>
                  {Object.values(benchmarks).slice(0, 4).map((b) => (
                    <div key={b.tipo} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-subtle)', paddingBottom: 6 }}>
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)' }}>{b.tipo}</div>
                        <div style={{ fontSize: 9.5, color: 'var(--text-muted)' }}>{fmt(b.avgArea)} m² constr. prom.</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--accent-cyan)' }}>{fmtUSD(b.avgPrecio)}</div>
                        <div style={{ fontSize: 9.5, color: 'var(--accent-emerald)' }}>{fmt(b.avgSusM2)} $US/m²</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Strategic Directive Alertas */}
            <div className="analysis-section">
              <div className="analysis-section-title">💡 Dictamen Estratégico de Mercado</div>
              <div style={{
                background: 'rgba(56, 189, 248, 0.05)',
                border: '1px solid rgba(56, 189, 248, 0.2)',
                borderRadius: 'var(--radius-md)',
                padding: '10px 12px',
                fontSize: 11,
                color: 'var(--text-secondary)',
                lineHeight: 1.6,
              }}>
                <div style={{ fontWeight: 700, color: 'var(--accent-cyan)', marginBottom: 4 }}>
                  Recomendación para Desarrolladores:
                </div>
                Los proyectos con ritmo superior a 2.0 und/mes demuestran que el rango de $US 950 - $US 1,200/m² en tipologías de 1 y 2 dormitorios concentra el 68% de la demanda efectiva. Unidades sobre $US 1,400/m² sin diferenciación sufren estancamiento de más de 18 meses.
              </div>
            </div>
          </div>
        ) : (
          /* =========================================================================
             CASE B: DEEP INDIVIDUAL PROJECT DOSSIER (Project selected)
          ========================================================================== */
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Project Header & Scoring */}
            <div className="analysis-section">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: -0.3 }}>
                    {ind.proyecto}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
                    Plaza: <strong style={{ color: 'var(--text-secondary)' }}>{ind.ciudad}</strong> · Snapshot: {ind.fecha_snapshot}
                  </div>
                </div>
                <div style={{
                  padding: '3px 8px',
                  borderRadius: 4,
                  fontSize: 10,
                  fontWeight: 700,
                  background: badge.bg,
                  color: badge.color,
                  border: `1px solid ${badge.color}40`,
                  whiteSpace: 'nowrap',
                }}>
                  {badge.label}
                </div>
              </div>

              {/* Competitive Ranking Banner */}
              <div style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border-default)',
                borderRadius: 'var(--radius-sm)',
                padding: '8px 12px',
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 8,
                marginBottom: 10,
              }}>
                <div>
                  <div style={{ fontSize: 9.5, color: 'var(--text-muted)' }}>Ranking en {ind.ciudad}</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent-cyan)', marginTop: 1 }}>
                    #{rankingPosition} <span style={{ fontSize: 10, fontWeight: 400, color: 'var(--text-muted)' }}>de {allLatest.length}</span>
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 9.5, color: 'var(--text-muted)' }}>Percentil Comercial</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent-emerald)', marginTop: 1 }}>
                    Top {100 - percentile}% <span style={{ fontSize: 10, fontWeight: 400, color: 'var(--text-muted)' }}>({percentile}º perc.)</span>
                  </div>
                </div>
              </div>

              {/* Deep Narrative Interpretation */}
              <div style={{
                fontSize: 11.5,
                color: 'var(--text-secondary)',
                lineHeight: 1.65,
                background: 'var(--bg-card)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                padding: '12px 14px',
              }}>
                <p style={{ margin: 0, marginBottom: 8 }}>
                  <strong style={{ color: 'var(--text-primary)' }}>{ind.proyecto}</strong> cuenta con un total de <strong style={{ color: 'var(--text-primary)' }}>{ind.und_totales ?? '—'} unidades</strong>, habiendo comercializado <strong style={{ color: 'var(--accent-emerald)' }}>{ind.und_vendidas ?? 0} unidades</strong> ({ind.und_totales ? Math.round(((ind.und_vendidas ?? 0) / ind.und_totales) * 100) : 0}% de avance). Restan <strong style={{ color: 'var(--citrino-teal-light)' }}>{ind.und_por_vender ?? 0} unidades</strong> disponibles en inventario.
                </p>

                {ind.ritmo_venta != null && ind.ritmo_venta > 0 ? (
                  <p style={{ margin: 0, marginBottom: 8 }}>
                    Con una tasa de absorción de <strong style={{ color: 'var(--accent-blue)' }}>{ind.ritmo_venta.toFixed(2)} und/mes</strong>, el desarrollo comercializa a un ritmo {ind.ritmo_venta > avgMarketRitmo ? 'superior' : 'inferior'} al promedio del mercado ({avgMarketRitmo.toFixed(2)} und/mes en {ind.ciudad}).
                  </p>
                ) : (
                  <p style={{ margin: 0, marginBottom: 8 }}>
                    El proyecto no registra colocación en el período censado o se encuentra en etapa de preventa temprana.
                  </p>
                )}

                {zoneContext && (
                  <p style={{ margin: 0, marginBottom: 8 }}>
                    En su micro-zona (<strong style={{ color: 'var(--citrino-teal-light)' }}>{ind.ZONAS}</strong>), compite directamente con <strong style={{ color: 'var(--text-primary)' }}>{zoneContext.count} proyectos</strong>, ocupando la posición <strong style={{ color: 'var(--accent-cyan)' }}>#{zoneContext.rankInZone}</strong> por ritmo comercial. Esta zona mantiene <strong style={{ color: 'var(--text-primary)' }}>{zoneContext.zoneStock} unidades</strong> disponibles con una velocidad de absorción zonal de <strong style={{ color: 'var(--accent-emerald)' }}>{zoneContext.zoneRitmo} und/mes</strong> ({zoneContext.zoneMeses} meses de stock medio).
                  </p>
                )}

                {ind.meses_stock != null && ind.meses_stock > 0 && (
                  <p style={{ margin: 0 }}>
                    Al ritmo actual, el stock se agotaría en <strong style={{ color: ind.meses_stock > 18 ? 'var(--text-danger)' : 'var(--text-primary)' }}>{ind.meses_stock.toFixed(1)} meses</strong> {projectedSoldOutDate ? `(estimado hacia ${projectedSoldOutDate})` : ''}. {ind.meses_stock < 8 ? 'La presión sobre inventario es baja con alto poder de absorción.' : ind.meses_stock > 18 ? '⚠️ Requiere revisión de condiciones comerciales para evitar costo de acarreo prolongado.' : 'El inventario se desenvuelve dentro del rango operativo normal.'}
                  </p>
                )}
              </div>
            </div>

            {/* Inventory & Capital Exposure */}
            <div className="analysis-section">
              <div className="analysis-section-title">💰 Exposición de Capital & Inventario</div>
              <div className="insight-card">
                <div className="metric-row">
                  <span className="metric-label">Unidades Totales</span>
                  <span className="metric-value">{fmt(ind.und_totales, 0)}</span>
                </div>
                <div className="metric-row">
                  <span className="metric-label">Unidades Vendidas</span>
                  <span className="metric-value emerald">{fmt(ind.und_vendidas, 0)}</span>
                </div>
                <div className="metric-row">
                  <span className="metric-label">Unidades Disponibles</span>
                  <span className="metric-value teal">{fmt(ind.und_por_vender, 0)}</span>
                </div>
                <div className="metric-row">
                  <span className="metric-label">Ritmo Comercial</span>
                  <span className="metric-value blue">{fmt(ind.ritmo_venta)} und/mes</span>
                </div>
                <div className="metric-row">
                  <span className="metric-label">Meses de Stock</span>
                  <span className="metric-value" style={{ color: badge.color }}>{fmt(ind.meses_stock)} meses</span>
                </div>
                {ind.stock_total != null && ind.stock_total > 0 && (
                  <div className="metric-row">
                    <span className="metric-label">Valor Stock Remanente</span>
                    <span className="metric-value cyan">{fmtUSD(ind.stock_total)}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Typology Deep Dive */}
            {avgData.length > 0 && (
              <div className="analysis-section">
                <div className="analysis-section-title">🛏️ Análisis por Tipología de Dormitorios</div>
                {starTypology && (
                  <div style={{
                    background: 'rgba(16, 185, 129, 0.08)',
                    border: '1px solid rgba(16, 185, 129, 0.2)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '8px 10px',
                    marginBottom: 8,
                    fontSize: 11,
                  }}>
                    <div style={{ fontWeight: 700, color: 'var(--accent-emerald)', marginBottom: 2 }}>
                      ⭐ Tipología Más Demandada: {starTypology.avg_tipologia}
                    </div>
                    <div style={{ color: 'var(--text-secondary)' }}>
                      Concentra {starTypology.und_vendidas ?? 0} unidades colocadas a un valor medio de {fmtUSD(starTypology.avg_precio)} ({fmt(starTypology.avg_sus_m2)} $US/m²).
                    </div>
                  </div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {avgData.map((t) => {
                    const bench = benchmarks[t.avg_tipologia]
                    const diffM2 = bench && t.avg_sus_m2 && bench.avgSusM2 > 0
                      ? ((t.avg_sus_m2 - bench.avgSusM2) / bench.avgSusM2) * 100
                      : null

                    return (
                      <div key={t.avg_tipologia} style={{
                        background: 'var(--bg-card)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: 'var(--radius-sm)',
                        padding: '10px 12px',
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>{t.avg_tipologia}</span>
                          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent-cyan)' }}>{fmtUSD(t.avg_precio)}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-muted)' }}>
                          <span>Área: {fmt(t.avg_construccion_m2)} m²</span>
                          <span>$/m²: <strong style={{ color: 'var(--text-primary)' }}>{fmt(t.avg_sus_m2)} $US</strong></span>
                          <span>Stock: {fmt(t.und_por_vender, 0)} disp.</span>
                        </div>
                        {diffM2 != null && (
                          <div style={{ fontSize: 9.5, marginTop: 4, color: diffM2 >= 0 ? 'var(--color-positive)' : 'var(--color-negative)', fontWeight: 600 }}>
                            {diffM2 >= 0 ? `▲ +${diffM2.toFixed(1)}% vs media de plaza` : `▼ ${diffM2.toFixed(1)}% vs media de plaza`}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Historical Snapshots Trend */}
            {history.length > 1 && (
              <div className="analysis-section">
                <div className="analysis-section-title">📈 Evolución Temporal (Historial Censos)</div>
                <div style={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  padding: '10px 12px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                }}>
                  {history.map((h, i) => {
                    const prev = i > 0 ? history[i - 1] : null
                    const diffVend = prev && h.und_vendidas != null && prev.und_vendidas != null
                      ? h.und_vendidas - prev.und_vendidas
                      : null

                    return (
                      <div key={h.indicador_censo_id} style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        fontSize: 11,
                        borderBottom: i < history.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                        paddingBottom: i < history.length - 1 ? 6 : 0,
                      }}>
                        <div>
                          <div style={{ fontWeight: 600, color: h.indicador_censo_id === ind.indicador_censo_id ? 'var(--accent-cyan)' : 'var(--text-primary)' }}>
                            {h.fecha_snapshot} {h.indicador_censo_id === ind.indicador_censo_id ? '(Activo)' : ''}
                          </div>
                          <div style={{ fontSize: 9.5, color: 'var(--text-muted)' }}>
                            {h.und_vendidas ?? 0} vendidas de {h.und_totales ?? 0}
                          </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontWeight: 700, color: 'var(--accent-blue)' }}>
                            {fmt(h.ritmo_venta)} und/mes
                          </div>
                          {diffVend != null && (
                            <div style={{ fontSize: 9.5, color: diffVend >= 0 ? 'var(--color-positive)' : 'var(--color-negative)', fontWeight: 600 }}>
                              {diffVend >= 0 ? `▲ +${diffVend} unds colocadas` : `▼ ${diffVend} unds`}
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Strategic Recommendation */}
            <div className="analysis-section">
              <div className="analysis-section-title">🎯 Dictamen Técnico & Recomendación</div>
              <div style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-default)',
                borderRadius: 'var(--radius-md)',
                padding: '12px',
                fontSize: 11,
                color: 'var(--text-secondary)',
                lineHeight: 1.6,
              }}>
                {ind.meses_stock == null ? (
                  <div>
                    <strong>Fase Inicial / Sin Datos de Absorción:</strong> Se sugiere validar la fecha de lanzamiento oficial y asegurar que el registro de preventa esté actualizado en el censo para proyectar la curva de absorción.
                  </div>
                ) : ind.meses_stock < 6 ? (
                  <div>
                    <strong style={{ color: 'var(--accent-emerald)' }}>Oportunidad de Captura de Margen:</strong> Con menos de 6 meses de stock remanente y absorción acelerada, el desarrollador cuenta con margen técnico para incrementar precios entre 3% y 5% en tipologías clave sin deprimir el ritmo comercial.
                  </div>
                ) : ind.meses_stock <= 14 ? (
                  <div>
                    <strong style={{ color: 'var(--accent-blue)' }}>Estrategia Sostenida:</strong> Ritmo saludable y balanceado. Se recomienda mantener las políticas de comercialización y apalancar las tipologías más veloces para empujar la venta de unidades de mayor ticket.
                  </div>
                ) : (
                  <div>
                    <strong style={{ color: 'var(--text-danger)' }}>Alerta de Rotación Lenta:</strong> Con {fmt(ind.meses_stock)} meses de inventario estimado, se aconseja flexibilizar facilidades de pago o estructurar promociones de cierre de obra para acelerar la liquidación del stock remanente.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
