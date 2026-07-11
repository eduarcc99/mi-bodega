import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { CartItemTienda, ProductoTienda } from '@/tienda/types'

const STORAGE_KEY = 'marghot-tienda-cart'

interface TiendaCartContextValue {
  items: CartItemTienda[]
  count: number
  total: number
  addItem: (producto: ProductoTienda, cantidad: number, modo: CartItemTienda['modo']) => void
  updateQty: (key: string, cantidad: number) => void
  removeItem: (key: string) => void
  clearCart: () => void
}

const TiendaCartContext = createContext<TiendaCartContextValue | null>(null)

function precioItem(
  producto: ProductoTienda,
  modo: CartItemTienda['modo'],
): number {
  if (modo === 'unidad_suelta' && producto.precio_por_unidad) {
    return producto.precio_por_unidad
  }
  return producto.precio_venta
}

function lineSubtotal(item: CartItemTienda): number {
  return Math.round(item.precio_unitario * item.cantidad * 100) / 100
}

function loadCart(): CartItemTienda[] {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as CartItemTienda[]) : []
  } catch {
    return []
  }
}

export function TiendaCartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItemTienda[]>(loadCart)

  useEffect(() => {
    if (items.length === 0) sessionStorage.removeItem(STORAGE_KEY)
    else sessionStorage.setItem(STORAGE_KEY, JSON.stringify(items))
  }, [items])

  const addItem = useCallback(
    (producto: ProductoTienda, cantidad: number, modo: CartItemTienda['modo']) => {
      const precio = precioItem(producto, modo)
      setItems((prev) => {
        const idx = prev.findIndex(
          (i) => i.producto_id === producto.id && i.modo === modo,
        )
        if (idx >= 0) {
          const next = [...prev]
          next[idx] = { ...next[idx], cantidad: next[idx].cantidad + cantidad }
          return next
        }
        const item: CartItemTienda = {
          key: `${producto.id}-${modo}-${Date.now()}`,
          producto_id: producto.id,
          nombre: producto.nombre,
          cantidad,
          precio_unitario: precio,
          unidad: producto.unidad,
          imagen_url: producto.imagen_url,
          modo,
        }
        return [item, ...prev]
      })
    },
    [],
  )

  const updateQty = useCallback((key: string, cantidad: number) => {
    setItems((prev) =>
      prev
        .map((i) => (i.key === key ? { ...i, cantidad: Math.max(0, cantidad) } : i))
        .filter((i) => i.cantidad > 0),
    )
  }, [])

  const removeItem = useCallback((key: string) => {
    setItems((prev) => prev.filter((i) => i.key !== key))
  }, [])

  const clearCart = useCallback(() => setItems([]), [])

  const total = useMemo(
    () => items.reduce((s, i) => s + lineSubtotal(i), 0),
    [items],
  )

  const count = useMemo(() => items.reduce((s, i) => s + i.cantidad, 0), [items])

  const value = useMemo(
    () => ({ items, count, total, addItem, updateQty, removeItem, clearCart }),
    [items, count, total, addItem, updateQty, removeItem, clearCart],
  )

  return <TiendaCartContext.Provider value={value}>{children}</TiendaCartContext.Provider>
}

export function useTiendaCart() {
  const ctx = useContext(TiendaCartContext)
  if (!ctx) throw new Error('useTiendaCart debe usarse dentro de TiendaCartProvider')
  return ctx
}

export { lineSubtotal }
