import { useEffect, useMemo, useState } from 'react'
import { Moon, Search } from 'lucide-react'
import { fetchCatalogoTienda } from '@/tienda/lib/catalogo'
import { isTiendaAbierta, proximaApertura, mensajeHorario } from '@/tienda/lib/horario'
import { normalizarCategoria } from '@/tienda/lib/format'
import { formatMoney } from '@/lib/utils'
import { TIENDA_CONFIG } from '@/tienda/config'
import type { ProductoTienda } from '@/tienda/types'
import { ProductoCard } from '@/tienda/components/ProductoCard'
import { CategoryScroller } from '@/tienda/components/CategoryScroller'
import { CategorySidebar } from '@/tienda/components/CategorySidebar'
import { TiendaCatalogSkeleton } from '@/tienda/components/TiendaSkeleton'
import { useTiendaCart } from '@/tienda/context/TiendaCartContext'
import { useTiendaCatalog } from '@/tienda/context/TiendaCatalogContext'

export function TiendaPage() {
  const { count } = useTiendaCart()
  const { busqueda, setBusqueda, categoria, setCategoria, setCategorias, headerCompact } =
    useTiendaCatalog()
  const [productos, setProductos] = useState<ProductoTienda[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const abierta = isTiendaAbierta()

  useEffect(() => {
    fetchCatalogoTienda()
      .then(setProductos)
      .catch((e) => setError(e instanceof Error ? e.message : 'Error al cargar'))
      .finally(() => setLoading(false))
  }, [])

  const categorias = useMemo(() => {
    const set = new Set<string>()
    for (const p of productos) {
      if (p.categoria_nombre) set.add(normalizarCategoria(p.categoria_nombre))
    }
    return Array.from(set).sort()
  }, [productos])

  useEffect(() => {
    setCategorias(categorias)
  }, [categorias, setCategorias])

  const filtrados = useMemo(() => {
    const q = busqueda.toLowerCase().trim()
    return productos.filter((p) => {
      const matchQ = !q || p.nombre.toLowerCase().includes(q)
      const matchCat =
        !categoria || normalizarCategoria(p.categoria_nombre) === categoria
      return matchQ && matchCat
    })
  }, [productos, busqueda, categoria])

  if (!abierta) {
    return (
      <div className="flex flex-col items-center rounded-3xl border border-rose-100 bg-white px-6 py-16 text-center shadow-sm">
        <div className="mb-4 rounded-full bg-rose-100 p-5">
          <Moon className="h-10 w-10 text-rose-700" />
        </div>
        <h2 className="text-xl font-bold text-slate-900">Estamos cerrados</h2>
        <p className="mt-2 text-slate-600">{proximaApertura()}</p>
        <p className="mt-1 text-sm text-slate-400">{mensajeHorario()}</p>
      </div>
    )
  }

  if (loading) {
    return <TiendaCatalogSkeleton />
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-8 text-center text-sm text-red-700">
        <p className="font-medium">No pudimos cargar la tienda</p>
        <p className="mt-2">{error}</p>
        <p className="mt-4 text-xs text-red-500">
          Si es la primera vez, ejecuta <code>pedidos-web.sql</code> en Supabase.
        </p>
      </div>
    )
  }

  return (
    <div className={`${count > 0 ? 'pb-4' : ''}`}>
      <div className="lg:flex lg:items-start lg:gap-8">
        <CategorySidebar
          categorias={categorias}
          categoria={categoria}
          onSelect={setCategoria}
        />

        <div className="min-w-0 flex-1 space-y-4">
          <div className={`tienda-catalog-toolbar lg:hidden ${headerCompact ? 'is-collapsed' : ''}`}>
            <div className="tienda-catalog-toolbar-inner space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="search"
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  placeholder="Buscar en la bodega…"
                  className="w-full rounded-full border border-slate-200 bg-white py-3 pl-10 pr-4 text-sm text-slate-900 shadow-sm outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-200"
                />
              </div>

              {categorias.length > 0 && (
                <CategoryScroller
                  categorias={categorias}
                  categoria={categoria}
                  onSelect={setCategoria}
                />
              )}
            </div>
          </div>

          {filtrados.length === 0 ? (
            <p className="py-12 text-center text-sm text-slate-500">No hay productos con ese filtro</p>
          ) : (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-3 lg:gap-4 xl:grid-cols-4">
              {filtrados.map((p) => (
                <ProductoCard key={p.id} producto={p} />
              ))}
            </div>
          )}

          <p className="text-center text-[10px] leading-relaxed text-slate-400">
            {TIENDA_CONFIG.promoEnvio}
            <span className="mx-1">·</span>
            Pedidos chicos +{formatMoney(TIENDA_CONFIG.deliveryPedidoPequeno)} envío
            <span className="mx-1">·</span>
            {mensajeHorario()}
          </p>
        </div>
      </div>
    </div>
  )
}
