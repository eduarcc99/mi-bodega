import { TIENDA_CONFIG } from '@/tienda/config'

export function isTiendaAbierta(now = new Date()): boolean {
  if (import.meta.env.VITE_TIENDA_DEV_ABIERTA === 'true') return true
  const hora = now.getHours()
  return hora >= TIENDA_CONFIG.horaApertura && hora < TIENDA_CONFIG.horaCierre
}

export function mensajeHorario(): string {
  return `Pedidos de ${TIENDA_CONFIG.horaApertura}:00 PM a ${TIENDA_CONFIG.horaCierre}:00 PM`
}

export function proximaApertura(): string {
  return `Volvemos hoy a las ${TIENDA_CONFIG.horaApertura}:00 PM`
}
