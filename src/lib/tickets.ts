import { supabase } from '@/lib/supabase'
import type { CartItem, ModoVenta, VentaCompletada } from '@/lib/pos'
import type { MetodoPago } from '@/types/database'
import { localDayRangeISO, todayLocalISO } from '@/lib/utils'

export interface TicketResumen {
  id: string
  fecha: string
  total: number
  metodo_pago: MetodoPago
  estado: string
  cajero_nombre: string
}

export interface TicketDetalle extends VentaCompletada {
  cajero_nombre: string
  estado: string
  notas: string | null
}

export async function fetchTicketsRecientes(limit = 30): Promise<TicketResumen[]> {
  const { data, error } = await supabase
    .from('ventas')
    .select('id, fecha, total, metodo_pago, estado, perfiles:cajero_id(nombre)')
    .eq('estado', 'completada')
    .order('fecha', { ascending: false })
    .limit(limit)

  if (error) throw new Error(error.message)

  return (data ?? []).map((v) => ({
    id: v.id,
    fecha: v.fecha,
    total: Number(v.total),
    metodo_pago: v.metodo_pago as MetodoPago,
    estado: v.estado,
    cajero_nombre: (v.perfiles as unknown as { nombre: string } | null)?.nombre ?? '—',
  }))
}

export async function fetchTicketsDelDia(fecha = todayLocalISO()): Promise<TicketResumen[]> {
  const { desde, hasta } = localDayRangeISO(fecha)
  const { data, error } = await supabase
    .from('ventas')
    .select('id, fecha, total, metodo_pago, estado, perfiles:cajero_id(nombre)')
    .eq('estado', 'completada')
    .gte('fecha', desde)
    .lte('fecha', hasta)
    .order('fecha', { ascending: false })

  if (error) throw new Error(error.message)

  return (data ?? []).map((v) => ({
    id: v.id,
    fecha: v.fecha,
    total: Number(v.total),
    metodo_pago: v.metodo_pago as MetodoPago,
    estado: v.estado,
    cajero_nombre: (v.perfiles as unknown as { nombre: string } | null)?.nombre ?? '—',
  }))
}

export async function buscarTickets(query: string): Promise<TicketResumen[]> {
  const q = query.trim().toLowerCase()
  if (!q) return fetchTicketsRecientes(30)

  if (q.length >= 4) {
    const { data: byId, error } = await supabase
      .from('ventas')
      .select('id, fecha, total, metodo_pago, estado, perfiles:cajero_id(nombre)')
      .eq('estado', 'completada')
      .ilike('id', `${q}%`)
      .order('fecha', { ascending: false })
      .limit(20)

    if (error) throw new Error(error.message)
    if (byId?.length) {
      return byId.map((v) => ({
        id: v.id,
        fecha: v.fecha,
        total: Number(v.total),
        metodo_pago: v.metodo_pago as MetodoPago,
        estado: v.estado,
        cajero_nombre: (v.perfiles as unknown as { nombre: string } | null)?.nombre ?? '—',
      }))
    }
  }

  return fetchTicketsRecientes(30)
}

export async function fetchTicketDetalle(ventaId: string): Promise<TicketDetalle | null> {
  const { data, error } = await supabase
    .from('ventas')
    .select(`
      id, fecha, total, metodo_pago, estado, notas,
      perfiles:cajero_id(nombre),
      venta_detalles(
        id, producto_id, nombre_producto, cantidad, unidades_cobradas, modo_venta,
        precio_original, precio_unitario, descuento, costo_unitario
      )
    `)
    .eq('id', ventaId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!data) return null

  const items: CartItem[] = (data.venta_detalles ?? []).map(
    (d: {
      id: string
      producto_id: string | null
      nombre_producto: string
      cantidad: number
      unidades_cobradas: number
      modo_venta: string
      precio_original: number
      precio_unitario: number
      descuento: number
      costo_unitario: number
    }) => {
      const modo = (d.modo_venta || 'normal') as ModoVenta
      const unidades = Number(d.unidades_cobradas) || Number(d.cantidad)
      return {
        key: d.id,
        producto_id: d.producto_id,
        nombre: d.nombre_producto,
        cantidad: unidades,
        precio_original: Number(d.precio_original),
        precio_unitario: Number(d.precio_unitario),
        descuento: Number(d.descuento),
        costo_unitario: Number(d.costo_unitario),
        unidad: modo === 'peso' ? 'kg' : 'unidad',
        stock_disponible: null,
        es_generica: !d.producto_id,
        cantidad_mayor: null,
        precio_mayor: null,
        modo_venta: modo,
        peso_estimado_unidad:
          modo === 'unidad_suelta' && unidades > 0
            ? Math.round((Number(d.cantidad) / unidades) * 1000) / 1000
            : null,
      }
    },
  )

  return {
    id: data.id,
    total: Number(data.total),
    metodo_pago: data.metodo_pago as MetodoPago,
    fecha: data.fecha,
    items,
    cajero_nombre: (data.perfiles as unknown as { nombre: string } | null)?.nombre ?? '—',
    estado: data.estado,
    notas: data.notas,
  }
}

export function codigoTicket(id: string): string {
  return id.slice(0, 8).toUpperCase()
}
