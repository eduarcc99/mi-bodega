import { Printer, X, CheckCircle, Receipt, RotateCcw } from 'lucide-react'
import type { VentaCompletada } from '@/lib/pos'
import { cartItemSubtotal, cartTotal, etiquetaCantidadItem } from '@/lib/pos'
import type { DevolucionTicketInfo } from '@/lib/tickets'
import { formatMoney } from '@/lib/utils'

interface VentaTicketProps {
  venta: VentaCompletada
  cajeroNombre: string
  onClose: () => void
  /** Título del encabezado (default: venta recién registrada) */
  titulo?: string
  /** Texto del botón primario (default: Nueva venta) */
  botonCerrar?: string
  historial?: boolean
  devolucion?: DevolucionTicketInfo
}

export function VentaTicket({
  venta,
  cajeroNombre,
  onClose,
  titulo,
  botonCerrar,
  historial = false,
  devolucion,
}: VentaTicketProps) {
  const metodoLabel = {
    efectivo: 'Efectivo',
    yape: 'Yape',
    otro: 'Otro',
  }[venta.metodo_pago]

  const totalOriginal = cartTotal(venta.items) || venta.total
  const devuelto = devolucion?.total_devuelto ?? 0
  const neto = Math.round((totalOriginal - devuelto) * 100) / 100
  const esDevuelto = devolucion?.tiene_devolucion ?? false
  const esDevolucionCompleta = devolucion?.devolucion_completa ?? false

  function handlePrint() {
    window.print()
  }

  const headerColor = esDevolucionCompleta
    ? 'text-red-600'
    : esDevuelto
      ? 'text-amber-600'
      : 'text-emerald-600'

  const modalBorder = esDevolucionCompleta
    ? 'ring-2 ring-red-200'
    : esDevuelto
      ? 'ring-2 ring-amber-200'
      : ''

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center print:bg-white print:p-0">
      <div
        className={`w-full max-w-md rounded-2xl bg-white shadow-xl print:max-w-none print:shadow-none ${modalBorder}`}
      >
        <div className="flex items-center justify-between border-b border-slate-100 p-4 print:hidden">
          <div className={`flex items-center gap-2 ${headerColor}`}>
            {esDevuelto ? (
              <RotateCcw className="h-5 w-5" />
            ) : historial ? (
              <Receipt className="h-5 w-5" />
            ) : (
              <CheckCircle className="h-5 w-5" />
            )}
            <span className="font-semibold">
              {titulo ??
                (esDevolucionCompleta
                  ? 'Ticket devuelto'
                  : esDevuelto
                    ? 'Ticket con devolución'
                    : historial
                      ? 'Ticket / boleta'
                      : 'Venta registrada')}
            </span>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div
          id="ticket"
          className={`relative overflow-hidden p-6 font-mono text-sm ${
            esDevolucionCompleta ? 'bg-red-50/40' : esDevuelto ? 'bg-amber-50/30' : ''
          }`}
        >
          {esDevuelto && (
            <div
              className="pointer-events-none absolute inset-0 flex items-center justify-center"
              aria-hidden
            >
              <span
                className={`rotate-[-22deg] select-none text-4xl font-black uppercase tracking-[0.2em] sm:text-5xl ${
                  esDevolucionCompleta ? 'text-red-200/90' : 'text-amber-200/90'
                }`}
              >
                {esDevolucionCompleta ? 'DEVUELTO' : 'DEV. PARCIAL'}
              </span>
            </div>
          )}

          <div className="relative text-center">
            <p className="text-lg font-bold">MI BODEGA</p>
            <p className="text-xs text-slate-500">Comprobante de venta</p>
            {esDevuelto && (
              <p
                className={`mt-2 inline-block rounded-full px-3 py-0.5 text-xs font-bold uppercase tracking-wide ${
                  esDevolucionCompleta
                    ? 'bg-red-100 text-red-700'
                    : 'bg-amber-100 text-amber-800'
                }`}
              >
                {esDevolucionCompleta ? 'Devuelto' : 'Devolución parcial'}
              </p>
            )}
          </div>

          <div className="relative my-4 border-y border-dashed border-slate-300 py-3 text-xs text-slate-600">
            <p>Fecha: {new Date(venta.fecha).toLocaleString('es-PE')}</p>
            <p>Cajero: {cajeroNombre}</p>
            <p>Ticket: {venta.id.slice(0, 8).toUpperCase()}</p>
            <p>Pago: {metodoLabel}</p>
          </div>

          <div className="relative space-y-2">
            {venta.items.map((item) => (
              <div key={item.key} className="flex justify-between gap-2">
                <div className="flex-1">
                  <p className="font-medium">{item.nombre}</p>
                  <p className="text-xs text-slate-500">
                    {etiquetaCantidadItem(item)} × {formatMoney(item.precio_unitario)}
                    {item.descuento > 0 && ` (−${formatMoney(item.descuento)})`}
                  </p>
                </div>
                <p className="font-medium">{formatMoney(cartItemSubtotal(item))}</p>
              </div>
            ))}
          </div>

          <div className="relative mt-4 space-y-1 border-t border-dashed border-slate-300 pt-3">
            <div
              className={`flex justify-between text-base font-bold ${
                esDevuelto ? 'text-slate-500 line-through' : ''
              }`}
            >
              <span>TOTAL</span>
              <span>{formatMoney(totalOriginal)}</span>
            </div>
            {esDevuelto && (
              <>
                <div className="flex justify-between text-sm font-semibold text-red-600">
                  <span>Devuelto</span>
                  <span>−{formatMoney(devuelto)}</span>
                </div>
                {!esDevolucionCompleta && (
                  <div className="flex justify-between text-base font-bold text-slate-900">
                    <span>NETO</span>
                    <span>{formatMoney(neto)}</span>
                  </div>
                )}
              </>
            )}
          </div>

          <p className="relative mt-4 text-center text-xs text-slate-400">
            {esDevolucionCompleta ? 'Venta devuelta al cliente' : '¡Gracias por su compra!'}
          </p>
        </div>

        <div className="flex gap-2 border-t border-slate-100 p-4 print:hidden">
          <button
            onClick={handlePrint}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-slate-200 py-3 font-medium text-slate-700 hover:bg-slate-50"
          >
            <Printer className="h-4 w-4" />
            {historial ? 'Reimprimir' : 'Imprimir'}
          </button>
          <button
            onClick={onClose}
            className={`flex-1 rounded-lg py-3 font-semibold text-white ${
              esDevolucionCompleta
                ? 'bg-red-600 hover:bg-red-700'
                : esDevuelto
                  ? 'bg-amber-600 hover:bg-amber-700'
                  : 'bg-teal-600 hover:bg-teal-700'
            }`}
          >
            {botonCerrar ?? (historial ? 'Cerrar' : 'Nueva venta')}
          </button>
        </div>
      </div>
    </div>
  )
}
