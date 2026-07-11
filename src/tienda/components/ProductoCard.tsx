import { useState } from 'react'
import { Plus, Package, Scale } from 'lucide-react'
import { getOptimizedImageUrl } from '@/lib/cloudinary'
import { formatMoney } from '@/lib/utils'
import type { ProductoTienda } from '@/tienda/types'
import type { CartItemTienda } from '@/tienda/types'
import { useTiendaCart } from '@/tienda/context/TiendaCartContext'

function esPorPeso(p: ProductoTienda): boolean {
  return p.unidad === 'kg' || p.unidad === 'litro'
}

function puedeUnidadSuelta(p: ProductoTienda): boolean {
  return (
    p.unidad === 'kg' &&
    p.permite_venta_unidad &&
    p.precio_por_unidad != null &&
    p.precio_por_unidad > 0
  )
}

interface ProductoCardProps {
  producto: ProductoTienda
  onAgregado?: () => void
}

export function ProductoCard({ producto, onAgregado }: ProductoCardProps) {
  const { addItem } = useTiendaCart()
  const [modal, setModal] = useState(false)
  const [modo, setModo] = useState<CartItemTienda['modo']>('normal')
  const [cantidad, setCantidad] = useState('1')
  const [flash, setFlash] = useState(false)

  function precioLabel(): string {
    if (esPorPeso(producto)) return `${formatMoney(producto.precio_venta)}/${producto.unidad}`
    return formatMoney(producto.precio_venta)
  }

  function handleTapAgregar() {
    if (esPorPeso(producto)) {
      setModo('peso')
      setCantidad('0.5')
      setModal(true)
      return
    }
    addItem(producto, 1, 'normal')
    setFlash(true)
    setTimeout(() => setFlash(false), 600)
    onAgregado?.()
  }

  function confirmarModal() {
    const qty = parseFloat(cantidad)
    if (isNaN(qty) || qty <= 0) return
    addItem(producto, qty, modo)
    setModal(false)
    setFlash(true)
    setTimeout(() => setFlash(false), 600)
    onAgregado?.()
  }

  return (
    <>
      <article
        className={`overflow-hidden rounded-2xl border bg-white shadow-sm transition ${
          flash ? 'border-emerald-400 ring-2 ring-emerald-200' : 'border-slate-200/80'
        }`}
      >
        <div className="aspect-[4/3] bg-gradient-to-br from-slate-100 to-slate-50">
          {producto.imagen_url ? (
            <img
              src={getOptimizedImageUrl(producto.imagen_url, 320)}
              alt={producto.nombre}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full items-center justify-center">
              <Package className="h-12 w-12 text-slate-300" />
            </div>
          )}
        </div>
        <div className="p-3">
          <h3 className="line-clamp-2 min-h-[2.5rem] text-sm font-semibold leading-tight text-slate-900">
            {producto.nombre}
          </h3>
          <p className="mt-1 text-lg font-bold text-rose-800">{precioLabel()}</p>
          <p className="text-[11px] text-slate-400">
            {producto.categoria_nombre ?? 'General'}
            {puedeUnidadSuelta(producto) && ' · también por unidad'}
          </p>
          <button
            type="button"
            onClick={handleTapAgregar}
            className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl bg-rose-900 py-2.5 text-sm font-semibold text-white transition hover:bg-rose-800 active:scale-[0.98]"
          >
            <Plus className="h-4 w-4" />
            Agregar
          </button>
        </div>
      </article>

      {modal && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 p-4 sm:items-center">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl">
            <div className="mb-3 flex items-center gap-2">
              <Scale className="h-5 w-5 text-rose-700" />
              <h3 className="font-bold text-slate-900">{producto.nombre}</h3>
            </div>

            {puedeUnidadSuelta(producto) && (
              <div className="mb-4 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setModo('peso')
                    setCantidad('0.5')
                  }}
                  className={`rounded-xl border py-2.5 text-sm font-medium ${
                    modo === 'peso'
                      ? 'border-rose-500 bg-rose-50 text-rose-900'
                      : 'border-slate-200 text-slate-600'
                  }`}
                >
                  Por {producto.unidad}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setModo('unidad_suelta')
                    setCantidad('1')
                  }}
                  className={`rounded-xl border py-2.5 text-sm font-medium ${
                    modo === 'unidad_suelta'
                      ? 'border-rose-500 bg-rose-50 text-rose-900'
                      : 'border-slate-200 text-slate-600'
                  }`}
                >
                  Por unidad
                  <span className="block text-xs font-normal">
                    {formatMoney(producto.precio_por_unidad!)}
                  </span>
                </button>
              </div>
            )}

            <label className="mb-1 block text-sm font-medium text-slate-700">
              {modo === 'unidad_suelta' ? 'Unidades' : `Cantidad (${producto.unidad})`}
            </label>
            <input
              type="number"
              min="0.001"
              step={modo === 'unidad_suelta' ? '1' : '0.1'}
              value={cantidad}
              onChange={(e) => setCantidad(e.target.value)}
              className="mb-4 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-lg outline-none focus:border-rose-500"
              autoFocus
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setModal(false)}
                className="flex-1 rounded-xl border border-slate-200 py-2.5 text-slate-600"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmarModal}
                className="flex-1 rounded-xl bg-rose-900 py-2.5 font-semibold text-white"
              >
                Agregar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
