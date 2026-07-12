import { useEffect, useMemo, useState } from 'react'
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
  ShoppingBasket,
  Info,
  Pencil,
  FileDown,
  Lock,
  Unlock,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { formatMoney, todayLocalISO } from '@/lib/utils'
import {
  CATEGORIAS_GASTO,
  DENOMINACIONES,
  UMBRAL_DIFERENCIA,
  fetchResumenCaja,
  registrarGasto,
  eliminarGasto,
  cerrarCaja,
  abrirCaja,
  exportarCierrePDF,
  totalDesdeConteos,
  type ResumenCajaDia,
  type ConteosBilletes,
} from '@/lib/caja'

export function CierreCajaPage() {
  const { perfil } = useAuth()
  const [resumen, setResumen] = useState<ResumenCajaDia | null>(null)
  const [loading, setLoading] = useState(true)
  const [fechaCaja, setFechaCaja] = useState(todayLocalISO())
  const [editMode, setEditMode] = useState(false)

  const [aperturaMonto, setAperturaMonto] = useState('')
  const [abriendo, setAbriendo] = useState(false)

  const [efectivoDeclarado, setEfectivoDeclarado] = useState('')
  const [yapeDeclarado, setYapeDeclarado] = useState('')
  const [motivoDiferencia, setMotivoDiferencia] = useState('')
  const [notas, setNotas] = useState('')
  const [conteos, setConteos] = useState<ConteosBilletes>({})
  const [usarContador, setUsarContador] = useState(true)

  const [cerrando, setCerrando] = useState(false)
  const [mensaje, setMensaje] = useState('')
  const [error, setError] = useState('')

  const [showGasto, setShowGasto] = useState(false)
  const [gastoDesc, setGastoDesc] = useState('')
  const [gastoMonto, setGastoMonto] = useState('')
  const [gastoCat, setGastoCat] = useState('compra_mercaderia')

  const cajaCerrada = Boolean(resumen?.cierreExistente)
  const modoResumen = cajaCerrada && !editMode
  const necesitaAbrir = !resumen?.apertura && !cajaCerrada && fechaCaja === todayLocalISO()

  async function load(fecha = fechaCaja) {
    setLoading(true)
    setError('')
    try {
      const data = await fetchResumenCaja(fecha)
      setResumen(data)

      if (data.cierreExistente) {
        setEfectivoDeclarado(String(data.cierreExistente.efectivo_declarado))
        setYapeDeclarado(String(data.cierreExistente.yape_declarado))
        setMotivoDiferencia(data.cierreExistente.motivo_diferencia ?? '')
        setNotas(data.cierreExistente.notas ?? '')
        setEditMode(false)
      } else {
        setEfectivoDeclarado('')
        setYapeDeclarado('')
        setMotivoDiferencia('')
        setNotas('')
        setConteos({})
        setEditMode(false)
      }

      if (data.apertura) {
        setAperturaMonto(String(data.apertura.monto))
      } else if (data.efectivoInicial > 0) {
        setAperturaMonto(String(data.efectivoInicial))
      } else {
        setAperturaMonto('')
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

  const efectivoInicial = resumen?.efectivoInicial ?? 0
  const ventasEfectivo = resumen?.ventasEfectivo ?? 0
  const ventasYape = resumen?.ventasYape ?? 0
  const ventasOtros = resumen?.ventasOtros ?? 0
  const totalGastos = resumen?.totalGastos ?? 0
  const devolucionesEfectivo =
    resumen?.movimientos
      .filter((m) => m.tipo === 'devolucion' && m.afectaCaja)
      .reduce((s, m) => s + m.monto, 0) ?? 0
  const devolucionesYape = resumen?.devolucionesYape ?? 0
  const yapeEsperado = resumen?.yapeEsperado ?? 0
  const efectivoEsperado =
    Math.round((efectivoInicial + ventasEfectivo - totalGastos - devolucionesEfectivo) * 100) / 100

  const totalContador = useMemo(() => totalDesdeConteos(conteos), [conteos])

  useEffect(() => {
    if (usarContador && !modoResumen && totalContador > 0) {
      setEfectivoDeclarado(String(totalContador))
    }
  }, [totalContador, usarContador, modoResumen])

  const declarado = parseFloat(efectivoDeclarado) || 0
  const yapeContado = parseFloat(yapeDeclarado) || 0
  const diferencia = Math.round((declarado - efectivoEsperado) * 100) / 100
  const diferenciaYape = Math.round((yapeContado - yapeEsperado) * 100) / 100
  const requiereYape = yapeEsperado > 0
  const hayDiferencia =
    Math.abs(diferencia) >= UMBRAL_DIFERENCIA ||
    (requiereYape && Math.abs(diferenciaYape) >= UMBRAL_DIFERENCIA)
  const puedeCerrar =
    declarado > 0 &&
    (!requiereYape || yapeDeclarado.trim() !== '') &&
    (!hayDiferencia || motivoDiferencia.trim().length >= 3)

  async function handleAbrirCaja() {
    if (!perfil) return
    const monto = parseFloat(aperturaMonto)
    if (isNaN(monto) || monto < 0) {
      setError('Ingresa el efectivo con el que abres hoy')
      return
    }
    setAbriendo(true)
    setError('')
    try {
      await abrirCaja({ cajero_id: perfil.id, monto, fecha: fechaCaja })
      setMensaje('Caja abierta — ya puedes vender y anotar gastos')
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al abrir caja')
    } finally {
      setAbriendo(false)
    }
  }

  async function handleGasto() {
    if (!perfil || modoResumen) return
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
        fecha: fechaCaja,
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
    if (requiereYape && yapeDeclarado.trim() === '') {
      setError('Revisa tu app Yape e ingresa cuánto tienes hoy')
      return
    }
    if (hayDiferencia && motivoDiferencia.trim().length < 3) {
      setError('Indica el motivo de la diferencia (faltante o sobrante)')
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
        ventas_otros: ventasOtros,
        total_gastos: totalGastos,
        efectivo_esperado: efectivoEsperado,
        efectivo_declarado: declarado,
        yape_esperado: yapeEsperado,
        yape_declarado: requiereYape ? yapeContado : 0,
        motivo_diferencia: hayDiferencia ? motivoDiferencia.trim() : undefined,
        notas,
      })
      setMensaje('Cierre guardado — resumen del día listo')
      setEditMode(false)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cerrar caja')
    } finally {
      setCerrando(false)
    }
  }

  function handleExportPdf() {
    if (!resumen || !perfil) return
    exportarCierrePDF({
      resumen,
      cajeroNombre: perfil.nombre,
      efectivoDeclarado: declarado || Number(resumen.cierreExistente?.efectivo_declarado ?? 0),
      yapeDeclarado: yapeContado || Number(resumen.cierreExistente?.yape_declarado ?? 0),
      diferencia: resumen.cierreExistente?.diferencia ?? diferencia,
      diferenciaYape: resumen.cierreExistente?.diferencia_yape ?? diferenciaYape,
      motivoDiferencia: motivoDiferencia || resumen.cierreExistente?.motivo_diferencia || undefined,
      notas: notas || resumen.cierreExistente?.notas || undefined,
    })
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
            Abre en la mañana, anota gastos y cierra con conteo — Cajero: {perfil?.nombre}
          </p>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Fecha</label>
          <input
            type="date"
            value={fechaCaja}
            max={todayLocalISO()}
            onChange={(e) => {
              setFechaCaja(e.target.value)
              setMensaje('')
              setError('')
            }}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-500"
          />
        </div>
      </div>

      {mensaje && (
        <div className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{mensaje}</div>
      )}
      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {/* —— Apertura —— */}
      {necesitaAbrir && (
        <div className="rounded-xl border-2 border-teal-300 bg-teal-50 p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <Unlock className="h-6 w-6 text-teal-700" />
            <h2 className="text-lg font-bold text-teal-900">Abrir caja</h2>
          </div>
          <p className="mb-4 text-sm text-teal-800">
            Cuenta el efectivo con el que empiezas el día (billetes y monedas) y confírmalo.
            {resumen && resumen.efectivoInicial > 0 && !resumen.apertura && (
              <span className="mt-1 block text-xs">
                Sugerencia del cierre anterior: {formatMoney(resumen.efectivoInicial)}
              </span>
            )}
          </p>
          <input
            type="number"
            step="0.01"
            min="0"
            value={aperturaMonto}
            onChange={(e) => setAperturaMonto(e.target.value)}
            placeholder="Ej: 100.00"
            className="mb-4 w-full rounded-lg border border-teal-300 bg-white px-4 py-3 text-lg font-semibold outline-none focus:border-teal-500"
            autoFocus
          />
          <button
            onClick={handleAbrirCaja}
            disabled={abriendo}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-teal-600 py-3.5 font-semibold text-white hover:bg-teal-700 disabled:opacity-50"
          >
            {abriendo ? <Loader2 className="h-5 w-5 animate-spin" /> : <Unlock className="h-5 w-5" />}
            Abrir caja del día
          </button>
        </div>
      )}

      {/* —— Resumen bloqueado tras cierre —— */}
      {modoResumen && resumen?.cierreExistente && (
        <div className="rounded-xl border-2 border-emerald-300 bg-white p-6 shadow-sm">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-center gap-2">
              <Lock className="h-5 w-5 text-emerald-600" />
              <div>
                <h2 className="text-lg font-bold text-slate-900">Caja cerrada — resumen del día</h2>
                <p className="text-xs text-slate-500">
                  Guardado {new Date(resumen.cierreExistente.fecha_hora).toLocaleString('es-PE')} ·
                  solo lectura
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleExportPdf}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                <FileDown className="h-4 w-4" />
                PDF
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditMode(true)
                  setMensaje('Modo edición — puedes corregir el conteo y volver a guardar')
                }}
                className="inline-flex items-center gap-1.5 rounded-lg bg-teal-600 px-3 py-2 text-sm font-medium text-white hover:bg-teal-700"
              >
                <Pencil className="h-4 w-4" />
                Editar
              </button>
            </div>
          </div>

          <div className="mb-4 grid gap-3 sm:grid-cols-3">
            <MiniKpi label="Ventas del día" value={formatMoney(resumen.totalVentas)} />
            <MiniKpi label="Efectivo esperado" value={formatMoney(resumen.cierreExistente.efectivo_esperado)} />
            <MiniKpi label="Yape esperado" value={formatMoney(resumen.cierreExistente.yape_esperado)} />
          </div>

          <div className="space-y-2 text-sm">
            <ResumenLinea label="Apertura" value={formatMoney(efectivoInicial)} />
            <ResumenLinea label="Ventas efectivo" value={formatMoney(ventasEfectivo)} positivo />
            <ResumenLinea label="Ventas Yape" value={formatMoney(ventasYape)} />
            {ventasOtros > 0 && (
              <ResumenLinea label="Ventas otro método" value={formatMoney(ventasOtros)} />
            )}
            <ResumenLinea label="Gastos" value={formatMoney(totalGastos)} negativo />
            <div className="border-t border-slate-200 pt-2" />
            <ResumenLinea
              label="Efectivo contado"
              value={formatMoney(resumen.cierreExistente.efectivo_declarado)}
              bold
            />
            <ResumenLinea
              label="Diferencia efectivo"
              value={formatMoney(resumen.cierreExistente.diferencia)}
              alert={Math.abs(resumen.cierreExistente.diferencia) >= UMBRAL_DIFERENCIA}
            />
            <ResumenLinea
              label="Yape declarado"
              value={formatMoney(resumen.cierreExistente.yape_declarado)}
            />
            {Math.abs(resumen.cierreExistente.diferencia_yape) >= UMBRAL_DIFERENCIA && (
              <ResumenLinea
                label="Diferencia Yape"
                value={formatMoney(resumen.cierreExistente.diferencia_yape)}
                alert
              />
            )}
            {resumen.cierreExistente.motivo_diferencia && (
              <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-amber-900">
                <span className="font-medium">Motivo diferencia: </span>
                {resumen.cierreExistente.motivo_diferencia}
              </p>
            )}
            {resumen.cierreExistente.notas && (
              <p className="text-slate-600">
                <span className="font-medium">Notas: </span>
                {resumen.cierreExistente.notas}
              </p>
            )}
            {(resumen.consumoPropioCosto ?? 0) > 0 && (
              <p className="mt-2 flex items-start gap-2 text-orange-800">
                <ShoppingBasket className="mt-0.5 h-4 w-4 shrink-0" />
                Consumo propio: {formatMoney(resumen.consumoPropioCosto)} al costo (informativo)
              </p>
            )}
          </div>
        </div>
      )}

      {/* —— Día en curso / edición —— */}
      {!necesitaAbrir && !modoResumen && resumen && (
        <>
          {cajaCerrada && editMode && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              <span className="flex items-center gap-2">
                <Pencil className="h-4 w-4" />
                Editando cierre — al guardar vuelve al resumen
              </span>
              <button
                type="button"
                onClick={() => {
                  setEditMode(false)
                  load()
                }}
                className="font-medium underline"
              >
                Cancelar edición
              </button>
            </div>
          )}

          {/* G — 3 números rápidos */}
          <div className="grid gap-3 sm:grid-cols-3">
            <MiniKpi label="Ventas del día" value={formatMoney(resumen.totalVentas)} />
            <MiniKpi label="Efectivo esperado" value={formatMoney(efectivoEsperado)} accent />
            <MiniKpi label="Yape esperado" value={formatMoney(yapeEsperado)} />
          </div>

          {(resumen.consumoPropioCosto ?? 0) > 0 && (
            <div className="rounded-xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-900">
              <div className="flex items-start gap-2">
                <ShoppingBasket className="mt-0.5 h-4 w-4 shrink-0" />
                <div>
                  <p className="font-medium">
                    Consumo propio: {formatMoney(resumen.consumoPropioCosto)} (al costo)
                  </p>
                  <p className="mt-0.5 text-xs text-orange-800/80">
                    Dejó de ganar {formatMoney(resumen.consumoPropioOportunidad)} ·{' '}
                    <span className="inline-flex items-center gap-1">
                      <Info className="h-3 w-3" />
                      No se resta del efectivo
                    </span>
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="rounded-xl border-2 border-teal-200 bg-teal-50 p-5">
            <h2 className="mb-4 flex items-center gap-2 font-bold text-teal-900">
              <Calculator className="h-5 w-5" />
              ¿Cuánto debería haber en caja?
            </h2>
            <div className="space-y-2 text-sm">
              <FilaCalculo
                icon={<Banknote className="h-4 w-4 text-slate-500" />}
                label={resumen.apertura ? 'Apertura de caja' : 'Efectivo inicial'}
                valor={efectivoInicial}
                hint={
                  resumen.apertura
                    ? 'Confirmado al abrir en la mañana'
                    : 'Del cierre anterior (abre caja para fijarlo)'
                }
              />
              <FilaCalculo
                icon={<Plus className="h-4 w-4 text-emerald-600" />}
                label="Ventas en efectivo"
                valor={ventasEfectivo}
                positivo
              />
              {ventasOtros > 0 && (
                <FilaCalculo
                  icon={<Plus className="h-4 w-4 text-slate-500" />}
                  label="Ventas otro método"
                  valor={ventasOtros}
                  positivo
                />
              )}
              <FilaCalculo
                icon={<Minus className="h-4 w-4 text-red-500" />}
                label="Gastos en efectivo"
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
              {(ventasYape > 0 || devolucionesYape > 0) && (
                <>
                  <div className="my-2 border-t border-teal-300" />
                  <FilaCalculo
                    icon={<Smartphone className="h-4 w-4 text-purple-600" />}
                    label="Ventas Yape"
                    valor={ventasYape}
                    positivo
                  />
                  {devolucionesYape > 0 && (
                    <FilaCalculo
                      icon={<Minus className="h-4 w-4 text-orange-500" />}
                      label="Devoluciones Yape"
                      valor={devolucionesYape}
                      negativo
                    />
                  )}
                  <FilaCalculo
                    icon={<Smartphone className="h-4 w-4 text-purple-700" />}
                    label="Deberías tener en Yape"
                    valor={yapeEsperado}
                    destacado
                  />
                </>
              )}
            </div>
          </div>

          {/* Gastos */}
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
              Ej: compraste pollo S/ 20 — anótalo para que cuadre la caja
            </p>
            {resumen.gastos.length === 0 ? (
              <p className="mt-4 text-sm text-slate-400">No hay gastos registrados</p>
            ) : (
              <ul className="mt-3 divide-y divide-slate-100">
                {resumen.gastos.map((g) => (
                  <li key={g.id} className="flex items-center justify-between py-2">
                    <div>
                      <p className="text-sm font-medium text-slate-800">{g.descripcion}</p>
                      <p className="text-xs text-slate-400">
                        {CATEGORIAS_GASTO.find((c) => c.id === g.categoria)?.label ?? g.categoria}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-red-600">
                        −{formatMoney(Number(g.monto))}
                      </span>
                      <button
                        onClick={async () => {
                          if (!window.confirm('¿Eliminar este gasto?')) return
                          await eliminarGasto(g.id)
                          load()
                        }}
                        className="text-slate-300 hover:text-red-500"
                        title="Eliminar gasto"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Movimientos */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-3 font-semibold text-slate-900">Movimientos</h2>
            <div className="max-h-72 space-y-2 overflow-y-auto">
              {resumen.movimientos.map((m) => (
                <div
                  key={m.id}
                  className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm ${
                    !m.afectaCaja
                      ? 'bg-purple-50 text-purple-800'
                      : m.esEntrada
                        ? 'bg-emerald-50'
                        : 'bg-red-50'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {m.esEntrada ? (
                      <ArrowUpCircle
                        className={`h-4 w-4 ${m.afectaCaja ? 'text-emerald-600' : 'text-purple-500'}`}
                      />
                    ) : (
                      <ArrowDownCircle className="h-4 w-4 text-red-500" />
                    )}
                    <div>
                      <p>{m.descripcion}</p>
                      {!m.afectaCaja && (
                        <p className="text-xs opacity-70">No suma al efectivo físico</p>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">
                      {m.esEntrada ? '+' : '−'}
                      {formatMoney(m.monto)}
                    </p>
                    {m.hora && <p className="text-xs opacity-60">{m.hora}</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Cierre / conteo */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 font-semibold text-slate-900">Cerrar caja — conteo final</h2>

            <div className="mb-4 flex items-center justify-between">
              <p className="text-sm font-medium text-slate-700">Contador de billetes y monedas</p>
              <button
                type="button"
                onClick={() => setUsarContador((v) => !v)}
                className="text-xs font-medium text-teal-700 underline"
              >
                {usarContador ? 'Ingresar total a mano' : 'Usar contador'}
              </button>
            </div>

            {usarContador ? (
              <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
                {DENOMINACIONES.map((d) => (
                  <label
                    key={d.valor}
                    className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  >
                    <span className="font-medium text-slate-700">{d.label}</span>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={conteos[String(d.valor)] ?? ''}
                      onChange={(e) => {
                        const n = parseInt(e.target.value, 10)
                        setConteos((prev) => ({
                          ...prev,
                          [String(d.valor)]: isNaN(n) || n < 0 ? 0 : n,
                        }))
                      }}
                      className="w-16 rounded border border-slate-200 px-2 py-1 text-right outline-none focus:border-teal-500"
                      placeholder="0"
                    />
                  </label>
                ))}
                <div className="col-span-2 flex items-center justify-between rounded-lg bg-teal-50 px-3 py-2 sm:col-span-3">
                  <span className="text-sm font-medium text-teal-900">Total contado</span>
                  <span className="text-lg font-bold text-teal-800">{formatMoney(totalContador)}</span>
                </div>
              </div>
            ) : (
              <div className="mb-4">
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  ¿Cuánto efectivo tienes en mano?
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
            )}

            {declarado > 0 && (
              <CuadroDiferencia
                tituloOk="¡Efectivo cuadra!"
                diferencia={diferencia}
                esperado={efectivoEsperado}
                contado={declarado}
                ayudaFaltante="¿Olvidaste un gasto? ¿una venta fue Yape? ¿vuelto de más?"
              />
            )}

            {(requiereYape || yapeDeclarado.trim() !== '') && (
              <div className="mt-4 rounded-lg border border-purple-200 bg-purple-50/50 p-4">
                <label className="mb-1 flex items-center gap-2 text-sm font-medium text-purple-900">
                  <Smartphone className="h-4 w-4" />
                  ¿Cuánto ves en tu app Yape?
                </label>
                <p className="mb-2 text-xs text-purple-700">
                  Según el sistema: {formatMoney(yapeEsperado)}
                </p>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={yapeDeclarado}
                  onChange={(e) => setYapeDeclarado(e.target.value)}
                  placeholder="Ej: 85.00"
                  className="w-full rounded-lg border border-purple-300 bg-white px-4 py-3 text-lg font-semibold outline-none focus:border-purple-500"
                />
                {yapeDeclarado.trim() !== '' && (
                  <div className="mt-3">
                    <CuadroDiferencia
                      tituloOk="¡Yape cuadra!"
                      diferencia={diferenciaYape}
                      esperado={yapeEsperado}
                      contado={yapeContado}
                      ayudaFaltante="¿Pago Yape sin registrar? ¿devolución pendiente?"
                      compacto
                    />
                  </div>
                )}
              </div>
            )}

            {hayDiferencia && declarado > 0 && (
              <div className="mt-4">
                <label className="mb-1 block text-sm font-medium text-amber-800">
                  Motivo de la diferencia (obligatorio)
                </label>
                <textarea
                  value={motivoDiferencia}
                  onChange={(e) => setMotivoDiferencia(e.target.value)}
                  placeholder="Ej: vuelto mal dado, gasto sin anotar, Yape no registrado…"
                  rows={2}
                  className="w-full rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm outline-none focus:border-amber-500"
                />
              </div>
            )}

            <textarea
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              placeholder="Notas opcionales del día…"
              rows={2}
              className="mt-4 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-500"
            />

            <button
              onClick={handleCierre}
              disabled={cerrando || !puedeCerrar}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-teal-600 py-3.5 font-semibold text-white hover:bg-teal-700 disabled:opacity-50"
            >
              {cerrando ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <CheckCircle className="h-5 w-5" />
              )}
              {cajaCerrada ? 'Guardar cambios del cierre' : 'Guardar cierre del día'}
            </button>
          </div>
        </>
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
                placeholder="Descripción"
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
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowGasto(false)}
                  className="flex-1 rounded-lg border py-2.5 text-slate-600"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleGasto}
                  className="flex-1 rounded-lg bg-red-600 py-2.5 font-semibold text-white"
                >
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

function MiniKpi({
  label,
  value,
  accent,
}: {
  label: string
  value: string
  accent?: boolean
}) {
  return (
    <div
      className={`rounded-xl border p-4 shadow-sm ${
        accent ? 'border-teal-200 bg-teal-50' : 'border-slate-200 bg-white'
      }`}
    >
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`mt-1 text-xl font-bold ${accent ? 'text-teal-800' : 'text-slate-900'}`}>{value}</p>
    </div>
  )
}

function ResumenLinea({
  label,
  value,
  positivo,
  negativo,
  bold,
  alert,
}: {
  label: string
  value: string
  positivo?: boolean
  negativo?: boolean
  bold?: boolean
  alert?: boolean
}) {
  return (
    <div className={`flex justify-between ${bold ? 'font-bold' : ''} ${alert ? 'text-amber-800' : ''}`}>
      <span className="text-slate-600">{label}</span>
      <span className={positivo ? 'text-emerald-700' : negativo ? 'text-red-600' : 'text-slate-900'}>
        {value}
      </span>
    </div>
  )
}

function CuadroDiferencia({
  tituloOk,
  diferencia,
  esperado,
  contado,
  ayudaFaltante,
  compacto,
}: {
  tituloOk: string
  diferencia: number
  esperado: number
  contado: number
  ayudaFaltante?: string
  compacto?: boolean
}) {
  const ok = Math.abs(diferencia) < UMBRAL_DIFERENCIA
  const falta = diferencia < -UMBRAL_DIFERENCIA
  return (
    <div
      className={`rounded-lg p-4 ${
        ok ? 'bg-emerald-50 text-emerald-800' : falta ? 'bg-red-50 text-red-800' : 'bg-amber-50 text-amber-800'
      } ${compacto ? 'p-3' : ''}`}
    >
      <p className={`font-bold ${compacto ? 'text-base' : 'text-lg'}`}>
        {ok && tituloOk}
        {falta && `Faltan ${formatMoney(Math.abs(diferencia))}`}
        {!ok && !falta && `Sobran ${formatMoney(diferencia)}`}
      </p>
      <p className="mt-1 text-sm">
        Esperabas {formatMoney(esperado)} · Contaste {formatMoney(contado)}
      </p>
      {falta && ayudaFaltante && <p className="mt-2 text-xs">{ayudaFaltante}</p>}
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
  hint,
}: {
  icon: React.ReactNode
  label: string
  valor: number
  positivo?: boolean
  negativo?: boolean
  destacado?: boolean
  hint?: string
}) {
  return (
    <div
      className={`flex items-center justify-between ${destacado ? 'text-base font-bold text-teal-900' : ''}`}
    >
      <div className="flex items-center gap-2">
        {icon}
        <div>
          <span>{label}</span>
          {hint && <p className="text-xs font-normal text-teal-600">{hint}</p>}
        </div>
      </div>
      <span className={positivo ? 'text-emerald-700' : negativo ? 'text-red-600' : ''}>
        {negativo && valor > 0 ? '−' : positivo && valor > 0 ? '+' : ''}
        {formatMoney(valor)}
      </span>
    </div>
  )
}
