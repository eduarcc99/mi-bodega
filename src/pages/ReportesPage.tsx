import { useState } from 'react'
import {
  FileText,
  FileSpreadsheet,
  Download,
  Loader2,
  Eye,
  ShoppingCart,
  Truck,
  Package,
  Clock,
  Wallet,
} from 'lucide-react'
import {
  REPORTES_DISPONIBLES,
  cargarReporte,
  fetchReporteVentasPorProducto,
  type TipoReporte,
  type ReporteData,
} from '@/lib/reportes'
import { exportarPDF, exportarExcel } from '@/lib/export'
import { formatMoney, todayLocalISO } from '@/lib/utils'

const iconos: Record<TipoReporte, typeof FileText> = {
  ventas: ShoppingCart,
  compras: Truck,
  inventario: Package,
  vencimientos: Clock,
  cierres: Wallet,
}

function defaultDesde(): string {
  const d = new Date()
  d.setDate(d.getDate() - 30)
  return todayLocalISO(d)
}

function defaultHasta(): string {
  return todayLocalISO()
}

export function ReportesPage() {
  const [tipo, setTipo] = useState<TipoReporte>('ventas')
  const [desde, setDesde] = useState(defaultDesde())
  const [hasta, setHasta] = useState(defaultHasta())
  const [reporte, setReporte] = useState<ReporteData | null>(null)
  const [loading, setLoading] = useState(false)
  const [exporting, setExporting] = useState<'pdf' | 'excel' | null>(null)
  const [error, setError] = useState('')
  const [incluirProductos, setIncluirProductos] = useState(false)

  const config = REPORTES_DISPONIBLES.find((r) => r.id === tipo)!

  async function handleVistaPrevia() {
    setLoading(true)
    setError('')
    try {
      const data = await cargarReporte(tipo, desde, hasta)
      setReporte(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar reporte')
      setReporte(null)
    } finally {
      setLoading(false)
    }
  }

  async function handleExportPDF() {
    setExporting('pdf')
    setError('')
    try {
      const data = reporte ?? (await cargarReporte(tipo, desde, hasta))
      exportarPDF(data)
      if (incluirProductos && tipo === 'ventas') {
        const prod = await fetchReporteVentasPorProducto(desde, hasta)
        exportarPDF(prod)
      }
      if (!reporte) setReporte(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al exportar PDF')
    } finally {
      setExporting(null)
    }
  }

  async function handleExportExcel() {
    setExporting('excel')
    setError('')
    try {
      const data = reporte ?? (await cargarReporte(tipo, desde, hasta))
      await exportarExcel(data)
      if (incluirProductos && tipo === 'ventas') {
        const prod = await fetchReporteVentasPorProducto(desde, hasta)
        await exportarExcel(prod)
      }
      if (!reporte) setReporte(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al exportar Excel')
    } finally {
      setExporting(null)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Reportes</h1>
        <p className="text-slate-500">Exporta a PDF o Excel para imprimir o compartir</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {REPORTES_DISPONIBLES.map((r) => {
          const Icon = iconos[r.id]
          return (
            <button
              key={r.id}
              onClick={() => {
                setTipo(r.id)
                setReporte(null)
              }}
              className={`flex items-center gap-3 rounded-xl border p-4 text-left transition-colors ${
                tipo === r.id
                  ? 'border-teal-500 bg-teal-50 ring-2 ring-teal-500/20'
                  : 'border-slate-200 bg-white hover:border-teal-300'
              }`}
            >
              <div className={`rounded-lg p-2 ${tipo === r.id ? 'bg-teal-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                <Icon className="h-5 w-5" />
              </div>
              <span className="font-medium text-slate-900">{r.label}</span>
            </button>
          )
        })}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 font-semibold text-slate-900">{config.label}</h2>

        {config.requiereFechas && (
          <div className="mb-4 grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Desde</label>
              <input
                type="date"
                value={desde}
                onChange={(e) => setDesde(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-teal-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Hasta</label>
              <input
                type="date"
                value={hasta}
                onChange={(e) => setHasta(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-teal-500"
              />
            </div>
          </div>
        )}

        {tipo === 'ventas' && (
          <label className="mb-4 flex items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={incluirProductos}
              onChange={(e) => setIncluirProductos(e.target.checked)}
              className="rounded border-slate-300"
            />
            Incluir también reporte por producto (2 archivos)
          </label>
        )}

        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleVistaPrevia}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}
            Vista previa
          </button>
          <button
            onClick={handleExportPDF}
            disabled={exporting !== null}
            className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
          >
            {exporting === 'pdf' ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
            Descargar PDF
          </button>
          <button
            onClick={handleExportExcel}
            disabled={exporting !== null}
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            {exporting === 'excel' ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />}
            Descargar Excel
          </button>
        </div>

        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      </div>

      {reporte && (
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <div>
              <h3 className="font-semibold text-slate-900">{reporte.titulo}</h3>
              {reporte.totales?.label && (
                <p className="text-sm font-medium text-teal-700">{String(reporte.totales.label)}</p>
              )}
            </div>
            <Download className="h-5 w-5 text-slate-400" />
          </div>

          {reporte.filas.length === 0 ? (
            <p className="py-12 text-center text-sm text-slate-400">No hay datos en este período</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left text-slate-600">
                  <tr>
                    {reporte.columnas.map((col) => (
                      <th key={col.key} className="px-4 py-3 font-medium whitespace-nowrap">
                        {col.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {reporte.filas.slice(0, 100).map((fila, i) => (
                    <tr key={i} className="hover:bg-slate-50">
                      {reporte.columnas.map((col) => (
                        <td key={col.key} className="px-4 py-2.5 whitespace-nowrap text-slate-700">
                          {typeof fila[col.key] === 'number' &&
                          (col.key.includes('total') ||
                            col.key.includes('monto') ||
                            col.key.includes('costo') ||
                            col.key.includes('valor') ||
                            col.key.includes('precio') ||
                            col.key.includes('esperado') ||
                            col.key.includes('declarado') ||
                            col.key.includes('diferencia') ||
                            col.key.includes('gastos') ||
                            col.key.includes('efectivo') ||
                            col.key.includes('perdida'))
                            ? formatMoney(Number(fila[col.key]))
                            : String(fila[col.key] ?? '')}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {reporte.filas.length > 100 && (
                <p className="px-4 py-3 text-xs text-slate-400">
                  Mostrando 100 de {reporte.filas.length} — descarga PDF/Excel para ver todo
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
