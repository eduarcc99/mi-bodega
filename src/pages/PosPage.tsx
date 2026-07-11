import { useState, useRef, useEffect, useCallback } from 'react'
import {
  ShoppingCart,
  ScanBarcode,
  Trash2,
  Plus,
  Minus,
  PackagePlus,
  Loader2,
  AlertCircle,
  Calendar,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import {
  type CartItem,
  type VentaCompletada,
  cartTotal,
  cartItemSubtotal,
  productoFromCart,
  genericCartItem,
  mergeCartItems,
  updateCartItemQuantity,
} from '@/lib/pos'
import { buscarProductos, completarVenta, validateProductoParaVenta } from '@/lib/ventas'
import { formatMoney } from '@/lib/utils'
import type { MetodoPago, Producto } from '@/types/database'
import { VentaTicket } from '@/components/pos/VentaTicket'

export function PosPage() {
  const { perfil, isAdmin } = useAuth()
  const inputRef = useRef<HTMLInputElement>(null)

  const [busqueda, setBusqueda] = useState('')
  const [resultados, setResultados] = useState<Producto[]>([])
  const [cart, setCart] = useState<CartItem[]>([])
  const [error, setError] = useState('')
  const [avisoBusqueda, setAvisoBusqueda] = useState('')
  const [processing, setProcessing] = useState(false)
  const [ventaCompletada, setVentaCompletada] = useState<VentaCompletada | null>(null)
  const [flashAgregado, setFlashAgregado] = useState('')

  const [showGeneric, setShowGeneric] = useState(false)
  const [genericNombre, setGenericNombre] = useState('')
  const [genericPrecio, setGenericPrecio] = useState('')

  const [backdate, setBackdate] = useState('')
  const puedeBackdate = isAdmin || perfil?.puede_backdate

  const total = cartTotal(cart)

  const focusSearch = useCallback(() => {
    setTimeout(() => inputRef.current?.focus(), 100)
  }, [])

  useEffect(() => {
    focusSearch()
  }, [focusSearch])

  useEffect(() => {
    if (!flashAgregado) return
    const t = setTimeout(() => setFlashAgregado(''), 1200)
    return () => clearTimeout(t)
  }, [flashAgregado])

  function mostrarAgregado(nombre: string) {
    setFlashAgregado(nombre)
  }

  async function handleSearch(query?: string) {
    const q = (query ?? busqueda).trim()
    if (!q) return
    setError('')
    setAvisoBusqueda('')

    const productos = await buscarProductos(q)

    const exactos = productos.filter((p) => p.nombre.toLowerCase() === q.toLowerCase())
    const unico = exactos.length === 1 ? exactos[0] : productos.length === 1 ? productos[0] : null

    if (unico) {
      addProducto(unico)
      setBusqueda('')
      setResultados([])
      return
    }

    if (productos.length > 0) {
      setResultados(productos)
      return
    }

    setResultados([])
    setAvisoBusqueda(
      `No encontramos productos con "${q}". Revisa el nombre o usa el botón Venta genérica si no está en el catálogo.`,
    )
  }

  function addProducto(producto: Producto) {
    const validationError = validateProductoParaVenta(producto)
    if (validationError) {
      setError(validationError)
      return
    }

    const existing = cart.find((i) => i.producto_id === producto.id)
    if (existing && existing.cantidad + 1 > producto.stock) {
      setError(`Stock insuficiente. Quedan ${producto.stock} ${producto.unidad}`)
      return
    }

    const item = productoFromCart(producto, 1)
    setCart((prev) => mergeCartItems(prev, item))
    setError('')
    mostrarAgregado(producto.nombre)
    focusSearch()
  }

  function addGeneric() {
    const precio = parseFloat(genericPrecio)
    if (!genericNombre.trim() || isNaN(precio) || precio <= 0) {
      setError('Ingresa nombre y precio válido')
      return
    }
    const nombre = genericNombre.trim()
    setCart((prev) => [genericCartItem(nombre, precio), ...prev])
    mostrarAgregado(nombre)
    setShowGeneric(false)
    setGenericNombre('')
    setGenericPrecio('')
    setBusqueda('')
    focusSearch()
  }

  function updateQuantity(key: string, delta: number) {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.key !== key) return item
          const nuevaCant = Math.max(0.001, item.cantidad + delta)
          if (item.stock_disponible != null && nuevaCant > item.stock_disponible) {
            setError(`Stock máximo: ${item.stock_disponible}`)
            return item
          }
          return updateCartItemQuantity(item, nuevaCant)
        })
        .filter((item) => item.cantidad > 0),
    )
    setError('')
  }

  function updatePrecio(key: string, precio: number) {
    setCart((prev) =>
      prev.map((item) =>
        item.key === key
          ? {
              ...item,
              precio_unitario: precio,
              descuento: Math.max(0, item.precio_original - precio) * item.cantidad,
            }
          : item,
      ),
    )
  }

  function removeItem(key: string) {
    setCart((prev) => prev.filter((i) => i.key !== key))
  }

  async function handlePago(metodo: MetodoPago) {
    if (!perfil || cart.length === 0) return
    setProcessing(true)
    setError('')

    try {
      const venta = await completarVenta({
        items: cart,
        metodo_pago: metodo,
        cajero_id: perfil.id,
        fecha: backdate ? new Date(backdate).toISOString() : undefined,
      })

      setVentaCompletada({
        id: venta.id,
        total: venta.total,
        metodo_pago: metodo,
        fecha: venta.fecha,
        items: [...cart],
      })
      setCart([])
      setBusqueda('')
      setResultados([])
      setBackdate('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al procesar la venta')
    } finally {
      setProcessing(false)
      focusSearch()
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Punto de venta</h1>
          <p className="text-slate-500">Escanea o busca productos · Cajero: {perfil?.nombre}</p>
        </div>
        {puedeBackdate && (
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-slate-400" />
            <input
              type="datetime-local"
              value={backdate}
              onChange={(e) => setBackdate(e.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-500"
              title="Fecha/hora pasada (para ventas del día en papel)"
            />
          </div>
        )}
      </div>

      <div className="relative">
        <ScanBarcode className="absolute left-4 top-1/2 h-6 w-6 -translate-y-1/2 text-teal-600" />
        <input
          ref={inputRef}
          type="search"
          value={busqueda}
          onChange={(e) => {
            setBusqueda(e.target.value)
            setResultados([])
            setAvisoBusqueda('')
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              handleSearch()
            }
          }}
          placeholder="Código de barras o nombre del producto…"
          className="w-full rounded-xl border-2 border-teal-200 bg-white py-4 pl-14 pr-4 text-lg outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10"
        />
      </div>

      {avisoBusqueda && (
        <div className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {avisoBusqueda}
        </div>
      )}

      {flashAgregado && (
        <div className="rounded-lg bg-emerald-500 px-4 py-2.5 text-center text-sm font-semibold text-white shadow-md animate-pulse">
          ✓ {flashAgregado} agregado
        </div>
      )}

      {resultados.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
          {resultados.map((p) => (
            <button
              key={p.id}
              onClick={() => {
                addProducto(p)
                setResultados([])
                setBusqueda('')
              }}
              className="flex w-full items-center justify-between border-b border-slate-100 px-4 py-3 text-left last:border-0 hover:bg-teal-50"
            >
              <div>
                <p className="font-medium text-slate-900">{p.nombre}</p>
                <p className="text-xs text-slate-500">
                  Stock: {p.stock} {p.unidad}
                  {p.codigo_barra && ` · ${p.codigo_barra}`}
                </p>
              </div>
              <p className="font-semibold text-teal-700">{formatMoney(p.precio_venta)}</p>
            </button>
          ))}
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <h2 className="flex items-center gap-2 font-semibold text-slate-900">
              <ShoppingCart className="h-5 w-5" />
              Carrito ({cart.length})
            </h2>
            <button
              onClick={() => {
              setGenericNombre('')
              setGenericPrecio('')
              setShowGeneric(true)
            }}
              className="flex items-center gap-1 text-sm text-teal-600 hover:text-teal-700"
            >
              <PackagePlus className="h-4 w-4" />
              Venta genérica
            </button>
          </div>

          {cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400">
              <ShoppingCart className="mb-3 h-12 w-12" />
              <p>El carrito está vacío</p>
              <p className="text-sm">Escanea un producto o presiona Enter para buscar</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {cart.map((item) => (
                <div key={item.key} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center">
                  <div className="flex-1">
                    <p className="font-medium text-slate-900">
                      {item.nombre}
                      {item.es_generica && (
                        <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-700">
                          Genérico
                        </span>
                      )}
                      {item.precio_mayor != null &&
                        item.cantidad_mayor != null &&
                        item.cantidad >= item.cantidad_mayor && (
                          <span className="ml-2 rounded bg-blue-100 px-1.5 py-0.5 text-xs text-blue-700">
                            Al mayor
                          </span>
                        )}
                    </p>
                    <p className="text-xs text-slate-500">
                      Original: {formatMoney(item.precio_original)}
                      {item.descuento > 0 && ` · Descuento: ${formatMoney(item.descuento)}`}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => updateQuantity(item.key, -1)}
                      className="rounded-lg border border-slate-200 p-1.5 hover:bg-slate-50"
                    >
                      <Minus className="h-4 w-4" />
                    </button>
                    <span className="w-12 text-center font-medium">{item.cantidad}</span>
                    <button
                      onClick={() => updateQuantity(item.key, 1)}
                      className="rounded-lg border border-slate-200 p-1.5 hover:bg-slate-50"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>

                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={item.precio_unitario}
                    onChange={(e) => updatePrecio(item.key, parseFloat(e.target.value) || 0)}
                    className="w-24 rounded-lg border border-slate-200 px-2 py-1.5 text-right text-sm"
                    title="Precio unitario"
                  />

                  <p className="w-20 text-right font-semibold text-slate-900">
                    {formatMoney(cartItemSubtotal(item))}
                  </p>

                  <button
                    onClick={() => removeItem(item.key)}
                    className="rounded-lg p-1.5 text-red-400 hover:bg-red-50 hover:text-red-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-1 font-semibold text-slate-900">Total a pagar</h2>
          <p className="text-3xl font-bold text-slate-900">{formatMoney(total)}</p>

          <div className="mt-6 space-y-2">
            <button
              onClick={() => handlePago('efectivo')}
              disabled={cart.length === 0 || processing}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-teal-600 py-3.5 font-semibold text-white hover:bg-teal-700 disabled:opacity-50"
            >
              {processing ? <Loader2 className="h-5 w-5 animate-spin" /> : null}
              Efectivo
            </button>
            <button
              onClick={() => handlePago('yape')}
              disabled={cart.length === 0 || processing}
              className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-purple-300 bg-purple-50 py-3.5 font-semibold text-purple-700 hover:bg-purple-100 disabled:opacity-50"
            >
              Yape
            </button>
            <button
              onClick={() => handlePago('otro')}
              disabled={cart.length === 0 || processing}
              className="w-full rounded-lg border border-slate-200 py-3 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
            >
              Otro método
            </button>
          </div>
        </div>
      </div>

      {showGeneric && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="mb-4 font-bold text-slate-900">Venta genérica</h3>
            <p className="mb-4 text-sm text-slate-500">
              Producto no registrado — ingresa nombre y precio manualmente.
            </p>
            <div className="space-y-3">
              <input
                value={genericNombre}
                onChange={(e) => setGenericNombre(e.target.value)}
                placeholder="Nombre del producto"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-teal-500"
                autoFocus
              />
              <input
                type="number"
                step="0.01"
                min="0"
                value={genericPrecio}
                onChange={(e) => setGenericPrecio(e.target.value)}
                placeholder="Precio (S/)"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-teal-500"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => setShowGeneric(false)}
                  className="flex-1 rounded-lg border border-slate-200 py-2.5 text-slate-600"
                >
                  Cancelar
                </button>
                <button
                  onClick={addGeneric}
                  className="flex-1 rounded-lg bg-teal-600 py-2.5 font-semibold text-white"
                >
                  Agregar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {ventaCompletada && perfil && (
        <VentaTicket
          venta={ventaCompletada}
          cajeroNombre={perfil.nombre}
          onClose={() => {
            setVentaCompletada(null)
            focusSearch()
          }}
        />
      )}
    </div>
  )
}
