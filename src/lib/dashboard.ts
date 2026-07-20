import { supabase } from '@/lib/supabase'
import {
  gananciaPerdidaDevoluciones,
  totalDevoluciones,
  type DevolucionEnRango,
} from '@/lib/devoluciones'
import { diasHastaVencimiento, productoVencido, stockBajo, todayLocalISO } from '@/lib/utils'
import type { Producto } from '@/types/database'

export type PeriodoFiltro = 'hoy' | 'semana' | 'mes'

export interface KpisInventario {
  stockBajo: number
  porVencer: number
  vencidos: number
}

export interface KpisPeriodo {
  ventasNetas: number
  gananciaNeta: number
}

export interface KpisConsumo {
  totalCosto: number
  totalVentaPotencial: number
  oportunidadPerdida: number
  cantidadRetiros: number
}

export interface KpisCompras {
  total: number
  cantidad: number
}

function parseFechaLocal(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function formatFechaLarga(iso: string): string {
  return new Intl.DateTimeFormat('es-PE', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(parseFechaLocal(iso))
}

function formatMesAnio(iso: string): string {
  return new Intl.DateTimeFormat('es-PE', { month: 'long', year: 'numeric' }).format(
    parseFechaLocal(iso),
  )
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

/** Ej. "20 – 26" o "27 jul – 2 ago" */
function formatRangoCompacto(desdeISO: string, hastaISO: string): string {
  const desde = parseFechaLocal(desdeISO)
  const hasta = parseFechaLocal(hastaISO)
  const mismoMes =
    desde.getMonth() === hasta.getMonth() && desde.getFullYear() === hasta.getFullYear()

  if (mismoMes) return `${desde.getDate()} – ${hasta.getDate()}`

  const mesDesde = new Intl.DateTimeFormat('es-PE', { month: 'short' }).format(desde)
  const mesHasta = new Intl.DateTimeFormat('es-PE', { month: 'short' }).format(hasta)
  return `${desde.getDate()} ${mesDesde} – ${hasta.getDate()} ${mesHasta}`
}

/** Etiquetas simples para tarjetas KPI (sin repetir fechas) */
export function getEtiquetasKpi(periodo: PeriodoFiltro): {
  ventas: string
  ganancia: string
  compras: string
} {
  switch (periodo) {
    case 'hoy':
      return { ventas: 'Ventas netas', ganancia: 'Ganancia neta', compras: 'Compras' }
    case 'semana':
      return { ventas: 'Ventas netas', ganancia: 'Ganancia neta', compras: 'Compras' }
    case 'mes':
      return { ventas: 'Ventas netas', ganancia: 'Ganancia neta', compras: 'Compras' }
  }
}

/** Una sola línea de contexto para el período seleccionado */
export function getContextoPeriodo(
  periodo: PeriodoFiltro,
  fechaReferencia = todayLocalISO(),
): string {
  const esHoy = fechaReferencia === todayLocalISO()
  const { desdeISO, hastaISO } = getRangoPeriodo(periodo, fechaReferencia)

  switch (periodo) {
    case 'hoy':
      return capitalize(formatFechaLarga(fechaReferencia))
    case 'semana': {
      const rango = formatRangoCompacto(desdeISO, hastaISO)
      return esHoy ? `Esta semana · ${rango}` : `Semana · ${rango}`
    }
    case 'mes': {
      const ultimo = parseFechaLocal(hastaISO).getDate()
      const mes = capitalize(formatMesAnio(fechaReferencia))
      return esHoy ? `Este mes · del 1 al ${ultimo}` : `${mes} · del 1 al ${ultimo}`
    }
  }
}

export interface TopProducto {
  nombre: string
  cantidad: number
  monto: number
}

export interface CategoriaVenta {
  nombre: string
  monto: number
  porcentaje: number
}

export interface GananciaProducto {
  nombre: string
  ganancia: number
}

export interface VentaDiaria {
  fecha: string
  label: string
  total: number
}

export interface Alerta {
  tipo: 'stock' | 'vencimiento' | 'vencido' | 'sin_venta'
  mensaje: string
  producto?: string
  severidad: 'alta' | 'media' | 'baja'
}

interface VentaConDetalles {
  id: string
  total: number
  fecha: string
  venta_detalles: {
    cantidad: number
    precio_unitario: number
    descuento: number
    costo_unitario: number
    producto_id: string | null
    nombre_producto: string
    productos: {
      categoria_id: string | null
      categorias: { nombre: string } | null
    } | null
  }[]
}

function startOfDay(d = new Date()): Date {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

function endOfDay(d = new Date()): Date {
  const x = new Date(d)
  x.setHours(23, 59, 59, 999)
  return x
}

/** Lunes 00:00 de la semana que contiene la fecha (semana lun–dom) */
function startOfWeekMonday(d: Date): Date {
  const x = startOfDay(new Date(d))
  const day = x.getDay() // 0=dom, 1=lun, …, 6=sáb
  const daysFromMonday = day === 0 ? 6 : day - 1
  x.setDate(x.getDate() - daysFromMonday)
  return x
}

/** Día 1 del mes que contiene la fecha */
function startOfMonth(d: Date): Date {
  const x = startOfDay(new Date(d))
  x.setDate(1)
  return x
}

/** Domingo 23:59:59 de la semana lun–dom que contiene la fecha */
function endOfWeekSunday(d: Date): Date {
  const monday = startOfWeekMonday(d)
  const sunday = new Date(monday)
  sunday.setDate(sunday.getDate() + 6)
  return endOfDay(sunday)
}

/** Último día 23:59:59 del mes que contiene la fecha */
function endOfMonth(d: Date): Date {
  const x = startOfDay(new Date(d))
  x.setMonth(x.getMonth() + 1, 0)
  return endOfDay(x)
}

export function getRangoPeriodo(
  periodo: PeriodoFiltro,
  fechaReferencia = todayLocalISO(),
): { desde: Date; hasta: Date; desdeISO: string; hastaISO: string } {
  const base = parseFechaLocal(fechaReferencia)

  if (periodo === 'hoy') {
    const desde = startOfDay(base)
    const hasta = endOfDay(base)
    return {
      desde,
      hasta,
      desdeISO: fechaReferencia,
      hastaISO: fechaReferencia,
    }
  }

  if (periodo === 'semana') {
    const desde = startOfWeekMonday(base)
    const hasta = endOfWeekSunday(base)
    return {
      desde,
      hasta,
      desdeISO: todayLocalISO(desde),
      hastaISO: todayLocalISO(hasta),
    }
  }

  const desde = startOfMonth(base)
  const hasta = endOfMonth(base)
  return {
    desde,
    hasta,
    desdeISO: todayLocalISO(desde),
    hastaISO: todayLocalISO(hasta),
  }
}

function lineaGanancia(cantidad: number, precio: number, descuento: number, costo: number): number {
  return precio * cantidad - descuento - costo * cantidad
}

function lineaMonto(cantidad: number, precio: number, descuento: number): number {
  return precio * cantidad - descuento
}

export async function fetchVentasEnRango(desde: Date, hasta: Date): Promise<VentaConDetalles[]> {
  const { data, error } = await supabase
    .from('ventas')
    .select(`
      id, total, fecha,
      venta_detalles(
        cantidad, precio_unitario, descuento, costo_unitario,
        producto_id, nombre_producto,
        productos(categoria_id, categorias(nombre))
      )
    `)
    .eq('estado', 'completada')
    .gte('fecha', desde.toISOString())
    .lte('fecha', hasta.toISOString())
    .order('fecha', { ascending: true })

  if (error) throw new Error(error.message)
  return (data as unknown as VentaConDetalles[]) ?? []
}

export async function fetchComprasEnRango(desdeISO: string, hastaISO: string): Promise<KpisCompras> {
  const { data, error } = await supabase
    .from('compras')
    .select('id, total')
    .gte('fecha', desdeISO)
    .lte('fecha', hastaISO)

  if (error) throw new Error(error.message)

  const rows = data ?? []
  const total = rows.reduce((s, c) => s + Number(c.total), 0)

  return {
    total: Math.round(total * 100) / 100,
    cantidad: rows.length,
  }
}

export async function fetchConsumoEnRango(desde: Date, hasta: Date): Promise<KpisConsumo> {
  const { data, error } = await supabase
    .from('retiros_consumo')
    .select('id, total_costo, total_venta_potencial')
    .gte('fecha', desde.toISOString())
    .lte('fecha', hasta.toISOString())

  if (error) throw new Error(error.message)

  const rows = data ?? []
  let totalCosto = 0
  let totalVentaPotencial = 0

  for (const r of rows) {
    totalCosto += Number(r.total_costo)
    totalVentaPotencial += Number(r.total_venta_potencial)
  }

  return {
    totalCosto: Math.round(totalCosto * 100) / 100,
    totalVentaPotencial: Math.round(totalVentaPotencial * 100) / 100,
    oportunidadPerdida: Math.round((totalVentaPotencial - totalCosto) * 100) / 100,
    cantidadRetiros: rows.length,
  }
}

export function calcKpisPeriodo(
  ventas: VentaConDetalles[],
  devoluciones: DevolucionEnRango[] = [],
): KpisPeriodo {
  const ventasBrutas = ventas.reduce((s, v) => s + Number(v.total), 0)
  const ventasNetas = Math.round((ventasBrutas - totalDevoluciones(devoluciones)) * 100) / 100

  let gananciaNeta = 0
  for (const v of ventas) {
    for (const d of v.venta_detalles ?? []) {
      gananciaNeta += lineaGanancia(
        Number(d.cantidad),
        Number(d.precio_unitario),
        Number(d.descuento),
        Number(d.costo_unitario),
      )
    }
  }
  gananciaNeta -= gananciaPerdidaDevoluciones(devoluciones)

  return {
    ventasNetas,
    gananciaNeta: Math.round(gananciaNeta * 100) / 100,
  }
}

export async function fetchKpisInventario(): Promise<KpisInventario> {
  const { data: productosRes } = await supabase
    .from('productos')
    .select('stock, stock_minimo, activo')
    .eq('activo', true)

  const productos = (productosRes ?? []) as Pick<Producto, 'stock' | 'stock_minimo' | 'activo'>[]

  let stockBajoCount = 0
  for (const p of productos) {
    if (stockBajo(Number(p.stock), Number(p.stock_minimo))) stockBajoCount++
  }

  const { data: lotesRes } = await supabase
    .from('producto_lotes')
    .select('fecha_vencimiento, cantidad, productos(activo)')
    .gt('cantidad', 0)
    .not('fecha_vencimiento', 'is', null)

  let porVencer = 0
  let vencidos = 0

  for (const row of lotesRes ?? []) {
    const prod = row.productos as unknown as { activo: boolean } | null
    if (!prod?.activo) continue

    const fv = row.fecha_vencimiento as string
    if (productoVencido(fv)) {
      vencidos++
    } else {
      const dias = diasHastaVencimiento(fv)
      if (dias !== null && dias <= 15) porVencer++
    }
  }

  return { stockBajo: stockBajoCount, porVencer, vencidos }
}

function restarDevolucionesProductos(
  map: Map<string, TopProducto>,
  devoluciones: DevolucionEnRango[],
): void {
  for (const dev of devoluciones) {
    for (const d of dev.devolucion_detalles ?? []) {
      const vd = d.venta_detalles
      const nombre = vd?.nombre_producto ?? 'Producto'
      const key = d.producto_id ?? vd?.producto_id ?? nombre
      const existing = map.get(key) ?? { nombre, cantidad: 0, monto: 0 }
      existing.cantidad -= Number(d.cantidad)
      existing.monto -= Number(d.monto_devuelto)
      map.set(key, existing)
    }
  }
}

export function calcTopProductos(
  ventas: VentaConDetalles[],
  devoluciones: DevolucionEnRango[] = [],
  limit = 10,
): TopProducto[] {
  const map = new Map<string, TopProducto>()

  for (const v of ventas) {
    for (const d of v.venta_detalles ?? []) {
      const key = d.producto_id ?? d.nombre_producto
      const existing = map.get(key) ?? { nombre: d.nombre_producto, cantidad: 0, monto: 0 }
      existing.cantidad += Number(d.cantidad)
      existing.monto += lineaMonto(Number(d.cantidad), Number(d.precio_unitario), Number(d.descuento))
      map.set(key, existing)
    }
  }

  restarDevolucionesProductos(map, devoluciones)

  return [...map.values()]
    .filter((p) => p.cantidad > 0)
    .sort((a, b) => b.cantidad - a.cantidad)
    .slice(0, limit)
    .map((p) => ({ ...p, monto: Math.round(p.monto * 100) / 100 }))
}

export function calcVentasPorCategoria(
  ventas: VentaConDetalles[],
  devoluciones: DevolucionEnRango[] = [],
): CategoriaVenta[] {
  const map = new Map<string, number>()

  for (const v of ventas) {
    for (const d of v.venta_detalles ?? []) {
      const cat = d.productos?.categorias?.nombre ?? 'Sin categoría'
      const monto = lineaMonto(Number(d.cantidad), Number(d.precio_unitario), Number(d.descuento))
      map.set(cat, (map.get(cat) ?? 0) + monto)
    }
  }

  for (const dev of devoluciones) {
    for (const d of dev.devolucion_detalles ?? []) {
      const cat = d.venta_detalles?.productos?.categorias?.nombre ?? 'Sin categoría'
      map.set(cat, (map.get(cat) ?? 0) - Number(d.monto_devuelto))
    }
  }

  const total = [...map.values()].reduce((s, v) => s + Math.max(0, v), 0) || 1

  return [...map.entries()]
    .filter(([, monto]) => monto > 0)
    .map(([nombre, monto]) => ({
      nombre,
      monto: Math.round(monto * 100) / 100,
      porcentaje: Math.round((Math.max(0, monto) / total) * 1000) / 10,
    }))
    .sort((a, b) => b.monto - a.monto)
}

export function calcTopGanancia(
  ventas: VentaConDetalles[],
  devoluciones: DevolucionEnRango[] = [],
  limit = 10,
): GananciaProducto[] {
  const map = new Map<string, number>()

  for (const v of ventas) {
    for (const d of v.venta_detalles ?? []) {
      const key = d.nombre_producto
      const g = lineaGanancia(
        Number(d.cantidad),
        Number(d.precio_unitario),
        Number(d.descuento),
        Number(d.costo_unitario),
      )
      map.set(key, (map.get(key) ?? 0) + g)
    }
  }

  for (const dev of devoluciones) {
    for (const d of dev.devolucion_detalles ?? []) {
      const key = d.venta_detalles?.nombre_producto ?? 'Producto'
      const costo = Number(d.venta_detalles?.costo_unitario ?? 0)
      const gPerdida = Number(d.monto_devuelto) - costo * Number(d.cantidad)
      map.set(key, (map.get(key) ?? 0) - gPerdida)
    }
  }

  return [...map.entries()]
    .filter(([, ganancia]) => ganancia > 0)
    .map(([nombre, ganancia]) => ({ nombre, ganancia: Math.round(ganancia * 100) / 100 }))
    .sort((a, b) => b.ganancia - a.ganancia)
    .slice(0, limit)
}

export function calcVentasDiarias(
  ventas: VentaConDetalles[],
  devoluciones: DevolucionEnRango[] = [],
): VentaDiaria[] {
  const map = new Map<string, number>()

  for (const v of ventas) {
    const day = v.fecha.slice(0, 10)
    map.set(day, (map.get(day) ?? 0) + Number(v.total))
  }

  for (const dev of devoluciones) {
    const day = dev.fecha.slice(0, 10)
    map.set(day, (map.get(day) ?? 0) - Number(dev.total))
  }

  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([fecha, total]) => ({
      fecha,
      label: new Intl.DateTimeFormat('es-PE', { day: 'numeric', month: 'short' }).format(
        new Date(fecha + 'T12:00:00'),
      ),
      total: Math.round(total * 100) / 100,
    }))
}

export async function fetchAlertas(): Promise<Alerta[]> {
  const alertas: Alerta[] = []

  const { data: productos } = await supabase
    .from('productos')
    .select('id, nombre, stock, stock_minimo, fecha_vencimiento, activo')
    .eq('activo', true)
    .order('nombre')

  if (!productos) return alertas

  const hace15 = new Date()
  hace15.setDate(hace15.getDate() - 15)

  const { data: ventasRecientes } = await supabase
    .from('ventas')
    .select('venta_detalles(producto_id)')
    .eq('estado', 'completada')
    .gte('fecha', hace15.toISOString())

  const vendidos = new Set<string>()
  for (const v of ventasRecientes ?? []) {
    for (const d of v.venta_detalles ?? []) {
      if (d.producto_id) vendidos.add(d.producto_id)
    }
  }

  for (const p of productos as Producto[]) {
    if (stockBajo(Number(p.stock), Number(p.stock_minimo))) {
      alertas.push({
        tipo: 'stock',
        producto: p.nombre,
        mensaje: `${p.nombre} tiene solo ${p.stock} unidades — pedir más`,
        severidad: Number(p.stock) === 0 ? 'alta' : 'media',
      })
    }

    if (productoVencido(p.fecha_vencimiento)) {
      alertas.push({
        tipo: 'vencido',
        producto: p.nombre,
        mensaje: `${p.nombre} está vencido — bloquear venta`,
        severidad: 'alta',
      })
    } else {
      const dias = diasHastaVencimiento(p.fecha_vencimiento)
      if (dias !== null && dias <= 15) {
        alertas.push({
          tipo: 'vencimiento',
          producto: p.nombre,
          mensaje: `${p.nombre} vence en ${dias} días — quedan ${p.stock} unidades`,
          severidad: dias <= 5 ? 'alta' : 'media',
        })
      }
    }

    if (!vendidos.has(p.id) && Number(p.stock) > 0) {
      alertas.push({
        tipo: 'sin_venta',
        producto: p.nombre,
        mensaje: `${p.nombre} no se vende hace 15 días — ¿aplicar descuento?`,
        severidad: 'baja',
      })
    }
  }

  const orden = { alta: 0, media: 1, baja: 2 }
  return alertas.sort((a, b) => orden[a.severidad] - orden[b.severidad])
}

export interface VencimientoResumen {
  nombre: string
  cantidad: number
  valorPerdida: number
  dias: number | null
  estado: 'vencido' | 'por_vencer'
}

export async function fetchMapaVencimientos(): Promise<VencimientoResumen[]> {
  const { data } = await supabase
    .from('producto_lotes')
    .select('cantidad, fecha_vencimiento, productos(nombre, costo, activo)')
    .gt('cantidad', 0)
    .not('fecha_vencimiento', 'is', null)
    .order('fecha_vencimiento')

  if (!data) return []

  return data
    .map((row) => {
      const p = row.productos as unknown as {
        nombre: string
        costo: number
        activo: boolean
      } | null
      if (!p?.activo) return null

      const dias = diasHastaVencimiento(row.fecha_vencimiento as string)
      const vencido = productoVencido(row.fecha_vencimiento as string)
      if (!vencido && (dias === null || dias > 15)) return null

      const cantidad = Number(row.cantidad)
      const costo = Number(p.costo)

      return {
        nombre: `${p.nombre} (${cantidad} ud)`,
        cantidad,
        valorPerdida: Math.round(cantidad * costo * 100) / 100,
        dias,
        estado: vencido ? ('vencido' as const) : ('por_vencer' as const),
      }
    })
    .filter(Boolean) as VencimientoResumen[]
}
