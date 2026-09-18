import { useState, useRef, useEffect } from 'react'
import ReactECharts from 'echarts-for-react'
import { fetchIndicadores, getLatestPerProject } from '../lib/supabase'
import type { IndicadorFull } from '../lib/supabase'

export interface ChatAction {
  label: string
  icon?: string
  onClick: () => void
}

interface Message {
  id: string
  role: 'ai' | 'user'
  text: string
  chartTitle?: string
  chartOption?: any
  actions?: ChatAction[]
  chips?: string[]
}

const INITIAL_MESSAGES: Message[] = [
  {
    id: '1',
    role: 'ai',
    text: 'Hola. Soy tu **Intelligence Copilot**. Analizo los datos del mercado inmobiliario en tiempo real y puedo generar nuevos análisis estadísticos y gráficos a pedido.',
  },
  {
    id: '2',
    role: 'ai',
    text: '¿Qué quieres analizar hoy? Puedes pedirme por ejemplo:\n• *"Grafica el stock disponible por zona"*\n• *"Ranking de proyectos con mayor ritmo de venta"*\n• *"Distribución de inventario por etapa"*\n• *"¿Cuáles son los proyectos con mayor riesgo de sobreoferta?"*\n• *"Analiza la zona de Equipetrol"*',
    chips: [
      '📊 Graficar stock por zona',
      '⚡ Ranking ritmo de venta',
      '🏗️ Distribución por etapa',
      '⚠️ Proyectos con riesgo de stock',
      '📍 Analizar Equipetrol',
    ],
  },
]

const QUICK_PROMPTS = [
  '📊 Stock por zona',
  '⚡ Ritmo de venta',
  '🏗️ Etapas de obra',
  '⚠️ Riesgo de stock',
  '📍 Equipetrol',
  '🏙️ Comparar ciudades',
]

interface Props {
  ciudad: string
  onFilterZona?: (zona: string) => void
  onFilterEtapas?: (etapas: string[]) => void
  onSelectIndicador?: (ind: IndicadorFull | null) => void
  onSwitchTab?: (tab: 'mercado' | 'tipologias' | 'proyectos' | 'geoespacial') => void
  /** When true, the panel is embedded inside RightSidebar (no panel-left class, fills container) */
  isEmbedded?: boolean
}

export default function ChatPanel({
  ciudad,
  onFilterZona,
  onFilterEtapas,
  onSelectIndicador,
  onSwitchTab,
  isEmbedded = false,
}: Props) {
  const [messages, setMessages] = useState<Message[]>(INITIAL_MESSAGES)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function handleSend(customText?: string) {
    const query = (customText ?? input).trim()
    if (!query || loading) return

    const userMsg: Message = { id: Date.now().toString(), role: 'user', text: query }
    setMessages((prev) => [...prev, userMsg])
    setInput('')
    setLoading(true)

    try {
      const response = await processAnalyticsQuery(query, ciudad)
      setMessages((prev) => [...prev, { id: (Date.now() + 1).toString(), role: 'ai', ...response }])
    } catch (err) {
      console.error('Error processing analytical query:', err)
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: 'ai',
          text: 'Disculpa, ocurrió un error al calcular los datos. Por favor intenta reformular tu pregunta.',
        },
      ])
    } finally {
      setLoading(false)
    }
  }

  // ─── Analytics NLP & Chart Engine ──────────────────────────────────────────
  async function processAnalyticsQuery(
    query: string,
    currentCiudad: string
  ): Promise<{
    text: string
    chartTitle?: string
    chartOption?: any
    actions?: ChatAction[]
    chips?: string[]
  }> {
    const q = query.toLowerCase()
    const isMultiCity = q.includes('ciudad') || q.includes('bolivia') || q.includes('nacional') || q.includes('compar')
    const queryCiudad = isMultiCity ? undefined : currentCiudad === 'ALL' ? undefined : currentCiudad

    const rawIndicadores = await fetchIndicadores(queryCiudad)
    const latest = getLatestPerProject(rawIndicadores)

    // 1. ANÁLISIS DE RIESGO / MESES DE STOCK
    if (q.includes('riesgo') || q.includes('sobreoferta') || (q.includes('mes') && q.includes('stock')) || q.includes('estancad')) {
      const oversupply = latest
        .filter((p) => p.meses_stock != null && p.meses_stock > 18)
        .sort((a, b) => (b.meses_stock ?? 0) - (a.meses_stock ?? 0))

      const critical = latest
        .filter((p) => p.meses_stock != null && p.meses_stock > 24)
        .sort((a, b) => (b.meses_stock ?? 0) - (a.meses_stock ?? 0))

      // Categorías de riesgo para gráfico
      let rotacion = 0, equilibrado = 0, moderado = 0, sobreoferta = 0
      latest.forEach((p) => {
        const m = p.meses_stock
        if (m == null) return
        if (m < 12) rotacion++
        else if (m <= 18) equilibrado++
        else if (m <= 24) moderado++
        else sobreoferta++
      })

      const chartOption = {
        backgroundColor: 'transparent',
        tooltip: {
          trigger: 'axis',
          axisPointer: { type: 'shadow' },
          backgroundColor: '#091b22',
          borderColor: '#1e4b5a',
          textStyle: { color: '#f1f5f9', fontSize: 11 },
        },
        grid: { left: 40, right: 15, top: 15, bottom: 25 },
        xAxis: {
          type: 'category',
          data: ['<12m\n(Rápido)', '12-18m\n(Equil.)', '18-24m\n(Presión)', '>24m\n(Riesgo)'],
          axisLabel: { color: '#94a3b8', fontSize: 9.5, interval: 0 },
          axisLine: { lineStyle: { color: '#163642' } },
        },
        yAxis: {
          type: 'value',
          axisLabel: { color: '#64748b', fontSize: 9.5 },
          splitLine: { lineStyle: { color: '#0d222b' } },
        },
        series: [
          {
            name: 'Proyectos',
            type: 'bar',
            data: [
              { value: rotacion, itemStyle: { color: '#10b981', borderRadius: [4, 4, 0, 0] } },
              { value: equilibrado, itemStyle: { color: '#38bdf8', borderRadius: [4, 4, 0, 0] } },
              { value: moderado, itemStyle: { color: '#f59e0b', borderRadius: [4, 4, 0, 0] } },
              { value: sobreoferta, itemStyle: { color: '#ef4444', borderRadius: [4, 4, 0, 0] } },
            ],
            barMaxWidth: 32,
            label: { show: true, position: 'top', color: '#f1f5f9', fontSize: 10, fontWeight: 'bold' },
          },
        ],
      }

      const topList = critical.slice(0, 4).map((p) => `• **${p.proyecto}** (${p.ZONAS || p.ciudad}): **${p.meses_stock?.toFixed(0)} meses** (${p.und_por_vender ?? 0} und disp.)`).join('\n')

      const actions: ChatAction[] = []
      if (onSwitchTab) {
        actions.push({
          label: 'Ver Proyectos en Mapa Geoespacial',
          icon: '🗺️',
          onClick: () => onSwitchTab('geoespacial'),
        })
      }

      return {
        text: `⚠️ **Diagnóstico de Riesgo de Sobreoferta (${currentCiudad})**:\n\nDetecté **${oversupply.length} proyectos con presión comercial** (>18 meses), de los cuales **${critical.length} están en zona crítica** (>24 meses de stock):\n\n${topList}\n\n*El gráfico clasifica la salud de absorción de los ${latest.length} desarrollos censados:*`,
        chartTitle: 'Distribución por Horizonte de Liquidación',
        chartOption,
        actions,
        chips: ['⚡ Ver proyectos más rápidos', '📍 Ver stock por zona', '🏗️ Filtrar por etapa'],
      }
    }

    // 2. RITMO DE VENTA / PROYECTOS MÁS RÁPIDOS
    if (q.includes('ritmo') || q.includes('rapido') || q.includes('rápido') || q.includes('velocidad') || q.includes('absorcion') || q.includes('absorción') || q.includes('mas vende') || q.includes('más vende')) {
      const sorted = [...latest]
        .filter((p) => p.ritmo_venta != null && p.ritmo_venta > 0)
        .sort((a, b) => (b.ritmo_venta ?? 0) - (a.ritmo_venta ?? 0))
        .slice(0, 6)

      if (sorted.length === 0) {
        return { text: 'No se encontraron registros de ritmo de colocación en el período actual.' }
      }

      const topNames = sorted.map((p) => p.proyecto.length > 15 ? p.proyecto.slice(0, 15) + '…' : p.proyecto).reverse()
      const topValues = sorted.map((p) => Number(p.ritmo_venta?.toFixed(1))).reverse()

      const chartOption = {
        backgroundColor: 'transparent',
        tooltip: {
          trigger: 'axis',
          axisPointer: { type: 'shadow' },
          backgroundColor: '#091b22',
          borderColor: '#1e4b5a',
          textStyle: { color: '#f1f5f9', fontSize: 11 },
          formatter: (params: any) => {
            const val = params[0]?.value
            const name = params[0]?.name
            return `<strong>${name}</strong><br/>Ritmo: <strong>${val} und/mes</strong>`
          },
        },
        grid: { left: 95, right: 35, top: 10, bottom: 20 },
        xAxis: {
          type: 'value',
          axisLabel: { color: '#64748b', fontSize: 9.5 },
          splitLine: { lineStyle: { color: '#0d222b' } },
        },
        yAxis: {
          type: 'category',
          data: topNames,
          axisLabel: { color: '#cbd5e1', fontSize: 10, fontWeight: 500 },
          axisLine: { lineStyle: { color: '#163642' } },
        },
        series: [
          {
            name: 'Ritmo (und/mes)',
            type: 'bar',
            data: topValues,
            itemStyle: {
              color: {
                type: 'linear',
                x: 0, y: 0, x2: 1, y2: 0,
                colorStops: [
                  { offset: 0, color: '#0d9488' },
                  { offset: 1, color: '#22d3ee' },
                ],
              },
              borderRadius: [0, 4, 4, 0],
            },
            label: { show: true, position: 'right', color: '#22d3ee', fontSize: 10.5, fontWeight: 'bold' },
          },
        ],
      }

      const leader = sorted[0]
      const actions: ChatAction[] = []
      if (onSelectIndicador && leader) {
        actions.push({
          label: `Analizar ${leader.proyecto}`,
          icon: '📊',
          onClick: () => onSelectIndicador(leader),
        })
      }
      if (onSwitchTab) {
        actions.push({
          label: 'Ver en Vista Proyectos',
          icon: '📋',
          onClick: () => onSwitchTab('proyectos'),
        })
      }

      const listText = sorted.slice(0, 3).map((p, idx) => `**#${idx + 1} ${p.proyecto}** (${p.ZONAS || p.ciudad}): **${p.ritmo_venta?.toFixed(1)} und/mes** (${(p.pct_vendido ? p.pct_vendido * 100 : 0).toFixed(0)}% colocado)`).join('\n')

      return {
        text: `⚡ **Líderes en Velocidad Comercial (${currentCiudad})**:\n\nEl proyecto más acelerado es **${leader.proyecto}** con **${leader.ritmo_venta?.toFixed(1)} und/mes**.\n\n${listText}\n\n*Gráfico comparativo de los 6 proyectos con mayor ritmo:*`,
        chartTitle: 'Ranking de Ritmo de Venta (Unidades / Mes)',
        chartOption,
        actions,
        chips: ['📊 Ver stock por zona', '🏗️ Etapas de obra', '⚠️ Proyectos con riesgo'],
      }
    }

    // 3. ETAPAS DE CONSTRUCCIÓN
    if (q.includes('etapa') || q.includes('obra') || q.includes('pozo') || q.includes('preventa') || q.includes('fina') || q.includes('bruta')) {
      const etapaMap: Record<string, { count: number; undDisp: number; undTot: number }> = {}
      latest.forEach((p) => {
        const et = p.etapa || 'Sin Especificar'
        if (!etapaMap[et]) etapaMap[et] = { count: 0, undDisp: 0, undTot: 0 }
        etapaMap[et].count++
        etapaMap[et].undDisp += p.und_por_vender ?? 0
        etapaMap[et].undTot += p.und_totales ?? 0
      })

      const entries = Object.entries(etapaMap).sort((a, b) => b[1].undDisp - a[1].undDisp)
      const pieData = entries.map(([name, data]) => ({
        name,
        value: data.undDisp,
      }))

      const chartOption = {
        backgroundColor: 'transparent',
        tooltip: {
          trigger: 'item',
          backgroundColor: '#091b22',
          borderColor: '#1e4b5a',
          textStyle: { color: '#f1f5f9', fontSize: 11 },
          formatter: '{b}: <strong>{c} und disponibles</strong> ({d}%)',
        },
        legend: {
          orient: 'horizontal',
          bottom: 0,
          textStyle: { color: '#94a3b8', fontSize: 9.5 },
          itemWidth: 10,
          itemHeight: 10,
        },
        series: [
          {
            name: 'Etapas',
            type: 'pie',
            radius: ['42%', '72%'],
            center: ['50%', '42%'],
            avoidLabelOverlap: true,
            itemStyle: {
              borderRadius: 5,
              borderColor: '#040a0d',
              borderWidth: 2,
            },
            color: ['#14b8a6', '#22d3ee', '#38bdf8', '#818cf8', '#c084fc', '#f43f5e', '#10b981'],
            label: { show: false },
            emphasis: {
              label: { show: true, fontSize: 11, fontWeight: 'bold', color: '#f1f5f9' },
            },
            data: pieData,
          },
        ],
      }

      const summaryLines = entries.slice(0, 4).map(([et, d]) => `• **${et}**: ${d.undDisp.toLocaleString()} und por vender (${d.count} desarrollos)`).join('\n')

      const actions: ChatAction[] = []
      if (onFilterEtapas && entries[0]) {
        actions.push({
          label: `Filtrar Etapa: ${entries[0][0]}`,
          icon: '🏗️',
          onClick: () => onFilterEtapas([entries[0][0]]),
        })
      }

      return {
        text: `🏗️ **Distribución del Inventario por Etapa de Obra**:\n\n${summaryLines}\n\n*Gráfico de participación del stock disponible según estado constructivo:*`,
        chartTitle: 'Inventario Disponible por Etapa',
        chartOption,
        actions,
        chips: ['⚡ ¿Qué etapa vende más rápido?', '📍 Ver stock por zona', '🗺️ Ver en mapa'],
      }
    }

    // 4. ANÁLISIS DE UNA ZONA ESPECÍFICA (ej. Equipetrol, Urubó, Norte, etc.)
    const availableZonas = Array.from(new Set(latest.map((p) => p.ZONAS).filter(Boolean))) as string[]
    const matchedZona = availableZonas.find((z) => q.includes(z.toLowerCase()))

    if (matchedZona) {
      const zonaProjects = latest.filter((p) => p.ZONAS === matchedZona)
      const totalDisp = zonaProjects.reduce((acc, p) => acc + (p.und_por_vender ?? 0), 0)
      const totalUnd = zonaProjects.reduce((acc, p) => acc + (p.und_totales ?? 0), 0)
      const pctVend = totalUnd > 0 ? Math.round(((totalUnd - totalDisp) / totalUnd) * 100) : 0
      const ritmos = zonaProjects.filter((p) => p.ritmo_venta != null && p.ritmo_venta > 0)
      const avgRitmo = ritmos.length > 0 ? ritmos.reduce((acc, p) => acc + (p.ritmo_venta ?? 0), 0) / ritmos.length : 0

      // Gráfico de top proyectos en esta zona
      const topProjects = [...zonaProjects]
        .sort((a, b) => (b.und_por_vender ?? 0) - (a.und_por_vender ?? 0))
        .slice(0, 5)

      const chartOption = {
        backgroundColor: 'transparent',
        tooltip: {
          trigger: 'axis',
          axisPointer: { type: 'shadow' },
          backgroundColor: '#091b22',
          borderColor: '#1e4b5a',
          textStyle: { color: '#f1f5f9', fontSize: 11 },
        },
        grid: { left: 95, right: 25, top: 15, bottom: 20 },
        xAxis: {
          type: 'value',
          axisLabel: { color: '#64748b', fontSize: 9.5 },
          splitLine: { lineStyle: { color: '#0d222b' } },
        },
        yAxis: {
          type: 'category',
          data: topProjects.map((p) => p.proyecto.length > 14 ? p.proyecto.slice(0, 14) + '…' : p.proyecto).reverse(),
          axisLabel: { color: '#cbd5e1', fontSize: 9.5 },
          axisLine: { lineStyle: { color: '#163642' } },
        },
        series: [
          {
            name: 'Und Disponibles',
            type: 'bar',
            data: topProjects.map((p) => p.und_por_vender ?? 0).reverse(),
            itemStyle: { color: '#22d3ee', borderRadius: [0, 4, 4, 0] },
            label: { show: true, position: 'right', color: '#22d3ee', fontSize: 10 },
          },
        ],
      }

      const actions: ChatAction[] = []
      if (onFilterZona) {
        actions.push({
          label: `Filtrar ${matchedZona} en Tablero`,
          icon: '🎯',
          onClick: () => onFilterZona(matchedZona),
        })
      }
      if (onSwitchTab) {
        actions.push({
          label: 'Ver en Mapa Geoespacial',
          icon: '🗺️',
          onClick: () => onSwitchTab('geoespacial'),
        })
      }

      return {
        text: `📍 **Análisis Focalizado: ${matchedZona}**\n\n• **${zonaProjects.length} desarrollos censados**\n• Stock disponible: **${totalDisp.toLocaleString()} unidades** (${pctVend}% colocado)\n• Velocidad de colocación media: **${avgRitmo.toFixed(1)} und/mes**\n\n*Principales proyectos con stock en ${matchedZona}:*`,
        chartTitle: `Top Proyectos con Stock en ${matchedZona}`,
        chartOption,
        actions,
        chips: ['⚡ Ver proyectos más rápidos', '⚠️ Proyectos en riesgo', '📊 Volver a stock general'],
      }
    }

    // 5. STOCK / INVENTARIO POR ZONA (O PREGUNTA GENERAL SOBRE ZONAS)
    if (q.includes('zona') || q.includes('stock') || q.includes('oferta') || q.includes('inventario') || q.includes('unidades')) {
      const zonaMap: Record<string, { count: number; undDisp: number; undTot: number }> = {}
      latest.forEach((p) => {
        const z = p.ZONAS || 'Otras'
        if (!zonaMap[z]) zonaMap[z] = { count: 0, undDisp: 0, undTot: 0 }
        zonaMap[z].count++
        zonaMap[z].undDisp += p.und_por_vender ?? 0
        zonaMap[z].undTot += p.und_totales ?? 0
      })

      const entries = Object.entries(zonaMap)
        .sort((a, b) => b[1].undDisp - a[1].undDisp)
        .slice(0, 6)

      const chartOption = {
        backgroundColor: 'transparent',
        tooltip: {
          trigger: 'axis',
          axisPointer: { type: 'shadow' },
          backgroundColor: '#091b22',
          borderColor: '#1e4b5a',
          textStyle: { color: '#f1f5f9', fontSize: 11 },
        },
        grid: { left: 40, right: 15, top: 15, bottom: 45 },
        xAxis: {
          type: 'category',
          data: entries.map(([name]) => name.length > 9 ? name.slice(0, 9) + '…' : name),
          axisLabel: { color: '#94a3b8', fontSize: 9, rotate: 25 },
          axisLine: { lineStyle: { color: '#163642' } },
        },
        yAxis: {
          type: 'value',
          axisLabel: { color: '#64748b', fontSize: 9.5 },
          splitLine: { lineStyle: { color: '#0d222b' } },
        },
        series: [
          {
            name: 'Und Disponibles',
            type: 'bar',
            data: entries.map(([, d]) => d.undDisp),
            itemStyle: {
              color: {
                type: 'linear',
                x: 0, y: 0, x2: 0, y2: 1,
                colorStops: [
                  { offset: 0, color: '#22d3ee' },
                  { offset: 1, color: '#0d9488' },
                ],
              },
              borderRadius: [4, 4, 0, 0],
            },
            barMaxWidth: 26,
            label: { show: true, position: 'top', color: '#f1f5f9', fontSize: 9.5 },
          },
        ],
      }

      const listText = entries.slice(0, 4).map(([name, d]) => `• **${name}**: ${d.undDisp.toLocaleString()} und (${d.count} proyectos)`).join('\n')

      const leaderZona = entries[0]
      const actions: ChatAction[] = []
      if (onFilterZona && leaderZona) {
        actions.push({
          label: `Filtrar ${leaderZona[0]}`,
          icon: '🎯',
          onClick: () => onFilterZona(leaderZona[0]),
        })
      }
      if (onSwitchTab) {
        actions.push({
          label: 'Ver Mapa Geoespacial',
          icon: '🗺️',
          onClick: () => onSwitchTab('geoespacial'),
        })
      }

      return {
        text: `📊 **Inventario Disponible por Zona (${currentCiudad})**:\n\nLa mayor concentración de oferta activa se ubica en:\n\n${listText}\n\n*Gráfico de las 6 zonas con mayor volumen disponible:*`,
        chartTitle: 'Top Zonas por Stock Disponible',
        chartOption,
        actions,
        chips: ['⚡ Ver ritmo de venta', '🏗️ Distribución por etapa', '⚠️ Proyectos en riesgo'],
      }
    }

    // 6. COMPARATIVA POR CIUDADES
    if (isMultiCity) {
      const boliviaInds = await fetchIndicadores()
      const boliviaLatest = getLatestPerProject(boliviaInds)

      const cityMap: Record<string, { proy: number; disp: number; ritmoSum: number; ritmoCount: number }> = {}
      boliviaLatest.forEach((p) => {
        const c = p.ciudad || 'SCZ'
        if (!cityMap[c]) cityMap[c] = { proy: 0, disp: 0, ritmoSum: 0, ritmoCount: 0 }
        cityMap[c].proy++
        cityMap[c].disp += p.und_por_vender ?? 0
        if (p.ritmo_venta && p.ritmo_venta > 0) {
          cityMap[c].ritmoSum += p.ritmo_venta
          cityMap[c].ritmoCount++
        }
      })

      const cities = ['SCZ', 'LPZ', 'CBB']
      const dispData = cities.map((c) => cityMap[c]?.disp ?? 0)

      const chartOption = {
        backgroundColor: 'transparent',
        tooltip: {
          trigger: 'axis',
          axisPointer: { type: 'shadow' },
          backgroundColor: '#091b22',
          borderColor: '#1e4b5a',
          textStyle: { color: '#f1f5f9', fontSize: 11 },
        },
        grid: { left: 45, right: 15, top: 15, bottom: 25 },
        xAxis: {
          type: 'category',
          data: ['Santa Cruz', 'La Paz', 'Cochabamba'],
          axisLabel: { color: '#94a3b8', fontSize: 10 },
          axisLine: { lineStyle: { color: '#163642' } },
        },
        yAxis: {
          type: 'value',
          axisLabel: { color: '#64748b', fontSize: 9.5 },
          splitLine: { lineStyle: { color: '#0d222b' } },
        },
        series: [
          {
            name: 'Stock Disponible',
            type: 'bar',
            data: dispData,
            itemStyle: {
              color: '#14b8a6',
              borderRadius: [4, 4, 0, 0],
            },
            barMaxWidth: 35,
            label: { show: true, position: 'top', color: '#22d3ee', fontSize: 10, fontWeight: 'bold' },
          },
        ],
      }

      return {
        text: `🏙️ **Comparativa Nacional de Mercado (Bolivia)**:\n\n• **Santa Cruz**: ${cityMap['SCZ']?.proy ?? 0} desarrollos · ${(cityMap['SCZ']?.disp ?? 0).toLocaleString()} und disponibles\n• **La Paz**: ${cityMap['LPZ']?.proy ?? 0} desarrollos · ${(cityMap['LPZ']?.disp ?? 0).toLocaleString()} und disponibles\n• **Cochabamba**: ${cityMap['CBB']?.proy ?? 0} desarrollos · ${(cityMap['CBB']?.disp ?? 0).toLocaleString()} und disponibles\n\n*Comparativa de unidades en stock por plaza:*`,
        chartTitle: 'Inventario Disponible por Ciudad',
        chartOption,
        chips: ['📊 Stock por zona en SCZ', '⚡ Ranking ritmo de venta', '⚠️ Riesgo de sobreoferta'],
      }
    }

    // 7. SÍNTESIS INTELIGENTE / DEFAULT
    const totalDisp = latest.reduce((acc, p) => acc + (p.und_por_vender ?? 0), 0)
    const totalTot = latest.reduce((acc, p) => acc + (p.und_totales ?? 0), 0)
    const pct = totalTot > 0 ? Math.round(((totalTot - totalDisp) / totalTot) * 100) : 0
    const ritmos = latest.filter((p) => p.ritmo_venta != null && p.ritmo_venta > 0)
    const avgR = ritmos.length > 0 ? ritmos.reduce((acc, p) => acc + (p.ritmo_venta ?? 0), 0) / ritmos.length : 0

    return {
      text: `Entendido. Analicé los **${latest.length} desarrollos censados** en **${currentCiudad}**:\n\n• Stock disponible total: **${totalDisp.toLocaleString()} unidades**\n• Nivel de absorción acumulado: **${pct}% colocado**\n• Velocidad media de colocación: **${avgR.toFixed(1)} und/mes**\n\n¿Quieres que te grafique alguna métrica específica? Puedes pedirme:`,
      chips: [
        '📊 Graficar stock por zona',
        '⚡ Ranking de velocidad',
        '🏗️ Inventario por etapa',
        '⚠️ Ver proyectos con sobreoferta',
      ],
    }
  }

  function renderFormattedText(text: string) {
    return text.split('\n').map((line, idx) => (
      <span key={idx}>
        {line.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/).map((part, j) => {
          if (part.startsWith('**') && part.endsWith('**')) {
            return (
              <strong key={j} style={{ color: '#f1f5f9', fontWeight: 600 }}>
                {part.slice(2, -2)}
              </strong>
            )
          }
          if (part.startsWith('*') && part.endsWith('*')) {
            return (
              <em key={j} style={{ color: '#94a3b8', fontSize: '0.92em' }}>
                {part.slice(1, -1)}
              </em>
            )
          }
          return part
        })}
        {idx < text.split('\n').length - 1 && <br />}
      </span>
    ))
  }

  return (
    <div
      className={isEmbedded ? 'panel' : 'panel panel-left'}
      style={{ display: 'flex', flexDirection: 'column', ...(isEmbedded ? { flex: 1, height: '100%', borderRight: 'none' } : {}) }}
    >
      {/* Header */}
      <div className="panel-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div className="panel-title-dot" style={{ background: 'var(--accent-cyan)', boxShadow: '0 0 8px var(--accent-cyan)' }} />
          <span style={{ fontWeight: 700, fontSize: 11.5 }}>IA Asistente</span>
        </div>
        <span style={{ fontSize: 9.5, color: 'var(--text-muted)', background: 'var(--bg-card)', padding: '2px 6px', borderRadius: 4, border: '1px solid var(--border-subtle)' }}>
          NLP Analytics
        </span>
      </div>

      {/* Messages Scroll Area */}
      <div className="chat-messages panel-body" style={{ flex: 1, overflowY: 'auto', padding: '12px 10px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {messages.map((msg) => (
          <div key={msg.id} className={`chat-msg ${msg.role}`} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
              <div
                className={`chat-avatar ${msg.role}`}
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: 6,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 10,
                  fontWeight: 700,
                  flexShrink: 0,
                  background: msg.role === 'ai' ? 'linear-gradient(135deg, #032e35 0%, #0e7490 100%)' : 'var(--bg-card)',
                  color: msg.role === 'ai' ? '#22d3ee' : '#cbd5e1',
                  border: `1px solid ${msg.role === 'ai' ? '#14b8a6' : 'var(--border-default)'}`,
                }}>
                {msg.role === 'ai' ? '⚡' : 'U'}
              </div>

              <div
                className={`chat-bubble ${msg.role}`}
                style={{
                  flex: 1,
                  background: msg.role === 'ai' ? 'var(--bg-card, #091b22)' : 'rgba(20, 184, 166, 0.15)',
                  border: `1px solid ${msg.role === 'ai' ? 'var(--border-subtle, #163642)' : 'var(--citrino-teal-light)'}`,
                  borderRadius: 8,
                  padding: '10px 12px',
                  fontSize: 11.5,
                  lineHeight: 1.5,
                  color: 'var(--text-secondary, #cbd5e1)',
                  boxShadow: '0 4px 14px rgba(0, 0, 0, 0.35)',
                }}>
                <div>{renderFormattedText(msg.text)}</div>

                {/* Dynamic Inline EChart */}
                {msg.chartOption && (
                  <div style={{
                    marginTop: 10,
                    background: '#040e12',
                    border: '1px solid #163642',
                    borderRadius: 8,
                    padding: '8px 6px 4px',
                    boxShadow: 'inset 0 0 12px rgba(0,0,0,0.4)',
                  }}>
                    {msg.chartTitle && (
                      <div style={{
                        fontSize: 10,
                        fontWeight: 700,
                        color: 'var(--accent-cyan)',
                        textTransform: 'uppercase',
                        letterSpacing: 0.5,
                        paddingLeft: 6,
                        marginBottom: 4,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                      }}>
                        <span>📈</span>
                        <span>{msg.chartTitle}</span>
                      </div>
                    )}
                    <ReactECharts
                      option={msg.chartOption}
                      style={{ height: 175, width: '100%' }}
                      opts={{ renderer: 'canvas' }}
                    />
                  </div>
                )}

                {/* Interactive Action Buttons */}
                {msg.actions && msg.actions.length > 0 && (
                  <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {msg.actions.map((act, i) => (
                      <button
                        key={i}
                        onClick={act.onClick}
                        style={{
                          background: 'linear-gradient(135deg, #032e35 0%, #094754 100%)',
                          border: '1px solid var(--citrino-teal-light, #14b8a6)',
                          color: '#ffffff',
                          padding: '4px 9px',
                          borderRadius: 6,
                          fontSize: 10.5,
                          fontWeight: 600,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 5,
                          boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
                          transition: 'all 0.12s',
                        }}>
                        {act.icon && <span>{act.icon}</span>}
                        <span>{act.label}</span>
                      </button>
                    ))}
                  </div>
                )}

                {/* Suggested Chips */}
                {msg.chips && msg.chips.length > 0 && (
                  <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {msg.chips.map((c) => (
                      <span
                        key={c}
                        onClick={() => handleSend(c)}
                        style={{
                          background: 'var(--bg-surface, #0d222b)',
                          border: '1px solid var(--border-default, #1e3a47)',
                          borderRadius: 12,
                          padding: '2px 8px',
                          fontSize: 10,
                          color: 'var(--accent-cyan, #22d3ee)',
                          cursor: 'pointer',
                          transition: 'all 0.12s',
                        }}>
                        {c}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}

        {/* Loading shimmer */}
        {loading && (
          <div className="chat-msg ai" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <div
              className="chat-avatar ai"
              style={{
                width: 24,
                height: 24,
                borderRadius: 6,
                background: '#032e35',
                border: '1px solid #14b8a6',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 10,
                color: '#22d3ee',
              }}>
              ⚡
            </div>
            <div style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 8,
              padding: '8px 14px',
              display: 'flex',
              gap: 5,
              alignItems: 'center',
            }}>
              {[0, 0.2, 0.4].map((d, i) => (
                <div
                  key={i}
                  style={{
                    width: 5,
                    height: 5,
                    borderRadius: '50%',
                    background: 'var(--accent-cyan)',
                    animation: `pulse 1s ${d}s infinite`,
                  }}
                />
              ))}
              <span style={{ fontSize: 10.5, color: 'var(--text-muted)', marginLeft: 6 }}>
                Procesando datos censales...
              </span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input Area */}
      <div className="chat-input-area" style={{ borderTop: '1px solid var(--border-subtle)', padding: '8px 10px' }}>
        {/* Quick horizontal prompt pills */}
        <div style={{ display: 'flex', gap: 4, overflowX: 'auto', paddingBottom: 6, scrollbarWidth: 'none' }}>
          {QUICK_PROMPTS.map((p) => (
            <button
              key={p}
              onClick={() => handleSend(p)}
              style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 12,
                padding: '2px 8px',
                fontSize: 10,
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.12s',
              }}>
              {p}
            </button>
          ))}
        </div>

        {/* Input row */}
        <div className="chat-input-row" style={{ display: 'flex', gap: 6 }}>
          <textarea
            className="chat-input"
            placeholder="Pide un análisis o gráfico (ej. stock por zona)..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleSend()
              }
            }}
            rows={1}
            style={{
              flex: 1,
              background: 'var(--bg-card)',
              border: '1px solid var(--border-default)',
              borderRadius: 6,
              color: '#f1f5f9',
              padding: '6px 10px',
              fontSize: 11,
              resize: 'none',
              outline: 'none',
            }}
          />
          <button
            className="btn-send"
            onClick={() => handleSend()}
            disabled={!input.trim() || loading}
            style={{
              background: 'var(--citrino-petrol, #032e35)',
              border: '1px solid var(--citrino-teal-light, #14b8a6)',
              color: '#ffffff',
              borderRadius: 6,
              padding: '0 12px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 12,
            }}>
            ➤
          </button>
        </div>
      </div>
    </div>
  )
}
