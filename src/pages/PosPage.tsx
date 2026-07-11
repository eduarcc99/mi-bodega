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
  Scale,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import {
  type CartItem,
  type ModoVenta,
  type VentaCompletada,
  cartTotal,
  cartItemSubtotal,
  productoFromCart,
  genericCartItem,
  mergeCartItems,
  updateCartItemQuantity,
  esVentaPorPeso,
  permiteVentaUnidadSuelta,
  stockNecesario,
  etiquetaCantidadItem,
} from '@/lib/pos'
import { buscarProductos, completarVenta, validateProductoParaVenta } from '@/lib/ventas'
import { formatMoney } from '@/lib/utils'
import type { MetodoPago, Producto } from '@/types/database'
import { VentaTicket } from '@/components/pos/VentaTicket'

interface ModalAgregar {
  producto: Producto
  modo: ModoVenta
  cantidad: string
}

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

  const [modalAgregar, setModalAgregar] = useState<ModalAgregar | null>(null)

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

  function requiereModal(producto: Producto): boolean {
    return esVentaPorPeso(producto)
  }

  function abrirModalAgregar(producto: Producto) {
    const modo: ModoVenta = esVentaPorPeso(producto) ? 'peso' : 'normal'
    setModalAgregar({ producto, modo, cantidad: modo === 'peso' ? '0.5' : '1' })
  }

  function stockEnCarrito(productoId: string, modo: ModoVenta): number {
    return cart
      .filter((i) => i.producto_id === productoId && i.modo_venta === modo)
      .reduce((s, i) => s + stockNecesario(i), 0)
  }

  function confirmarAgregarModal() {
    if (!modalAgregar) return
    const { producto, modo, cantidad: cantStr } = modalAgregar
    const cantidad = parseFloat(cantStr)
    if (isNaN(cantidad) || cantidad <= 0) {
      setError('Ingresa una cantidad válida')
      return
    }

    const itemPreview = productoFromCart(producto, cantidad, modo)
    const stockReq = stockNecesario(itemPreview)
    const stockUsado = stockEnCarrito(producto.id, modo)

    const validationError = validateProductoParaVenta(producto, stockReq + stockUsado)
    if (validationError) {
      setError(validationError)
      return
    }

    if (stockUsado + stockReq > producto.stock) {
      setError(`Stock insuficiente. Quedan ${producto.stock} ${producto.unidad}`)
      return
    }

    setCart((prev) => mergeCartItems(prev, itemPreview))
    setError('')
    mostrarAgregado(producto.nombre)
    setModalAgregar(null)
    setResultados([])
    setBusqueda('')
    focusSearch()
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
      if (requiereModal(unico)) {
        abrirModalAgregar(unico)
      } else {
        addProductoDirecto(unico)
      }
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

  function addProductoDirecto(producto: Producto) {
    const validationError = validateProductoParaVenta(producto)
    if (validationError) {
      setError(validationError)
      return
    }

    const existing = cart.find((i) => i.producto_id === producto.id && i.modo_venta === 'normal')
    const stockUsado = existing ? stockNecesario(existing) : 0
    if (stockUsado + 1 > producto.stock) {
      setError(`Stock insuficiente. Quedan ${producto.stock} ${producto.unidad}`)
      return
    }

    const item = productoFromCart(producto, 1)
    setCart((prev) => mergeCartItems(prev, item))
    setError('')
    mostrarAgregado(producto.nombre)
    focusSearch()
  }

  function seleccionarProducto(producto: Producto) {
    if (requiereModal(producto)) {
      abrirModalAgregar(producto)
    } else {
      addProductoDirecto(producto)
    }
    setResultados([])
    setBusqueda('')
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

  function deltaCantidad(item: CartItem): number {
    if (item.modo_venta === 'peso') return 0.1
    return 1
  }

  function updateQuantity(key: string, delta: number) {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.key !== key) return item
          const step = deltaCantidad(item)
          const nuevaCant = Math.round(Math.max(0.001, item.cantidad + delta * step) * 1000) / 1000
          const preview = updateCartItemQuantity(item, nuevaCant)
          if (item.stock_disponible != null && stockNecesario(preview) > item.stock_disponible) {
            setError(`Stock máximo: ${item.stock_disponible} ${item.unidad}`)
            return item
          }
          return preview
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

  const productoModal = modalAgregar?.producto
  const mixtaModal = productoModal ? permiteVentaUnidadSuelta(productoModal) : false

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
              onClick={() => seleccionarProducto(p)}
              className="flex w-full items-center justify-between border-b border-slate-100 px-4 py-3 text-left last:border-0 hover:bg-teal-50"
            >
              <div>
                <p className="font-medium text-slate-900">{p.nombre}</p>
                <p className="text-xs text-slate-500">
                  Stock: {p.stock} {p.unidad}
                  {p.codigo_barra && ` · ${p.codigo_barra}`}
                  {permiteVentaUnidadSuelta(p) && ' · venta mixta'}
                </p>
              </div>
              <p className="font-semibold text-teal-700">
                {formatMoney(p.precio_venta)}
                {p.unidad === 'kg' && <span className="text-xs font-normal">/kg</span>}
              </p>
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
                      {item.modo_venta === 'unidad_suelta' && (
                        <span className="ml-2 rounded bg-teal-100 px-1.5 py-0.5 text-xs text-teal-700">
                          Por unidad
                        </span>
                      )}
                      {item.modo_venta === 'peso' && (
                        <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600">
                          Por peso
                        </span>
                      )}
                      {item.precio_mayor != null &&
                        item.cantidad_mayor != null &&
                        item.cantidad >= item.cantidad_mayor &&
                        item.modo_venta === 'normal' && (
                          <span className="ml-2 rounded bg-blue-100 px-1.5 py-0.5 text-xs text-blue-700">
                            Al mayor
                          </span>
                        )}
                    </p>
                    <p className="text-xs text-slate-500">
                      {etiquetaCantidadItem(item)} × {formatMoney(item.precio_unitario)}
                      {item.descuento > 0 && ` · Desc: ${formatMoney(item.descuento)}`}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => updateQuantity(item.key, -1)}
                      className="rounded-lg border border-slate-200 p-1.5 hover:bg-slate-50"
                    >
                      <Minus className="h-4 w-4" />
                    </button>
                    <span className="w-14 text-center text-sm font-medium">
                      {item.modo_venta === 'peso' ? item.cantidad.toFixed(2) : item.cantidad}
                    </span>
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

      {modalAgregar && productoModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center gap-2">
              <Scale className="h-5 w-5 text-teal-600" />
              <h3 className="font-bold text-slate-900">{productoModal.nombre}</h3>
            </div>
            <p className="mb-4 text-sm text-slate-500">
              Stock: {productoModal.stock} {productoModal.unidad}
            </p>

            {mixtaModal && (
              <div className="mb-4 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setModalAgregar((m) =>
                      m ? { ...m, modo: 'peso', cantidad: '0.5' } : m,
                    )
                  }
                  className={`rounded-lg border py-2.5 text-sm font-medium ${
                    modalAgregar.modo === 'peso'
                      ? 'border-teal-500 bg-teal-50 text-teal-800'
                      : 'border-slate-200 text-slate-600'
                  }`}
                >
                  Por peso (kg)
                  <span className="mt-0.5 block text-xs font-normal">
                    {formatMoney(productoModal.precio_venta)}/kg
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setModalAgregar((m) =>
                      m ? { ...m, modo: 'unidad_suelta', cantidad: '1' } : m,
                    )
                  }
                  className={`rounded-lg border py-2.5 text-sm font-medium ${
                    modalAgregar.modo === 'unidad_suelta'
                      ? 'border-teal-500 bg-teal-50 text-teal-800'
                      : 'border-slate-200 text-slate-600'
                  }`}
                >
                  Por unidad
                  <span className="mt-0.5 block text-xs font-normal">
                    {formatMoney(productoModal.precio_por_unidad ?? 0)}/ud
                  </span>
                </button>
              </div>
            )}

            <label className="mb-1 block text-sm font-medium text-slate-700">
              {modalAgregar.modo === 'unidad_suelta'
                ? 'Cantidad (unidades)'
                : `Cantidad (${productoModal.unidad})`}
            </label>
            <input
              type="number"
              min="0.001"
              step={modalAgregar.modo === 'peso' ? '0.001' : '1'}
              value={modalAgregar.cantidad}
              onChange={(e) =>
                setModalAgregar((m) => (m ? { ...m, cantidad: e.target.value } : m))
              }
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  confirmarAgregarModal()
                }
              }}
              className="mb-4 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-lg outline-none focus:border-teal-500"
              autoFocus
            />

            {modalAgregar.modo === 'unidad_suelta' && productoModal.peso_estimado_unidad && (
              <p className="mb-4 text-xs text-slate-500">
                Descuenta ~{(parseFloat(modalAgregar.cantidad || '0') * productoModal.peso_estimado_unidad).toFixed(3)} kg del stock
              </p>
            )}

            <div className="flex gap-2">
              <button
                onClick={() => setModalAgregar(null)}
                className="flex-1 rounded-lg border border-slate-200 py-2.5 text-slate-600"
              >
                Cancelar
              </button>
              <button
                onClick={confirmarAgregarModal}
                className="flex-1 rounded-lg bg-teal-600 py-2.5 font-semibold text-white"
              >
                Agregar
              </button>
            </div>
          </div>
        </div>
      )}

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
