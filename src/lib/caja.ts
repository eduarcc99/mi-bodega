import { supabase } from '@/lib/supabase'
import { fetchDevolucionesDelDia } from '@/lib/devoluciones'
import { localDayRangeISO, todayLocalISO, formatMoney } from '@/lib/utils'
import type { MetodoPago } from '@/types/database'
import jsPDF from 'jspdf'

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

export interface AperturaCaja {
  id: string
  fecha: string
  monto: number
  cajero_id: string
  created_at: string
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
  consumoPropioCosto: number
  consumoPropioOportunidad: number
  apertura: AperturaCaja | null
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
  motivo_diferencia: string | null
  notas: string | null
  fecha_hora: string
}

/** Billetes y monedas soles peruanos */
export const DENOMINACIONES = [
  { valor: 200, label: 'S/ 200' },
  { valor: 100, label: 'S/ 100' },
  { valor: 50, label: 'S/ 50' },
  { valor: 20, label: 'S/ 20' },
  { valor: 10, label: 'S/ 10' },
  { valor: 5, label: 'S/ 5' },
  { valor: 2, label: 'S/ 2' },
  { valor: 1, label: 'S/ 1' },
  { valor: 0.5, label: 'S/ 0.50' },
  { valor: 0.2, label: 'S/ 0.20' },
  { valor: 0.1, label: 'S/ 0.10' },
] as const

export type ConteosBilletes = Record<string, number>

export function totalDesdeConteos(conteos: ConteosBilletes): number {
  let total = 0
  for (const d of DENOMINACIONES) {
    const qty = Number(conteos[String(d.valor)] ?? 0)
    if (qty > 0) total += d.valor * qty
  }
  return Math.round(total * 100) / 100
}

export const UMBRAL_DIFERENCIA = 0.01

export async function fetchUltimoCierre(): Promise<{ fecha: string; efectivo_declarado: number } | null> {
  const { data } = await supabase
    .from('cierres_caja')
    .select('fecha, efectivo_declarado')
    .order('fecha_hora', { ascending: false })
    .limit(1)
    .maybeSingle()

  return data
}

export async function abrirCaja(params: {
  cajero_id: string
  monto: number
  fecha?: string
  notas?: string
}): Promise<void> {
  const fecha = params.fecha ?? todayLocalISO()
  if (params.monto < 0) throw new Error('El monto de apertura no puede ser negativo')

  const { data: existing } = await supabase
    .from('aperturas_caja')
    .select('id')
    .eq('fecha', fecha)
    .maybeSingle()

  if (existing) {
    const { error } = await supabase
      .from('aperturas_caja')
      .update({
        monto: params.monto,
        cajero_id: params.cajero_id,
        notas: params.notas || null,
      })
      .eq('id', existing.id)
    if (error) throw new Error(error.message)
    return
  }

  const { error } = await supabase.from('aperturas_caja').insert({
    fecha,
    cajero_id: params.cajero_id,
    monto: params.monto,
    notas: params.notas || null,
  })
  if (error) throw new Error(error.message)
}

export async function fetchResumenCaja(fecha = todayLocalISO()): Promise<ResumenCajaDia> {
  const { desde, hasta } = localDayRangeISO(fecha)

  const [ventasRes, gastosRes, cierreRes, ultimoCierre, devoluciones, consumoRes, aperturaRes] =
    await Promise.all([
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
        .select(
          'id, efectivo_declarado, diferencia, efectivo_esperado, yape_declarado, yape_esperado, diferencia_yape, motivo_diferencia, notas, fecha_hora',
        )
        .eq('fecha', fecha)
        .maybeSingle(),
      fetchUltimoCierre(),
      fetchDevolucionesDelDia(fecha),
      supabase
        .from('retiros_consumo')
        .select('total_costo, total_venta_potencial')
        .gte('fecha', desde)
        .lte('fecha', hasta),
      supabase.from('aperturas_caja').select('*').eq('fecha', fecha).maybeSingle(),
    ])

  const ventas = (ventasRes.data ?? []) as VentaResumen[]
  const gastos = (gastosRes.data ?? []) as GastoCaja[]
  const apertura = (aperturaRes.data as AperturaCaja | null) ?? null

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

  // Prioridad: apertura del día → cierre anterior → 0
  let efectivoInicial = 0
  if (apertura) {
    efectivoInicial = Number(apertura.monto)
  } else if (ultimoCierre && ultimoCierre.fecha < fecha) {
    efectivoInicial = Number(ultimoCierre.efectivo_declarado)
  }

  const efectivoEsperado = efectivoInicial + ventasEfectivo - totalGastos - devolucionesEfectivo

  let consumoPropioCosto = 0
  let consumoPropioVenta = 0
  for (const r of consumoRes.data ?? []) {
    consumoPropioCosto += Number(r.total_costo)
    consumoPropioVenta += Number(r.total_venta_potencial)
  }
  consumoPropioCosto = Math.round(consumoPropioCosto * 100) / 100
  const consumoPropioOportunidad =
    Math.round((consumoPropioVenta - consumoPropioCosto) * 100) / 100

  const movimientos: MovimientoCaja[] = []

  movimientos.push({
    id: 'apertura',
    tipo: 'apertura',
    descripcion: apertura
      ? 'Apertura de caja (contado en la mañana)'
      : efectivoInicial > 0
        ? 'Efectivo con el que abriste (del cierre anterior)'
        : 'Efectivo con el que abriste',
    monto: efectivoInicial,
    esEntrada: true,
    afectaCaja: true,
  })

  for (const v of ventas) {
    const esEfectivo = v.metodo_pago === 'efectivo'
    const metodoLabel =
      v.metodo_pago === 'yape' ? 'Yape' : v.metodo_pago === 'otro' ? 'Otro' : 'Efectivo'
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
      hora: new Date(g.created_at).toLocaleTimeString('es-PE', {
        hour: '2-digit',
        minute: '2-digit',
      }),
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
    consumoPropioCosto,
    consumoPropioOportunidad,
    apertura,
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
  motivo_diferencia?: string
  notas?: string
}): Promise<void> {
  const diferencia = Math.round((params.efectivo_declarado - params.efectivo_esperado) * 100) / 100
  const diferencia_yape = Math.round((params.yape_declarado - params.yape_esperado) * 100) / 100

  const hayDiferencia =
    Math.abs(diferencia) >= UMBRAL_DIFERENCIA || Math.abs(diferencia_yape) >= UMBRAL_DIFERENCIA

  if (hayDiferencia && !params.motivo_diferencia?.trim()) {
    throw new Error('Indica el motivo de la diferencia (faltante o sobrante)')
  }

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
    motivo_diferencia: hayDiferencia ? params.motivo_diferencia!.trim() : null,
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

export function exportarCierrePDF(params: {
  resumen: ResumenCajaDia
  cajeroNombre: string
  efectivoDeclarado: number
  yapeDeclarado: number
  diferencia: number
  diferenciaYape: number
  motivoDiferencia?: string
  notas?: string
}): void {
  const {
    resumen,
    cajeroNombre,
    efectivoDeclarado,
    yapeDeclarado,
    diferencia,
    diferenciaYape,
    motivoDiferencia,
    notas,
  } = params

  const doc = new jsPDF()
  let y = 16

  doc.setFontSize(14)
  doc.text('MI BODEGA', 14, y)
  y += 8
  doc.setFontSize(12)
  doc.text('Resumen de cierre de caja', 14, y)
  y += 8
  doc.setFontSize(10)
  doc.text(`Fecha: ${resumen.fecha}`, 14, y)
  y += 6
  doc.text(`Cajero: ${cajeroNombre}`, 14, y)
  y += 6
  doc.text(`Generado: ${new Date().toLocaleString('es-PE')}`, 14, y)
  y += 10

  const lineas: [string, string][] = [
    ['Apertura / efectivo inicial', formatMoney(resumen.efectivoInicial)],
    ['Ventas efectivo', formatMoney(resumen.ventasEfectivo)],
    ['Ventas Yape', formatMoney(resumen.ventasYape)],
    ['Ventas otro', formatMoney(resumen.ventasOtros)],
    ['Gastos efectivo', formatMoney(resumen.totalGastos)],
    ['Efectivo esperado', formatMoney(resumen.efectivoEsperado)],
    ['Efectivo contado', formatMoney(efectivoDeclarado)],
    ['Diferencia efectivo', formatMoney(diferencia)],
    ['Yape esperado', formatMoney(resumen.yapeEsperado)],
    ['Yape declarado', formatMoney(yapeDeclarado)],
    ['Diferencia Yape', formatMoney(diferenciaYape)],
  ]

  if (resumen.consumoPropioCosto > 0) {
    lineas.push(['Consumo propio (al costo, informativo)', formatMoney(resumen.consumoPropioCosto)])
  }

  doc.setFontSize(10)
  for (const [label, valor] of lineas) {
    doc.text(label, 14, y)
    doc.text(valor, 140, y)
    y += 6
  }

  if (motivoDiferencia) {
    y += 4
    doc.setFont('helvetica', 'bold')
    doc.text('Motivo diferencia:', 14, y)
    doc.setFont('helvetica', 'normal')
    y += 6
    const lines = doc.splitTextToSize(motivoDiferencia, 180)
    doc.text(lines, 14, y)
    y += lines.length * 6
  }

  if (notas) {
    y += 4
    doc.setFont('helvetica', 'bold')
    doc.text('Notas:', 14, y)
    doc.setFont('helvetica', 'normal')
    y += 6
    const lines = doc.splitTextToSize(notas, 180)
    doc.text(lines, 14, y)
  }

  doc.save(`cierre_caja_${resumen.fecha}.pdf`)
}

export const CATEGORIAS_GASTO = [
  { id: 'compra_mercaderia', label: 'Compra mercadería (pollo, verduras…)' },
  { id: 'proveedor', label: 'Pago a proveedor' },
  { id: 'personal', label: 'Pago personal / delivery' },
  { id: 'servicios', label: 'Servicios (luz, agua…)' },
  { id: 'otro', label: 'Otro gasto' },
]
