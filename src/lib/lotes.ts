import { supabase } from '@/lib/supabase'
import { diasHastaVencimiento, productoVencido, todayLocalISO } from '@/lib/utils'

export interface ProductoLote {
  id: string
  producto_id: string
  cantidad: number
  fecha_vencimiento: string | null
  notas: string | null
  created_at: string
  productos: {
    id: string
    nombre: string
    unidad: string
    codigo_barra: string | null
    costo: number
  } | null
}

export interface LotePorProducto {
  producto_id: string
  nombre: string
  unidad: string
  lotes: {
    id: string
    cantidad: number
    fecha_vencimiento: string | null
    dias: number | null
    vencido: boolean
    poner_al_frente: boolean
  }[]
  total: number
}

export async function fetchLotesActivos(): Promise<ProductoLote[]> {
  const { data, error } = await supabase
    .from('producto_lotes')
    .select(`
      id, producto_id, cantidad, fecha_vencimiento, notas, created_at,
      productos(id, nombre, unidad, codigo_barra, costo)
    `)
    .gt('cantidad', 0)
    .order('fecha_vencimiento', { ascending: true, nullsFirst: false })

  if (error) throw new Error(error.message)
  return (data as unknown as ProductoLote[]) ?? []
}

export function agruparLotesPorProducto(lotes: ProductoLote[]): LotePorProducto[] {
  const map = new Map<string, LotePorProducto>()

  for (const l of lotes) {
    const p = l.productos
    if (!p) continue

    let grupo = map.get(l.producto_id)
    if (!grupo) {
      grupo = {
        producto_id: l.producto_id,
        nombre: p.nombre,
        unidad: p.unidad,
        lotes: [],
        total: 0,
      }
      map.set(l.producto_id, grupo)
    }

    const vencido = l.fecha_vencimiento ? productoVencido(l.fecha_vencimiento) : false
    const dias = l.fecha_vencimiento ? diasHastaVencimiento(l.fecha_vencimiento) : null

    grupo.lotes.push({
      id: l.id,
      cantidad: Number(l.cantidad),
      fecha_vencimiento: l.fecha_vencimiento,
      dias,
      vencido,
      poner_al_frente: false,
    })
    grupo.total += Number(l.cantidad)
  }

  const grupos = [...map.values()]

  for (const g of grupos) {
    g.lotes.sort((a, b) => {
      if (a.vencido !== b.vencido) return a.vencido ? 1 : -1
      if (a.fecha_vencimiento == null && b.fecha_vencimiento == null) return 0
      if (a.fecha_vencimiento == null) return 1
      if (b.fecha_vencimiento == null) return -1
      return a.fecha_vencimiento.localeCompare(b.fecha_vencimiento)
    })

    const primeroVigente = g.lotes.find((l) => !l.vencido && l.fecha_vencimiento)
    if (primeroVigente) primeroVigente.poner_al_frente = true
    else if (g.lotes[0]) g.lotes[0].poner_al_frente = true
  }

  return grupos.sort((a, b) => a.nombre.localeCompare(b.nombre))
}

export async function fetchLotesPorVencer(diasMax = 15): Promise<LotePorProducto[]> {
  const lotes = await fetchLotesActivos()

  const filtrados = lotes.filter((l) => {
    if (!l.fecha_vencimiento) return false
    if (productoVencido(l.fecha_vencimiento)) return true
    const dias = diasHastaVencimiento(l.fecha_vencimiento)
    return dias !== null && dias <= diasMax
  })

  return agruparLotesPorProducto(filtrados.length > 0 ? filtrados : lotes.filter((l) => l.fecha_vencimiento))
}

export function computeStockVendibleFEFO(
  lotes: { cantidad: number; fecha_vencimiento: string | null }[],
): number {
  const today = todayLocalISO()
  const activos = lotes.filter((l) => Number(l.cantidad) > 0)
  const hayVigente = activos.some((l) => {
    const fv = l.fecha_vencimiento
    return !fv || fv >= today
  })

  const total = activos.reduce((sum, l) => {
    const fv = l.fecha_vencimiento
    const vigente = !fv || fv >= today
    if (hayVigente ? vigente : true) return sum + Number(l.cantidad)
    return sum
  }, 0)

  return Math.round(total * 1000) / 1000
}

export async function fetchStockVendible(productoId: string): Promise<number> {
  const { data, error } = await supabase
    .from('producto_lotes')
    .select('cantidad, fecha_vencimiento')
    .eq('producto_id', productoId)
    .gt('cantidad', 0)

  if (error) throw new Error(error.message)
  return computeStockVendibleFEFO(data ?? [])
}

/** Crea lote si el producto tiene stock en catálogo pero sin filas en producto_lotes. */
export async function ensureLotesFromProducto(productoId: string): Promise<boolean> {
  const { data: prod, error: prodErr } = await supabase
    .from('productos')
    .select('stock, fecha_vencimiento')
    .eq('id', productoId)
    .single()

  if (prodErr || !prod) return false

  const stock = Number(prod.stock)
  if (stock <= 0) return false

  const { data: lotes, error: lotesErr } = await supabase
    .from('producto_lotes')
    .select('cantidad')
    .eq('producto_id', productoId)

  if (lotesErr) throw new Error(lotesErr.message)

  const sumLotes = (lotes ?? []).reduce((s, l) => s + Number(l.cantidad), 0)
  if (sumLotes > 0) return false

  const { error: insErr } = await supabase.from('producto_lotes').insert({
    producto_id: productoId,
    cantidad: stock,
    fecha_vencimiento: prod.fecha_vencimiento,
    notas: 'Stock inicial',
  })

  if (insErr) throw new Error(insErr.message)
  return true
}

/** Alinea lotes cuando se edita stock manualmente en Productos. */
export async function fijarStockManual(productoId: string): Promise<void> {
  const { data: prod, error: prodErr } = await supabase
    .from('productos')
    .select('stock, fecha_vencimiento')
    .eq('id', productoId)
    .single()

  if (prodErr || !prod) throw new Error(prodErr?.message ?? 'Producto no encontrado')

  const stock = Number(prod.stock)
  const { data: lotes, error: lotesErr } = await supabase
    .from('producto_lotes')
    .select('id, cantidad, notas, compra_detalle_id')
    .eq('producto_id', productoId)

  if (lotesErr) throw new Error(lotesErr.message)

  const sumLotes = (lotes ?? []).reduce((s, l) => s + Number(l.cantidad), 0)
  if (Math.abs(sumLotes - stock) < 0.001) return

  if (sumLotes <= 0 && stock > 0) {
    const { error: insErr } = await supabase.from('producto_lotes').insert({
      producto_id: productoId,
      cantidad: stock,
      fecha_vencimiento: prod.fecha_vencimiento,
      notas: 'Stock inicial',
    })
    if (insErr) throw new Error(insErr.message)
    return
  }

  const delta = Math.round((stock - sumLotes) * 1000) / 1000
  if (delta === 0) return

  const manualLote = (lotes ?? []).find(
    (l) => l.notas === 'Stock inicial' && !l.compra_detalle_id,
  )

  if (manualLote) {
    const nuevaCantidad = Math.round((Number(manualLote.cantidad) + delta) * 1000) / 1000
    if (nuevaCantidad < 0) {
      throw new Error('No hay suficiente stock en lotes para reducir la cantidad indicada')
    }
    const { error: updErr } = await supabase
      .from('producto_lotes')
      .update({ cantidad: nuevaCantidad })
      .eq('id', manualLote.id)
    if (updErr) throw new Error(updErr.message)
    return
  }

  if (delta > 0) {
    const { error: insErr } = await supabase.from('producto_lotes').insert({
      producto_id: productoId,
      cantidad: delta,
      fecha_vencimiento: prod.fecha_vencimiento,
      notas: 'Ajuste stock manual',
    })
    if (insErr) throw new Error(insErr.message)
  }
}
