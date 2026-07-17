import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Layers,
  Loader2,
  AlertCircle,
  ArrowUp,
  Package,
} from 'lucide-react'
import { formatDate } from '@/lib/utils'
import {
  fetchLotesActivos,
  agruparLotesPorProducto,
  type LotePorProducto,
} from '@/lib/lotes'

export function LotesPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const filtroPorVencer = searchParams.get('filtro') === 'por_vencer'
  const [grupos, setGrupos] = useState<LotePorProducto[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [soloPorVencer, setSoloPorVencer] = useState(filtroPorVencer)

  useEffect(() => {
    if (filtroPorVencer) setSoloPorVencer(true)
  }, [filtroPorVencer])

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const lotes = await fetchLotesActivos()
      let g = agruparLotesPorProducto(lotes)
      if (soloPorVencer) {
        g = g
          .map((gr) => ({
            ...gr,
            lotes: gr.lotes.filter(
              (l) => l.vencido || (l.dias !== null && l.dias <= 15),
            ),
          }))
          .filter((gr) => gr.lotes.length > 0)
      }
      setGrupos(g)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar lotes')
    } finally {
      setLoading(false)
    }
  }, [soloPorVencer])

  useEffect(() => {
    load()
  }, [load])

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Lotes por vencer</h1>
        <p className="text-slate-500">
          Cuántas unidades hay de cada fecha · pon al frente el lote marcado (vence primero)
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={soloPorVencer}
            onChange={(e) => {
              setSoloPorVencer(e.target.checked)
              if (e.target.checked) setSearchParams({ filtro: 'por_vencer' })
              else setSearchParams({})
            }}
            className="rounded border-slate-300"
          />
          Solo vencidos o próximos 15 días
        </label>
        {filtroPorVencer && (
          <span className="rounded-full bg-orange-100 px-2.5 py-0.5 text-xs font-medium text-orange-800">
            Filtro desde dashboard
          </span>
        )}
        <p className="text-xs text-slate-400">
          Al vender, el sistema descuenta solo del lote que vence antes (FEFO)
        </p>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
        </div>
      ) : grupos.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white py-16 text-center">
          <Layers className="mx-auto h-12 w-12 text-slate-300" />
          <p className="mt-4 font-medium text-slate-600">No hay lotes activos</p>
          <p className="text-sm text-slate-400">
            Al comprar con fecha de vencimiento del lote aparecerán aquí
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {grupos.map((g) => (
            <div
              key={g.producto_id}
              className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
            >
              <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-5 py-3">
                <div className="flex items-center gap-2">
                  <Package className="h-5 w-5 text-teal-600" />
                  <h2 className="font-semibold text-slate-900">{g.nombre}</h2>
                </div>
                <span className="text-sm font-medium text-slate-600">
                  Total: {g.total} {g.unidad}
                </span>
              </div>
              <ul className="divide-y divide-slate-100">
                {g.lotes.map((l) => (
                  <li
                    key={l.id}
                    className={`flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-center sm:justify-between ${
                      l.poner_al_frente ? 'bg-teal-50/60' : ''
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {l.poner_al_frente && (
                        <span className="mt-0.5 flex items-center gap-1 rounded-full bg-teal-600 px-2 py-0.5 text-xs font-semibold text-white">
                          <ArrowUp className="h-3 w-3" />
                          Al frente
                        </span>
                      )}
                      <div>
                        <p className="font-bold text-slate-900">
                          {l.cantidad} {g.unidad}
                        </p>
                        <p className="text-sm text-slate-600">
                          {l.fecha_vencimiento
                            ? `Vence ${formatDate(l.fecha_vencimiento)}`
                            : 'Sin fecha de vencimiento'}
                        </p>
                      </div>
                    </div>
                    <div className="text-right text-sm">
                      {l.vencido ? (
                        <span className="font-semibold text-red-600">Vencido</span>
                      ) : l.dias !== null && l.dias <= 15 ? (
                        <span className="font-semibold text-amber-700">
                          {l.dias === 0 ? 'Vence hoy' : `${l.dias} día${l.dias === 1 ? '' : 's'}`}
                        </span>
                      ) : l.dias !== null ? (
                        <span className="text-slate-500">{l.dias} días</span>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
        <p className="font-medium text-slate-800">Ejemplo: Leche</p>
        <p className="mt-1">
          · 3 und — vence 20/07 → <strong>poner al frente</strong> en el anaquel
          <br />
          · 6 und — vence 05/08 → dejar atrás
          <br />
          Al vender, el POS descuenta primero de las 3 und.
        </p>
      </div>
    </div>
  )
}
