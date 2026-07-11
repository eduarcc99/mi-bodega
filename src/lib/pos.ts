import type { MetodoPago, Producto, UnidadMedida } from '@/types/database'

export type ModoVenta = 'normal' | 'peso' | 'unidad_suelta'

export interface CartItem {
  key: string
  producto_id: string | null
  nombre: string
  cantidad: number
  precio_original: number
  precio_unitario: number
  descuento: number
  costo_unitario: number
  unidad: UnidadMedida
  stock_disponible: number | null
  es_generica: boolean
  cantidad_mayor: number | null
  precio_mayor: number | null
  modo_venta: ModoVenta
  peso_estimado_unidad: number | null
}

export interface VentaCompletada {
  id: string
  total: number
  metodo_pago: MetodoPago
  fecha: string
  items: CartItem[]
}

export function esVentaPorPeso(producto: Producto): boolean {
  return producto.unidad === 'kg' || producto.unidad === 'litro'
}

export function permiteVentaUnidadSuelta(producto: Producto): boolean {
  return (
    producto.unidad === 'kg' &&
    producto.permite_venta_unidad === true &&
    producto.precio_por_unidad != null &&
    producto.precio_por_unidad > 0 &&
    producto.peso_estimado_unidad != null &&
    producto.peso_estimado_unidad > 0
  )
}

export function cantidadStockItem(item: CartItem): number {
  if (item.modo_venta === 'unidad_suelta' && item.peso_estimado_unidad) {
    return Math.round(item.cantidad * item.peso_estimado_unidad * 1000) / 1000
  }
  return item.cantidad
}

export function etiquetaCantidadItem(item: CartItem): string {
  if (item.modo_venta === 'unidad_suelta') {
    return `${item.cantidad} ud`
  }
  if (item.modo_venta === 'peso') {
    return `${item.cantidad} ${item.unidad}`
  }
  return `${item.cantidad} ${item.unidad}`
}

export function getPrecioUnitario(producto: Producto, cantidad: number): number {
  if (
    producto.cantidad_mayor != null &&
    producto.precio_mayor != null &&
    cantidad >= producto.cantidad_mayor
  ) {
    return producto.precio_mayor
  }
  return producto.precio_venta
}

export function cartItemSubtotal(item: CartItem): number {
  return Math.round((item.precio_unitario * item.cantidad - item.descuento) * 100) / 100
}

export function cartTotal(items: CartItem[]): number {
  return items.reduce((sum, item) => sum + cartItemSubtotal(item), 0)
}

export function productoFromCart(
  producto: Producto,
  cantidad: number,
  modo: ModoVenta = 'normal',
): CartItem {
  const esPeso = esVentaPorPeso(producto)
  const modoFinal = modo === 'normal' && esPeso ? 'peso' : modo

  let precio = getPrecioUnitario(producto, cantidad)
  if (modoFinal === 'unidad_suelta' && producto.precio_por_unidad) {
    precio = producto.precio_por_unidad
  }

  return {
    key: `${producto.id}-${modoFinal}-${Date.now()}`,
    producto_id: producto.id,
    nombre: producto.nombre,
    cantidad,
    precio_original: modoFinal === 'unidad_suelta' ? producto.precio_por_unidad! : producto.precio_venta,
    precio_unitario: precio,
    descuento: 0,
    costo_unitario: producto.costo,
    unidad: producto.unidad,
    stock_disponible: producto.stock,
    es_generica: false,
    cantidad_mayor: producto.cantidad_mayor,
    precio_mayor: producto.precio_mayor,
    modo_venta: modoFinal,
    peso_estimado_unidad: producto.peso_estimado_unidad ?? null,
  }
}

export function genericCartItem(nombre: string, precio: number, cantidad = 1): CartItem {
  return {
    key: `gen-${Date.now()}`,
    producto_id: null,
    nombre,
    cantidad,
    precio_original: precio,
    precio_unitario: precio,
    descuento: 0,
    costo_unitario: 0,
    unidad: 'unidad',
    stock_disponible: null,
    es_generica: true,
    cantidad_mayor: null,
    precio_mayor: null,
    modo_venta: 'normal',
    peso_estimado_unidad: null,
  }
}

export function updateCartItemQuantity(item: CartItem, cantidad: number): CartItem {
  const next = { ...item, cantidad }
  if (
    item.modo_venta === 'normal' &&
    !item.es_generica &&
    item.cantidad_mayor != null &&
    item.precio_mayor != null
  ) {
    const precioMayor = cantidad >= item.cantidad_mayor
    next.precio_unitario = precioMayor ? item.precio_mayor : item.precio_original
  }
  return next
}

export function mergeCartItems(items: CartItem[], newItem: CartItem): CartItem[] {
  if (!newItem.es_generica && newItem.producto_id) {
    const idx = items.findIndex(
      (i) => i.producto_id === newItem.producto_id && i.modo_venta === newItem.modo_venta,
    )
    if (idx >= 0) {
      const merged = updateCartItemQuantity(
        items[idx],
        items[idx].cantidad + newItem.cantidad,
      )
      return [merged, ...items.filter((_, i) => i !== idx)]
    }
  }
  return [newItem, ...items]
}

export function stockNecesario(item: CartItem, cantidadExtra = 0): number {
  const totalCant = item.cantidad + cantidadExtra
  if (item.modo_venta === 'unidad_suelta' && item.peso_estimado_unidad) {
    return Math.round(totalCant * item.peso_estimado_unidad * 1000) / 1000
  }
  return totalCant
}
