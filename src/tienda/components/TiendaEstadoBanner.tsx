import { Clock, Moon, Store } from 'lucide-react'
import { isTiendaAbierta, mensajeHorario, proximaApertura } from '@/tienda/lib/horario'

/** Banner compacto: tienda cerrada pero catálogo visible */
export function TiendaCerradoBanner() {
  return (
    <div className="rounded-xl border border-amber-200/90 bg-amber-50 px-4 py-3">
      <div className="flex items-start gap-3">
        <div className="rounded-full bg-amber-100 p-2">
          <Moon className="h-4 w-4 text-amber-700" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-amber-950">Delivery cerrado ahora</p>
          <p className="mt-0.5 text-xs font-medium text-amber-900">{proximaApertura()}</p>
          <p className="mt-1 text-[11px] text-amber-800/90">
            Puedes ver precios y productos. Los pedidos se activan en horario de delivery.
          </p>
        </div>
      </div>
    </div>
  )
}

/** Horario de delivery en pantalla de carga */
export function TiendaHorarioCarga() {
  const abierta = isTiendaAbierta()

  return (
    <div
      className={`rounded-xl border px-4 py-3 ${
        abierta
          ? 'border-emerald-200 bg-emerald-50'
          : 'border-slate-200 bg-white shadow-sm'
      }`}
    >
      <div className="flex items-center gap-2">
        {abierta ? (
          <Store className="h-4 w-4 shrink-0 text-emerald-600" />
        ) : (
          <Clock className="h-4 w-4 shrink-0 text-rose-700" />
        )}
        <p className={`text-sm font-bold ${abierta ? 'text-emerald-900' : 'text-slate-900'}`}>
          {abierta ? 'Delivery abierto ahora' : 'Horario de delivery'}
        </p>
      </div>
      <p className={`mt-1 text-xs ${abierta ? 'text-emerald-800' : 'text-slate-600'}`}>
        {mensajeHorario()}
      </p>
      {!abierta && (
        <p className="mt-1 text-[11px] font-medium text-rose-800">{proximaApertura()}</p>
      )}
    </div>
  )
}
