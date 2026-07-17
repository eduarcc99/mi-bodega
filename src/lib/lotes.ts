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

export async function fetchStockVendible(productoId: string): Promise<number> {
  const { data, error } = await supabase
    .from('producto_lotes')
    .select('cantidad, fecha_vencimiento')
    .eq('producto_id', productoId)
    .gt('cantidad', 0)

  if (error) throw new Error(error.message)

  let total = 0
  for (const l of data ?? []) {
    const fv = l.fecha_vencimiento as string | null
    if (!fv || fv >= todayLocalISO()) total += Number(l.cantidad)
  }
  return Math.round(total * 1000) / 1000
}
