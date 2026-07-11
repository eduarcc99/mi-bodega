import { TIENDA_CONFIG } from '@/tienda/config'

export function costoDelivery(subtotal: number): number {
  return subtotal >= TIENDA_CONFIG.envioGratisDesde
    ? 0
    : TIENDA_CONFIG.deliveryPedidoPequeno
}

export function etiquetaDelivery(subtotal: number): string {
  if (subtotal >= TIENDA_CONFIG.envioGratisDesde) {
    return 'Gratis (inauguración · Barrio Prado)'
  }
  return `Pedido pequeño (+${TIENDA_CONFIG.deliveryPedidoPequeno} sol)`
}

export function faltanteEnvioGratis(subtotal: number): number {
  return Math.max(0, TIENDA_CONFIG.envioGratisDesde - subtotal)
}

export function tieneEnvioGratis(subtotal: number): boolean {
  return subtotal >= TIENDA_CONFIG.envioGratisDesde
}

export function totalConDelivery(subtotal: number): number {
  return Math.round((subtotal + costoDelivery(subtotal)) * 100) / 100
}
