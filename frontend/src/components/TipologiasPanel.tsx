import { useEffect, useState } from 'react'
import ReactECharts from 'echarts-for-react'
import {
  fetchIndicadores,
  fetchTipologiasForProject,
  fetchAllAvgTipologias,
  computeTipologiaBenchmarks,
  getLatestPerProject,
} from '../lib/supabase'
import type { IndicadorFull, AvgTipologia, TipologiaBenchmark } from '../lib/supabase'

interface Props {
  ciudad: string
  etapaFilter?: string | string[]
  selectedIndicador: IndicadorFull | null
  onSelectIndicador: (ind: IndicadorFull | null) => void
}

interface ProductMatrixRow {
  tipologia: string
  areaAvg: number
  areaMin: number
  areaMax: number
  m2Avg: number
  m2Min: number
  m2Max: number
  precioAvg: number
  count: number
}

const CHART_BASE = {
  backgroundColor: 'transparent',
  textStyle: { fontFamily: 'Inter, sans-serif', color: '#94a3b8', fontSize: 11 },
  animation: true,
  animationDuration: 500,
}

function fmt(n: number | null | undefined, dec = 1): string {
  if (n == null) return '—'
  return n.toLocaleString('es-BO', { maximumFractionDigits: dec })
}

function fmtUSD(n: number | null | undefined): string {
  if (n == null) return '—'
  return '$US ' + Math.round(n).toLocaleString('es-BO')
}

function getBedIcon(tipo: string): string {
  const t = tipo.toLowerCase()
  if (t.includes('mono') || t.includes('estudio')) return 'M'
  if (t.includes('1')) return '1D'
  if (t.includes('2')) return '2D'
  if (t.includes('3') || t.includes('más') || t.includes('mas')) return '3D+'
  if (t.includes('penthouse') || t.includes('ph')) return 'PH'
  return ''
}

export default function TipologiasPanel({ ciudad, etapaFilter, selectedIndicador, onSelectIndicador }: Props) {
  const [proyectos, setProyectos] = useState<IndicadorFull[]>([])
  const [tipologias, setTipologias] = useState<AvgTipologia[]>([])
  const [marketBenchmarks, setMarketBenchmarks] = useState<Record<string, TipologiaBenchmark>>({})
  const [matrix01E, setMatrix01E] = useState<ProductMatrixRow[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingTipos, setLoadingTipos] = useState(false)
  const [viewMode, setViewMode] = useState<'cards' | '01-E' | 'charts'>('cards')

  // Load projects for current city and market benchmarks
  useEffect(() => {
    setLoading(true)
    Promise.all([
      fetchIndicadores(ciudad === 'ALL' ? undefined : ciudad),
      fetchAllAvgTipologias(),
    ])
      .then(([inds, allTipos]) => {
        let latest = getLatestPerProject(inds)
        if (etapaFilter) {
          if (Array.isArray(etapaFilter)) {
            if (etapaFilter.length > 0 && !etapaFilter.includes('ALL')) {
              latest = latest.filter((p) => etapaFilter.includes(p.etapa || ''))
            }
          } else if (etapaFilter !== 'ALL') {
            latest = latest.filter((p) => p.etapa === etapaFilter)
          }
        }
        latest.sort((a, b) => a.proyecto.localeCompare(b.proyecto))
        setProyectos(latest)
        setMarketBenchmarks(computeTipologiaBenchmarks(allTipos))

        // Compute 01-E matrix from all tipologias
        const groups = new Map<string, AvgTipologia[]>()
        allTipos.forEach((t) => {
          const k = t.avg_tipologia || 'Otro'
          if (!groups.has(k)) groups.set(k, [])
          groups.get(k)!.push(t)
        })

        const rows: ProductMatrixRow[] = []
        groups.forEach((items, tipo) => {
          const areas = items.map((x) => x.avg_construccion_m2).filter((x): x is number => x != null && x > 0)
          const m2s = items.map((x) => x.avg_sus_m2).filter((x): x is number => x != null && x > 0)
          const precios = items.map((x) => x.avg_precio).filter((x): x is number => x != null && x > 0)

          rows.push({
            tipologia: tipo,
            areaAvg: areas.length ? Math.round(areas.reduce((a, b) => a + b, 0) / areas.length) : 0,
            areaMin: areas.length ? Math.round(Math.min(...areas)) : 0,
            areaMax: areas.length ? Math.round(Math.max(...areas)) : 0,
            m2Avg: m2s.length ? Math.round(m2s.reduce((a, b) => a + b, 0) / m2s.length) : 0,
            m2Min: m2s.length ? Math.round(Math.min(...m2s)) : 0,
            m2Max: m2s.length ? Math.round(Math.max(...m2s)) : 0,
            precioAvg: precios.length ? Math.round(precios.reduce((a, b) => a + b, 0) / precios.length) : 0,
            count: items.length,
          })
        })

        // Sort common order: Monoambiente, 1D, 2D, 3D
        rows.sort((a, b) => {
          const score = (name: string) => {
            if (name.includes('Mono')) return 1
            if (name.includes('1')) return 2
            if (name.includes('2')) return 3
            if (name.includes('3')) return 4
            return 5
          }
          return score(a.tipologia) - score(b.tipologia)
        })

        setMatrix01E(rows)

        // Default select first project if none active
        if (!selectedIndicador && latest.length > 0) {
          onSelectIndicador(latest[0])
        }
        setLoading(false)
      })
      .catch((err) => {
        console.error('TipologiasPanel load error:', err)
        setLoading(false)
      })
  }, [ciudad, etapaFilter])

  // When selectedIndicador changes, fetch its tipologias
  useEffect(() => {
    if (!selectedIndicador) {
      setTipologias([])
      return
    }
    const current = selectedIndicador
    setLoadingTipos(true)
    fetchTipologiasForProject(current.proyecto_id, current.indicador_censo_id)
      .then((data) => {
        setTipologias(data)
        setLoadingTipos(false)
      })
      .catch((err) => {
        console.error('Error fetching project tipologias:', err)
        setLoadingTipos(false)
      })
  }, [selectedIndicador])

  // ─── ECharts Configuration ──────────────────────────────────────────────
  const chartPriceM2 = tipologias.length > 0 ? {
    ...CHART_BASE,
    grid: { left: 16, right: 16, top: 28, bottom: 24, containLabel: true },
    tooltip: {
      trigger: 'axis',
      backgroundColor: '#0c1a2d',
      borderColor: '#1f395d',
      textStyle: { color: '#f1f5f9', fontSize: 11 },
    },
    legend: {
      data: ['Precio Promedio ($US)', 'Precio $/m²'],
      textStyle: { color: '#94a3b8', fontSize: 10 },
      top: 2,
    },
    xAxis: {
      type: 'category',
      data: tipologias.map((t) => t.avg_tipologia),
      axisLabel: { fontSize: 10, color: '#94a3b8', interval: 0 },
    },
    yAxis: [
      {
        type: 'value',
        name: 'Precio $US',
        nameTextStyle: { color: '#64748b', fontSize: 9 },
        splitLine: { lineStyle: { color: '#182c48' } },
        axisLabel: { fontSize: 9, formatter: (v: number) => `$${(v / 1000).toFixed(0)}k` },
      },
      {
        type: 'value',
        name: '$US/m²',
        nameTextStyle: { color: '#64748b', fontSize: 9 },
        splitLine: { show: false },
        axisLabel: { fontSize: 9, formatter: (v: number) => `$${v}` },
      },
    ],
    series: [
      {
        name: 'Precio Promedio ($US)',
        type: 'bar',
        barMaxWidth: 24,
        data: tipologias.map((t) => t.avg_precio),
        itemStyle: {
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [{ offset: 0, color: '#14b8a6' }, { offset: 1, color: '#0e7490' }],
          },
          borderRadius: [3, 3, 0, 0],
        },
      },
      {
        name: 'Precio $/m²',
        type: 'line',
        yAxisIndex: 1,
        data: tipologias.map((t) => t.avg_sus_m2),
        symbol: 'circle',
        symbolSize: 6,
        lineStyle: { color: '#e5e5e5', width: 2 },
        itemStyle: { color: '#e5e5e5' },
      },
    ],
  } : null

  const chartInventory = tipologias.length > 0 ? {
    ...CHART_BASE,
    grid: { left: 16, right: 16, top: 28, bottom: 24, containLabel: true },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      backgroundColor: '#07141a',
      borderColor: '#133340',
      textStyle: { color: '#f1f5f9', fontSize: 11 },
    },
    legend: {
      data: ['Vendidas', 'Por Vender'],
      textStyle: { color: '#94a3b8', fontSize: 10 },
      top: 2,
    },
    xAxis: {
      type: 'category',
      data: tipologias.map((t) => t.avg_tipologia),
      axisLabel: { fontSize: 10, color: '#94a3b8', interval: 0 },
    },
    yAxis: {
      type: 'value',
      name: 'Unidades',
      nameTextStyle: { color: '#64748b', fontSize: 9 },
      splitLine: { lineStyle: { color: '#133340' } },
      axisLabel: { fontSize: 9 },
    },
    series: [
      {
        name: 'Vendidas',
        type: 'bar',
        stack: 'total',
        data: tipologias.map((t) => t.und_vendidas ?? 0),
        itemStyle: { color: '#10b981' },
        barMaxWidth: 26,
      },
      {
        name: 'Por Vender',
        type: 'bar',
        stack: 'total',
        data: tipologias.map((t) => t.und_por_vender ?? 0),
        itemStyle: { color: '#0e7490', borderRadius: [3, 3, 0, 0] },
        barMaxWidth: 26,
      },
    ],
  } : null

  return (
    <div className="panel panel-center" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header */}
      <div className="panel-header">
        <div className="panel-title-dot" style={{ background: 'var(--citrino-teal-light)', boxShadow: 'none' }} />
        <span style={{ fontWeight: 700 }}>01-E ANÁLISIS DE TIPOLOGÍAS</span>
        <span style={{ marginLeft: 8, fontSize: 10, color: 'var(--text-muted)' }}>
          — Producto Inmobiliario (Área, Precios y Absorción)
        </span>

        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }} className="citrino-subtabs">
          <button
            onClick={() => setViewMode('cards')}
            className={`citrino-subtab-btn ${viewMode === 'cards' ? 'active' : ''}`}>
            ▦ Modelos Proyecto
          </button>
          <button
            onClick={() => setViewMode('01-E')}
            className={`citrino-subtab-btn ${viewMode === '01-E' ? 'active' : ''}`}>
            Matriz Oficial 01-E
          </button>
          <button
            onClick={() => setViewMode('charts')}
            className={`citrino-subtab-btn ${viewMode === 'charts' ? 'active' : ''}`}>
            Gráficos
          </button>
        </div>
      </div>

      {/* Citrino Project Selector Bar */}
      <div style={{
        padding: '8px 14px',
        background: 'var(--bg-surface)',
        borderBottom: '1px solid var(--border-subtle)',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        flexWrap: 'wrap',
      }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--citrino-teal-light)', display: 'flex', alignItems: 'center', gap: 6 }}>
          <span>Proyecto:</span>
        </div>

        <div style={{ position: 'relative', flex: '1', minWidth: 220, maxWidth: 380 }}>
          <select
            value={selectedIndicador?.indicador_censo_id ?? ''}
            onChange={(e) => {
              const found = proyectos.find((p) => p.indicador_censo_id === e.target.value)
              if (found) onSelectIndicador(found)
            }}
            style={{
              width: '100%',
              padding: '6px 10px',
              fontSize: 12,
              fontWeight: 600,
              background: 'var(--bg-card)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-md)',
              outline: 'none',
              cursor: 'pointer',
              boxShadow: 'none',
            }}>
            {proyectos.map((p) => (
              <option key={p.indicador_censo_id} value={p.indicador_censo_id}>
                {p.proyecto} {p.ZONAS ? `(${p.ZONAS})` : `(${p.ciudad})`}
              </option>
            ))}
          </select>
        </div>

        {selectedIndicador && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 11 }}>
            {selectedIndicador.ZONAS && (
              <span style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border-subtle)',
                padding: '3px 8px',
                borderRadius: 4,
                color: 'var(--text-accent)',
              }}>
                Zona: <strong>{selectedIndicador.ZONAS}</strong>
              </span>
            )}
            <span style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-subtle)',
              padding: '3px 8px',
              borderRadius: 4,
              color: 'var(--text-primary)',
            }}>
              Snapshot: <strong style={{ color: 'var(--accent-cyan)' }}>{selectedIndicador.fecha_snapshot}</strong>
            </span>
          </div>
        )}
      </div>

      {/* Main Content Area */}
      <div className="panel-body" style={{ flex: 1, overflowY: 'auto', padding: 14 }}>
        {loading || loadingTipos ? (
          <div className="empty-state" style={{ padding: '40px 0' }}>
            <div className="loading-shimmer" style={{ width: 180, height: 16, marginBottom: 8 }} />
            <div className="loading-shimmer" style={{ width: 260, height: 12 }} />
            <div style={{ marginTop: 12, fontSize: 11, color: 'var(--text-muted)' }}>
              Cargando modelos y precios de tipologías…
            </div>
          </div>
        ) : (
          <>
            {/* VIEW MODE 1: CARDS OF PROJECT */}
            {viewMode === 'cards' && (
              <div>
                {tipologias.length === 0 ? (
                  <div className="empty-state" style={{ padding: '30px 16px', textAlign: 'center' }}>
                    <div style={{ fontSize: 20, marginBottom: 8, color: 'var(--text-muted)' }}>—</div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>
                      Sin tipologías individuales en este censo
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                      Revisa la pestaña <strong>Matriz Oficial 01-E</strong> arriba para ver los benchmarks de plaza.
                    </div>
                  </div>
                ) : (
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                    gap: 12,
                    marginBottom: 16,
                  }}>
                    {tipologias.map((t) => {
                      const bench = marketBenchmarks[t.avg_tipologia]
                      const pctVend = t.und_totales && t.und_vendidas != null
                        ? Math.round((t.und_vendidas / t.und_totales) * 100)
                        : null

                      return (
                        <div
                          key={t.avg_tipologia}
                          style={{
                            background: 'var(--bg-card)',
                            border: '1px solid var(--border-subtle)',
                            borderRadius: 'var(--radius-md)',
                            padding: '14px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 10,
                            boxShadow: 'none',
                          }}>
                          {/* Card Header */}
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span style={{ fontSize: 20 }}>{getBedIcon(t.avg_tipologia)}</span>
                              <div>
                                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
                                  {t.avg_tipologia}
                                </div>
                                <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                                  {t.avg_construccion_m2 ? `${fmt(t.avg_construccion_m2)} m² constr.` : 'Área no disp.'}
                                </div>
                              </div>
                            </div>

                            {pctVend != null && (
                              <span className={pctVend >= 50 ? 'badge-pos' : 'badge-neg'}>
                                {pctVend >= 50 ? '▲' : '▼'} {pctVend}% vendido
                              </span>
                            )}
                          </div>

                          {/* Price Hero Section */}
                          <div style={{
                            background: 'var(--bg-surface)',
                            borderRadius: 'var(--radius-sm)',
                            padding: '10px 12px',
                            border: '1px solid var(--border-default)',
                          }}>
                            <div style={{ fontSize: 9.5, color: 'var(--text-muted)', marginBottom: 2 }}>
                              PRECIO PROMEDIO MODELO
                            </div>
                            <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--citrino-accent)', letterSpacing: -0.5 }}>
                              {fmtUSD(t.avg_precio)}
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontSize: 11 }}>
                              <span style={{ color: 'var(--text-secondary)' }}>
                                $/m²: <strong style={{ color: 'var(--text-primary)' }}>{fmt(t.avg_sus_m2)} $US</strong>
                              </span>
                              {t.avg_bs_m2 && (
                                <span style={{ color: 'var(--text-muted)' }}>
                                  {fmt(t.avg_bs_m2, 0)} Bs/m²
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Inventory & Progress */}
                          <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 4 }}>
                              <span style={{ color: 'var(--text-muted)' }}>Avance Comercial</span>
                              <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
                                {t.und_vendidas ?? 0} de {t.und_totales ?? 0} unds
                              </span>
                            </div>
                            <div className="progress-bar" style={{ height: 6, background: 'var(--bg-surface)' }}>
                              <div className="progress-bar-fill green" style={{ width: `${pctVend ?? 0}%` }} />
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>
                              <span>Vendidas: <strong style={{ color: 'var(--color-positive)' }}>{t.und_vendidas ?? 0}</strong></span>
                              <span>Disponibles: <strong style={{ color: 'var(--text-secondary)' }}>{t.und_por_vender ?? 0}</strong></span>
                            </div>
                          </div>

                          {/* Velocity & Stock Months */}
                          <div style={{
                            display: 'grid',
                            gridTemplateColumns: '1fr 1fr',
                            gap: 8,
                            paddingTop: 6,
                            borderTop: '1px solid var(--border-subtle)',
                            fontSize: 11,
                          }}>
                            <div>
                              <div style={{ fontSize: 9.5, color: 'var(--text-muted)' }}>Ritmo absorción</div>
                              <div style={{ fontWeight: 700, color: (t.ritmo_venta ?? 0) > 0 ? 'var(--color-positive)' : 'var(--text-muted)', marginTop: 1 }}>
                                {t.ritmo_venta != null && t.ritmo_venta > 0 ? `${fmt(t.ritmo_venta)} und/mes` : '—'}
                              </div>
                            </div>
                            <div>
                              <div style={{ fontSize: 9.5, color: 'var(--text-muted)' }}>Meses de stock</div>
                              <div style={{
                                fontWeight: 700,
                                color: (t.meses_stock ?? 0) > 18 ? 'var(--color-negative)' : (t.meses_stock ?? 0) > 12 ? 'var(--color-warning)' : 'var(--color-positive)',
                                marginTop: 1,
                              }}>
                                {t.meses_stock != null ? `${fmt(t.meses_stock)} meses` : '—'}
                              </div>
                            </div>
                          </div>

                          {/* Benchmark Comparison Tag */}
                          {bench && t.avg_sus_m2 && bench.avgSusM2 > 0 && (
                            <div style={{
                              fontSize: 10,
                              color: 'var(--text-muted)',
                              background: 'rgba(255,255,255,0.02)',
                              padding: '4px 8px',
                              borderRadius: 4,
                              border: '1px dashed var(--border-default)',
                            }}>
                              {(() => {
                                const diff = ((t.avg_sus_m2 - bench.avgSusM2) / bench.avgSusM2) * 100
                                const isPositive = diff >= 0
                                return (
                                  <span>
                                    vs Media Plaza ({fmt(bench.avgSusM2)} $/m²):{' '}
                                    <strong style={{ color: isPositive ? 'var(--color-positive)' : 'var(--color-negative)' }}>
                                      {isPositive ? `▲ +${diff.toFixed(1)}%` : `▼ ${diff.toFixed(1)}%`}
                                    </strong>
                                  </span>
                                )
                              })()}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}

            {/* VIEW MODE 2: 01-E OFFICIAL LOOKER STUDIO PRODUCT MATRIX */}
            {viewMode === '01-E' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{
                  padding: '10px 14px',
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--citrino-teal-light)', marginBottom: 2 }}>
                    01-E Características del producto inmobiliario
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                    Matriz oficial consolidada de áreas, precios por metro cuadrado y tickets de venta en {ciudad === 'ALL' ? 'Bolivia' : ciudad}.
                  </div>
                </div>

                <div className="data-table-wrap">
                  <table className="data-table" style={{ textAlign: 'center' }}>
                    <thead>
                      <tr>
                        <th rowSpan={2} style={{ textAlign: 'left', verticalAlign: 'middle' }}>Tipología</th>
                        <th colSpan={3} style={{ borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-surface)' }}>
                          Área (m²)
                        </th>
                        <th colSpan={3} style={{ borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-surface)' }}>
                          Precio / m² ($US)
                        </th>
                        <th rowSpan={2} style={{ verticalAlign: 'middle', color: 'var(--citrino-teal-light)' }}>
                          Precio Promedio ($US)
                        </th>
                      </tr>
                      <tr>
                        <th style={{ fontSize: 10 }}>Promedio</th>
                        <th style={{ fontSize: 10 }}>Mínimo</th>
                        <th style={{ fontSize: 10 }}>Máximo</th>
                        <th style={{ fontSize: 10 }}>Promedio $</th>
                        <th style={{ fontSize: 10 }}>Mínimo $</th>
                        <th style={{ fontSize: 10 }}>Máximo $</th>
                      </tr>
                    </thead>
                    <tbody>
                      {matrix01E.map((row) => (
                        <tr key={row.tipologia}>
                          <td style={{ textAlign: 'left', fontWeight: 700, color: 'var(--text-primary)' }}>
                            <span style={{ marginRight: 6 }}>{getBedIcon(row.tipologia)}</span>
                            {row.tipologia}
                          </td>
                          <td className="td-num" style={{ fontWeight: 700 }}>{row.areaAvg} m²</td>
                          <td className="td-num" style={{ color: 'var(--text-muted)' }}>{row.areaMin} m²</td>
                          <td className="td-num" style={{ color: 'var(--text-muted)' }}>{row.areaMax} m²</td>

                          <td className="td-num" style={{ fontWeight: 700, color: 'var(--accent-cyan)' }}>${row.m2Avg}</td>
                          <td className="td-num" style={{ color: 'var(--text-muted)' }}>${row.m2Min}</td>
                          <td className="td-num" style={{ color: 'var(--text-muted)' }}>${row.m2Max}</td>

                          <td className="td-num" style={{ fontWeight: 800, color: 'var(--citrino-teal-light)', fontSize: 12 }}>
                            {fmtUSD(row.precioAvg)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* VIEW MODE 3: CHARTS */}
            {viewMode === 'charts' && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 14 }}>
                {chartPriceM2 && (
                  <div className="chart-card">
                    <div className="chart-card-header">
                      <span className="chart-title">Precios ($US) y $/m² por Modelo</span>
                      <span className="chart-tag" style={{ color: 'var(--citrino-teal-light)', border: '1px solid rgba(20, 184, 166, 0.3)' }}>ticket vs m²</span>
                    </div>
                    <ReactECharts option={chartPriceM2} style={{ height: 230 }} />
                  </div>
                )}
                {chartInventory && (
                  <div className="chart-card">
                    <div className="chart-card-header">
                      <span className="chart-title">Inventario Vendido vs. Disponible</span>
                      <span className="chart-tag green">unidades</span>
                    </div>
                    <ReactECharts option={chartInventory} style={{ height: 230 }} />
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
