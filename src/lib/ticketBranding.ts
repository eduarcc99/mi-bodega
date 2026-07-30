import { TIENDA_CONFIG } from '@/tienda/config'
import { TIENDA_BASE } from '@/tienda/routes'

export interface TicketEntregaInfo {
  cobrarAlEntregar: boolean
}

/** URL pública de la tienda MARGHOT (para QR en boleta) */
export function urlTiendaMarghot(): string {
  if (typeof window !== 'undefined') {
    return `${window.location.origin}${TIENDA_BASE}`
  }
  return TIENDA_BASE
}

/** Teléfono formateado para mostrar en boleta */
export function telefonoBodegaDisplay(): string {
  const n = TIENDA_CONFIG.whatsapp
  if (n.startsWith('51') && n.length >= 11) {
    return `+51 ${n.slice(2, 5)} ${n.slice(5, 8)} ${n.slice(8)}`
  }
  return n
}

export function enlaceWhatsAppBodega(): string {
  return `https://wa.me/${TIENDA_CONFIG.whatsapp}`
}
