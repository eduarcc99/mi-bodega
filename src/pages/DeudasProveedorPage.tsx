import { useCallback, useEffect, useState } from 'react'
import {
  Clock,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Banknote,
  Smartphone,
  Calendar,
  Truck,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { formatMoney, formatDate, todayLocalISO } from '@/lib/utils'
import {
  fetchCuotasPendientes,
  pagarCuotaProveedor,
  estadoCuota,
  labelEstadoCuota,
  type CuotaProveedor,
} from '@/lib/deudasProveedor'
import type { MetodoPago } from '@/types/database'

export function DeudasProveedorPage() {
  const { perfil } = useAuth()
  const [cuotas, setCuotas] = useState<CuotaProveedor[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [mensaje, setMensaje] = useState('')
  const [pagandoId, setPagandoId] = useState<string | null>(null)
  const [modalCuota, setModalCuota] = useState<CuotaProveedor | null>(null)
  const [metodoPago, setMetodoPago] = useState<'efectivo' | 'yape'>('efectivo')
  const [fechaPago, setFechaPago] = useState(todayLocalISO())

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      setCuotas(await fetchCuotasPendientes())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar deudas')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const vencidas = cuotas.filter((c) => estadoCuota(c) === 'vencida')
  const hoy = cuotas.filter((c) => estadoCuota(c) === 'hoy')
  const proximas = cuotas.filter((c) => estadoCuota(c) === 'proxima')
  const totalPendiente = cuotas.reduce((s, c) => s + Number(c.monto), 0)

  function abrirPago(cuota: CuotaProveedor) {
    setModalCuota(cuota)
    setMetodoPago('efectivo')
    setFechaPago(todayLocalISO())
    setError('')
  }

  async function confirmarPago() {
    if (!perfil || !modalCuota) return
    setPagandoId(modalCuota.id)
    setError('')
    try {
      await pagarCuotaProveedor({
        cuota_id: modalCuota.id,
        metodo_pago: metodoPago as MetodoPago,
        registrado_por: perfil.id,
        fecha_pago: fechaPago,
      })
      setMensaje(
        `Cuota pagada · ${formatMoney(Number(modalCuota.monto))} descontado de ${metodoPago === 'yape' ? 'Yape' : 'caja'}`,
      )
      setModalCuota(null)
      load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al registrar pago')
    } finally {
      setPagandoId(null)
    }
  }

  function renderGrupo(titulo: string, items: CuotaProveedor[], tone: 'red' | 'amber' | 'slate') {
    if (items.length === 0) return null
    const border =
      tone === 'red' ? 'border-red-200' : tone === 'amber' ? 'border-amber-200' : 'border-slate-200'
    const badge =
      tone === 'red' ? 'bg-red-100 text-red-800' : tone === 'amber' ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-700'

    return (
      <div className={`rounded-xl border ${border} bg-white shadow-sm`}>
        <div className="border-b border-slate-100 px-5 py-3">
          <h2 className="font-semibold text-slate-900">{titulo}</h2>
          <p className="text-xs text-slate-500">{items.length} cuota{items.length === 1 ? '' : 's'}</p>
        </div>
        <ul className="divide-y divide-slate-100">
          {items.map((c) => {
            const est = estadoCuota(c)
            return (
              <li key={c.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-slate-900">
                      {c.compras?.proveedor_nombre ?? 'Proveedor'}
                    </p>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${badge}`}>
                      {labelEstadoCuota(est)}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-slate-600">
                    {c.descripcion || 'Cuota'} · vence {formatDate(c.fecha_vencimiento)}
                    {c.compras?.numero_factura && ` · Factura ${c.compras.numero_factura}`}
                  </p>
                  <p className="text-xs text-slate-400">
                    Compra del {c.compras?.fecha ? formatDate(c.compras.fecha) : '—'} · total{' '}
                    {formatMoney(Number(c.compras?.total ?? 0))}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <p className="text-lg font-bold text-slate-900">{formatMoney(Number(c.monto))}</p>
                  <button
                    type="button"
                    onClick={() => abrirPago(c)}
                    className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700"
                  >
                    Pagar
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Deudas con proveedores</h1>
        <p className="text-slate-500">
          Cuotas fiadas pendientes · al pagar se descuenta de caja o Yape
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs text-slate-500">Total pendiente</p>
          <p className="text-2xl font-bold text-slate-900">{formatMoney(totalPendiente)}</p>
        </div>
        <div className="rounded-xl border border-red-200 bg-red-50 p-4">
          <p className="text-xs text-red-700">Vencidas</p>
          <p className="text-2xl font-bold text-red-800">{vencidas.length}</p>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-xs text-amber-800">Vencen hoy</p>
          <p className="text-2xl font-bold text-amber-900">{hoy.length}</p>
        </div>
      </div>

      {mensaje && (
        <div className="flex items-center gap-2 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          {mensaje}
        </div>
      )}

      {error && !modalCuota && (
        <div className="flex items-center gap-2 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
        </div>
      ) : cuotas.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white py-16 text-center">
          <Clock className="mx-auto h-12 w-12 text-slate-300" />
          <p className="mt-4 font-medium text-slate-600">No hay deudas pendientes</p>
          <p className="text-sm text-slate-400">
            Al registrar compras fiadas aparecerán aquí con su fecha de pago
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {renderGrupo('Vencidas', vencidas, 'red')}
          {renderGrupo('Vencen hoy', hoy, 'amber')}
          {renderGrupo('Próximas', proximas, 'slate')}
        </div>
      )}

      {modalCuota && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="mb-1 flex items-center gap-2 font-bold text-slate-900">
              <Truck className="h-5 w-5 text-teal-600" />
              Pagar cuota
            </h3>
            <p className="mb-4 text-sm text-slate-500">
              {modalCuota.compras?.proveedor_nombre} · {modalCuota.descripcion || 'Cuota'}
            </p>

            <p className="mb-4 text-3xl font-bold text-teal-700">
              {formatMoney(Number(modalCuota.monto))}
            </p>

            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Fecha del pago</label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="date"
                    value={fechaPago}
                    onChange={(e) => setFechaPago(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 py-2.5 pl-10 pr-3 outline-none focus:border-teal-500"
                  />
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">¿Cómo pagaste?</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setMetodoPago('efectivo')}
                    className={`flex items-center justify-center gap-2 rounded-xl border py-3 text-sm font-medium ${
                      metodoPago === 'efectivo'
                        ? 'border-teal-500 bg-teal-50 text-teal-800'
                        : 'border-slate-200 text-slate-600'
                    }`}
                  >
                    <Banknote className="h-4 w-4" />
                    Efectivo
                  </button>
                  <button
                    type="button"
                    onClick={() => setMetodoPago('yape')}
                    className={`flex items-center justify-center gap-2 rounded-xl border py-3 text-sm font-medium ${
                      metodoPago === 'yape'
                        ? 'border-purple-500 bg-purple-50 text-purple-800'
                        : 'border-slate-200 text-slate-600'
                    }`}
                  >
                    <Smartphone className="h-4 w-4" />
                    Yape
                  </button>
                </div>
                <p className="mt-2 text-xs text-slate-500">
                  {metodoPago === 'efectivo'
                    ? 'Se descuenta del efectivo esperado ese día'
                    : 'Se resta del Yape esperado · no toca el efectivo físico'}
                </p>
              </div>

              {error && (
                <p className="text-sm text-red-600">{error}</p>
              )}

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setModalCuota(null)}
                  className="flex-1 rounded-lg border border-slate-200 py-2.5 text-slate-600"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={confirmarPago}
                  disabled={!!pagandoId}
                  className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-teal-600 py-2.5 font-semibold text-white hover:bg-teal-700 disabled:opacity-50"
                >
                  {pagandoId ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4" />
                  )}
                  Confirmar pago
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
