import { useEffect, useState, useMemo } from 'react'
import ReactECharts from 'echarts-for-react'
import {
  fetchIndicadores,
  getLatestPerProject,
  computeZonaMetrics,
} from '../lib/supabase'
import type { IndicadorFull, ZonaMetrics } from '../lib/supabase'
import GeoespacialPanel from './GeoespacialPanel'
import ResumenEtapasMap from './ResumenEtapasMap'

interface Props {
  ciudad: string
  zonaFilter?: string
  etapaFilter?: string | string[]
  selectedIndicador?: IndicadorFull | null
  onSelectIndicador?: (ind: IndicadorFull | null) => void
  initialMetric?: MetricType
  kpiMode?: 'default' | 'stock_unidades' | 'stock_usd' | 'resumen_general'
  theme?: 'dark' | 'light'
}

export type MetricType = 'stock_zona' | 'stock_subzona' | 'evolucion_temporal' | 'ritmo_zona' | 'usd_zona' | 'meses_zona' | 'stock_und_bar' | 'stock_usd_bar' | 'meses_stock_bar'

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

function isActivoStage(stage?: string | null): boolean {
  if (!stage) return true
  const s = stage.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim()
  if (s.includes('paraliz') || s.includes('clandestin') || s.includes('inactiv') || s.includes('suspend')) return false
  if (s.includes('vendid') || s.includes('agotad')) return false
  return true
}

function isVendidoStage(stage?: string | null): boolean {
  if (!stage) return false
  const s = stage.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim()
  return s.includes('vendid') || s.includes('agotad')
}

function isInactivoStage(stage?: string | null): boolean {
  if (!stage) return false
  const s = stage.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim()
  return s.includes('paraliz') || s.includes('clandestin') || s.includes('inactiv') || s.includes('suspend')
}

export default function WorkspacePanel({
  ciudad,
  zonaFilter,
  etapaFilter,
  selectedIndicador,
  onSelectIndicador,
  initialMetric,
  kpiMode = 'default',
  theme = 'light',
}: Props) {
  const isResumenGeneral = kpiMode === 'resumen_general'
  const isStockUnidades = kpiMode === 'stock_unidades'
  const isStockUSD = kpiMode === 'stock_usd'
  const isStockMode = isStockUnidades || isStockUSD

  const [allIndicadores, setAllIndicadores] = useState<IndicadorFull[]>([])
  const [loading, setLoading] = useState(true)
  const [viewMode] = useState<'chart' | 'table' | 'map'>('chart')
  const [metricType, setMetricType] = useState<MetricType>(
    initialMetric || (isStockMode ? 'stock_und_bar' : 'stock_zona')
  )
  const [searchTable, setSearchTable] = useState('')
  const [selectedResumenStage, setSelectedResumenStage] = useState<string | null>(null)

  // Series visibility toggles (like the screenshot checkboxes)
  const [showVendidas, setShowVendidas] = useState(true)
  const [showPorVender, setShowPorVender] = useState(true)

  useEffect(() => {
    setSelectedResumenStage(null)
  }, [ciudad, zonaFilter, etapaFilter])

  useEffect(() => {
    if (initialMetric) {
      setMetricType(initialMetric)
    } else if (isStockMode) {
      setMetricType('stock_und_bar')
    }
  }, [initialMetric, isStockMode])

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
  const pctVendido = totalInicial > 0 ? (totalVendidas / totalInicial) * 100 : 0
  const pctPorVender = totalInicial > 0 ? (totalStockUnd / totalInicial) * 100 : 0

  const avgVendidasPorProy = filteredProjects.length > 0 ? totalVendidas / filteredProjects.length : 0
  const avgVendidasPorProyInt = Math.round(avgVendidasPorProy)

  const avgPorVenderPorProy = filteredProjects.length > 0 ? totalStockUnd / filteredProjects.length : 0
  const avgPorVenderPorProyInt = Math.round(avgPorVenderPorProy)

  // USD Global aggregate metrics (Tarea 6: Stock en Venta USD usando stock_x_vender y stock_vendido)
  const totalStockXVenderUSD = filteredProjects.reduce((s, p) => s + (p.stock_x_vender ?? 0), 0)
  const totalStockVendidoUSD = filteredProjects.reduce((s, p) => s + (p.stock_vendido ?? 0), 0)
  const totalInicialUSD = filteredProjects.reduce((s, p) => {
    const t = p.stock_total ?? 0
    return s + (t > 0 ? t : (p.stock_vendido ?? 0) + (p.stock_x_vender ?? 0))
  }, 0)

  const pctVendidoUSD = totalInicialUSD > 0 ? (totalStockVendidoUSD / totalInicialUSD) * 100 : 0
  const pctPorVenderUSD = totalInicialUSD > 0 ? (totalStockXVenderUSD / totalInicialUSD) * 100 : 0

  const avgVendidoPorProyUSD = filteredProjects.length > 0 ? totalStockVendidoUSD / filteredProjects.length : 0
  const avgPorVenderPorProyUSD = filteredProjects.length > 0 ? totalStockXVenderUSD / filteredProjects.length : 0
  const avgStockInicialUSD = filteredProjects.length > 0 ? Math.round(totalInicialUSD / filteredProjects.length) : 0

  const totalRitmoMensual = filteredProjects.reduce((s, p) => s + (p.ritmo_venta ?? 0), 0)
  const avgRitmoPorProyecto = filteredProjects.length > 0 ? totalRitmoMensual / filteredProjects.length : 0
  const avgMesesStock = totalRitmoMensual > 0 ? totalStockUnd / totalRitmoMensual : 0

  // Promedio Stock Inicial & Agrupación ZONAS vs SUBZONAS (desde oferta_proyectos)
  const avgStockInicial = filteredProjects.length > 0 ? Math.round(totalInicial / filteredProjects.length) : 0
  const isBySubzona = isStockMode && metricType === 'stock_subzona'
  // New stock mode lateral bar selector: which metric the two bar charts display
  const stockBarMode: 'und' | 'usd' | 'meses' = isStockMode
    ? metricType === 'stock_usd_bar' ? 'usd'
    : metricType === 'meses_stock_bar' ? 'meses'
    : 'und'
    : 'und'

  // Agrupación por ZONAS de oferta_proyectos
  const zonaStockMetrics = useMemo(() => {
    const groups = new Map<string, {
      name: string
      totalStockUnd: number
      totalVendidas: number
      totalInicial: number
      totalStockXVenderUSD: number
      totalStockVendidoUSD: number
      totalInicialUSD: number
      totalProyectos: number
    }>()
    filteredProjects.forEach((p) => {
      const key = (p.ZONAS || 'Sin Zona').trim()
      if (!groups.has(key)) {
        groups.set(key, {
          name: key,
          totalStockUnd: 0,
          totalVendidas: 0,
          totalInicial: 0,
          totalStockXVenderUSD: 0,
          totalStockVendidoUSD: 0,
          totalInicialUSD: 0,
          totalProyectos: 0,
        })
      }
      const g = groups.get(key)!
      g.totalStockUnd += (p.und_por_vender ?? 0)
      g.totalVendidas += (p.und_vendidas ?? 0)
      g.totalInicial += (p.und_totales ?? 0)
      g.totalStockXVenderUSD += (p.stock_x_vender ?? 0)
      g.totalStockVendidoUSD += (p.stock_vendido ?? 0)
      const t = p.stock_total ?? 0
      g.totalInicialUSD += (t > 0 ? t : (p.stock_vendido ?? 0) + (p.stock_x_vender ?? 0))
      g.totalProyectos += 1
    })
    return Array.from(groups.values())
  }, [filteredProjects])

  // Agrupación por SUBZONAS de oferta_proyectos
  const subzonaStockMetrics = useMemo(() => {
    const groups = new Map<string, {
      name: string
      totalStockUnd: number
      totalVendidas: number
      totalInicial: number
      totalStockXVenderUSD: number
      totalStockVendidoUSD: number
      totalInicialUSD: number
      totalProyectos: number
    }>()
    filteredProjects.forEach((p) => {
      const key = (p.SUBZONAS || 'Sin Subzona').trim()
      if (!groups.has(key)) {
        groups.set(key, {
          name: key,
          totalStockUnd: 0,
          totalVendidas: 0,
          totalInicial: 0,
          totalStockXVenderUSD: 0,
          totalStockVendidoUSD: 0,
          totalInicialUSD: 0,
          totalProyectos: 0,
        })
      }
      const g = groups.get(key)!
      g.totalStockUnd += (p.und_por_vender ?? 0)
      g.totalVendidas += (p.und_vendidas ?? 0)
      g.totalInicial += (p.und_totales ?? 0)
      g.totalStockXVenderUSD += (p.stock_x_vender ?? 0)
      g.totalStockVendidoUSD += (p.stock_vendido ?? 0)
      const t = p.stock_total ?? 0
      g.totalInicialUSD += (t > 0 ? t : (p.stock_vendido ?? 0) + (p.stock_x_vender ?? 0))
      g.totalProyectos += 1
    })
    return Array.from(groups.values())
  }, [filteredProjects])

  const activeZonesCount = isBySubzona
    ? subzonaStockMetrics.filter((s) => s.totalProyectos > 0).length
    : zonaStockMetrics.filter((s) => s.totalProyectos > 0).length

  // ─── Proyectos Status Counts (Tarea 2: Stock en Ventas Unidades) ─────────
  const countActivosCurrent = filteredProjects.filter((p) => isActivoStage(p.etapa)).length
  const countVendidosCurrent = filteredProjects.filter((p) => isVendidoStage(p.etapa)).length
  const countInactivosCurrent = filteredProjects.filter((p) => isInactivoStage(p.etapa)).length
  const totalProyectosCurrent = filteredProjects.length

  // Previous snapshot for historical metric comparison
  const snapshotDates = [...new Set(allIndicadores.map((i) => i.fecha_snapshot).filter(Boolean))].sort()
  const prevSnapshotDate = snapshotDates.length > 1 ? snapshotDates[snapshotDates.length - 2] : null

  const prevProjects = prevSnapshotDate
    ? allIndicadores.filter((p) => {
        if (p.fecha_snapshot !== prevSnapshotDate) return false
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
    : []

  const countActivosPrev = prevProjects.filter((p) => isActivoStage(p.etapa)).length
  const countVendidosPrev = prevProjects.filter((p) => isVendidoStage(p.etapa)).length
  const countInactivosPrev = prevProjects.filter((p) => isInactivoStage(p.etapa)).length

  const deltaActivos = countActivosCurrent - countActivosPrev
  const deltaActivosPct = countActivosPrev > 0 ? ((deltaActivos) / countActivosPrev) * 100 : null

  const deltaVendidos = countVendidosCurrent - countVendidosPrev
  const deltaVendidosPct = countVendidosPrev > 0 ? ((deltaVendidos) / countVendidosPrev) * 100 : null

  const deltaInactivos = countInactivosCurrent - countInactivosPrev
  const deltaInactivosPct = countInactivosPrev > 0 ? ((deltaInactivos) / countInactivosPrev) * 100 : null

  // Previous snapshot metrics for Stock en Ventas (Unidades) 5 KPIs
  const prevStockUnd = prevProjects.reduce((s, p) => s + (p.und_por_vender ?? 0), 0)
  const prevInicial = prevProjects.reduce((s, p) => s + (p.und_totales ?? 0), 0)
  const prevVendidas = prevProjects.reduce((s, p) => s + (p.und_vendidas ?? 0), 0)
  const prevAvgVendidas = prevProjects.length > 0 ? prevVendidas / prevProjects.length : 0
  const prevAvgPorVender = prevProjects.length > 0 ? prevStockUnd / prevProjects.length : 0
  const prevPctVendido = prevInicial > 0 ? (prevVendidas / prevInicial) * 100 : 0
  const prevPctPorVender = prevInicial > 0 ? (prevStockUnd / prevInicial) * 100 : 0

  const deltaStock = totalStockUnd - prevStockUnd
  const deltaStockPct = prevStockUnd > 0 ? ((totalStockUnd - prevStockUnd) / prevStockUnd) * 100 : null
  const deltaAvgVendidas = avgVendidasPorProy - prevAvgVendidas
  const deltaAvgVendidasPct = prevAvgVendidas > 0 ? ((avgVendidasPorProy - prevAvgVendidas) / prevAvgVendidas) * 100 : null
  const deltaPctVendido = pctVendido - prevPctVendido
  const deltaAvgPorVender = avgPorVenderPorProy - prevAvgPorVender
  const deltaAvgPorVenderPct = prevAvgPorVender > 0 ? ((avgPorVenderPorProy - prevAvgPorVender) / prevAvgPorVender) * 100 : null
  const deltaPctPorVender = pctPorVender - prevPctPorVender

  // Previous snapshot metrics for Stock en Ventas (USD)
  const prevStockXVenderUSD = prevProjects.reduce((s, p) => s + (p.stock_x_vender ?? 0), 0)
  const prevStockVendidoUSD = prevProjects.reduce((s, p) => s + (p.stock_vendido ?? 0), 0)
  const prevStockTotalUSD = prevProjects.reduce((s, p) => {
    const t = p.stock_total ?? 0
    return s + (t > 0 ? t : (p.stock_vendido ?? 0) + (p.stock_x_vender ?? 0))
  }, 0)

  const prevAvgVendidoUSD = prevProjects.length > 0 ? prevStockVendidoUSD / prevProjects.length : 0
  const prevAvgPorVenderUSD = prevProjects.length > 0 ? prevStockXVenderUSD / prevProjects.length : 0
  const prevPctVendidoUSD = prevStockTotalUSD > 0 ? (prevStockVendidoUSD / prevStockTotalUSD) * 100 : 0
  const prevPctPorVenderUSD = prevStockTotalUSD > 0 ? (prevStockXVenderUSD / prevStockTotalUSD) * 100 : 0

  const deltaAvgVendidoUSD = avgVendidoPorProyUSD - prevAvgVendidoUSD
  const deltaAvgVendidoUSDPct = prevAvgVendidoUSD > 0 ? (deltaAvgVendidoUSD / prevAvgVendidoUSD) * 100 : null

  const deltaPctVendidoUSD = pctVendidoUSD - prevPctVendidoUSD

  const deltaAvgPorVenderUSD = avgPorVenderPorProyUSD - prevAvgPorVenderUSD
  const deltaAvgPorVenderUSDPct = prevAvgPorVenderUSD > 0 ? (deltaAvgPorVenderUSD / prevAvgPorVenderUSD) * 100 : null

  const deltaPctPorVenderUSD = pctPorVenderUSD - prevPctPorVenderUSD

  // Determina si hay un filtro de etapas activo (por FilterBar o selección en Resumen General)
  const isEtapaFiltered = Boolean(
    (etapaFilter && (
      Array.isArray(etapaFilter)
        ? etapaFilter.length > 0 && !etapaFilter.includes('ALL')
        : etapaFilter !== 'ALL'
    )) || (selectedResumenStage && selectedResumenStage === 'Vendida')
  )

  // En Resumen General: por requerimiento, quitar los datos vendidos de las barras y mapa a menos que se filtre por etapas
  const resumenProjects = useMemo(() => {
    if (!isResumenGeneral) return filteredProjects
    if (isEtapaFiltered) return filteredProjects
    return filteredProjects.filter((p) => !isVendidoStage(p.etapa))
  }, [isResumenGeneral, filteredProjects, isEtapaFiltered])

  // ─── Stage breakdowns for Resumen General ──────────────────────
  let countPreventa = 0
  let countObraBruta = 0
  let countObraFina = 0
  let countTerminada = 0
  let countVendida = 0
  let countParalizada = 0
  let countClandestina = 0

  resumenProjects.forEach((p) => {
    const s = (p.etapa || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim()

    // 1. Inactivos
    if (s.includes('clandestin')) {
      countClandestina++
      return
    }
    if (s.includes('paraliz') || s.includes('inactiv') || s.includes('suspend') || s.includes('detenid')) {
      countParalizada++
      return
    }

    // 2. Vendidos
    if (s.includes('vendid') || s.includes('agotad')) {
      countVendida++
      return
    }

    // 3. Activos
    if (s.includes('preventa') || s.includes('pozo') || s.includes('lanzamiento')) {
      countPreventa++
    } else if (s.includes('bruta') || s.includes('gruesa') || s.includes('estructura')) {
      countObraBruta++
    } else if (s.includes('fina') || s.includes('acabad')) {
      countObraFina++
    } else if (s.includes('terminad') || s.includes('entrega')) {
      countTerminada++
    } else {
      countPreventa++
    }
  })

  const countInactivos = countParalizada + countClandestina
  const totalProyectosResumen = resumenProjects.length

  const rawStageItems = [
    { id: 'Preventa', name: 'Preventa', count: countPreventa, pct: totalProyectosResumen > 0 ? (countPreventa / totalProyectosResumen) * 100 : 0, color: '#59aef4' },
    { id: 'Obra bruta', name: 'Obra bruta', count: countObraBruta, pct: totalProyectosResumen > 0 ? (countObraBruta / totalProyectosResumen) * 100 : 0, color: '#ffcd04' },
    { id: 'Obra fina', name: 'Obra fina', count: countObraFina, pct: totalProyectosResumen > 0 ? (countObraFina / totalProyectosResumen) * 100 : 0, color: '#175192' },
    { id: 'Terminada', name: 'Terminada', count: countTerminada, pct: totalProyectosResumen > 0 ? (countTerminada / totalProyectosResumen) * 100 : 0, color: '#ad7fe6' },
    { id: 'Vendida', name: 'Vendida', count: countVendida, pct: totalProyectosResumen > 0 ? (countVendida / totalProyectosResumen) * 100 : 0, color: '#0e9d58' },
    { id: 'Inactivos', name: 'Inactivos', count: countInactivos, pct: totalProyectosResumen > 0 ? (countInactivos / totalProyectosResumen) * 100 : 0, color: '#991b1b' },
  ]

  // Si no hay filtro de etapas activo, quitar 'Vendida' de las barras laterales
  const stageItems = useMemo(() => {
    if (isEtapaFiltered) {
      const active = rawStageItems.filter((s) => s.count > 0 || (s.id === 'Vendida' && countVendida > 0))
      return active.length > 0 ? active : rawStageItems.filter((s) => s.id !== 'Vendida')
    }
    // Por defecto, quitar los datos vendidos
    return rawStageItems.filter((s) => s.id !== 'Vendida')
  }, [rawStageItems, isEtapaFiltered, countVendida])

  const selectedResumenStageItem = selectedResumenStage ? stageItems.find((s) => s.name === selectedResumenStage) : null

  // 1. Gráfico de Barras Laterales — Cantidad de Proyectos por Etapa (Color base: Gris Degradado #52525b-#a1a1aa)
  function getResumenEtapasBarOption() {
    const isDark = theme === 'dark'
    // Orden descendente (de mayor a menor de arriba hacia abajo)
    const stages = [...stageItems].sort((a, b) => a.count - b.count)

    const countTextColor = isDark ? '#cbd5e1' : '#475569'
    const countTextDimmedColor = isDark ? 'rgba(148, 163, 184, 0.4)' : 'rgba(100, 116, 139, 0.4)'

    return {
      ...CHART_BASE,
      grid: { left: 10, right: 65, top: 15, bottom: 10, containLabel: true },
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        backgroundColor: isDark ? '#0f172a' : '#ffffff',
        borderColor: isDark ? '#334155' : '#cbd5e1',
        textStyle: { color: isDark ? '#f8fafc' : '#0f172a', fontSize: 11 },
        formatter: (params: any) => {
          const p = params[0]
          const item = stageItems.find((s) => s.name === p.name)
          const pct = item ? item.pct.toFixed(1) : '0'
          const col = item ? item.color : '#a1a1aa'
          return `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${col};margin-right:6px;"></span><b>${p.name}</b><br/>Cantidad: <b>${p.value} proyectos</b> (${pct}%)`
        },
      },
      xAxis: {
        type: 'value',
        splitLine: { lineStyle: { color: isDark ? '#2a2e39' : '#e2e8f0' } },
        axisLabel: { fontSize: 10, color: isDark ? '#94a3b8' : '#64748b' },
      },
      yAxis: {
        type: 'category',
        data: stages.map((s) => s.name),
        axisLabel: {
          fontSize: 11,
          color: isDark ? '#cbd5e1' : '#334155',
          fontWeight: 600,
          formatter: (val: string) => {
            if (selectedResumenStage && selectedResumenStage !== val) {
              return `{dimmed|${val}}`
            }
            return val
          },
          rich: {
            dimmed: {
              color: isDark ? 'rgba(148, 163, 184, 0.4)' : 'rgba(100, 116, 139, 0.4)',
              fontWeight: 400,
            },
          },
        },
        axisLine: { lineStyle: { color: isDark ? '#334155' : '#cbd5e1' } },
      },
      series: [
        {
          name: 'Proyectos',
          type: 'bar',
          barMaxWidth: 18,
          emphasis: {
            focus: 'none',
            itemStyle: {
              opacity: 0.88,
            },
            label: {
              show: true,
              position: 'right',
              fontSize: 10.5,
              fontWeight: 600,
              color: countTextColor,
              formatter: '{c}',
            },
          },
          data: stages.map((s) => {
            const isSelected = selectedResumenStage === s.name
            const hasSelection = selectedResumenStage != null
            const isDimmed = hasSelection && !isSelected
            const currentLabelColor = isDimmed ? countTextDimmedColor : countTextColor

            if (isDimmed) {
              // Sombra transparente para las etapas no seleccionadas (sin bordes ni neón)
              return {
                value: s.count,
                itemStyle: {
                  color: isDark ? 'rgba(161, 161, 170, 0.12)' : 'rgba(161, 161, 170, 0.18)',
                  borderWidth: 0,
                  borderColor: 'transparent',
                  borderRadius: [0, 4, 4, 0],
                },
                label: {
                  show: s.count > 0,
                  position: 'right',
                  fontSize: 10,
                  color: currentLabelColor,
                  formatter: '{c}',
                },
                emphasis: {
                  itemStyle: {
                    color: isDark ? 'rgba(161, 161, 170, 0.18)' : 'rgba(161, 161, 170, 0.25)',
                    borderWidth: 0,
                  },
                  label: {
                    show: s.count > 0,
                    position: 'right',
                    fontSize: 10,
                    color: currentLabelColor,
                    formatter: '{c}',
                  },
                },
              }
            }

            // Normal (sin selección) o Seleccionado:
            // Si está seleccionado -> cambia al color asignado de la etapa (s.color) sin bordes ni neón
            // Si no hay selección -> color gris degradado de la pestaña proyectos
            const barColor = isSelected
              ? s.color
              : {
                  type: 'linear',
                  x: 0,
                  y: 0,
                  x2: 1,
                  y2: 0,
                  colorStops: [
                    { offset: 0, color: '#52525b' },
                    { offset: 1, color: '#a1a1aa' },
                  ],
                }

            return {
              value: s.count,
              itemStyle: {
                color: barColor,
                borderRadius: [0, 4, 4, 0],
                borderWidth: 0,
                borderColor: 'transparent',
              },
              label: {
                show: s.count > 0,
                position: 'right',
                fontSize: 10.5,
                fontWeight: 600,
                color: currentLabelColor,
                formatter: '{c}',
              },
              emphasis: {
                itemStyle: {
                  opacity: 0.88,
                  borderWidth: 0,
                },
                label: {
                  show: s.count > 0,
                  position: 'right',
                  fontSize: 10.5,
                  fontWeight: 600,
                  color: currentLabelColor,
                  formatter: '{c}',
                },
              },
            }
          }),
        },
      ],
    }
  }

  // 2. Gráfico Circular Donut — Participación por Etapa (Base: Gris Degradado #52525b-#a1a1aa, Seleccionado: color de etapa sin neón ni bordes)
  function getResumenDonutOption() {
    const isDark = theme === 'dark'
    const sel = selectedResumenStage ? stageItems.find((s) => s.name === selectedResumenStage) : null

    const data = stageItems.map((s) => {
      const isSelected = selectedResumenStage === s.name
      const hasSelection = selectedResumenStage != null

      let sliceColor: any = {
        type: 'linear',
        x: 0,
        y: 0,
        x2: 1,
        y2: 1,
        colorStops: [
          { offset: 0, color: '#52525b' },
          { offset: 1, color: '#a1a1aa' },
        ],
      }

      if (hasSelection) {
        if (isSelected) {
          sliceColor = s.color
        } else {
          // Sombra transparente para las demás etapas no seleccionadas
          sliceColor = isDark ? 'rgba(161, 161, 170, 0.14)' : 'rgba(161, 161, 170, 0.22)'
        }
      }

      return {
        value: s.count,
        name: s.name,
        itemStyle: {
          color: sliceColor,
          borderColor: 'transparent',
          borderWidth: 0,
          borderRadius: 0,
        },
        selected: isSelected,
      }
    })

    return {
      ...CHART_BASE,
      title: {
        text: sel ? `${sel.pct.toFixed(1)}%` : `${totalProyectosResumen}`,
        subtext: sel ? `${sel.name}\n${sel.count} proyectos` : 'Proyectos Totales\n100% de la oferta',
        left: 'center',
        top: '38%',
        textStyle: {
          fontSize: 28,
          fontWeight: 800,
          color: sel ? sel.color : (isDark ? '#f8fafc' : '#0f172a'),
          lineHeight: 32,
        },
        subtextStyle: {
          fontSize: 11,
          fontWeight: 600,
          color: isDark ? '#94a3b8' : '#64748b',
          lineHeight: 15,
        },
      },
      tooltip: {
        trigger: 'item',
        backgroundColor: isDark ? '#0f172a' : '#ffffff',
        borderColor: isDark ? '#334155' : '#cbd5e1',
        textStyle: { color: isDark ? '#f8fafc' : '#0f172a', fontSize: 11 },
        formatter: (params: any) => {
          const item = stageItems.find((s) => s.name === params.name)
          const col = item ? item.color : '#a1a1aa'
          return `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${col};margin-right:6px;"></span><b>${params.name}</b><br/>Cantidad: <b>${params.value} proy.</b><br/>Participación: <b>${params.percent}%</b>`
        },
      },
      series: [
        {
          name: 'Participación por Etapa',
          type: 'pie',
          radius: ['52%', '78%'],
          center: ['50%', '48%'],
          avoidLabelOverlap: false,
          label: { show: false },
          labelLine: { show: false },
          padAngle: 1,
          data,
          emphasis: {
            scale: true,
            scaleSize: 4,
            itemStyle: {
              borderWidth: 0,
              borderColor: 'transparent',
              shadowBlur: 0,
              shadowColor: 'transparent',
            },
          },
        },
      ],
    }
  }

  // ─── Tarea 5 & Tarea 6: ECharts Dual Lateral Bar Builders ──
  // Left Bar Chart: Stock por Vender (Unidades), Stock por Vender (USD), or Meses de Stock
  function getStockPorVenderBarOption() {
    const isDark = theme === 'dark'

    // Meses de Stock mode: reuse zonaByMeses data
    if (stockBarMode === 'meses') {
      const topZones = [...zonaByMeses].filter(z => z.mesesStock > 0).slice(0, 14).reverse()
      if (topZones.length === 0) {
        return {
          ...CHART_BASE,
          title: { show: true, text: '—', subtext: 'Sin datos de meses de stock', left: 'center', top: '40%',
            textStyle: { fontSize: 16, fontWeight: 700, color: isDark ? '#94a3b8' : '#64748b' },
            subtextStyle: { fontSize: 11, color: isDark ? '#64748b' : '#94a3b8' },
          },
          xAxis: { show: false }, yAxis: { show: false }, series: [],
        }
      }
      return {
        ...CHART_BASE,
        grid: { left: 8, right: 65, top: 10, bottom: 10, containLabel: true },
        tooltip: {
          trigger: 'axis',
          backgroundColor: isDark ? '#0f172a' : '#ffffff',
          borderColor: isDark ? '#334155' : '#cbd5e1',
          textStyle: { color: isDark ? '#f8fafc' : '#0f172a', fontSize: 11 },
          formatter: (params: any) => {
            const p = params[0]
            const v = Number(p.value)
            const color = v > 18 ? '#ef4444' : v > 12 ? '#f59e0b' : '#10b981'
            return `<b>${p.name}</b><br/>Meses de stock: <b style="color:${color}">${v.toFixed(1)} meses</b>`
          },
        },
        xAxis: {
          type: 'value',
          splitLine: { lineStyle: { color: isDark ? '#2a2e39' : '#e2e8f0' } },
          axisLabel: { fontSize: 10, color: isDark ? '#94a3b8' : '#64748b', formatter: (v: number) => `${v.toFixed(0)}m` },
        },
        yAxis: {
          type: 'category',
          data: topZones.map((z) => (z.zona.length > 22 ? z.zona.slice(0, 22) + '…' : z.zona)),
          axisLabel: { fontSize: 10.5, color: isDark ? '#cbd5e1' : '#334155', fontWeight: 500 },
          axisLine: { lineStyle: { color: isDark ? '#334155' : '#cbd5e1' } },
        },
        series: [{
          name: 'Meses de Stock',
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
            show: true, position: 'right', fontSize: 10.5, fontWeight: 600,
            color: isDark ? '#f1f5f9' : '#0f172a',
            formatter: (p: any) => p.value > 0 ? Number(p.value).toFixed(1) : '',
          },
        }],
      }
    }

    // Unidades or USD mode
    const sourceItems = zonaStockMetrics
    const items = stockBarMode === 'usd'
      ? sourceItems
          .filter((g) => g.totalStockXVenderUSD > 0)
          .sort((a, b) => b.totalStockXVenderUSD - a.totalStockXVenderUSD)
          .slice(0, 14)
          .reverse()
      : sourceItems
          .filter((g) => g.totalStockUnd > 0)
          .sort((a, b) => b.totalStockUnd - a.totalStockUnd)
          .slice(0, 14)
          .reverse()

    if (items.length === 0) {
      return {
        ...CHART_BASE,
        title: {
          show: true,
          text: stockBarMode === 'usd' ? '$0 USD' : '0 unds',
          subtext: 'Sin unidades en oferta disponibles',
          left: 'center',
          top: '40%',
          textStyle: { fontSize: 16, fontWeight: 700, color: isDark ? '#94a3b8' : '#64748b' },
          subtextStyle: { fontSize: 11, color: isDark ? '#64748b' : '#94a3b8' },
        },
        xAxis: { show: false },
        yAxis: { show: false },
        series: [],
      }
    }

    return {
      ...CHART_BASE,
      grid: { left: 8, right: 65, top: 10, bottom: 10, containLabel: true },
      tooltip: {
        trigger: 'axis',
        backgroundColor: isDark ? '#0f172a' : '#ffffff',
        borderColor: isDark ? '#334155' : '#cbd5e1',
        textStyle: { color: isDark ? '#f8fafc' : '#0f172a', fontSize: 11 },
        formatter: (params: any) => {
          const p = params[0]
          const valFormatted = stockBarMode === 'usd' ? `${fmtUSD(Number(p.value))} USD` : `${Number(p.value).toLocaleString('es-BO')} unds`
          const tagColor = stockBarMode === 'usd' ? '#26c6da' : '#60a5fa'
          return `<b>${p.name}</b><br/>Stock por Vender: <b style="color:${tagColor}">${valFormatted}</b>`
        },
      },
      xAxis: {
        type: 'value',
        splitLine: { lineStyle: { color: isDark ? '#2a2e39' : '#e2e8f0' } },
        axisLabel: {
          fontSize: 10,
          color: isDark ? '#94a3b8' : '#64748b',
          formatter: isStockUSD ? (v: number) => fmtUSD(v) : undefined,
        },
      },
      yAxis: {
        type: 'category',
        data: items.map((z) => (z.name.length > 22 ? z.name.slice(0, 22) + '…' : z.name)),
        axisLabel: { fontSize: 10.5, color: isDark ? '#cbd5e1' : '#334155', fontWeight: 500 },
        axisLine: { lineStyle: { color: isDark ? '#334155' : '#cbd5e1' } },
      },
      series: [
        {
          name: 'Stock por Vender',
          type: 'bar',
          barMaxWidth: 16,
          data: items.map((z) => (stockBarMode === 'usd' ? z.totalStockXVenderUSD : z.totalStockUnd)),
          itemStyle: {
            color: stockBarMode === 'usd' ? '#00838f' : '#1565c0',
            borderRadius: [0, 4, 4, 0],
          },
          emphasis: {
            itemStyle: { color: stockBarMode === 'usd' ? '#0097a7' : '#1e88e5' },
          },
          label: {
            show: true,
            position: 'right',
            fontSize: 10.5,
            fontWeight: 600,
            color: isDark ? '#f1f5f9' : '#0f172a',
            formatter: (p: any) => {
              if (!p.value || p.value <= 0) return ''
              return stockBarMode === 'usd' ? fmtUSD(p.value) : Number(p.value).toLocaleString('es-BO')
            },
          },
        },
      ],
    }
  }

  // Right Bar Chart: Stock Vendido (Unidades or USD). In Meses mode: shows Stock por Vender (Unidades) as complementary.
  function getStockVendidoBarOption() {
    const isDark = theme === 'dark'
    const sourceItems = zonaStockMetrics

    // When meses mode: show Stock por Vender (Unidades) as a complementary chart
    if (stockBarMode === 'meses') {
      const items = sourceItems
        .filter((g) => g.totalStockUnd > 0)
        .sort((a, b) => b.totalStockUnd - a.totalStockUnd)
        .slice(0, 14)
        .reverse()
      if (items.length === 0) {
        return {
          ...CHART_BASE,
          title: { show: true, text: '0 unds', subtext: 'Sin unidades en oferta', left: 'center', top: '40%',
            textStyle: { fontSize: 16, fontWeight: 700, color: isDark ? '#94a3b8' : '#64748b' },
            subtextStyle: { fontSize: 11, color: isDark ? '#64748b' : '#94a3b8' },
          },
          xAxis: { show: false }, yAxis: { show: false }, series: [],
        }
      }
      return {
        ...CHART_BASE,
        grid: { left: 8, right: 65, top: 10, bottom: 10, containLabel: true },
        tooltip: {
          trigger: 'axis',
          backgroundColor: isDark ? '#0f172a' : '#ffffff',
          borderColor: isDark ? '#334155' : '#cbd5e1',
          textStyle: { color: isDark ? '#f8fafc' : '#0f172a', fontSize: 11 },
          formatter: (params: any) => {
            const p = params[0]
            return `<b>${p.name}</b><br/>Stock por Vender: <b style="color:#60a5fa">${Number(p.value).toLocaleString('es-BO')} unds</b>`
          },
        },
        xAxis: {
          type: 'value',
          splitLine: { lineStyle: { color: isDark ? '#2a2e39' : '#e2e8f0' } },
          axisLabel: { fontSize: 10, color: isDark ? '#94a3b8' : '#64748b' },
        },
        yAxis: {
          type: 'category',
          data: items.map((z) => (z.name.length > 22 ? z.name.slice(0, 22) + '…' : z.name)),
          axisLabel: { fontSize: 10.5, color: isDark ? '#cbd5e1' : '#334155', fontWeight: 500 },
          axisLine: { lineStyle: { color: isDark ? '#334155' : '#cbd5e1' } },
        },
        series: [{
          name: 'Stock por Vender',
          type: 'bar', barMaxWidth: 16,
          data: items.map((z) => z.totalStockUnd),
          itemStyle: { color: '#1565c0', borderRadius: [0, 4, 4, 0] },
          emphasis: { itemStyle: { color: '#1e88e5' } },
          label: {
            show: true, position: 'right', fontSize: 10.5, fontWeight: 600,
            color: isDark ? '#f1f5f9' : '#0f172a',
            formatter: (p: any) => p.value > 0 ? Number(p.value).toLocaleString('es-BO') : '',
          },
        }],
      }
    }

    // Unidades or USD mode
    const items = stockBarMode === 'usd'
      ? sourceItems
          .filter((g) => g.totalStockVendidoUSD > 0)
          .sort((a, b) => b.totalStockVendidoUSD - a.totalStockVendidoUSD)
          .slice(0, 14)
          .reverse()
      : sourceItems
          .filter((g) => g.totalVendidas > 0)
          .sort((a, b) => b.totalVendidas - a.totalVendidas)
          .slice(0, 14)
          .reverse()

    if (items.length === 0) {
      return {
        ...CHART_BASE,
        title: {
          show: true,
          text: stockBarMode === 'usd' ? '$0 USD' : '0 unds',
          subtext: 'Sin unidades vendidas registradas',
          left: 'center',
          top: '40%',
          textStyle: { fontSize: 16, fontWeight: 700, color: isDark ? '#94a3b8' : '#64748b' },
          subtextStyle: { fontSize: 11, color: isDark ? '#64748b' : '#94a3b8' },
        },
        xAxis: { show: false },
        yAxis: { show: false },
        series: [],
      }
    }

    return {
      ...CHART_BASE,
      grid: { left: 8, right: 65, top: 10, bottom: 10, containLabel: true },
      tooltip: {
        trigger: 'axis',
        backgroundColor: isDark ? '#0f172a' : '#ffffff',
        borderColor: isDark ? '#334155' : '#cbd5e1',
        textStyle: { color: isDark ? '#f8fafc' : '#0f172a', fontSize: 11 },
        formatter: (params: any) => {
          const p = params[0]
          const valFormatted = stockBarMode === 'usd' ? `${fmtUSD(Number(p.value))} USD` : `${Number(p.value).toLocaleString('es-BO')} unds`
          return `<b>${p.name}</b><br/>Stock Vendido: <b style="color:#f87171">${valFormatted}</b>`
        },
      },
      xAxis: {
        type: 'value',
        splitLine: { lineStyle: { color: isDark ? '#2a2e39' : '#e2e8f0' } },
        axisLabel: {
          fontSize: 10,
          color: isDark ? '#94a3b8' : '#64748b',
          formatter: isStockUSD ? (v: number) => fmtUSD(v) : undefined,
        },
      },
      yAxis: {
        type: 'category',
        data: items.map((z) => (z.name.length > 22 ? z.name.slice(0, 22) + '…' : z.name)),
        axisLabel: { fontSize: 10.5, color: isDark ? '#cbd5e1' : '#334155', fontWeight: 500 },
        axisLine: { lineStyle: { color: isDark ? '#334155' : '#cbd5e1' } },
      },
      series: [
        {
          name: 'Stock Vendido',
          type: 'bar',
          barMaxWidth: 16,
          data: items.map((z) => (stockBarMode === 'usd' ? z.totalStockVendidoUSD : z.totalVendidas)),
          itemStyle: {
            color: '#ef4444',
            borderRadius: [0, 4, 4, 0],
          },
          emphasis: {
            itemStyle: { color: '#f87171' },
          },
          label: {
            show: true,
            position: 'right',
            fontSize: 10.5,
            fontWeight: 600,
            color: isDark ? '#f1f5f9' : '#0f172a',
            formatter: (p: any) => {
              if (!p.value || p.value <= 0) return ''
              return stockBarMode === 'usd' ? fmtUSD(p.value) : Number(p.value).toLocaleString('es-BO')
            },
          },
        },
      ],
    }
  }

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
          lineStyle: { color: '#d4d4d8', width: 2.5 },
          itemStyle: { color: '#d4d4d8' },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0, y: 0, x2: 0, y2: 1,
              colorStops: [
                { offset: 0, color: 'rgba(212, 212, 216, 0.2)' },
                { offset: 1, color: 'rgba(212, 212, 216, 0.0)' },
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
          backgroundColor: '#1e2127',
          borderColor: '#333842',
          textStyle: { color: '#f1f5f9', fontSize: 11 },
        },
        xAxis: {
          type: 'category',
          data: dates,
          axisLine: { lineStyle: { color: '#2a2e39' } },
          axisLabel: { fontSize: 10, color: '#94a3b8' },
        },
        yAxis: {
          type: 'value',
          splitLine: { lineStyle: { color: '#2a2e39' } },
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
          backgroundColor: '#1e2127',
          borderColor: '#333842',
          textStyle: { color: '#f1f5f9', fontSize: 11 },
          formatter: (params: any) => {
            const p = params[0]
            return `<b>${p.name}</b><br/>Stock disponible: <b style="color:#ffffff">${Number(p.value).toLocaleString('es-BO')} unds</b>`
          },
        },
        xAxis: {
          type: 'value',
          splitLine: { lineStyle: { color: '#2a2e39' } },
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
                colorStops: [{ offset: 0, color: '#52525b' }, { offset: 1, color: '#a1a1aa' }],
              },
              borderRadius: [0, 4, 4, 0],
            },
            label: {
              show: true,
              position: 'right',
              fontSize: 10,
              fontWeight: 600,
              color: '#f4f4f5',
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
            return `<b>${p.name}</b><br/>Monto en stock: <b style="color:#f1f5f9">${fmtUSD(p.value)} USD</b>`
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
                colorStops: [{ offset: 0, color: '#333842' }, { offset: 1, color: '#737373' }],
              },
              borderRadius: [0, 4, 4, 0],
            },
            label: {
              show: true,
              position: 'right',
              fontSize: 10,
              fontWeight: 600,
              color: '#f1f5f9',
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
        backgroundColor: '#1e1e1e',
        borderColor: '#383838',
        textStyle: { color: '#f1f5f9', fontSize: 11 },
        formatter: (params: any) => {
          const p = params[0]
          return `<b>${p.name}</b><br/>Meses de stock: <b style="color:#f1f5f9">${Number(p.value).toFixed(1)} meses</b>`
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

  // KPIs "Promedio Vendido por Proyecto" y "Porcentaje Vendido" (vista Stock en Unidades o USD).
  // Se renderizan arriba en escritorio y entre las gráficas de barras en móvil.
  const kpisVendido = (
    <>
      {/* KPI 1: Promedio Vendido por Proyecto */}
      <div style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-md)',
        padding: '10px 12px',
        boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
      }}>
        <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--accent-emerald)', letterSpacing: -0.5 }}>
          {isStockUSD ? fmtUSD(avgVendidoPorProyUSD) : avgVendidasPorProyInt.toLocaleString('es-BO')}{' '}
          <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)' }}>
            {isStockUSD ? 'USD/proy' : 'und/proy'}
          </span>
        </div>
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginTop: 2 }}>
          Promedio Vendido por Proyecto
        </div>
        <div style={{ fontSize: 10, fontWeight: 600, marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
          {isStockUSD ? (
            prevSnapshotDate && prevAvgVendidoUSD > 0 ? (
              <>
                <span className={deltaAvgVendidoUSD >= 0 ? 'indicator-pos' : 'indicator-neg'}>
                  {deltaAvgVendidoUSD >= 0 ? `▲ +${deltaAvgVendidoUSDPct != null ? deltaAvgVendidoUSDPct.toFixed(1) : deltaAvgVendidoUSD}%` : `▼ ${deltaAvgVendidoUSDPct != null ? deltaAvgVendidoUSDPct.toFixed(1) : deltaAvgVendidoUSD}%`}
                </span>
                <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>· {fmtUSD(totalStockVendidoUSD)} vendidos tot.</span>
              </>
            ) : (
              <span style={{ color: 'var(--text-muted)' }}>
                Total vendido: <strong style={{ color: 'var(--accent-emerald)' }}>{fmtUSD(totalStockVendidoUSD)} USD</strong>
              </span>
            )
          ) : (
            prevSnapshotDate && prevAvgVendidas > 0 ? (
              <>
                <span className={deltaAvgVendidas >= 0 ? 'indicator-pos' : 'indicator-neg'}>
                  {deltaAvgVendidas >= 0 ? `▲ +${deltaAvgVendidasPct != null ? deltaAvgVendidasPct.toFixed(1) : deltaAvgVendidas}%` : `▼ ${deltaAvgVendidasPct != null ? deltaAvgVendidasPct.toFixed(1) : deltaAvgVendidas}%`}
                </span>
                <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>· {totalVendidas.toLocaleString('es-BO')} vendidas tot.</span>
              </>
            ) : (
              <span style={{ color: 'var(--text-muted)' }}>
                Total vendidas: <strong style={{ color: 'var(--accent-emerald)' }}>{totalVendidas.toLocaleString('es-BO')} unds</strong>
              </span>
            )
          )}
        </div>
      </div>

      {/* KPI 2: Porcentaje Vendido */}
      <div style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-md)',
        padding: '10px 12px',
        boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
      }}>
        <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--accent-emerald)', letterSpacing: -0.5 }}>
          {isStockUSD ? `${pctVendidoUSD.toFixed(1)}%` : `${pctVendido.toFixed(1)}%`}
        </div>
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginTop: 2 }}>
          Porcentaje Vendido
        </div>
        <div style={{ fontSize: 10, fontWeight: 600, marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
          {isStockUSD ? (
            prevSnapshotDate && prevPctVendidoUSD > 0 ? (
              <>
                <span className={deltaPctVendidoUSD >= 0 ? 'indicator-pos' : 'indicator-neg'}>
                  {deltaPctVendidoUSD >= 0 ? `▲ +${deltaPctVendidoUSD.toFixed(1)}%` : `▼ ${deltaPctVendidoUSD.toFixed(1)}%`}
                </span>
                <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>· {fmtUSD(totalStockXVenderUSD)} por vender</span>
              </>
            ) : (
              <span style={{ color: 'var(--text-muted)' }}>
                Por vender: <strong style={{ color: 'var(--citrino-teal-light)' }}>{fmtUSD(totalStockXVenderUSD)} USD</strong>
              </span>
            )
          ) : (
            prevSnapshotDate && prevPctVendido > 0 ? (
              <>
                <span className={deltaPctVendido >= 0 ? 'indicator-pos' : 'indicator-neg'}>
                  {deltaPctVendido >= 0 ? `▲ +${deltaPctVendido.toFixed(1)}%` : `▼ ${deltaPctVendido.toFixed(1)}%`}
                </span>
                <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>· {totalStockUnd.toLocaleString('es-BO')} por vender</span>
              </>
            ) : (
              <span style={{ color: 'var(--text-muted)' }}>
                Por vender: <strong style={{ color: 'var(--citrino-teal-light)' }}>{totalStockUnd.toLocaleString('es-BO')} unds</strong>
              </span>
            )
          )}
        </div>
      </div>
    </>
  )

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

        {/* Interactive KPI Cards (3 cards for resumen_general, 4 cards for stock_unidades / stock_usd, 4 cards for default) */}
        {isResumenGeneral ? (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 12,
          }}>
            {/* KPI 1: Cantidad de proyectos activos */}
            <div style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              padding: '10px 12px',
              boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
            }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: -0.5 }}>
                {countActivosCurrent.toLocaleString('es-BO')} <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)' }}>proyectos</span>
              </div>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginTop: 2 }}>
                Cantidad de proyectos activos
              </div>
              <div style={{ fontSize: 9.5, color: 'var(--text-muted)', marginTop: 2 }}>
                Preventas, Obra Bruta, Obra Fina y Terminada
              </div>
              <div style={{ fontSize: 10, fontWeight: 600, marginTop: 5, display: 'flex', alignItems: 'center', gap: 4 }}>
                {prevSnapshotDate && countActivosPrev > 0 ? (
                  <>
                    <span className={deltaActivos >= 0 ? 'indicator-pos' : 'indicator-neg'}>
                      {deltaActivos >= 0 ? `▲ +${deltaActivosPct != null ? deltaActivosPct.toFixed(1) : deltaActivos}%` : `▼ ${deltaActivosPct != null ? deltaActivosPct.toFixed(1) : deltaActivos}%`}
                      {` (${deltaActivos >= 0 ? '+' : ''}${deltaActivos} proy.)`}
                    </span>
                    <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>vs censo anterior</span>
                  </>
                ) : (
                  <span className="badge-pos">
                    ● {totalProyectosCurrent > 0 ? Math.round((countActivosCurrent / totalProyectosCurrent) * 100) : 0}% de la oferta censada
                  </span>
                )}
              </div>
            </div>

            {/* KPI 2: Cantidad de proyectos vendidos */}
            <div
              onClick={() => setSelectedResumenStage((prev) => (prev === 'Vendida' ? null : 'Vendida'))}
              title="Haz clic para filtrar/ver proyectos vendidos en la gráfica y mapa"
              style={{
                background: selectedResumenStage === 'Vendida' ? (theme === 'dark' ? 'rgba(16, 185, 129, 0.16)' : 'rgba(16, 185, 129, 0.12)') : 'var(--bg-card)',
                border: selectedResumenStage === 'Vendida' ? '1px solid #10b981' : '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                padding: '10px 12px',
                boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--accent-emerald)', letterSpacing: -0.5 }}>
                {countVendidosCurrent.toLocaleString('es-BO')} <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)' }}>proyectos</span>
              </div>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginTop: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span>Cantidad de proyectos vendidos</span>
                {selectedResumenStage === 'Vendida' && (
                  <span style={{ fontSize: 9.5, color: '#10b981', fontWeight: 700 }}>● Filtro activo</span>
                )}
              </div>
              <div style={{ fontSize: 9.5, color: 'var(--text-muted)', marginTop: 2 }}>
                Etapa Vendida (100% de colocación)
              </div>
              <div style={{ fontSize: 10, fontWeight: 600, marginTop: 5, display: 'flex', alignItems: 'center', gap: 4 }}>
                {prevSnapshotDate && countVendidosPrev > 0 ? (
                  <>
                    <span className={deltaVendidos >= 0 ? 'indicator-pos' : 'indicator-neg'}>
                      {deltaVendidos >= 0 ? `▲ +${deltaVendidosPct != null ? deltaVendidosPct.toFixed(1) : deltaVendidos}%` : `▼ ${deltaVendidosPct != null ? deltaVendidosPct.toFixed(1) : deltaVendidos}%`}
                      {` (${deltaVendidos >= 0 ? '+' : ''}${deltaVendidos} proy.)`}
                    </span>
                    <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>vs censo anterior</span>
                  </>
                ) : (
                  <span className="badge-pos">
                    ● {totalProyectosCurrent > 0 ? Math.round((countVendidosCurrent / totalProyectosCurrent) * 100) : 0}% proyectos colocados
                  </span>
                )}
              </div>
            </div>

            {/* KPI 3: Cantidad de proyectos inactivos */}
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
                color: countInactivosCurrent > 0 ? 'var(--color-warning)' : 'var(--text-muted)',
                letterSpacing: -0.5
              }}>
                {countInactivosCurrent.toLocaleString('es-BO')} <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)' }}>proyectos</span>
              </div>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginTop: 2 }}>
                Cantidad de proyectos inactivos
              </div>
              <div style={{ fontSize: 9.5, color: 'var(--text-muted)', marginTop: 2 }}>
                Etapas Paralizadas y Clandestinas
              </div>
              <div style={{ fontSize: 10, fontWeight: 600, marginTop: 5, display: 'flex', alignItems: 'center', gap: 4 }}>
                {prevSnapshotDate && (countInactivosPrev > 0 || countInactivosCurrent > 0) ? (
                  <>
                    <span className={deltaInactivos <= 0 ? 'indicator-pos' : 'indicator-neg'}>
                      {deltaInactivos > 0 ? `▲ +${deltaInactivos} paralizados` : deltaInactivos < 0 ? `▼ ${deltaInactivos} reactivados` : `● Sin variación`}
                    </span>
                    <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>vs censo anterior</span>
                  </>
                ) : (
                  <span style={{ color: countInactivosCurrent === 0 ? 'var(--color-positive)' : 'var(--color-warning)', fontWeight: 600 }}>
                    {countInactivosCurrent === 0 ? '● 0 proyectos paralizados (Saludable)' : `● ${countInactivosCurrent} proyectos paralizados`}
                  </span>
                )}
              </div>
            </div>
          </div>
        ) : (isStockUnidades || isStockUSD) ? (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 12,
          }}>
            {/* KPIs 1-2 (en móvil se muestran entre las dos gráficas de barras) */}
            <div className="ws-kpis-vendido-top" style={{ display: 'contents' }}>
              {kpisVendido}
            </div>

            {/* KPI 3: Promedio por Vender por Proyecto */}
            <div style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              padding: '10px 12px',
              boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
            }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--accent-cyan)', letterSpacing: -0.5 }}>
                {isStockUSD ? fmtUSD(avgPorVenderPorProyUSD) : avgPorVenderPorProyInt.toLocaleString('es-BO')}{' '}
                <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)' }}>
                  {isStockUSD ? 'USD/proy' : 'und/proy'}
                </span>
              </div>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginTop: 2 }}>
                Promedio por Vender por Proyecto
              </div>
              <div style={{ fontSize: 10, fontWeight: 600, marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                {isStockUSD ? (
                  prevSnapshotDate && prevAvgPorVenderUSD > 0 ? (
                    <>
                      <span className={deltaAvgPorVenderUSD <= 0 ? 'indicator-pos' : 'indicator-neg'}>
                        {deltaAvgPorVenderUSD >= 0 ? `▲ +${deltaAvgPorVenderUSDPct != null ? deltaAvgPorVenderUSDPct.toFixed(1) : deltaAvgPorVenderUSD}%` : `▼ ${deltaAvgPorVenderUSDPct != null ? deltaAvgPorVenderUSDPct.toFixed(1) : deltaAvgPorVenderUSD}%`}
                      </span>
                      <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>· {fmtUSD(totalStockXVenderUSD)} por vender tot.</span>
                    </>
                  ) : (
                    <span style={{ color: 'var(--text-muted)' }}>
                      Total disponible: <strong style={{ color: 'var(--accent-cyan)' }}>{fmtUSD(totalStockXVenderUSD)} USD</strong>
                    </span>
                  )
                ) : (
                  prevSnapshotDate && prevAvgPorVender > 0 ? (
                    <>
                      <span className={deltaAvgPorVender <= 0 ? 'indicator-pos' : 'indicator-neg'}>
                        {deltaAvgPorVender >= 0 ? `▲ +${deltaAvgPorVenderPct != null ? deltaAvgPorVenderPct.toFixed(1) : deltaAvgPorVender}%` : `▼ ${deltaAvgPorVenderPct != null ? deltaAvgPorVenderPct.toFixed(1) : deltaAvgPorVender}%`}
                      </span>
                      <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>· {totalStockUnd.toLocaleString('es-BO')} por vender tot.</span>
                    </>
                  ) : (
                    <span style={{ color: 'var(--text-muted)' }}>
                      Total disponible: <strong style={{ color: 'var(--accent-cyan)' }}>{totalStockUnd.toLocaleString('es-BO')} unds</strong>
                    </span>
                  )
                )}
              </div>
            </div>

            {/* KPI 4: Porcentaje por Vender */}
            <div style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              padding: '10px 12px',
              boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
            }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--citrino-teal-light)', letterSpacing: -0.5 }}>
                {isStockUSD ? `${pctPorVenderUSD.toFixed(1)}%` : `${pctPorVender.toFixed(1)}%`}
              </div>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginTop: 2 }}>
                Porcentaje por Vender
              </div>
              <div style={{ fontSize: 10, fontWeight: 600, marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                {isStockUSD ? (
                  prevSnapshotDate && prevPctPorVenderUSD > 0 ? (
                    <>
                      <span className={deltaPctPorVenderUSD <= 0 ? 'indicator-pos' : 'indicator-neg'}>
                        {deltaPctPorVenderUSD >= 0 ? `▲ +${deltaPctPorVenderUSD.toFixed(1)}%` : `▼ ${deltaPctPorVenderUSD.toFixed(1)}%`}
                      </span>
                      <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>· {fmtUSD(totalStockXVenderUSD)} en stock</span>
                    </>
                  ) : (
                    <span style={{ color: 'var(--text-muted)' }}>
                      En oferta: <strong style={{ color: 'var(--citrino-teal-light)' }}>{fmtUSD(totalStockXVenderUSD)} USD</strong>
                    </span>
                  )
                ) : (
                  prevSnapshotDate && prevPctPorVender > 0 ? (
                    <>
                      <span className={deltaPctPorVender <= 0 ? 'indicator-pos' : 'indicator-neg'}>
                        {deltaPctPorVender >= 0 ? `▲ +${deltaPctPorVender.toFixed(1)}%` : `▼ ${deltaPctPorVender.toFixed(1)}%`}
                      </span>
                      <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>· {totalStockUnd.toLocaleString('es-BO')} en stock</span>
                    </>
                  ) : (
                    <span style={{ color: 'var(--text-muted)' }}>
                      En oferta: <strong style={{ color: 'var(--citrino-teal-light)' }}>{totalStockUnd.toLocaleString('es-BO')} unds</strong>
                    </span>
                  )
                )}
              </div>
            </div>
          </div>
        ) : (
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
        )}
      </div>

      {/* ─── SECTION 2: INDICADORES DINÁMICOS & CHART CONTAINER ──────────── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: '12px 16px' }}>
        {/* Subheader with Metric Selector Pill & View Switcher */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {isStockMode ? (
              <>
                <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: -0.2 }}>
                  {viewMode === 'chart'
                    ? (stockBarMode === 'usd' ? 'Stock en USD' : stockBarMode === 'meses' ? 'Meses de Stock' : 'Stock por Unidades')
                    : viewMode === 'table'
                    ? 'Lista de Proyectos'
                    : 'Localización de Proyectos'}
                </span>

                {viewMode === 'chart' && (
                  <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                    {([
                      { value: 'stock_und_bar',   label: 'Stock en Unidades' },
                      { value: 'stock_usd_bar',   label: 'Stock en USD' },
                      { value: 'meses_stock_bar', label: 'Meses de Stock' },
                    ] as { value: MetricType; label: string }[]).map((opt) => {
                      const isActive =
                        (opt.value === 'stock_und_bar'   && stockBarMode === 'und')  ||
                        (opt.value === 'stock_usd_bar'   && stockBarMode === 'usd')  ||
                        (opt.value === 'meses_stock_bar' && stockBarMode === 'meses')
                      return (
                        <button
                          key={opt.value}
                          onClick={() => setMetricType(opt.value)}
                          style={{
                            padding: '4px 10px',
                            fontSize: 11,
                            fontWeight: isActive ? 700 : 500,
                            background: isActive ? 'var(--citrino-orange, #ff7a00)' : 'var(--bg-card)',
                            color: isActive ? '#fff' : 'var(--text-secondary)',
                            border: `1px solid ${isActive ? 'var(--citrino-orange, #ff7a00)' : 'var(--border-default)'}`,
                            borderRadius: 4,
                            cursor: 'pointer',
                            transition: 'all 0.15s ease',
                          }}
                        >
                          {opt.label}
                        </button>
                      )
                    })}
                  </div>
                )}
              </>
            ) : !isResumenGeneral ? (
              <>
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
                      color: 'var(--text-primary)',
                      border: '1px solid var(--border-default)',
                      borderRadius: 4,
                      padding: '5px 10px',
                      fontSize: 11.5,
                      fontWeight: 600,
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
              </>
            ) : (
              <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: -0.2 }}>
                {viewMode === 'chart'
                  ? 'Segmentación por Etapas'
                  : viewMode === 'table'
                  ? 'Lista de Proyectos'
                  : 'Localización de Proyectos'}
              </span>
            )}
          </div>

        </div>

        {/* Chart, Map, or Table Area */}
        {viewMode === 'map' ? (
          <div style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-lg)',
            overflow: 'hidden',
            position: 'relative',
            minHeight: 0,
            height: '100%',
          }}>
            <GeoespacialPanel
              ciudad={ciudad}
              zonaFilter={zonaFilter}
              etapaFilter={etapaFilter}
              selectedIndicador={selectedIndicador}
              onSelectIndicador={onSelectIndicador}
              theme={theme}
            />
          </div>
        ) : viewMode === 'chart' ? (
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
            {/* Resumen General: 1 Gráfico de Barras Laterales + 1 Gráfico Circular Donut Dinámicos */}
            {isResumenGeneral ? (
              <div style={{
                flex: 1,
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: 12,
                minHeight: 0,
              }}>
                {/* Gráfico 1: Barras Laterales — Cantidad de Proyectos por Etapa */}
                <div style={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  padding: '12px 14px 8px',
                  display: 'flex',
                  flexDirection: 'column',
                  overflow: 'hidden',
                  minHeight: 0,
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
                      Cantidad de Proyectos por Etapas
                    </span>
                    <span style={{
                      fontSize: 10.5,
                      fontWeight: 600,
                      background: theme === 'dark' ? 'rgba(161, 161, 170, 0.12)' : 'rgba(161, 161, 170, 0.18)',
                      color: theme === 'dark' ? '#cbd5e1' : '#475569',
                      padding: '2px 8px',
                      borderRadius: 12,
                    }}>
                      {totalProyectosResumen} proy. totales
                    </span>
                  </div>
                  <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginBottom: 6 }}>
                    Proyectos censados clasificados por fase constructiva y comercial
                  </div>
                  <div style={{ flex: 1, minHeight: 250, width: '100%' }}>
                    <ReactECharts
                      option={getResumenEtapasBarOption()}
                      notMerge={true}
                      lazyUpdate={true}
                      style={{ height: '100%', width: '100%' }}
                      onEvents={{
                        click: (params: any) => {
                          if (params?.name) {
                            setSelectedResumenStage((prev) => (prev === params.name ? null : params.name))
                          }
                        },
                      }}
                    />
                  </div>
                </div>

                {/* Mapa: Distribución Geoespacial por Etapa */}
                <ResumenEtapasMap
                  projects={resumenProjects}
                  ciudad={ciudad}
                  selectedStage={selectedResumenStage}
                  onSelectStage={setSelectedResumenStage}
                  stageItems={stageItems}
                  theme={theme}
                  onSelectIndicador={onSelectIndicador}
                  selectedIndicador={selectedIndicador}
                />
              </div>
            ) : isStockMode ? (
              /* Tarea 5 & Tarea 6: 2 Gráficas de Barras Laterales (Stock por Vender & Stock Vendido) */
              <div style={{
                flex: 1,
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: 12,
                minHeight: 0,
              }}>
                {/* Gráfica 1: Stock por Vender por Zona / Subzona (color=#1565c0) */}
                <div style={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  padding: '12px 14px 6px',
                  display: 'flex',
                  flexDirection: 'column',
                  overflow: 'hidden',
                  minHeight: 0,
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
                      {stockBarMode === 'meses' ? 'Meses de Stock (Zonas)' : `Stock por Vender (Zonas)`}
                    </span>
                    <span style={{
                      fontSize: 10.5,
                      fontWeight: 600,
                      background: stockBarMode === 'usd' ? 'rgba(0, 131, 143, 0.15)' : stockBarMode === 'meses' ? 'rgba(16,185,129,0.13)' : 'rgba(21, 101, 192, 0.15)',
                      color: stockBarMode === 'usd' ? '#00838f' : stockBarMode === 'meses' ? '#10b981' : '#60a5fa',
                      padding: '2px 8px',
                      borderRadius: 12,
                    }}>
                      {stockBarMode === 'meses'
                        ? `${avgMesesStock.toFixed(1)} meses promedio`
                        : stockBarMode === 'usd'
                        ? `${fmtUSD(totalStockXVenderUSD)} en oferta`
                        : `${totalStockUnd.toLocaleString('es-BO')} unds en oferta`}
                    </span>
                  </div>
                  <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginBottom: 6 }}>
                    {stockBarMode === 'meses'
                      ? 'Horizonte de liquidación estimado por zona (verde <12m · amarillo 12-18m · rojo >18m)'
                      : stockBarMode === 'usd'
                      ? 'Monto USD disponible censado agrupado por zona'
                      : 'Unidades disponibles censadas agrupadas por zona'}
                  </div>
                  <div style={{ flex: 1, minHeight: 240, width: '100%' }}>
                    <ReactECharts
                      option={getStockPorVenderBarOption()}
                      notMerge={true}
                      lazyUpdate={true}
                      style={{ height: '100%', width: '100%' }}
                    />
                  </div>
                </div>

                {/* Móvil: KPIs de vendido entre Stock por Vender y Stock Vendido */}
                <div className="ws-kpis-vendido-mobile">
                  {kpisVendido}
                </div>

                {/* Gráfica 2: Stock Vendido por Zona / Subzona (color=#ef4444) */}
                <div style={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  padding: '12px 14px 6px',
                  display: 'flex',
                  flexDirection: 'column',
                  overflow: 'hidden',
                  minHeight: 0,
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
                      {stockBarMode === 'meses' ? 'Stock por Vender (Unidades)' : 'Stock Vendido (Zonas)'}
                    </span>
                    <span style={{
                      fontSize: 10.5,
                      fontWeight: 600,
                      background: 'rgba(239, 68, 68, 0.15)',
                      color: '#f87171',
                      padding: '2px 8px',
                      borderRadius: 12,
                    }}>
                      {stockBarMode === 'meses'
                        ? `${totalStockUnd.toLocaleString('es-BO')} unds en oferta`
                        : stockBarMode === 'usd'
                        ? `${fmtUSD(totalStockVendidoUSD)} vendidos`
                        : `${totalVendidas.toLocaleString('es-BO')} unds vendidas`}
                    </span>
                  </div>
                  <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginBottom: 6 }}>
                    {stockBarMode === 'meses'
                      ? 'Stock de unidades disponibles por zona'
                      : stockBarMode === 'usd'
                      ? 'Monto USD históricamente colocado agrupado por zona'
                      : 'Unidades históricamente colocadas agrupadas por zona'}
                  </div>
                  <div style={{ flex: 1, minHeight: 240, width: '100%' }}>
                    <ReactECharts
                      option={getStockVendidoBarOption()}
                      notMerge={true}
                      lazyUpdate={true}
                      style={{ height: '100%', width: '100%' }}
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ flex: 1, minHeight: 260, width: '100%' }}>
                <ReactECharts
                  option={getChartOption()}
                  notMerge={true}
                  lazyUpdate={true}
                  style={{ height: '100%', width: '100%' }}
                />
              </div>
            )}

            {/* Interactive Series Checkbox Bar & Summary Footer */}
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
              {/* Left: Always show Proyectos analizados, Zonas activas & Promedio Stock Inicial */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, color: 'var(--text-muted)', fontSize: 11 }}>
                <span>Proyectos analizados: <strong style={{ color: 'var(--text-primary)' }}>{filteredProjects.length}</strong></span>
                <span>{isStockMode && metricType === 'stock_subzona' ? 'Subzonas activas:' : 'Zonas activas:'} <strong style={{ color: 'var(--text-primary)' }}>{activeZonesCount}</strong></span>
                <span>Promedio Stock Inicial: <strong style={{ color: 'var(--text-primary)' }}>{(stockBarMode === 'usd' || isStockUSD) ? fmtUSD(avgStockInicialUSD) : `${avgStockInicial.toLocaleString('es-BO')} unds`}</strong></span>
              </div>

              {/* Right: Only show Vendidos/Por Vender when not in resumen_general */}
              {!isResumenGeneral && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  {/* Vendidas */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, userSelect: 'none' }}>
                    <span style={{ width: 14, height: 3, background: '#ef4444', display: 'inline-block', borderRadius: 2 }} />
                    <span style={{ color: 'var(--text-secondary)' }}>Vendidas:</span>
                    <strong style={{ color: 'var(--text-primary)' }}>
                      {(stockBarMode === 'usd' || isStockUSD)
                        ? `${fmtUSD(totalStockVendidoUSD)} (${pctVendidoUSD.toFixed(1)}%)`
                        : `${totalVendidas.toLocaleString('es-BO')} (${pctVendido.toFixed(1)}%)`}
                    </strong>
                  </div>

                  {/* Por Vender */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, userSelect: 'none' }}>
                    <span style={{ width: 14, height: 3, background: (stockBarMode === 'usd' || isStockUSD) ? '#00838f' : '#1565c0', display: 'inline-block', borderRadius: 2 }} />
                    <span style={{ color: 'var(--text-secondary)' }}>Por Vender (Stock):</span>
                    <strong style={{ color: 'var(--citrino-teal-light)' }}>
                      {(stockBarMode === 'usd' || isStockUSD)
                        ? `${fmtUSD(totalStockXVenderUSD)} (${pctPorVenderUSD.toFixed(1)}%)`
                        : `${totalStockUnd.toLocaleString('es-BO')} (${pctPorVender.toFixed(1)}%)`}
                    </strong>
                  </div>
                </div>
              )}
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
