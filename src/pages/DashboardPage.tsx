import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  TrendingUp,
  DollarSign,
  AlertTriangle,
  Clock,
  Package,
  Loader2,
  RefreshCw,
  ShoppingBasket,
  Info,
  Truck,
  CalendarDays,
  ChevronRight,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { formatMoney, todayLocalISO } from '@/lib/utils'
import {
  type PeriodoFiltro,
  type KpisInventario,
  type KpisPeriodo,
  type KpisConsumo,
  type KpisCompras,
  type Alerta,
  type VencimientoResumen,
  fetchKpisInventario,
  fetchVentasEnRango,
  fetchComprasEnRango,
  fetchConsumoEnRango,
  fetchAlertas,
  fetchMapaVencimientos,
  getRangoPeriodo,
  getEtiquetasKpi,
  getContextoPeriodo,
  calcKpisPeriodo,
  calcTopProductos,
  calcVentasPorCategoria,
  calcTopGanancia,
  calcVentasDiarias,
} from '@/lib/dashboard'
import { fetchDevolucionesEnRango } from '@/lib/devoluciones'
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

interface KpiCard {
  label: string
  value: string
  hint?: string
  icon: typeof TrendingUp
  color: string
  to?: string
}

export function DashboardPage() {
  const { perfil } = useAuth()
  const [periodo, setPeriodo] = useState<PeriodoFiltro>('hoy')
  const [fechaRef, setFechaRef] = useState(todayLocalISO())
  const [loading, setLoading] = useState(true)
  const [kpisPeriodo, setKpisPeriodo] = useState<KpisPeriodo | null>(null)
  const [kpisInventario, setKpisInventario] = useState<KpisInventario | null>(null)
  const [kpisConsumo, setKpisConsumo] = useState<KpisConsumo | null>(null)
  const [kpisCompras, setKpisCompras] = useState<KpisCompras | null>(null)
  const [alertas, setAlertas] = useState<Alerta[]>([])

  const [topProductos, setTopProductos] = useState<ReturnType<typeof calcTopProductos>>([])
  const [categorias, setCategorias] = useState<ReturnType<typeof calcVentasPorCategoria>>([])
  const [ganancia, setGanancia] = useState<ReturnType<typeof calcTopGanancia>>([])
  const [ventasDiarias, setVentasDiarias] = useState<ReturnType<typeof calcVentasDiarias>>([])
  const [vencimientos, setVencimientos] = useState<VencimientoResumen[]>([])

  async function loadData() {
    setLoading(true)
    try {
      const { desde, hasta, desdeISO, hastaISO } = getRangoPeriodo(periodo, fechaRef)
      const [inventario, ventas, devoluciones, consumo, compras, alertasData, vencData] =
        await Promise.all([
          fetchKpisInventario(),
          fetchVentasEnRango(desde, hasta),
          fetchDevolucionesEnRango(desde, hasta),
          fetchConsumoEnRango(desde, hasta),
          fetchComprasEnRango(desdeISO, hastaISO),
          fetchAlertas(),
          fetchMapaVencimientos(),
        ])

      setKpisInventario(inventario)
      setKpisPeriodo(calcKpisPeriodo(ventas, devoluciones))
      setKpisConsumo(consumo)
      setKpisCompras(compras)
      setAlertas(alertasData)
      setVencimientos(vencData)
      setTopProductos(calcTopProductos(ventas, devoluciones))
      setCategorias(calcVentasPorCategoria(ventas, devoluciones))
      setGanancia(calcTopGanancia(ventas, devoluciones))
      setVentasDiarias(calcVentasDiarias(ventas, devoluciones))
    } catch {
      /* datos parciales ok */
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [periodo, fechaRef])

  const etiquetas = getEtiquetasKpi(periodo)
  const contextoPeriodo = getContextoPeriodo(periodo, fechaRef)
  const esHoy = fechaRef === todayLocalISO()

  const kpiCards: KpiCard[] =
    kpisPeriodo && kpisInventario && kpisCompras
      ? [
          {
            label: etiquetas.ventas,
            value: formatMoney(kpisPeriodo.ventasNetas),
            icon: TrendingUp,
            color: 'bg-blue-500',
          },
          {
            label: etiquetas.ganancia,
            value: formatMoney(kpisPeriodo.gananciaNeta),
            icon: DollarSign,
            color: 'bg-emerald-500',
          },
          {
            label: etiquetas.compras,
            value: formatMoney(kpisCompras.total),
            hint:
              kpisCompras.cantidad > 0
                ? `${kpisCompras.cantidad} compra${kpisCompras.cantidad === 1 ? '' : 's'}`
                : 'Sin compras',
            icon: Truck,
            color: 'bg-violet-500',
            to: '/compras',
          },
          {
            label: 'Stock bajo',
            value: `${kpisInventario.stockBajo} productos`,
            hint: 'Toca para ver la lista',
            icon: AlertTriangle,
            color: 'bg-amber-500',
            to: '/productos?filtro=stock_bajo',
          },
          {
            label: 'Lotes por vencer / vencidos',
            value: `${kpisInventario.porVencer} / ${kpisInventario.vencidos}`,
            hint: 'Toca para ver lotes',
            icon: Clock,
            color: 'bg-orange-500',
            to: '/lotes?filtro=por_vencer',
          },
        ]
      : []

  function irAHoy() {
    setFechaRef(todayLocalISO())
    setPeriodo('hoy')
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
          <p className="text-slate-500">Bienvenida, {perfil?.nombre}. Resumen para tomar decisiones.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
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

      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <CalendarDays className="hidden h-5 w-5 text-teal-600 sm:block" />
          <div>
            <p className="text-sm font-medium text-slate-700">Ver hasta el</p>
            <p className="text-xs text-slate-500">{contextoPeriodo}</p>
          </div>
          <input
            type="date"
            value={fechaRef}
            max={todayLocalISO()}
            onChange={(e) => e.target.value && setFechaRef(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-500"
          />
          {!esHoy && (
            <button
              type="button"
              onClick={irAHoy}
              className="rounded-lg border border-teal-200 bg-teal-50 px-3 py-2 text-sm font-medium text-teal-800 hover:bg-teal-100"
            >
              Ir a hoy
            </button>
          )}
        </div>
      </div>

      {loading && !kpisPeriodo ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
            {kpiCards.map(({ label, value, hint, icon: Icon, color, to }) => {
              const inner = (
                <>
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm text-slate-500">{label}</p>
                      <p className="mt-1 text-2xl font-bold text-slate-900">{value}</p>
                      {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
                    </div>
                    <div className={`rounded-lg p-2.5 text-white ${color}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                  </div>
                  {to && (
                    <p className="mt-3 flex items-center gap-1 text-xs font-medium text-teal-700">
                      Ver detalle
                      <ChevronRight className="h-3.5 w-3.5" />
                    </p>
                  )}
                </>
              )

              if (to) {
                return (
                  <Link
                    key={label}
                    to={to}
                    className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-teal-300 hover:shadow-md"
                  >
                    {inner}
                  </Link>
                )
              }

              return (
                <div
                  key={label}
                  className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
                >
                  {inner}
                </div>
              )
            })}
          </div>

          {kpisConsumo && (
            <div className="rounded-xl border border-orange-200 bg-orange-50/80 p-5 shadow-sm">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex items-start gap-3">
                  <div className="rounded-lg bg-orange-500 p-2.5 text-white">
                    <ShoppingBasket className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-orange-900">Consumo propio</p>
                    <p className="mt-1 text-2xl font-bold text-orange-800">
                      {formatMoney(kpisConsumo.totalCosto)}
                    </p>
                    <p className="mt-1 text-xs text-orange-700/80">
                      Mercadería retirada al costo
                      {kpisConsumo.cantidadRetiros > 0
                        ? ` · ${kpisConsumo.cantidadRetiros} retiro${kpisConsumo.cantidadRetiros === 1 ? '' : 's'}`
                        : ' · sin retiros'}
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 sm:text-right">
                  <div>
                    <p className="text-xs text-orange-700/70">Si se hubiera vendido</p>
                    <p className="font-semibold text-slate-800">
                      {formatMoney(kpisConsumo.totalVentaPotencial)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-orange-700/70">Dejó de ganar</p>
                    <p className="font-semibold text-slate-900">
                      {formatMoney(kpisConsumo.oportunidadPerdida)}
                    </p>
                  </div>
                </div>
              </div>
              <p className="mt-3 flex items-center gap-1.5 text-xs text-orange-800/70">
                <Info className="h-3.5 w-3.5 shrink-0" />
                Solo informativo — no afecta ventas ni el efectivo de caja
              </p>
            </div>
          )}

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

          <Link
            to="/lotes?filtro=por_vencer"
            className="block rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-orange-300 hover:shadow-md"
          >
            <h2 className="mb-4 flex items-center justify-between font-semibold text-slate-900">
              <span>Mapa de vencimientos — valor en riesgo</span>
              <span className="flex items-center gap-1 text-xs font-medium text-teal-700">
                Ver lotes
                <ChevronRight className="h-4 w-4" />
              </span>
            </h2>
            <VencimientosChart data={vencimientos} />
          </Link>

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
