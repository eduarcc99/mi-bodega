import { useCallback, useEffect, useState } from 'react'
import {
  ClipboardList,
  Loader2,
  RefreshCw,
  Phone,
  MapPin,
  CheckCircle,
  XCircle,
  PackageCheck,
  AlertCircle,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { formatMoney } from '@/lib/utils'
import type { MetodoPago } from '@/types/database'
import {
  fetchPedidosWeb,
  confirmarPedidoWeb,
  cancelarPedidoWeb,
  entregarPedidoWeb,
  contarPendientes,
  etiquetaCantidadDetalle,
  estadoPedidoLabel,
  estadoPedidoClass,
  type PedidoWeb,
  type PedidoWebEstado,
} from '@/lib/pedidos-admin'

type Filtro = 'activos' | 'todos' | PedidoWebEstado

export function PedidosWebPage() {
  const { perfil } = useAuth()
  const [pedidos, setPedidos] = useState<PedidoWeb[]>([])
  const [loading, setLoading] = useState(true)
  const [processingId, setProcessingId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [filtro, setFiltro] = useState<Filtro>('activos')
  const [metodoEntrega, setMetodoEntrega] = useState<Record<string, MetodoPago>>({})

  const cargar = useCallback(async () => {
    setError('')
    try {
      const data = await fetchPedidosWeb()
      setPedidos(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar pedidos')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    cargar()
    const t = setInterval(cargar, 30000)
    return () => clearInterval(t)
  }, [cargar])

  const pendientes = contarPendientes(pedidos)

  const filtrados = pedidos.filter((p) => {
    if (filtro === 'todos') return true
    if (filtro === 'activos') return p.estado === 'pendiente' || p.estado === 'confirmado'
    return p.estado === filtro
  })

  async function ejecutar(id: string, fn: () => Promise<void>) {
    setProcessingId(id)
    setError('')
    try {
      await fn()
      await cargar()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al procesar')
    } finally {
      setProcessingId(null)
    }
  }

  const filtros: { id: Filtro; label: string }[] = [
    { id: 'activos', label: 'Activos' },
    { id: 'pendiente', label: 'Pendientes' },
    { id: 'confirmado', label: 'Confirmados' },
    { id: 'entregado', label: 'Entregados' },
    { id: 'cancelado', label: 'Cancelados' },
    { id: 'todos', label: 'Todos' },
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
            <ClipboardList className="h-7 w-7 text-teal-600" />
            Pedidos web
            {pendientes > 0 && (
              <span className="rounded-full bg-amber-500 px-2.5 py-0.5 text-sm font-bold text-white">
                {pendientes}
              </span>
            )}
          </h1>
          <p className="text-slate-500">
            Delivery MARGHOT · Confirmar, cancelar o entregar (baja stock al entregar)
          </p>
        </div>
        <button
          onClick={() => {
            setLoading(true)
            cargar()
          }}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Actualizar
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {filtros.map((f) => (
          <button
            key={f.id}
            onClick={() => setFiltro(f.id)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
              filtro === f.id
                ? 'bg-teal-600 text-white'
                : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {loading && pedidos.length === 0 ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
        </div>
      ) : filtrados.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white py-16 text-center text-slate-500">
          <ClipboardList className="mx-auto h-12 w-12 text-slate-300" />
          <p className="mt-4 font-medium">No hay pedidos en este filtro</p>
          <p className="text-sm">Los pedidos de /pedir aparecerán aquí</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtrados.map((p) => (
            <article
              key={p.id}
              className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-bold text-slate-900">
                      #{p.id.slice(0, 8).toUpperCase()}
                    </span>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${estadoPedidoClass(p.estado)}`}
                    >
                      {estadoPedidoLabel(p.estado)}
                    </span>
                    <span className="text-xs text-slate-400">
                      {new Date(p.created_at).toLocaleString('es-PE')}
                    </span>
                  </div>
                  <p className="mt-2 text-lg font-semibold text-slate-900">{p.cliente_nombre}</p>
                  <p className="flex items-center gap-1 text-sm text-slate-600">
                    <Phone className="h-3.5 w-3.5" />
                    {p.cliente_telefono}
                  </p>
                  <p className="flex items-start gap-1 text-sm text-slate-600">
                    <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span>
                      {p.direccion}
                      {p.referencia && ` · ${p.referencia}`}
                    </span>
                  </p>
                  {p.notas && (
                    <p className="mt-1 text-xs text-slate-500">Notas: {p.notas}</p>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-teal-700">{formatMoney(p.total)}</p>
                  <p className="text-xs text-slate-500">
                    Prod. {formatMoney(p.subtotal)}
                    {p.costo_delivery > 0
                      ? ` + envío ${formatMoney(p.costo_delivery)}`
                      : ' · envío gratis'}
                  </p>
                </div>
              </div>

              <div className="mt-4 rounded-lg bg-slate-50 p-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Productos
                </p>
                <ul className="space-y-1 text-sm text-slate-700">
                  {(p.pedido_web_detalles ?? []).map((d) => (
                    <li key={d.id} className="flex justify-between gap-2">
                      <span>
                        {d.nombre_producto} — {etiquetaCantidadDetalle(d)}
                      </span>
                      <span className="font-medium">{formatMoney(d.subtotal)}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {(p.estado === 'pendiente' || p.estado === 'confirmado') && perfil && (
                <div className="mt-4 flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
                  {p.estado === 'confirmado' && (
                    <div className="flex items-center gap-2">
                      <label className="text-sm text-slate-600">Cobro:</label>
                      <select
                        value={metodoEntrega[p.id] ?? 'efectivo'}
                        onChange={(e) =>
                          setMetodoEntrega((prev) => ({
                            ...prev,
                            [p.id]: e.target.value as MetodoPago,
                          }))
                        }
                        className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
                      >
                        <option value="efectivo">Efectivo</option>
                        <option value="yape">Yape</option>
                        <option value="otro">Otro</option>
                      </select>
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2 sm:ml-auto">
                    {p.estado === 'pendiente' && (
                      <button
                        disabled={processingId === p.id}
                        onClick={() => ejecutar(p.id, () => confirmarPedidoWeb(p.id))}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                      >
                        {processingId === p.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <CheckCircle className="h-4 w-4" />
                        )}
                        Confirmar
                      </button>
                    )}
                    {p.estado === 'confirmado' && (
                      <button
                        disabled={processingId === p.id}
                        onClick={() =>
                          ejecutar(p.id, async () => {
                            await entregarPedidoWeb(
                              p.id,
                              perfil.id,
                              metodoEntrega[p.id] ?? 'efectivo',
                            )
                          })
                        }
                        className="inline-flex items-center gap-1.5 rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50"
                      >
                        {processingId === p.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <PackageCheck className="h-4 w-4" />
                        )}
                        Entregar (venta + stock)
                      </button>
                    )}
                    <button
                      disabled={processingId === p.id}
                      onClick={() => ejecutar(p.id, () => cancelarPedidoWeb(p.id))}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                    >
                      <XCircle className="h-4 w-4" />
                      Cancelar
                    </button>
                  </div>
                </div>
              )}

              {p.estado === 'entregado' && p.venta_id && (
                <p className="mt-3 text-xs text-emerald-700">
                  Venta registrada · ticket {p.venta_id.slice(0, 8).toUpperCase()}
                </p>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  )
}
