import { type RefObject } from 'react'
import { Link } from 'react-router-dom'
import { Menu, Search, ShoppingBag } from 'lucide-react'
import { TIENDA_CONFIG } from '@/tienda/config'
import { tiendaPath } from '@/tienda/routes'
import { useTiendaCatalog } from '@/tienda/context/TiendaCatalogContext'
import { useTiendaCart } from '@/tienda/context/TiendaCartContext'
import { CartBadge } from '@/tienda/components/CartBadge'

interface TiendaCompactHeaderProps {
  headerRef: RefObject<HTMLElement>
  visible: boolean
}

export function TiendaCompactHeader({ headerRef, visible }: TiendaCompactHeaderProps) {
  const { busqueda, setBusqueda, setMenuOpen } = useTiendaCatalog()
  const { count } = useTiendaCart()

  return (
    <header
      ref={headerRef}
      className={`tienda-header-compact fixed inset-x-0 top-0 z-[55] border-b border-slate-200/80 bg-white/95 backdrop-blur-md ${
        visible ? 'is-visible' : ''
      }`}
    >
      <div className="mx-auto flex max-w-lg items-center gap-2 px-3 py-2.5">
        <button
          type="button"
          onClick={() => setMenuOpen(true)}
          className="tienda-compact-item tienda-btn flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-slate-800 hover:bg-slate-100"
          aria-label="Abrir categorías"
        >
          <Menu className="h-5 w-5 stroke-[2.5]" />
        </button>

        <div className="tienda-compact-item relative min-w-0 flex-1">
          <input
            type="search"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder={`Buscar en ${TIENDA_CONFIG.nombre}`}
            className="w-full rounded-full border border-slate-200 bg-slate-50 py-2.5 pl-4 pr-11 text-sm text-slate-900 outline-none focus:border-rose-400 focus:bg-white focus:ring-2 focus:ring-rose-100"
          />
          <span className="pointer-events-none absolute right-1.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-rose-900 text-white">
            <Search className="h-4 w-4" />
          </span>
        </div>

        <Link
          to={tiendaPath('carrito')}
          className="tienda-compact-item tienda-btn relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-slate-800 hover:bg-slate-100"
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
