import { useEffect, useState } from 'react'
import {
  TrendingUp,
  DollarSign,
  AlertTriangle,
  Clock,
  Package,
  Loader2,
  RefreshCw,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { formatMoney } from '@/lib/utils'
import {
  type PeriodoFiltro,
  type DashboardKpis,
  type Alerta,
  type VencimientoResumen,
  fetchKpis,
  fetchVentasEnRango,
  fetchAlertas,
  fetchMapaVencimientos,
  getRangoPeriodo,
  calcTopProductos,
  calcVentasPorCategoria,
  calcTopGanancia,
  calcVentasDiarias,
} from '@/lib/dashboard'
import {
  TopProductosChart,
  CategoriasPieChart,
  GananciaChart,
  VentasLineChart,
  VencimientosChart,
} from '@/components/dashboard/DashboardCharts'

const PERIODOS: { id: PeriodoFiltro; label: string }[] = [
  { id: 'hoy', label: 'Hoy' },
  { id: 'semana', label: 'Semana' },
  { id: 'mes', label: 'Mes' },
]

const alertaIcon = {
  stock: AlertTriangle,
  vencimiento: Clock,
  vencido: AlertTriangle,
  sin_venta: Package,
}

const alertaColor = {
  alta: 'border-red-200 bg-red-50 text-red-800',
  media: 'border-amber-200 bg-amber-50 text-amber-800',
  baja: 'border-slate-200 bg-slate-50 text-slate-700',
}

export function DashboardPage() {
  const { perfil } = useAuth()
  const [periodo, setPeriodo] = useState<PeriodoFiltro>('semana')
  const [loading, setLoading] = useState(true)
  const [kpis, setKpis] = useState<DashboardKpis | null>(null)
  const [alertas, setAlertas] = useState<Alerta[]>([])

  const [topProductos, setTopProductos] = useState<ReturnType<typeof calcTopProductos>>([])
  const [categorias, setCategorias] = useState<ReturnType<typeof calcVentasPorCategoria>>([])
  const [ganancia, setGanancia] = useState<ReturnType<typeof calcTopGanancia>>([])
  const [ventasDiarias, setVentasDiarias] = useState<ReturnType<typeof calcVentasDiarias>>([])
  const [vencimientos, setVencimientos] = useState<VencimientoResumen[]>([])

  async function loadData() {
    setLoading(true)
    try {
      const { desde, hasta } = getRangoPeriodo(periodo)
      const [kpiData, ventas, alertasData, vencData] = await Promise.all([
        fetchKpis(),
        fetchVentasEnRango(desde, hasta),
        fetchAlertas(),
        fetchMapaVencimientos(),
      ])

      setKpis(kpiData)
      setAlertas(alertasData)
      setVencimientos(vencData)
      setTopProductos(calcTopProductos(ventas))
      setCategorias(calcVentasPorCategoria(ventas))
      setGanancia(calcTopGanancia(ventas))
      setVentasDiarias(calcVentasDiarias(ventas))
    } catch {
      /* datos parciales ok */
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [periodo])

  const kpiCards = kpis
    ? [
        { label: 'Ventas del día', value: formatMoney(kpis.ventasDia), icon: TrendingUp, color: 'bg-blue-500' },
        { label: 'Ganancia estimada hoy', value: formatMoney(kpis.gananciaDia), icon: DollarSign, color: 'bg-emerald-500' },
        { label: 'Stock bajo', value: `${kpis.stockBajo} productos`, icon: AlertTriangle, color: 'bg-amber-500' },
        {
          label: 'Por vencer / vencidos',
          value: `${kpis.porVencer} / ${kpis.vencidos}`,
          icon: Clock,
          color: 'bg-orange-500',
        },
      ]
    : []

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
          <p className="text-slate-500">Bienvenida, {perfil?.nombre}. Resumen para tomar decisiones.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-slate-200 bg-white p-1">
            {PERIODOS.map(({ id, label }) => (
              <button
                key={id}
                onClick={() => setPeriodo(id)}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  periodo === id ? 'bg-teal-600 text-white' : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <button
            onClick={loadData}
            disabled={loading}
            className="rounded-lg border border-slate-200 bg-white p-2 text-slate-600 hover:bg-slate-50 disabled:opacity-50"
            title="Actualizar"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {loading && !kpis ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {kpiCards.map(({ label, value, icon: Icon, color }) => (
              <div key={label} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm text-slate-500">{label}</p>
                    <p className="mt-1 text-2xl font-bold text-slate-900">{value}</p>
                  </div>
                  <div className={`rounded-lg p-2.5 text-white ${color}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="mb-4 font-semibold text-slate-900">Top 10 productos vendidos</h2>
              <TopProductosChart data={topProductos} />
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="mb-4 font-semibold text-slate-900">Ventas por categoría</h2>
              <CategoriasPieChart data={categorias} />
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="mb-4 font-semibold text-slate-900">Productos con mayor ganancia</h2>
              <GananciaChart data={ganancia} />
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="mb-4 font-semibold text-slate-900">Evolución de ventas diarias</h2>
              <VentasLineChart data={ventasDiarias} />
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 font-semibold text-slate-900">Mapa de vencimientos — valor en riesgo</h2>
            <VencimientosChart data={vencimientos} />
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 flex items-center gap-2 font-semibold text-slate-900">
              <Package className="h-5 w-5 text-amber-500" />
              Alertas activas ({alertas.length})
            </h2>
            {alertas.length === 0 ? (
              <p className="text-sm text-slate-500">Todo en orden. No hay alertas por ahora.</p>
            ) : (
              <div className="space-y-2">
                {alertas.slice(0, 15).map((a, i) => {
                  const Icon = alertaIcon[a.tipo]
                  return (
                    <div
                      key={i}
                      className={`flex items-start gap-3 rounded-lg border px-4 py-3 text-sm ${alertaColor[a.severidad]}`}
                    >
                      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
                      <span>{a.mensaje}</span>
                    </div>
                  )
                })}
                {alertas.length > 15 && (
                  <p className="text-xs text-slate-400">+ {alertas.length - 15} alertas más</p>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
