import { Printer, X, CheckCircle } from 'lucide-react'
import type { VentaCompletada } from '@/lib/pos'
import { cartItemSubtotal, cartTotal, etiquetaCantidadItem } from '@/lib/pos'
import { formatMoney } from '@/lib/utils'

interface VentaTicketProps {
  venta: VentaCompletada
  cajeroNombre: string
  onClose: () => void
}

export function VentaTicket({ venta, cajeroNombre, onClose }: VentaTicketProps) {
  const metodoLabel = {
    efectivo: 'Efectivo',
    yape: 'Yape',
    otro: 'Otro',
  }[venta.metodo_pago]

  function handlePrint() {
    window.print()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center print:bg-white print:p-0">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-xl print:max-w-none print:shadow-none">
        <div className="flex items-center justify-between border-b border-slate-100 p-4 print:hidden">
          <div className="flex items-center gap-2 text-emerald-600">
            <CheckCircle className="h-5 w-5" />
            <span className="font-semibold">Venta registrada</span>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div id="ticket" className="p-6 font-mono text-sm">
          <div className="text-center">
            <p className="text-lg font-bold">MI BODEGA</p>
            <p className="text-xs text-slate-500">Comprobante de venta</p>
          </div>

          <div className="my-4 border-y border-dashed border-slate-300 py-3 text-xs text-slate-600">
            <p>Fecha: {new Date(venta.fecha).toLocaleString('es-PE')}</p>
            <p>Cajero: {cajeroNombre}</p>
            <p>Ticket: {venta.id.slice(0, 8).toUpperCase()}</p>
            <p>Pago: {metodoLabel}</p>
          </div>

          <div className="space-y-2">
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

          <div className="mt-4 flex justify-between border-t border-dashed border-slate-300 pt-3 text-base font-bold">
            <span>TOTAL</span>
            <span>{formatMoney(cartTotal(venta.items))}</span>
          </div>

          <p className="mt-4 text-center text-xs text-slate-400">¡Gracias por su compra!</p>
        </div>

        <div className="flex gap-2 border-t border-slate-100 p-4 print:hidden">
          <button
            onClick={handlePrint}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-slate-200 py-3 font-medium text-slate-700 hover:bg-slate-50"
          >
            <Printer className="h-4 w-4" />
            Imprimir
          </button>
          <button
            onClick={onClose}
            className="flex-1 rounded-lg bg-teal-600 py-3 font-semibold text-white hover:bg-teal-700"
          >
            Nueva venta
          </button>
        </div>
      </div>
    </div>
  )
}
