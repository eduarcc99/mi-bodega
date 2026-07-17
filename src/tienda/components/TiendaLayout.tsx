import { Outlet, Link, useLocation } from 'react-router-dom'
import { ShoppingBag, MapPin, Clock, ArrowLeft } from 'lucide-react'
import { TIENDA_CONFIG } from '@/tienda/config'
import { tiendaPath } from '@/tienda/routes'
import { mensajeHorario, mensajeHorarioHoy, isTiendaAbierta } from '@/tienda/lib/horario'
import { totalConDelivery } from '@/tienda/lib/delivery'
import { useTiendaCart } from '@/tienda/context/TiendaCartContext'
import { formatMoney } from '@/lib/utils'
import { useDocumentMeta } from '@/hooks/useDocumentMeta'

export function TiendaLayout() {
  const { count, total: subtotal } = useTiendaCart()
  const totalPedido = totalConDelivery(subtotal)
  const location = useLocation()
  const abierta = isTiendaAbierta()
  const enCarrito = location.pathname.includes('/carrito') || location.pathname.includes('/checkout')
  const enConfirmado = location.pathname.includes('/confirmado')

  useDocumentMeta(`${TIENDA_CONFIG.nombre} — Pedidos`, '/favicon-marghot.svg')

  return (
    <div className="min-h-screen bg-gradient-to-b from-rose-50 via-white to-slate-50">
      <header className="sticky top-0 z-40 bg-gradient-to-r from-rose-950 via-rose-900 to-rose-800 text-white shadow-lg">
        <div className="mx-auto max-w-lg px-4 py-5">
          {!enCarrito && !enConfirmado ? (
            <>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-medium uppercase tracking-[0.2em] text-rose-200/90">
                    Delivery
                  </p>
                  <h1 className="text-3xl font-bold tracking-tight">{TIENDA_CONFIG.nombre}</h1>
                  <p className="mt-1 text-sm text-rose-100">{TIENDA_CONFIG.tagline}</p>
                  <p className="text-xs text-rose-200/80">{TIENDA_CONFIG.frase}</p>
                </div>
                <div className="rounded-full bg-white/10 px-3 py-1.5 text-center backdrop-blur-sm">
                  <MapPin className="mx-auto h-4 w-4 text-rose-200" />
                  <p className="mt-0.5 text-[10px] font-semibold uppercase">{TIENDA_CONFIG.zona}</p>
                </div>
              </div>
              <div
                className={`mt-4 inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium ${
                  abierta ? 'bg-emerald-500/20 text-emerald-100' : 'bg-amber-500/20 text-amber-100'
                }`}
              >
                <Clock className="h-3.5 w-3.5" />
                {abierta
                  ? `Abierto · ${mensajeHorarioHoy()}`
                  : `Cerrado · ${mensajeHorario()}`}
              </div>
              {abierta && (
                <p className="mt-2 text-xs text-rose-200/90">{TIENDA_CONFIG.promoEnvio}</p>
              )}
            </>
          ) : (
            <div className="flex items-center gap-3">
              <Link
                to={tiendaPath()}
                className="rounded-full bg-white/10 p-2 hover:bg-white/20"
              >
                <ArrowLeft className="h-5 w-5" />
              </Link>
              <div>
                <h1 className="text-lg font-bold">
                  {enConfirmado ? 'Pedido enviado' : location.pathname.includes('checkout') ? 'Confirmar pedido' : 'Tu carrito'}
                </h1>
                <p className="text-xs text-rose-200">{TIENDA_CONFIG.nombre} · {TIENDA_CONFIG.zona}</p>
              </div>
            </div>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-lg px-4 pb-28 pt-4">
        <Outlet />
      </main>

      {!enCarrito && !enConfirmado && count > 0 && (
        <Link
          to={tiendaPath('carrito')}
          className="fixed bottom-5 left-1/2 z-50 flex w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 items-center justify-between rounded-2xl bg-rose-900 px-5 py-4 text-white shadow-2xl shadow-rose-900/30 transition hover:bg-rose-800"
        >
          <div className="flex items-center gap-3">
            <div className="relative">
              <ShoppingBag className="h-6 w-6" />
              <span className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-amber-400 text-[10px] font-bold text-rose-950">
                {Math.round(count)}
              </span>
            </div>
            <span className="font-semibold">Ver carrito</span>
          </div>
          <span className="text-lg font-bold">{formatMoney(totalPedido)}</span>
        </Link>
      )}
    </div>
  )
}
