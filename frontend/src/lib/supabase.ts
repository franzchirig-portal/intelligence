import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// ─── Types ────────────────────────────────────────────────────────────────
export interface Proyecto {
  proyecto_id: string
  proyecto: string
  ciudad: string
  ZONAS: string | null
  SUBZONAS: string | null
  tipo_inmueble: string | null
  calidad: string | null
  desarrollador: string | null
  lanzamiento: string | null
  entrega: string | null
  latitud: number | null
  longitud: number | null
  uv: string | null
}

export interface IndicadorCenso {
  indicador_censo_id: string
  proyecto_id: string
  fecha_snapshot: string
  etapa: string | null
  und_totales: number | null
  und_vendidas: number | null
  und_por_vender: number | null
  pct_vendido: number | null
  ritmo_venta: number | null
  meses_stock: number | null
  stock_total: number | null
}

export interface AvgTipologia {
  indicador_censo_id: string
  avg_tipologia: string
  und_totales: number | null
  und_vendidas: number | null
  und_por_vender: number | null
  ritmo_venta: number | null
  meses_stock: number | null
  avg_precio: number | null
  avg_construccion_m2: number | null
  avg_sus_m2: number | null
}

export type IndicadorFull = IndicadorCenso & {
  proyecto: string
  ciudad: string
  latitud: number | null
  longitud: number | null
  ZONAS: string | null
  SUBZONAS: string | null
  tipo_inmueble: string | null
  desarrollador: string | null
  lanzamiento: string | null
  entrega: string | null
}

// ─── Core: Fetch everything, join in JS ───────────────────────────────────
let _proyCache: Proyecto[] | null = null
let _proyTime = 0

async function getAllProyectos(): Promise<Proyecto[]> {
  if (_proyCache && Date.now() - _proyTime < 60_000) return _proyCache
  const { data, error } = await supabase
    .from('oferta_proyectos')
    .select('*')
    .order('proyecto')
  if (error) throw error
  _proyCache = data ?? []
  _proyTime = Date.now()
  return _proyCache
}

let _indCache: IndicadorCenso[] | null = null
let _indTime = 0

async function getAllIndicadores(): Promise<IndicadorCenso[]> {
  if (_indCache && Date.now() - _indTime < 60_000) return _indCache
  const { data, error } = await supabase
    .from('oferta_indicadores_censo')
    .select('*')
    .order('fecha_snapshot', { ascending: false })
  if (error) throw error
  _indCache = data ?? []
  _indTime = Date.now()
  return _indCache
}

// ─── Public API ───────────────────────────────────────────────────────────
export async function fetchProyectos(ciudad?: string): Promise<Proyecto[]> {
  const all = await getAllProyectos()
  if (!ciudad || ciudad === 'ALL') return all
  return all.filter((p) => p.ciudad === ciudad)
}

export async function fetchIndicadores(ciudad?: string): Promise<IndicadorFull[]> {
  const [proyectos, indicadores] = await Promise.all([getAllProyectos(), getAllIndicadores()])
  const proyMap = new Map<string, Proyecto>(proyectos.map((p) => [p.proyecto_id, p]))

  const joined = indicadores.map((i) => {
    const p = proyMap.get(i.proyecto_id)
    return {
      ...i,
      proyecto:      p?.proyecto ?? '',
      ciudad:        p?.ciudad ?? '',
      latitud:       p?.latitud ?? null,
      longitud:      p?.longitud ?? null,
      ZONAS:         p?.ZONAS ?? null,
      SUBZONAS:      p?.SUBZONAS ?? null,
      tipo_inmueble: p?.tipo_inmueble ?? null,
      desarrollador: p?.desarrollador ?? null,
      lanzamiento:   p?.lanzamiento ?? null,
      entrega:       p?.entrega ?? null,
    }
  })

  if (!ciudad || ciudad === 'ALL') return joined
  return joined.filter((i) => i.ciudad === ciudad)
}

export async function fetchAvgTipologias(indicadorId: string): Promise<AvgTipologia[]> {
  const { data, error } = await supabase
    .from('oferta_avg_tipologias')
    .select('*')
    .eq('indicador_censo_id', indicadorId)
    .order('avg_tipologia')
  if (error) throw error
  return data ?? []
}

export function getLatestPerProject(indicadores: IndicadorFull[]): IndicadorFull[] {
  const map = new Map<string, IndicadorFull>()
  indicadores.forEach((i) => {
    const ex = map.get(i.proyecto_id)
    if (!ex || i.fecha_snapshot > ex.fecha_snapshot) map.set(i.proyecto_id, i)
  })
  return Array.from(map.values())
}

let _tiposCache: AvgTipologia[] | null = null
let _tiposTime = 0

export async function fetchAllAvgTipologias(): Promise<AvgTipologia[]> {
  if (_tiposCache && Date.now() - _tiposTime < 60_000) return _tiposCache
  const { data, error } = await supabase
    .from('oferta_avg_tipologias')
    .select('*')
    .order('avg_tipologia')
  if (error) throw error
  _tiposCache = data ?? []
  _tiposTime = Date.now()
  return _tiposCache
}

export async function fetchTipologiasForProject(
  proyectoId: string,
  indicadorCensoId?: string
): Promise<AvgTipologia[]> {
  if (indicadorCensoId) {
    const tipos = await fetchAvgTipologias(indicadorCensoId)
    if (tipos && tipos.length > 0) return tipos
  }
  // Fallback: check other snapshots of this project
  const allInds = await getAllIndicadores()
  const projInds = allInds.filter((i) => i.proyecto_id === proyectoId)
  for (const ind of projInds) {
    if (ind.indicador_censo_id === indicadorCensoId) continue
    const tipos = await fetchAvgTipologias(ind.indicador_censo_id)
    if (tipos && tipos.length > 0) return tipos
  }
  return []
}

export interface TipologiaBenchmark {
  tipo: string
  count: number
  avgPrecio: number
  avgSusM2: number
  avgArea: number
  avgRitmo: number
  totalUnidades: number
  totalVendidas: number
}

export function computeTipologiaBenchmarks(tipos: AvgTipologia[]): Record<string, TipologiaBenchmark> {
  const groups: Record<string, AvgTipologia[]> = {}
  for (const t of tipos) {
    const key = t.avg_tipologia || 'Otro'
    if (!groups[key]) groups[key] = []
    groups[key].push(t)
  }
  const result: Record<string, TipologiaBenchmark> = {}
  for (const [k, arr] of Object.entries(groups)) {
    const validPrecios = arr.map((x) => x.avg_precio).filter((x): x is number => x != null && x > 0)
    const validM2 = arr.map((x) => x.avg_sus_m2).filter((x): x is number => x != null && x > 0)
    const validArea = arr.map((x) => x.avg_construccion_m2).filter((x): x is number => x != null && x > 0)
    const validRitmo = arr.map((x) => x.ritmo_venta).filter((x): x is number => x != null && x > 0)

    result[k] = {
      tipo: k,
      count: arr.length,
      avgPrecio: validPrecios.length ? validPrecios.reduce((a, b) => a + b, 0) / validPrecios.length : 0,
      avgSusM2: validM2.length ? validM2.reduce((a, b) => a + b, 0) / validM2.length : 0,
      avgArea: validArea.length ? validArea.reduce((a, b) => a + b, 0) / validArea.length : 0,
      avgRitmo: validRitmo.length ? validRitmo.reduce((a, b) => a + b, 0) / validRitmo.length : 0,
      totalUnidades: arr.reduce((a, b) => a + (b.und_totales ?? 0), 0),
      totalVendidas: arr.reduce((a, b) => a + (b.und_vendidas ?? 0), 0),
    }
  }
  return result
}

export async function fetchProjectHistory(proyectoId: string): Promise<IndicadorFull[]> {
  const all = await fetchIndicadores()
  return all
    .filter((i) => i.proyecto_id === proyectoId)
    .sort((a, b) => a.fecha_snapshot.localeCompare(b.fecha_snapshot))
}

export interface ZonaMetrics {
  zona: string
  totalStockUnd: number
  totalStockUSD: number
  ritmoVentaMensual: number
  mesesStock: number
  totalProyectos: number
  totalVendidas: number
  totalInicial: number
  pctVendido: number
}

export function computeZonaMetrics(indicadores: IndicadorFull[]): ZonaMetrics[] {
  const groups = new Map<string, IndicadorFull[]>()
  indicadores.forEach((i) => {
    const z = (i.ZONAS || 'Sin Zona').trim()
    if (!groups.has(z)) groups.set(z, [])
    groups.get(z)!.push(i)
  })

  const results: ZonaMetrics[] = []
  groups.forEach((items, zona) => {
    const stockUnd = items.reduce((s, x) => s + (x.und_por_vender ?? 0), 0)
    const stockUSD = items.reduce((s, x) => s + (x.stock_total ?? 0), 0)
    const ritmo = items.reduce((s, x) => s + (x.ritmo_venta ?? 0), 0)
    const totalInicial = items.reduce((s, x) => s + (x.und_totales ?? 0), 0)
    const totalVendidas = items.reduce((s, x) => s + (x.und_vendidas ?? 0), 0)
    const meses = ritmo > 0 ? stockUnd / ritmo : 0
    const pct = totalInicial > 0 ? Math.round((totalVendidas / totalInicial) * 100) : 0

    results.push({
      zona,
      totalStockUnd: stockUnd,
      totalStockUSD: stockUSD,
      ritmoVentaMensual: Math.round(ritmo * 100) / 100,
      mesesStock: Math.round(meses * 10) / 10,
      totalProyectos: items.length,
      totalVendidas,
      totalInicial,
      pctVendido: pct,
    })
  })

  return results
}

export async function fetchKPIs(ciudad?: string) {
  const indicadores = await fetchIndicadores(ciudad)
  const latest = getLatestPerProject(indicadores)

  const totalUnidades = latest.reduce((s, r) => s + (r.und_totales ?? 0), 0)
  const totalVendidas = latest.reduce((s, r) => s + (r.und_vendidas ?? 0), 0)
  const totalDisp     = latest.reduce((s, r) => s + (r.und_por_vender ?? 0), 0)
  const ritmos = latest.filter((r) => r.ritmo_venta != null && r.ritmo_venta > 0).map((r) => r.ritmo_venta!)
  const avgRitmo = ritmos.length ? ritmos.reduce((s, v) => s + v, 0) / ritmos.length : 0
  const stockTotal = latest.reduce((s, r) => s + (r.stock_total ?? 0), 0)

  return {
    totalProyectos: latest.length,
    totalUnidades,
    totalVendidas,
    totalDisp,
    avgRitmo: Math.round(avgRitmo * 100) / 100,
    pctVendido: totalUnidades > 0 ? Math.round((totalVendidas / totalUnidades) * 100) : 0,
    stockTotal,
  }
}

