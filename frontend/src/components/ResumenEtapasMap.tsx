import { useEffect, useRef, useMemo } from 'react'
import type { IndicadorFull } from '../lib/supabase'

declare const L: any

interface StageItem {
  id: string
  name: string
  count: number
  pct: number
  color: string
}

interface Props {
  projects: IndicadorFull[]
  ciudad: string
  selectedStage: string | null
  onSelectStage: (stage: string | null) => void
  stageItems: StageItem[]
  theme?: 'dark' | 'light'
  onSelectIndicador?: (ind: IndicadorFull | null) => void
  selectedIndicador?: IndicadorFull | null
}

const CITY_COORDS: Record<string, { center: [number, number]; zoom: number }> = {
  SCZ: { center: [-17.7833, -63.1821], zoom: 12 },
  LPZ: { center: [-16.5000, -68.1250], zoom: 13 },
  CBB: { center: [-17.3895, -66.1568], zoom: 13 },
  ALL: { center: [-17.0000, -64.5000], zoom: 6 },
}

const BASEMAP_URLS = {
  dark: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ',
    maxZoom: 16,
  },
  light: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ',
    maxZoom: 16,
  },
}

export function getProjectResumenStage(etapa?: string | null): string {
  const s = (etapa || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim()
  if (s.includes('clandestin') || s.includes('paraliz') || s.includes('inactiv') || s.includes('suspend') || s.includes('detenid')) {
    return 'Inactivos'
  }
  if (s.includes('vendid') || s.includes('agotad')) {
    return 'Vendida'
  }
  if (s.includes('preventa') || s.includes('pozo') || s.includes('lanzamiento')) {
    return 'Preventa'
  }
  if (s.includes('bruta') || s.includes('gruesa') || s.includes('estructura')) {
    return 'Obra bruta'
  }
  if (s.includes('fina') || s.includes('acabad')) {
    return 'Obra fina'
  }
  if (s.includes('terminad') || s.includes('entrega')) {
    return 'Terminada'
  }
  return 'Preventa'
}

export default function ResumenEtapasMap({
  projects,
  ciudad,
  selectedStage,
  onSelectStage,
  stageItems,
  theme = 'light',
  onSelectIndicador,
  selectedIndicador,
}: Props) {
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<any>(null)
  const tileLayerRef = useRef<any>(null)
  const markersLayerRef = useRef<any>(null)

  const isDark = theme === 'dark'

  // Map of stage colors
  const stageColorMap = useMemo(() => {
    const map = new Map<string, string>()
    stageItems.forEach((s) => map.set(s.name, s.color))
    return map
  }, [stageItems])

  // Filter projects with valid coordinates
  const geolocatedProjects = useMemo(() => {
    return projects.filter((p) => {
      if (p.latitud == null || p.longitud == null || isNaN(p.latitud) || isNaN(p.longitud)) {
        return false
      }
      return p.latitud >= -25 && p.latitud <= -9 && p.longitud >= -72 && p.longitud <= -55
    })
  }, [projects])

  // Count projects matching selected stage
  const visibleCount = useMemo(() => {
    if (!selectedStage) return geolocatedProjects.length
    return geolocatedProjects.filter((p) => getProjectResumenStage(p.etapa) === selectedStage).length
  }, [geolocatedProjects, selectedStage])

  // 1. Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current) return
    if (typeof L === 'undefined') {
      console.warn('Leaflet (L) is not loaded')
      return
    }

    if (mapInstanceRef.current) return

    const cityConfig = CITY_COORDS[ciudad] || CITY_COORDS.SCZ
    const map = L.map(mapContainerRef.current, {
      center: cityConfig.center,
      zoom: cityConfig.zoom,
      zoomControl: false,
      attributionControl: false,
    })

    // Add minimal zoom control in top-right
    L.control.zoom({ position: 'topright' }).addTo(map)

    // Base Tile Layer
    const basemapConfig = isDark ? BASEMAP_URLS.dark : BASEMAP_URLS.light
    const tiles = L.tileLayer(basemapConfig.url, {
      attribution: basemapConfig.attribution,
      maxZoom: basemapConfig.maxZoom,
    }).addTo(map)
    tileLayerRef.current = tiles

    // Markers layer group
    const markersGroup = L.layerGroup().addTo(map)
    markersLayerRef.current = markersGroup

    mapInstanceRef.current = map

    // Ensure map tiles render properly after mount
    setTimeout(() => {
      map.invalidateSize()
    }, 200)

    return () => {
      map.remove()
      mapInstanceRef.current = null
      markersLayerRef.current = null
      tileLayerRef.current = null
    }
  }, [])

  // 2. Update basemap when theme changes
  useEffect(() => {
    if (!tileLayerRef.current) return
    const basemapConfig = isDark ? BASEMAP_URLS.dark : BASEMAP_URLS.light
    tileLayerRef.current.setUrl(basemapConfig.url)
  }, [isDark])

  // 3. Update view when ciudad changes
  useEffect(() => {
    if (!mapInstanceRef.current) return
    const cityConfig = CITY_COORDS[ciudad] || CITY_COORDS.SCZ
    mapInstanceRef.current.flyTo(cityConfig.center, cityConfig.zoom, { duration: 1.0 })
  }, [ciudad])

  // 4. Render Markers and handle Selection
  useEffect(() => {
    if (!mapInstanceRef.current || !markersLayerRef.current || typeof L === 'undefined') return

    markersLayerRef.current.clearLayers()

    const matchingBounds: [number, number][] = []

    geolocatedProjects.forEach((p) => {
      const lat = p.latitud!
      const lng = p.longitud!
      const stageName = getProjectResumenStage(p.etapa)
      const stageColor = stageColorMap.get(stageName) || '#a1a1aa'

      const isSelectedStage = selectedStage == null || selectedStage === stageName
      const isSelectedProject = selectedIndicador?.proyecto_id === p.proyecto_id

      if (selectedStage != null && stageName === selectedStage) {
        matchingBounds.push([lat, lng])
      }

      // Visual styling based on selection
      const hasStageFilter = selectedStage != null
      const radius = isSelectedProject ? 10 : isSelectedStage ? 7 : 4
      const fillOpacity = isSelectedProject ? 1.0 : isSelectedStage ? (hasStageFilter ? 0.95 : 0.85) : 0.15
      const strokeColor = isSelectedProject
        ? '#ffffff'
        : isSelectedStage
        ? (isDark ? '#0f172a' : '#ffffff')
        : 'transparent'
      const strokeWidth = isSelectedProject ? 3 : isSelectedStage ? 1.5 : 0
      const fillColor = isSelectedStage ? stageColor : (isDark ? '#52525b' : '#a1a1aa')

      const marker = L.circleMarker([lat, lng], {
        radius,
        fillColor,
        color: strokeColor,
        weight: strokeWidth,
        opacity: isSelectedStage ? 1 : 0.25,
        fillOpacity,
      })

      // Hover Tooltip
      marker.bindTooltip(
        `<div style="font-family:Inter,sans-serif;font-size:11px;padding:2px 4px;">
          <b style="color:${stageColor}">${p.proyecto}</b><br/>
          <span style="color:${isDark ? '#94a3b8' : '#64748b'}">${stageName} · ${p.ZONAS || 'Sin Zona'}</span>
        </div>`,
        { direction: 'top', offset: [0, -6], opacity: 0.95 }
      )

      // Click Popup
      const popupHtml = `
        <div style="padding:10px 12px;min-width:210px;font-family:Inter,sans-serif;color:${isDark ? '#f1f5f9' : '#0f172a'};">
          <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;margin-bottom:6px;">
            <div style="font-weight:700;font-size:12.5px;line-height:1.25;">
              ${p.proyecto}
            </div>
            <span style="font-size:9.5px;font-weight:700;padding:2px 6px;border-radius:4px;background:${stageColor}22;color:${stageColor};border:1px solid ${stageColor}66;white-space:nowrap;">
              ${stageName}
            </span>
          </div>
          <div style="font-size:10.5px;color:${isDark ? '#94a3b8' : '#64748b'};margin-bottom:8px;">
            ${p.ZONAS || 'Sin Zona'}${p.SUBZONAS ? ` · ${p.SUBZONAS}` : ''}
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;background:${isDark ? '#141414' : '#f8fafc'};border:1px solid ${isDark ? '#2b2d30' : '#cbd5e1'};border-radius:6px;padding:6px 8px;margin-bottom:8px;font-size:10px;">
            <div>
              <span style="color:#9d9d9d;">Disponibles:</span>
              <strong style="display:block;font-size:11.5px;color:${isDark ? '#f1f5f9' : '#0f172a'}">${p.und_por_vender ?? '—'} unds</strong>
            </div>
            <div>
              <span style="color:#9d9d9d;">Vendidas:</span>
              <strong style="display:block;font-size:11.5px;color:#10b981">${p.und_vendidas ?? '—'} unds</strong>
            </div>
            <div>
              <span style="color:#9d9d9d;">Ritmo:</span>
              <strong style="display:block;font-size:11px;color:${isDark ? '#f1f5f9' : '#0f172a'}">${p.ritmo_venta != null ? `${Number(p.ritmo_venta).toFixed(1)} und/m` : '—'}</strong>
            </div>
            <div>
              <span style="color:#9d9d9d;">Total:</span>
              <strong style="display:block;font-size:11px;color:${isDark ? '#f1f5f9' : '#0f172a'}">${p.und_totales ?? '—'} unds</strong>
            </div>
          </div>
          <button id="resumen-popup-select-${p.proyecto_id}" style="
            width:100%;
            background:#1565c0;
            border:none;
            border-radius:4px;
            color:#ffffff;
            font-size:10.5px;
            font-weight:600;
            padding:5px 0;
            cursor:pointer;
          ">
            Ver detalle de proyecto
          </button>
        </div>
      `

      marker.bindPopup(popupHtml, { maxWidth: 280 })

      marker.on('popupopen', () => {
        const btn = document.getElementById(`resumen-popup-select-${p.proyecto_id}`)
        if (btn && onSelectIndicador) {
          btn.onclick = () => onSelectIndicador(p)
        }
      })

      marker.addTo(markersLayerRef.current)
    })

    // Smoothly fit bounds when a stage is selected
    if (selectedStage != null && matchingBounds.length > 0) {
      mapInstanceRef.current.fitBounds(L.latLngBounds(matchingBounds), {
        padding: [35, 35],
        maxZoom: 14,
        duration: 0.8,
      })
    } else if (selectedStage == null) {
      const cityConfig = CITY_COORDS[ciudad] || CITY_COORDS.SCZ
      mapInstanceRef.current.flyTo(cityConfig.center, cityConfig.zoom, { duration: 0.8 })
    }
  }, [geolocatedProjects, selectedStage, stageColorMap, isDark, selectedIndicador, onSelectIndicador, ciudad])

  // Center Map Button Handler
  const handleRecenter = () => {
    if (!mapInstanceRef.current) return
    const cityConfig = CITY_COORDS[ciudad] || CITY_COORDS.SCZ
    mapInstanceRef.current.flyTo(cityConfig.center, cityConfig.zoom, { duration: 0.8 })
  }

  return (
    <div style={{
      background: 'var(--bg-card)',
      border: '1px solid var(--border-subtle)',
      borderRadius: 'var(--radius-md)',
      padding: '12px 14px 8px',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      minHeight: 0,
      height: '100%',
      position: 'relative',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
            Localización por Etapa
          </span>
          <span style={{
            fontSize: 10,
            fontWeight: 600,
            background: isDark ? 'rgba(161, 161, 170, 0.12)' : 'rgba(161, 161, 170, 0.18)',
            color: isDark ? '#cbd5e1' : '#475569',
            padding: '1px 6px',
            borderRadius: 10,
          }}>
            {visibleCount} geolocalizados
          </span>
        </div>

        {selectedStage ? (
          <button
            type="button"
            onClick={() => onSelectStage(null)}
            style={{
              background: 'var(--bg-hover)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 12,
              padding: '2px 8px',
              fontSize: 10.5,
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}
            title="Hacer clic para ver todas las etapas">
            ✕ {selectedStage} (Ver todas)
          </button>
        ) : (
          <button
            type="button"
            onClick={handleRecenter}
            style={{
              background: 'transparent',
              color: 'var(--text-muted)',
              border: 'none',
              fontSize: 10.5,
              fontWeight: 500,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              padding: '2px 4px',
            }}
            title="Centrar mapa en la ciudad activa">
            ⌖ Recentrar
          </button>
        )}
      </div>

      <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginBottom: 6 }}>
        {selectedStage
          ? `Visualizando oferta de la etapa "${selectedStage}" sobre el plano urbano`
          : 'Puntos de proyectos censados clasificados y codificados por etapa'}
      </div>

      {/* Leaflet Map Canvas */}
      <div style={{
        flex: 1,
        minHeight: 220,
        width: '100%',
        borderRadius: 6,
        overflow: 'hidden',
        border: '1px solid var(--border-subtle)',
        position: 'relative',
      }}>
        <div
          ref={mapContainerRef}
          style={{ height: '100%', width: '100%', background: isDark ? '#091b22' : '#f8fafc' }}
        />
      </div>

      {/* Stage Legend Selector */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'center',
        gap: '4px 10px',
        paddingTop: 6,
        marginTop: 6,
        borderTop: '1px solid var(--border-subtle)',
      }}>
        {stageItems.map((s) => {
          const isSel = selectedStage === s.name
          return (
            <button
              key={s.name}
              type="button"
              onClick={() => onSelectStage(isSel ? null : s.name)}
              style={{
                background: isSel ? 'var(--bg-hover)' : 'transparent',
                border: isSel ? '1px solid var(--border-subtle)' : '1px solid transparent',
                borderRadius: 4,
                padding: '2px 6px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                fontSize: 10.5,
                color: isSel ? 'var(--text-primary)' : 'var(--text-secondary)',
                fontWeight: isSel ? 700 : 500,
                transition: 'all 0.15s ease',
              }}>
              <span style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: s.color,
                display: 'inline-block',
                boxShadow: isSel ? `0 0 6px ${s.color}` : 'none',
              }} />
              <span>{s.name}</span>
              <span style={{ color: 'var(--text-muted)', fontSize: 10 }}>({s.count})</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
