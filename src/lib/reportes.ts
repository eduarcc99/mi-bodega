import { supabase } from '@/lib/supabase'
import { fetchDevolucionesEnRango, totalDevoluciones } from '@/lib/devoluciones'
import { formatMoney, diasHastaVencimiento, productoVencido, localDayRangeISO } from '@/lib/utils'

export type TipoReporte = 'ventas' | 'compras' | 'inventario' | 'vencimientos' | 'cierres'

export interface FilaReporte {
  [key: string]: string | number
}

export interface ReporteData {
  titulo: string
  columnas: { key: string; label: string }[]
  filas: FilaReporte[]
  totales?: Record<string, string | number>
}

function rangoISO(desde: string, hasta: string) {
  return {
    desde: localDayRangeISO(desde).desde,
    hasta: localDayRangeISO(hasta).hasta,
  }
}

export async function fetchReporteVentas(desde: string, hasta: string): Promise<ReporteData> {
  const { desde: d, hasta: h } = rangoISO(desde, hasta)

  const [ventasRes, devoluciones] = await Promise.all([
    supabase
      .from('ventas')
      .select(`
        id, fecha, total, metodo_pago, estado,
        perfiles:cajero_id(nombre)
      `)
      .gte('fecha', d)
      .lte('fecha', h)
      .order('fecha', { ascending: false }),
    fetchDevolucionesEnRango(new Date(d), new Date(h)),
  ])

  if (ventasRes.error) throw new Error(ventasRes.error.message)

  const filasVentas: FilaReporte[] = (ventasRes.data ?? []).map((v) => ({
    ticket: v.id.slice(0, 8).toUpperCase(),
    fecha: new Date(v.fecha).toLocaleString('es-PE'),
    cajero: (v.perfiles as unknown as { nombre: string } | null)?.nombre ?? '—',
    metodo: v.metodo_pago === 'yape' ? 'Yape' : v.metodo_pago === 'otro' ? 'Otro' : 'Efectivo',
    total: Number(v.total),
    estado: v.estado === 'anulada' ? 'Anulada' : 'Completada',
  }))

  const filasDevoluciones: FilaReporte[] = devoluciones.map((dev) => ({
    ticket: dev.venta_id.slice(0, 8).toUpperCase(),
    fecha: new Date(dev.fecha).toLocaleString('es-PE'),
    cajero: '—',
    metodo: 'Devolución',
    total: Number(dev.total),
    estado: 'Devolución',
  }))

  const filas = [...filasVentas, ...filasDevoluciones].sort(
    (a, b) => new Date(String(b.fecha)).getTime() - new Date(String(a.fecha)).getTime(),
  )

  const ventasBrutas = filasVentas
    .filter((f) => f.estado === 'Completada')
    .reduce((s, f) => s + Number(f.total), 0)
  const devolucionesTotal = totalDevoluciones(devoluciones)
  const neto = Math.round((ventasBrutas - devolucionesTotal) * 100) / 100

  return {
    titulo: `Ventas del ${desde} al ${hasta}`,
    columnas: [
      { key: 'ticket', label: 'Ticket' },
      { key: 'fecha', label: 'Fecha' },
      { key: 'cajero', label: 'Cajero' },
      { key: 'metodo', label: 'Pago' },
      { key: 'total', label: 'Total (S/)' },
      { key: 'estado', label: 'Estado' },
    ],
    filas,
    totales: {
      total: neto,
      label: `${filasVentas.filter((f) => f.estado === 'Completada').length} ventas · ${filasDevoluciones.length} devoluciones · Neto: ${formatMoney(neto)}`,
    },
  }
}

export async function fetchReporteVentasPorProducto(desde: string, hasta: string): Promise<ReporteData> {
  const { desde: d, hasta: h } = rangoISO(desde, hasta)

  const [ventasRes, devoluciones] = await Promise.all([
    supabase
      .from('ventas')
      .select(`
        venta_detalles(nombre_producto, cantidad, precio_unitario, descuento)
      `)
      .eq('estado', 'completada')
      .gte('fecha', d)
      .lte('fecha', h),
    fetchDevolucionesEnRango(new Date(d), new Date(h)),
  ])

  if (ventasRes.error) throw new Error(ventasRes.error.message)

  const map = new Map<string, { cantidad: number; monto: number }>()
  for (const v of ventasRes.data ?? []) {
    for (const det of v.venta_detalles ?? []) {
      const nombre = det.nombre_producto as string
      const cant = Number(det.cantidad)
      const monto = Number(det.precio_unitario) * cant - Number(det.descuento)
      const ex = map.get(nombre) ?? { cantidad: 0, monto: 0 }
      ex.cantidad += cant
      ex.monto += monto
      map.set(nombre, ex)
    }
  }

  for (const dev of devoluciones) {
    for (const det of dev.devolucion_detalles ?? []) {
      const nombre = det.venta_detalles?.nombre_producto ?? 'Producto'
      const ex = map.get(nombre) ?? { cantidad: 0, monto: 0 }
      ex.cantidad -= Number(det.cantidad)
      ex.monto -= Number(det.monto_devuelto)
      map.set(nombre, ex)
    }
  }

  const filas: FilaReporte[] = [...map.entries()]
    .filter(([, { cantidad, monto }]) => cantidad > 0 || monto > 0)
    .map(([producto, { cantidad, monto }]) => ({
      producto,
      cantidad: Math.round(cantidad * 1000) / 1000,
      monto: Math.round(monto * 100) / 100,
    }))
    .sort((a, b) => Number(b.monto) - Number(a.monto))

  const totalMonto = filas.reduce((s, f) => s + Number(f.monto), 0)

  return {
    titulo: `Ventas netas por producto (${desde} al ${hasta})`,
    columnas: [
      { key: 'producto', label: 'Producto' },
      { key: 'cantidad', label: 'Cantidad' },
      { key: 'monto', label: 'Monto (S/)' },
    ],
    filas,
    totales: { monto: totalMonto, label: `Total neto: ${formatMoney(totalMonto)}` },
  }
}

export async function fetchReporteCompras(desde: string, hasta: string): Promise<ReporteData> {
  const { data, error } = await supabase
    .from('compras')
    .select(`
      fecha, proveedor_nombre, numero_factura, total,
      compra_detalles(cantidad, costo_unitario, productos(nombre))
    `)
    .gte('fecha', desde)
    .lte('fecha', hasta)
    .order('fecha', { ascending: false })

  if (error) throw new Error(error.message)

  const filas: FilaReporte[] = []
  for (const c of data ?? []) {
    const productos = (c.compra_detalles ?? [])
      .map((d) => `${(d.productos as unknown as { nombre: string } | null)?.nombre ?? '?'} x${d.cantidad}`)
      .join(', ')
    filas.push({
      fecha: c.fecha as string,
      proveedor: (c.proveedor_nombre as string) ?? '—',
      factura: (c.numero_factura as string) ?? '—',
      productos,
      total: Number(c.total),
    })
  }

  const suma = filas.reduce((s, f) => s + Number(f.total), 0)

  return {
    titulo: `Compras del ${desde} al ${hasta}`,
    columnas: [
      { key: 'fecha', label: 'Fecha' },
      { key: 'proveedor', label: 'Proveedor' },
      { key: 'factura', label: 'Factura' },
      { key: 'productos', label: 'Productos' },
      { key: 'total', label: 'Total (S/)' },
    ],
    filas,
    totales: { total: suma, label: `${filas.length} compras · Total: ${formatMoney(suma)}` },
  }
}

export async function fetchReporteInventario(): Promise<ReporteData> {
  const { data, error } = await supabase
    .from('productos')
    .select('nombre, stock, costo, precio_venta, unidad, activo, categorias(nombre)')
    .order('nombre')

  if (error) throw new Error(error.message)

  const filas: FilaReporte[] = (data ?? []).map((p) => {
    const stock = Number(p.stock)
    const costo = Number(p.costo)
    const pv = Number(p.precio_venta)
    return {
      producto: p.nombre as string,
      categoria: (p.categorias as unknown as { nombre: string } | null)?.nombre ?? '—',
      stock,
      unidad: p.unidad as string,
      costo,
      precio_venta: pv,
      valor_costo: Math.round(stock * costo * 100) / 100,
      valor_venta: Math.round(stock * pv * 100) / 100,
      estado: p.activo ? 'Activo' : 'Inactivo',
    }
  })

  const valorCosto = filas.reduce((s, f) => s + Number(f.valor_costo), 0)
  const valorVenta = filas.reduce((s, f) => s + Number(f.valor_venta), 0)

  return {
    titulo: 'Inventario valorizado',
    columnas: [
      { key: 'producto', label: 'Producto' },
      { key: 'categoria', label: 'Categoría' },
      { key: 'stock', label: 'Stock' },
      { key: 'unidad', label: 'Unidad' },
      { key: 'costo', label: 'Costo (S/)' },
      { key: 'precio_venta', label: 'P. Venta (S/)' },
      { key: 'valor_costo', label: 'Valor costo (S/)' },
      { key: 'valor_venta', label: 'Valor venta (S/)' },
      { key: 'estado', label: 'Estado' },
    ],
    filas,
    totales: {
      valor_costo: Math.round(valorCosto * 100) / 100,
      valor_venta: Math.round(valorVenta * 100) / 100,
      label: `Valor costo: ${formatMoney(valorCosto)} · Valor venta: ${formatMoney(valorVenta)}`,
    },
  }
}

export async function fetchReporteVencimientos(): Promise<ReporteData> {
  const { data, error } = await supabase
    .from('productos')
    .select('nombre, stock, costo, fecha_vencimiento, activo')
    .not('fecha_vencimiento', 'is', null)
    .eq('activo', true)
    .order('fecha_vencimiento')

  if (error) throw new Error(error.message)

  const filas: FilaReporte[] = (data ?? []).map((p) => {
    const dias = diasHastaVencimiento(p.fecha_vencimiento as string)
    const vencido = productoVencido(p.fecha_vencimiento as string)
    const stock = Number(p.stock)
    const costo = Number(p.costo)
    return {
      producto: p.nombre as string,
      vencimiento: p.fecha_vencimiento as string,
      dias_restantes: dias ?? '—',
      stock,
      perdida_estimada: vencido ? Math.round(stock * costo * 100) / 100 : 0,
      estado: vencido ? 'Vencido' : dias !== null && dias <= 15 ? 'Por vencer' : 'OK',
    }
  })

  const perdida = filas.reduce((s, f) => s + Number(f.perdida_estimada), 0)

  return {
    titulo: 'Historial de vencimientos',
    columnas: [
      { key: 'producto', label: 'Producto' },
      { key: 'vencimiento', label: 'Vence' },
      { key: 'dias_restantes', label: 'Días' },
      { key: 'stock', label: 'Stock' },
      { key: 'perdida_estimada', label: 'Pérdida est. (S/)' },
      { key: 'estado', label: 'Estado' },
    ],
    filas,
    totales: { perdida_estimada: perdida, label: `Pérdida estimada (vencidos): ${formatMoney(perdida)}` },
  }
}

export async function fetchReporteCierres(desde: string, hasta: string): Promise<ReporteData> {
  const { data, error } = await supabase
    .from('cierres_caja')
    .select(`
      fecha, efectivo_inicial, total_efectivo, total_yape, total_gastos,
      efectivo_esperado, efectivo_declarado, diferencia,
      yape_esperado, yape_declarado, diferencia_yape,
      perfiles:cajero_id(nombre)
    `)
    .gte('fecha', desde)
    .lte('fecha', hasta)
    .order('fecha', { ascending: false })

  if (error) throw new Error(error.message)

  const filas: FilaReporte[] = (data ?? []).map((c) => ({
    fecha: c.fecha as string,
    cajero: (c.perfiles as unknown as { nombre: string } | null)?.nombre ?? '—',
    efectivo_inicial: Number(c.efectivo_inicial ?? 0),
    ventas_efectivo: Number(c.total_efectivo),
    ventas_yape: Number(c.total_yape),
    gastos: Number(c.total_gastos ?? 0),
    esperado: Number(c.efectivo_esperado ?? 0),
    declarado: Number(c.efectivo_declarado),
    diferencia: Number(c.diferencia),
    yape_esperado: Number(c.yape_esperado ?? 0),
    yape_contado: Number(c.yape_declarado ?? 0),
    dif_yape: Number(c.diferencia_yape ?? 0),
  }))

  return {
    titulo: `Cierres de caja (${desde} al ${hasta})`,
    columnas: [
      { key: 'fecha', label: 'Fecha' },
      { key: 'cajero', label: 'Cajero' },
      { key: 'efectivo_inicial', label: 'Apertura (S/)' },
      { key: 'ventas_efectivo', label: 'V. Efectivo (S/)' },
      { key: 'ventas_yape', label: 'V. Yape (S/)' },
      { key: 'gastos', label: 'Gastos (S/)' },
      { key: 'esperado', label: 'Efectivo esp. (S/)' },
      { key: 'declarado', label: 'Efectivo cont. (S/)' },
      { key: 'diferencia', label: 'Dif. efectivo (S/)' },
      { key: 'yape_esperado', label: 'Yape esp. (S/)' },
      { key: 'yape_contado', label: 'Yape cont. (S/)' },
      { key: 'dif_yape', label: 'Dif. Yape (S/)' },
    ],
    filas,
    totales: { label: `${filas.length} cierres registrados` },
  }
}

export async function cargarReporte(
  tipo: TipoReporte,
  desde: string,
  hasta: string,
): Promise<ReporteData> {
  switch (tipo) {
    case 'ventas':
      return fetchReporteVentas(desde, hasta)
    case 'compras':
      return fetchReporteCompras(desde, hasta)
    case 'inventario':
      return fetchReporteInventario()
    case 'vencimientos':
      return fetchReporteVencimientos()
    case 'cierres':
      return fetchReporteCierres(desde, hasta)
    default:
      throw new Error('Reporte no válido')
  }
}

export const REPORTES_DISPONIBLES = [
  { id: 'ventas' as TipoReporte, label: 'Ventas por período', requiereFechas: true },
  { id: 'compras' as TipoReporte, label: 'Compras por proveedor', requiereFechas: true },
  { id: 'inventario' as TipoReporte, label: 'Inventario valorizado', requiereFechas: false },
  { id: 'vencimientos' as TipoReporte, label: 'Vencimientos y mermas', requiereFechas: false },
  { id: 'cierres' as TipoReporte, label: 'Cierres de caja', requiereFechas: true },
]
