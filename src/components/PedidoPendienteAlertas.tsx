import { Link } from 'react-router-dom'
import { BellRing, ShoppingBag, X } from 'lucide-react'
import { formatMoney } from '@/lib/utils'
import { usePedidoNotificationsContext } from '@/contexts/PedidoNotificationsContext'

export function PedidoPendienteAlertas() {
  const { pendientesCount, pedidoToast, descartarToast } = usePedidoNotificationsContext()

  const labelPendientes =
    pendientesCount === 1
      ? '1 pedido web pendiente'
      : `${pendientesCount} pedidos web pendientes`

  return (
    <>
      {pendientesCount > 0 && (
        <div className="sticky top-0 z-40 border-b border-amber-300 bg-amber-400 px-4 py-2.5 shadow-sm dark:border-amber-600 dark:bg-amber-600">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2 text-amber-950 dark:text-amber-50">
              <BellRing className="h-5 w-5 shrink-0 animate-pulse" />
              <p className="truncate text-sm font-bold">{labelPendientes}</p>
              <span className="hidden text-xs font-medium text-amber-900/80 sm:inline dark:text-amber-100/80">
                · recordatorio cada 60 s
              </span>
            </div>
            <Link
              to="/pedidos-web"
              className="shrink-0 rounded-lg bg-amber-950 px-3 py-1.5 text-xs font-bold text-amber-50 hover:bg-amber-900 dark:bg-amber-950 dark:hover:bg-black"
            >
              Ver pedidos
            </Link>
          </div>
        </div>
      )}

      {pedidoToast && (
        <div className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex justify-center px-4 sm:bottom-6">
          <div className="pointer-events-auto flex w-full max-w-md items-start gap-3 rounded-2xl border border-amber-200 bg-white p-4 shadow-2xl shadow-amber-900/20 dark:border-amber-700 dark:bg-slate-900">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-950">
              <ShoppingBag className="h-5 w-5 text-amber-700 dark:text-amber-300" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-slate-900 dark:text-slate-100">Nuevo pedido web</p>
              <p className="mt-0.5 truncate text-sm text-slate-600 dark:text-slate-300">
                {pedidoToast.cliente_nombre} · {formatMoney(pedidoToast.total)}
              </p>
              <Link
                to="/pedidos-web"
                onClick={descartarToast}
                className="mt-2 inline-flex rounded-lg bg-teal-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-teal-700"
              >
                Ver pedido
              </Link>
            </div>
            <button
              type="button"
              onClick={descartarToast}
              className="shrink-0 rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
              aria-label="Cerrar aviso"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </>
  )
}
