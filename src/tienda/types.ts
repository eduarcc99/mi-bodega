import type { UnidadMedida } from '@/types/database'

export interface ProductoTienda {
  id: string
  nombre: string
  categoria_id: string | null
  categoria_nombre: string | null
  unidad: UnidadMedida
  stock: number
  precio_venta: number
  imagen_url: string | null
  permite_venta_unidad: boolean
  precio_por_unidad: number | null
  peso_estimado_unidad: number | null
}

export interface CartItemTienda {
  key: string
  producto_id: string
  nombre: string
  cantidad: number
  precio_unitario: number
  unidad: UnidadMedida
  imagen_url: string | null
  modo: 'normal' | 'peso' | 'unidad_suelta'
}

export interface CheckoutForm {
  nombre: string
  telefono: string
  direccion: string
  referencia: string
  notas: string
}
