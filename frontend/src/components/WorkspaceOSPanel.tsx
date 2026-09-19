import React, { useState, useEffect, useRef } from 'react'
import ReactECharts from 'echarts-for-react'
import {
  fetchIndicadores,
  getLatestPerProject,
  computeZonaMetrics,
  fetchAllAvgTipologias,
  supabase,
} from '../lib/supabase'
import type { IndicadorFull, AvgTipologia, ZonaMetrics } from '../lib/supabase'

interface Props {
  ciudad: string
  zonaFilter?: string
  etapaFilter?: string | string[]
  selectedIndicador?: IndicadorFull | null
  onSelectIndicador?: (ind: IndicadorFull | null) => void
  onSwitchTab?: (tab: any) => void
  initialApp?: string
  onOpenCommandPalette?: () => void
  theme?: 'dark' | 'light'
}

type OSApp = 'mission' | 'comparador' | 'dossier' | 'pipeline'

function fmt(n: number | null | undefined, dec = 1): string {
  if (n == null) return '—'
  return n.toLocaleString('es-BO', { maximumFractionDigits: dec })
}

function fmtUSD(n: number | null | undefined): string {
  if (n == null) return '—'
  if (n >= 1_000_000) return '$' + (n / 1_000_000).toFixed(2) + ' M'
  if (n >= 1_000) return '$' + Math.round(n / 1_000).toLocaleString('es-BO') + ' k'
  return '$' + Math.round(n).toLocaleString('es-BO')
}

export default function WorkspaceOSPanel({
  ciudad,
  zonaFilter,
  etapaFilter,
  selectedIndicador,
  onSelectIndicador,
  onSwitchTab,
  initialApp = 'mission',
  onOpenCommandPalette,
  theme = 'dark',
}: Props) {
  const [activeApp, setActiveApp] = useState<OSApp>(initialApp as OSApp)
  const [allIndicadores, setAllIndicadores] = useState<IndicadorFull[]>([])
  const [allTipos, setAllTipos] = useState<AvgTipologia[]>([])
  const [loading, setLoading] = useState(true)

  // Comparador State (List of project IDs selected for side-by-side comparison)
  const [compareIds, setCompareIds] = useState<string[]>([])
  const [compareSearch, setCompareSearch] = useState('')

  // Dossier State
  const [dossierScope, setDossierScope] = useState<'project' | 'zona' | 'market'>('project')
  const chartRef = useRef<any>(null)

  // Pipeline Studio State
  const [pipelineTable, setPipelineTable] = useState<'oferta_proyectos' | 'oferta_indicadores_censo' | 'oferta_avg_tipologias' | 'oferta_amenidades'>('oferta_proyectos')
  const [rawRows, setRawRows] = useState<any[]>([])
  const [rawLoading, setRawLoading] = useState(false)
  const [tableCounts, setTableCounts] = useState<Record<string, number>>({})
  const [rawSearch, setRawSearch] = useState('')

  // Load Main Data
  useEffect(() => {
    setLoading(true)
    Promise.all([
      fetchIndicadores(ciudad === 'ALL' ? undefined : ciudad),
      fetchAllAvgTipologias().catch(() => []),
    ])
      .then(([inds, tipos]) => {
        setAllIndicadores(inds)
        setAllTipos(tipos)
        setLoading(false)
      })
      .catch((err) => {
        console.error('WorkspaceOSPanel fetch error:', err)
        setLoading(false)
      })
  }, [ciudad])

  const latestProjects = getLatestPerProject(allIndicadores)

  // Filter projects by global filters
  const filteredProjects = latestProjects.filter((p) => {
    if (zonaFilter && zonaFilter !== 'ALL' && p.ZONAS !== zonaFilter) return false
    if (etapaFilter) {
      if (Array.isArray(etapaFilter)) {
        if (etapaFilter.length > 0 && !etapaFilter.includes('ALL') && !etapaFilter.includes(p.etapa || '')) {
          return false
        }
      } else if (etapaFilter !== 'ALL' && p.etapa !== etapaFilter) {
        return false
      }
    }
    return true
  })

  // Initialize comparator with selected project if present
  useEffect(() => {
    if (selectedIndicador && !compareIds.includes(selectedIndicador.proyecto_id)) {
      if (compareIds.length < 3) {
        setCompareIds((prev) => [...prev, selectedIndicador.proyecto_id])
      }
    }
  }, [selectedIndicador])

  // Load Pipeline table counts and raw preview
  useEffect(() => {
    if (activeApp === 'pipeline') {
      loadPipelineCounts()
      loadRawTableData(pipelineTable)
    }
  }, [activeApp, pipelineTable])

  const loadPipelineCounts = async () => {
    try {
      const [pRes, iRes, tRes, aRes] = await Promise.all([
        supabase.from('oferta_proyectos').select('*', { count: 'exact', head: true }),
        supabase.from('oferta_indicadores_censo').select('*', { count: 'exact', head: true }),
        supabase.from('oferta_avg_tipologias').select('*', { count: 'exact', head: true }),
        supabase.from('oferta_amenidades').select('*', { count: 'exact', head: true }),
      ])
      setTableCounts({
        oferta_proyectos: pRes.count ?? 0,
        oferta_indicadores_censo: iRes.count ?? 0,
        oferta_avg_tipologias: tRes.count ?? 0,
        oferta_amenidades: aRes.count ?? 0,
      })
    } catch (e) {
      console.error('Error fetching table counts:', e)
    }
  }

  const loadRawTableData = async (tableName: string) => {
    setRawLoading(true)
    try {
      const { data, error } = await supabase.from(tableName).select('*').limit(25)
      if (!error && data) {
        setRawRows(data)
      }
    } catch (e) {
      console.error('Error loading raw table:', e)
    } finally {
      setRawLoading(false)
    }
  }

  // Zona metrics for Mission Control
  const zonaData: ZonaMetrics[] = computeZonaMetrics(filteredProjects)
  const topZonas = [...zonaData].sort((a, b) => b.totalStockUnd - a.totalStockUnd).slice(0, 7)

  // Overall Global Aggregates
  const totalStockUnd = filteredProjects.reduce((s, p) => s + (p.und_por_vender ?? 0), 0)
  const totalStockUSD = filteredProjects.reduce((s, p) => s + (p.stock_total ?? 0), 0)
  const totalVendidas = filteredProjects.reduce((s, p) => s + (p.und_vendidas ?? 0), 0)
  const totalInicial = filteredProjects.reduce((s, p) => s + (p.und_totales ?? 0), 0)
  const pctVendido = totalInicial > 0 ? Math.round((totalVendidas / totalInicial) * 100) : 0
  const avgRitmoGeneral = filteredProjects.length
    ? filteredProjects.reduce((s, p) => s + (p.ritmo_venta ?? 0), 0) / filteredProjects.length
    : 0
  const mesesStockGeneral = avgRitmoGeneral > 0 ? totalStockUnd / (avgRitmoGeneral * filteredProjects.length) : 0

  // Top absorptions vs inventory risk
  const sortedByRitmo = [...filteredProjects]
    .filter((p) => (p.ritmo_venta ?? 0) > 0)
    .sort((a, b) => (b.ritmo_venta ?? 0) - (a.ritmo_venta ?? 0))
  const sortedByMeses = [...filteredProjects]
    .filter((p) => (p.und_por_vender ?? 0) > 10 && (p.meses_stock ?? 0) > 0)
    .sort((a, b) => (b.meses_stock ?? 0) - (a.meses_stock ?? 0))

  // Download CSV helper
  const handleExportCSV = () => {
    let rowsToExport = filteredProjects
    if (dossierScope === 'project' && selectedIndicador) {
      rowsToExport = filteredProjects.filter((p) => p.proyecto_id === selectedIndicador.proyecto_id)
    }

    const headers = [
      'Proyecto',
      'Ciudad',
      'Zona',
      'Etapa',
      'Desarrollador',
      'Unidades Totales',
      'Unidades Vendidas',
      'Stock Por Vender',
      '% Vendido',
      'Ritmo Venta (und/mes)',
      'Meses de Stock',
      'Stock Total USD',
      'Fecha Snapshot',
    ]

    const csvContent = [
      headers.join(';'),
      ...rowsToExport.map((p) =>
        [
          `"${p.proyecto.replace(/"/g, '""')}"`,
          `"${p.ciudad}"`,
          `"${p.ZONAS || ''}"`,
          `"${p.etapa || ''}"`,
          `"${p.desarrollador || ''}"`,
          p.und_totales ?? '',
          p.und_vendidas ?? '',
          p.und_por_vender ?? '',
          p.pct_vendido ?? '',
          p.ritmo_venta ?? '',
          p.meses_stock ?? '',
          p.stock_total ?? '',
          `"${p.fecha_snapshot || ''}"`,
        ].join(';')
      ),
    ].join('\n')

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `citrino_dossier_${ciudad}_${new Date().toISOString().slice(0, 10)}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // Export Chart PNG helper
  const handleExportChartPNG = () => {
    if (chartRef.current) {
      const echartsInstance = chartRef.current.getEchartsInstance()
      if (echartsInstance) {
        const dataUrl = echartsInstance.getDataURL({
          pixelRatio: 2,
          backgroundColor: '#1e1e1e',
        })
        const link = document.createElement('a')
        link.href = dataUrl
        link.download = `citrino_chart_${activeApp}_${new Date().toISOString().slice(0, 10)}.png`
        link.click()
      }
    }
  }

  // Projects chosen for Comparador
  const comparedProjects = latestProjects.filter((p) => compareIds.includes(p.proyecto_id))

  // Radar chart config for Comparador
  const radarChartOption = React.useMemo(() => {
    if (comparedProjects.length === 0) return {}

    const isLight = theme === 'light'
    const maxRitmo = Math.max(...comparedProjects.map((p) => p.ritmo_venta ?? 0), 2)
    const maxStock = Math.max(...comparedProjects.map((p) => p.und_por_vender ?? 0), 50)
    const maxPct = 1
    const maxTotal = Math.max(...comparedProjects.map((p) => p.und_totales ?? 0), 100)
    const maxUSD = Math.max(...comparedProjects.map((p) => p.stock_total ?? 0), 5_000_000)

    const colors = ['#3794ff', '#38bdf8', '#10b981', '#f59e0b', '#0078d4']

    return {
      backgroundColor: 'transparent',
      legend: {
        data: comparedProjects.map((p) => p.proyecto),
        bottom: 0,
        textStyle: { color: isLight ? '#475569' : '#9d9d9d', fontSize: 11 },
      },
      radar: {
        indicator: [
          { name: 'Ritmo Venta (und/mes)', max: maxRitmo },
          { name: 'Stock Disponible', max: maxStock },
          { name: '% Vendido', max: maxPct },
          { name: 'Escala (Und Totales)', max: maxTotal },
          { name: 'Valor Stock (USD)', max: maxUSD },
        ],
        shape: 'polygon',
        splitNumber: 4,
        axisName: {
          color: isLight ? '#0078d4' : '#3794ff',
          fontSize: 10,
          fontWeight: 600,
        },
        splitLine: {
          lineStyle: {
            color: isLight
              ? ['#cbd5e1', '#e2e8f0', '#cbd5e1', '#e2e8f0']
              : ['#2d2d2d', '#383838', '#2d2d2d', '#383838'],
          },
        },
        splitArea: {
          show: true,
          areaStyle: {
            color: isLight
              ? ['rgba(241, 245, 249, 0.7)', 'rgba(255, 255, 255, 0.9)']
              : ['rgba(55, 148, 255, 0.04)', 'rgba(32, 32, 32, 0.4)'],
          },
        },
        axisLine: {
          lineStyle: { color: isLight ? '#cbd5e1' : '#383838' },
        },
      },
      series: [
        {
          type: 'radar',
          data: comparedProjects.map((p, idx) => ({
            value: [
              p.ritmo_venta ?? 0,
              p.und_por_vender ?? 0,
              p.pct_vendido ?? 0,
              p.und_totales ?? 0,
              p.stock_total ?? 0,
            ],
            name: p.proyecto,
            symbol: 'circle',
            symbolSize: 5,
            lineStyle: { width: 2, color: colors[idx % colors.length] },
            itemStyle: { color: colors[idx % colors.length] },
            areaStyle: { color: colors[idx % colors.length], opacity: 0.2 },
          })),
        },
      ],
    }
  }, [comparedProjects, theme])

  // Mission Control Zone Distribution Chart
  const zoneChartOption = React.useMemo(() => {
    const isLight = theme === 'light'
    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        backgroundColor: isLight ? '#ffffff' : '#252526',
        borderColor: isLight ? '#cbd5e1' : '#383838',
        textStyle: { color: isLight ? '#0f172a' : '#f3f3f3' },
      },
      grid: { left: '3%', right: '4%', bottom: '3%', top: '10%', containLabel: true },
      xAxis: {
        type: 'category',
        data: topZonas.map((z) => z.zona),
        axisLine: { lineStyle: { color: isLight ? '#cbd5e1' : '#383838' } },
        axisLabel: { color: isLight ? '#475569' : '#9d9d9d', fontSize: 10, rotate: 20 },
      },
      yAxis: {
        type: 'value',
        axisLine: { lineStyle: { color: isLight ? '#cbd5e1' : '#383838' } },
        splitLine: { lineStyle: { color: isLight ? '#e2e8f0' : '#2d2d2d' } },
        axisLabel: { color: isLight ? '#475569' : '#9d9d9d', fontSize: 10 },
      },
      series: [
        {
          name: 'Stock Unidades',
          type: 'bar',
          data: topZonas.map((z) => z.totalStockUnd),
          itemStyle: {
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: '#3794ff' },
                { offset: 1, color: '#0078d4' },
              ],
            },
            borderRadius: [4, 4, 0, 0],
          },
        },
        {
          name: 'Ritmo Promedio (und/mes)',
          type: 'line',
          yAxisIndex: 0,
          data: topZonas.map((z) => z.ritmoVentaMensual),
          itemStyle: { color: '#10b981' },
          lineStyle: { width: 2.5 },
        },
      ],
    }
  }, [topZonas, theme])

  return (
    <div className="workspace-os-container">
      {/* ─── OS Dock Navigation Bar ─── */}
      <header className="os-dock-bar">
        <div className="os-dock-brand">
          <span className="os-badge-pulse" />
          <span className="os-brand-title">WORKSPACE OS</span>
          <span className="os-brand-version">v2.4 INSTITUTIONAL</span>
        </div>

        {/* Dock App Switcher */}
        <nav className="os-dock-nav">
          <button
            className={`os-dock-item ${activeApp === 'mission' ? 'active' : ''}`}
            onClick={() => setActiveApp('mission')}>
            <span className="os-dock-icon">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect width="7" height="9" x="3" y="3" rx="1"/>
                <rect width="7" height="5" x="14" y="3" rx="1"/>
                <rect width="7" height="9" x="14" y="12" rx="1"/>
                <rect width="7" height="5" x="3" y="16" rx="1"/>
              </svg>
            </span>
            <span className="os-dock-label">Mission Control</span>
          </button>

          <button
            className={`os-dock-item ${activeApp === 'comparador' ? 'active' : ''}`}
            onClick={() => setActiveApp('comparador')}>
            <span className="os-dock-icon">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="18" cy="18" r="3"/>
                <circle cx="6" cy="6" r="3"/>
                <path d="M13 6h3a2 2 0 0 1 2 2v7"/>
                <path d="M11 18H8a2 2 0 0 1-2-2V9"/>
              </svg>
            </span>
            <span className="os-dock-label">Comparador Head-to-Head</span>
            {comparedProjects.length > 0 && (
              <span className="os-dock-badge">{comparedProjects.length}</span>
            )}
          </button>

          <button
            className={`os-dock-item ${activeApp === 'dossier' ? 'active' : ''}`}
            onClick={() => setActiveApp('dossier')}>
            <span className="os-dock-icon">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
                <line x1="16" x2="8" y1="13" y2="13"/>
                <line x1="16" x2="8" y1="17" y2="17"/>
              </svg>
            </span>
            <span className="os-dock-label">Dossiers & Reportes</span>
          </button>

          <button
            className={`os-dock-item ${activeApp === 'pipeline' ? 'active' : ''}`}
            onClick={() => setActiveApp('pipeline')}>
            <span className="os-dock-icon">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <ellipse cx="12" cy="5" rx="9" ry="3"/>
                <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/>
                <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>
              </svg>
            </span>
            <span className="os-dock-label">Data & Pipeline Studio</span>
            <span className="os-dock-pill-green">LIVE</span>
          </button>
        </nav>

        {/* Quick Trigger for Command Palette */}
        <div className="os-dock-actions">
          {selectedIndicador && (
            <div className="os-dock-selected-pill" title={`Proyecto activo: ${selectedIndicador.proyecto}`}>
              <span className="dot" />
              <span>{selectedIndicador.proyecto}</span>
            </div>
          )}

          <button
            className="os-cmd-trigger"
            onClick={onOpenCommandPalette}
            title="Abrir Command Palette (Ctrl+K / Cmd+K)">
            <span className="os-cmd-key">⌘K</span>
            <span className="os-cmd-text">Buscar...</span>
          </button>
        </div>
      </header>

      {/* ─── OS Body Application Canvas ─── */}
      <div className="os-canvas">
        {loading ? (
          <div className="os-loading-state">
            <div className="loading-shimmer" style={{ width: 220, height: 24, borderRadius: 8 }} />
            <span>Cargando entorno Workspace OS...</span>
          </div>
        ) : (
          <>
            {/* ══════════════════════════════════════════════════════════════════
                APP 1: MISSION CONTROL
            ══════════════════════════════════════════════════════════════════ */}
            {activeApp === 'mission' && (
              <div className="os-app-view">
                {/* Executive KPIs Grid */}
                <div className="os-kpi-grid">
                  <div className="os-kpi-card">
                    <div className="os-kpi-title">Proyectos Activos</div>
                    <div className="os-kpi-val text-accent">{filteredProjects.length}</div>
                    <div className="os-kpi-sub">Mercado {ciudad === 'ALL' ? 'Bolivia' : ciudad}</div>
                  </div>

                  <div className="os-kpi-card">
                    <div className="os-kpi-title">Stock Disponible</div>
                    <div className="os-kpi-val">{fmt(totalStockUnd, 0)} <span className="os-kpi-unit">unds</span></div>
                    <div className="os-kpi-sub">De {fmt(totalInicial, 0)} unidades lanzadas</div>
                  </div>

                  <div className="os-kpi-card">
                    <div className="os-kpi-title">Valor Stock en Oferta</div>
                    <div className="os-kpi-val text-citrino">{fmtUSD(totalStockUSD)}</div>
                    <div className="os-kpi-sub">Inventario monetizado a lista</div>
                  </div>

                  <div className="os-kpi-card">
                    <div className="os-kpi-title">Velocidad / Ritmo Promedio</div>
                    <div className="os-kpi-val text-success">{fmt(avgRitmoGeneral, 1)} <span className="os-kpi-unit">und/mes</span></div>
                    <div className="os-kpi-sub">Promedio por proyecto</div>
                  </div>

                  <div className="os-kpi-card">
                    <div className="os-kpi-title">Meses de Stock Estimados</div>
                    <div className="os-kpi-val text-warning">{fmt(mesesStockGeneral, 1)} <span className="os-kpi-unit">meses</span></div>
                    <div className="os-kpi-sub">Tiempo estimado de absorción</div>
                  </div>

                  <div className="os-kpi-card">
                    <div className="os-kpi-title">% Absorción Histórica</div>
                    <div className="os-kpi-val text-accent">{pctVendido}%</div>
                    <div className="os-progress-bar">
                      <div className="os-progress-fill" style={{ width: `${pctVendido}%` }} />
                    </div>
                  </div>
                </div>

                {/* Main 2-Column Split: Zone Distribution & Velocity Leaders */}
                <div className="os-grid-2col">
                  {/* Left: Zone Distribution Chart */}
                  <div className="os-panel-card">
                    <div className="os-panel-card-header">
                      <div>
                        <div className="os-card-title">Distribución de Oferta & Ritmo por Zona</div>
                        <div className="os-card-desc">Top zonas con mayor stock por vender y velocidad de venta</div>
                      </div>
                      <button
                        className="os-btn-sm"
                        onClick={() => {
                          setActiveApp('dossier')
                          setDossierScope('market')
                        }}>
                        Generar Ficha Zona ↗
                      </button>
                    </div>
                    <div style={{ height: 280 }}>
                      <ReactECharts
                        ref={chartRef}
                        option={zoneChartOption}
                        style={{ height: '100%', width: '100%' }}
                      />
                    </div>
                  </div>

                  {/* Right: Leaders & Outliers */}
                  <div className="os-panel-card">
                    <div className="os-panel-card-header">
                      <div>
                        <div className="os-card-title">Líderes de Absorción vs Inventario Ocioso</div>
                        <div className="os-card-desc">Comparación rápida de tracción comercial</div>
                      </div>
                      <button
                        className="os-btn-sm"
                        onClick={() => setActiveApp('comparador')}>
                        Abrir en Comparador
                      </button>
                    </div>

                    <div className="os-table-compact-container">
                      <table className="os-table-compact">
                        <thead>
                          <tr>
                            <th>Proyecto</th>
                            <th>Zona</th>
                            <th>Ritmo (u/m)</th>
                            <th>Stock</th>
                            <th>Meses</th>
                            <th>Acción</th>
                          </tr>
                        </thead>
                        <tbody>
                          {sortedByRitmo.slice(0, 6).map((p) => (
                            <tr key={p.proyecto_id}>
                              <td className="font-semibold text-primary">{p.proyecto}</td>
                              <td className="text-muted">{p.ZONAS || '—'}</td>
                              <td className="text-success font-semibold">{fmt(p.ritmo_venta, 1)}</td>
                              <td>{p.und_por_vender ?? '—'}</td>
                              <td className="text-warning">{fmt(p.meses_stock, 1)} m</td>
                              <td>
                                <button
                                  className="os-btn-xs"
                                  onClick={() => {
                                    if (onSelectIndicador) onSelectIndicador(p)
                                    if (!compareIds.includes(p.proyecto_id)) {
                                      setCompareIds((prev) => [...prev.slice(-2), p.proyecto_id])
                                    }
                                  }}>
                                  Comparar
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ══════════════════════════════════════════════════════════════════
                APP 2: COMPARADOR MULTIDIMENSIONAL (HEAD-TO-HEAD)
            ══════════════════════════════════════════════════════════════════ */}
            {activeApp === 'comparador' && (
              <div className="os-app-view">
                {/* Project Selector Bar */}
                <div className="os-comparator-picker">
                  <div className="os-comparator-picker-header">
                    <span className="text-accent font-bold">Selección de Proyectos a Comparar (2 a 4 simultáneos):</span>
                    <span className="text-muted text-xs">
                      Actualmente {comparedProjects.length} seleccionados
                    </span>
                  </div>

                  {/* Chips of currently selected */}
                  <div className="os-compare-chips">
                    {comparedProjects.map((p, idx) => (
                      <div key={p.proyecto_id} className="os-compare-chip">
                        <span
                          className="os-chip-dot"
                          style={{
                            backgroundColor: ['#22d3ee', '#10b981', '#f59e0b', '#a855f7'][idx % 4],
                          }}
                        />
                        <span className="os-chip-name">{p.proyecto}</span>
                        <span className="os-chip-zona">({p.ZONAS || p.ciudad})</span>
                        <button
                          className="os-chip-remove"
                          onClick={() => setCompareIds(compareIds.filter((id) => id !== p.proyecto_id))}>
                          ✕
                        </button>
                      </div>
                    ))}

                    {/* Quick Add Project Dropdown / Search */}
                    {comparedProjects.length < 4 && (
                      <div className="os-compare-add-box">
                        <input
                          type="text"
                          placeholder="+ Agregar proyecto..."
                          value={compareSearch}
                          onChange={(e) => setCompareSearch(e.target.value)}
                          className="os-compare-input"
                        />
                        {compareSearch && (
                          <div className="os-compare-dropdown">
                            {filteredProjects
                              .filter(
                                (p) =>
                                  !compareIds.includes(p.proyecto_id) &&
                                  p.proyecto.toLowerCase().includes(compareSearch.toLowerCase())
                              )
                              .slice(0, 6)
                              .map((p) => (
                                <div
                                  key={p.proyecto_id}
                                  className="os-compare-dropdown-item"
                                  onClick={() => {
                                    setCompareIds([...compareIds, p.proyecto_id])
                                    setCompareSearch('')
                                  }}>
                                  <span>{p.proyecto}</span>
                                  <span className="text-muted text-xs">{p.ZONAS} · {p.ciudad}</span>
                                </div>
                              ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {comparedProjects.length === 0 ? (
                  <div className="os-empty-state">
                    <span className="os-empty-icon">CMP</span>
                    <h3>No hay proyectos en el comparador</h3>
                    <p>Agrega proyectos arriba o desde Mission Control para contrastarlos en radar y métricas.</p>
                    <button
                      className="os-btn-primary"
                      onClick={() => {
                        const top2 = filteredProjects.slice(0, 2).map((p) => p.proyecto_id)
                        setCompareIds(top2)
                      }}>
                      Cargar 2 Proyectos de Ejemplo
                    </button>
                  </div>
                ) : (
                  <>
                    {/* Comparative Matrix Table */}
                    <div className="os-panel-card">
                      <div className="os-panel-card-header">
                        <div className="os-card-title">Matriz Comparativa Head-to-Head</div>
                        <div className="os-card-desc">Benchmarks y deltas automáticos entre proyectos</div>
                      </div>

                      <div className="os-table-scroll">
                        <table className="os-compare-table">
                          <thead>
                            <tr>
                              <th style={{ width: '22%' }}>Métrica Analítica</th>
                              {comparedProjects.map((p, idx) => (
                                <th key={p.proyecto_id} style={{ width: `${78 / comparedProjects.length}%` }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <span
                                      style={{
                                        width: 8,
                                        height: 8,
                                        borderRadius: '50%',
                                        backgroundColor: ['#22d3ee', '#10b981', '#f59e0b', '#a855f7'][idx % 4],
                                      }}
                                    />
                                    <span>{p.proyecto}</span>
                                  </div>
                                  <div className="text-muted text-xs font-normal">
                                    {p.ciudad} · {p.ZONAS || 'Sin Zona'}
                                  </div>
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            <tr>
                              <td className="font-semibold">Etapa de Obra</td>
                              {comparedProjects.map((p) => (
                                <td key={p.proyecto_id}>
                                  <span className="os-pill-badge">{p.etapa || 'No especificada'}</span>
                                </td>
                              ))}
                            </tr>

                            <tr>
                              <td className="font-semibold">Ritmo de Venta Mensual</td>
                              {comparedProjects.map((p) => {
                                const isWinner =
                                  (p.ritmo_venta ?? 0) ===
                                  Math.max(...comparedProjects.map((x) => x.ritmo_venta ?? 0))
                                return (
                                  <td key={p.proyecto_id}>
                                    <div className="os-metric-val font-bold text-success">
                                      {fmt(p.ritmo_venta, 1)} und/mes
                                      {isWinner && <span className="os-winner-tag">+ Mayor Tracción</span>}
                                    </div>
                                  </td>
                                )
                              })}
                            </tr>

                            <tr>
                              <td className="font-semibold">Stock por Vender (Unidades)</td>
                              {comparedProjects.map((p) => (
                                <td key={p.proyecto_id}>
                                  <div className="os-metric-val">
                                    {p.und_por_vender ?? '—'} unds
                                    <span className="text-muted text-xs"> (de {p.und_totales ?? '—'})</span>
                                  </div>
                                </td>
                              ))}
                            </tr>

                            <tr>
                              <td className="font-semibold">Meses de Stock Proyectados</td>
                              {comparedProjects.map((p) => {
                                const isOptimal =
                                  (p.meses_stock ?? 0) > 0 &&
                                  (p.meses_stock ?? 0) ===
                                    Math.min(
                                      ...comparedProjects
                                        .filter((x) => (x.meses_stock ?? 0) > 0)
                                        .map((x) => x.meses_stock ?? 999)
                                    )
                                return (
                                  <td key={p.proyecto_id}>
                                    <div className="os-metric-val text-warning">
                                      {fmt(p.meses_stock, 1)} meses
                                      {isOptimal && <span className="os-winner-tag">+ Menor Exposición</span>}
                                    </div>
                                  </td>
                                )
                              })}
                            </tr>

                            <tr>
                              <td className="font-semibold">% Absorción Vendido</td>
                              {comparedProjects.map((p) => (
                                <td key={p.proyecto_id}>
                                  <div className="os-metric-val font-semibold text-accent">
                                    {p.pct_vendido ?? 0}%
                                  </div>
                                  <div className="os-progress-bar">
                                    <div className="os-progress-fill" style={{ width: `${p.pct_vendido ?? 0}%` }} />
                                  </div>
                                </td>
                              ))}
                            </tr>

                            <tr>
                              <td className="font-semibold">Stock Total Valorizado</td>
                              {comparedProjects.map((p) => (
                                <td key={p.proyecto_id}>
                                  <div className="os-metric-val text-citrino font-bold">
                                    {fmtUSD(p.stock_total)}
                                  </div>
                                </td>
                              ))}
                            </tr>

                            <tr>
                              <td className="font-semibold">Desarrollador</td>
                              {comparedProjects.map((p) => (
                                <td key={p.proyecto_id} className="text-muted">
                                  {p.desarrollador || 'No indicado'}
                                </td>
                              ))}
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Radar Chart & Tipologías Breakdown */}
                    <div className="os-grid-2col">
                      <div className="os-panel-card">
                        <div className="os-panel-card-header">
                          <div className="os-card-title">Radar de Rendimiento Multidimensional</div>
                          <button className="os-btn-sm" onClick={handleExportChartPNG} title="Descargar Radar como imagen PNG">
                            Exportar PNG
                          </button>
                        </div>
                        <div style={{ height: 320 }}>
                          <ReactECharts
                            ref={chartRef}
                            option={radarChartOption}
                            style={{ height: '100%', width: '100%' }}
                          />
                        </div>
                      </div>

                      {/* Typologies Cross-Comparison */}
                      <div className="os-panel-card">
                        <div className="os-panel-card-header">
                          <div className="os-card-title">Comparativa de Tipologías de los Proyectos</div>
                          <div className="os-card-desc">Superficie promedio y valores de mercado</div>
                        </div>

                        <div className="os-table-compact-container">
                          {comparedProjects.map((proj) => {
                            const pTipos = allTipos.filter((t) => t.indicador_censo_id === proj.indicador_censo_id)
                            return (
                              <div key={proj.proyecto_id} style={{ marginBottom: 12 }}>
                                <div className="font-bold text-accent text-xs" style={{ marginBottom: 4 }}>
                                  {proj.proyecto} ({proj.ZONAS || proj.ciudad}):
                                </div>
                                {pTipos.length === 0 ? (
                                  <div className="text-muted text-xs">Sin desglose de tipologías en este snapshot.</div>
                                ) : (
                                  <div className="os-tipos-mini-grid">
                                    {pTipos.map((t) => (
                                      <div key={t.avg_tipologia} className="os-tipo-mini-card">
                                        <div className="os-tipo-name">{t.avg_tipologia}</div>
                                        <div className="os-tipo-m2">{fmt(t.avg_construccion_m2, 0)} m²</div>
                                        <div className="os-tipo-price">{fmtUSD(t.avg_precio)}</div>
                                        {t.avg_sus_m2 && (
                                          <div className="os-tipo-susm2 text-citrino">${Math.round(t.avg_sus_m2)}/m²</div>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* ══════════════════════════════════════════════════════════════════
                APP 3: GENERADOR DE REPORTES & DOSSIERS
            ══════════════════════════════════════════════════════════════════ */}
            {activeApp === 'dossier' && (
              <div className="os-app-view">
                {/* Dossier Control Header */}
                <div className="os-dossier-toolbar">
                  <div className="os-dossier-scope-selector">
                    <span className="text-muted font-semibold text-xs">ALCANCE DEL DOSSIER:</span>
                    <button
                      className={`os-btn-scope ${dossierScope === 'project' ? 'active' : ''}`}
                      onClick={() => setDossierScope('project')}>
                      Proyecto {selectedIndicador ? `(${selectedIndicador.proyecto})` : ''}
                    </button>
                    <button
                      className={`os-btn-scope ${dossierScope === 'zona' ? 'active' : ''}`}
                      onClick={() => setDossierScope('zona')}>
                      Zona {zonaFilter !== 'ALL' ? `(${zonaFilter})` : 'Consolidada'}
                    </button>
                    <button
                      className={`os-btn-scope ${dossierScope === 'market' ? 'active' : ''}`}
                      onClick={() => setDossierScope('market')}>
                      Mercado {ciudad}
                    </button>
                  </div>

                  <div className="os-dossier-actions">
                    <button className="os-btn-secondary" onClick={handleExportCSV}>
                      Exportar Datos (CSV)
                    </button>
                    <button className="os-btn-primary" onClick={() => window.print()}>
                      Imprimir / Guardar en PDF
                    </button>
                  </div>
                </div>

                {/* Printable Institutional Real Estate Dossier Card */}
                <div className="os-dossier-sheet print-document">
                  {/* Executive Header */}
                  <div className="os-dossier-header">
                    <div className="os-dossier-brand-col">
                      <div className="os-dossier-logo">CITRINO</div>
                      <div className="os-dossier-sublogo">INVESTMENT & REAL ESTATE INTELLIGENCE</div>
                    </div>
                    <div className="os-dossier-meta-col">
                      <div className="os-dossier-meta-item">
                        <strong>DOCUMENTO:</strong> DOSSIER EJECUTIVO DE MERCADO
                      </div>
                      <div className="os-dossier-meta-item">
                        <strong>FECHA:</strong> {new Date().toLocaleDateString('es-BO', { year: 'numeric', month: 'long', day: 'numeric' })}
                      </div>
                      <div className="os-dossier-meta-item">
                        <strong>MERCADO:</strong> {ciudad === 'ALL' ? 'Bolivia (Consolidado)' : ciudad}
                      </div>
                    </div>
                  </div>

                  <div className="os-dossier-divider" />

                  {/* Title & Subject */}
                  <div className="os-dossier-title-section">
                    <h1 className="os-dossier-h1">
                      {dossierScope === 'project' && (selectedIndicador?.proyecto || 'Seleccione un Proyecto para Ficha Específica')}
                      {dossierScope === 'zona' && `Análisis Sectorial — Zona ${zonaFilter !== 'ALL' ? zonaFilter : 'Consolidada'}`}
                      {dossierScope === 'market' && `Informe Ejecutivo de Oferta Inmobiliaria — ${ciudad}`}
                    </h1>
                    <div className="os-dossier-subtitle">
                      Censo Inmobiliario Medallion Pipeline · Cobertura de Unidades, Velocidad de Absorción y Pricing
                    </div>
                  </div>

                  {/* Executive KPI Bar */}
                  <div className="os-dossier-kpis">
                    <div className="os-dossier-kpi-item">
                      <span className="os-dossier-kpi-lbl">Unidades Totales</span>
                      <span className="os-dossier-kpi-val">
                        {dossierScope === 'project' && selectedIndicador
                          ? selectedIndicador.und_totales ?? '—'
                          : fmt(totalInicial, 0)}
                      </span>
                    </div>

                    <div className="os-dossier-kpi-item">
                      <span className="os-dossier-kpi-lbl">Stock Disponible</span>
                      <span className="os-dossier-kpi-val">
                        {dossierScope === 'project' && selectedIndicador
                          ? selectedIndicador.und_por_vender ?? '—'
                          : fmt(totalStockUnd, 0)}
                      </span>
                    </div>

                    <div className="os-dossier-kpi-item">
                      <span className="os-dossier-kpi-lbl">% Colocación</span>
                      <span className="os-dossier-kpi-val">
                        {dossierScope === 'project' && selectedIndicador
                          ? `${selectedIndicador.pct_vendido ?? 0}%`
                          : `${pctVendido}%`}
                      </span>
                    </div>

                    <div className="os-dossier-kpi-item">
                      <span className="os-dossier-kpi-lbl">Ritmo de Venta</span>
                      <span className="os-dossier-kpi-val">
                        {dossierScope === 'project' && selectedIndicador
                          ? `${fmt(selectedIndicador.ritmo_venta, 1)} u/m`
                          : `${fmt(avgRitmoGeneral, 1)} u/m`}
                      </span>
                    </div>

                    <div className="os-dossier-kpi-item">
                      <span className="os-dossier-kpi-lbl">Meses de Stock</span>
                      <span className="os-dossier-kpi-val">
                        {dossierScope === 'project' && selectedIndicador
                          ? `${fmt(selectedIndicador.meses_stock, 1)} m`
                          : `${fmt(mesesStockGeneral, 1)} m`}
                      </span>
                    </div>

                    <div className="os-dossier-kpi-item">
                      <span className="os-dossier-kpi-lbl">Valor Stock Total</span>
                      <span className="os-dossier-kpi-val">
                        {dossierScope === 'project' && selectedIndicador
                          ? fmtUSD(selectedIndicador.stock_total)
                          : fmtUSD(totalStockUSD)}
                      </span>
                    </div>
                  </div>

                  {/* Executive Commentary / Analytical Diagnosis */}
                  <div className="os-dossier-section">
                    <h2 className="os-dossier-h2">1. Diagnóstico Estratégico & Dinámica Comercial</h2>
                    <p className="os-dossier-p">
                      {dossierScope === 'project' && selectedIndicador ? (
                        <>
                          El proyecto <strong>{selectedIndicador.proyecto}</strong>, ubicado en la zona de{' '}
                          <strong>{selectedIndicador.ZONAS || 'no especificada'}</strong> ({selectedIndicador.ciudad}), se encuentra actualmente en etapa{' '}
                          <strong>{selectedIndicador.etapa || 'en desarrollo'}</strong>. Registra un ritmo de absorción de{' '}
                          <strong>{fmt(selectedIndicador.ritmo_venta, 1)} unidades mensuales</strong>, proyectando un agotamiento de inventario en{' '}
                          <strong>{fmt(selectedIndicador.meses_stock, 1)} meses</strong> sobre un remanente de {selectedIndicador.und_por_vender ?? 0} unidades.
                          {(selectedIndicador.pct_vendido ?? 0) > 70
                            ? ' El proyecto presenta una consolidación comercial muy sólida superando el 70% de ventas.'
                            : (selectedIndicador.pct_vendido ?? 0) < 30
                            ? ' El proyecto se encuentra en fases iniciales de colocación o pre-venta con inventario disponible sustancial.'
                            : ' El proyecto mantiene una absorción equilibrada y en línea con los promedios del submercado.'}
                        </>
                      ) : (
                        <>
                          El submercado evaluado en <strong>{ciudad}</strong> abarca un inventario activo de{' '}
                          <strong>{filteredProjects.length} proyectos</strong>, sumando <strong>{fmt(totalStockUnd, 0)} unidades</strong> por comercializar
                          con un valor consolidado de lista de <strong>{fmtUSD(totalStockUSD)}</strong>. La absorción media ponderada por desarrollo se sitúa en{' '}
                          <strong>{fmt(avgRitmoGeneral, 1)} unidades/mes</strong>, arrojando una expectativa de liquidación del inventario actual en torno a los{' '}
                          <strong>{fmt(mesesStockGeneral, 1)} meses</strong>.
                        </>
                      )}
                    </p>
                  </div>

                  {/* Table Breakdown */}
                  <div className="os-dossier-section">
                    <h2 className="os-dossier-h2">2. Desglose de Proyectos e Inventario</h2>
                    <table className="os-dossier-table">
                      <thead>
                        <tr>
                          <th>Proyecto</th>
                          <th>Zona</th>
                          <th>Etapa</th>
                          <th>Totales</th>
                          <th>Vendidas</th>
                          <th>Por Vender</th>
                          <th>% Vend.</th>
                          <th>Ritmo</th>
                          <th>Meses</th>
                          <th>Stock USD</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(dossierScope === 'project' && selectedIndicador ? [selectedIndicador] : filteredProjects.slice(0, 15)).map((p) => (
                          <tr key={p.proyecto_id}>
                            <td className="font-bold">{p.proyecto}</td>
                            <td>{p.ZONAS || '—'}</td>
                            <td>{p.etapa || '—'}</td>
                            <td>{p.und_totales ?? '—'}</td>
                            <td>{p.und_vendidas ?? '—'}</td>
                            <td className="font-bold">{p.und_por_vender ?? '—'}</td>
                            <td>{p.pct_vendido ?? 0}%</td>
                            <td>{fmt(p.ritmo_venta, 1)}</td>
                            <td>{fmt(p.meses_stock, 1)}</td>
                            <td>{fmtUSD(p.stock_total)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Footer Notice */}
                  <div className="os-dossier-footer">
                    <span>CITRINO PLATFORM · INFORMACIÓN CONFIDENCIAL PARA USO INSTITUCIONAL · BOLIVIA</span>
                    <span>Página 1 de 1</span>
                  </div>
                </div>
              </div>
            )}

            {/* ══════════════════════════════════════════════════════════════════
                APP 4: DATA & PIPELINE CONTROL (MEDALLION STUDIO)
            ══════════════════════════════════════════════════════════════════ */}
            {activeApp === 'pipeline' && (
              <div className="os-app-view">
                {/* Medallion Flow Diagram Banner */}
                <div className="os-panel-card">
                  <div className="os-panel-card-header">
                    <div>
                      <div className="os-card-title">Arquitectura Medallion ETL & Telemetría en Tiempo Real</div>
                      <div className="os-card-desc">Google Sheets API v4 → Transformación & Validaciones → Supabase Database</div>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button className="os-btn-sm" onClick={loadPipelineCounts}>
                        Refrescar Telemetría
                      </button>
                    </div>
                  </div>

                  {/* Flowchart Steps */}
                  <div className="os-pipeline-flow">
                    {/* Step 1: Bronze */}
                    <div className="os-pipe-step">
                      <div className="os-pipe-badge bronze">BRONZE LAYER</div>
                      <div className="os-pipe-title">Google Sheets Raw</div>
                      <div className="os-pipe-desc">
                        9 Fuentes sincronizadas cada 6h vía GitHub Actions (SCZ, LPZ, CBB).
                      </div>
                      <div className="os-pipe-meta">
                        <span>API v4 Service Account</span>
                        <span className="text-success">● Conectado</span>
                      </div>
                    </div>

                    <div className="os-pipe-arrow">→</div>

                    {/* Step 2: Silver */}
                    <div className="os-pipe-step">
                      <div className="os-pipe-badge silver">SILVER LAYER</div>
                      <div className="os-pipe-title">Normalización & Reglas</div>
                      <div className="os-pipe-desc">
                        Limpieza de moneda boliviana, parseo de fechas, deduplicación y coordenadas.
                      </div>
                      <div className="os-pipe-meta">
                        <span>Python 3.11 Transform</span>
                        <span className="text-success">● Validado</span>
                      </div>
                    </div>

                    <div className="os-pipe-arrow">→</div>

                    {/* Step 3: Gold / Diamond */}
                    <div className="os-pipe-step">
                      <div className="os-pipe-badge gold">GOLD / DIAMOND LAYER</div>
                      <div className="os-pipe-title">Supabase PostgreSQL</div>
                      <div className="os-pipe-desc">
                        Modelo relacional optimizado para consultas analíticas y frontend.
                      </div>
                      <div className="os-pipe-meta">
                        <span>PostgreSQL + RLS</span>
                        <span className="text-accent">● {tableCounts.oferta_proyectos || 0} Proyectos</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Database Tables Telemetry Cards */}
                <div className="os-kpi-grid">
                  <div
                    className={`os-kpi-card clickable ${pipelineTable === 'oferta_proyectos' ? 'active' : ''}`}
                    onClick={() => setPipelineTable('oferta_proyectos')}>
                    <div className="os-kpi-title">Tabla: oferta_proyectos</div>
                    <div className="os-kpi-val text-accent">{tableCounts.oferta_proyectos ?? '—'}</div>
                    <div className="os-kpi-sub">Entidades principales de proyectos</div>
                  </div>

                  <div
                    className={`os-kpi-card clickable ${pipelineTable === 'oferta_indicadores_censo' ? 'active' : ''}`}
                    onClick={() => setPipelineTable('oferta_indicadores_censo')}>
                    <div className="os-kpi-title">Tabla: oferta_indicadores_censo</div>
                    <div className="os-kpi-val text-citrino">{tableCounts.oferta_indicadores_censo ?? '—'}</div>
                    <div className="os-kpi-sub">Snapshots históricos y absorción</div>
                  </div>

                  <div
                    className={`os-kpi-card clickable ${pipelineTable === 'oferta_avg_tipologias' ? 'active' : ''}`}
                    onClick={() => setPipelineTable('oferta_avg_tipologias')}>
                    <div className="os-kpi-title">Tabla: oferta_avg_tipologias</div>
                    <div className="os-kpi-val text-success">{tableCounts.oferta_avg_tipologias ?? '—'}</div>
                    <div className="os-kpi-sub">Métricas agrupadas de dormitorios</div>
                  </div>

                  <div
                    className={`os-kpi-card clickable ${pipelineTable === 'oferta_amenidades' ? 'active' : ''}`}
                    onClick={() => setPipelineTable('oferta_amenidades')}>
                    <div className="os-kpi-title">Tabla: oferta_amenidades</div>
                    <div className="os-kpi-val text-warning">{tableCounts.oferta_amenidades ?? '—'}</div>
                    <div className="os-kpi-sub">Áreas comunes y amenidades</div>
                  </div>
                </div>

                {/* Raw Data Explorer / Inspector */}
                <div className="os-panel-card">
                  <div className="os-panel-card-header">
                    <div>
                      <div className="os-card-title">
                        Data Inspector: <span className="text-accent">{pipelineTable}</span>
                      </div>
                      <div className="os-card-desc">
                        Vista previa en vivo de los primeros 25 registros en Supabase
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: 8 }}>
                      <input
                        type="text"
                        placeholder="Filtrar registros mostrados..."
                        value={rawSearch}
                        onChange={(e) => setRawSearch(e.target.value)}
                        className="os-compare-input"
                        style={{ width: 220 }}
                      />
                    </div>
                  </div>

                  {rawLoading ? (
                    <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>
                      Consultando registros de Supabase...
                    </div>
                  ) : rawRows.length === 0 ? (
                    <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>
                      No se encontraron registros en {pipelineTable}.
                    </div>
                  ) : (
                    <div className="os-table-scroll" style={{ maxHeight: 380 }}>
                      <table className="os-compare-table">
                        <thead>
                          <tr>
                            {Object.keys(rawRows[0]).slice(0, 10).map((col) => (
                              <th key={col}>{col}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {rawRows
                            .filter((row) => {
                              if (!rawSearch) return true
                              return JSON.stringify(row).toLowerCase().includes(rawSearch.toLowerCase())
                            })
                            .map((row, i) => (
                              <tr key={i}>
                                {Object.keys(rawRows[0]).slice(0, 10).map((col) => (
                                  <td key={col} className="text-xs">
                                    {row[col] != null ? String(row[col]) : '—'}
                                  </td>
                                ))}
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
