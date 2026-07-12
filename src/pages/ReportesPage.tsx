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
import { fetchTicketDetalle, type TicketDetalle } from '@/lib/tickets'
import { VentaTicket } from '@/components/pos/VentaTicket'

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

function esColumnaDinero(key: string): boolean {
  return (
    key.includes('total') ||
    key.includes('monto') ||
    key.includes('costo') ||
    key.includes('valor') ||
    key.includes('precio') ||
    key.includes('esperado') ||
    key.includes('declarado') ||
    key.includes('diferencia') ||
    key.includes('gastos') ||
    key.includes('efectivo') ||
    key.includes('perdida')
  )
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
  const [ticketDetalle, setTicketDetalle] = useState<TicketDetalle | null>(null)
  const [abriendoTicket, setAbriendoTicket] = useState(false)

  const config = REPORTES_DISPONIBLES.find((r) => r.id === tipo)!

  async function abrirTicketDesdeReporte(ventaId: string) {
    if (!ventaId || String(ventaId).length < 8) return
    setAbriendoTicket(true)
    setError('')
    try {
      const t = await fetchTicketDetalle(String(ventaId))
      if (!t) {
        setError('No se encontró el ticket')
        return
      }
      setTicketDetalle(t)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al abrir ticket')
    } finally {
      setAbriendoTicket(false)
    }
  }

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
            <>
              {/* Móvil: cards (sin scroll horizontal) */}
              <div className="space-y-3 p-4 md:hidden">
                {reporte.filas.slice(0, 100).map((fila, i) => {
                  const puedeAbrir =
                    tipo === 'ventas' &&
                    fila.estado === 'Completada' &&
                    typeof fila.venta_id === 'string'
                  return (
                    <div
                      key={i}
                      role={puedeAbrir ? 'button' : undefined}
                      tabIndex={puedeAbrir ? 0 : undefined}
                      onClick={() => puedeAbrir && abrirTicketDesdeReporte(String(fila.venta_id))}
                      onKeyDown={(e) => {
                        if (puedeAbrir && (e.key === 'Enter' || e.key === ' ')) {
                          e.preventDefault()
                          abrirTicketDesdeReporte(String(fila.venta_id))
                        }
                      }}
                      className={`rounded-xl border border-slate-100 bg-slate-50/80 p-3 text-sm ${
                        puedeAbrir ? 'cursor-pointer hover:border-teal-300 hover:bg-teal-50/50' : ''
                      }`}
                    >
                      <div className="space-y-1.5">
                        {reporte.columnas.map((col) => {
                          const raw = fila[col.key]
                          const valor =
                            typeof raw === 'number' && esColumnaDinero(col.key)
                              ? formatMoney(Number(raw))
                              : String(raw ?? '—')
                          return (
                            <div key={col.key} className="flex items-start justify-between gap-3">
                              <span className="shrink-0 text-xs text-slate-500">{col.label}</span>
                              <span
                                className={`max-w-[60%] break-words text-right font-medium ${
                                  col.key === 'ticket' && puedeAbrir
                                    ? 'text-teal-700 underline'
                                    : 'text-slate-800'
                                }`}
                              >
                                {valor}
                              </span>
                            </div>
                          )
                        })}
                      </div>
                      {puedeAbrir && (
                        <p className="mt-2 text-center text-[10px] text-teal-600">
                          Toca para ver boleta / productos
                        </p>
                      )}
                    </div>
                  )
                })}
                {reporte.filas.length > 100 && (
                  <p className="text-xs text-slate-400">
                    Mostrando 100 de {reporte.filas.length} — descarga PDF/Excel para ver todo
                  </p>
                )}
              </div>

              {/* Desktop: tabla */}
              <div className="hidden overflow-x-auto md:block">
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
                    {reporte.filas.slice(0, 100).map((fila, i) => {
                      const puedeAbrir =
                        tipo === 'ventas' &&
                        fila.estado === 'Completada' &&
                        typeof fila.venta_id === 'string'
                      return (
                        <tr
                          key={i}
                          className={puedeAbrir ? 'cursor-pointer hover:bg-teal-50' : 'hover:bg-slate-50'}
                          onClick={() => puedeAbrir && abrirTicketDesdeReporte(String(fila.venta_id))}
                          title={puedeAbrir ? 'Ver boleta con productos' : undefined}
                        >
                          {reporte.columnas.map((col) => (
                            <td
                              key={col.key}
                              className={`px-4 py-2.5 whitespace-nowrap ${
                                col.key === 'ticket' && puedeAbrir
                                  ? 'font-medium text-teal-700 underline'
                                  : 'text-slate-700'
                              }`}
                            >
                              {typeof fila[col.key] === 'number' && esColumnaDinero(col.key)
                                ? formatMoney(Number(fila[col.key]))
                                : String(fila[col.key] ?? '')}
                            </td>
                          ))}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
                {reporte.filas.length > 100 && (
                  <p className="px-4 py-3 text-xs text-slate-400">
                    Mostrando 100 de {reporte.filas.length} — descarga PDF/Excel para ver todo
                  </p>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {abriendoTicket && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30">
          <Loader2 className="h-10 w-10 animate-spin text-white" />
        </div>
      )}

      {ticketDetalle && (
        <VentaTicket
          venta={ticketDetalle}
          cajeroNombre={ticketDetalle.cajero_nombre}
          onClose={() => setTicketDetalle(null)}
          historial
        />
      )}
    </div>
  )
}
