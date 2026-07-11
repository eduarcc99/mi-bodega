import { useEffect, useState } from 'react'
import {
  RotateCcw,
  Search,
  Loader2,
  CheckCircle,
  AlertCircle,
  Package,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { formatMoney } from '@/lib/utils'
import {
  buscarVentas,
  fetchVentaParaDevolucion,
  calcMontoDevolucion,
  cantidadStockDevolucion,
  maxCantidadDevolucion,
  etiquetaCantidadDevolucion,
  registrarDevolucion,
  type VentaParaDevolucion,
} from '@/lib/devoluciones'

export function DevolucionesPage() {
  const { perfil } = useAuth()
  const [busqueda, setBusqueda] = useState('')
  const [ventasRecientes, setVentasRecientes] = useState<
    { id: string; fecha: string; total: number; metodo_pago: string }[]
  >([])
  const [venta, setVenta] = useState<VentaParaDevolucion | null>(null)
  const [cantidades, setCantidades] = useState<Record<string, number>>({})
  const [motivo, setMotivo] = useState('')
  const [loading, setLoading] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState('')
  const [exito, setExito] = useState('')

  useEffect(() => {
    buscarVentas('').then(setVentasRecientes)
  }, [])

  async function handleBuscar() {
    setLoading(true)
    setError('')
    setExito('')
    try {
      const resultados = await buscarVentas(busqueda)
      setVentasRecientes(resultados)
      if (busqueda.trim().length >= 8 && resultados.length === 1) {
        await seleccionarVenta(resultados[0].id)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al buscar')
    } finally {
      setLoading(false)
    }
  }

  async function seleccionarVenta(id: string) {
    setLoading(true)
    setError('')
    setExito('')
    try {
      const v = await fetchVentaParaDevolucion(id)
      if (!v) {
        setError('Venta no encontrada')
        setVenta(null)
        return
      }
      if (v.detalles.every((d) => maxCantidadDevolucion(d) <= 0)) {
        setError('Esta venta ya fue devuelta completamente')
        setVenta(null)
        return
      }
      setVenta(v)
      setCantidades({})
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar venta')
    } finally {
      setLoading(false)
    }
  }

  function setCantidad(detalleId: string, value: number, max: number) {
    setCantidades((prev) => ({
      ...prev,
      [detalleId]: Math.min(Math.max(0, value), max),
    }))
  }

  function devolverTodo() {
    if (!venta) return
    const all: Record<string, number> = {}
    for (const d of venta.detalles) {
      const max = maxCantidadDevolucion(d)
      if (max > 0) all[d.id] = max
    }
    setCantidades(all)
  }

  const lineasSeleccionadas = venta
    ? venta.detalles
        .filter((d) => (cantidades[d.id] ?? 0) > 0)
        .map((d) => {
          const cant = cantidades[d.id]
          const monto = calcMontoDevolucion(d, cant)
          return {
            venta_detalle_id: d.id,
            producto_id: d.producto_id,
            nombre: d.nombre_producto,
            cantidad: cantidadStockDevolucion(d, cant),
            monto,
          }
        })
    : []

  const totalDevolver = lineasSeleccionadas.reduce((s, l) => s + l.monto, 0)

  async function handleConfirmar() {
    if (!perfil || !venta) return
    if (lineasSeleccionadas.length === 0) {
      setError('Selecciona cantidades a devolver')
      return
    }
    setProcessing(true)
    setError('')
    try {
      await registrarDevolucion({
        venta_id: venta.id,
        metodo_pago: venta.metodo_pago,
        lineas: lineasSeleccionadas,
        motivo,
        registrado_por: perfil.id,
      })
      setExito(
        `Devolución registrada: ${formatMoney(totalDevolver)} — stock repuesto${
          venta.metodo_pago === 'efectivo'
            ? ' · se descontó del efectivo en caja'
            : ' · Yape: queda registrado para conciliación'
        }`,
      )
      setVenta(null)
      setCantidades({})
      setMotivo('')
      buscarVentas('').then(setVentasRecientes)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al procesar devolución')
    } finally {
      setProcessing(false)
    }
  }

  const metodoLabel = {
    efectivo: 'Efectivo',
    yape: 'Yape',
    otro: 'Otro',
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Devoluciones</h1>
        <p className="text-slate-500">
          Busca una venta, elige qué devolver — el stock vuelve solo
        </p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
        <input
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleBuscar()}
          placeholder="Código del ticket (ej: A1B2C3D4) o Enter para ver las últimas 10…"
          className="w-full rounded-xl border border-slate-300 py-3 pl-10 pr-4 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
        />
      </div>

      <button
        onClick={handleBuscar}
        disabled={loading}
        className="w-full rounded-lg bg-teal-600 py-2.5 font-medium text-white hover:bg-teal-700 disabled:opacity-50"
      >
        {loading ? 'Buscando…' : 'Buscar venta'}
      </button>

      {!venta && ventasRecientes.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <p className="border-b border-slate-100 px-4 py-3 text-sm font-medium text-slate-600">
            Últimas 10 ventas
          </p>
          {ventasRecientes.map((v) => (
            <button
              key={v.id}
              onClick={() => seleccionarVenta(v.id)}
              className="flex w-full items-center justify-between border-b border-slate-100 px-4 py-3 text-left last:border-0 hover:bg-teal-50"
            >
              <div>
                <p className="font-medium text-slate-900">
                  Ticket {v.id.slice(0, 8).toUpperCase()}
                </p>
                <p className="text-xs text-slate-500">
                  {new Date(v.fecha).toLocaleString('es-PE')} · {metodoLabel[v.metodo_pago as keyof typeof metodoLabel] ?? v.metodo_pago}
                </p>
              </div>
              <span className="font-semibold text-teal-700">{formatMoney(Number(v.total))}</span>
            </button>
          ))}
        </div>
      )}

      {venta && (
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-start justify-between">
            <div>
              <h2 className="font-bold text-slate-900">
                Ticket {venta.id.slice(0, 8).toUpperCase()}
              </h2>
              <p className="text-sm text-slate-500">
                {new Date(venta.fecha).toLocaleString('es-PE')} ·{' '}
                {metodoLabel[venta.metodo_pago]} · Cajero: {venta.perfiles?.nombre ?? '—'}
              </p>
            </div>
            <button
              onClick={() => setVenta(null)}
              className="text-sm text-slate-400 hover:text-slate-600"
            >
              Cancelar
            </button>
          </div>

          {venta.metodo_pago === 'efectivo' && (
            <p className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
              Esta venta fue en efectivo — al devolver, el dinero sale de tu caja física
            </p>
          )}
          {venta.metodo_pago === 'yape' && (
            <p className="mb-4 rounded-lg bg-purple-50 px-3 py-2 text-xs text-purple-800">
              Esta venta fue Yape — debes reembolsar por el celular. Queda registrado en conciliación
            </p>
          )}

          <button
            onClick={devolverTodo}
            className="mb-4 text-sm font-medium text-teal-600 hover:text-teal-700"
          >
            Devolver todo lo disponible
          </button>

          <div className="space-y-3">
            {venta.detalles.map((d) => {
              const max = maxCantidadDevolucion(d)
              const porUnidad = d.modo_venta === 'unidad_suelta'
              return (
              <div
                key={d.id}
                className={`rounded-lg border p-3 ${
                  max <= 0 ? 'border-slate-100 bg-slate-50 opacity-50' : 'border-slate-200'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2">
                    <Package className="mt-0.5 h-4 w-4 text-slate-400" />
                    <div>
                      <p className="font-medium text-slate-900">{d.nombre_producto}</p>
                      <p className="text-xs text-slate-500">
                        Vendidos: {etiquetaCantidadDevolucion(d)}
                        {porUnidad
                          ? ` · Devueltos: ${d.unidades_devueltas} ud · Disponibles: ${d.unidades_disponibles} ud`
                          : ` · Ya devueltos: ${d.cantidad_devuelta} · Disponibles: ${d.cantidad_disponible}`}
                      </p>
                      <p className="text-xs text-slate-500">
                        Precio: {formatMoney(d.precio_unitario)}
                        {porUnidad ? '/ud' : ' c/u'}
                      </p>
                    </div>
                  </div>
                  {max > 0 && (
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="0"
                        max={max}
                        step={porUnidad ? '1' : '0.001'}
                        value={cantidades[d.id] ?? 0}
                        onChange={(e) =>
                          setCantidad(d.id, parseFloat(e.target.value) || 0, max)
                        }
                        className="w-16 rounded border border-slate-300 px-2 py-1 text-center text-sm"
                      />
                      {cantidades[d.id] > 0 && (
                        <span className="text-sm font-medium text-teal-700">
                          {formatMoney(calcMontoDevolucion(d, cantidades[d.id]))}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )})}
          </div>

          <div className="mt-4">
            <label className="mb-1 block text-sm font-medium text-slate-700">Motivo (opcional)</label>
            <input
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Ej: producto en mal estado, cliente se equivocó…"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-500"
            />
          </div>

          {totalDevolver > 0 && (
            <div className="mt-4 rounded-lg bg-slate-50 p-4">
              <p className="text-sm text-slate-600">Total a devolver al cliente</p>
              <p className="text-2xl font-bold text-slate-900">{formatMoney(totalDevolver)}</p>
            </div>
          )}

          <button
            onClick={handleConfirmar}
            disabled={processing || lineasSeleccionadas.length === 0}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-teal-600 py-3 font-semibold text-white hover:bg-teal-700 disabled:opacity-50"
          >
            {processing ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <RotateCcw className="h-5 w-5" />
            )}
            Confirmar devolución
          </button>
        </div>
      )}

      {exito && (
        <div className="flex items-start gap-2 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          <CheckCircle className="mt-0.5 h-4 w-4 shrink-0" />
          {exito}
        </div>
      )}
      {error && (
        <div className="flex items-start gap-2 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          {error}
        </div>
      )}
    </div>
  )
}
