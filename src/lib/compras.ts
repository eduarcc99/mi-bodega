import { supabase } from '@/lib/supabase'
import { calcularPrecioVenta } from '@/lib/utils'
import type { Producto } from '@/types/database'

export interface LineaCompra {
  key: string
  producto_id: string
  nombre: string
  unidad: string
  cantidad: number
  costo_unitario: number
}

export interface CompraRegistrada {
  id: string
  proveedor_nombre: string | null
  fecha: string
  numero_factura: string | null
  total: number
  created_at: string
  compra_detalles: {
    id: string
    cantidad: number
    costo_unitario: number
    productos: { id: string; nombre: string; unidad: string } | null
  }[]
}

export function lineaSubtotal(linea: LineaCompra): number {
  return Math.round(linea.cantidad * linea.costo_unitario * 100) / 100
}

export function compraTotal(lineas: LineaCompra[]): number {
  return lineas.reduce((s, l) => s + lineaSubtotal(l), 0)
}

export async function buscarProductosCompra(query: string): Promise<Producto[]> {
  const q = query.trim()
  if (!q) return []

  const { data: byBarcode } = await supabase
    .from('productos')
    .select('*')
    .eq('codigo_barra', q)
    .eq('activo', true)
    .limit(5)

  if (byBarcode?.length) return byBarcode as Producto[]

  const { data } = await supabase
    .from('productos')
    .select('*')
    .ilike('nombre', `%${q}%`)
    .eq('activo', true)
    .order('nombre')
    .limit(10)

  return (data as Producto[]) ?? []
}

export async function fetchCompras(): Promise<CompraRegistrada[]> {
  const { data, error } = await supabase
    .from('compras')
    .select(`
      id, proveedor_nombre, fecha, numero_factura, total, created_at,
      compra_detalles(id, cantidad, costo_unitario, productos(id, nombre, unidad))
    `)
    .order('fecha', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) throw new Error(error.message)
  return (data as unknown as CompraRegistrada[]) ?? []
}

async function actualizarPrecioVenta(productoId: string, nuevoCosto: number): Promise<void> {
  const { data } = await supabase
    .from('productos')
    .select('margen_pct, categorias(margen_default)')
    .eq('id', productoId)
    .single()

  if (!data) return

  const p = data as unknown as { margen_pct: number | null; categorias: { margen_default: number } | null }
  const margen = p.margen_pct ?? p.categorias?.margen_default ?? 25
  const precio_venta = calcularPrecioVenta(nuevoCosto, margen)

  await supabase
    .from('productos')
    .update({ precio_venta, updated_at: new Date().toISOString() })
    .eq('id', productoId)
}

export async function registrarCompra(params: {
  proveedor_nombre: string
  proveedor_ruc?: string
  proveedor_telefono?: string
  fecha: string
  numero_factura?: string
  lineas: LineaCompra[]
  registrado_por: string
}): Promise<string> {
  const { lineas, registrado_por, fecha, proveedor_nombre, numero_factura } = params
  if (lineas.length === 0) throw new Error('Agrega al menos un producto')

  const total = compraTotal(lineas)

  let proveedor_id: string | null = null
  if (proveedor_nombre.trim()) {
    const { data: prov } = await supabase
      .from('proveedores')
      .insert({
        nombre: proveedor_nombre.trim(),
        ruc: params.proveedor_ruc || null,
        telefono: params.proveedor_telefono || null,
      })
      .select('id')
      .single()
    proveedor_id = prov?.id ?? null
  }

  const { data: compra, error: compraError } = await supabase
    .from('compras')
    .insert({
      proveedor_id,
      proveedor_nombre: proveedor_nombre.trim() || null,
      fecha,
      numero_factura: numero_factura?.trim() || null,
      total,
      registrado_por,
    })
    .select('id')
    .single()

  if (compraError || !compra) {
    throw new Error(compraError?.message ?? 'Error al registrar compra')
  }

  const detalles = lineas.map((l) => ({
    compra_id: compra.id,
    producto_id: l.producto_id,
    cantidad: l.cantidad,
    costo_unitario: l.costo_unitario,
  }))

  const { error: detalleError } = await supabase.from('compra_detalles').insert(detalles)

  if (detalleError) {
    await supabase.from('compras').delete().eq('id', compra.id)
    throw new Error(detalleError.message)
  }

  for (const l of lineas) {
    await actualizarPrecioVenta(l.producto_id, l.costo_unitario)
  }

  return compra.id
}
