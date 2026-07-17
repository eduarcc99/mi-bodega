import { supabase } from '@/lib/supabase'
import type { MetodoPago } from '@/types/database'
import { todayLocalISO } from '@/lib/utils'

export interface CuotaInput {
  monto: number
  fecha_vencimiento: string
  descripcion?: string
}

export interface CuotaProveedor {
  id: string
  compra_id: string
  monto: number
  fecha_vencimiento: string
  descripcion: string | null
  pagado: boolean
  fecha_pago: string | null
  metodo_pago: MetodoPago | null
  gasto_caja_id: string | null
  compras: {
    id: string
    proveedor_nombre: string | null
    numero_factura: string | null
    total: number
    fecha: string
  } | null
}

export type EstadoCuota = 'vencida' | 'hoy' | 'proxima' | 'pagada'

export function estadoCuota(cuota: { pagado: boolean; fecha_vencimiento: string }): EstadoCuota {
  if (cuota.pagado) return 'pagada'
  const hoy = todayLocalISO()
  if (cuota.fecha_vencimiento < hoy) return 'vencida'
  if (cuota.fecha_vencimiento === hoy) return 'hoy'
  return 'proxima'
}

export function labelEstadoCuota(e: EstadoCuota): string {
  return (
    {
      vencida: 'Vencida',
      hoy: 'Vence hoy',
      proxima: 'Pendiente',
      pagada: 'Pagada',
    } satisfies Record<EstadoCuota, string>
  )[e]
}

async function crearGastoCompra(params: {
  compra_id: string
  fecha: string
  monto: number
  proveedorLabel: string
  numero_factura?: string
  metodo_pago: MetodoPago
  registrado_por: string
  sufijo?: string
}): Promise<string> {
  const facturaTxt = params.numero_factura?.trim() ? ` · ${params.numero_factura.trim()}` : ''
  const metodoTxt = params.metodo_pago === 'yape' ? ' (Yape)' : ''
  const sufijo = params.sufijo ? ` ${params.sufijo}` : ''

  const { data: gasto, error } = await supabase
    .from('gastos_caja')
    .insert({
      fecha: params.fecha,
      monto: params.monto,
      descripcion: `Compra ${params.proveedorLabel}${facturaTxt}${metodoTxt}${sufijo}`,
      categoria: 'compra_mercaderia',
      afecta_efectivo: params.metodo_pago === 'efectivo',
      registrado_por: params.registrado_por,
      compra_id: params.compra_id,
    })
    .select('id')
    .single()

  if (error || !gasto) throw new Error(error?.message ?? 'Error al registrar gasto de compra')
  return gasto.id
}

export async function insertarCuotasProveedor(
  compraId: string,
  cuotas: CuotaInput[],
  registrado_por: string,
): Promise<void> {
  if (cuotas.length === 0) return

  const rows = cuotas.map((c) => ({
    compra_id: compraId,
    monto: c.monto,
    fecha_vencimiento: c.fecha_vencimiento,
    descripcion: c.descripcion?.trim() || null,
    registrado_por,
  }))

  const { error } = await supabase.from('cuotas_proveedor').insert(rows)
  if (error) throw new Error(error.message)
}

export async function fetchCuotasPendientes(): Promise<CuotaProveedor[]> {
  const { data, error } = await supabase
    .from('cuotas_proveedor')
    .select(`
      id, compra_id, monto, fecha_vencimiento, descripcion, pagado,
      fecha_pago, metodo_pago, gasto_caja_id,
      compras(id, proveedor_nombre, numero_factura, total, fecha)
    `)
    .eq('pagado', false)
    .order('fecha_vencimiento', { ascending: true })

  if (error) throw new Error(error.message)
  return (data as unknown as CuotaProveedor[]) ?? []
}

export async function fetchCuotasPorCompra(compraId: string): Promise<CuotaProveedor[]> {
  const { data, error } = await supabase
    .from('cuotas_proveedor')
    .select(`
      id, compra_id, monto, fecha_vencimiento, descripcion, pagado,
      fecha_pago, metodo_pago, gasto_caja_id,
      compras(id, proveedor_nombre, numero_factura, total, fecha)
    `)
    .eq('compra_id', compraId)
    .order('fecha_vencimiento', { ascending: true })

  if (error) throw new Error(error.message)
  return (data as unknown as CuotaProveedor[]) ?? []
}

async function actualizarEstadoCompra(compraId: string): Promise<void> {
  const { data: cuotas, error } = await supabase
    .from('cuotas_proveedor')
    .select('monto, pagado')
    .eq('compra_id', compraId)

  if (error) throw new Error(error.message)

  const { data: compra, error: compraError } = await supabase
    .from('compras')
    .select('total, monto_pagado')
    .eq('id', compraId)
    .single()

  if (compraError || !compra) throw new Error(compraError?.message ?? 'Compra no encontrada')

  const total = Number(compra.total)
  const pagadoInicial = Number(compra.monto_pagado)
  const pendienteCuotas = (cuotas ?? [])
    .filter((c) => !c.pagado)
    .reduce((s, c) => s + Number(c.monto), 0)

  const montoPendiente = Math.round(pendienteCuotas * 100) / 100
  const montoPagado = Math.round((total - montoPendiente) * 100) / 100

  let estado_pago: 'pagado' | 'parcial' | 'pendiente' = 'pagado'
  if (montoPendiente >= total - 0.001 && pagadoInicial < 0.001) estado_pago = 'pendiente'
  else if (montoPendiente > 0.001) estado_pago = 'parcial'

  await supabase
    .from('compras')
    .update({ monto_pagado: montoPagado, monto_pendiente: montoPendiente, estado_pago })
    .eq('id', compraId)
}

export async function pagarCuotaProveedor(params: {
  cuota_id: string
  metodo_pago: MetodoPago
  registrado_por: string
  fecha_pago?: string
}): Promise<void> {
  const fechaPago = params.fecha_pago ?? todayLocalISO()

  const { data: cuota, error } = await supabase
    .from('cuotas_proveedor')
    .select(`
      id, compra_id, monto, pagado, descripcion,
      compras(proveedor_nombre, numero_factura)
    `)
    .eq('id', params.cuota_id)
    .single()

  if (error || !cuota) throw new Error(error?.message ?? 'Cuota no encontrada')
  if (cuota.pagado) throw new Error('Esta cuota ya fue pagada')
  if (params.metodo_pago === 'otro') {
    throw new Error('El pago de cuota debe ser en efectivo o Yape')
  }

  const compra = cuota.compras as unknown as {
    proveedor_nombre: string | null
    numero_factura: string | null
  } | null
  const proveedorLabel = compra?.proveedor_nombre?.trim() || 'Proveedor'
  const cuotaLabel = cuota.descripcion?.trim() ? ` · ${cuota.descripcion.trim()}` : ''

  const gastoId = await crearGastoCompra({
    compra_id: cuota.compra_id,
    fecha: fechaPago,
    monto: Number(cuota.monto),
    proveedorLabel,
    numero_factura: compra?.numero_factura ?? undefined,
    metodo_pago: params.metodo_pago,
    registrado_por: params.registrado_por,
    sufijo: `(cuota${cuotaLabel})`,
  })

  const { error: updateError } = await supabase
    .from('cuotas_proveedor')
    .update({
      pagado: true,
      fecha_pago: new Date().toISOString(),
      metodo_pago: params.metodo_pago,
      gasto_caja_id: gastoId,
    })
    .eq('id', params.cuota_id)

  if (updateError) {
    await supabase.from('gastos_caja').delete().eq('id', gastoId)
    throw new Error(updateError.message)
  }

  await actualizarEstadoCompra(cuota.compra_id)
}

export { crearGastoCompra }
