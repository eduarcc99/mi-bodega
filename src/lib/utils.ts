/** Precio Venta = Costo / (1 - Margen% / 100) */
export function calcularPrecioVenta(costo: number, margenPct: number): number {
  if (margenPct >= 100) return costo * 2
  if (margenPct <= 0) return costo
  return Math.round((costo / (1 - margenPct / 100)) * 100) / 100
}

export function calcularMargenReal(costo: number, precioVenta: number): number {
  if (precioVenta <= 0) return 0
  return Math.round(((precioVenta - costo) / precioVenta) * 10000) / 100
}

export function formatMoney(amount: number, moneda = 'PEN'): string {
  return new Intl.NumberFormat('es-PE', {
    style: 'currency',
    currency: moneda,
  }).format(amount)
}

export function formatDate(date: string | null): string {
  if (!date) return '—'
  return new Intl.DateTimeFormat('es-PE', { dateStyle: 'medium' }).format(new Date(date))
}

export function diasHastaVencimiento(fecha: string | null): number | null {
  if (!fecha) return null
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  const vence = new Date(fecha + 'T00:00:00')
  return Math.ceil((vence.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24))
}

export function productoVencido(fecha: string | null): boolean {
  const dias = diasHastaVencimiento(fecha)
  return dias !== null && dias < 0
}

export function productoPorVencer(fecha: string | null, diasAlerta = 15): boolean {
  const dias = diasHastaVencimiento(fecha)
  return dias !== null && dias >= 0 && dias <= diasAlerta
}

export function stockBajo(stock: number, minimo: number): boolean {
  return stock <= minimo
}

/** Fecha local YYYY-MM-DD (no UTC — evita que caja quede vacía después de las 7 PM en Perú) */
export function todayLocalISO(d = new Date()): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Inicio y fin del día calendario local en ISO para consultas Supabase */
export function localDayRangeISO(fecha: string): { desde: string; hasta: string } {
  const desde = new Date(`${fecha}T00:00:00`)
  const hasta = new Date(`${fecha}T23:59:59.999`)
  return { desde: desde.toISOString(), hasta: hasta.toISOString() }
}
