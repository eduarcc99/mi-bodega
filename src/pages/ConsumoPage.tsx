import { useState, useRef, useEffect, useCallback, lazy, Suspense } from 'react'
import {
  ShoppingBasket,
  ScanBarcode,
  Camera,
  Trash2,
  Plus,
  Minus,
  Loader2,
  AlertCircle,
  Scale,
  CheckCircle2,
  Info,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { buscarProductos } from '@/lib/ventas'
import { formatMoney } from '@/lib/utils'
import type { Producto } from '@/types/database'
import {
  type CartItem,
  type ModoVenta,
  type ConsumoCompletado,
  productoToConsumoItem,
  mergeCartItems,
  updateCartItemQuantity,
  stockNecesario,
  etiquetaCantidadItem,
  itemCosto,
  itemVentaPotencial,
  totalCosto,
  totalVentaPotencial,
  oportunidadPerdida,
  validateProductoParaConsumo,
  esVentaPorPeso,
  permiteVentaUnidadSuelta,
  completarConsumo,
} from '@/lib/consumo'
import { ConsumoTicket } from '@/components/consumo/ConsumoTicket'

const CameraScannerModal = lazy(() =>
  import('@/components/pos/CameraScannerModal').then((m) => ({ default: m.CameraScannerModal })),
)

interface ModalAgregar {
  producto: Producto
  modo: ModoVenta
  cantidad: string
}

export function ConsumoPage() {
  const { perfil } = useAuth()
  const inputRef = useRef<HTMLInputElement>(null)

  const [busqueda, setBusqueda] = useState('')
  const [resultados, setResultados] = useState<Producto[]>([])
  const [cart, setCart] = useState<CartItem[]>([])
  const [error, setError] = useState('')
  const [avisoBusqueda, setAvisoBusqueda] = useState('')
  const [processing, setProcessing] = useState(false)
  const [flashAgregado, setFlashAgregado] = useState('')
  const [modalAgregar, setModalAgregar] = useState<ModalAgregar | null>(null)
  const [showCameraScanner, setShowCameraScanner] = useState(false)
  const [motivo, setMotivo] = useState('')
  const [completado, setCompletado] = useState<ConsumoCompletado | null>(null)

  const costo = totalCosto(cart)
  const potencial = totalVentaPotencial(cart)
  const oportunidad = oportunidadPerdida(cart)

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

    const itemPreview = productoToConsumoItem(producto, cantidad, modo)
    const stockReq = stockNecesario(itemPreview)
    const stockUsado = stockEnCarrito(producto.id, modo)

    const validationError = validateProductoParaConsumo(producto, stockReq + stockUsado)
    if (validationError) {
      setError(validationError)
      return
    }

    setCart((prev) => mergeCartItems(prev, itemPreview))
    setError('')
    setFlashAgregado(producto.nombre)
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
      if (requiereModal(unico)) abrirModalAgregar(unico)
      else addProductoDirecto(unico)
      setBusqueda('')
      setResultados([])
      return
    }

    if (productos.length > 0) {
      setResultados(productos)
      return
    }

    setResultados([])
    setAvisoBusqueda(`No encontramos "${q}" en el catálogo.`)
  }

  function addProductoDirecto(producto: Producto) {
    const validationError = validateProductoParaConsumo(producto)
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

    setCart((prev) => mergeCartItems(prev, productoToConsumoItem(producto, 1)))
    setError('')
    setFlashAgregado(producto.nombre)
    focusSearch()
  }

  function seleccionarProducto(producto: Producto) {
    if (requiereModal(producto)) abrirModalAgregar(producto)
    else addProductoDirecto(producto)
    setResultados([])
    setBusqueda('')
  }

  function handleCameraScan(code: string) {
    setShowCameraScanner(false)
    setBusqueda(code)
    void handleSearch(code)
    focusSearch()
  }

  function deltaCantidad(item: CartItem): number {
    return item.modo_venta === 'peso' ? 0.1 : 1
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

  function removeItem(key: string) {
    setCart((prev) => prev.filter((i) => i.key !== key))
  }

  async function handleConfirmar() {
    if (!perfil || cart.length === 0) return
    setProcessing(true)
    setError('')
    try {
      const result = await completarConsumo({
        items: cart,
        registrado_por: perfil.id,
        motivo: motivo || 'Consumo propio',
      })
      setCompletado(result)
      setCart([])
      setMotivo('')
      setBusqueda('')
      setResultados([])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al registrar el consumo')
    } finally {
      setProcessing(false)
      focusSearch()
    }
  }

  const productoModal = modalAgregar?.producto
  const mixtaModal = productoModal ? permiteVentaUnidadSuelta(productoModal) : false

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Consumo propio</h1>
        <p className="text-slate-500">
          Retiro de mercadería al costo · no entra a caja ni a ventas · Cajero: {perfil?.nombre}
        </p>
      </div>

      <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
        <p>
          Baja el stock y registra cuánto costó la mercadería. <strong>No afecta el efectivo</strong> del
          cierre de caja. También verás cuánto dejó de ganar la tienda (precio de venta − costo).
        </p>
      </div>

      <div className="relative flex gap-2">
        <div className="relative flex-1">
          <ScanBarcode className="absolute left-4 top-1/2 h-6 w-6 -translate-y-1/2 text-orange-600" />
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
            placeholder="Código de barras o nombre…"
            className="w-full rounded-xl border-2 border-orange-200 bg-white py-4 pl-14 pr-4 text-lg outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10"
          />
        </div>
        <button
          type="button"
          onClick={() => setShowCameraScanner(true)}
          className="flex shrink-0 items-center justify-center rounded-xl border-2 border-orange-200 bg-white px-4 text-orange-700 hover:bg-orange-50"
          title="Escanear con cámara"
        >
          <Camera className="h-6 w-6" />
        </button>
      </div>

      {avisoBusqueda && (
        <div className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">{avisoBusqueda}</div>
      )}

      {flashAgregado && (
        <div className="rounded-lg bg-orange-500 px-4 py-2.5 text-center text-sm font-semibold text-white shadow-md animate-pulse">
          ✓ {flashAgregado} agregado
        </div>
      )}

      {resultados.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
          {resultados.map((p) => (
            <button
              key={p.id}
              onClick={() => seleccionarProducto(p)}
              className="flex w-full items-center justify-between border-b border-slate-100 px-4 py-3 text-left last:border-0 hover:bg-orange-50"
            >
              <div>
                <p className="font-medium text-slate-900">{p.nombre}</p>
                <p className="text-xs text-slate-500">
                  Stock: {p.stock} {p.unidad} · Costo: {formatMoney(p.costo)}
                </p>
              </div>
              <p className="text-sm font-semibold text-orange-700">{formatMoney(p.precio_venta)}</p>
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
              <ShoppingBasket className="h-5 w-5" />
              Productos a retirar ({cart.length})
            </h2>
            <button
              onClick={() => {
                if (cart.length === 0) return
                if (window.confirm('¿Vaciar la lista?')) setCart([])
              }}
              disabled={cart.length === 0}
              className="flex items-center gap-1 text-sm text-red-600 hover:text-red-700 disabled:opacity-40"
            >
              <Trash2 className="h-4 w-4" />
              Vaciar
            </button>
          </div>

          {cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400">
              <ShoppingBasket className="mb-3 h-12 w-12" />
              <p>Lista vacía</p>
              <p className="text-sm">Escanea o busca productos del catálogo</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {cart.map((item) => (
                <div key={item.key} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center">
                  <div className="flex-1">
                    <p className="font-medium text-slate-900">{item.nombre}</p>
                    <p className="text-xs text-slate-500">
                      {etiquetaCantidadItem(item)} · costo {formatMoney(item.costo_unitario)}
                      {item.unidad !== 'unidad' && item.modo_venta !== 'unidad_suelta'
                        ? `/${item.unidad}`
                        : ''}
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

                  <div className="w-28 text-right text-sm">
                    <p className="font-semibold text-slate-900">{formatMoney(itemCosto(item))}</p>
                    <p className="text-xs text-slate-400">venta {formatMoney(itemVentaPotencial(item))}</p>
                  </div>

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
          <h2 className="mb-1 font-semibold text-slate-900">Resumen al costo</h2>
          <p className="text-3xl font-bold text-orange-700">{formatMoney(costo)}</p>
          <p className="mt-1 text-xs text-slate-500">Mercadería que sale del inventario</p>

          <div className="mt-4 space-y-2 rounded-lg bg-slate-50 p-3 text-sm">
            <div className="flex justify-between text-slate-600">
              <span>Si se hubiera vendido</span>
              <span>{formatMoney(potencial)}</span>
            </div>
            <div className="flex justify-between font-medium text-slate-800">
              <span>Dejó de ganar</span>
              <span>{formatMoney(oportunidad)}</span>
            </div>
          </div>

          <label className="mt-4 mb-1 block text-sm font-medium text-slate-700">Motivo (opcional)</label>
          <input
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Ej: casa, prueba, personal…"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-orange-500"
          />

          <button
            onClick={handleConfirmar}
            disabled={cart.length === 0 || processing}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg bg-orange-600 py-3.5 font-semibold text-white hover:bg-orange-700 disabled:opacity-50"
          >
            {processing ? <Loader2 className="h-5 w-5 animate-spin" /> : <CheckCircle2 className="h-5 w-5" />}
            Confirmar retiro
          </button>
          <p className="mt-2 text-center text-xs text-slate-400">Genera ticket imprimible · no toca caja</p>
        </div>
      </div>

      {modalAgregar && productoModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center gap-2">
              <Scale className="h-5 w-5 text-orange-600" />
              <h3 className="font-bold text-slate-900">{productoModal.nombre}</h3>
            </div>
            <p className="mb-4 text-sm text-slate-500">
              Stock: {productoModal.stock} {productoModal.unidad} · Costo: {formatMoney(productoModal.costo)}
            </p>

            {mixtaModal && (
              <div className="mb-4 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setModalAgregar((m) => (m ? { ...m, modo: 'peso', cantidad: '0.5' } : m))
                  }
                  className={`rounded-lg border py-2.5 text-sm font-medium ${
                    modalAgregar.modo === 'peso'
                      ? 'border-orange-500 bg-orange-50 text-orange-800'
                      : 'border-slate-200 text-slate-600'
                  }`}
                >
                  Por peso (kg)
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setModalAgregar((m) => (m ? { ...m, modo: 'unidad_suelta', cantidad: '1' } : m))
                  }
                  className={`rounded-lg border py-2.5 text-sm font-medium ${
                    modalAgregar.modo === 'unidad_suelta'
                      ? 'border-orange-500 bg-orange-50 text-orange-800'
                      : 'border-slate-200 text-slate-600'
                  }`}
                >
                  Por unidad
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
              className="mb-4 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-lg outline-none focus:border-orange-500"
              autoFocus
            />

            <div className="flex gap-2">
              <button
                onClick={() => setModalAgregar(null)}
                className="flex-1 rounded-lg border border-slate-200 py-2.5 text-slate-600"
              >
                Cancelar
              </button>
              <button
                onClick={confirmarAgregarModal}
                className="flex-1 rounded-lg bg-orange-600 py-2.5 font-semibold text-white"
              >
                Agregar
              </button>
            </div>
          </div>
        </div>
      )}

      {showCameraScanner && (
        <Suspense
          fallback={
            <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60">
              <Loader2 className="h-10 w-10 animate-spin text-white" />
            </div>
          }
        >
          <CameraScannerModal
            onScan={handleCameraScan}
            onClose={() => setShowCameraScanner(false)}
          />
        </Suspense>
      )}

      {completado && perfil && (
        <ConsumoTicket
          consumo={completado}
          registradoPor={perfil.nombre}
          onClose={() => {
            setCompletado(null)
            focusSearch()
          }}
        />
      )}
    </div>
  )
}
