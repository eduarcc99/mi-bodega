import { useLayoutEffect, useRef, useState } from 'react'
import { Outlet, Link, useLocation } from 'react-router-dom'
import { ShoppingBag, MapPin, Clock, ArrowLeft, ChevronUp } from 'lucide-react'
import { TIENDA_CONFIG } from '@/tienda/config'
import { TIENDA_BASE, tiendaPath } from '@/tienda/routes'
import { mensajeHorario, mensajeHorarioHoy, isTiendaAbierta } from '@/tienda/lib/horario'
import { totalConDelivery } from '@/tienda/lib/delivery'
import { useTiendaCart } from '@/tienda/context/TiendaCartContext'
import {
  TiendaCatalogProvider,
  useTiendaCatalogOptional,
} from '@/tienda/context/TiendaCatalogContext'
import { CartBadge } from '@/tienda/components/CartBadge'
import { TiendaCompactHeader } from '@/tienda/components/TiendaCompactHeader'
import { TiendaDesktopHeader } from '@/tienda/components/TiendaDesktopHeader'
import { CategoryMenuSheet } from '@/tienda/components/CategoryMenuSheet'
import { formatMoney } from '@/lib/utils'
import { useDocumentMeta } from '@/hooks/useDocumentMeta'

function TiendaLayoutInner() {
  const { count, total: subtotal } = useTiendaCart()
  const totalPedido = totalConDelivery(subtotal)
  const location = useLocation()
  const catalog = useTiendaCatalogOptional()
  const abierta = isTiendaAbierta()
  const enCarrito = location.pathname.includes('/carrito') || location.pathname.includes('/checkout')
  const enConfirmado = location.pathname.includes('/confirmado')
  const enCatalogo =
    location.pathname === TIENDA_BASE || location.pathname === `${TIENDA_BASE}/`
  const mostrarBarraCarrito = !enCarrito && !enConfirmado && count > 0
  const headerCompact = enCatalogo && (catalog?.headerCompact ?? false)

  const expandedHeaderRef = useRef<HTMLElement>(null)
  const compactHeaderRef = useRef<HTMLElement>(null)
  const desktopHeaderRef = useRef<HTMLElement>(null)
  const cartHeaderRef = useRef<HTMLElement>(null)
  const [expandedHeight, setExpandedHeight] = useState(0)
  const [compactHeight, setCompactHeight] = useState(0)
  const [desktopHeight, setDesktopHeight] = useState(0)
  const [cartHeaderHeight, setCartHeaderHeight] = useState(0)
  const [isDesktop, setIsDesktop] = useState(false)
  const [showScrollTop, setShowScrollTop] = useState(false)

  const usarHeaderDesktop = enCatalogo && !enCarrito && !enConfirmado && isDesktop
  const usarHeaderCarritoDesktop = (enCarrito || enConfirmado) && isDesktop
  const headerHeight = usarHeaderCarritoDesktop
    ? cartHeaderHeight || 72
    : usarHeaderDesktop
      ? desktopHeight || 64
      : headerCompact
        ? compactHeight || 56
        : expandedHeight || 200

  useDocumentMeta(`${TIENDA_CONFIG.nombre} — Pedidos`, '/favicon-marghot.svg')

  useLayoutEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)')
    const update = () => setIsDesktop(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])

  useLayoutEffect(() => {
    const expanded = expandedHeaderRef.current
    const compact = compactHeaderRef.current
    const desktop = desktopHeaderRef.current
    const cart = cartHeaderRef.current

    const measure = () => {
      if (expanded) setExpandedHeight(expanded.offsetHeight)
      if (compact) setCompactHeight(compact.offsetHeight)
      if (desktop) setDesktopHeight(desktop.offsetHeight)
      if (cart) setCartHeaderHeight(cart.offsetHeight)
    }
    measure()

    const observer = new ResizeObserver(measure)
    if (expanded) observer.observe(expanded)
    if (compact) observer.observe(compact)
    if (desktop) observer.observe(desktop)
    if (cart) observer.observe(cart)
    window.addEventListener('resize', measure)

    return () => {
      observer.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [enCarrito, enConfirmado, abierta, enCatalogo, isDesktop])

  useLayoutEffect(() => {
    if (!enCatalogo || isDesktop) {
      setShowScrollTop(false)
      return
    }

    function onScroll() {
      setShowScrollTop(window.scrollY > 320)
    }

    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [enCatalogo, isDesktop])

  function scrollToTop() {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <div className="tienda-root min-h-screen bg-gradient-to-b from-rose-50 via-white to-slate-50 lg:bg-neutral-100">
      {enCatalogo && !isDesktop && (
        <TiendaCompactHeader headerRef={compactHeaderRef} visible={headerCompact} />
      )}

      {usarHeaderDesktop && <TiendaDesktopHeader headerRef={desktopHeaderRef} />}

      <header
        ref={expandedHeaderRef}
        className={`tienda-header-expanded fixed inset-x-0 top-0 z-50 bg-gradient-to-r from-rose-950 via-rose-900 to-rose-800 text-white shadow-lg lg:hidden ${
          enCatalogo && headerCompact ? 'is-hidden' : ''
        } ${usarHeaderDesktop ? 'pointer-events-none !hidden' : ''}`}
      >
        <div className="mx-auto max-w-lg px-4 py-5">
          {!enCarrito && !enConfirmado ? (
            <>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium uppercase tracking-[0.2em] text-rose-200/90">
                    Delivery
                  </p>
                  <h1 className="text-3xl font-bold tracking-tight">{TIENDA_CONFIG.nombre}</h1>
                  <p className="mt-1 text-sm text-rose-100">{TIENDA_CONFIG.tagline}</p>
                  <p className="text-xs text-rose-200/80">{TIENDA_CONFIG.frase}</p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-2">
                  <div className="rounded-full bg-white/10 px-3 py-1.5 text-center backdrop-blur-sm">
                    <MapPin className="mx-auto h-4 w-4 text-rose-200" />
                    <p className="mt-0.5 text-[10px] font-semibold uppercase">{TIENDA_CONFIG.zona}</p>
                  </div>
                  <Link
                    to={tiendaPath('carrito')}
                    className="tienda-btn relative rounded-full bg-white/15 p-2.5 hover:bg-white/25"
                    aria-label="Ver carrito"
                  >
                    <ShoppingBag className="h-5 w-5" />
                    <CartBadge
                      count={count}
                      className="absolute -right-1 -top-1 h-5 min-w-5 px-1 text-[10px]"
                    />
                  </Link>
                </div>
              </div>
              <div
                className={`mt-4 inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold ${
                  abierta ? 'bg-emerald-500/25 text-emerald-50' : 'bg-amber-500/25 text-amber-50'
                }`}
              >
                <Clock className="h-3.5 w-3.5" />
                {abierta
                  ? `Abierto · ${mensajeHorarioHoy()}`
                  : `Cerrado · ${mensajeHorario()}`}
              </div>
              {abierta && (
                <p className="mt-1.5 text-[10px] leading-snug text-rose-200/75">
                  {TIENDA_CONFIG.promoEnvio}
                </p>
              )}
            </>
          ) : (
            <div className="flex items-center gap-3">
              <Link
                to={tiendaPath()}
                className="tienda-btn rounded-full bg-white/10 p-2 hover:bg-white/20"
              >
                <ArrowLeft className="h-5 w-5" />
              </Link>
              <div className="min-w-0 flex-1">
                <h1 className="text-lg font-bold">
                  {enConfirmado
                    ? 'Pedido enviado'
                    : location.pathname.includes('checkout')
                      ? 'Confirmar pedido'
                      : 'Tu carrito'}
                </h1>
                <p className="text-xs text-rose-200">
                  {TIENDA_CONFIG.nombre} · {TIENDA_CONFIG.zona}
                </p>
              </div>
              {!enConfirmado && (
                <Link
                  to={tiendaPath('carrito')}
                  className="tienda-btn relative shrink-0 rounded-full bg-white/15 p-2 hover:bg-white/25"
                  aria-label="Carrito"
                >
                  <ShoppingBag className="h-5 w-5" />
                  <CartBadge
                    count={count}
                    className="absolute -right-1 -top-1 h-5 min-w-5 px-1 text-[10px]"
                  />
                </Link>
              )}
            </div>
          )}
        </div>
      </header>

      {/* Header carrito/checkout en escritorio */}
      {(enCarrito || enConfirmado) && (
        <header
          ref={cartHeaderRef}
          className="fixed inset-x-0 top-0 z-50 hidden bg-gradient-to-r from-rose-950 via-rose-900 to-rose-800 text-white shadow-lg lg:block"
        >
          <div className="mx-auto flex max-w-7xl items-center gap-3 px-6 py-4">
            <Link
              to={tiendaPath()}
              className="tienda-btn rounded-full bg-white/10 p-2 hover:bg-white/20"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div className="min-w-0 flex-1">
              <h1 className="text-lg font-bold">
                {enConfirmado
                  ? 'Pedido enviado'
                  : location.pathname.includes('checkout')
                    ? 'Confirmar pedido'
                    : 'Tu carrito'}
              </h1>
              <p className="text-xs text-rose-200">
                {TIENDA_CONFIG.nombre} · {TIENDA_CONFIG.zona}
              </p>
            </div>
            {!enConfirmado && (
              <Link
                to={tiendaPath('carrito')}
                className="tienda-btn relative shrink-0 rounded-full bg-white/15 p-2 hover:bg-white/25"
                aria-label="Carrito"
              >
                <ShoppingBag className="h-5 w-5" />
                <CartBadge
                  count={count}
                  className="absolute -right-1 -top-1 h-5 min-w-5 px-1 text-[10px]"
                />
              </Link>
            )}
          </div>
        </header>
      )}

      <div
        className="tienda-header-spacer shrink-0"
        style={{ height: headerHeight }}
        aria-hidden
      />

      <div
        className={`tienda-main relative z-0 mx-auto w-full max-w-lg px-4 pt-4 lg:max-w-7xl lg:px-6 ${
          mostrarBarraCarrito ? 'pb-40' : 'pb-8'
        }`}
      >
        <Outlet />
      </div>

      {mostrarBarraCarrito && (
        <div className="pointer-events-none fixed inset-x-0 bottom-5 z-50 flex justify-center px-4 lg:px-6">
          <Link
            to={tiendaPath('carrito')}
            className="cart-bar-enter tienda-btn pointer-events-auto flex w-full max-w-lg items-center justify-between rounded-2xl bg-rose-900 px-5 py-4 text-white shadow-2xl shadow-rose-900/40 hover:bg-rose-800 lg:max-w-2xl"
          >
            <div className="flex items-center gap-3">
              <div className="relative">
                <ShoppingBag className="h-6 w-6" />
                <CartBadge
                  count={count}
                  className="absolute -right-2 -top-2 h-5 min-w-5 px-1 text-[11px]"
                />
              </div>
              <span className="font-semibold">Ver carrito</span>
            </div>
            <span className="text-lg font-bold">{formatMoney(totalPedido)}</span>
          </Link>
        </div>
      )}

      {enCatalogo && showScrollTop && !isDesktop && (
        <button
          type="button"
          onClick={scrollToTop}
          className={`scroll-top-btn tienda-btn fixed z-[60] flex h-12 w-12 items-center justify-center rounded-full bg-white text-rose-900 shadow-lg ring-1 ring-slate-200/80 hover:bg-rose-50 ${
            mostrarBarraCarrito ? 'bottom-28' : 'bottom-6'
          } right-4`}
          aria-label="Volver arriba"
        >
          <ChevronUp className="h-6 w-6 stroke-[2.5]" />
        </button>
      )}

      {enCatalogo && <CategoryMenuSheet />}
    </div>
  )
}

export function TiendaLayout() {
  const location = useLocation()
  const enCatalogo =
    location.pathname === TIENDA_BASE || location.pathname === `${TIENDA_BASE}/`

  return (
    <TiendaCatalogProvider enCatalogo={enCatalogo}>
      <TiendaLayoutInner />
    </TiendaCatalogProvider>
  )
}
