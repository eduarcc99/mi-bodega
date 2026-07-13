import { useCallback, useEffect, useState } from 'react'
import {
  Receipt,
  Search,
  Loader2,
  AlertCircle,
  Eye,
  Banknote,
  Smartphone,
  ShoppingBasket,
} from 'lucide-react'
import { formatMoney, todayLocalISO } from '@/lib/utils'
import {
  buscarTickets,
  fetchTicketDetalle,
  fetchTicketsDelDia,
  codigoTicket,
  type TicketResumen,
  type TicketDetalle,
} from '@/lib/tickets'
import {
  buscarConsumosTicket,
  fetchConsumoTicketDetalle,
  fetchConsumosTicketDelDia,
  type ConsumoTicketDetalle,
  type ConsumoTicketResumen,
} from '@/lib/consumo'
import { VentaTicket } from '@/components/pos/VentaTicket'
import { ConsumoTicket } from '@/components/consumo/ConsumoTicket'

type TicketListItem =
  | ({ tipo: 'venta' } & TicketResumen)
  | ({ tipo: 'consumo' } & ConsumoTicketResumen)

function mergeTickets(
  ventas: TicketResumen[],
  consumos: ConsumoTicketResumen[],
): TicketListItem[] {
  const items: TicketListItem[] = [
    ...ventas.map((v) => ({ tipo: 'venta' as const, ...v })),
    ...consumos.map((c) => ({ tipo: 'consumo' as const, ...c })),
  ]
  return items.sort(
    (a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime(),
  )
}

export function HistorialTicketsPage() {
  const [fecha, setFecha] = useState(todayLocalISO())
  const [busqueda, setBusqueda] = useState('')
  const [tickets, setTickets] = useState<TicketListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [detalleVenta, setDetalleVenta] = useState<TicketDetalle | null>(null)
  const [detalleConsumo, setDetalleConsumo] = useState<ConsumoTicketDetalle | null>(null)
  const [cargandoDetalle, setCargandoDetalle] = useState(false)

  const cargarDia = useCallback(async (f: string) => {
    setLoading(true)
    setError('')
    try {
      const [ventas, consumos] = await Promise.all([
        fetchTicketsDelDia(f),
        fetchConsumosTicketDelDia(f),
      ])
      setTickets(mergeTickets(ventas, consumos))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar tickets')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!busqueda.trim()) {
      cargarDia(fecha)
    }
  }, [fecha, busqueda, cargarDia])

  async function handleBuscar() {
    setLoading(true)
    setError('')
    try {
      if (!busqueda.trim()) {
        await cargarDia(fecha)
        return
      }
      const [ventas, consumos] = await Promise.all([
        buscarTickets(busqueda),
        buscarConsumosTicket(busqueda),
      ])
      setTickets(mergeTickets(ventas, consumos))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al buscar')
    } finally {
      setLoading(false)
    }
  }

  async function abrirTicket(item: TicketListItem) {
    setCargandoDetalle(true)
    setError('')
    setDetalleVenta(null)
    setDetalleConsumo(null)
    try {
      if (item.tipo === 'venta') {
        const t = await fetchTicketDetalle(item.id)
        if (!t) {
          setError('Ticket no encontrado')
          return
        }
        setDetalleVenta(t)
      } else {
        const t = await fetchConsumoTicketDetalle(item.id)
        if (!t) {
          setError('Ticket no encontrado')
          return
        }
        setDetalleConsumo(t)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al abrir ticket')
    } finally {
      setCargandoDetalle(false)
    }
  }

  const metodoIcon = (m: string) =>
    m === 'yape' ? (
      <Smartphone className="h-4 w-4 text-purple-600" />
    ) : (
      <Banknote className="h-4 w-4 text-teal-600" />
    )

  const metodoLabel = (m: string) =>
    m === 'yape' ? 'Yape' : m === 'otro' ? 'Otro' : 'Efectivo'

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Historial de tickets</h1>
        <p className="text-slate-500">
          Ventas y consumo propio · vuelve a ver la boleta y reimprime
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleBuscar()}
            placeholder="Código ticket (ej: A1B2C3D4)…"
            className="w-full rounded-xl border border-slate-300 py-3 pl-10 pr-4 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
          />
        </div>
        <input
          type="date"
          value={fecha}
          max={todayLocalISO()}
          onChange={(e) => {
            setBusqueda('')
            setFecha(e.target.value)
          }}
          disabled={!!busqueda.trim()}
          className="rounded-xl border border-slate-300 px-3 py-3 text-sm outline-none focus:border-teal-500 disabled:opacity-50"
          title={busqueda.trim() ? 'Limpia la búsqueda para filtrar por fecha' : 'Tickets del día'}
        />
        <button
          onClick={handleBuscar}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-teal-600 px-4 py-3 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          Buscar
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {loading && tickets.length === 0 ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
        </div>
      ) : tickets.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white py-16 text-center">
          <Receipt className="mx-auto h-12 w-12 text-slate-300" />
          <p className="mt-4 font-medium text-slate-600">No hay tickets</p>
          <p className="text-sm text-slate-400">Prueba otra fecha o código</p>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-slate-500">
            {tickets.length} ticket{tickets.length === 1 ? '' : 's'}
            {!busqueda.trim() && ` · ${fecha}`}
          </p>
          {tickets.map((t) => (
            <button
              key={`${t.tipo}-${t.id}`}
              type="button"
              onClick={() => abrirTicket(t)}
              disabled={cargandoDetalle}
              className="flex w-full items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-left shadow-sm transition hover:border-teal-300 hover:bg-teal-50/50 disabled:opacity-50"
            >
              <div
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
                  t.tipo === 'consumo' ? 'bg-orange-50' : 'bg-teal-50'
                }`}
              >
                {t.tipo === 'consumo' ? (
                  <ShoppingBasket className="h-5 w-5 text-orange-700" />
                ) : (
                  <Receipt className="h-5 w-5 text-teal-700" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-slate-900">
                  {t.tipo === 'consumo' ? 'Consumo' : 'Venta'} {codigoTicket(t.id)}
                </p>
                <p className="text-xs text-slate-500">
                  {new Date(t.fecha).toLocaleString('es-PE')} ·{' '}
                  {t.tipo === 'consumo' ? t.registrado_por_nombre : t.cajero_nombre}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="font-bold text-slate-900">
                  {formatMoney(t.tipo === 'consumo' ? t.total_costo : t.total)}
                </p>
                {t.tipo === 'venta' ? (
                  <p className="flex items-center justify-end gap-1 text-xs text-slate-500">
                    {metodoIcon(t.metodo_pago)}
                    {metodoLabel(t.metodo_pago)}
                  </p>
                ) : (
                  <p className="text-xs text-orange-600">Al costo</p>
                )}
              </div>
              <Eye className="h-4 w-4 shrink-0 text-slate-400" />
            </button>
          ))}
        </div>
      )}

      {cargandoDetalle && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30">
          <Loader2 className="h-10 w-10 animate-spin text-white" />
        </div>
      )}

      {detalleVenta && (
        <VentaTicket
          venta={detalleVenta}
          cajeroNombre={detalleVenta.cajero_nombre}
          onClose={() => setDetalleVenta(null)}
          historial
        />
      )}

      {detalleConsumo && (
        <ConsumoTicket
          consumo={detalleConsumo}
          registradoPor={detalleConsumo.registrado_por_nombre}
          onClose={() => setDetalleConsumo(null)}
          historial
        />
      )}
    </div>
  )
}
