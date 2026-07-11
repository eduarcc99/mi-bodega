import { useEffect, useState } from 'react'
import {
  Wallet,
  Plus,
  Minus,
  ArrowDownCircle,
  ArrowUpCircle,
  Loader2,
  Trash2,
  CheckCircle,
  AlertCircle,
  Smartphone,
  Banknote,
  Calculator,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { formatMoney, todayLocalISO } from '@/lib/utils'
import {
  CATEGORIAS_GASTO,
  fetchResumenCaja,
  registrarGasto,
  eliminarGasto,
  cerrarCaja,
  type ResumenCajaDia,
} from '@/lib/caja'

export function CierreCajaPage() {
  const { perfil } = useAuth()
  const [resumen, setResumen] = useState<ResumenCajaDia | null>(null)
  const [loading, setLoading] = useState(true)
  const [fechaCaja, setFechaCaja] = useState(todayLocalISO())
  const [efectivoInicialManual, setEfectivoInicialManual] = useState<string>('')
  const [efectivoDeclarado, setEfectivoDeclarado] = useState('')
  const [notas, setNotas] = useState('')
  const [cerrando, setCerrando] = useState(false)
  const [mensaje, setMensaje] = useState('')
  const [error, setError] = useState('')

  const [showGasto, setShowGasto] = useState(false)
  const [gastoDesc, setGastoDesc] = useState('')
  const [gastoMonto, setGastoMonto] = useState('')
  const [gastoCat, setGastoCat] = useState('compra_mercaderia')

  async function load(fecha = fechaCaja) {
    setLoading(true)
    try {
      const data = await fetchResumenCaja(fecha)
      setResumen(data)
      if (!efectivoInicialManual && data.efectivoInicial > 0) {
        setEfectivoInicialManual(String(data.efectivoInicial))
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar caja')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load(fechaCaja)
  }, [fechaCaja])

  const efectivoInicial = parseFloat(efectivoInicialManual) || resumen?.efectivoInicial || 0
  const ventasEfectivo = resumen?.ventasEfectivo ?? 0
  const ventasYape = resumen?.ventasYape ?? 0
  const totalGastos = resumen?.totalGastos ?? 0
  const devolucionesEfectivo = resumen?.movimientos
    .filter((m) => m.tipo === 'devolucion' && m.afectaCaja)
    .reduce((s, m) => s + m.monto, 0) ?? 0
  const efectivoEsperado = Math.round((efectivoInicial + ventasEfectivo - totalGastos - devolucionesEfectivo) * 100) / 100
  const declarado = parseFloat(efectivoDeclarado) || 0
  const diferencia = Math.round((declarado - efectivoEsperado) * 100) / 100

  async function handleGasto() {
    if (!perfil) return
    const monto = parseFloat(gastoMonto)
    if (!gastoDesc.trim() || isNaN(monto) || monto <= 0) {
      setError('Ingresa descripción y monto válido')
      return
    }
    setError('')
    try {
      await registrarGasto({
        descripcion: gastoDesc.trim(),
        monto,
        categoria: gastoCat,
        registrado_por: perfil.id,
      })
      setShowGasto(false)
      setGastoDesc('')
      setGastoMonto('')
      setMensaje('Gasto registrado — ya se descontó del efectivo esperado')
      load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al registrar gasto')
    }
  }

  async function handleCierre() {
    if (!perfil || !resumen) return
    if (declarado <= 0) {
      setError('Cuenta el efectivo que tienes en caja e ingrésalo')
      return
    }
    setCerrando(true)
    setError('')
    try {
      await cerrarCaja({
        cajero_id: perfil.id,
        fecha: resumen.fecha,
        efectivo_inicial: efectivoInicial,
        ventas_efectivo: ventasEfectivo,
        ventas_yape: ventasYape,
        ventas_otros: resumen.ventasOtros,
        total_gastos: totalGastos,
        efectivo_esperado: efectivoEsperado,
        efectivo_declarado: declarado,
        notas,
      })
      setMensaje('Cierre de caja guardado correctamente')
      load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cerrar caja')
    } finally {
      setCerrando(false)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Mi caja del día</h1>
          <p className="text-slate-500">
            Aquí ves en simple dónde entró y salió tu plata — como cuando cuentas el efectivo a mano.
          </p>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Fecha</label>
          <input
            type="date"
            value={fechaCaja}
            max={todayLocalISO()}
            onChange={(e) => {
              setEfectivoInicialManual('')
              setEfectivoDeclarado('')
              setFechaCaja(e.target.value)
            }}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-500"
          />
        </div>
      </div>

      {/* Explicación tipo dueña */}
      <div className="rounded-xl border-2 border-teal-200 bg-teal-50 p-5">
        <h2 className="mb-4 flex items-center gap-2 font-bold text-teal-900">
          <Calculator className="h-5 w-5" />
          ¿Cuánto debería haber en caja?
        </h2>
        <div className="space-y-2 text-sm">
          <FilaCalculo
            icon={<Banknote className="h-4 w-4 text-slate-500" />}
            label="Efectivo con el que abriste hoy"
            valor={efectivoInicial}
            editable
            editValue={efectivoInicialManual}
            onEdit={setEfectivoInicialManual}
            hint="Lo que tenías ayer al cerrar (ej. S/ 100)"
          />
          <FilaCalculo
            icon={<Plus className="h-4 w-4 text-emerald-600" />}
            label="Ventas en efectivo hoy"
            valor={ventasEfectivo}
            positivo
          />
          <FilaCalculo
            icon={<Minus className="h-4 w-4 text-red-500" />}
            label="Gastos en efectivo hoy"
            valor={totalGastos}
            negativo
          />
          {devolucionesEfectivo > 0 && (
            <FilaCalculo
              icon={<Minus className="h-4 w-4 text-orange-500" />}
              label="Devoluciones en efectivo"
              valor={devolucionesEfectivo}
              negativo
            />
          )}
          <div className="my-2 border-t border-teal-300" />
          <FilaCalculo
            icon={<Wallet className="h-4 w-4 text-teal-700" />}
            label="Deberías tener en caja"
            valor={efectivoEsperado}
            destacado
          />
        </div>

        {ventasYape > 0 && (
          <p className="mt-3 flex items-center gap-2 text-xs text-teal-700">
            <Smartphone className="h-4 w-4" />
            Yape hoy: {formatMoney(ventasYape)} — va a tu celular, no a la caja física
          </p>
        )}
      </div>

      {/* Registrar gasto */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-slate-900">Gastos del día</h2>
          <button
            onClick={() => setShowGasto(true)}
            className="flex items-center gap-1 rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-100"
          >
            <Minus className="h-4 w-4" />
            Anotar gasto
          </button>
        </div>
        <p className="mt-1 text-xs text-slate-500">
          Ej: compraste pollo S/ 20 — anótalo aquí para que cuadre la caja
        </p>

        {resumen?.gastos.length === 0 ? (
          <p className="mt-4 text-sm text-slate-400">No hay gastos registrados hoy</p>
        ) : (
          <ul className="mt-3 divide-y divide-slate-100">
            {resumen?.gastos.map((g) => (
              <li key={g.id} className="flex items-center justify-between py-2">
                <div>
                  <p className="text-sm font-medium text-slate-800">{g.descripcion}</p>
                  <p className="text-xs text-slate-400">
                    {CATEGORIAS_GASTO.find((c) => c.id === g.categoria)?.label ?? g.categoria}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-red-600">−{formatMoney(Number(g.monto))}</span>
                  <button
                    onClick={async () => {
                      await eliminarGasto(g.id)
                      load()
                    }}
                    className="text-slate-300 hover:text-red-500"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Movimientos del día */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-3 font-semibold text-slate-900">Movimientos de hoy</h2>
        <div className="space-y-2">
          {resumen?.movimientos.map((m) => (
            <div
              key={m.id}
              className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm ${
                !m.afectaCaja ? 'bg-purple-50 text-purple-800' : m.esEntrada ? 'bg-emerald-50' : 'bg-red-50'
              }`}
            >
              <div className="flex items-center gap-2">
                {m.esEntrada ? (
                  <ArrowUpCircle className={`h-4 w-4 ${m.afectaCaja ? 'text-emerald-600' : 'text-purple-500'}`} />
                ) : (
                  <ArrowDownCircle className="h-4 w-4 text-red-500" />
                )}
                <div>
                  <p>{m.descripcion}</p>
                  {!m.afectaCaja && <p className="text-xs opacity-70">No suma al efectivo físico</p>}
                </div>
              </div>
              <div className="text-right">
                <p className="font-semibold">
                  {m.esEntrada ? '+' : '−'}{formatMoney(m.monto)}
                </p>
                {m.hora && <p className="text-xs opacity-60">{m.hora}</p>}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Cierre */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 font-semibold text-slate-900">Cerrar caja — conteo final</h2>

        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              ¿Cuánto efectivo tienes en mano? (cuenta billetes y monedas)
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={efectivoDeclarado}
              onChange={(e) => setEfectivoDeclarado(e.target.value)}
              placeholder="Ej: 107.00"
              className="w-full rounded-lg border border-slate-300 px-4 py-3 text-lg font-semibold outline-none focus:border-teal-500"
            />
          </div>

          {declarado > 0 && (
            <div
              className={`rounded-lg p-4 ${
                diferencia === 0
                  ? 'bg-emerald-50 text-emerald-800'
                  : diferencia < 0
                    ? 'bg-red-50 text-red-800'
                    : 'bg-amber-50 text-amber-800'
              }`}
            >
              <p className="font-bold text-lg">
                {diferencia === 0 && '¡Cuadra perfecto!'}
                {diferencia < 0 && `Faltan ${formatMoney(Math.abs(diferencia))}`}
                {diferencia > 0 && `Sobran ${formatMoney(diferencia)}`}
              </p>
              <p className="mt-1 text-sm">
                Esperabas {formatMoney(efectivoEsperado)} · Contaste {formatMoney(declarado)}
              </p>
              {diferencia < 0 && (
                <p className="mt-2 text-xs">
                  Revisa: ¿olvidaste anotar algún gasto? ¿alguna venta fue Yape y no efectivo?
                  ¿diste vuelto de más?
                </p>
              )}
            </div>
          )}

          <textarea
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
            placeholder="Notas (ej: compré pollo pero lo vendí, faltante por vuelto mal dado…)"
            rows={2}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-500"
          />

          <button
            onClick={handleCierre}
            disabled={cerrando || declarado <= 0}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-teal-600 py-3.5 font-semibold text-white hover:bg-teal-700 disabled:opacity-50"
          >
            {cerrando ? <Loader2 className="h-5 w-5 animate-spin" /> : <CheckCircle className="h-5 w-5" />}
            Guardar cierre del día
          </button>
        </div>

        {resumen?.cierreExistente && (
          <p className="mt-3 flex items-center gap-2 text-sm text-emerald-600">
            <CheckCircle className="h-4 w-4" />
            Ya cerraste caja hoy — puedes actualizar el conteo
          </p>
        )}
      </div>

      {mensaje && (
        <div className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{mensaje}</div>
      )}
      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}

      {showGasto && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="mb-1 font-bold text-slate-900">Anotar gasto</h3>
            <p className="mb-4 text-sm text-slate-500">Ej: Compra pollo en mercado</p>
            <div className="space-y-3">
              <input
                value={gastoDesc}
                onChange={(e) => setGastoDesc(e.target.value)}
                placeholder="Descripción (ej: Compra pollo)"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-teal-500"
                autoFocus
              />
              <input
                type="number"
                step="0.01"
                min="0"
                value={gastoMonto}
                onChange={(e) => setGastoMonto(e.target.value)}
                placeholder="Monto S/"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-teal-500"
              />
              <select
                value={gastoCat}
                onChange={(e) => setGastoCat(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none"
              >
                {CATEGORIAS_GASTO.map((c) => (
                  <option key={c.id} value={c.id}>{c.label}</option>
                ))}
              </select>
              <div className="flex gap-2">
                <button onClick={() => setShowGasto(false)} className="flex-1 rounded-lg border py-2.5 text-slate-600">
                  Cancelar
                </button>
                <button onClick={handleGasto} className="flex-1 rounded-lg bg-red-600 py-2.5 font-semibold text-white">
                  Registrar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function FilaCalculo({
  icon,
  label,
  valor,
  positivo,
  negativo,
  destacado,
  editable,
  editValue,
  onEdit,
  hint,
}: {
  icon: React.ReactNode
  label: string
  valor: number
  positivo?: boolean
  negativo?: boolean
  destacado?: boolean
  editable?: boolean
  editValue?: string
  onEdit?: (v: string) => void
  hint?: string
}) {
  return (
    <div className={`flex items-center justify-between ${destacado ? 'text-base font-bold text-teal-900' : ''}`}>
      <div className="flex items-center gap-2">
        {icon}
        <div>
          <span>{label}</span>
          {hint && <p className="text-xs font-normal text-teal-600">{hint}</p>}
        </div>
      </div>
      {editable && onEdit ? (
        <input
          type="number"
          step="0.01"
          min="0"
          value={editValue ?? ''}
          onChange={(e) => onEdit(e.target.value)}
          className="w-28 rounded-lg border border-teal-300 bg-white px-2 py-1 text-right font-semibold outline-none"
        />
      ) : (
        <span className={positivo ? 'text-emerald-700' : negativo ? 'text-red-600' : ''}>
          {negativo && valor > 0 ? '−' : positivo && valor > 0 ? '+' : ''}
          {formatMoney(valor)}
        </span>
      )}
    </div>
  )
}
