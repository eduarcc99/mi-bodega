import { Printer, X, Receipt, RotateCcw, Loader2 } from 'lucide-react'
import { useRef, useState } from 'react'
import type { VentaCompletada } from '@/lib/pos'
import { cartItemSubtotal, cartTotal, etiquetaCantidadItem } from '@/lib/pos'
import type { DevolucionTicketInfo } from '@/lib/tickets'
import { codigoTicket } from '@/lib/tickets'
import { compartirTicketImagen } from '@/lib/ticketShare'
import type { TicketEntregaInfo } from '@/lib/ticketBranding'
import { telefonoBodegaDisplay } from '@/lib/ticketBranding'
import { TicketQrMarghot } from '@/components/pos/TicketQrMarghot'
import { formatMoney } from '@/lib/utils'

function IconoWhatsApp({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.435 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  )
}

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
  /** Delivery: muestra C3 (cobrar al entregar) o C4 (ya pagado) */
  entrega?: TicketEntregaInfo
}

export function VentaTicket({
  venta,
  cajeroNombre,
  onClose,
  titulo,
  botonCerrar,
  historial = false,
  devolucion,
  entrega,
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

  const ticketRef = useRef<HTMLDivElement>(null)
  const [compartiendoWa, setCompartiendoWa] = useState(false)
  const [avisoWa, setAvisoWa] = useState('')

  function handlePrint() {
    window.print()
  }

  async function handleWhatsApp() {
    if (!ticketRef.current || compartiendoWa) return
    setCompartiendoWa(true)
    setAvisoWa('')
    try {
      const resultado = await compartirTicketImagen(
        ticketRef.current,
        `ticket-${codigoTicket(venta.id)}.png`,
      )
      if (resultado === 'downloaded') {
        setAvisoWa('Imagen descargada — ábrela en WhatsApp y adjúntala al chat')
      }
    } catch (e) {
      setAvisoWa(e instanceof Error ? e.message : 'No se pudo compartir la imagen')
    } finally {
      setCompartiendoWa(false)
    }
  }

  const modalBorder = esDevolucionCompleta
    ? 'ring-2 ring-red-200'
    : esDevuelto
      ? 'ring-2 ring-amber-200'
      : ''

  const tituloHeader =
    titulo ??
    (esDevolucionCompleta
      ? 'Ticket devuelto'
      : esDevuelto
        ? 'Ticket con devolución'
        : 'Ticket / boleta')

  const headerIconColor = esDevolucionCompleta
    ? 'text-red-600'
    : esDevuelto
      ? 'text-amber-600'
      : 'text-teal-600'

  const headerTextColor = esDevolucionCompleta
    ? 'text-red-700'
    : esDevuelto
      ? 'text-amber-700'
      : 'text-teal-700'

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center print:bg-white print:p-0">
      <div
        className={`relative w-full max-w-md rounded-2xl bg-white shadow-xl dark:bg-white print:max-w-none print:shadow-none ${modalBorder}`}
      >
        <button
          onClick={onClose}
          className="absolute right-3 top-3 z-10 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 print:hidden"
          aria-label="Cerrar"
        >
          <X className="h-5 w-5" />
        </button>

        <div
          ref={ticketRef}
          data-ticket-captura
          className="overflow-hidden rounded-2xl bg-white text-slate-900 dark:bg-white dark:text-slate-900"
          style={{ colorScheme: 'light' }}
        >
          <div className="flex items-center gap-2 border-b border-slate-200 bg-white px-4 py-4 pr-12 dark:border-slate-200 dark:bg-white">
            {esDevuelto ? (
              <RotateCcw className={`h-5 w-5 shrink-0 ${headerIconColor}`} />
            ) : (
              <Receipt className={`h-5 w-5 shrink-0 ${headerIconColor}`} />
            )}
            <span className={`font-semibold ${headerTextColor}`}>{tituloHeader}</span>
          </div>

          <div
            id="ticket"
            className={`relative overflow-hidden bg-white p-6 font-mono text-sm text-slate-900 dark:bg-white dark:text-slate-900 ${
              esDevolucionCompleta ? 'bg-red-50' : esDevuelto ? 'bg-amber-50' : ''
            }`}
          >
          <div className="pointer-events-none absolute right-4 top-4 z-10 text-center">
            <TicketQrMarghot size={68} />
            <p className="mt-0.5 text-[9px] font-sans font-medium uppercase tracking-wide text-slate-400 dark:text-slate-400">
              MARGHOT
            </p>
          </div>

          {entrega && (
            <div
              className={`relative mb-3 rounded-lg border px-3 py-2 text-center text-xs font-bold uppercase tracking-wide ${
                entrega.cobrarAlEntregar
                  ? 'border-amber-300 bg-amber-100 text-amber-900'
                  : 'border-emerald-300 bg-emerald-100 text-emerald-900'
              }`}
            >
              {entrega.cobrarAlEntregar
                ? `Cobrar al entregar — ${formatMoney(neto > 0 && esDevuelto ? neto : totalOriginal)}`
                : 'Pagado — entregar mercadería'}
            </div>
          )}

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

          <div className="relative pr-20 text-center">
            <p className="text-lg font-bold text-slate-900 dark:text-slate-900">MI BODEGA</p>
            <p className="text-xs text-slate-500 dark:text-slate-500">Comprobante de venta</p>
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

          <div className="relative my-4 border-y border-dashed border-slate-300 py-3 text-xs text-slate-600 dark:border-slate-300 dark:text-slate-600">
            <p>Fecha: {new Date(venta.fecha).toLocaleString('es-PE')}</p>
            <p>Cajero: {cajeroNombre}</p>
            <p>Ticket: {venta.id.slice(0, 8).toUpperCase()}</p>
            <p>Pago: {metodoLabel}</p>
          </div>

          <div className="relative space-y-2">
            {venta.items.map((item) => (
              <div key={item.key} className="flex justify-between gap-2">
                <div className="flex-1">
                  <p className="font-medium text-slate-900 dark:text-slate-900">{item.nombre}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-500">
                    {etiquetaCantidadItem(item)} × {formatMoney(item.precio_unitario)}
                    {item.descuento > 0 && ` (−${formatMoney(item.descuento)})`}
                  </p>
                </div>
                <p className="font-medium text-slate-900 dark:text-slate-900">
                  {formatMoney(cartItemSubtotal(item))}
                </p>
              </div>
            ))}
          </div>

          <div className="relative mt-4 space-y-1 border-t border-dashed border-slate-300 pt-3 dark:border-slate-300">
            <div
              className={`flex justify-between text-base font-bold text-slate-900 dark:text-slate-900 ${
                esDevuelto ? 'text-slate-500 line-through dark:text-slate-500' : ''
              }`}
            >
              <span>TOTAL</span>
              <span>{formatMoney(totalOriginal)}</span>
            </div>
            {esDevuelto && (
              <>
                <div className="flex justify-between text-sm font-semibold text-red-600 dark:text-red-600">
                  <span>Devuelto</span>
                  <span>−{formatMoney(devuelto)}</span>
                </div>
                {!esDevolucionCompleta && (
                  <div className="flex justify-between text-base font-bold text-slate-900 dark:text-slate-900">
                    <span>NETO</span>
                    <span>{formatMoney(neto)}</span>
                  </div>
                )}
              </>
            )}
          </div>

          <div className="relative mt-4 space-y-1 border-t border-dashed border-slate-300 pt-3 text-center text-xs text-slate-500 dark:border-slate-300 dark:text-slate-500">
            <p className="font-medium text-slate-600 dark:text-slate-600">
              WhatsApp: {telefonoBodegaDisplay()}
            </p>
            <p>Pide delivery en MARGHOT · escanea el QR</p>
            <p className="text-slate-400 dark:text-slate-400">
              {esDevolucionCompleta ? 'Venta devuelta al cliente' : '¡Gracias por su compra!'}
            </p>
          </div>
          </div>
        </div>

        {avisoWa && (
          <p className="border-t border-slate-100 px-4 py-2 text-center text-xs text-slate-600 print:hidden">
            {avisoWa}
          </p>
        )}

        <div className="flex gap-2 border-t border-slate-100 p-4 print:hidden">
          <button
            onClick={handlePrint}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-slate-200 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <Printer className="h-4 w-4 shrink-0" />
            {historial ? 'Reimprimir' : 'Imprimir'}
          </button>
          <button
            type="button"
            onClick={handleWhatsApp}
            disabled={compartiendoWa}
            title="Compartir imagen por WhatsApp"
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-[#25D366] py-3 text-sm font-semibold text-white hover:bg-[#20bd5a] disabled:opacity-60"
          >
            {compartiendoWa ? (
              <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
            ) : (
              <IconoWhatsApp className="h-4 w-4 shrink-0" />
            )}
            {compartiendoWa ? 'Generando…' : 'WhatsApp'}
          </button>
          <button
            onClick={onClose}
            className={`flex-1 rounded-lg py-3 text-sm font-semibold text-white ${
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
