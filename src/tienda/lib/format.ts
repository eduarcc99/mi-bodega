/** Title Case para nombres de producto en la tienda */
export function formatNombreProducto(nombre: string): string {
  return nombre
    .trim()
    .split(/\s+/)
    .map((word) => {
      if (!word) return word
      if (/^\d/.test(word)) return word
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    })
    .join(' ')
}

/** Corrige typos conocidos de categorías */
export function normalizarCategoria(nombre: string | null | undefined): string {
  if (!nombre) return 'General'
  const lower = nombre.trim().toLowerCase()
  const fixes: Record<string, string> = {
    golocinas: 'Golosinas',
    golocina: 'Golosinas',
    abarrotes: 'Abarrotes',
    bebidas: 'Bebidas',
    limpieza: 'Limpieza',
  }
  return fixes[lower] ?? formatNombreProducto(nombre)
}

/** Etiqueta legible: "3 unidades × …" o "0.5 kg × …" */
export function etiquetaCantidadDetalle(cantidad: number, unidad: string, modo: string): string {
  if (modo === 'unidad_suelta') {
    return cantidad === 1 ? '1 unidad' : `${cantidad} unidades`
  }
  if (modo === 'peso') {
    return `${cantidad} ${unidad}`
  }
  if (unidad === 'unidad') {
    return cantidad === 1 ? '1 unidad' : `${cantidad} unidades`
  }
  return `${cantidad} ${unidad}`
}

/** Número limpio para el selector − N + */
export function cantidadEnSelector(cantidad: number): string {
  if (Number.isInteger(cantidad)) return String(cantidad)
  const rounded = Math.round(cantidad * 1000) / 1000
  return String(rounded)
}
