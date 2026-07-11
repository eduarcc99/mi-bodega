import { supabase } from '@/lib/supabase'
import type { Categoria } from '@/types/database'

export async function fetchCategorias(): Promise<Categoria[]> {
  const { data, error } = await supabase.from('categorias').select('*').order('nombre')
  if (error) throw new Error(error.message)
  return (data as Categoria[]) ?? []
}

export async function crearCategoria(nombre: string, margen_default: number): Promise<Categoria> {
  const { data, error } = await supabase
    .from('categorias')
    .insert({ nombre: nombre.trim(), margen_default })
    .select('*')
    .single()
  if (error) throw new Error(error.message)
  return data as Categoria
}

export async function actualizarCategoria(
  id: string,
  params: { nombre: string; margen_default: number },
): Promise<void> {
  const { error } = await supabase
    .from('categorias')
    .update({ nombre: params.nombre.trim(), margen_default: params.margen_default })
    .eq('id', id)
  if (error) throw new Error(error.message)
}

export async function eliminarCategoria(id: string): Promise<void> {
  const { error } = await supabase.from('categorias').delete().eq('id', id)
  if (error) throw new Error(error.message)
}
