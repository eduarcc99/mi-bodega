import { useEffect, useMemo, useState } from 'react'
import { Loader2, Moon, Search } from 'lucide-react'
import { fetchCatalogoTienda } from '@/tienda/lib/catalogo'
import { isTiendaAbierta, proximaApertura, mensajeHorario } from '@/tienda/lib/horario'
import { formatMoney } from '@/lib/utils'
import { TIENDA_CONFIG } from '@/tienda/config'
import type { ProductoTienda } from '@/tienda/types'
import { ProductoCard } from '@/tienda/components/ProductoCard'

export function TiendaPage() {
  const [productos, setProductos] = useState<ProductoTienda[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [categoria, setCategoria] = useState('')
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
      if (p.categoria_nombre) set.add(p.categoria_nombre)
    }
    return Array.from(set).sort()
  }, [productos])

  const filtrados = useMemo(() => {
    const q = busqueda.toLowerCase().trim()
    return productos.filter((p) => {
      const matchQ = !q || p.nombre.toLowerCase().includes(q)
      const matchCat = !categoria || p.categoria_nombre === categoria
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
        <p className="mt-6 text-xs text-slate-400">
          Delivery solo en {TIENDA_CONFIG.zona} · comparte el link del grupo
        </p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-rose-700" />
      </div>
    )
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
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          type="search"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar en la bodega…"
          className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-10 pr-4 text-sm shadow-sm outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-200"
        />
      </div>

      {categorias.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
          <button
            type="button"
            onClick={() => setCategoria('')}
            className={`shrink-0 rounded-full px-4 py-1.5 text-xs font-semibold transition ${
              !categoria
                ? 'bg-rose-900 text-white'
                : 'bg-white text-slate-600 ring-1 ring-slate-200'
            }`}
          >
            Todos
          </button>
          {categorias.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCategoria(c)}
              className={`shrink-0 rounded-full px-4 py-1.5 text-xs font-semibold transition ${
                categoria === c
                  ? 'bg-rose-900 text-white'
                  : 'bg-white text-slate-600 ring-1 ring-slate-200'
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      )}

      {filtrados.length === 0 ? (
        <p className="py-12 text-center text-sm text-slate-500">No hay productos con ese filtro</p>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {filtrados.map((p) => (
            <ProductoCard key={p.id} producto={p} />
          ))}
        </div>
      )}

      <p className="pb-4 text-center text-[11px] text-slate-400">
        {TIENDA_CONFIG.promoEnvio} · Pedidos chicos +{formatMoney(TIENDA_CONFIG.deliveryPedidoPequeno)}{' '}
        envío · {mensajeHorario()}
      </p>
    </div>
  )
}
