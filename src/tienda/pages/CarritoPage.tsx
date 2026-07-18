import { Link } from 'react-router-dom'
import { Trash2, ShoppingBag, Sparkles } from 'lucide-react'
import { getOptimizedImageUrl } from '@/lib/cloudinary'
import { formatMoney } from '@/lib/utils'
import { lineSubtotal, useTiendaCart } from '@/tienda/context/TiendaCartContext'
import { tiendaPath } from '@/tienda/routes'
import {
  costoDelivery,
  faltanteEnvioGratis,
  tieneEnvioGratis,
  totalConDelivery,
} from '@/tienda/lib/delivery'
import {
  cantidadEnSelector,
  etiquetaCantidadDetalle,
  formatNombreProducto,
} from '@/tienda/lib/format'
import type { CartItemTienda } from '@/tienda/types'

function pasoItem(item: CartItemTienda): number {
  return item.modo === 'peso' ? 0.25 : 1
}

export function CarritoPage() {
  const { items, total: subtotal, updateQty, removeItem } = useTiendaCart()
  const envioGratis = tieneEnvioGratis(subtotal)
  const delivery = costoDelivery(subtotal)
  const total = totalConDelivery(subtotal)
  const faltante = faltanteEnvioGratis(subtotal)

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center rounded-3xl border border-slate-200 bg-white py-16 text-center">
        <ShoppingBag className="h-12 w-12 text-slate-300" />
        <p className="mt-4 font-medium text-slate-700">Tu carrito está vacío</p>
        <Link
          to={tiendaPath()}
          className="mt-4 rounded-xl bg-rose-900 px-6 py-2.5 text-sm font-semibold text-white"
        >
          Ver productos
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        {items.map((item) => (
          <div
            key={item.key}
            className="flex gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm"
          >
            <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-slate-100">
              {item.imagen_url ? (
                <img
                  src={getOptimizedImageUrl(item.imagen_url, 96)}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : null}
            </div>
            <div className="flex min-w-0 flex-1 flex-col">
              <p className="truncate font-semibold text-slate-900">
                {formatNombreProducto(item.nombre)}
              </p>
              <p className="text-xs text-slate-600">
                {etiquetaCantidadDetalle(item.cantidad, item.unidad, item.modo)} ×{' '}
                {formatMoney(item.precio_unitario)}
              </p>
              <p className="mt-1 font-bold text-rose-800">{formatMoney(lineSubtotal(item))}</p>
              <div className="mt-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => updateQty(item.key, item.cantidad - pasoItem(item))}
                  className="tienda-btn flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-300 bg-slate-100 text-xl font-bold leading-none text-slate-900 hover:bg-slate-200"
                  aria-label="Quitar uno"
                >
                  −
                </button>
                <span className="min-w-[2.5rem] text-center text-base font-bold tabular-nums text-slate-900">
                  {cantidadEnSelector(item.cantidad)}
                </span>
                <button
                  type="button"
                  onClick={() => updateQty(item.key, item.cantidad + pasoItem(item))}
                  className="tienda-btn flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-amber-400 bg-amber-400 text-xl font-bold leading-none text-slate-900 hover:bg-amber-300"
                  aria-label="Agregar uno"
                >
                  +
                </button>
                <button
                  type="button"
                  onClick={() => removeItem(item.key)}
                  className="ml-auto flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-red-500 transition hover:bg-red-50"
                  aria-label="Eliminar producto"
                >
                  <Trash2 className="h-4 w-4 stroke-[2.5]" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-rose-100 bg-white p-4 shadow-sm">
        {envioGratis ? (
          <div className="mb-3 flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800">
            <Sparkles className="h-4 w-4" />
            Envío gratis en tu pedido
          </div>
        ) : (
          <div className="mb-3 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Envío {formatMoney(delivery)} · agrega {formatMoney(faltante)} más para envío gratis
          </div>
        )}

        <div className="space-y-1 text-sm">
          <div className="flex justify-between text-slate-600">
            <span>Subtotal</span>
            <span>{formatMoney(subtotal)}</span>
          </div>
          <div className="flex justify-between text-slate-600">
            <span>Delivery</span>
            <span className={envioGratis ? 'font-semibold text-emerald-600' : ''}>
              {envioGratis ? 'GRATIS' : formatMoney(delivery)}
            </span>
          </div>
          <div className="flex justify-between border-t border-slate-100 pt-2 text-lg font-bold text-slate-900">
            <span>Total</span>
            <span className="text-rose-800">{formatMoney(total)}</span>
          </div>
        </div>

        <Link
          to={tiendaPath('checkout')}
          className="tienda-btn mt-4 flex w-full items-center justify-center rounded-xl bg-rose-900 py-3.5 text-base font-bold text-white hover:bg-rose-800"
        >
          Continuar pedido
        </Link>
      </div>
    </div>
  )
}
