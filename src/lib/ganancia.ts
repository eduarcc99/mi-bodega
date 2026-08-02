/** Ganancia de una línea de venta; genéricas sin costo no inflan reportes. */
export function gananciaContableDetalle(d: {
  producto_id: string | null
  cantidad: number
  precio_unitario: number
  descuento: number
  costo_unitario: number
}): number {
  const cantidad = Number(d.cantidad)
  const precio = Number(d.precio_unitario)
  const descuento = Number(d.descuento)
  const costo = Number(d.costo_unitario)

  if (!d.producto_id && costo <= 0) return 0

  return precio * cantidad - descuento - costo * cantidad
}

export function esGenericaSinCosto(productoId: string | null, costoUnitario: number): boolean {
  return !productoId && Number(costoUnitario) <= 0
}
