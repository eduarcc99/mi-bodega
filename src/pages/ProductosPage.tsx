import { useEffect, useState, useMemo, lazy, Suspense } from 'react'
import {
  Plus,
  Search,
  Package,
  AlertTriangle,
  Clock,
  Pencil,
  X,
  Upload,
  Loader2,
  Tags,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Camera,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { uploadProductImage, getOptimizedImageUrl } from '@/lib/cloudinary'
import {
  crearCategoria,
  actualizarCategoria,
  eliminarCategoria,
} from '@/lib/categorias'
import {
  calcularPrecioVenta,
  formatMoney,
  formatDate,
  diasHastaVencimiento,
  productoVencido,
  stockBajo,
} from '@/lib/utils'
import type { Categoria, Producto, ProductoForm, UnidadMedida } from '@/types/database'
import { useAuth } from '@/contexts/AuthContext'

const CameraScannerModal = lazy(() =>
  import('@/components/pos/CameraScannerModal').then((m) => ({ default: m.CameraScannerModal })),
)

const emptyForm: ProductoForm = {
  codigo_barra: '',
  nombre: '',
  categoria_id: '',
  unidad: 'unidad',
  stock: '',
  stock_minimo: '5',
  costo: '',
  margen_pct: '25',
  precio_venta: '',
  fecha_vencimiento: '',
  activo: true,
  imagen_url: '',
  cantidad_mayor: '',
  precio_mayor: '',
  permite_venta_unidad: false,
  precio_por_unidad: '',
  peso_estimado_unidad: '',
}

function parseNum(value: string, fallback = 0): number {
  const n = parseFloat(value)
  return Number.isFinite(n) ? n : fallback
}

function recalcPrecioVenta(costo: string, margen: string): string {
  const c = parseNum(costo)
  if (costo.trim() === '' || c <= 0) return ''
  return String(calcularPrecioVenta(c, parseNum(margen, 25)))
}

const PAGE_SIZE = 20

function ProductoThumbnail({ producto }: { producto: Producto }) {
  if (producto.imagen_url) {
    return (
      <img
        src={getOptimizedImageUrl(producto.imagen_url, 48)}
        alt=""
        className="h-10 w-10 shrink-0 rounded-lg object-cover"
      />
    )
  }
  return (
    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100">
      <Package className="h-5 w-5 text-slate-400" />
    </div>
  )
}

function EstadoProducto({ producto }: { producto: Producto }) {
  const vencido = productoVencido(producto.fecha_vencimiento)
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
        !producto.activo || vencido
          ? 'bg-red-100 text-red-700'
          : 'bg-emerald-100 text-emerald-700'
      }`}
    >
      {!producto.activo ? 'Inactivo' : vencido ? 'Vencido' : 'Activo'}
    </span>
  )
}

export function ProductosPage() {
  const { canSeeFinancials } = useAuth()
  const [productos, setProductos] = useState<Producto[]>([])
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [busqueda, setBusqueda] = useState('')
  const [filtroCategoria, setFiltroCategoria] = useState('')
  const [pagina, setPagina] = useState(1)
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [showCameraScanner, setShowCameraScanner] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState<ProductoForm>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

  const [catModalOpen, setCatModalOpen] = useState(false)
  const [catNombre, setCatNombre] = useState('')
  const [catMargen, setCatMargen] = useState('25')
  const [catEditId, setCatEditId] = useState<string | null>(null)
  const [catError, setCatError] = useState('')
  const [catSaving, setCatSaving] = useState(false)

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    setPagina(1)
  }, [busqueda, filtroCategoria])

  async function loadData() {
    setLoading(true)
    const [prodRes, catRes] = await Promise.all([
      supabase
        .from('productos')
        .select('*, categorias(id, nombre, margen_default)')
        .order('nombre'),
      supabase.from('categorias').select('*').order('nombre'),
    ])
    if (prodRes.data) setProductos(prodRes.data as Producto[])
    if (catRes.data) setCategorias(catRes.data as Categoria[])
    setLoading(false)
  }

  function openNew() {
    setEditId(null)
    const margen = String(categorias[0]?.margen_default ?? 25)
    setForm({ ...emptyForm, margen_pct: margen, categoria_id: categorias[0]?.id ?? '' })
    setError('')
    setModalOpen(true)
  }

  function openCatModal() {
    setCatEditId(null)
    setCatNombre('')
    setCatMargen('25')
    setCatError('')
    setCatModalOpen(true)
  }

  function startEditCategoria(c: Categoria) {
    setCatEditId(c.id)
    setCatNombre(c.nombre)
    setCatMargen(String(c.margen_default))
    setCatError('')
  }

  async function handleGuardarCategoria() {
    const margen = parseFloat(catMargen)
    if (!catNombre.trim()) {
      setCatError('Ingresa el nombre de la categoría')
      return
    }
    if (isNaN(margen) || margen < 0 || margen >= 100) {
      setCatError('Margen debe ser entre 0 y 99')
      return
    }
    setCatSaving(true)
    setCatError('')
    try {
      if (catEditId) {
        await actualizarCategoria(catEditId, { nombre: catNombre, margen_default: margen })
      } else {
        await crearCategoria(catNombre, margen)
      }
      await loadData()
      setCatEditId(null)
      setCatNombre('')
      setCatMargen('25')
    } catch (e) {
      setCatError(e instanceof Error ? e.message : 'Error al guardar categoría')
    } finally {
      setCatSaving(false)
    }
  }

  async function handleEliminarCategoria(id: string) {
    if (!confirm('¿Eliminar esta categoría? Los productos quedarán sin categoría.')) return
    setCatError('')
    try {
      await eliminarCategoria(id)
      await loadData()
      if (catEditId === id) {
        setCatEditId(null)
        setCatNombre('')
        setCatMargen('25')
      }
    } catch (e) {
      setCatError(e instanceof Error ? e.message : 'No se pudo eliminar')
    }
  }

  function openEdit(p: Producto) {
    setEditId(p.id)
    setForm({
      codigo_barra: p.codigo_barra ?? '',
      nombre: p.nombre,
      categoria_id: p.categoria_id ?? '',
      unidad: p.unidad,
      stock: String(p.stock),
      stock_minimo: String(p.stock_minimo),
      costo: String(p.costo),
      margen_pct: String(p.margen_pct ?? 25),
      precio_venta: String(p.precio_venta),
      fecha_vencimiento: p.fecha_vencimiento ?? '',
      activo: p.activo,
      imagen_url: p.imagen_url ?? '',
      cantidad_mayor: p.cantidad_mayor?.toString() ?? '',
      precio_mayor: p.precio_mayor?.toString() ?? '',
      permite_venta_unidad: p.permite_venta_unidad ?? false,
      precio_por_unidad: p.precio_por_unidad != null ? String(p.precio_por_unidad) : '',
      peso_estimado_unidad: p.peso_estimado_unidad != null ? String(p.peso_estimado_unidad) : '',
    })
    setError('')
    setModalOpen(true)
  }

  function updateForm(field: keyof ProductoForm, value: string | boolean) {
    setForm((prev) => {
      const next = { ...prev, [field]: value }
      if (field === 'costo' || field === 'margen_pct') {
        const costo = field === 'costo' ? String(value) : prev.costo
        const margen = field === 'margen_pct' ? String(value) : prev.margen_pct
        next.precio_venta = recalcPrecioVenta(costo, margen)
      }
      if (field === 'categoria_id') {
        const cat = categorias.find((c) => c.id === value)
        if (cat) {
          next.margen_pct = String(cat.margen_default)
          next.precio_venta = recalcPrecioVenta(next.costo, String(cat.margen_default))
        }
      }
      return next
    })
  }

  function handleCameraScan(code: string) {
    setShowCameraScanner(false)
    updateForm('codigo_barra', code.trim())
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setError('')
    try {
      const url = await uploadProductImage(file)
      updateForm('imagen_url', url)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al subir imagen')
    } finally {
      setUploading(false)
    }
  }

  async function handleSave() {
    if (!form.nombre.trim()) {
      setError('El nombre es obligatorio')
      return
    }
    if (form.costo.trim() === '') {
      setError('Ingresa el costo del producto')
      return
    }
    setSaving(true)
    setError('')

    const costo = parseNum(form.costo)
    const margen = parseNum(form.margen_pct, 25)
    const precioVenta = form.precio_venta.trim()
      ? parseNum(form.precio_venta)
      : calcularPrecioVenta(costo, margen)

    const payload = {
      codigo_barra: form.codigo_barra || null,
      nombre: form.nombre.trim(),
      categoria_id: form.categoria_id || null,
      unidad: form.unidad as UnidadMedida,
      stock: parseNum(form.stock),
      stock_minimo: parseNum(form.stock_minimo, 5),
      costo,
      precio_venta: precioVenta,
      margen_pct: margen,
      fecha_vencimiento: form.fecha_vencimiento || null,
      activo: form.activo,
      imagen_url: form.imagen_url || null,
      cantidad_mayor: form.cantidad_mayor ? Number(form.cantidad_mayor) : null,
      precio_mayor: form.precio_mayor ? Number(form.precio_mayor) : null,
      permite_venta_unidad: form.unidad === 'kg' ? form.permite_venta_unidad : false,
      precio_por_unidad:
        form.unidad === 'kg' && form.permite_venta_unidad && form.precio_por_unidad
          ? parseNum(form.precio_por_unidad)
          : null,
      peso_estimado_unidad:
        form.unidad === 'kg' && form.permite_venta_unidad && form.peso_estimado_unidad
          ? parseNum(form.peso_estimado_unidad)
          : null,
      updated_at: new Date().toISOString(),
    }

    const { error: saveError } = editId
      ? await supabase.from('productos').update(payload).eq('id', editId)
      : await supabase.from('productos').insert(payload)

    if (saveError) {
      setError(saveError.message)
    } else {
      setModalOpen(false)
      loadData()
    }
    setSaving(false)
  }

  const filtrados = useMemo(
    () =>
      productos.filter((p) => {
        const q = busqueda.toLowerCase().trim()
        const matchBusqueda =
          !q ||
          p.nombre.toLowerCase().includes(q) ||
          (p.codigo_barra?.toLowerCase().includes(q) ?? false)
        const matchCategoria = !filtroCategoria || p.categoria_id === filtroCategoria
        return matchBusqueda && matchCategoria
      }),
    [productos, busqueda, filtroCategoria],
  )

  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / PAGE_SIZE))
  const paginaActual = Math.min(pagina, totalPaginas)
  const paginados = filtrados.slice(
    (paginaActual - 1) * PAGE_SIZE,
    paginaActual * PAGE_SIZE,
  )
  const desde = filtrados.length === 0 ? 0 : (paginaActual - 1) * PAGE_SIZE + 1
  const hasta = Math.min(paginaActual * PAGE_SIZE, filtrados.length)

  function renderFilaProducto(p: Producto) {
    const dias = diasHastaVencimiento(p.fecha_vencimiento)
    const vencido = productoVencido(p.fecha_vencimiento)
    const bajo = stockBajo(p.stock, p.stock_minimo)

    return (
      <tr key={p.id} className="hover:bg-slate-50">
        <td className="px-4 py-3">
          <div className="flex items-center gap-3">
            <ProductoThumbnail producto={p} />
            <div>
              <p className="font-medium text-slate-900">{p.nombre}</p>
              <p className="text-xs text-slate-400">
                {p.categorias?.nombre ?? 'Sin categoría'}
                {p.codigo_barra && ` · ${p.codigo_barra}`}
              </p>
            </div>
          </div>
        </td>
        <td className="px-4 py-3">
          <span className={bajo ? 'font-semibold text-amber-600' : 'text-slate-700'}>
            {p.stock} {p.unidad}
          </span>
          {bajo && <AlertTriangle className="ml-1 inline h-4 w-4 text-amber-500" />}
        </td>
        <td className="px-4 py-3 font-medium text-slate-900">{formatMoney(p.precio_venta)}</td>
        {canSeeFinancials && (
          <td className="px-4 py-3 text-slate-600">{formatMoney(p.costo)}</td>
        )}
        <td className="px-4 py-3">
          {p.fecha_vencimiento ? (
            <span
              className={
                vencido
                  ? 'text-red-600'
                  : dias !== null && dias <= 15
                    ? 'text-orange-600'
                    : 'text-slate-600'
              }
            >
              {formatDate(p.fecha_vencimiento)}
              {dias !== null && dias <= 15 && <Clock className="ml-1 inline h-3.5 w-3.5" />}
            </span>
          ) : (
            '—'
          )}
        </td>
        <td className="px-4 py-3">
          <EstadoProducto producto={p} />
        </td>
        <td className="px-4 py-3">
          <button
            onClick={() => openEdit(p)}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-teal-600"
          >
            <Pencil className="h-4 w-4" />
          </button>
        </td>
      </tr>
    )
  }

  function renderCardProducto(p: Producto) {
    const bajo = stockBajo(p.stock, p.stock_minimo)
    const dias = diasHastaVencimiento(p.fecha_vencimiento)
    const vencido = productoVencido(p.fecha_vencimiento)

    return (
      <div
        key={p.id}
        className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm"
      >
        <ProductoThumbnail producto={p} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium text-slate-900">{p.nombre}</p>
          <p className="text-sm font-semibold text-teal-700">{formatMoney(p.precio_venta)}</p>
          <p className="text-xs text-slate-500">
            <span className={bajo ? 'font-semibold text-amber-600' : ''}>
              {p.stock} {p.unidad}
            </span>
            {' · '}
            {p.categorias?.nombre ?? 'Sin categoría'}
          </p>
          {p.fecha_vencimiento && (
            <p
              className={`text-xs ${
                vencido ? 'text-red-600' : dias !== null && dias <= 15 ? 'text-orange-600' : 'text-slate-400'
              }`}
            >
              Vence: {formatDate(p.fecha_vencimiento)}
            </p>
          )}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          <EstadoProducto producto={p} />
          <button
            onClick={() => openEdit(p)}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-teal-600"
          >
            <Pencil className="h-4 w-4" />
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Productos</h1>
          <p className="text-slate-500">{productos.length} productos registrados</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={openCatModal}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 font-medium text-slate-700 hover:bg-slate-50"
          >
            <Tags className="h-5 w-5" />
            Categorías
          </button>
          <button
            onClick={openNew}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-teal-600 px-4 py-2.5 font-medium text-white hover:bg-teal-700"
          >
            <Plus className="h-5 w-5" />
            Nuevo producto
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            placeholder="Buscar por nombre o código de barras…"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-white py-3 pl-10 pr-4 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
          />
        </div>
        <select
          value={filtroCategoria}
          onChange={(e) => setFiltroCategoria(e.target.value)}
          className="rounded-lg border border-slate-300 bg-white px-3 py-3 text-sm outline-none focus:border-teal-500 sm:w-52"
        >
          <option value="">Todas las categorías</option>
          {categorias.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
        </div>
      ) : productos.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white py-16 text-center">
          <Package className="mx-auto h-12 w-12 text-slate-300" />
          <p className="mt-4 font-medium text-slate-600">No hay productos</p>
          <p className="text-sm text-slate-400">Registra tu primer producto para empezar</p>
        </div>
      ) : filtrados.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white py-16 text-center">
          <Search className="mx-auto h-12 w-12 text-slate-300" />
          <p className="mt-4 font-medium text-slate-600">Sin coincidencias</p>
          <p className="text-sm text-slate-400">
            Prueba otro nombre, código o categoría
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-slate-500">
            {filtrados.length === productos.length
              ? `${productos.length} productos`
              : `${filtrados.length} de ${productos.length} productos`}
            {filtrados.length > PAGE_SIZE &&
              ` · mostrando ${desde}–${hasta}`}
          </p>

          <div className="space-y-2 md:hidden">{paginados.map(renderCardProducto)}</div>

          <div className="hidden overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm md:block">
            <div className="max-h-[calc(100vh-22rem)] overflow-y-auto overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-10 border-b border-slate-100 bg-slate-50 text-left text-slate-600">
                  <tr>
                    <th className="px-4 py-3 font-medium">Producto</th>
                    <th className="px-4 py-3 font-medium">Stock</th>
                    <th className="px-4 py-3 font-medium">Precio venta</th>
                    {canSeeFinancials && <th className="px-4 py-3 font-medium">Costo</th>}
                    <th className="px-4 py-3 font-medium">Vencimiento</th>
                    <th className="px-4 py-3 font-medium">Estado</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginados.map(renderFilaProducto)}
                </tbody>
              </table>
            </div>
          </div>

          {filtrados.length > PAGE_SIZE && (
            <div className="flex flex-col items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm sm:flex-row">
              <p className="text-sm text-slate-600">
                Página {paginaActual} de {totalPaginas}
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setPagina((p) => Math.max(1, p - 1))}
                  disabled={paginaActual <= 1}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Anterior
                </button>
                <button
                  type="button"
                  onClick={() => setPagina((p) => Math.min(totalPaginas, p + 1))}
                  disabled={paginaActual >= totalPaginas}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Siguiente
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900">
                {editId ? 'Editar producto' : 'Nuevo producto'}
              </h2>
              <button onClick={() => setModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2 sm:col-span-1">
                  <label className="mb-1 block text-sm font-medium text-slate-700">Nombre *</label>
                  <input
                    value={form.nombre}
                    onChange={(e) => updateForm('nombre', e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-teal-500"
                  />
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <label className="mb-1 block text-sm font-medium text-slate-700">Código de barras</label>
                  <div className="flex gap-2">
                    <input
                      value={form.codigo_barra}
                      onChange={(e) => updateForm('codigo_barra', e.target.value)}
                      className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-teal-500"
                      placeholder="Escanea o escribe"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCameraScanner(true)}
                      className="flex shrink-0 items-center justify-center rounded-lg border border-slate-300 px-3 text-teal-700 hover:bg-teal-50"
                      title="Escanear con cámara"
                    >
                      <Camera className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Categoría</label>
                  <select
                    value={form.categoria_id}
                    onChange={(e) => updateForm('categoria_id', e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-teal-500"
                  >
                    <option value="">Sin categoría</option>
                    {categorias.map((c) => (
                      <option key={c.id} value={c.id}>{c.nombre}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Unidad</label>
                  <select
                    value={form.unidad}
                    onChange={(e) => updateForm('unidad', e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-teal-500"
                  >
                    <option value="unidad">Unidad</option>
                    <option value="kg">Kg</option>
                    <option value="litro">Litro</option>
                    <option value="paquete">Paquete</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    {form.unidad === 'kg' || form.unidad === 'litro' ? 'Costo por kg/L (S/)' : 'Costo (S/)'}
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.costo}
                    onChange={(e) => updateForm('costo', e.target.value)}
                    placeholder="Ej: 3.50"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-teal-500 placeholder:text-slate-400"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Margen %</label>
                  <input
                    type="number"
                    min="0"
                    max="99"
                    step="0.1"
                    value={form.margen_pct}
                    onChange={(e) => updateForm('margen_pct', e.target.value)}
                    placeholder="Ej: 25"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-teal-500 placeholder:text-slate-400"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    {form.unidad === 'kg' || form.unidad === 'litro' ? 'Precio por kg/L' : 'Precio venta'}
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.precio_venta}
                    onChange={(e) => updateForm('precio_venta', e.target.value)}
                    placeholder="Se calcula solo"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 font-semibold outline-none focus:border-teal-500 placeholder:font-normal placeholder:text-slate-400"
                  />
                </div>
              </div>

              {form.unidad === 'kg' && (
                <div className="rounded-lg border border-teal-200 bg-teal-50/50 p-4 space-y-3">
                  <p className="text-sm font-medium text-teal-900">Venta mixta (ej. tomate)</p>
                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={form.permite_venta_unidad}
                      onChange={(e) => updateForm('permite_venta_unidad', e.target.checked)}
                      className="rounded border-slate-300"
                    />
                    También se vende por unidad suelta (precio fijo por pieza)
                  </label>
                  {form.permite_venta_unidad && (
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="mb-1 block text-xs font-medium text-slate-600">
                          Precio por unidad (S/)
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={form.precio_por_unidad}
                          onChange={(e) => updateForm('precio_por_unidad', e.target.value)}
                          placeholder="Ej: 1.00"
                          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-teal-500"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium text-slate-600">
                          Peso estimado por unidad (kg)
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="0.001"
                          value={form.peso_estimado_unidad}
                          onChange={(e) => updateForm('peso_estimado_unidad', e.target.value)}
                          placeholder="Ej: 0.125"
                          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-teal-500"
                        />
                      </div>
                    </div>
                  )}
                  <p className="text-xs text-teal-700">
                    En POS: por peso (balanza) o por unidad. El stock siempre se descuenta en kg.
                  </p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Stock inicial</label>
                  <input
                    type="number"
                    min="0"
                    step="0.001"
                    value={form.stock}
                    onChange={(e) => updateForm('stock', e.target.value)}
                    placeholder="Ej: 20"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-teal-500 placeholder:text-slate-400"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Stock mínimo</label>
                  <input
                    type="number"
                    min="0"
                    step="0.001"
                    value={form.stock_minimo}
                    onChange={(e) => updateForm('stock_minimo', e.target.value)}
                    placeholder="Ej: 5"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-teal-500 placeholder:text-slate-400"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Fecha de vencimiento</label>
                <input
                  type="date"
                  value={form.fecha_vencimiento}
                  onChange={(e) => updateForm('fecha_vencimiento', e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-teal-500"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Imagen</label>
                <div className="flex items-center gap-3">
                  {form.imagen_url && (
                    <img src={getOptimizedImageUrl(form.imagen_url, 64)} alt="" className="h-16 w-16 rounded-lg object-cover" />
                  )}
                  <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-slate-300 px-4 py-3 text-sm text-slate-600 hover:border-teal-400 hover:text-teal-600">
                    {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                    {uploading ? 'Subiendo…' : 'Subir a Cloudinary'}
                    <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} disabled={uploading} />
                  </label>
                </div>
              </div>

              {error && <p className="text-sm text-red-600">{error}</p>}

              <button
                onClick={handleSave}
                disabled={saving}
                className="w-full rounded-lg bg-teal-600 py-3 font-semibold text-white hover:bg-teal-700 disabled:opacity-60"
              >
                {saving ? 'Guardando…' : editId ? 'Actualizar' : 'Registrar producto'}
              </button>
            </div>
          </div>
        </div>
      )}

      {catModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center">
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900">Categorías</h2>
              <button onClick={() => setCatModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="mb-4 text-sm text-slate-500">
              Crea categorías como Licores, Fiambres, etc. El margen % se aplica al registrar productos nuevos.
            </p>

            <div className="mb-4 space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs font-medium text-slate-600">
                {catEditId ? 'Editar categoría' : 'Nueva categoría'}
              </p>
              <input
                value={catNombre}
                onChange={(e) => setCatNombre(e.target.value)}
                placeholder="Nombre (ej: Licores)"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-teal-500"
              />
              <div className="flex gap-2">
                <input
                  type="number"
                  min="0"
                  max="99"
                  step="0.1"
                  value={catMargen}
                  onChange={(e) => setCatMargen(e.target.value)}
                  placeholder="Margen %"
                  className="w-28 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-teal-500"
                />
                <button
                  onClick={handleGuardarCategoria}
                  disabled={catSaving}
                  className="flex-1 rounded-lg bg-teal-600 py-2 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50"
                >
                  {catSaving ? 'Guardando…' : catEditId ? 'Actualizar' : 'Agregar'}
                </button>
                {catEditId && (
                  <button
                    onClick={() => {
                      setCatEditId(null)
                      setCatNombre('')
                      setCatMargen('25')
                    }}
                    className="rounded-lg border border-slate-200 px-3 text-sm text-slate-600"
                  >
                    Cancelar
                  </button>
                )}
              </div>
            </div>

            {catError && <p className="mb-3 text-sm text-red-600">{catError}</p>}

            <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
              {categorias.map((c) => (
                <li key={c.id} className="flex items-center justify-between px-3 py-2.5">
                  <div>
                    <p className="font-medium text-slate-900">{c.nombre}</p>
                    <p className="text-xs text-slate-500">Margen {c.margen_default}%</p>
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => startEditCategoria(c)}
                      className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-teal-600"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleEliminarCategoria(c.id)}
                      className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
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
    </div>
  )
}
