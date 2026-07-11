import { formatMoney } from '@/lib/utils'
import { TIENDA_CONFIG } from '@/tienda/config'
import { etiquetaDelivery } from '@/tienda/lib/delivery'
import type { CartItemTienda, CheckoutForm } from '@/tienda/types'

function etiquetaCantidad(item: CartItemTienda): string {
  if (item.modo === 'unidad_suelta') return `${item.cantidad} ud`
  if (item.modo === 'peso') return `${item.cantidad} ${item.unidad}`
  return `${item.cantidad} ${item.unidad}`
}

export function buildWhatsAppPedidoUrl(
  pedidoId: string,
  form: CheckoutForm,
  items: CartItemTienda[],
  subtotal: number,
  costoDelivery: number,
  total: number,
): string {
  const lineas = items.map(
    (i) => `• ${i.nombre} — ${etiquetaCantidad(i)} × ${formatMoney(i.precio_unitario)}`,
  )

  const texto = [
    `🛒 *Nuevo pedido ${TIENDA_CONFIG.nombre}*`,
    `📍 ${TIENDA_CONFIG.zona}`,
    '',
    `*Cliente:* ${form.nombre}`,
    `*Tel:* ${form.telefono}`,
    `*Dirección:* ${form.direccion}`,
    form.referencia ? `*Referencia:* ${form.referencia}` : '',
    `*Envío:* ${etiquetaDelivery(subtotal)}`,
    '',
    '*Productos:*',
    ...lineas,
    '',
    `*Subtotal:* ${formatMoney(subtotal)}`,
    costoDelivery > 0 ? `*Delivery:* ${formatMoney(costoDelivery)}` : '*Delivery:* GRATIS 🎉',
    `*TOTAL:* ${formatMoney(total)}`,
    form.notas ? `*Notas:* ${form.notas}` : '',
    '',
    `Pedido #${pedidoId.slice(0, 8).toUpperCase()}`,
    '_Enviado desde la tienda web_',
  ]
    .filter(Boolean)
    .join('\n')

  return `https://wa.me/${TIENDA_CONFIG.whatsapp}?text=${encodeURIComponent(texto)}`
}
