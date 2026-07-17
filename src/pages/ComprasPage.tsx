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
  Banknote,
  Smartphone,
  Clock,
  Calendar,
  Layers,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { formatMoney, formatDate, todayLocalISO } from '@/lib/utils'
import {
  buscarProductosCompra,
  fetchCompras,
  registrarCompra,
  compraTotal,
  lineaSubtotal,
  MODOS_PAGO_COMPRA,
  labelModoPagoCompra,
  validarCuotas,
  type LineaCompra,
  type CompraRegistrada,
  type ModoPagoCompra,
  type CuotaInput,
} from '@/lib/compras'
import { fetchCuotasPorCompra, type CuotaProveedor } from '@/lib/deudasProveedor'
import type { Producto } from '@/types/database'

interface CuotaForm extends CuotaInput {
  key: string
}

function fechaVencimientoDefault(dias = 7): string {
  const d = new Date()
  d.setDate(d.getDate() + dias)
  return d.toISOString().slice(0, 10)
}

function nuevaCuota(monto: number, descripcion: string): CuotaForm {
  return {
    key: crypto.randomUUID(),
    monto,
    fecha_vencimiento: fechaVencimientoDefault(7),
    descripcion,
  }
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
  const [cuotasExpandida, setCuotasExpandida] = useState<CuotaProveedor[]>([])

  const [fecha, setFecha] = useState(todayLocalISO())
  const [proveedor, setProveedor] = useState('')
  const [ruc, setRuc] = useState('')
  const [telefono, setTelefono] = useState('')
  const [factura, setFactura] = useState('')
  const [modoPago, setModoPago] = useState<ModoPagoCompra>('efectivo')
  const [pagoHoy, setPagoHoy] = useState('')
  const [pagoHoyMetodo, setPagoHoyMetodo] = useState<'efectivo' | 'yape'>('efectivo')
  const [cuotas, setCuotas] = useState<CuotaForm[]>([])
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

  useEffect(() => {
    if (modoPago !== 'fiado') return
    const t = compraTotal(lineas)
    if (t <= 0) return
    setCuotas((prev) => {
      if (prev.length === 0) return [nuevaCuota(t, 'Pago completo')]
      if (prev.length === 1) return [{ ...prev[0], monto: t }]
      return prev
    })
  }, [lineas, modoPago])

  useEffect(() => {
    if (modoPago !== 'mixto') return
    const t = compraTotal(lineas)
    if (t <= 0) return
    const hoy = parseFloat(pagoHoy) || 0
    const saldo = Math.max(0, Math.round((t - hoy) * 100) / 100)
    if (saldo <= 0) return
    setCuotas((prev) => {
      if (prev.length === 0) return [nuevaCuota(saldo, 'Saldo pendiente')]
      if (prev.length === 1) return [{ ...prev[0], monto: saldo }]
      return prev
    })
  }, [lineas, modoPago, pagoHoy])

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
          fecha_vencimiento_lote: '',
          vencimiento_actual: p.fecha_vencimiento ?? null,
        },
      ])
    }
    setBusqueda('')
    setResultados([])
    searchRef.current?.focus()
  }

  function updateLinea(
    key: string,
    field: 'cantidad' | 'costo_unitario' | 'fecha_vencimiento_lote',
    value: number | string,
  ) {
    setLineas((prev) =>
      prev.map((l) => (l.key === key ? { ...l, [field]: value } : l)),
    )
  }

  function cambiarModoPago(m: ModoPagoCompra) {
    setModoPago(m)
    const t = compraTotal(lineas)
    if (m === 'fiado' && t > 0) {
      setCuotas([nuevaCuota(t, 'Pago completo')])
      setPagoHoy('')
    } else if (m === 'mixto' && t > 0) {
      setPagoHoy('')
      setCuotas([])
    } else {
      setCuotas([])
      setPagoHoy('')
    }
  }

  function syncCuotaSaldo(saldo: number) {
    if (saldo <= 0) {
      setCuotas([])
      return
    }
    setCuotas((prev) => {
      if (prev.length === 0) return [nuevaCuota(saldo, 'Saldo pendiente')]
      if (prev.length === 1) {
        return [{ ...prev[0], monto: saldo }]
      }
      return prev
    })
  }

  function removeLinea(key: string) {
    setLineas((prev) => prev.filter((l) => l.key !== key))
  }

  function addCuota() {
    setCuotas((prev) => [...prev, nuevaCuota(0, `Cuota ${prev.length + 1}`)])
  }

  function updateCuota(key: string, field: keyof CuotaInput, value: string | number) {
    setCuotas((prev) =>
      prev.map((c) => (c.key === key ? { ...c, [field]: value } : c)),
    )
  }

  function removeCuota(key: string) {
    setCuotas((prev) => prev.filter((c) => c.key !== key))
  }

  async function toggleExpandida(compraId: string) {
    if (expandida === compraId) {
      setExpandida(null)
      setCuotasExpandida([])
      return
    }
    setExpandida(compraId)
    try {
      setCuotasExpandida(await fetchCuotasPorCompra(compraId))
    } catch {
      setCuotasExpandida([])
    }
  }

  function resetForm() {
    setFecha(todayLocalISO())
    setProveedor('')
    setRuc('')
    setTelefono('')
    setFactura('')
    setModoPago('efectivo')
    setPagoHoy('')
    setPagoHoyMetodo('efectivo')
    setCuotas([])
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

    const totalCompra = compraTotal(lineas)
    setSaving(true)
    setError('')

    const montoHoy = parseFloat(pagoHoy) || 0
    const saldoFiado =
      modoPago === 'fiado'
        ? totalCompra
        : modoPago === 'mixto'
          ? Math.round((totalCompra - montoHoy) * 100) / 100
          : 0

    const cuotasInput: CuotaInput[] = cuotas.map(({ monto, fecha_vencimiento, descripcion }) => ({
      monto,
      fecha_vencimiento,
      descripcion,
    }))

    const errCuotas = validarCuotas(saldoFiado, cuotasInput)
    if (errCuotas && (modoPago === 'fiado' || modoPago === 'mixto')) {
      setError(errCuotas)
      setSaving(false)
      return
    }

    try {
      await registrarCompra({
        proveedor_nombre: proveedor,
        proveedor_ruc: ruc,
        proveedor_telefono: telefono,
        fecha,
        numero_factura: factura,
        modo_pago: modoPago,
        pago_inmediato_monto: modoPago === 'mixto' ? montoHoy : undefined,
        pago_inmediato_metodo: modoPago === 'mixto' ? pagoHoyMetodo : undefined,
        cuotas: cuotasInput,
        lineas,
        registrado_por: perfil.id,
      })
      const pagoLabel = labelModoPagoCompra(modoPago)
      let extra = ''
      if (modoPago === 'efectivo' || modoPago === 'yape') extra = ' · descontado de caja/Yape'
      else if (modoPago === 'fiado') extra = ` · ${cuotasInput.length} cuota(s) programada(s)`
      else extra = ` · adelanto + ${cuotasInput.length} cuota(s)`
      setMensaje(
        `Compra registrada (${lineas.length} productos, ${pagoLabel})${extra} · stock actualizado`,
      )
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
  const montoHoyNum = parseFloat(pagoHoy) || 0
  const saldoPendiente =
    modoPago === 'fiado'
      ? total
      : modoPago === 'mixto'
        ? Math.max(0, Math.round((total - montoHoyNum) * 100) / 100)
        : 0
  const sumaCuotas = Math.round(cuotas.reduce((s, c) => s + Number(c.monto), 0) * 100) / 100
  const modoHint = MODOS_PAGO_COMPRA.find((m) => m.id === modoPago)?.hint ?? ''

  const modoIcon = (m: ModoPagoCompra) => {
    if (m === 'yape') return <Smartphone className="h-4 w-4 text-purple-600" />
    if (m === 'fiado') return <Clock className="h-4 w-4 text-slate-500" />
    if (m === 'mixto') return <Banknote className="h-4 w-4 text-amber-600" />
    return <Banknote className="h-4 w-4 text-teal-600" />
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Compras a proveedores</h1>
          <p className="text-slate-500">
            Un proveedor, varios productos · elige cómo pagaste y se refleja en caja
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
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
          <Link
            to="/lotes"
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 font-medium text-slate-700 hover:bg-slate-50"
          >
            <Layers className="h-5 w-5" />
            Lotes / vencimientos
          </Link>
          <Link
            to="/deudas-proveedor"
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 font-medium text-slate-700 hover:bg-slate-50"
          >
            <Clock className="h-5 w-5" />
            Deudas pendientes
          </Link>
        </div>
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
            <div className="mb-2 flex items-center justify-between">
              <label className="block text-sm font-medium text-slate-700">Agregar productos</label>
              {lineas.length > 0 && (
                <span className="rounded-full bg-teal-50 px-2.5 py-0.5 text-xs font-semibold text-teal-700">
                  {lineas.length} en la lista
                </span>
              )}
            </div>
            <p className="mb-2 text-xs text-slate-500">
              Busca y agrega todos los productos del proveedor antes de guardar
            </p>
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
              <p className="border-b border-slate-100 bg-slate-50 px-4 py-2 text-xs text-slate-500">
                Indica cuándo vence <strong>este lote</strong>. Cada fecha crea un lote aparte
                (ej: 3 leches al 20/07 y 6 al 05/08). Al vender se descuenta primero el que
                vence antes.
              </p>
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left text-slate-600">
                  <tr>
                    <th className="px-4 py-2 font-medium">Producto</th>
                    <th className="px-4 py-2 font-medium">Cantidad</th>
                    <th className="px-4 py-2 font-medium">Costo unit.</th>
                    <th className="px-4 py-2 font-medium">Vence lote</th>
                    <th className="px-4 py-2 font-medium">Subtotal</th>
                    <th className="px-4 py-2" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {lineas.map((l) => (
                    <tr key={l.key}>
                      <td className="px-4 py-2">
                        <p className="font-medium text-slate-900">{l.nombre}</p>
                        {l.vencimiento_actual && (
                          <p className="text-xs text-slate-400">
                            Catálogo hoy: {formatDate(l.vencimiento_actual)}
                          </p>
                        )}
                      </td>
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
                      <td className="px-4 py-2">
                        <input
                          type="date"
                          value={l.fecha_vencimiento_lote ?? ''}
                          onChange={(e) =>
                            updateLinea(l.key, 'fecha_vencimiento_lote', e.target.value)
                          }
                          className="w-[9.5rem] rounded border border-slate-300 px-2 py-1 text-xs"
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
                    <td colSpan={4} className="px-4 py-3 text-right font-semibold text-slate-700">
                      Total compra
                    </td>
                    <td className="px-4 py-3 font-bold text-teal-700">{formatMoney(total)}</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}

          <div className="mt-6">
            <label className="mb-2 block text-sm font-medium text-slate-700">¿Cómo pagaste?</label>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {MODOS_PAGO_COMPRA.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => cambiarModoPago(m.id)}
                  className={`rounded-xl border px-3 py-3 text-left text-sm transition ${
                    modoPago === m.id
                      ? 'border-teal-500 bg-teal-50 ring-2 ring-teal-500/20'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <span className="flex items-center gap-2 font-semibold text-slate-900">
                    {modoIcon(m.id)}
                    {m.label}
                  </span>
                </button>
              ))}
            </div>
            {modoHint && <p className="mt-2 text-xs text-slate-500">{modoHint}</p>}
            {(modoPago === 'fiado' || modoPago === 'mixto') && total <= 0 && (
              <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                Agrega productos primero para programar las fechas de pago al proveedor.
              </p>
            )}
          </div>

          {modoPago === 'mixto' && total > 0 && (
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
              <p className="mb-3 text-sm font-medium text-amber-900">Pago de hoy (adelanto)</p>
              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <label className="mb-1 block text-xs text-amber-800">Monto hoy S/</label>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    max={total - 0.01}
                    value={pagoHoy}
                    onChange={(e) => {
                      setPagoHoy(e.target.value)
                      const hoy = parseFloat(e.target.value) || 0
                      syncCuotaSaldo(Math.round((total - hoy) * 100) / 100)
                    }}
                    placeholder="Ej: 200"
                    className="w-full rounded-lg border border-amber-200 bg-white px-3 py-2 outline-none focus:border-amber-500"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-xs text-amber-800">Método del adelanto</label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setPagoHoyMetodo('efectivo')}
                      className={`flex flex-1 items-center justify-center gap-2 rounded-lg border py-2 text-sm ${
                        pagoHoyMetodo === 'efectivo'
                          ? 'border-teal-500 bg-white text-teal-800'
                          : 'border-amber-200 text-amber-800'
                      }`}
                    >
                      <Banknote className="h-4 w-4" /> Efectivo
                    </button>
                    <button
                      type="button"
                      onClick={() => setPagoHoyMetodo('yape')}
                      className={`flex flex-1 items-center justify-center gap-2 rounded-lg border py-2 text-sm ${
                        pagoHoyMetodo === 'yape'
                          ? 'border-purple-500 bg-white text-purple-800'
                          : 'border-amber-200 text-amber-800'
                      }`}
                    >
                      <Smartphone className="h-4 w-4" /> Yape
                    </button>
                  </div>
                </div>
              </div>
              {saldoPendiente > 0 && (
                <p className="mt-2 text-xs text-amber-800">
                  Saldo a fiar: <strong>{formatMoney(saldoPendiente)}</strong>
                </p>
              )}
            </div>
          )}

          {(modoPago === 'fiado' || modoPago === 'mixto') && saldoPendiente > 0 && (
            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-900">Cuotas / fechas de pago</p>
                  <p className="text-xs text-slate-500">
                    Deben sumar {formatMoney(saldoPendiente)}
                    {Math.abs(sumaCuotas - saldoPendiente) > 0.01 && (
                      <span className="text-red-600"> · suman {formatMoney(sumaCuotas)}</span>
                    )}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={addCuota}
                  className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
                >
                  <Plus className="h-3.5 w-3.5" /> Cuota
                </button>
              </div>
              <div className="space-y-2">
                {cuotas.map((c) => (
                  <div
                    key={c.key}
                    className="grid gap-2 rounded-lg border border-slate-200 bg-white p-3 sm:grid-cols-12"
                  >
                    <input
                      value={c.descripcion ?? ''}
                      onChange={(e) => updateCuota(c.key, 'descripcion', e.target.value)}
                      placeholder="Ej: Cuota 1"
                      className="rounded border border-slate-200 px-2 py-1.5 text-sm sm:col-span-3"
                    />
                    <div className="relative sm:col-span-3">
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-slate-400">S/</span>
                      <input
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={c.monto || ''}
                        onChange={(e) =>
                          updateCuota(c.key, 'monto', parseFloat(e.target.value) || 0)
                        }
                        className="w-full rounded border border-slate-200 py-1.5 pl-7 pr-2 text-sm"
                      />
                    </div>
                    <div className="relative sm:col-span-5">
                      <Calendar className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <input
                        type="date"
                        value={c.fecha_vencimiento}
                        onChange={(e) => updateCuota(c.key, 'fecha_vencimiento', e.target.value)}
                        className="w-full rounded border border-slate-200 py-1.5 pl-8 pr-2 text-sm"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => removeCuota(c.key)}
                      disabled={cuotas.length <= 1}
                      className="flex items-center justify-center text-red-400 hover:text-red-600 disabled:opacity-30 sm:col-span-1"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

          <button
            onClick={handleGuardar}
            disabled={saving || lineas.length === 0 || !proveedor.trim()}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-teal-600 py-3 font-semibold text-white hover:bg-teal-700 disabled:opacity-50 sm:w-auto sm:px-8"
          >
            {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <CheckCircle className="h-5 w-5" />}
            Guardar compra ({lineas.length} producto{lineas.length === 1 ? '' : 's'})
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
                  onClick={() => toggleExpandida(c.id)}
                  className="flex w-full items-center justify-between px-5 py-4 text-left hover:bg-slate-50"
                >
                  <div>
                    <p className="font-medium text-slate-900">
                      {c.proveedor_nombre ?? 'Sin proveedor'}
                      {c.estado_pago && c.estado_pago !== 'pagado' && (
                        <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                          Pendiente {formatMoney(Number(c.monto_pendiente ?? 0))}
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-slate-500">
                      {formatDate(c.fecha)}
                      {c.numero_factura && ` · Factura ${c.numero_factura}`}
                      {` · ${c.compra_detalles?.length ?? 0} productos`}
                      {c.estado_pago === 'pagado'
                        ? ' · Pagado'
                        : c.estado_pago === 'parcial'
                          ? ` · Parcial (${formatMoney(Number(c.monto_pagado ?? 0))} pagado)`
                          : c.estado_pago === 'pendiente'
                            ? ' · Fiado'
                            : ''}
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
                        <li key={d.id} className="flex justify-between gap-2 text-slate-700">
                          <span>
                            {d.productos?.nombre ?? 'Producto'} — {d.cantidad}{' '}
                            {d.productos?.unidad ?? 'und'}
                            {d.fecha_vencimiento_lote &&
                              ` · lote vence ${formatDate(d.fecha_vencimiento_lote)}`}
                          </span>
                          <span>
                            {formatMoney(Number(d.costo_unitario))} c/u ={' '}
                            {formatMoney(Number(d.cantidad) * Number(d.costo_unitario))}
                          </span>
                        </li>
                      ))}
                    </ul>
                    {cuotasExpandida.length > 0 && (
                      <div className="mt-3 border-t border-slate-200 pt-3">
                        <p className="mb-2 text-xs font-semibold uppercase text-slate-500">Cuotas</p>
                        <ul className="space-y-1 text-sm">
                          {cuotasExpandida.map((q) => (
                            <li key={q.id} className="flex justify-between text-slate-700">
                              <span>
                                {q.descripcion || 'Cuota'} · vence {formatDate(q.fecha_vencimiento)}
                              </span>
                              <span className={q.pagado ? 'text-emerald-600' : 'text-amber-700'}>
                                {formatMoney(Number(q.monto))} {q.pagado ? '✓ pagada' : 'pendiente'}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
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
