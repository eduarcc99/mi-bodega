import { supabase } from '@/lib/supabase'
import { fetchDevolucionesDelDia } from '@/lib/devoluciones'
import { localDayRangeISO, todayLocalISO } from '@/lib/utils'
import type { MetodoPago } from '@/types/database'

export interface VentaResumen {
  id: string
  total: number
  metodo_pago: MetodoPago
  fecha: string
}

export interface GastoCaja {
  id: string
  fecha: string
  monto: number
  descripcion: string
  categoria: string
  afecta_efectivo: boolean
  created_at: string
}

export interface MovimientoCaja {
  id: string
  tipo: 'apertura' | 'venta' | 'gasto' | 'yape_info' | 'devolucion'
  descripcion: string
  monto: number
  esEntrada: boolean
  afectaCaja: boolean
  hora?: string
}

export interface ResumenCajaDia {
  fecha: string
  efectivoInicial: number
  ventasEfectivo: number
  ventasYape: number
  ventasOtros: number
  totalVentas: number
  totalGastos: number
  totalDevoluciones: number
  devolucionesYape: number
  yapeEsperado: number
  efectivoEsperado: number
  ventas: VentaResumen[]
  gastos: GastoCaja[]
  movimientos: MovimientoCaja[]
  cierreExistente: CierreExistente | null
}

export interface CierreExistente {
  id: string
  efectivo_declarado: number
  diferencia: number
  efectivo_esperado: number
  yape_declarado: number
  yape_esperado: number
  diferencia_yape: number
  fecha_hora: string
}

export async function fetchUltimoCierre(): Promise<{ fecha: string; efectivo_declarado: number } | null> {
  const { data } = await supabase
    .from('cierres_caja')
    .select('fecha, efectivo_declarado')
    .order('fecha_hora', { ascending: false })
    .limit(1)
    .maybeSingle()

  return data
}

export async function fetchResumenCaja(fecha = todayLocalISO()): Promise<ResumenCajaDia> {
  const { desde, hasta } = localDayRangeISO(fecha)

  const [ventasRes, gastosRes, cierreRes, ultimoCierre, devoluciones] = await Promise.all([
    supabase
      .from('ventas')
      .select('id, total, metodo_pago, fecha')
      .eq('estado', 'completada')
      .gte('fecha', desde)
      .lte('fecha', hasta)
      .order('fecha', { ascending: true }),
    supabase
      .from('gastos_caja')
      .select('*')
      .eq('fecha', fecha)
      .order('created_at', { ascending: true }),
    supabase
      .from('cierres_caja')
      .select('id, efectivo_declarado, diferencia, efectivo_esperado, yape_declarado, yape_esperado, diferencia_yape, fecha_hora')
      .eq('fecha', fecha)
      .maybeSingle(),
    fetchUltimoCierre(),
    fetchDevolucionesDelDia(fecha),
  ])

  const ventas = (ventasRes.data ?? []) as VentaResumen[]
  const gastos = (gastosRes.data ?? []) as GastoCaja[]

  let ventasEfectivo = 0
  let ventasYape = 0
  let ventasOtros = 0

  for (const v of ventas) {
    const t = Number(v.total)
    if (v.metodo_pago === 'efectivo') ventasEfectivo += t
    else if (v.metodo_pago === 'yape') ventasYape += t
    else ventasOtros += t
  }

  const totalGastos = gastos
    .filter((g) => g.afecta_efectivo)
    .reduce((s, g) => s + Number(g.monto), 0)

  let devolucionesEfectivo = 0
  let devolucionesYape = 0
  for (const d of devoluciones) {
    if (d.metodo_pago === 'efectivo') devolucionesEfectivo += Number(d.total)
    else if (d.metodo_pago === 'yape') devolucionesYape += Number(d.total)
  }
  const totalDevoluciones = devoluciones.reduce((s, d) => s + Number(d.total), 0)

  const yapeEsperado = Math.round((ventasYape - devolucionesYape) * 100) / 100

  // Efectivo inicial: del cierre anterior si es día distinto, o 0 si mismo día
  let efectivoInicial = 0
  if (ultimoCierre && ultimoCierre.fecha < fecha) {
    efectivoInicial = Number(ultimoCierre.efectivo_declarado)
  }

  const efectivoEsperado = efectivoInicial + ventasEfectivo - totalGastos - devolucionesEfectivo

  const movimientos: MovimientoCaja[] = []

  movimientos.push({
    id: 'apertura',
    tipo: 'apertura',
    descripcion: efectivoInicial > 0
      ? `Efectivo con el que abriste (del cierre anterior)`
      : 'Efectivo con el que abriste',
    monto: efectivoInicial,
    esEntrada: true,
    afectaCaja: true,
  })

  for (const v of ventas) {
    const esEfectivo = v.metodo_pago === 'efectivo'
    const metodoLabel = v.metodo_pago === 'yape' ? 'Yape' : v.metodo_pago === 'otro' ? 'Otro' : 'Efectivo'
    movimientos.push({
      id: v.id,
      tipo: esEfectivo ? 'venta' : 'yape_info',
      descripcion: `Venta ${metodoLabel} · ticket ${v.id.slice(0, 8).toUpperCase()}`,
      monto: Number(v.total),
      esEntrada: true,
      afectaCaja: esEfectivo,
      hora: new Date(v.fecha).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' }),
    })
  }

  for (const g of gastos) {
    movimientos.push({
      id: g.id,
      tipo: 'gasto',
      descripcion: g.descripcion,
      monto: Number(g.monto),
      esEntrada: false,
      afectaCaja: g.afecta_efectivo,
      hora: new Date(g.created_at).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' }),
    })
  }

  for (const d of devoluciones) {
    const esEfectivo = d.metodo_pago === 'efectivo'
    movimientos.push({
      id: d.id,
      tipo: 'devolucion',
      descripcion: `Devolución ${esEfectivo ? 'efectivo' : 'Yape'} · ticket ${d.venta_id.slice(0, 8).toUpperCase()}`,
      monto: Number(d.total),
      esEntrada: false,
      afectaCaja: esEfectivo,
    })
  }

  return {
    fecha,
    efectivoInicial,
    ventasEfectivo,
    ventasYape,
    ventasOtros,
    totalVentas: ventasEfectivo + ventasYape + ventasOtros,
    totalGastos,
    totalDevoluciones,
    devolucionesYape,
    yapeEsperado,
    efectivoEsperado: Math.round(efectivoEsperado * 100) / 100,
    ventas,
    gastos,
    movimientos,
    cierreExistente: cierreRes.data as CierreExistente | null,
  }
}

export async function registrarGasto(params: {
  descripcion: string
  monto: number
  categoria: string
  registrado_por: string
  fecha?: string
  afecta_efectivo?: boolean
}): Promise<void> {
  const { error } = await supabase.from('gastos_caja').insert({
    descripcion: params.descripcion,
    monto: params.monto,
    categoria: params.categoria,
    registrado_por: params.registrado_por,
    fecha: params.fecha ?? todayLocalISO(),
    afecta_efectivo: params.afecta_efectivo ?? true,
  })
  if (error) throw new Error(error.message)
}

export async function eliminarGasto(id: string): Promise<void> {
  const { error } = await supabase.from('gastos_caja').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

export async function cerrarCaja(params: {
  cajero_id: string
  fecha: string
  efectivo_inicial: number
  ventas_efectivo: number
  ventas_yape: number
  ventas_otros: number
  total_gastos: number
  efectivo_esperado: number
  efectivo_declarado: number
  yape_esperado: number
  yape_declarado: number
  notas?: string
}): Promise<void> {
  const diferencia = Math.round((params.efectivo_declarado - params.efectivo_esperado) * 100) / 100
  const diferencia_yape = Math.round((params.yape_declarado - params.yape_esperado) * 100) / 100

  const payload = {
    cajero_id: params.cajero_id,
    fecha: params.fecha,
    efectivo_inicial: params.efectivo_inicial,
    total_efectivo: params.ventas_efectivo,
    total_yape: params.ventas_yape,
    total_otros: params.ventas_otros,
    total_ventas: params.ventas_efectivo + params.ventas_yape + params.ventas_otros,
    total_gastos: params.total_gastos,
    efectivo_esperado: params.efectivo_esperado,
    efectivo_declarado: params.efectivo_declarado,
    diferencia,
    yape_esperado: params.yape_esperado,
    yape_declarado: params.yape_declarado,
    diferencia_yape,
    notas: params.notas || null,
  }

  const { data: existing } = await supabase
    .from('cierres_caja')
    .select('id')
    .eq('fecha', params.fecha)
    .maybeSingle()

  if (existing) {
    const { error } = await supabase.from('cierres_caja').update(payload).eq('id', existing.id)
    if (error) throw new Error(error.message)
  } else {
    const { error } = await supabase.from('cierres_caja').insert(payload)
    if (error) throw new Error(error.message)
  }
}

export const CATEGORIAS_GASTO = [
  { id: 'compra_mercaderia', label: 'Compra mercadería (pollo, verduras…)' },
  { id: 'proveedor', label: 'Pago a proveedor' },
  { id: 'personal', label: 'Pago personal / delivery' },
  { id: 'servicios', label: 'Servicios (luz, agua…)' },
  { id: 'otro', label: 'Otro gasto' },
]
