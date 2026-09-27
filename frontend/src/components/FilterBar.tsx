import { useState, useEffect } from 'react'
import {
  fetchZonas,
  fetchSubzonas,
  fetchTiposInmueble,
  fetchEtapas,
  fetchTipologias,
} from '../lib/supabase'
import './FilterBar.css'

interface FilterBarProps {
  ciudad: string
  zonaFilter: string
  subzonaFilter: string
  tipoInmuebleFilter: string
  etapaFilter: string
  tipologiaFilter: string
  onZonaChange: (v: string) => void
  onSubzonaChange: (v: string) => void
  onTipoInmuebleChange: (v: string) => void
  onEtapaChange: (v: string) => void
  onTipologiaChange: (v: string) => void
  onClear: () => void
}

export default function FilterBar({
  ciudad,
  zonaFilter,
  subzonaFilter,
  tipoInmuebleFilter,
  etapaFilter,
  tipologiaFilter,
  onZonaChange,
  onSubzonaChange,
  onTipoInmuebleChange,
  onEtapaChange,
  onTipologiaChange,
  onClear,
}: FilterBarProps) {
  const [zonas, setZonas] = useState<string[]>([])
  const [subzonas, setSubzonas] = useState<string[]>([])
  const [tipos, setTipos] = useState<string[]>([])
  const [etapas, setEtapas] = useState<string[]>([])
  const [tipologias, setTipologias] = useState<string[]>([])

  // Reload zona list when city changes
  useEffect(() => {
    fetchZonas(ciudad).then(setZonas).catch(() => setZonas([]))
    fetchTiposInmueble(ciudad).then(setTipos).catch(() => setTipos([]))
    fetchEtapas(ciudad).then(setEtapas).catch(() => setEtapas([]))
    fetchTipologias().then(setTipologias).catch(() => setTipologias([]))
  }, [ciudad])

  // Reload subzonas when zona changes
  useEffect(() => {
    fetchSubzonas(ciudad, zonaFilter).then(setSubzonas).catch(() => setSubzonas([]))
    onSubzonaChange('ALL') // reset subzona when zona changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ciudad, zonaFilter])

  const hasActiveFilters =
    zonaFilter !== 'ALL' ||
    subzonaFilter !== 'ALL' ||
    tipoInmuebleFilter !== 'ALL' ||
    etapaFilter !== 'ALL' ||
    tipologiaFilter !== 'ALL'

  return (
    <div className="filter-bar" role="toolbar" aria-label="Filtros globales">
      <div className="filter-bar-label" title="Filtros" aria-label="Filtros">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
        </svg>
      </div>

      <div className="filter-bar-selects">
        {/* Zona */}
        <div className="filter-select-wrapper">
          <label className="filter-select-label" htmlFor="filter-zona">Zona</label>
          <select
            id="filter-zona"
            className={`filter-select ${zonaFilter !== 'ALL' ? 'active' : ''}`}
            value={zonaFilter}
            onChange={(e) => onZonaChange(e.target.value)}
          >
            <option value="ALL">Todas las zonas</option>
            {zonas.map((z) => (
              <option key={z} value={z}>{z}</option>
            ))}
          </select>
        </div>

        {/* Subzona */}
        <div className="filter-select-wrapper">
          <label className="filter-select-label" htmlFor="filter-subzona">Subzona</label>
          <select
            id="filter-subzona"
            className={`filter-select ${subzonaFilter !== 'ALL' ? 'active' : ''}`}
            value={subzonaFilter}
            onChange={(e) => onSubzonaChange(e.target.value)}
            disabled={zonaFilter === 'ALL' && subzonas.length === 0}
          >
            <option value="ALL">Todas las subzonas</option>
            {subzonas.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>

        {/* Tipo Inmueble */}
        <div className="filter-select-wrapper">
          <label className="filter-select-label" htmlFor="filter-tipo">Tipo Inmueble</label>
          <select
            id="filter-tipo"
            className={`filter-select ${tipoInmuebleFilter !== 'ALL' ? 'active' : ''}`}
            value={tipoInmuebleFilter}
            onChange={(e) => onTipoInmuebleChange(e.target.value)}
          >
            <option value="ALL">Todos los tipos</option>
            {tipos.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>

        {/* Etapa */}
        <div className="filter-select-wrapper">
          <label className="filter-select-label" htmlFor="filter-etapa">Etapa</label>
          <select
            id="filter-etapa"
            className={`filter-select ${etapaFilter !== 'ALL' ? 'active' : ''}`}
            value={etapaFilter}
            onChange={(e) => onEtapaChange(e.target.value)}
          >
            <option value="ALL">Todas las etapas</option>
            {etapas.map((e) => (
              <option key={e} value={e}>{e}</option>
            ))}
          </select>
        </div>

        {/* Tipología */}
        <div className="filter-select-wrapper">
          <label className="filter-select-label" htmlFor="filter-tipologia">Tipología</label>
          <select
            id="filter-tipologia"
            className={`filter-select ${tipologiaFilter !== 'ALL' ? 'active' : ''}`}
            value={tipologiaFilter}
            onChange={(e) => onTipologiaChange(e.target.value)}
          >
            <option value="ALL">Todas las tipologías</option>
            {tipologias.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Limpiar filtros */}
      <button
        type="button"
        className={`filter-clear-btn ${hasActiveFilters ? 'has-filters' : ''}`}
        onClick={onClear}
        aria-label="Limpiar todos los filtros"
        title="Limpiar filtros"
        disabled={!hasActiveFilters}
      >
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"/>
          <line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
        Limpiar filtros
      </button>
    </div>
  )
}
