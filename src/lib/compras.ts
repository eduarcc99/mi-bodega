import { supabase } from '@/lib/supabase'
import { calcularPrecioVenta } from '@/lib/utils'
import type { MetodoPago, Producto } from '@/types/database'
import {
  crearGastoCompra,
  insertarCuotasProveedor,
  type CuotaInput,
} from '@/lib/deudasProveedor'

export type { CuotaInput }

export interface LineaCompra {
  key: string
  producto_id: string
  nombre: string
  unidad: string
  cantidad: number
  costo_unitario: number
  /** Fecha de vencimiento del lote que entra con esta compra (opcional) */
  fecha_vencimiento_lote?: string | null
  /** Vencimiento actual del catálogo (solo UI, no se guarda) */
  vencimiento_actual?: string | null
}

export type ModoPagoCompra = 'efectivo' | 'yape' | 'fiado' | 'mixto'
export type EstadoPagoCompra = 'pagado' | 'parcial' | 'pendiente'

export interface CompraRegistrada {
  id: string
  proveedor_nombre: string | null
  fecha: string
  numero_factura: string | null
  total: number
  metodo_pago?: MetodoPago | null
  monto_pagado?: number
  monto_pendiente?: number
  estado_pago?: EstadoPagoCompra
  created_at: string
  compra_detalles: {
    id: string
    cantidad: number
    costo_unitario: number
    fecha_vencimiento_lote?: string | null
    productos: { id: string; nombre: string; unidad: string } | null
  }[]
}

export const MODOS_PAGO_COMPRA: {
  id: ModoPagoCompra
  label: string
  hint: string
}[] = [
  {
    id: 'efectivo',
    label: 'Efectivo (de caja)',
    hint: 'Pagas todo hoy · se descuenta del efectivo esperado',
  },
  {
    id: 'yape',
    label: 'Yape',
    hint: 'Pagas todo hoy · se resta del Yape esperado',
  },
  {
    id: 'fiado',
    label: 'Crédito / fiado',
    hint: 'No pagas hoy · programas cuota(s) con fecha de vencimiento',
  },
  {
    id: 'mixto',
    label: 'Mixto (parte hoy + fiado)',
    hint: 'Pagas una parte hoy y el resto en cuota(s) con fecha',
  },
]

/** @deprecated usar MODOS_PAGO_COMPRA */
export const METODOS_PAGO_COMPRA = MODOS_PAGO_COMPRA.filter((m) => m.id !== 'mixto').map((m) => ({
  id: m.id as MetodoPago,
  label: m.label,
  hint: m.hint,
}))

export function labelModoPagoCompra(m: ModoPagoCompra | MetodoPago | string): string {
  if (m === 'otro') return 'Crédito / fiado'
  return MODOS_PAGO_COMPRA.find((x) => x.id === m)?.label ?? String(m)
}

/** @deprecated */
export function labelMetodoPagoCompra(m: MetodoPago): string {
  return labelModoPagoCompra(m === 'otro' ? 'fiado' : m)
}

export function lineaSubtotal(linea: LineaCompra): number {
  return Math.round(linea.cantidad * linea.costo_unitario * 100) / 100
}

export function compraTotal(lineas: LineaCompra[]): number {
  return lineas.reduce((s, l) => s + lineaSubtotal(l), 0)
}

export function lineaCompraFromProducto(p: Producto): LineaCompra {
  return {
    key: crypto.randomUUID(),
    producto_id: p.id,
    nombre: p.nombre,
    unidad: p.unidad,
    cantidad: 1,
    costo_unitario: Number(p.costo) || 0,
    fecha_vencimiento_lote: '',
    vencimiento_actual: p.fecha_vencimiento ?? null,
  }
}

/** Último agregado primero; fusiona solo mismo producto y mismo vencimiento de lote. */
export function mergeLineaCompra(lineas: LineaCompra[], nueva: LineaCompra): LineaCompra[] {
  const idx = lineas.findIndex(
    (l) =>
      l.producto_id === nueva.producto_id &&
      (l.fecha_vencimiento_lote || '') === (nueva.fecha_vencimiento_lote || ''),
  )
  if (idx >= 0) {
    const merged: LineaCompra = {
      ...lineas[idx],
      cantidad: lineas[idx].cantidad + nueva.cantidad,
    }
    return [merged, ...lineas.filter((_, i) => i !== idx)]
  }
  return [nueva, ...lineas]
}

export function validarCuotas(saldo: number, cuotas: CuotaInput[]): string | null {
  if (saldo <= 0) return null
  if (cuotas.length === 0) return 'Agrega al menos una cuota con fecha de pago'
  for (const c of cuotas) {
    if (!c.fecha_vencimiento) return 'Cada cuota necesita fecha de vencimiento'
    if (c.monto <= 0) return 'Cada cuota debe tener monto mayor a 0'
  }
  const suma = Math.round(cuotas.reduce((s, c) => s + c.monto, 0) * 100) / 100
  if (Math.abs(suma - saldo) > 0.01) {
    return `Las cuotas suman ${suma.toFixed(2)} pero el saldo pendiente es ${saldo.toFixed(2)}`
  }
  return null
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
      id, proveedor_nombre, fecha, numero_factura, total, metodo_pago,
      monto_pagado, monto_pendiente, estado_pago, created_at,
      compra_detalles(id, cantidad, costo_unitario, fecha_vencimiento_lote, productos(id, nombre, unidad))
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


async function rollbackCompra(compraId: string): Promise<void> {
  await supabase.from('cuotas_proveedor').delete().eq('compra_id', compraId)
  await supabase.from('compra_detalles').delete().eq('compra_id', compraId)
  await supabase.from('gastos_caja').delete().eq('compra_id', compraId)
  await supabase.from('compras').delete().eq('id', compraId)
}

export async function registrarCompra(params: {
  proveedor_nombre: string
  proveedor_ruc?: string
  proveedor_telefono?: string
  fecha: string
  numero_factura?: string
  modo_pago: ModoPagoCompra
  pago_inmediato_monto?: number
  pago_inmediato_metodo?: 'efectivo' | 'yape'
  cuotas?: CuotaInput[]
  lineas: LineaCompra[]
  registrado_por: string
}): Promise<string> {
  const {
    lineas,
    registrado_por,
    fecha,
    proveedor_nombre,
    numero_factura,
    modo_pago,
    cuotas = [],
  } = params

  if (lineas.length === 0) throw new Error('Agrega al menos un producto')

  const total = compraTotal(lineas)
  const proveedorLabel = proveedor_nombre.trim() || 'Proveedor'

  let montoPagadoHoy = 0
  let saldoPendiente = total
  let metodoCompra: MetodoPago = 'efectivo'
  let estadoPago: EstadoPagoCompra = 'pagado'

  if (modo_pago === 'efectivo') {
    montoPagadoHoy = total
    saldoPendiente = 0
    metodoCompra = 'efectivo'
  } else if (modo_pago === 'yape') {
    montoPagadoHoy = total
    saldoPendiente = 0
    metodoCompra = 'yape'
  } else if (modo_pago === 'fiado') {
    montoPagadoHoy = 0
    saldoPendiente = total
    metodoCompra = 'otro'
    estadoPago = 'pendiente'
    const errCuotas = validarCuotas(saldoPendiente, cuotas)
    if (errCuotas) throw new Error(errCuotas)
  } else {
    // mixto
    const montoHoy = Math.round((params.pago_inmediato_monto ?? 0) * 100) / 100
    const metodoHoy = params.pago_inmediato_metodo
    if (montoHoy <= 0 || montoHoy >= total) {
      throw new Error('En pago mixto, el monto de hoy debe ser mayor a 0 y menor al total')
    }
    if (!metodoHoy) throw new Error('Indica si pagaste la parte de hoy en efectivo o Yape')
    montoPagadoHoy = montoHoy
    saldoPendiente = Math.round((total - montoHoy) * 100) / 100
    metodoCompra = 'otro'
    estadoPago = 'parcial'
    const errCuotas = validarCuotas(saldoPendiente, cuotas)
    if (errCuotas) throw new Error(errCuotas)
  }

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
      metodo_pago: metodoCompra,
      monto_pagado: montoPagadoHoy,
      monto_pendiente: saldoPendiente,
      estado_pago: estadoPago,
      registrado_por,
    })
    .select('id')
    .single()

  if (compraError || !compra) {
    throw new Error(compraError?.message ?? 'Error al registrar compra')
  }

  const compraId = compra.id

  try {
    const detalles = lineas.map((l) => ({
      compra_id: compraId,
      producto_id: l.producto_id,
      cantidad: l.cantidad,
      costo_unitario: l.costo_unitario,
      fecha_vencimiento_lote: l.fecha_vencimiento_lote?.trim() || null,
    }))

    const { error: detalleError } = await supabase.from('compra_detalles').insert(detalles)
    if (detalleError) throw new Error(detalleError.message)

    for (const l of lineas) {
      await actualizarPrecioVenta(l.producto_id, l.costo_unitario)
    }

    if (montoPagadoHoy > 0) {
      const metodoGasto =
        modo_pago === 'mixto'
          ? params.pago_inmediato_metodo!
          : (modo_pago as 'efectivo' | 'yape')

      const gastoId = await crearGastoCompra({
        compra_id: compraId,
        fecha,
        monto: montoPagadoHoy,
        proveedorLabel,
        numero_factura,
        metodo_pago: metodoGasto,
        registrado_por,
        sufijo: modo_pago === 'mixto' ? '(adelanto)' : undefined,
      })

      await supabase.from('compras').update({ gasto_caja_id: gastoId }).eq('id', compraId)
    }

    if (saldoPendiente > 0) {
      await insertarCuotasProveedor(compraId, cuotas, registrado_por)
    }

    return compraId
  } catch (e) {
    await rollbackCompra(compraId)
    throw e
  }
}
