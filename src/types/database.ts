export type UserRole = 'duena' | 'admin' | 'cajero'
export type UnidadMedida = 'unidad' | 'kg' | 'litro' | 'paquete'
export type MetodoPago = 'efectivo' | 'yape' | 'otro'
export type VentaEstado = 'completada' | 'anulada'

export interface Perfil {
  id: string
  nombre: string
  rol: UserRole
  activo: boolean
  puede_backdate: boolean
  created_at: string
}

export interface Categoria {
  id: string
  nombre: string
  margen_default: number
  created_at: string
}

export interface Producto {
  id: string
  codigo_barra: string | null
  nombre: string
  categoria_id: string | null
  unidad: UnidadMedida
  stock: number
  stock_minimo: number
  costo: number
  precio_venta: number
  margen_pct: number | null
  fecha_vencimiento: string | null
  activo: boolean
  imagen_url: string | null
  cantidad_mayor: number | null
  precio_mayor: number | null
  permite_venta_unidad: boolean
  precio_por_unidad: number | null
  peso_estimado_unidad: number | null
  created_at: string
  updated_at: string
  categorias?: Categoria
}

export interface Configuracion {
  id: number
  margen_default: number
  dias_alerta_vencimiento: number
  descuento_vencimiento_pct: number
  moneda: string
}

export interface Venta {
  id: string
  cliente_id: string | null
  cajero_id: string
  fecha: string
  total: number
  metodo_pago: MetodoPago
  estado: VentaEstado
  es_generica: boolean
  notas: string | null
  created_at: string
}

export interface CierreCaja {
  id: string
  cajero_id: string
  fecha: string
  fecha_hora: string
  total_efectivo: number
  total_yape: number
  total_otros: number
  total_ventas: number
  efectivo_declarado: number
  diferencia: number
  yape_esperado: number
  yape_declarado: number
  diferencia_yape: number
  notas: string | null
}

export interface ProductoForm {
  codigo_barra: string
  nombre: string
  categoria_id: string
  unidad: UnidadMedida
  stock: string
  stock_minimo: string
  costo: string
  margen_pct: string
  precio_venta: string
  fecha_vencimiento: string
  activo: boolean
  imagen_url: string
  cantidad_mayor: string
  precio_mayor: string
  permite_venta_unidad: boolean
  precio_por_unidad: string
  peso_estimado_unidad: string
}
