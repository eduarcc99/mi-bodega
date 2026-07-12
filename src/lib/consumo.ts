import { supabase } from '@/lib/supabase'
import {
  type CartItem,
  type ModoVenta,
  cantidadStockItem,
  etiquetaCantidadItem,
  esVentaPorPeso,
  permiteVentaUnidadSuelta,
  productoFromCart,
  mergeCartItems,
  updateCartItemQuantity,
  stockNecesario,
} from '@/lib/pos'
import type { Producto } from '@/types/database'
import { productoVencido } from '@/lib/utils'

export type { CartItem, ModoVenta }
export {
  etiquetaCantidadItem,
  esVentaPorPeso,
  permiteVentaUnidadSuelta,
  productoFromCart,
  mergeCartItems,
  updateCartItemQuantity,
  stockNecesario,
  cantidadStockItem,
}

export interface ConsumoCompletado {
  id: string
  total_costo: number
  total_venta_potencial: number
  oportunidad_perdida: number
  fecha: string
  items: CartItem[]
}

/** Subtotal al costo (mercadería consumida) */
export function itemCosto(item: CartItem): number {
  const stockQty = cantidadStockItem(item)
  return Math.round(item.costo_unitario * stockQty * 100) / 100
}

/** Lo que se hubiera cobrado al público */
export function itemVentaPotencial(item: CartItem): number {
  return Math.round(item.precio_unitario * item.cantidad * 100) / 100
}

export function totalCosto(items: CartItem[]): number {
  return Math.round(items.reduce((s, i) => s + itemCosto(i), 0) * 100) / 100
}

export function totalVentaPotencial(items: CartItem[]): number {
  return Math.round(items.reduce((s, i) => s + itemVentaPotencial(i), 0) * 100) / 100
}

export function oportunidadPerdida(items: CartItem[]): number {
  return Math.round((totalVentaPotencial(items) - totalCosto(items)) * 100) / 100
}

export function validateProductoParaConsumo(
  producto: Producto,
  stockNecesarioQty = 0.001,
): string | null {
  if (!producto.activo) return `"${producto.nombre}" está inactivo`
  if (productoVencido(producto.fecha_vencimiento)) return `"${producto.nombre}" está vencido`
  if (producto.stock < stockNecesarioQty) return `"${producto.nombre}" sin stock`
  return null
}

/**
 * Para consumo: el carrito guarda precio_unitario = precio de venta (oportunidad)
 * y costo_unitario = costo. La valoración del retiro usa el costo.
 */
export function productoToConsumoItem(
  producto: Producto,
  cantidad: number,
  modo: ModoVenta = 'normal',
): CartItem {
  const item = productoFromCart(producto, cantidad, modo)
  return {
    ...item,
    // Mantener precio_unitario como precio de venta (oportunidad)
    // costo_unitario ya viene de producto.costo
  }
}

export async function completarConsumo(params: {
  items: CartItem[]
  registrado_por: string
  motivo?: string
  notas?: string
}): Promise<ConsumoCompletado> {
  const { items, registrado_por, motivo, notas } = params
  if (items.length === 0) throw new Error('Agrega al menos un producto')

  const catalogados = items.filter((i) => i.producto_id)
  if (catalogados.length === 0) {
    throw new Error('El consumo propio solo admite productos del catálogo')
  }

  const total_costo = totalCosto(catalogados)
  const total_venta_potencial = totalVentaPotencial(catalogados)

  const { data: retiro, error: retiroError } = await supabase
    .from('retiros_consumo')
    .insert({
      registrado_por,
      total_costo,
      total_venta_potencial,
      motivo: motivo?.trim() || null,
      notas: notas?.trim() || null,
      fecha: new Date().toISOString(),
    })
    .select('id, total_costo, total_venta_potencial, fecha')
    .single()

  if (retiroError || !retiro) {
    throw new Error(retiroError?.message ?? 'Error al registrar el consumo')
  }

  const detalles = catalogados.map((item) => {
    const cantidad = cantidadStockItem(item)
    const subtotal_costo = itemCosto(item)
    const subtotal_venta_potencial = itemVentaPotencial(item)
    return {
      retiro_id: retiro.id,
      producto_id: item.producto_id,
      nombre_producto: item.nombre,
      cantidad,
      unidades_cobradas: item.cantidad,
      modo_venta: item.modo_venta,
      costo_unitario: item.costo_unitario,
      precio_venta_unitario: item.precio_unitario,
      subtotal_costo,
      subtotal_venta_potencial,
    }
  })

  const { error: detalleError } = await supabase
    .from('retiro_consumo_detalles')
    .insert(detalles)

  if (detalleError) {
    await supabase.from('retiros_consumo').delete().eq('id', retiro.id)
    throw new Error(detalleError.message)
  }

  return {
    id: retiro.id,
    total_costo: Number(retiro.total_costo),
    total_venta_potencial: Number(retiro.total_venta_potencial),
    oportunidad_perdida:
      Math.round(
        (Number(retiro.total_venta_potencial) - Number(retiro.total_costo)) * 100,
      ) / 100,
    fecha: retiro.fecha,
    items: catalogados,
  }
}

export async function fetchConsumosRecientes(limit = 20) {
  const { data, error } = await supabase
    .from('retiros_consumo')
    .select(
      `
      id, fecha, total_costo, total_venta_potencial, motivo, notas,
      retiro_consumo_detalles(nombre_producto, cantidad, unidades_cobradas, modo_venta, subtotal_costo)
    `,
    )
    .order('fecha', { ascending: false })
    .limit(limit)

  if (error) throw new Error(error.message)
  return data ?? []
}
