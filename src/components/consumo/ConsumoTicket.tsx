import { Printer, X, CheckCircle, Receipt } from 'lucide-react'
import {
  type ConsumoCompletado,
  itemCosto,
  etiquetaCantidadItem,
} from '@/lib/consumo'
import { codigoTicket } from '@/lib/tickets'
import { formatMoney } from '@/lib/utils'

interface ConsumoTicketProps {
  consumo: ConsumoCompletado
  registradoPor: string
  onClose: () => void
  titulo?: string
  botonCerrar?: string
  historial?: boolean
}

export function ConsumoTicket({
  consumo,
  registradoPor,
  onClose,
  titulo,
  botonCerrar,
  historial = false,
}: ConsumoTicketProps) {
  function handlePrint() {
    window.print()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center print:bg-white print:p-0">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-xl print:max-w-none print:shadow-none">
        <div className="flex items-center justify-between border-b border-slate-100 p-4 print:hidden">
          <div className="flex items-center gap-2 text-orange-600">
            {historial ? <Receipt className="h-5 w-5" /> : <CheckCircle className="h-5 w-5" />}
            <span className="font-semibold">
              {titulo ?? (historial ? 'Ticket consumo propio' : 'Retiro registrado')}
            </span>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div id="ticket-consumo" className="p-6 font-mono text-sm">
          <div className="text-center">
            <p className="text-lg font-bold">MI BODEGA</p>
            <p className="text-xs text-slate-500">Comprobante de consumo propio</p>
          </div>

          <div className="my-4 border-y border-dashed border-slate-300 py-3 text-xs text-slate-600">
            <p>Fecha: {new Date(consumo.fecha).toLocaleString('es-PE')}</p>
            <p>Registrado por: {registradoPor}</p>
            <p>Ticket: {codigoTicket(consumo.id)}</p>
            {consumo.motivo && <p>Motivo: {consumo.motivo}</p>}
            {consumo.notas && <p>Notas: {consumo.notas}</p>}
          </div>

          <div className="space-y-2">
            {consumo.items.map((item) => (
              <div key={item.key} className="flex justify-between gap-2">
                <div className="flex-1">
                  <p className="font-medium">{item.nombre}</p>
                  <p className="text-xs text-slate-500">
                    {etiquetaCantidadItem(item)} × {formatMoney(item.costo_unitario)} (costo)
                  </p>
                </div>
                <p className="font-medium">{formatMoney(itemCosto(item))}</p>
              </div>
            ))}
          </div>

          <div className="mt-4 space-y-1 border-t border-dashed border-slate-300 pt-3 text-xs text-slate-600">
            <div className="flex justify-between">
              <span>Si se hubiera vendido</span>
              <span>{formatMoney(consumo.total_venta_potencial)}</span>
            </div>
            <div className="flex justify-between">
              <span>Dejó de ganar</span>
              <span>{formatMoney(consumo.oportunidad_perdida)}</span>
            </div>
          </div>

          <div className="mt-3 flex justify-between text-base font-bold">
            <span>TOTAL AL COSTO</span>
            <span>{formatMoney(consumo.total_costo)}</span>
          </div>

          <p className="mt-4 text-center text-xs text-slate-400">
            Sin pago · no afecta caja · baja inventario
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
            className="flex-1 rounded-lg bg-orange-600 py-3 font-semibold text-white hover:bg-orange-700"
          >
            {botonCerrar ?? (historial ? 'Cerrar' : 'Listo')}
          </button>
        </div>
      </div>
    </div>
  )
}
