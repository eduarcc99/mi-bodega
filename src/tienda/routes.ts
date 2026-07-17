/** Ruta pública de la tienda delivery (compartir solo este link) */
export const TIENDA_BASE = '/marghot'

export function tiendaPath(subpath = ''): string {
  if (!subpath) return TIENDA_BASE
  return `${TIENDA_BASE}/${subpath.replace(/^\//, '')}`
}
