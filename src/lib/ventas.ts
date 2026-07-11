import { supabase } from '@/lib/supabase'
import type { CartItem } from '@/lib/pos'
import { cantidadStockItem, cartTotal } from '@/lib/pos'
import type { MetodoPago, Producto } from '@/types/database'
import { productoVencido } from '@/lib/utils'

export function validateProductoParaVenta(producto: Producto, stockNecesario = 0.001): string | null {
  if (!producto.activo) return `"${producto.nombre}" está inactivo`
  if (productoVencido(producto.fecha_vencimiento)) return `"${producto.nombre}" está vencido`
  if (producto.stock < stockNecesario) return `"${producto.nombre}" sin stock`
  return null
}

export async function buscarProductos(query: string): Promise<Producto[]> {
  const q = query.trim()
  if (!q) return []

  const { data: byBarcode } = await supabase
    .from('productos')
    .select('*')
    .eq('codigo_barra', q)
    .eq('activo', true)
    .limit(5)

  if (byBarcode && byBarcode.length > 0) {
    return byBarcode as Producto[]
  }

  const { data: byName } = await supabase
    .from('productos')
    .select('*')
    .ilike('nombre', `%${q}%`)
    .eq('activo', true)
    .order('nombre')
    .limit(10)

  return (byName as Producto[]) ?? []
}

export async function completarVenta(params: {
  items: CartItem[]
  metodo_pago: MetodoPago
  cajero_id: string
  fecha?: string
  notas?: string
}): Promise<{ id: string; total: number; fecha: string }> {
  const { items, metodo_pago, cajero_id, fecha, notas } = params
  if (items.length === 0) throw new Error('El carrito está vacío')

  const total = cartTotal(items)
  const es_generica = items.some((i) => i.es_generica)

  const { data: venta, error: ventaError } = await supabase
    .from('ventas')
    .insert({
      cajero_id,
      total,
      metodo_pago,
      es_generica,
      notas: notas || null,
      fecha: fecha ?? new Date().toISOString(),
    })
    .select('id, total, fecha')
    .single()

  if (ventaError || !venta) {
    throw new Error(ventaError?.message ?? 'Error al registrar la venta')
  }

  const detalles = items.map((item) => ({
    venta_id: venta.id,
    producto_id: item.producto_id,
    nombre_producto: item.nombre,
    cantidad: cantidadStockItem(item),
    unidades_cobradas: item.cantidad,
    modo_venta: item.modo_venta,
    precio_original: item.precio_original,
    precio_unitario: item.precio_unitario,
    descuento: item.descuento,
    costo_unitario: item.costo_unitario,
  }))

  const { error: detalleError } = await supabase.from('venta_detalles').insert(detalles)

  if (detalleError) {
    await supabase.from('ventas').delete().eq('id', venta.id)
    throw new Error(detalleError.message)
  }

  return venta
}
