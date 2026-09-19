import { useEffect, useState } from 'react'
import ReactECharts from 'echarts-for-react'
import {
  fetchIndicadores,
  getLatestPerProject,
  computeZonaMetrics,
} from '../lib/supabase'
import type { IndicadorFull, ZonaMetrics } from '../lib/supabase'

interface Props {
  ciudad: string
  zonaFilter?: string
  etapaFilter?: string | string[]
  selectedIndicador?: IndicadorFull | null
  onSelectIndicador?: (ind: IndicadorFull | null) => void
}

type MetricType = 'stock_zona' | 'evolucion_temporal' | 'ritmo_zona' | 'usd_zona' | 'meses_zona'

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
  if (n >= 1_000_000) return '$' + (n / 1_000_000).toFixed(1) + ' M'
  if (n >= 1_000) return '$' + Math.round(n / 1_000).toLocaleString('es-BO') + ' k'
  return '$' + Math.round(n).toLocaleString('es-BO')
}

export default function WorkspacePanel({
  ciudad,
  zonaFilter,
  etapaFilter,
  selectedIndicador,
  onSelectIndicador,
}: Props) {
  const [allIndicadores, setAllIndicadores] = useState<IndicadorFull[]>([])
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState<'chart' | 'table'>('chart')
  const [metricType, setMetricType] = useState<MetricType>('stock_zona')
  const [searchTable, setSearchTable] = useState('')

  // Series visibility toggles (like the screenshot checkboxes)
  const [showVendidas, setShowVendidas] = useState(true)
  const [showPorVender, setShowPorVender] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetchIndicadores(ciudad === 'ALL' ? undefined : ciudad)
      .then((inds) => {
        setAllIndicadores(inds)
        setLoading(false)
      })
      .catch((e) => {
        console.error('WorkspacePanel fetch error:', e)
        setLoading(false)
      })
  }, [ciudad])

  const latestProjects = getLatestPerProject(allIndicadores)

  // Apply active filters (Zona and Etapa if selected)
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

  // Compute metrics by Zona
  const zonaData = computeZonaMetrics(filteredProjects)
  const zonaByStock = [...zonaData].sort((a, b) => b.totalStockUnd - a.totalStockUnd)
  const zonaByUSD = [...zonaData].sort((a, b) => b.totalStockUSD - a.totalStockUSD)
  const zonaByRitmo = [...zonaData].sort((a, b) => b.ritmoVentaMensual - a.ritmoVentaMensual)
  const zonaByMeses = [...zonaData].sort((a, b) => a.mesesStock - b.mesesStock)

  // Global aggregate metrics
  const totalStockUnd = filteredProjects.reduce((s, p) => s + (p.und_por_vender ?? 0), 0)
  const totalStockUSD = filteredProjects.reduce((s, p) => s + (p.stock_total ?? 0), 0)
  const totalInicial = filteredProjects.reduce((s, p) => s + (p.und_totales ?? 0), 0)
  const totalVendidas = filteredProjects.reduce((s, p) => s + (p.und_vendidas ?? 0), 0)
  const pctVendido = totalInicial > 0 ? Math.round((totalVendidas / totalInicial) * 100) : 0
  const pctPorVender = 100 - pctVendido

  const totalRitmoMensual = filteredProjects.reduce((s, p) => s + (p.ritmo_venta ?? 0), 0)
  const avgRitmoPorProyecto = filteredProjects.length > 0 ? totalRitmoMensual / filteredProjects.length : 0
  const avgMesesStock = totalRitmoMensual > 0 ? totalStockUnd / totalRitmoMensual : 0

  // ─── Historical snapshots timeline aggregation ────────────────────────────
  const snapshotGroups = new Map<string, { date: string; vendidas: number; porVender: number; ritmo: number }>()
  allIndicadores.forEach((i) => {
    const d = i.fecha_snapshot
    if (!snapshotGroups.has(d)) {
      snapshotGroups.set(d, { date: d, vendidas: 0, porVender: 0, ritmo: 0 })
    }
    const g = snapshotGroups.get(d)!
    g.vendidas += i.und_vendidas ?? 0
    g.porVender += i.und_por_vender ?? 0
    g.ritmo += i.ritmo_venta ?? 0
  })

  const timelineData = Array.from(snapshotGroups.values()).sort((a, b) => a.date.localeCompare(b.date))

  // Delta calculation between last two snapshots for classical positive/negative indicator
  const lastSnapshot = timelineData.length > 0 ? timelineData[timelineData.length - 1] : null
  const prevSnapshot = timelineData.length > 1 ? timelineData[timelineData.length - 2] : null
  const deltaRitmo = (lastSnapshot && prevSnapshot && prevSnapshot.ritmo > 0)
    ? ((lastSnapshot.ritmo - prevSnapshot.ritmo) / prevSnapshot.ritmo) * 100
    : null

  // ─── ECharts Chart Builders ───────────────────────────────────────────────
  function getChartOption() {
    // 1. Historical Timeline Chart (Area / Line over snapshots)
    if (metricType === 'evolucion_temporal') {
      const dates = timelineData.map((d) => d.date)
      const seriesList: any[] = []

      if (showVendidas) {
        seriesList.push({
          name: 'Unidades Vendidas',
          type: 'line',
          smooth: true,
          data: timelineData.map((d) => d.vendidas),
          symbol: 'circle',
          symbolSize: 6,
          lineStyle: { color: '#10b981', width: 2.5 },
          itemStyle: { color: '#10b981' },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0, y: 0, x2: 0, y2: 1,
              colorStops: [
                { offset: 0, color: 'rgba(16, 185, 129, 0.3)' },
                { offset: 1, color: 'rgba(16, 185, 129, 0.0)' },
              ],
            },
          },
        })
      }

      if (showPorVender) {
        seriesList.push({
          name: 'Unidades por Vender (Stock)',
          type: 'line',
          smooth: true,
          data: timelineData.map((d) => d.porVender),
          symbol: 'circle',
          symbolSize: 6,
          lineStyle: { color: '#38bdf8', width: 2.5 },
          itemStyle: { color: '#38bdf8' },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0, y: 0, x2: 0, y2: 1,
              colorStops: [
                { offset: 0, color: 'rgba(56, 189, 248, 0.25)' },
                { offset: 1, color: 'rgba(56, 189, 248, 0.0)' },
              ],
            },
          },
        })
      }

      return {
        ...CHART_BASE,
        grid: { left: 20, right: 30, top: 20, bottom: 25, containLabel: true },
        tooltip: {
          trigger: 'axis',
          backgroundColor: '#0c1a2d',
          borderColor: '#1f395d',
          textStyle: { color: '#f1f5f9', fontSize: 11 },
        },
        xAxis: {
          type: 'category',
          data: dates,
          axisLine: { lineStyle: { color: '#182c48' } },
          axisLabel: { fontSize: 10, color: '#94a3b8' },
        },
        yAxis: {
          type: 'value',
          splitLine: { lineStyle: { color: '#182c48' } },
          axisLabel: { fontSize: 10, color: '#94a3b8' },
        },
        series: seriesList,
      }
    }

    // 2. Stock por Zona (Horizontal Bars)
    if (metricType === 'stock_zona') {
      const topZones = [...zonaByStock].slice(0, 12).reverse()
      return {
        ...CHART_BASE,
        grid: { left: 10, right: 45, top: 10, bottom: 10, containLabel: true },
        tooltip: {
          trigger: 'axis',
          backgroundColor: '#0c1a2d',
          borderColor: '#1f395d',
          textStyle: { color: '#f1f5f9', fontSize: 11 },
          formatter: (params: any) => {
            const p = params[0]
            return `<b>${p.name}</b><br/>Stock disponible: <b style="color:#38bdf8">${Number(p.value).toLocaleString('es-BO')} unds</b>`
          },
        },
        xAxis: {
          type: 'value',
          splitLine: { lineStyle: { color: '#182c48' } },
          axisLabel: { fontSize: 10, color: '#94a3b8' },
        },
        yAxis: {
          type: 'category',
          data: topZones.map((z) => (z.zona.length > 20 ? z.zona.slice(0, 20) + '…' : z.zona)),
          axisLabel: { fontSize: 10, color: '#cbd5e1' },
        },
        series: [
          {
            name: 'Stock x Vender',
            type: 'bar',
            barMaxWidth: 16,
            data: topZones.map((z) => z.totalStockUnd),
            itemStyle: {
              color: {
                type: 'linear',
                x: 0, y: 0, x2: 1, y2: 0,
                colorStops: [{ offset: 0, color: '#1565c0' }, { offset: 1, color: '#0284c7' }],
              },
              borderRadius: [0, 4, 4, 0],
            },
            label: {
              show: true,
              position: 'right',
              fontSize: 10,
              fontWeight: 600,
              color: '#38bdf8',
              formatter: (p: any) => (p.value > 0 ? Number(p.value).toLocaleString('es-BO') : ''),
            },
          },
        ],
      }
    }

    // 3. Ritmo de Ventas por Zona
    if (metricType === 'ritmo_zona') {
      const topZones = [...zonaByRitmo].slice(0, 12).reverse()
      return {
        ...CHART_BASE,
        grid: { left: 10, right: 45, top: 10, bottom: 10, containLabel: true },
        tooltip: {
          trigger: 'axis',
          backgroundColor: '#0c1a2d',
          borderColor: '#1f395d',
          textStyle: { color: '#f1f5f9', fontSize: 11 },
          formatter: (params: any) => {
            const p = params[0]
            return `<b>${p.name}</b><br/>Ritmo mensual: <b style="color:#10b981">${Number(p.value).toFixed(1)} und/mes</b>`
          },
        },
        xAxis: {
          type: 'value',
          splitLine: { lineStyle: { color: '#182c48' } },
          axisLabel: { fontSize: 10, color: '#94a3b8' },
        },
        yAxis: {
          type: 'category',
          data: topZones.map((z) => (z.zona.length > 20 ? z.zona.slice(0, 20) + '…' : z.zona)),
          axisLabel: { fontSize: 10, color: '#cbd5e1' },
        },
        series: [
          {
            name: 'Ritmo und/mes',
            type: 'bar',
            barMaxWidth: 16,
            data: topZones.map((z) => z.ritmoVentaMensual),
            itemStyle: {
              color: {
                type: 'linear',
                x: 0, y: 0, x2: 1, y2: 0,
                colorStops: [{ offset: 0, color: '#047857' }, { offset: 1, color: '#10b981' }],
              },
              borderRadius: [0, 4, 4, 0],
            },
            label: {
              show: true,
              position: 'right',
              fontSize: 10,
              fontWeight: 600,
              color: '#10b981',
              formatter: (p: any) => (p.value > 0 ? Number(p.value).toFixed(1) : ''),
            },
          },
        ],
      }
    }

    // 4. Monto USD por Zona
    if (metricType === 'usd_zona') {
      const topZones = [...zonaByUSD].slice(0, 12).reverse()
      return {
        ...CHART_BASE,
        grid: { left: 10, right: 55, top: 10, bottom: 10, containLabel: true },
        tooltip: {
          trigger: 'axis',
          backgroundColor: '#0c1a2d',
          borderColor: '#1f395d',
          textStyle: { color: '#f1f5f9', fontSize: 11 },
          formatter: (params: any) => {
            const p = params[0]
            return `<b>${p.name}</b><br/>Monto en stock: <b style="color:#22d3ee">${fmtUSD(p.value)} USD</b>`
          },
        },
        xAxis: {
          type: 'value',
          splitLine: { lineStyle: { color: '#182c48' } },
          axisLabel: {
            fontSize: 10,
            color: '#94a3b8',
            formatter: (v: number) => `$${(v / 1_000_000).toFixed(0)}M`,
          },
        },
        yAxis: {
          type: 'category',
          data: topZones.map((z) => (z.zona.length > 20 ? z.zona.slice(0, 20) + '…' : z.zona)),
          axisLabel: { fontSize: 10, color: '#cbd5e1' },
        },
        series: [
          {
            name: 'Stock USD',
            type: 'bar',
            barMaxWidth: 16,
            data: topZones.map((z) => z.totalStockUSD),
            itemStyle: {
              color: {
                type: 'linear',
                x: 0, y: 0, x2: 1, y2: 0,
                colorStops: [{ offset: 0, color: '#032e35' }, { offset: 1, color: '#0e7490' }],
              },
              borderRadius: [0, 4, 4, 0],
            },
            label: {
              show: true,
              position: 'right',
              fontSize: 10,
              fontWeight: 600,
              color: '#22d3ee',
              formatter: (p: any) => (p.value > 0 ? fmtUSD(p.value) : ''),
            },
          },
        ],
      }
    }

    // 5. Meses de Stock por Zona
    const topZones = [...zonaByMeses].slice(0, 12).reverse()
    return {
      ...CHART_BASE,
      grid: { left: 10, right: 40, top: 10, bottom: 10, containLabel: true },
      tooltip: {
        trigger: 'axis',
        backgroundColor: '#0c1a2d',
        borderColor: '#1f395d',
        textStyle: { color: '#f1f5f9', fontSize: 11 },
        formatter: (params: any) => {
          const p = params[0]
          return `<b>${p.name}</b><br/>Meses de stock: <b style="color:#22d3ee">${Number(p.value).toFixed(1)} meses</b>`
        },
      },
      xAxis: {
        type: 'value',
        splitLine: { lineStyle: { color: '#182c48' } },
        axisLabel: { fontSize: 10, color: '#94a3b8' },
      },
      yAxis: {
        type: 'category',
        data: topZones.map((z) => (z.zona.length > 20 ? z.zona.slice(0, 20) + '…' : z.zona)),
        axisLabel: { fontSize: 10, color: '#cbd5e1' },
      },
      series: [
        {
          name: 'Meses Stock',
          type: 'bar',
          barMaxWidth: 16,
          data: topZones.map((z) => z.mesesStock),
          itemStyle: {
            color: (param: any) => {
              const v = param.value
              if (v > 18) return '#ef4444'
              if (v > 12) return '#f59e0b'
              return '#10b981'
            },
            borderRadius: [0, 4, 4, 0],
          },
          label: {
            show: true,
            position: 'right',
            fontSize: 10,
            fontWeight: 600,
            color: '#cbd5e1',
            formatter: (p: any) => (p.value > 0 ? Number(p.value).toFixed(1) : ''),
          },
        },
      ],
    }
  }

  if (loading) {
    return (
      <div className="panel panel-center" style={{ alignItems: 'center', justifyContent: 'center' }}>
        <div className="empty-state">
          <div className="loading-shimmer" style={{ width: 220, height: 16, marginBottom: 8 }} />
          <div className="loading-shimmer" style={{ width: 160, height: 12 }} />
          <div style={{ marginTop: 12, fontSize: 11, color: 'var(--text-muted)' }}>
            Cargando indicadores de mercado...
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="panel panel-center" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* ─── SECTION 1: DATOS DESTACADOS (Modern KPI Row) ────────────────── */}
      <div style={{ padding: '12px 16px 10px', background: 'var(--bg-panel-header)', borderBottom: '1px solid var(--border-subtle)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: -0.2 }}>
            Datos destacados
          </span>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }} title="Consolidado de oferta censada">(i)</span>
        </div>
        <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginBottom: 10 }}>
          Datos de: Censos Inmobiliarios 2025 - 2026 · {ciudad === 'ALL' ? 'Bolivia' : ciudad}
        </div>

        {/* 4 Interactive KPI Cards */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 12,
        }}>
          {/* KPI 1: Stock en Oferta */}
          <div style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
            padding: '10px 12px',
            boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
          }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: -0.5 }}>
              {totalStockUnd.toLocaleString('es-BO')}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
              Stock en Oferta (Unds)
            </div>
            <div style={{ fontSize: 10, fontWeight: 600, marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
              <span className={pctVendido >= 50 ? 'badge-pos' : 'badge-neg'}>
                {pctVendido >= 50 ? '▲' : '▼'} {pctVendido}% colocado
              </span>
              <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>· {totalVendidas.toLocaleString('es-BO')} vendidas</span>
            </div>
          </div>

          {/* KPI 2: Capital en Stock (USD) */}
          <div style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
            padding: '10px 12px',
            boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
          }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--accent-cyan)', letterSpacing: -0.5 }}>
              {fmtUSD(totalStockUSD)}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
              Monto Total por Vender
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>
              {filteredProjects.length > 0 ? `${fmtUSD(totalStockUSD / filteredProjects.length)} prom / proyecto` : '—'}
            </div>
          </div>

          {/* KPI 3: Ritmo Mensual */}
          <div style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
            padding: '10px 12px',
            boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
          }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--accent-emerald)', letterSpacing: -0.5 }}>
              {Math.round(totalRitmoMensual)} <span style={{ fontSize: 12, fontWeight: 500 }}>und/mes</span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
              Ritmo de Ventas Mensual
            </div>
            {deltaRitmo != null ? (
              <div style={{ fontSize: 10, fontWeight: 600, marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                <span className={deltaRitmo >= 0 ? 'indicator-pos' : 'indicator-neg'}>
                  {deltaRitmo >= 0 ? `▲ +${deltaRitmo.toFixed(1)}%` : `▼ ${deltaRitmo.toFixed(1)}%`} vs censo anterior
                </span>
              </div>
            ) : (
              <div style={{ fontSize: 10, color: 'var(--color-positive)', fontWeight: 600, marginTop: 4 }}>
                ● {avgRitmoPorProyecto.toFixed(1)} und/mes promedio proyecto
              </div>
            )}
          </div>

          {/* KPI 4: Meses de Stock */}
          <div style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
            padding: '10px 12px',
            boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
          }}>
            <div style={{
              fontSize: 22,
              fontWeight: 800,
              color: avgMesesStock > 18 ? 'var(--color-negative)' : avgMesesStock > 12 ? 'var(--color-warning)' : 'var(--color-positive)',
              letterSpacing: -0.5
            }}>
              {avgMesesStock.toFixed(1)} <span style={{ fontSize: 12, fontWeight: 500 }}>meses</span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
              Horizonte de Liquidación
            </div>
            <div style={{
              fontSize: 10,
              color: avgMesesStock <= 12 ? 'var(--color-positive)' : avgMesesStock <= 18 ? 'var(--color-warning)' : 'var(--color-negative)',
              fontWeight: 600,
              marginTop: 4
            }}>
              {avgMesesStock <= 12 ? '● Absorción saludable (<12m)' : avgMesesStock <= 18 ? '▲ Presión moderada (12-18m)' : '! Sobre-inventario (>18m)'}
            </div>
          </div>
        </div>
      </div>

      {/* ─── SECTION 2: INDICADORES DINÁMICOS & CHART CONTAINER ──────────── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: '12px 16px' }}>
        {/* Subheader with Metric Selector Pill & View Switcher */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
              Indicadores
            </span>

            {/* Pill Selector (Styled in Citrino petrol teal brand palette) */}
            <div style={{ position: 'relative' }}>
              <select
                value={metricType}
                onChange={(e) => setMetricType(e.target.value as MetricType)}
                style={{
                  background: 'var(--bg-card)',
                  color: 'var(--citrino-teal-light)',
                  border: '1px solid var(--border-accent)',
                  borderRadius: 20,
                  padding: '5px 14px',
                  fontSize: 11.5,
                  fontWeight: 700,
                  outline: 'none',
                  cursor: 'pointer',
                  boxShadow: 'none',
                }}>
                <option value="stock_zona">Stock por Zona (Unidades)</option>
                <option value="evolucion_temporal">Evolución Histórica (Snapshots)</option>
                <option value="ritmo_zona">Ritmo de Ventas por Zona</option>
                <option value="usd_zona">Monto USD por Zona</option>
                <option value="meses_zona">Meses de Stock por Zona</option>
              </select>
            </div>
          </div>

          {/* Toggle between Chart & Table */}
          <div style={{ display: 'flex', gap: 4 }} className="citrino-subtabs">
            <button
              onClick={() => setViewMode('chart')}
              className={`citrino-subtab-btn ${viewMode === 'chart' ? 'active' : ''}`}>
              Gráfico
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`citrino-subtab-btn ${viewMode === 'table' ? 'active' : ''}`}>
              Tabla Proyectos ({filteredProjects.length})
            </button>
          </div>
        </div>

        {/* Chart or Table Area */}
        {viewMode === 'chart' ? (
          <div style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-lg)',
            padding: '14px 16px 10px',
            overflow: 'hidden',
          }}>
            {/* ECharts Instance */}
            <div style={{ flex: 1, minHeight: 260, width: '100%' }}>
              <ReactECharts option={getChartOption()} style={{ height: '100%', width: '100%' }} />
            </div>

            {/* Interactive Series Checkbox Bar (Exactly like user's screenshot) */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingTop: 10,
              marginTop: 6,
              borderTop: '1px solid var(--border-subtle)',
              fontSize: 11,
              flexWrap: 'wrap',
              gap: 12,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                {/* Checkbox 1: Vendidas */}
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', userSelect: 'none' }}>
                  <input
                    type="checkbox"
                    checked={showVendidas}
                    onChange={(e) => setShowVendidas(e.target.checked)}
                    style={{ accentColor: 'var(--accent-emerald)', cursor: 'pointer' }}
                  />
                  <span style={{ width: 14, height: 2, background: 'var(--accent-emerald)', display: 'inline-block' }} />
                  <span style={{ color: 'var(--text-secondary)' }}>Vendidas:</span>
                  <strong style={{ color: 'var(--text-primary)' }}>{totalVendidas.toLocaleString('es-BO')} ({pctVendido}%)</strong>
                </label>

                {/* Checkbox 2: Por Vender */}
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', userSelect: 'none' }}>
                  <input
                    type="checkbox"
                    checked={showPorVender}
                    onChange={(e) => setShowPorVender(e.target.checked)}
                    style={{ accentColor: 'var(--accent-cyan)', cursor: 'pointer' }}
                  />
                  <span style={{ width: 14, height: 2, background: 'var(--accent-cyan)', display: 'inline-block' }} />
                  <span style={{ color: 'var(--text-secondary)' }}>Por Vender (Stock):</span>
                  <strong style={{ color: 'var(--citrino-teal-light)' }}>{totalStockUnd.toLocaleString('es-BO')} ({pctPorVender}%)</strong>
                </label>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 14, color: 'var(--text-muted)', fontSize: 10.5 }}>
                <span>Proyectos analizados: <strong style={{ color: 'var(--text-primary)' }}>{filteredProjects.length}</strong></span>
                <span>Zonas activas: <strong style={{ color: 'var(--text-primary)' }}>{zonaData.length}</strong></span>
              </div>
            </div>
          </div>
        ) : (
          /* Table View */
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ padding: '6px 12px 10px', display: 'flex', gap: 10 }}>
              <input
                type="text"
                value={searchTable}
                onChange={(e) => setSearchTable(e.target.value)}
                placeholder="Buscar proyecto por nombre, zona o etapa..."
                style={{
                  flex: 1,
                  padding: '7px 12px',
                  fontSize: 12,
                  background: 'var(--bg-input)',
                  border: '1px solid var(--border-default)',
                  borderRadius: 'var(--radius-sm)',
                  color: 'var(--text-primary)',
                  outline: 'none',
                }}
              />
            </div>

            <div className="data-table-wrap" style={{ flex: 1, overflowY: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Proyecto</th>
                    <th>Zona</th>
                    <th>Etapa</th>
                    <th>Snapshot</th>
                    <th>Totales</th>
                    <th>Vendidas</th>
                    <th>Disponibles</th>
                    <th>% Avance</th>
                    <th>Ritmo</th>
                    <th>Meses Stock</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProjects
                    .filter((p) => {
                      if (!searchTable) return true
                      const q = searchTable.toLowerCase()
                      return (
                        p.proyecto.toLowerCase().includes(q) ||
                        (p.ZONAS && p.ZONAS.toLowerCase().includes(q)) ||
                        (p.etapa && p.etapa.toLowerCase().includes(q))
                      )
                    })
                    .sort((a, b) => (b.ritmo_venta ?? 0) - (a.ritmo_venta ?? 0))
                    .map((ind) => {
                      const isSelected = selectedIndicador?.indicador_censo_id === ind.indicador_censo_id
                      const pct = ind.und_totales && ind.und_vendidas != null
                        ? Math.round((ind.und_vendidas / ind.und_totales) * 100) : null

                      return (
                        <tr
                          key={ind.indicador_censo_id}
                          onClick={() => {
                            if (onSelectIndicador) {
                              onSelectIndicador(isSelected ? null : ind)
                            }
                          }}
                          style={{
                            cursor: 'pointer',
                            background: isSelected ? 'var(--bg-active)' : undefined,
                            borderLeft: isSelected ? '3px solid var(--citrino-teal-light)' : undefined,
                          }}>
                          <td className="td-project">{ind.proyecto}</td>
                          <td style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{ind.ZONAS || '—'}</td>
                          <td style={{ fontSize: 11, color: 'var(--text-muted)' }}>{ind.etapa || '—'}</td>
                          <td className="td-num">{ind.fecha_snapshot}</td>
                          <td className="td-num">{fmt(ind.und_totales, 0)}</td>
                          <td className="td-num" style={{ color: 'var(--color-positive)', fontWeight: 600 }}>{fmt(ind.und_vendidas, 0)}</td>
                          <td className="td-num" style={{ color: 'var(--text-primary)' }}>{fmt(ind.und_por_vender, 0)}</td>
                          <td className={`td-num ${pct != null ? (pct >= 60 ? 'good' : pct >= 40 ? 'warn' : 'bad') : ''}`}>
                            {pct != null ? `${pct}%` : '—'}
                          </td>
                          <td className={`td-num ${ind.ritmo_venta != null ? (ind.ritmo_venta > 0 ? 'good' : 'bad') : ''}`}>
                            {fmt(ind.ritmo_venta)}
                          </td>
                          <td className={`td-num ${ind.meses_stock != null ? (ind.meses_stock > 18 ? 'bad' : ind.meses_stock > 12 ? 'warn' : 'good') : ''}`}>
                            {fmt(ind.meses_stock)}
                          </td>
                        </tr>
                      )
                    })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
