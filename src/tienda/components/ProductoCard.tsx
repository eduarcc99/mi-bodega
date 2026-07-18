import { useState } from 'react'
import { Plus, Package, Scale, Minus, Zap } from 'lucide-react'
import { getOptimizedImageUrl } from '@/lib/cloudinary'
import { formatMoney } from '@/lib/utils'
import type { ProductoTienda } from '@/tienda/types'
import type { CartItemTienda } from '@/tienda/types'
import { useTiendaCart } from '@/tienda/context/TiendaCartContext'
import { ProductoImagenSkeleton } from '@/tienda/components/TiendaSkeleton'
import { formatNombreProducto, normalizarCategoria, cantidadEnSelector } from '@/tienda/lib/format'
import { TIENDA_CONFIG } from '@/tienda/config'

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

function pasoCantidad(modo: CartItemTienda['modo']): number {
  return modo === 'peso' ? 0.25 : 1
}

function subtituloUnidad(p: ProductoTienda): string {
  if (p.unidad === 'kg') return 'Venta por kilo'
  if (p.unidad === 'litro') return 'Venta por litro'
  return 'Por unidad'
}

interface ProductoCardProps {
  producto: ProductoTienda
  onAgregado?: () => void
}

export function ProductoCard({ producto, onAgregado }: ProductoCardProps) {
  const { items, addItem, updateQty } = useTiendaCart()
  const [modal, setModal] = useState(false)
  const [modo, setModo] = useState<CartItemTienda['modo']>('normal')
  const [cantidad, setCantidad] = useState('1')
  const [flash, setFlash] = useState(false)
  const [imgLoaded, setImgLoaded] = useState(!producto.imagen_url)

  const lineInCart = items.find((i) => i.producto_id === producto.id)
  const inCart = Boolean(lineInCart && lineInCart.cantidad > 0)
  const nombre = formatNombreProducto(producto.nombre)
  const categoria = normalizarCategoria(producto.categoria_nombre)

  function precioLabel(): string {
    if (esPorPeso(producto)) return `${formatMoney(producto.precio_venta)}/${producto.unidad}`
    return `${formatMoney(producto.precio_venta)} UN`
  }

  function pulseAgregado() {
    setFlash(true)
    setTimeout(() => setFlash(false), 500)
    onAgregado?.()
  }

  function handleTapAgregar() {
    if (esPorPeso(producto)) {
      setModo('peso')
      setCantidad('0.5')
      setModal(true)
      return
    }
    addItem(producto, 1, 'normal')
    pulseAgregado()
  }

  function confirmarModal() {
    const qty = parseFloat(cantidad)
    if (isNaN(qty) || qty <= 0) return
    addItem(producto, qty, modo)
    setModal(false)
    pulseAgregado()
  }

  function cambiarCantidad(delta: number) {
    if (!lineInCart) return
    const step = pasoCantidad(lineInCart.modo)
    const next = Math.round((lineInCart.cantidad + delta * step) * 1000) / 1000
    updateQty(lineInCart.key, next)
  }

  function etiquetaCantidad(): string {
    if (!lineInCart) return '0'
    return cantidadEnSelector(lineInCart.cantidad)
  }

  return (
    <>
      <article
        className={`tienda-product-card group relative flex h-full flex-col overflow-hidden rounded-lg border bg-white transition-shadow hover:shadow-md ${
          flash
            ? 'border-rose-400 ring-2 ring-rose-200'
            : inCart
              ? 'border-rose-300'
              : 'border-slate-200'
        }`}
      >
        <div className="relative flex aspect-[4/3] items-center justify-center bg-white px-4 pt-4">
          {producto.imagen_url && !imgLoaded && (
            <ProductoImagenSkeleton className="absolute inset-4 rounded" light />
          )}
          {producto.imagen_url ? (
            <img
              src={getOptimizedImageUrl(producto.imagen_url, 360)}
              alt={nombre}
              onLoad={() => setImgLoaded(true)}
              className={`max-h-full max-w-full object-contain transition-opacity duration-300 ${
                imgLoaded ? 'opacity-100' : 'opacity-0'
              }`}
            />
          ) : (
            <Package className="h-14 w-14 text-slate-200" />
          )}
        </div>

        <div className="relative flex flex-1 flex-col px-3 pb-3 pt-1">
          <span className="mb-1 inline-flex w-fit rounded-sm bg-rose-900 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white">
            {TIENDA_CONFIG.nombre}
          </span>

          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
            {categoria}
          </p>
          <h3 className="mt-0.5 line-clamp-2 min-h-[2.35rem] text-[13px] font-bold leading-snug text-slate-900">
            {nombre}
          </h3>
          <p className="mt-0.5 text-[11px] text-slate-500">{subtituloUnidad(producto)}</p>
          <p className="mt-1 text-[10px] text-slate-400">
            Por <span className="font-semibold text-rose-900">{TIENDA_CONFIG.nombre}</span>
          </p>

          <p className="mt-2 text-lg font-bold leading-none text-slate-900">{precioLabel()}</p>

          <p className="mt-2 flex items-center gap-1 text-[11px] font-semibold text-rose-800">
            <Zap className="h-3.5 w-3.5 fill-rose-800" />
            Envío rápido
          </p>

          <div className="mt-auto flex items-end justify-end pt-3">
            {inCart && lineInCart ? (
              <div className="flex items-center gap-0.5 rounded-full border border-slate-200 bg-white p-0.5 shadow-sm">
                <button
                  type="button"
                  onClick={() => cambiarCantidad(-1)}
                  className="tienda-btn flex h-9 w-9 items-center justify-center rounded-full text-slate-600 hover:bg-slate-100"
                  aria-label="Quitar uno"
                >
                  <Minus className="h-4 w-4 stroke-[2.5]" />
                </button>
                <span className="min-w-[1.5rem] text-center text-sm font-bold tabular-nums text-slate-900">
                  {etiquetaCantidad()}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    if (esPorPeso(producto) && lineInCart.modo === 'peso') {
                      cambiarCantidad(1)
                    } else if (!esPorPeso(producto)) {
                      cambiarCantidad(1)
                    } else {
                      setModal(true)
                    }
                  }}
                  className="tienda-btn flex h-9 w-9 items-center justify-center rounded-full bg-rose-900 text-white hover:bg-rose-800"
                  aria-label="Agregar uno"
                >
                  <Plus className="h-4 w-4 stroke-[2.5]" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleTapAgregar}
                className="tienda-btn flex h-10 w-10 items-center justify-center rounded-full bg-rose-900 text-white shadow-md hover:bg-rose-800"
                aria-label="Agregar al carrito"
              >
                <Plus className="h-5 w-5 stroke-[2.5]" />
              </button>
            )}
          </div>
        </div>
      </article>

      {modal && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 p-4 sm:items-center">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl">
            <div className="mb-3 flex items-center gap-2">
              <Scale className="h-5 w-5 text-rose-700" />
              <h3 className="font-bold text-slate-900">{nombre}</h3>
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
                className="tienda-btn flex-1 rounded-xl border border-slate-200 py-2.5 text-slate-600"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmarModal}
                className="tienda-btn flex-1 rounded-xl bg-rose-900 py-2.5 font-bold text-white hover:bg-rose-800"
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
