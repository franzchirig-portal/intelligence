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
  theme?: 'dark' | 'light'
}

export type MapDisplayMode = 'markers' | 'bubbles' | 'heatmap'
export type ColorMetric = 'meses_stock' | 'ritmo_venta' | 'etapa'
export type BubbleSizeMetric = 'und_por_vender' | 'ritmo_venta' | 'und_totales'
export type HeatmapMetric = 'stock' | 'ritmo' | 'densidad'
export type BasemapType = 'dark' | 'satellite' | 'streets' | 'light'

interface CustomQgisLayer {
  id: string
  name: string
  type: 'geojson' | 'wms'
  visible: boolean
  layerInstance?: any
  featureCount?: number
  color?: string
}

const CITY_COORDS: Record<string, { center: [number, number]; zoom: number }> = {
  SCZ: { center: [-17.7833, -63.1821], zoom: 12 },
  LPZ: { center: [-16.5000, -68.1250], zoom: 13 },
  CBB: { center: [-17.3895, -66.1568], zoom: 13 },
  ALL: { center: [-17.0000, -64.5000], zoom: 6 },
}

const BASEMAP_URLS: Record<BasemapType, { url: string; attribution: string; maxZoom: number }> = {
  dark: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ',
    maxZoom: 16,
  },
  satellite: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community',
    maxZoom: 18,
  },
  streets: {
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap contributors',
    maxZoom: 19,
  },
  light: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ',
    maxZoom: 16,
  },
}

// Pre-loaded Santa Cruz Urban Polygons (QGIS-compatible GeoJSON)
const PRELOADED_SCZ_ZONES: any = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: { name: 'Equipetrol', zona: 'Equipetrol', tipo: 'Corredor Corporativo / Residencial Premium' },
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [-63.195, -17.760],
          [-63.185, -17.765],
          [-63.190, -17.780],
          [-63.205, -17.778],
          [-63.195, -17.760],
        ]],
      },
    },
    {
      type: 'Feature',
      properties: { name: 'Urubó', zona: 'Urubó', tipo: 'Suburbano Alta Gama / Condominios' },
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [-63.235, -17.755],
          [-63.210, -17.745],
          [-63.215, -17.780],
          [-63.245, -17.790],
          [-63.235, -17.755],
        ]],
      },
    },
    {
      type: 'Feature',
      properties: { name: 'Norte 2do a 5to Anillo', zona: 'Norte 2do a 5to anillo', tipo: 'Consolidación Residencial Alta Densidad' },
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [-63.185, -17.750],
          [-63.160, -17.755],
          [-63.165, -17.775],
          [-63.188, -17.770],
          [-63.185, -17.750],
        ]],
      },
    },
    {
      type: 'Feature',
      properties: { name: 'Centro / Casco Viejo', zona: 'Centro', tipo: 'Renovación Urbana / Centro Histórico' },
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [-63.188, -17.778],
          [-63.175, -17.778],
          [-63.175, -17.788],
          [-63.188, -17.788],
          [-63.188, -17.778],
        ]],
      },
    },
  ],
}

export default function GeoespacialPanel({
  ciudad,
  zonaFilter = 'ALL',
  etapaFilter,
  selectedIndicador,
  onSelectIndicador,
  theme = 'dark',
}: Props) {
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<any>(null)
  const markersLayerRef = useRef<any>(null)
  const heatLayerRef = useRef<any>(null)
  const tileLayerRef = useRef<any>(null)
  const qgisLayerGroupRef = useRef<any>(null)

  const [allProjects, setAllProjects] = useState<IndicadorFull[]>([])
  const [loading, setLoading] = useState(true)

  // Map Modes & Settings
  const [mapMode, setMapMode] = useState<MapDisplayMode>('markers')
  const [colorMetric, setColorMetric] = useState<ColorMetric>('meses_stock')
  const [bubbleMetric, setBubbleMetric] = useState<BubbleSizeMetric>('und_por_vender')
  const [heatmapMetric, setHeatmapMetric] = useState<HeatmapMetric>('stock')
  const [basemap, setBasemap] = useState<BasemapType>(theme === 'light' ? 'light' : 'dark')

  // Search & Navigation
  const [searchQuery, setSearchQuery] = useState('')
  const [showProjectList, setShowProjectList] = useState(false)
  const [showQgisPanel, setShowQgisPanel] = useState(false)

  // QGIS Layers State
  const [qgisLayers, setQgisLayers] = useState<CustomQgisLayer[]>([
    {
      id: 'preloaded_scz',
      name: 'Polígonos Zonificación SCZ',
      type: 'geojson',
      visible: false,
      featureCount: 4,
      color: '#38bdf8',
    },
  ])

  // Custom WMS/XYZ URL Form
  const [wmsUrl, setWmsUrl] = useState('')
  const [wmsName, setWmsName] = useState('')

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

  // 2. Filter projects based on coordinates and filters
  const filteredProjects = useMemo(() => {
    return allProjects.filter((p) => {
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

  // Helper: Marker / Bubble color
  const getMarkerColor = (p: IndicadorFull): string => {
    if (colorMetric === 'meses_stock') {
      const m = p.meses_stock
      if (m == null) return '#64748b'
      if (m < 12) return '#10b981' // Verde: Alta absorción
      if (m <= 18) return '#94a3b8' // Gris: Equilibrado
      if (m <= 24) return '#f59e0b' // Ámbar: Presión moderada
      return '#ef4444' // Rojo: Sobreoferta
    }

    if (colorMetric === 'ritmo_venta') {
      const r = p.ritmo_venta
      if (r == null) return '#64748b'
      if (r >= 2.0) return '#10b981'
      if (r >= 1.0) return '#94a3b8'
      if (r >= 0.4) return '#f59e0b'
      return '#ef4444'
    }

    // By Etapa
    const e = (p.etapa || '').toLowerCase()
    if (e.includes('pozo')) return '#a1a1aa'
    if (e.includes('obra')) return '#71717a'
    if (e.includes('preventa')) return '#d4d4d8'
    if (e.includes('terminada') || e.includes('entrega')) return '#10b981'
    return '#94a3b8'
  }

  // Helper: Bubble radius calculation
  const getBubbleRadius = (p: IndicadorFull, isSelected: boolean): number => {
    let base = 8
    if (bubbleMetric === 'und_por_vender') {
      const val = p.und_por_vender || 0
      base = Math.max(6, Math.min(32, Math.sqrt(val) * 2.8))
    } else if (bubbleMetric === 'ritmo_venta') {
      const val = p.ritmo_venta || 0
      base = Math.max(6, Math.min(32, val * 7))
    } else if (bubbleMetric === 'und_totales') {
      const val = p.und_totales || 0
      base = Math.max(6, Math.min(34, Math.sqrt(val) * 2.0))
    }
    return isSelected ? base + 4 : base
  }

  // 3. Initialize Leaflet map
  useEffect(() => {
    if (!mapContainerRef.current) return
    if (typeof L === 'undefined') {
      console.warn('Leaflet (L) is not loaded yet')
      return
    }

    if (mapInstanceRef.current) return

    const config = CITY_COORDS[ciudad] || CITY_COORDS['SCZ']
    const map = L.map(mapContainerRef.current, {
      center: config.center,
      zoom: config.zoom,
      zoomControl: true,
      attributionControl: false,
    })

    const initialBasemap = BASEMAP_URLS[basemap] || BASEMAP_URLS.dark
    const tiles = L.tileLayer(initialBasemap.url, {
      attribution: initialBasemap.attribution,
      maxZoom: initialBasemap.maxZoom,
    }).addTo(map)
    tileLayerRef.current = tiles

    const qgisGroup = L.layerGroup().addTo(map)
    qgisLayerGroupRef.current = qgisGroup

    const markersGroup = L.layerGroup().addTo(map)
    markersLayerRef.current = markersGroup

    mapInstanceRef.current = map

    return () => {
      map.remove()
      mapInstanceRef.current = null
      markersLayerRef.current = null
      tileLayerRef.current = null
      heatLayerRef.current = null
      qgisLayerGroupRef.current = null
    }
  }, [])

  // 4. Update basemap tile layer
  useEffect(() => {
    if (!tileLayerRef.current) return
    const currentConfig = BASEMAP_URLS[basemap] || BASEMAP_URLS.dark
    tileLayerRef.current.setUrl(currentConfig.url)
  }, [basemap])

  // 5. Update map center when ciudad changes
  useEffect(() => {
    if (!mapInstanceRef.current) return
    const config = CITY_COORDS[ciudad] || CITY_COORDS['SCZ']
    mapInstanceRef.current.flyTo(config.center, config.zoom, { duration: 1.2 })
  }, [ciudad])

  // 6. Render Layers: Markers, Bubbles, or Heatmap
  useEffect(() => {
    if (!mapInstanceRef.current || typeof L === 'undefined') return

    // Clear previous vector markers
    if (markersLayerRef.current) {
      markersLayerRef.current.clearLayers()
    }

    // Remove previous heatmap if active
    if (heatLayerRef.current) {
      mapInstanceRef.current.removeLayer(heatLayerRef.current)
      heatLayerRef.current = null
    }

    const isLight = theme === 'light'
    const popupText = isLight ? '#0f172a' : '#f1f5f9'
    const popupSub = isLight ? '#475569' : '#94a3b8'
    const metricsBg = isLight ? '#f8fafc' : '#141414'
    const metricsBorder = isLight ? '#cbd5e1' : '#2b2d30'
    const metricsTextMuted = '#9d9d9d'

    // ── MODE: HEATMAP ────────────────────────────────────────────────────────
    if (mapMode === 'heatmap') {
      const heatPoints = filteredProjects.map((p) => {
        let intensity = 0.5
        if (heatmapMetric === 'stock') {
          intensity = Math.min(1.0, Math.max(0.2, (p.und_por_vender || 5) / 75))
        } else if (heatmapMetric === 'ritmo') {
          intensity = Math.min(1.0, Math.max(0.2, (p.ritmo_venta || 0.5) / 3.5))
        } else {
          intensity = 0.6
        }
        return [p.latitud, p.longitud, intensity]
      })

      if (typeof (L as any).heatLayer === 'function') {
        const heat = (L as any).heatLayer(heatPoints, {
          radius: 32,
          blur: 22,
          maxZoom: 16,
          max: 1.0,
          gradient: {
            0.2: '#2563eb', // Azul
            0.4: '#06b6d4', // Cyan
            0.6: '#10b981', // Verde
            0.8: '#f59e0b', // Ámbar
            1.0: '#ef4444', // Rojo
          },
        }).addTo(mapInstanceRef.current)
        heatLayerRef.current = heat
      } else {
        console.warn('L.heatLayer not available, falling back to bubbles')
      }
    }

    // ── MODE: MARKERS OR BUBBLES ─────────────────────────────────────────────
    if (mapMode === 'markers' || mapMode === 'bubbles') {
      if (!markersLayerRef.current) return

      filteredProjects.forEach((p) => {
        const lat = p.latitud!
        const lng = p.longitud!
        const isSelected = selectedIndicador?.proyecto_id === p.proyecto_id
        const color = getMarkerColor(p)

        const radius = mapMode === 'bubbles'
          ? getBubbleRadius(p, isSelected)
          : (isSelected ? 11 : 7)

        const marker = L.circleMarker([lat, lng], {
          radius,
          fillColor: color,
          color: isSelected ? '#ffffff' : (isLight ? '#334155' : '#71717a'),
          weight: isSelected ? 3 : 1.5,
          opacity: 1,
          fillOpacity: mapMode === 'bubbles' ? 0.65 : 0.88,
        })

        // Popup Content
        const popupHtml = `
          <div style="padding: 12px 14px; min-width: 220px; font-family: 'Inter', sans-serif;">
            <div style="display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; margin-bottom: 6px;">
              <div style="font-weight: 700; font-size: 13px; color: ${popupText}; line-height: 1.25;">
                ${p.proyecto}
              </div>
              <span style="font-size: 9px; font-weight: 700; padding: 2px 6px; border-radius: 4px; background: rgba(255, 255, 255, 0.08); color: ${popupText}; border: 1px solid rgba(255, 255, 255, 0.15); white-space: nowrap;">
                ${p.etapa || 'En Curso'}
              </span>
            </div>

            <div style="font-size: 11px; color: ${popupSub}; margin-bottom: 10px; display: flex; align-items: center; gap: 4px;">
              <span>${p.ZONAS || 'Zona no especificada'}</span>
              ${p.SUBZONAS ? `<span style="opacity: 0.7;">• ${p.SUBZONAS}</span>` : ''}
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; background: ${metricsBg}; border: 1px solid ${metricsBorder}; border-radius: 6px; padding: 8px; margin-bottom: 10px;">
              <div>
                <div style="font-size: 9.5px; color: ${metricsTextMuted}; text-transform: uppercase;">Ritmo Venta</div>
                <div style="font-size: 12px; font-weight: 700; color: #10b981; font-family: 'JetBrains Mono', monospace;">
                  ${p.ritmo_venta != null ? `${Number(p.ritmo_venta).toFixed(1)} und/m` : '—'}
                </div>
              </div>
              <div>
                <div style="font-size: 9.5px; color: ${metricsTextMuted}; text-transform: uppercase;">Meses Stock</div>
                <div style="font-size: 12px; font-weight: 700; color: ${popupText}; font-family: 'JetBrains Mono', monospace;">
                  ${p.meses_stock != null ? `${Number(p.meses_stock).toFixed(1)} m` : '—'}
                </div>
              </div>
              <div>
                <div style="font-size: 9.5px; color: ${metricsTextMuted}; text-transform: uppercase;">Disponibles</div>
                <div style="font-size: 12px; font-weight: 700; color: ${popupText}; font-family: 'JetBrains Mono', monospace;">
                  ${p.und_por_vender ?? '—'} <span style="font-size: 9.5px; font-weight: 400; color: ${metricsTextMuted};">/ ${p.und_totales ?? '—'}</span>
                </div>
              </div>
              <div>
                <div style="font-size: 9.5px; color: ${metricsTextMuted}; text-transform: uppercase;">% Colocado</div>
                <div style="font-size: 12px; font-weight: 700; color: #9d9d9d; font-family: 'JetBrains Mono', monospace;">
                  ${p.pct_vendido != null ? `${(p.pct_vendido * 100).toFixed(0)}%` : '—'}
                </div>
              </div>
            </div>

            <button id="btn-select-${p.proyecto_id}" style="
              width: 100%;
              background: #252526;
              border: 1px solid #333842;
              color: #f3f3f3;
              font-size: 11px;
              font-weight: 600;
              padding: 6px 12px;
              border-radius: 4px;
              cursor: pointer;
              transition: all 0.15s;
              display: flex;
              align-items: center;
              justify-content: center;
              gap: 6px;
            ">
              <span>Analizar en Diagnóstico</span>
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
    }
  }, [filteredProjects, mapMode, colorMetric, bubbleMetric, heatmapMetric, selectedIndicador, theme])

  // 7. Handle QGIS Custom Layers Rendering
  useEffect(() => {
    if (!mapInstanceRef.current || !qgisLayerGroupRef.current || typeof L === 'undefined') return

    qgisLayerGroupRef.current.clearLayers()

    qgisLayers.forEach((l) => {
      if (!l.visible) return

      if (l.id === 'preloaded_scz') {
        // Render Preloaded Santa Cruz Polygons
        const geoLayer = L.geoJSON(PRELOADED_SCZ_ZONES, {
          style: () => ({
            color: l.color || '#38bdf8',
            weight: 2,
            opacity: 0.8,
            fillColor: l.color || '#38bdf8',
            fillOpacity: 0.18,
            dashArray: '4, 4',
          }),
          onEachFeature: (feature: any, layer: any) => {
            if (feature.properties) {
              layer.bindTooltip(
                `<strong>${feature.properties.name}</strong><br/><span style="font-size:10px; color:#9d9d9d">${feature.properties.tipo}</span>`,
                { sticky: true }
              )
            }
          },
        })
        qgisLayerGroupRef.current.addLayer(geoLayer)
      } else if (l.layerInstance) {
        qgisLayerGroupRef.current.addLayer(l.layerInstance)
      }
    })
  }, [qgisLayers])

  // Center on selectedIndicador if changed from outside
  useEffect(() => {
    if (!mapInstanceRef.current || !selectedIndicador) return
    if (selectedIndicador.latitud && selectedIndicador.longitud) {
      mapInstanceRef.current.flyTo([selectedIndicador.latitud, selectedIndicador.longitud], 15, { duration: 1.0 })
    }
  }, [selectedIndicador])

  // ─── QGIS Integration Functions ────────────────────────────────────────────

  // Import local GeoJSON/KML file
  const handleQgisFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || typeof L === 'undefined') return

    const reader = new FileReader()
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string
        const parsed = JSON.parse(text)

        const layerColor = ['#38bdf8', '#f59e0b', '#10b981', '#ec4899', '#8b5cf6'][qgisLayers.length % 5]
        const newGeoLayer = L.geoJSON(parsed, {
          style: () => ({
            color: layerColor,
            weight: 2,
            opacity: 0.9,
            fillColor: layerColor,
            fillOpacity: 0.22,
          }),
          onEachFeature: (feature: any, layer: any) => {
            const props = feature.properties || {}
            const title = props.name || props.nombre || props.id || 'Entidad QGIS'
            const details = Object.entries(props)
              .slice(0, 5)
              .map(([k, v]) => `<div><strong>${k}:</strong> ${v}</div>`)
              .join('')

            layer.bindPopup(`
              <div style="font-family: 'Inter', sans-serif; font-size: 11px; padding: 4px;">
                <div style="font-weight:700; font-size:12px; margin-bottom:4px;">${title}</div>
                ${details}
              </div>
            `)
          },
        })

        const count = parsed.features ? parsed.features.length : 1
        const newLayerItem: CustomQgisLayer = {
          id: `qgis_${Date.now()}`,
          name: file.name.replace(/\.[^/.]+$/, ''),
          type: 'geojson',
          visible: true,
          layerInstance: newGeoLayer,
          featureCount: count,
          color: layerColor,
        }

        setQgisLayers((prev) => [...prev, newLayerItem])

        // Fit map bounds to loaded layer
        if (mapInstanceRef.current && newGeoLayer.getBounds) {
          const bounds = newGeoLayer.getBounds()
          if (bounds.isValid()) {
            mapInstanceRef.current.fitBounds(bounds, { padding: [30, 30], maxZoom: 15 })
          }
        }
      } catch (err) {
        console.error('Error importing QGIS file:', err)
        alert('Error al leer el archivo GeoJSON/KML. Asegúrate de que sea un GeoJSON válido con proyección WGS84 (EPSG:4326).')
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  // Add custom WMS / XYZ Tile layer
  const handleAddWmsLayer = (e: React.FormEvent) => {
    e.preventDefault()
    if (!wmsUrl.trim() || typeof L === 'undefined') return

    try {
      const tileLayer = L.tileLayer(wmsUrl.trim(), {
        maxZoom: 19,
        opacity: 0.75,
      })

      const newLayerItem: CustomQgisLayer = {
        id: `wms_${Date.now()}`,
        name: wmsName.trim() || `Capa Web GIS (${qgisLayers.length + 1})`,
        type: 'wms',
        visible: true,
        layerInstance: tileLayer,
      }

      setQgisLayers((prev) => [...prev, newLayerItem])
      setWmsUrl('')
      setWmsName('')
    } catch (err) {
      console.error('Error adding WMS/XYZ layer:', err)
      alert('Error al inicializar la capa WMS/XYZ. Verifica que el URL sea correcto.')
    }
  }

  // Toggle visibility of a QGIS layer
  const toggleQgisLayer = (id: string) => {
    setQgisLayers((prev) =>
      prev.map((l) => (l.id === id ? { ...l, visible: !l.visible } : l))
    )
  }

  // Remove a QGIS layer
  const removeQgisLayer = (id: string) => {
    setQgisLayers((prev) => prev.filter((l) => l.id !== id))
  }

  // Export current dataset as GeoJSON ready for QGIS Desktop
  const exportToQgisGeoJson = () => {
    const featureCollection = {
      type: 'FeatureCollection',
      name: `citrino_${ciudad}_proyectos_qgis`,
      crs: {
        type: 'name',
        properties: { name: 'urn:ogc:def:crs:OGC:1.3:CRS84' },
      },
      features: filteredProjects.map((p) => ({
        type: 'Feature',
        properties: {
          id: p.proyecto_id,
          proyecto: p.proyecto,
          ciudad: p.ciudad,
          zona: p.ZONAS,
          subzona: p.SUBZONAS,
          etapa: p.etapa,
          ritmo_venta_mes: p.ritmo_venta,
          meses_stock: p.meses_stock,
          und_por_vender: p.und_por_vender,
          und_totales: p.und_totales,
          pct_vendido: p.pct_vendido,
          ticket_promedio: p.ticket_promedio,
        },
        geometry: {
          type: 'Point',
          coordinates: [p.longitud, p.latitud],
        },
      })),
    }

    const blob = new Blob([JSON.stringify(featureCollection, null, 2)], { type: 'application/geo+json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `citrino_qgis_${ciudad.toLowerCase()}_${Date.now()}.geojson`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="panel panel-center" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>
      {/* ─── Top Header & GIS Toolbar ────────────────────────────────────────── */}
      <div className="panel-header" style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '6px 14px',
        borderBottom: '1px solid var(--border-subtle)',
        background: 'var(--bg-base)',
        gap: 10,
        flexWrap: 'wrap',
      }}>
        {/* Left: Title & Count */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontWeight: 600, fontSize: 12, color: 'var(--text-primary)' }}>
            Vista Geoespacial GIS
          </span>
          <span style={{
            fontSize: 10,
            background: 'var(--bg-card)',
            color: 'var(--text-muted)',
            padding: '2px 8px',
            borderRadius: 4,
            border: '1px solid var(--border-subtle)',
            fontFamily: "'JetBrains Mono', monospace",
          }}>
            {filteredProjects.length} proyectos
          </span>
        </div>

        {/* Middle: Map Display Mode Switcher (Puntos / Burbujas / Mapa de Calor) */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          background: 'var(--bg-card)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 6,
          padding: 2,
          gap: 2,
        }}>
          <button
            onClick={() => setMapMode('markers')}
            title="Marcadores estándar con información métrica"
            style={{
              padding: '4px 9px',
              fontSize: 11,
              fontWeight: mapMode === 'markers' ? 600 : 500,
              background: mapMode === 'markers' ? 'var(--bg-active)' : 'transparent',
              color: mapMode === 'markers' ? 'var(--text-primary)' : 'var(--text-muted)',
              border: mapMode === 'markers' ? '1px solid var(--border-bright)' : '1px solid transparent',
              borderRadius: 4,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              transition: 'all 0.12s',
            }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>
            <span>Puntos</span>
          </button>

          <button
            onClick={() => setMapMode('bubbles')}
            title="Mapa de burbujas proporcionales a volumen o velocidad"
            style={{
              padding: '4px 9px',
              fontSize: 11,
              fontWeight: mapMode === 'bubbles' ? 600 : 500,
              background: mapMode === 'bubbles' ? 'var(--bg-active)' : 'transparent',
              color: mapMode === 'bubbles' ? 'var(--text-primary)' : 'var(--text-muted)',
              border: mapMode === 'bubbles' ? '1px solid var(--border-bright)' : '1px solid transparent',
              borderRadius: 4,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              transition: 'all 0.12s',
            }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/></svg>
            <span>Burbujas</span>
          </button>

          <button
            onClick={() => setMapMode('heatmap')}
            title="Mapa de calor térmico continuo de densidad"
            style={{
              padding: '4px 9px',
              fontSize: 11,
              fontWeight: mapMode === 'heatmap' ? 600 : 500,
              background: mapMode === 'heatmap' ? 'var(--bg-active)' : 'transparent',
              color: mapMode === 'heatmap' ? 'var(--text-primary)' : 'var(--text-muted)',
              border: mapMode === 'heatmap' ? '1px solid var(--border-bright)' : '1px solid transparent',
              borderRadius: 4,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              transition: 'all 0.12s',
            }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2c0 0-6 4.5-6 10a6 6 0 0 0 12 0c0-5.5-6-10-6-10z"/><path d="M12 18a2 2 0 0 0 2-2c0-1.5-2-3-2-3s-2 1.5-2 3a2 2 0 0 0 2 2z"/></svg>
            <span>Mapa de Calor</span>
          </button>
        </div>

        {/* Right: Dynamic Mode Filters & Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Mode: Markers / Bubbles Color Selector */}
          {(mapMode === 'markers' || mapMode === 'bubbles') && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text-muted)' }}>
              <span>Color:</span>
              <select
                value={colorMetric}
                onChange={(e) => setColorMetric(e.target.value as ColorMetric)}
                style={{
                  background: 'var(--bg-card)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--border-default)',
                  padding: '3px 8px',
                  borderRadius: 4,
                  fontSize: 11,
                  fontWeight: 500,
                  outline: 'none',
                  cursor: 'pointer',
                }}>
                <option value="meses_stock">Meses Stock (Riesgo)</option>
                <option value="ritmo_venta">Ritmo de Venta</option>
                <option value="etapa">Etapa de Obra</option>
              </select>
            </div>
          )}

          {/* Mode: Bubbles Size Selector */}
          {mapMode === 'bubbles' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text-muted)' }}>
              <span>Burbuja por:</span>
              <select
                value={bubbleMetric}
                onChange={(e) => setBubbleMetric(e.target.value as BubbleSizeMetric)}
                style={{
                  background: 'var(--bg-card)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--border-default)',
                  padding: '3px 8px',
                  borderRadius: 4,
                  fontSize: 11,
                  fontWeight: 500,
                  outline: 'none',
                  cursor: 'pointer',
                }}>
                <option value="und_por_vender">Stock en Oferta (Unds)</option>
                <option value="ritmo_venta">Ritmo de Venta (Unds/mes)</option>
                <option value="und_totales">Unidades Totales del Proyecto</option>
              </select>
            </div>
          )}

          {/* Mode: Heatmap Intensity Selector */}
          {mapMode === 'heatmap' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text-muted)' }}>
              <span>Densidad por:</span>
              <select
                value={heatmapMetric}
                onChange={(e) => setHeatmapMetric(e.target.value as HeatmapMetric)}
                style={{
                  background: 'var(--bg-card)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--border-default)',
                  padding: '3px 8px',
                  borderRadius: 4,
                  fontSize: 11,
                  fontWeight: 500,
                  outline: 'none',
                  cursor: 'pointer',
                }}>
                <option value="stock">Oferta Acumulada (Stock)</option>
                <option value="ritmo">Velocidad de Absorción (Ritmo)</option>
                <option value="densidad">Concentración de Proyectos</option>
              </select>
            </div>
          )}

          {/* QGIS Integration Panel Trigger */}
          <button
            onClick={() => setShowQgisPanel(!showQgisPanel)}
            title="Administrador de capas GIS y conexión con QGIS"
            style={{
              background: showQgisPanel ? 'var(--bg-active)' : 'var(--bg-card)',
              border: `1px solid ${showQgisPanel ? 'var(--border-bright)' : 'var(--border-default)'}`,
              color: showQgisPanel ? '#ffffff' : 'var(--text-primary)',
              padding: '4px 10px',
              borderRadius: 4,
              fontSize: 11,
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              transition: 'all 0.12s',
            }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <polygon points="12 2 2 7 12 12 22 7 12 2" />
              <polyline points="2 17 12 22 22 17" />
              <polyline points="2 12 12 17 22 12" />
            </svg>
            <span>Capas QGIS</span>
            {qgisLayers.filter((l) => l.visible).length > 0 && (
              <span style={{
                background: 'var(--text-primary)',
                color: 'var(--bg-base)',
                borderRadius: '50%',
                width: 15,
                height: 15,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 9.5,
                fontWeight: 700,
              }}>
                {qgisLayers.filter((l) => l.visible).length}
              </span>
            )}
          </button>

          {/* Project List Drawer Toggle */}
          <button
            onClick={() => setShowProjectList(!showProjectList)}
            style={{
              background: showProjectList ? 'var(--bg-active)' : 'var(--bg-card)',
              border: `1px solid ${showProjectList ? 'var(--border-bright)' : 'var(--border-default)'}`,
              color: showProjectList ? '#ffffff' : 'var(--text-secondary)',
              padding: '4px 10px',
              borderRadius: 4,
              fontSize: 11,
              fontWeight: 500,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 5,
            }}>
            <span>Lista ({filteredProjects.length})</span>
          </button>
        </div>
      </div>

      {/* ─── Main Map Canvas Area ────────────────────────────────────────────── */}
      <div style={{ flex: 1, position: 'relative', width: '100%', height: '100%' }}>
        <div ref={mapContainerRef} style={{ width: '100%', height: '100%', minHeight: 400 }} />

        {/* Loading Overlay */}
        {loading && (
          <div style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(24, 24, 24, 0.8)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            zIndex: 1000,
            backdropFilter: 'blur(3px)',
          }}>
            <div className="loading-shimmer" style={{ width: 140, height: 16 }} />
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Cargando motor geoespacial...</div>
          </div>
        )}

        {/* Search Overlay floating over Map */}
        <div style={{
          position: 'absolute',
          top: 14,
          left: 14,
          zIndex: 800,
          background: 'var(--bg-panel)',
          backdropFilter: 'blur(10px)',
          border: '1px solid var(--border-default)',
          borderRadius: 6,
          boxShadow: 'var(--shadow-panel)',
          display: 'flex',
          alignItems: 'center',
          padding: '5px 10px',
          width: 250,
        }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" style={{ marginRight: 6, opacity: 0.7 }}>
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            placeholder="Buscar proyecto o zona..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-primary)',
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

        {/* ─── Floating Legend (Dynamic according to Map Mode) ──────────────── */}
        <div style={{
          position: 'absolute',
          bottom: 24,
          left: 14,
          zIndex: 800,
          background: 'var(--bg-panel)',
          backdropFilter: 'blur(10px)',
          border: '1px solid var(--border-default)',
          borderRadius: 6,
          padding: '8px 12px',
          boxShadow: 'var(--shadow-panel)',
          fontSize: 10.5,
          minWidth: 170,
        }}>
          {/* Mode: Heatmap Legend */}
          {mapMode === 'heatmap' && (
            <div>
              <div style={{ fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 6, textTransform: 'uppercase', fontSize: 9.5, letterSpacing: 0.5 }}>
                Gradiente Térmico ({heatmapMetric === 'stock' ? 'Oferta' : heatmapMetric === 'ritmo' ? 'Velocidad' : 'Densidad'})
              </div>
              <div style={{
                height: 8,
                borderRadius: 4,
                background: 'linear-gradient(to right, #2563eb 0%, #06b6d4 25%, #10b981 50%, #f59e0b 75%, #ef4444 100%)',
                marginBottom: 4,
              }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9.5, color: 'var(--text-muted)' }}>
                <span>Baja</span>
                <span>Media</span>
                <span>Muy Alta</span>
              </div>
            </div>
          )}

          {/* Mode: Bubble Scale Legend */}
          {mapMode === 'bubbles' && (
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 6, textTransform: 'uppercase', fontSize: 9.5, letterSpacing: 0.5 }}>
                Escala de Burbuja ({bubbleMetric === 'und_por_vender' ? 'Unds Stock' : bubbleMetric === 'ritmo_venta' ? 'Unds/mes' : 'Unds Totales'})
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '4px 0' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', border: '1px solid var(--text-primary)', opacity: 0.7 }} />
                  <span style={{ fontSize: 9.5, color: 'var(--text-muted)' }}>Menor</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <div style={{ width: 18, height: 18, borderRadius: '50%', border: '1px solid var(--text-primary)', opacity: 0.7 }} />
                  <span style={{ fontSize: 9.5, color: 'var(--text-muted)' }}>Medio</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <div style={{ width: 26, height: 26, borderRadius: '50%', border: '1px solid var(--text-primary)', opacity: 0.7 }} />
                  <span style={{ fontSize: 9.5, color: 'var(--text-muted)' }}>Mayor</span>
                </div>
              </div>
              <div style={{ height: 1, background: 'var(--border-subtle)', margin: '6px 0' }} />
            </div>
          )}

          {/* Color Categories Legend (Markers or Bubbles) */}
          {(mapMode === 'markers' || mapMode === 'bubbles') && (
            <div>
              <div style={{ fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 6, textTransform: 'uppercase', fontSize: 9.5, letterSpacing: 0.5 }}>
                {colorMetric === 'meses_stock' && 'Meses de Stock (Riesgo)'}
                {colorMetric === 'ritmo_venta' && 'Ritmo de Venta (und/mes)'}
                {colorMetric === 'etapa' && 'Etapas de Construcción'}
              </div>

              {colorMetric === 'meses_stock' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ width: 10, height: 10, borderRadius: 2, background: '#10b981' }} />
                    <span style={{ color: 'var(--text-primary)' }}>&lt; 12 meses (Alta rotación)</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ width: 10, height: 10, borderRadius: 2, background: '#94a3b8' }} />
                    <span style={{ color: 'var(--text-primary)' }}>12 - 18 meses (Equilibrado)</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ width: 10, height: 10, borderRadius: 2, background: '#f59e0b' }} />
                    <span style={{ color: 'var(--text-primary)' }}>18 - 24 meses (Presión moderada)</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ width: 10, height: 10, borderRadius: 2, background: '#ef4444' }} />
                    <span style={{ color: 'var(--text-primary)' }}>&gt; 24 meses (Sobreoferta)</span>
                  </div>
                </div>
              )}

              {colorMetric === 'ritmo_venta' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ width: 10, height: 10, borderRadius: 2, background: '#10b981' }} />
                    <span style={{ color: 'var(--text-primary)' }}>&gt; 2.0 und/mes (Rápido)</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ width: 10, height: 10, borderRadius: 2, background: '#94a3b8' }} />
                    <span style={{ color: 'var(--text-primary)' }}>1.0 - 2.0 und/mes (Medio)</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ width: 10, height: 10, borderRadius: 2, background: '#f59e0b' }} />
                    <span style={{ color: 'var(--text-primary)' }}>0.4 - 1.0 und/mes (Lento)</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ width: 10, height: 10, borderRadius: 2, background: '#ef4444' }} />
                    <span style={{ color: 'var(--text-primary)' }}>&lt; 0.4 und/mes (Crítico)</span>
                  </div>
                </div>
              )}

              {colorMetric === 'etapa' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ width: 10, height: 10, borderRadius: 2, background: '#71717a' }} />
                    <span style={{ color: 'var(--text-primary)' }}>Obra bruta / fina</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ width: 10, height: 10, borderRadius: 2, background: '#a1a1aa' }} />
                    <span style={{ color: 'var(--text-primary)' }}>En Pozo</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ width: 10, height: 10, borderRadius: 2, background: '#d4d4d8' }} />
                    <span style={{ color: 'var(--text-primary)' }}>Preventa temprana</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ width: 10, height: 10, borderRadius: 2, background: '#10b981' }} />
                    <span style={{ color: 'var(--text-primary)' }}>Terminada / Entrega</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ─── QGIS Layers Drawer Panel ────────────────────────────────────────── */}
        {showQgisPanel && (
          <div style={{
            position: 'absolute',
            top: 0,
            right: showProjectList ? 290 : 0,
            bottom: 0,
            width: 320,
            background: 'var(--bg-surface)',
            borderLeft: '1px solid var(--border-subtle)',
            zIndex: 860,
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '-10px 0 30px rgba(0, 0, 0, 0.65)',
            animation: 'dropdownFadeIn 0.15s ease-out',
          }}>
            {/* Header */}
            <div style={{
              padding: '12px 14px',
              borderBottom: '1px solid var(--border-subtle)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'var(--bg-base)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polygon points="12 2 2 7 12 12 22 7 12 2" />
                  <polyline points="2 17 12 22 22 17" />
                  <polyline points="2 12 12 17 22 12" />
                </svg>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>
                  Integración QGIS & Capas GIS
                </span>
              </div>
              <button
                onClick={() => setShowQgisPanel(false)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 13 }}>
                ✕
              </button>
            </div>

            {/* Content Body */}
            <div style={{ flex: 1, overflowY: 'auto', padding: 14, display: 'flex', flexDirection: 'column', gap: 16 }}>

              {/* SECTION 1: Basemap Selector */}
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: 8 }}>
                  Mapa Base (Basemap)
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                  {(['dark', 'satellite', 'streets', 'light'] as BasemapType[]).map((bm) => (
                    <button
                      key={bm}
                      onClick={() => setBasemap(bm)}
                      style={{
                        padding: '6px 8px',
                        fontSize: 10.5,
                        fontWeight: basemap === bm ? 600 : 400,
                        background: basemap === bm ? 'var(--bg-card)' : 'var(--bg-base)',
                        border: `1px solid ${basemap === bm ? 'var(--border-bright)' : 'var(--border-subtle)'}`,
                        color: basemap === bm ? 'var(--text-primary)' : 'var(--text-muted)',
                        borderRadius: 4,
                        cursor: 'pointer',
                        textAlign: 'center',
                        textTransform: 'capitalize',
                      }}>
                      {bm === 'dark' && 'Oscuro'}
                      {bm === 'satellite' && 'Satélite'}
                      {bm === 'streets' && 'Calles'}
                      {bm === 'light' && 'Claro'}
                    </button>
                  ))}
                </div>
              </div>

              {/* SECTION 2: Active QGIS Layers list */}
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>Capas Vectoriales Activas</span>
                  <span style={{ fontSize: 9.5, color: 'var(--text-muted)' }}>{qgisLayers.length} disponibles</span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {qgisLayers.map((l) => (
                    <div
                      key={l.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '8px 10px',
                        background: 'var(--bg-card)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: 6,
                        fontSize: 11,
                      }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', flex: 1, overflow: 'hidden' }}>
                        <input
                          type="checkbox"
                          checked={l.visible}
                          onChange={() => toggleQgisLayer(l.id)}
                          style={{ cursor: 'pointer' }}
                        />
                        <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                          <span style={{ fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {l.name}
                          </span>
                          <span style={{ fontSize: 9.5, color: 'var(--text-muted)' }}>
                            {l.featureCount != null ? `${l.featureCount} entidades` : l.type.toUpperCase()}
                          </span>
                        </div>
                      </label>

                      {l.id !== 'preloaded_scz' && (
                        <button
                          onClick={() => removeQgisLayer(l.id)}
                          title="Eliminar capa"
                          style={{ background: 'transparent', border: 'none', color: '#fda4af', cursor: 'pointer', padding: 2 }}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* SECTION 3: Import GeoJSON / KML from QGIS */}
              <div style={{
                padding: 12,
                background: 'var(--bg-card)',
                border: '1px dashed var(--border-bright)',
                borderRadius: 6,
                textAlign: 'center',
              }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>
                  Importar Capa de QGIS (GeoJSON / KML)
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 10, lineHeight: 1.4 }}>
                  Carga polígonos de zonificación, avenidas o áreas de influencia exportadas desde QGIS Desktop.
                </div>
                <label style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  background: 'var(--bg-active)',
                  border: '1px solid var(--border-default)',
                  color: 'var(--text-primary)',
                  padding: '6px 14px',
                  borderRadius: 4,
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                  <span>Seleccionar Archivo</span>
                  <input
                    type="file"
                    accept=".geojson,.json,.kml"
                    onChange={handleQgisFileUpload}
                    style={{ display: 'none' }}
                  />
                </label>
              </div>

              {/* SECTION 4: Connect WMS / XYZ Web GIS Service */}
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: 8 }}>
                  Conectar Servicio Web GIS (WMS / XYZ)
                </div>
                <form onSubmit={handleAddWmsLayer} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <input
                    type="text"
                    placeholder="Nombre (ej: Catastro Municipal)"
                    value={wmsName}
                    onChange={(e) => setWmsName(e.target.value)}
                    style={{
                      background: 'var(--bg-input, #1f1f1f)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 4,
                      padding: '6px 10px',
                      fontSize: 11,
                      color: 'var(--text-primary)',
                      outline: 'none',
                    }}
                  />
                  <input
                    type="url"
                    placeholder="URL del Tile Server {z}/{x}/{y}.png"
                    value={wmsUrl}
                    onChange={(e) => setWmsUrl(e.target.value)}
                    style={{
                      background: 'var(--bg-input, #1f1f1f)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 4,
                      padding: '6px 10px',
                      fontSize: 11,
                      color: 'var(--text-primary)',
                      outline: 'none',
                    }}
                  />
                  <button
                    type="submit"
                    disabled={!wmsUrl.trim()}
                    style={{
                      background: wmsUrl.trim() ? 'var(--bg-card)' : 'transparent',
                      border: '1px solid var(--border-default)',
                      color: wmsUrl.trim() ? 'var(--text-primary)' : 'var(--text-muted)',
                      padding: '6px 10px',
                      borderRadius: 4,
                      fontSize: 11,
                      fontWeight: 600,
                      cursor: wmsUrl.trim() ? 'pointer' : 'not-allowed',
                    }}>
                    Añadir Capa WMS / XYZ
                  </button>
                </form>
              </div>

              {/* SECTION 5: Export to QGIS Desktop */}
              <div style={{
                marginTop: 'auto',
                paddingTop: 14,
                borderTop: '1px solid var(--border-subtle)',
              }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>
                  Exportar a QGIS Desktop
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 10 }}>
                  Descarga un archivo GeoJSON con todos los {filteredProjects.length} proyectos y atributos para abrir en QGIS con un clic.
                </div>
                <button
                  onClick={exportToQgisGeoJson}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    background: '#f3f3f3',
                    color: '#181818',
                    border: 'none',
                    borderRadius: 4,
                    fontSize: 11.5,
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    transition: 'all 0.15s ease',
                  }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                  <span>Exportar Capa GeoJSON</span>
                </button>
              </div>

            </div>
          </div>
        )}

        {/* ─── Collapsible Project Quick List Sidebar ──────────────────────────── */}
        {showProjectList && (
          <div style={{
            position: 'absolute',
            top: 0,
            right: 0,
            bottom: 0,
            width: 290,
            background: 'var(--bg-surface)',
            borderLeft: '1px solid var(--border-subtle)',
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
              background: 'var(--bg-base)',
            }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Proyectos ({filteredProjects.length})
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
                      borderRadius: 4,
                      background: isSelected ? 'var(--bg-active)' : 'var(--bg-card)',
                      border: `1px solid ${isSelected ? 'var(--border-bright)' : 'var(--border-subtle)'}`,
                      cursor: 'pointer',
                      transition: 'all 0.12s',
                    }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, marginBottom: 3 }}>
                      <span style={{ fontWeight: 600, fontSize: 11.5, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {p.proyecto}
                      </span>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-muted)' }}>
                      <span>{p.ZONAS || '—'}</span>
                      <span style={{ fontFamily: "'JetBrains Mono', monospace", color: 'var(--text-primary)' }}>
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
