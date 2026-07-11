import { supabase } from '@/lib/supabase'
import { localDayRangeISO } from '@/lib/utils'
import type { MetodoPago } from '@/types/database'

export interface VentaDetalleDevolucion {
  id: string
  producto_id: string | null
  nombre_producto: string
  cantidad: number
  precio_unitario: number
  descuento: number
  cantidad_devuelta: number
  cantidad_disponible: number
}

export interface VentaParaDevolucion {
  id: string
  fecha: string
  total: number
  metodo_pago: MetodoPago
  estado: string
  cajero_id: string
  perfiles?: { nombre: string }
  detalles: VentaDetalleDevolucion[]
}

export interface LineaDevolucion {
  venta_detalle_id: string
  producto_id: string | null
  nombre: string
  cantidad: number
  monto: number
}

function montoLineaDevolucion(
  cantidadDevolver: number,
  cantidadOriginal: number,
  precioUnitario: number,
  descuentoTotal: number,
): number {
  const bruto = precioUnitario * cantidadDevolver
  const descProporcional =
    cantidadOriginal > 0 ? (descuentoTotal * cantidadDevolver) / cantidadOriginal : 0
  return Math.round((bruto - descProporcional) * 100) / 100
}

export async function buscarVentas(query: string): Promise<{ id: string; fecha: string; total: number; metodo_pago: MetodoPago }[]> {
  const q = query.trim().toLowerCase()
  if (!q) return []

  if (q.length >= 8) {
    const { data: byId } = await supabase
      .from('ventas')
      .select('id, fecha, total, metodo_pago')
      .eq('estado', 'completada')
      .ilike('id', `${q}%`)
      .limit(10)
    if (byId?.length) return byId as { id: string; fecha: string; total: number; metodo_pago: MetodoPago }[]
  }

  const hoy = new Date()
  hoy.setDate(hoy.getDate() - 7)
  const { data } = await supabase
    .from('ventas')
    .select('id, fecha, total, metodo_pago')
    .eq('estado', 'completada')
    .gte('fecha', hoy.toISOString())
    .order('fecha', { ascending: false })
    .limit(20)

  return (data ?? []) as { id: string; fecha: string; total: number; metodo_pago: MetodoPago }[]
}

export async function fetchVentaParaDevolucion(ventaId: string): Promise<VentaParaDevolucion | null> {
  const { data: venta, error } = await supabase
    .from('ventas')
    .select(`
      id, fecha, total, metodo_pago, estado, cajero_id,
      perfiles:cajero_id(nombre),
      venta_detalles(id, producto_id, nombre_producto, cantidad, precio_unitario, descuento)
    `)
    .eq('id', ventaId)
    .single()

  if (error || !venta) return null
  if (venta.estado !== 'completada') throw new Error('Esta venta está anulada')

  const { data: devolucionesPrevias } = await supabase
    .from('devoluciones')
    .select('devolucion_detalles(venta_detalle_id, cantidad)')
    .eq('venta_id', ventaId)

  const devueltoPorLinea = new Map<string, number>()
  for (const dev of devolucionesPrevias ?? []) {
    for (const d of dev.devolucion_detalles ?? []) {
      if (d.venta_detalle_id) {
        devueltoPorLinea.set(
          d.venta_detalle_id,
          (devueltoPorLinea.get(d.venta_detalle_id) ?? 0) + Number(d.cantidad),
        )
      }
    }
  }

  const detalles: VentaDetalleDevolucion[] = (venta.venta_detalles ?? []).map(
    (d: {
      id: string
      producto_id: string | null
      nombre_producto: string
      cantidad: number
      precio_unitario: number
      descuento: number
    }) => {
      const cantidad = Number(d.cantidad)
      const devuelta = devueltoPorLinea.get(d.id) ?? 0
      return {
        id: d.id,
        producto_id: d.producto_id,
        nombre_producto: d.nombre_producto,
        cantidad,
        precio_unitario: Number(d.precio_unitario),
        descuento: Number(d.descuento),
        cantidad_devuelta: devuelta,
        cantidad_disponible: Math.max(0, cantidad - devuelta),
      }
    },
  )

  return {
    id: venta.id,
    fecha: venta.fecha,
    total: Number(venta.total),
    metodo_pago: venta.metodo_pago,
    estado: venta.estado,
    cajero_id: venta.cajero_id,
    perfiles: (venta.perfiles as unknown as { nombre: string } | undefined),
    detalles,
  }
}

export function calcMontoDevolucion(
  detalle: VentaDetalleDevolucion,
  cantidadDevolver: number,
): number {
  return montoLineaDevolucion(
    cantidadDevolver,
    detalle.cantidad,
    detalle.precio_unitario,
    detalle.descuento,
  )
}

export async function registrarDevolucion(params: {
  venta_id: string
  metodo_pago: MetodoPago
  lineas: LineaDevolucion[]
  motivo?: string
  registrado_por: string
}): Promise<{ id: string; total: number }> {
  const { venta_id, metodo_pago, lineas, motivo, registrado_por } = params
  if (lineas.length === 0) throw new Error('Selecciona al menos un producto para devolver')

  const total = lineas.reduce((s, l) => s + l.monto, 0)

  const { data: devolucion, error } = await supabase
    .from('devoluciones')
    .insert({
      venta_id,
      motivo: motivo?.trim() || null,
      registrado_por,
      total,
      metodo_pago,
    })
    .select('id, total')
    .single()

  if (error || !devolucion) {
    throw new Error(error?.message ?? 'Error al registrar devolución')
  }

  const detalles = lineas.map((l) => ({
    devolucion_id: devolucion.id,
    producto_id: l.producto_id,
    venta_detalle_id: l.venta_detalle_id,
    cantidad: l.cantidad,
    monto_devuelto: l.monto,
  }))

  const { error: detError } = await supabase.from('devolucion_detalles').insert(detalles)
  if (detError) {
    await supabase.from('devoluciones').delete().eq('id', devolucion.id)
    throw new Error(detError.message)
  }

  return { id: devolucion.id, total: Number(devolucion.total) }
}

export async function fetchDevolucionesDelDia(fecha: string): Promise<
  { id: string; total: number; metodo_pago: MetodoPago; venta_id: string }[]
> {
  const { desde, hasta } = localDayRangeISO(fecha)

  const { data } = await supabase
    .from('devoluciones')
    .select('id, total, metodo_pago, venta_id')
    .gte('fecha', desde)
    .lte('fecha', hasta)

  return (data ?? []) as { id: string; total: number; metodo_pago: MetodoPago; venta_id: string }[]
}

export interface DevolucionDetalleConVenta {
  producto_id: string | null
  venta_detalle_id: string | null
  cantidad: number
  monto_devuelto: number
  venta_detalles: {
    nombre_producto: string
    cantidad: number
    precio_unitario: number
    descuento: number
    costo_unitario: number
    producto_id: string | null
    productos: {
      categorias: { nombre: string } | null
    } | null
  } | null
}

export interface DevolucionEnRango {
  id: string
  fecha: string
  total: number
  venta_id: string
  devolucion_detalles: DevolucionDetalleConVenta[]
}

export async function fetchDevolucionesEnRango(desde: Date, hasta: Date): Promise<DevolucionEnRango[]> {
  const { data, error } = await supabase
    .from('devoluciones')
    .select(`
      id, fecha, total, venta_id,
      devolucion_detalles(
        producto_id, venta_detalle_id, cantidad, monto_devuelto,
        venta_detalles(
          nombre_producto, cantidad, precio_unitario, descuento, costo_unitario, producto_id,
          productos(categorias(nombre))
        )
      )
    `)
    .gte('fecha', desde.toISOString())
    .lte('fecha', hasta.toISOString())
    .order('fecha', { ascending: true })

  if (error) throw new Error(error.message)
  return (data as unknown as DevolucionEnRango[]) ?? []
}

export function totalDevoluciones(devoluciones: DevolucionEnRango[]): number {
  return devoluciones.reduce((s, d) => s + Number(d.total), 0)
}

export function gananciaPerdidaDevoluciones(devoluciones: DevolucionEnRango[]): number {
  let perdida = 0
  for (const dev of devoluciones) {
    for (const d of dev.devolucion_detalles ?? []) {
      const costo = Number(d.venta_detalles?.costo_unitario ?? 0)
      perdida += Number(d.monto_devuelto) - costo * Number(d.cantidad)
    }
  }
  return Math.round(perdida * 100) / 100
}
