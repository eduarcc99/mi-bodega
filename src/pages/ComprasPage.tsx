import { useEffect, useState, useRef } from 'react'
import {
  Truck,
  Plus,
  Search,
  Trash2,
  Loader2,
  CheckCircle,
  Package,
  ChevronDown,
  ChevronUp,
  X,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { formatMoney, formatDate } from '@/lib/utils'
import {
  buscarProductosCompra,
  fetchCompras,
  registrarCompra,
  compraTotal,
  lineaSubtotal,
  type LineaCompra,
  type CompraRegistrada,
} from '@/lib/compras'
import type { Producto } from '@/types/database'

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

export function ComprasPage() {
  const { perfil } = useAuth()
  const searchRef = useRef<HTMLInputElement>(null)

  const [compras, setCompras] = useState<CompraRegistrada[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [mensaje, setMensaje] = useState('')
  const [expandida, setExpandida] = useState<string | null>(null)

  const [fecha, setFecha] = useState(todayISO())
  const [proveedor, setProveedor] = useState('')
  const [ruc, setRuc] = useState('')
  const [telefono, setTelefono] = useState('')
  const [factura, setFactura] = useState('')
  const [lineas, setLineas] = useState<LineaCompra[]>([])

  const [busqueda, setBusqueda] = useState('')
  const [resultados, setResultados] = useState<Producto[]>([])

  async function load() {
    setLoading(true)
    try {
      setCompras(await fetchCompras())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar compras')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  async function handleBuscar(q?: string) {
    const query = (q ?? busqueda).trim()
    if (!query) return
    const prods = await buscarProductosCompra(query)
    if (prods.length === 1) {
      agregarProducto(prods[0])
      setBusqueda('')
      setResultados([])
    } else {
      setResultados(prods)
    }
  }

  function agregarProducto(p: Producto) {
    const existe = lineas.find((l) => l.producto_id === p.id)
    if (existe) {
      setLineas((prev) =>
        prev.map((l) =>
          l.producto_id === p.id ? { ...l, cantidad: l.cantidad + 1 } : l,
        ),
      )
    } else {
      setLineas((prev) => [
        ...prev,
        {
          key: p.id,
          producto_id: p.id,
          nombre: p.nombre,
          unidad: p.unidad,
          cantidad: 1,
          costo_unitario: Number(p.costo) || 0,
        },
      ])
    }
    setBusqueda('')
    setResultados([])
    searchRef.current?.focus()
  }

  function updateLinea(key: string, field: 'cantidad' | 'costo_unitario', value: number) {
    setLineas((prev) =>
      prev.map((l) => (l.key === key ? { ...l, [field]: value } : l)),
    )
  }

  function removeLinea(key: string) {
    setLineas((prev) => prev.filter((l) => l.key !== key))
  }

  function resetForm() {
    setFecha(todayISO())
    setProveedor('')
    setRuc('')
    setTelefono('')
    setFactura('')
    setLineas([])
    setBusqueda('')
    setResultados([])
    setError('')
  }

  async function handleGuardar() {
    if (!perfil) return
    if (!proveedor.trim()) {
      setError('Ingresa el nombre del proveedor')
      return
    }
    if (lineas.length === 0) {
      setError('Agrega al menos un producto')
      return
    }
    setSaving(true)
    setError('')
    try {
      await registrarCompra({
        proveedor_nombre: proveedor,
        proveedor_ruc: ruc,
        proveedor_telefono: telefono,
        fecha,
        numero_factura: factura,
        lineas,
        registrado_por: perfil.id,
      })
      setMensaje('Compra registrada — el stock se actualizó automáticamente')
      resetForm()
      setShowForm(false)
      load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  const total = compraTotal(lineas)

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Compras a proveedores</h1>
          <p className="text-slate-500">Registra lo que compras — el stock sube solo</p>
        </div>
        <button
          onClick={() => {
            resetForm()
            setShowForm(true)
          }}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-teal-600 px-4 py-2.5 font-medium text-white hover:bg-teal-700"
        >
          <Plus className="h-5 w-5" />
          Nueva compra
        </button>
      </div>

      {mensaje && (
        <div className="flex items-center gap-2 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          <CheckCircle className="h-4 w-4" />
          {mensaje}
        </div>
      )}

      {showForm && (
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-bold text-slate-900">
              <Truck className="h-5 w-5 text-teal-600" />
              Registrar compra
            </h2>
            <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-600">
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Fecha</label>
              <input
                type="date"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-teal-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Proveedor *</label>
              <input
                value={proveedor}
                onChange={(e) => setProveedor(e.target.value)}
                placeholder="Nombre del proveedor"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-teal-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">N° Factura / Boleta</label>
              <input
                value={factura}
                onChange={(e) => setFactura(e.target.value)}
                placeholder="Opcional"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-teal-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">RUC</label>
              <input
                value={ruc}
                onChange={(e) => setRuc(e.target.value)}
                placeholder="Opcional"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-teal-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Teléfono</label>
              <input
                value={telefono}
                onChange={(e) => setTelefono(e.target.value)}
                placeholder="Opcional"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-teal-500"
              />
            </div>
          </div>

          <div className="mb-4">
            <label className="mb-1 block text-sm font-medium text-slate-700">Agregar productos</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
              <input
                ref={searchRef}
                value={busqueda}
                onChange={(e) => {
                  setBusqueda(e.target.value)
                  setResultados([])
                }}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleBuscar())}
                placeholder="Buscar producto por nombre o código…"
                className="w-full rounded-lg border border-slate-300 py-3 pl-10 pr-4 outline-none focus:border-teal-500"
              />
            </div>
            {resultados.length > 0 && (
              <div className="mt-2 rounded-lg border border-slate-200 bg-white shadow-sm">
                {resultados.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => agregarProducto(p)}
                    className="flex w-full items-center justify-between border-b border-slate-100 px-4 py-2 text-left last:border-0 hover:bg-teal-50"
                  >
                    <span className="text-sm font-medium">{p.nombre}</span>
                    <span className="text-xs text-slate-500">Costo actual: {formatMoney(p.costo)}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {lineas.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-300 py-10 text-center text-slate-400">
              <Package className="mx-auto mb-2 h-10 w-10" />
              <p className="text-sm">Busca y agrega productos a esta compra</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left text-slate-600">
                  <tr>
                    <th className="px-4 py-2 font-medium">Producto</th>
                    <th className="px-4 py-2 font-medium">Cantidad</th>
                    <th className="px-4 py-2 font-medium">Costo unit.</th>
                    <th className="px-4 py-2 font-medium">Subtotal</th>
                    <th className="px-4 py-2" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {lineas.map((l) => (
                    <tr key={l.key}>
                      <td className="px-4 py-2 font-medium text-slate-900">{l.nombre}</td>
                      <td className="px-4 py-2">
                        <input
                          type="number"
                          min="0.001"
                          step="0.001"
                          value={l.cantidad}
                          onChange={(e) => updateLinea(l.key, 'cantidad', parseFloat(e.target.value) || 0)}
                          className="w-20 rounded border border-slate-300 px-2 py-1"
                        />
                        <span className="ml-1 text-xs text-slate-400">{l.unidad}</span>
                      </td>
                      <td className="px-4 py-2">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={l.costo_unitario}
                          onChange={(e) => updateLinea(l.key, 'costo_unitario', parseFloat(e.target.value) || 0)}
                          className="w-24 rounded border border-slate-300 px-2 py-1"
                        />
                      </td>
                      <td className="px-4 py-2 font-medium">{formatMoney(lineaSubtotal(l))}</td>
                      <td className="px-4 py-2">
                        <button onClick={() => removeLinea(l.key)} className="text-red-400 hover:text-red-600">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-slate-50">
                  <tr>
                    <td colSpan={3} className="px-4 py-3 text-right font-semibold text-slate-700">
                      Total compra
                    </td>
                    <td className="px-4 py-3 font-bold text-teal-700">{formatMoney(total)}</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}

          {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

          <button
            onClick={handleGuardar}
            disabled={saving || lineas.length === 0}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-teal-600 py-3 font-semibold text-white hover:bg-teal-700 disabled:opacity-50 sm:w-auto sm:px-8"
          >
            {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <CheckCircle className="h-5 w-5" />}
            Guardar compra
          </button>
        </div>
      )}

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <h2 className="border-b border-slate-100 px-5 py-4 font-semibold text-slate-900">
          Historial de compras
        </h2>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
          </div>
        ) : compras.length === 0 ? (
          <p className="py-12 text-center text-sm text-slate-400">No hay compras registradas</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {compras.map((c) => (
              <div key={c.id}>
                <button
                  onClick={() => setExpandida(expandida === c.id ? null : c.id)}
                  className="flex w-full items-center justify-between px-5 py-4 text-left hover:bg-slate-50"
                >
                  <div>
                    <p className="font-medium text-slate-900">
                      {c.proveedor_nombre ?? 'Sin proveedor'}
                    </p>
                    <p className="text-xs text-slate-500">
                      {formatDate(c.fecha)}
                      {c.numero_factura && ` · Factura ${c.numero_factura}`}
                      {` · ${c.compra_detalles?.length ?? 0} productos`}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-teal-700">{formatMoney(Number(c.total))}</span>
                    {expandida === c.id ? (
                      <ChevronUp className="h-4 w-4 text-slate-400" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-slate-400" />
                    )}
                  </div>
                </button>
                {expandida === c.id && (
                  <div className="border-t border-slate-100 bg-slate-50 px-5 py-3">
                    <ul className="space-y-1 text-sm">
                      {c.compra_detalles?.map((d) => (
                        <li key={d.id} className="flex justify-between text-slate-700">
                          <span>
                            {d.productos?.nombre ?? 'Producto'} — {d.cantidad} {d.productos?.unidad ?? 'und'}
                          </span>
                          <span>
                            {formatMoney(Number(d.costo_unitario))} c/u ={' '}
                            {formatMoney(Number(d.cantidad) * Number(d.costo_unitario))}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
