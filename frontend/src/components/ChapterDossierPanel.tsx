import React from 'react'
import './ChapterDossierPanel.css'

export interface ChapterDetails {
  id: string
  title: string
  subtitle: string
  sectionTitle: string
  description: string
  features: string[]
  metrics?: { label: string; value: string; note: string }[]
}

export const CHAPTER_REGISTRY: Record<string, ChapterDetails> = {
  '1.3': {
    id: '1.3',
    title: 'Cuantificación de la Oferta de Particulares',
    subtitle: 'Mercado Secundario y Reventa Inmobiliaria',
    sectionTitle: 'Análisis de Mercado',
    description: 'Monitoreo de propiedades ofrecidas por particulares, brokers y portales clasificados en Santa Cruz, La Paz y Cochabamba. Permite cuantificar el stock de reventa compitiendo directamente con la oferta nueva.',
    features: [
      'Comparativa de precios de reventa ($US/m²) vs oferta nueva a estrenar',
      'Inventario secundario clasificado por zona urbana y tipología',
      'Tiempo medio de publicación y velocidad de absorción entre particulares',
      'Margen de negociación real entre precio de oferta y precio de cierre',
    ],
    metrics: [
      { label: 'Fuentes mapeadas', value: '4 portales + 25 redes', note: 'Actualización semanal' },
      { label: 'Brecha de precio est.', value: '-12% a -18%', note: 'Reventa vs Oferta Nueva' },
      { label: 'Tiempo medio mercado', value: '8.4 meses', note: 'Promedio nacional de reventa' },
    ],
  },
  '1.4': {
    id: '1.4',
    title: 'Bienes Adjudicados',
    subtitle: 'Activos Recuperados y Remates del Sistema Financiero',
    sectionTitle: 'Análisis de Mercado',
    description: 'Seguimiento institucional de inmuebles adjudicados y en proceso de remate judicial por entidades bancarias y fondos de inversión en Bolivia.',
    features: [
      'Saldo y volumen de cartera de adjudicados reportados ante ASFI',
      'Distribución de activos por departamento, zona y tipo de inmueble',
      'Descuentos medios aplicados sobre avalúos periciales oficiales',
      'Impacto de la liquidación de activos adjudicados en los precios zonales',
    ],
    metrics: [
      { label: 'Entidades bancarias', value: '14 Bancos + EFVs', note: 'Cobertura nacional ASFI' },
      { label: 'Descuento en 2do remate', value: '-20% a -35%', note: 'Respecto a tasación' },
      { label: 'Rotación de cartera', value: '14.2 meses', note: 'Tiempo promedio de venta' },
    ],
  },
  '2.1': {
    id: '2.1',
    title: 'Composición Económica y Voluntad de Compra',
    subtitle: 'Capacidad de Ahorro y Estratificación de la Demanda',
    sectionTitle: 'Análisis de la Demanda',
    description: 'Estratificación socioeconómica del comprador potencial boliviano, cruzando ingresos de hogares, capacidad efectiva de ahorro y propensión al endeudamiento.',
    features: [
      'Distribución de hogares por estratos de ingreso en el eje troncal',
      'Capacidad de cuota mensual proyectada para adquisición inmobiliaria',
      'Índice de confianza y propensión a la inversión inmobiliaria',
      'Comportamiento de compra contado vs crédito hipotecario',
    ],
    metrics: [
      { label: 'Muestra analizada', value: '3.200 hogares', note: 'Eje troncal (SCZ, LPZ, CBB)' },
      { label: 'Ingreso medio hogar objetivo', value: '$US 1.850 / mes', note: 'Segmento medio-típico' },
      { label: 'Capacidad de cuota', value: '30% ingreso', note: 'Límite prudencial financiero' },
    ],
  },
  '2.2': {
    id: '2.2',
    title: 'Compra como Inversión',
    subtitle: 'Rentabilidad por Alquiler, Cap Rate y Plusvalía',
    sectionTitle: 'Análisis de la Demanda',
    description: 'Análisis del perfil inversor residencial: retornos por alquiler tradicional y temporal (Airbnb), tasas de vacancia y plusvalía proyectada por microzona.',
    features: [
      'Rental Yield bruto y neto anualizado por distrito y zona urbana',
      'Evolución de plusvalía y apreciación de capital en proyectos terminados',
      'Sensibilidad a rentas en dólares vs bolivianos',
      'Perfil del inversor: ticket medio, número de unidades y tasa de reinversión',
    ],
    metrics: [
      { label: 'Rental Yield promedio', value: '6.8% anual', note: 'Santa Cruz residencial' },
      { label: 'Tasa de ocupación', value: '82%', note: 'Alquiler anual tradicional' },
      { label: 'Ticket inversor típico', value: '$US 45k - $US 85k', note: 'Monoambientes y 1 Dorm.' },
    ],
  },
  '2.3': {
    id: '2.3',
    title: 'Compra de Vivienda / Uso Propio',
    subtitle: 'Demanda Final, Familias y Primera Vivienda',
    sectionTitle: 'Análisis de la Demanda',
    description: 'Requerimientos, preferencias espaciales y motivos de compra de los usuarios finales que buscan vivienda propia en las principales urbes del país.',
    features: [
      'Preferencias de tipología: metraje ideal, distribución y cantidad de dormitorios',
      'Priorización de amenidades: seguridad, piscina, coworking y áreas infantiles',
      'Sensibilidad al costo de expensas y mantenimiento mensual',
      'Demanda de Vivienda de Interés Social (VIS) con tasa regulada al 5.5%',
    ],
    metrics: [
      { label: 'Tipología más demandada', value: '2 Dormitorios (65-75m²)', note: 'Familias jóvenes' },
      { label: 'Horizonte de compra', value: '3 a 6 meses', note: 'Desde inicio de búsqueda' },
      { label: 'Preferencia VIS', value: '64% compradores', note: 'En rangos hasta $US 130k' },
    ],
  },
  '3.1': {
    id: '3.1',
    title: 'Evolución del Financiamiento al Sector Inmobiliario',
    subtitle: 'Créditos a la Construcción y Apalancamiento Promotor',
    sectionTitle: 'Análisis Financiero',
    description: 'Evolución de desembolsos, saldos de cartera y condiciones financieras del sistema bancario otorgadas a constructoras y promotores inmobiliarios.',
    features: [
      'Desembolsos mensuales acumulados por departamento en créditos constructor',
      'Evolución de tasas activas para financiamiento de proyectos',
      'Plazos promedio de amortización y periodos de gracia de obras',
      'Estructura de apalancamiento: capital propio vs preventas vs deuda bancaria',
    ],
    metrics: [
      { label: 'Saldo cartera constructor', value: '$US 2.140 M', note: 'Sistema financiero regulado' },
      { label: 'Tasa promedio activa', value: '7.8% a 9.5%', note: 'Crédito empresarial constructor' },
      { label: 'Participación SCZ', value: '54% del total', note: 'Líder en absorción de crédito' },
    ],
  },
  '3.2': {
    id: '3.2',
    title: 'Evolución de la Mora del Inmobiliario',
    subtitle: 'Calidad de Cartera, Reprogramaciones y Riesgo Crediticio',
    sectionTitle: 'Análisis Financiero',
    description: 'Comportamiento de la morosidad y reprogramaciones en créditos otorgados a la construcción inmobiliaria, con alertas tempranas de estrés financiero.',
    features: [
      'Índice de mora mayor a 30 y 90 días en empresas constructoras',
      'Volumen de créditos reprogramados y refinanciados en el sector',
      'Cobertura de previsiones constituidas sobre cartera en mora',
      'Comparativo sectorial: construcción vs comercio vs industria',
    ],
    metrics: [
      { label: 'Índice de mora sectorial', value: '3.4%', note: 'Créditos al sector constructor' },
      { label: 'Cartera reprogramada', value: '11.2%', note: 'Sobre saldo total de construcción' },
      { label: 'Cobertura de previsiones', value: '145%', note: 'Nivel adecuado de reservas' },
    ],
  },
  '4.1': {
    id: '4.1',
    title: 'Perfil del Consumidor de Créditos Hipotecarios',
    subtitle: 'Demografía y Capacidad de Endeudamiento',
    sectionTitle: 'Análisis del Endeudamiento Hipotecario',
    description: 'Análisis demográfico y económico de los prestatarios que acceden a financiamiento de vivienda en Bolivia.',
    features: [
      'Distribución etaria, estado civil y nivel de educación de los solicitantes',
      'Ticket promedio de crédito hipotecario solicitado por plaza',
      'Relación Cuota / Ingreso (DTI) y capacidad de servicio de deuda',
      'Participación de ingresos de asalariados vs independientes formales/informales',
    ],
    metrics: [
      { label: 'Edad promedio prestatario', value: '38 años', note: 'Rango pico: 32 a 45 años' },
      { label: 'Ticket medio hipotecario', value: '$US 68.500', note: 'Plaza Santa Cruz / La Paz' },
      { label: 'Plazo medio pactado', value: '22 años', note: 'Amortización francesa' },
    ],
  },
  '4.2': {
    id: '4.2',
    title: 'Estado de la Cartera Hipotecaria',
    subtitle: 'Saldos de Vivienda, VIS y Cobertura Nacional',
    sectionTitle: 'Análisis del Endeudamiento Hipotecario',
    description: 'Composición de la cartera de créditos de vivienda en el sistema financiero boliviano, desagregando créditos de interés social (VIS) y de mercado abierto.',
    features: [
      'Saldo total y tasa de crecimiento de la cartera de vivienda nacional',
      'Participación de Créditos de Vivienda de Interés Social (VIS) con cupo de tasa fija',
      'Distribución de cartera por departamento (Santa Cruz, La Paz, Cochabamba y resto)',
      'Tasa de morosidad hipotecaria comparativa histórica',
    ],
    metrics: [
      { label: 'Saldo total hipotecario', value: '$US 7.820 M', note: 'Cartera de vivienda ASFI' },
      { label: 'Participación VIS', value: '68% del total', note: 'Tasas reguladas 5.5% - 6.5%' },
      { label: 'Mora hipotecaria', value: '1.9%', note: 'La más baja del sistema financiero' },
    ],
  },
  '4.3': {
    id: '4.3',
    title: 'Perspectivas del Comprador',
    subtitle: 'Expectativas de Tasas, Moneda y Horizonte de Endeudamiento',
    sectionTitle: 'Análisis del Endeudamiento Hipotecario',
    description: 'Expectativas del público demandante sobre condiciones crediticias futuras, tipo de cambio y disposición a asumir pasivos hipotecarios a largo plazo.',
    features: [
      'Encuesta de intención de toma de crédito a 12 meses',
      'Sensibilidad a la disponibilidad de financiamiento en moneda nacional (Bs)',
      'Percepción sobre requisitos de aporte propio y garantías exigidas',
      'Expectativa de evolución de tasas activas y cuotas mensuales',
    ],
    metrics: [
      { label: 'Intención de compra c/crédito', value: '71%', note: 'De los interesados en vivienda' },
      { label: 'Preferencia moneda crédito', value: '88% en Bs', note: 'Por estabilidad de cuota fija' },
      { label: 'Aporte propio promedio', value: '15% a 20%', note: 'Del valor comercial de tasación' },
    ],
  },
}

interface Props {
  chapterId: string
}

export default function ChapterDossierPanel({ chapterId }: Props) {
  const chapter = CHAPTER_REGISTRY[chapterId] || CHAPTER_REGISTRY['1.3']

  return (
    <div className="chapter-dossier-panel" role="region" aria-label={chapter.title}>
      <div className="chapter-dossier-card">
        {/* Header Badge */}
        <div className="dossier-meta-row">
          <span className="dossier-section-badge">{chapter.sectionTitle}</span>
          <span className="dossier-status-badge">
            <span className="dossier-status-dot" />
            En Integración Institucional
          </span>
        </div>

        {/* Title */}
        <h1 className="dossier-title">{chapter.title}</h1>
        <h2 className="dossier-subtitle">{chapter.subtitle}</h2>

        {/* Description */}
        <p className="dossier-desc">{chapter.description}</p>

        {/* KPIs / Highlights */}
        {chapter.metrics && chapter.metrics.length > 0 && (
          <div className="dossier-metrics-grid">
            {chapter.metrics.map((m, idx) => (
              <div key={idx} className="dossier-metric-item">
                <div className="dossier-metric-val">{m.value}</div>
                <div className="dossier-metric-lbl">{m.label}</div>
                <div className="dossier-metric-note">{m.note}</div>
              </div>
            ))}
          </div>
        )}

        {/* Features / Capítulos de Análisis */}
        <div className="dossier-features-section">
          <h3 className="dossier-features-title">Capacidades Analíticas de este Capítulo</h3>
          <div className="dossier-features-list">
            {chapter.features.map((feat, idx) => (
              <div key={idx} className="dossier-feature-item">
                <div className="dossier-check-icon">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
                <span>{feat}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Pipeline notice */}
        <div className="dossier-footer-note">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="16" x2="12" y2="12" />
            <line x1="12" y1="8" x2="12.01" y2="8" />
          </svg>
          <span>
            Este capítulo se nutre del pipeline Medallion de Citrino Intelligence. La integración de datos en vivo estará disponible en la próxima actualización de fuentes de mercado.
          </span>
        </div>
      </div>
    </div>
  )
}
