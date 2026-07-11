import { supabase } from '@/lib/supabase'
import type { ProductoTienda } from '@/tienda/types'

export async function fetchCatalogoTienda(): Promise<ProductoTienda[]> {
  const { data, error } = await supabase.rpc('get_catalogo_tienda')
  if (error) throw new Error(error.message)
  return (data ?? []).map((p: Record<string, unknown>) => ({
    id: String(p.id),
    nombre: String(p.nombre),
    categoria_id: p.categoria_id ? String(p.categoria_id) : null,
    categoria_nombre: p.categoria_nombre ? String(p.categoria_nombre) : null,
    unidad: p.unidad as ProductoTienda['unidad'],
    stock: Number(p.stock),
    precio_venta: Number(p.precio_venta),
    imagen_url: p.imagen_url ? String(p.imagen_url) : null,
    permite_venta_unidad: Boolean(p.permite_venta_unidad),
    precio_por_unidad: p.precio_por_unidad != null ? Number(p.precio_por_unidad) : null,
    peso_estimado_unidad:
      p.peso_estimado_unidad != null ? Number(p.peso_estimado_unidad) : null,
  }))
}
