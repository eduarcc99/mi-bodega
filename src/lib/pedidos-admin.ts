import { supabase } from '@/lib/supabase'
import type { MetodoPago } from '@/types/database'

export type PedidoWebEstado = 'pendiente' | 'confirmado' | 'entregado' | 'cancelado'

export interface PedidoWebDetalle {
  id: string
  producto_id: string | null
  nombre_producto: string
  cantidad: number
  unidades_cobradas: number
  cantidad_stock: number
  modo_venta: string
  precio_unitario: number
  subtotal: number
}

export interface PedidoWeb {
  id: string
  cliente_nombre: string
  cliente_telefono: string
  direccion: string
  referencia: string | null
  notas: string | null
  subtotal: number
  costo_delivery: number
  zona_delivery: string | null
  total: number
  estado: PedidoWebEstado
  venta_id: string | null
  created_at: string
  pedido_web_detalles: PedidoWebDetalle[]
}

export async function fetchPedidosWeb(limit = 50): Promise<PedidoWeb[]> {
  const { data, error } = await supabase
    .from('pedidos_web')
    .select(`
      id, cliente_nombre, cliente_telefono, direccion, referencia, notas,
      subtotal, costo_delivery, zona_delivery, total, estado, venta_id, created_at,
      pedido_web_detalles(
        id, producto_id, nombre_producto, cantidad, unidades_cobradas,
        cantidad_stock, modo_venta, precio_unitario, subtotal
      )
    `)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) throw new Error(error.message)
  return (data ?? []) as PedidoWeb[]
}

export async function confirmarPedidoWeb(pedidoId: string): Promise<void> {
  const { error } = await supabase.rpc('actualizar_estado_pedido_web', {
    p_pedido_id: pedidoId,
    p_estado: 'confirmado',
  })
  if (error) throw new Error(error.message)
}

export async function cancelarPedidoWeb(pedidoId: string): Promise<void> {
  const { error } = await supabase.rpc('actualizar_estado_pedido_web', {
    p_pedido_id: pedidoId,
    p_estado: 'cancelado',
  })
  if (error) throw new Error(error.message)
}

export async function entregarPedidoWeb(
  pedidoId: string,
  cajeroId: string,
  metodoPago: MetodoPago,
): Promise<string> {
  const { data, error } = await supabase.rpc('entregar_pedido_web', {
    p_pedido_id: pedidoId,
    p_cajero_id: cajeroId,
    p_metodo_pago: metodoPago,
  })
  if (error) throw new Error(error.message)
  if (!data) throw new Error('No se pudo registrar la entrega')
  return String(data)
}

export function contarPendientes(pedidos: PedidoWeb[]): number {
  return pedidos.filter((p) => p.estado === 'pendiente').length
}

export function etiquetaCantidadDetalle(d: PedidoWebDetalle): string {
  if (d.modo_venta === 'unidad_suelta') return `${d.unidades_cobradas} ud`
  if (d.modo_venta === 'peso') return `${d.unidades_cobradas} kg`
  return `${d.unidades_cobradas}`
}

const ESTADO_LABEL: Record<PedidoWebEstado, string> = {
  pendiente: 'Pendiente',
  confirmado: 'Confirmado',
  entregado: 'Entregado',
  cancelado: 'Cancelado',
}

const ESTADO_CLASS: Record<PedidoWebEstado, string> = {
  pendiente: 'bg-amber-100 text-amber-800',
  confirmado: 'bg-blue-100 text-blue-800',
  entregado: 'bg-emerald-100 text-emerald-800',
  cancelado: 'bg-slate-100 text-slate-600',
}

export function estadoPedidoLabel(estado: PedidoWebEstado): string {
  return ESTADO_LABEL[estado]
}

export function estadoPedidoClass(estado: PedidoWebEstado): string {
  return ESTADO_CLASS[estado]
}
