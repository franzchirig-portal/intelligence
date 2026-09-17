import { useEffect, useRef, useState, useMemo } from 'react'
import { fetchIndicadores, getLatestPerProject } from '../lib/supabase'
import type { IndicadorFull } from '../lib/supabase'

declare const L: any

interface Props {
  ciudad: string
  zonaFilter?: string
  etapaFilter?: string | string[]
  selectedIndicador: IndicadorFull | null
  onSelectIndicador: (ind: IndicadorFull | null) => void
}

type ColorMetric = 'meses_stock' | 'ritmo_venta' | 'etapa'

const CITY_COORDS: Record<string, { center: [number, number]; zoom: number }> = {
  SCZ: { center: [-17.7833, -63.1821], zoom: 12 },
  LPZ: { center: [-16.5000, -68.1250], zoom: 13 },
  CBB: { center: [-17.3895, -66.1568], zoom: 13 },
  ALL: { center: [-17.0000, -64.5000], zoom: 6 },
}

export default function GeoespacialPanel({
  ciudad,
  zonaFilter = 'ALL',
  etapaFilter,
  selectedIndicador,
  onSelectIndicador,
}: Props) {
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<any>(null)
  const markersLayerRef = useRef<any>(null)

  const [allProjects, setAllProjects] = useState<IndicadorFull[]>([])
  const [loading, setLoading] = useState(true)
  const [colorMetric, setColorMetric] = useState<ColorMetric>('meses_stock')
  const [searchQuery, setSearchQuery] = useState('')
  const [showProjectList, setShowProjectList] = useState(false)

  // 1. Fetch data for active city
  useEffect(() => {
    let cancelled = false
    setLoading(true)

    fetchIndicadores(ciudad === 'ALL' ? undefined : ciudad)
      .then((inds) => {
        if (cancelled) return
        const latest = getLatestPerProject(inds)
        setAllProjects(latest)
        setLoading(false)
      })
      .catch((err) => {
        console.error('Error fetching map indicators:', err)
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [ciudad])

  // 2. Filter projects based on zona, etapa & coordinates
  const filteredProjects = useMemo(() => {
    return allProjects.filter((p) => {
      // Must have valid coordinates in Bolivia bounds
      if (p.latitud == null || p.longitud == null || isNaN(p.latitud) || isNaN(p.longitud)) {
        return false
      }
      if (p.latitud < -25 || p.latitud > -9 || p.longitud < -72 || p.longitud > -55) {
        return false
      }

      // Zona filter
      if (zonaFilter && zonaFilter !== 'ALL' && p.ZONAS !== zonaFilter) {
        return false
      }

      // Etapa filter
      if (etapaFilter) {
        if (Array.isArray(etapaFilter)) {
          if (etapaFilter.length > 0 && !etapaFilter.includes('ALL') && !etapaFilter.includes(p.etapa || '')) {
            return false
          }
        } else if (etapaFilter !== 'ALL' && p.etapa !== etapaFilter) {
          return false
        }
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const matchName = p.proyecto?.toLowerCase().includes(q)
        const matchZona = p.ZONAS?.toLowerCase().includes(q)
        const matchEtapa = p.etapa?.toLowerCase().includes(q)
        if (!matchName && !matchZona && !matchEtapa) return false
      }

      return true
    })
  }, [allProjects, zonaFilter, etapaFilter, searchQuery])

  // Helper: determine marker color based on metric
  const getMarkerColor = (p: IndicadorFull): string => {
    if (colorMetric === 'meses_stock') {
      const m = p.meses_stock
      if (m == null) return '#64748b'
      if (m < 12) return '#10b981' // Verde: Alta absorción
      if (m <= 18) return '#38bdf8' // Cian: Equilibrado
      if (m <= 24) return '#f59e0b' // Ámbar: Presión moderada
      return '#ef4444' // Rojo: Sobreoferta
    }

    if (colorMetric === 'ritmo_venta') {
      const r = p.ritmo_venta
      if (r == null) return '#64748b'
      if (r >= 2.0) return '#10b981'
      if (r >= 1.0) return '#38bdf8'
      if (r >= 0.4) return '#f59e0b'
      return '#ef4444'
    }

    // By Etapa
    const e = (p.etapa || '').toLowerCase()
    if (e.includes('pozo')) return '#c084fc'
    if (e.includes('obra')) return '#14b8a6'
    if (e.includes('preventa')) return '#f43f5e'
    if (e.includes('terminada') || e.includes('entrega')) return '#10b981'
    return '#38bdf8'
  }

  // 3. Initialize Leaflet map
  useEffect(() => {
    if (!mapContainerRef.current) return
    if (typeof L === 'undefined') {
      console.warn('Leaflet (L) is not loaded yet')
      return
    }

    // If map already exists, just return
    if (mapInstanceRef.current) return

    const config = CITY_COORDS[ciudad] || CITY_COORDS['SCZ']
    const map = L.map(mapContainerRef.current, {
      center: config.center,
      zoom: config.zoom,
      zoomControl: true,
      attributionControl: true,
    })

    // ESRI World Dark Gray Canvas tile layer (clean, high resolution, no API key required)
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}', {
      attribution: 'Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ',
      maxZoom: 16,
    }).addTo(map)

    const markersGroup = L.layerGroup().addTo(map)
    markersLayerRef.current = markersGroup
    mapInstanceRef.current = map

    return () => {
      map.remove()
      mapInstanceRef.current = null
      markersLayerRef.current = null
    }
  }, [])

  // 4. Update map center when ciudad changes
  useEffect(() => {
    if (!mapInstanceRef.current) return
    const config = CITY_COORDS[ciudad] || CITY_COORDS['SCZ']
    mapInstanceRef.current.flyTo(config.center, config.zoom, { duration: 1.2 })
  }, [ciudad])

  // 5. Render project markers on map
  useEffect(() => {
    if (!mapInstanceRef.current || !markersLayerRef.current || typeof L === 'undefined') return

    markersLayerRef.current.clearLayers()

    filteredProjects.forEach((p) => {
      const lat = p.latitud!
      const lng = p.longitud!
      const isSelected = selectedIndicador?.proyecto_id === p.proyecto_id
      const color = getMarkerColor(p)

      // Custom pulsing or styled marker
      const marker = L.circleMarker([lat, lng], {
        radius: isSelected ? 11 : 7,
        fillColor: color,
        color: isSelected ? '#22d3ee' : '#ffffff',
        weight: isSelected ? 3 : 1.5,
        opacity: 1,
        fillOpacity: 0.88,
      })

      // Citrino Dark Popup Template
      const popupHtml = `
        <div style="padding: 12px 14px; min-width: 220px; font-family: 'Inter', sans-serif;">
          <div style="display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; margin-bottom: 6px;">
            <div style="font-weight: 700; font-size: 13px; color: #f1f5f9; line-height: 1.25;">
              ${p.proyecto}
            </div>
            <span style="font-size: 9px; font-weight: 700; padding: 2px 6px; border-radius: 4px; background: rgba(34, 211, 238, 0.15); color: #22d3ee; border: 1px solid rgba(34, 211, 238, 0.3); white-space: nowrap;">
              ${p.etapa || 'En Curso'}
            </span>
          </div>

          <div style="font-size: 11px; color: #94a3b8; margin-bottom: 10px; display: flex; align-items: center; gap: 4px;">
            <span>📍 ${p.ZONAS || 'Zona no especificada'}</span>
            ${p.SUBZONAS ? `<span style="opacity: 0.7;">• ${p.SUBZONAS}</span>` : ''}
          </div>

          <!-- Metrics Grid -->
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; background: #040e12; border: 1px solid #163642; border-radius: 6px; padding: 8px; margin-bottom: 10px;">
            <div>
              <div style="font-size: 9.5px; color: #64748b; text-transform: uppercase;">Ritmo Venta</div>
              <div style="font-size: 12px; font-weight: 700; color: #10b981; font-family: 'JetBrains Mono', monospace;">
                ${p.ritmo_venta != null ? `${Number(p.ritmo_venta).toFixed(1)} und/m` : '—'}
              </div>
            </div>
            <div>
              <div style="font-size: 9.5px; color: #64748b; text-transform: uppercase;">Meses Stock</div>
              <div style="font-size: 12px; font-weight: 700; color: #38bdf8; font-family: 'JetBrains Mono', monospace;">
                ${p.meses_stock != null ? `${Number(p.meses_stock).toFixed(1)} m` : '—'}
              </div>
            </div>
            <div>
              <div style="font-size: 9.5px; color: #64748b; text-transform: uppercase;">Disponibles</div>
              <div style="font-size: 12px; font-weight: 700; color: #f1f5f9; font-family: 'JetBrains Mono', monospace;">
                ${p.und_por_vender ?? '—'} <span style="font-size: 9.5px; font-weight: 400; color: #64748b;">/ ${p.und_totales ?? '—'}</span>
              </div>
            </div>
            <div>
              <div style="font-size: 9.5px; color: #64748b; text-transform: uppercase;">% Colocado</div>
              <div style="font-size: 12px; font-weight: 700; color: #22d3ee; font-family: 'JetBrains Mono', monospace;">
                ${p.pct_vendido != null ? `${(p.pct_vendido * 100).toFixed(0)}%` : '—'}
              </div>
            </div>
          </div>

          <button id="btn-select-${p.proyecto_id}" style="
            width: 100%;
            background: linear-gradient(135deg, #032e35 0%, #0d4b57 100%);
            border: 1px solid #14b8a6;
            color: #ffffff;
            font-size: 11px;
            font-weight: 600;
            padding: 6px 12px;
            border-radius: 6px;
            cursor: pointer;
            transition: all 0.15s;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 6px;
          ">
            <span>📊 Analizar en Diagnóstico</span>
          </button>
        </div>
      `

      marker.bindPopup(popupHtml, { maxWidth: 280, minWidth: 230 })

      marker.on('popupopen', () => {
        const btn = document.getElementById(`btn-select-${p.proyecto_id}`)
        if (btn) {
          btn.onclick = () => {
            onSelectIndicador(p)
          }
        }
      })

      marker.addTo(markersLayerRef.current)
    })
  }, [filteredProjects, colorMetric, selectedIndicador])

  // Center on selectedIndicador if changed from outside
  useEffect(() => {
    if (!mapInstanceRef.current || !selectedIndicador) return
    if (selectedIndicador.latitud && selectedIndicador.longitud) {
      mapInstanceRef.current.flyTo([selectedIndicador.latitud, selectedIndicador.longitud], 15, { duration: 1.0 })
    }
  }, [selectedIndicador])

  return (
    <div className="panel panel-center" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>
      {/* Top Header & Map Controls */}
      <div className="panel-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div className="panel-title-dot" style={{ background: 'var(--accent-cyan)', boxShadow: '0 0 8px var(--accent-cyan)' }} />
          <span style={{ fontWeight: 700, fontSize: 12 }}>Vista Geoespacial de Proyectos</span>
          <span style={{
            fontSize: 10,
            background: 'var(--bg-surface)',
            color: 'var(--text-muted)',
            padding: '2px 8px',
            borderRadius: 10,
            border: '1px solid var(--border-subtle)',
            fontFamily: "'JetBrains Mono', monospace",
          }}>
            📍 {filteredProjects.length} georreferenciados
          </span>
        </div>

        {/* Color Metric Selector & Project List Toggle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text-muted)' }}>
            <span>Colorear por:</span>
            <select
              value={colorMetric}
              onChange={(e) => setColorMetric(e.target.value as ColorMetric)}
              style={{
                background: 'var(--bg-card)',
                color: 'var(--accent-cyan)',
                border: '1px solid var(--border-default)',
                padding: '3px 8px',
                borderRadius: 6,
                fontSize: 11,
                fontWeight: 600,
                outline: 'none',
                cursor: 'pointer',
              }}>
              <option value="meses_stock">Meses de Stock (Riesgo)</option>
              <option value="ritmo_venta">Ritmo de Venta</option>
              <option value="etapa">Etapa de Obra</option>
            </select>
          </div>

          <button
            onClick={() => setShowProjectList(!showProjectList)}
            style={{
              background: showProjectList ? 'var(--citrino-petrol)' : 'var(--bg-card)',
              border: `1px solid ${showProjectList ? 'var(--citrino-teal-light)' : 'var(--border-default)'}`,
              color: showProjectList ? '#ffffff' : 'var(--text-secondary)',
              padding: '3px 10px',
              borderRadius: 6,
              fontSize: 11,
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}>
            <span>📋</span>
            <span>Lista ({filteredProjects.length})</span>
          </button>
        </div>
      </div>

      {/* Main Map Canvas Area */}
      <div style={{ flex: 1, position: 'relative', width: '100%', height: '100%' }}>
        <div ref={mapContainerRef} style={{ width: '100%', height: '100%', minHeight: 400 }} />

        {/* Loading Overlay */}
        {loading && (
          <div style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(4, 10, 13, 0.75)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            zIndex: 1000,
            backdropFilter: 'blur(3px)',
          }}>
            <div className="loading-shimmer" style={{ width: 140, height: 16 }} />
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Cargando capa geoespacial...</div>
          </div>
        )}

        {/* Search Overlay floating over Map */}
        <div style={{
          position: 'absolute',
          top: 14,
          left: 14,
          zIndex: 800,
          background: 'rgba(9, 27, 34, 0.92)',
          backdropFilter: 'blur(10px)',
          border: '1px solid var(--border-bright)',
          borderRadius: 8,
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.6)',
          display: 'flex',
          alignItems: 'center',
          padding: '4px 10px',
          width: 260,
        }}>
          <span style={{ fontSize: 12, marginRight: 6, opacity: 0.7 }}>🔍</span>
          <input
            type="text"
            placeholder="Buscar proyecto en el mapa..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#f1f5f9',
              fontSize: 11.5,
              width: '100%',
              outline: 'none',
            }}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                fontSize: 11,
              }}>
              ✕
            </button>
          )}
        </div>

        {/* Floating Legend Overlay */}
        <div style={{
          position: 'absolute',
          bottom: 24,
          left: 14,
          zIndex: 800,
          background: 'rgba(9, 27, 34, 0.92)',
          backdropFilter: 'blur(10px)',
          border: '1px solid var(--border-bright)',
          borderRadius: 8,
          padding: '8px 12px',
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.6)',
          fontSize: 10.5,
        }}>
          <div style={{ fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 6, textTransform: 'uppercase', fontSize: 9.5, letterSpacing: 0.5 }}>
            {colorMetric === 'meses_stock' && 'Meses de Stock (Riesgo)'}
            {colorMetric === 'ritmo_venta' && 'Ritmo de Venta (und/mes)'}
            {colorMetric === 'etapa' && 'Etapas de Construcción'}
          </div>

          {colorMetric === 'meses_stock' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 9, height: 9, borderRadius: '50%', background: '#10b981' }} />
                <span style={{ color: 'var(--text-primary)' }}>&lt; 12 meses (Alta rotación)</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 9, height: 9, borderRadius: '50%', background: '#38bdf8' }} />
                <span style={{ color: 'var(--text-primary)' }}>12 - 18 meses (Equilibrado)</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 9, height: 9, borderRadius: '50%', background: '#f59e0b' }} />
                <span style={{ color: 'var(--text-primary)' }}>18 - 24 meses (Presión moderada)</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 9, height: 9, borderRadius: '50%', background: '#ef4444' }} />
                <span style={{ color: 'var(--text-primary)' }}>&gt; 24 meses (Sobreoferta)</span>
              </div>
            </div>
          )}

          {colorMetric === 'ritmo_venta' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 9, height: 9, borderRadius: '50%', background: '#10b981' }} />
                <span style={{ color: 'var(--text-primary)' }}>&gt; 2.0 und/mes (Rápido)</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 9, height: 9, borderRadius: '50%', background: '#38bdf8' }} />
                <span style={{ color: 'var(--text-primary)' }}>1.0 - 2.0 und/mes (Medio)</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 9, height: 9, borderRadius: '50%', background: '#f59e0b' }} />
                <span style={{ color: 'var(--text-primary)' }}>0.4 - 1.0 und/mes (Lento)</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 9, height: 9, borderRadius: '50%', background: '#ef4444' }} />
                <span style={{ color: 'var(--text-primary)' }}>&lt; 0.4 und/mes (Crítico)</span>
              </div>
            </div>
          )}

          {colorMetric === 'etapa' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 9, height: 9, borderRadius: '50%', background: '#14b8a6' }} />
                <span style={{ color: 'var(--text-primary)' }}>Obra bruta / fina</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 9, height: 9, borderRadius: '50%', background: '#c084fc' }} />
                <span style={{ color: 'var(--text-primary)' }}>En Pozo</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 9, height: 9, borderRadius: '50%', background: '#f43f5e' }} />
                <span style={{ color: 'var(--text-primary)' }}>Preventa temprana</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 9, height: 9, borderRadius: '50%', background: '#10b981' }} />
                <span style={{ color: 'var(--text-primary)' }}>Terminada / Entrega</span>
              </div>
            </div>
          )}
        </div>

        {/* Collapsible Project Quick List Sidebar inside map */}
        {showProjectList && (
          <div style={{
            position: 'absolute',
            top: 0,
            right: 0,
            bottom: 0,
            width: 290,
            background: 'rgba(9, 27, 34, 0.95)',
            backdropFilter: 'blur(16px)',
            borderLeft: '1px solid var(--border-bright)',
            zIndex: 850,
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '-10px 0 30px rgba(0, 0, 0, 0.6)',
          }}>
            <div style={{
              padding: '10px 14px',
              borderBottom: '1px solid var(--border-subtle)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#f1f5f9', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Proyectos en Mapa ({filteredProjects.length})
              </span>
              <button
                onClick={() => setShowProjectList(false)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  fontSize: 12,
                }}>
                ✕
              </button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '6px 8px', display: 'flex', flexDirection: 'column', gap: 4 }}>
              {filteredProjects.map((p) => {
                const isSelected = selectedIndicador?.proyecto_id === p.proyecto_id
                const markerColor = getMarkerColor(p)

                return (
                  <div
                    key={p.proyecto_id}
                    onClick={() => {
                      onSelectIndicador(p)
                      if (mapInstanceRef.current && p.latitud && p.longitud) {
                        mapInstanceRef.current.flyTo([p.latitud, p.longitud], 16, { duration: 0.8 })
                      }
                    }}
                    style={{
                      padding: '8px 10px',
                      borderRadius: 6,
                      background: isSelected ? 'rgba(34, 211, 238, 0.12)' : 'var(--bg-card)',
                      border: `1px solid ${isSelected ? 'var(--accent-cyan)' : 'var(--border-subtle)'}`,
                      cursor: 'pointer',
                      transition: 'all 0.12s',
                    }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, marginBottom: 3 }}>
                      <span style={{ fontWeight: 600, fontSize: 11.5, color: '#f1f5f9', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {p.proyecto}
                      </span>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: markerColor, flexShrink: 0 }} />
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-muted)' }}>
                      <span>📍 {p.ZONAS || '—'}</span>
                      <span style={{ fontFamily: "'JetBrains Mono', monospace", color: 'var(--accent-cyan)' }}>
                        {p.und_por_vender ?? '0'} disp
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
