import { supabase } from '@/lib/supabase'
import type { CartItemTienda, CheckoutForm } from '@/tienda/types'

export async function crearPedidoWeb(
  form: CheckoutForm,
  items: CartItemTienda[],
): Promise<string> {
  const payload = items.map((i) => ({
    producto_id: i.producto_id,
    nombre_producto: i.nombre,
    cantidad: i.cantidad,
    precio_unitario: i.precio_unitario,
    modo: i.modo,
  }))

  const { data, error } = await supabase.rpc('crear_pedido_web', {
    p_cliente_nombre: form.nombre.trim(),
    p_cliente_telefono: form.telefono.trim(),
    p_direccion: form.direccion.trim(),
    p_referencia: form.referencia.trim() || null,
    p_notas: form.notas.trim() || null,
    p_items: payload,
  })

  if (error) throw new Error(error.message)
  if (!data) throw new Error('No se pudo registrar el pedido')
  return String(data)
}
