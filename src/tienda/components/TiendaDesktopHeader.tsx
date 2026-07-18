import { type RefObject } from 'react'
import { Link } from 'react-router-dom'
import { Menu, Search, ShoppingBag } from 'lucide-react'
import { TIENDA_CONFIG } from '@/tienda/config'
import { tiendaPath } from '@/tienda/routes'
import { useTiendaCatalog } from '@/tienda/context/TiendaCatalogContext'
import { useTiendaCart } from '@/tienda/context/TiendaCartContext'
import { CartBadge } from '@/tienda/components/CartBadge'

interface TiendaDesktopHeaderProps {
  headerRef: RefObject<HTMLElement>
}

export function TiendaDesktopHeader({ headerRef }: TiendaDesktopHeaderProps) {
  const { busqueda, setBusqueda, setMenuOpen } = useTiendaCatalog()
  const { count } = useTiendaCart()

  return (
    <header
      ref={headerRef}
      className="fixed inset-x-0 top-0 z-50 hidden border-b border-slate-200 bg-white shadow-sm lg:block"
    >
      <div className="mx-auto flex max-w-7xl items-center gap-4 px-6 py-3">
        <Link to={tiendaPath()} className="flex shrink-0 items-center gap-2">
          <span className="grid grid-cols-2 gap-0.5">
            <span className="h-1.5 w-1.5 rounded-sm bg-rose-400" />
            <span className="h-1.5 w-1.5 rounded-sm bg-rose-900" />
            <span className="h-1.5 w-1.5 rounded-sm bg-rose-900" />
            <span className="h-1.5 w-1.5 rounded-sm bg-rose-400" />
          </span>
          <span className="text-xl font-extrabold tracking-tight text-rose-900">
            {TIENDA_CONFIG.nombre}
          </span>
        </Link>

        <button
          type="button"
          onClick={() => setMenuOpen(true)}
          className="tienda-btn flex shrink-0 items-center gap-2 rounded-lg px-2 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-100"
          aria-label="Abrir categorías"
        >
          <Menu className="h-5 w-5 stroke-[2.5]" />
          Menú
        </button>

        <div className="relative mx-auto min-w-0 max-w-2xl flex-1">
          <input
            type="search"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder={`Buscar en ${TIENDA_CONFIG.nombre}`}
            className="w-full rounded-full border border-slate-200 bg-slate-50 py-2.5 pl-5 pr-12 text-sm text-slate-900 outline-none focus:border-rose-400 focus:bg-white focus:ring-2 focus:ring-rose-100"
          />
          <span className="pointer-events-none absolute right-1.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-rose-900 text-white">
            <Search className="h-4 w-4" />
          </span>
        </div>

        <Link
          to={tiendaPath('carrito')}
          className="tienda-btn relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-slate-800 hover:bg-slate-100"
          aria-label="Ver carrito"
        >
          <ShoppingBag className="h-5 w-5" />
          <CartBadge
            count={count}
            className="absolute -right-0.5 -top-0.5 h-5 min-w-5 px-1 text-[10px]"
          />
        </Link>
      </div>
    </header>
  )
}
