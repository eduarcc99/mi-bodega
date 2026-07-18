import { useState } from 'react'
import { Bell, BellOff, BellRing, Volume2, X } from 'lucide-react'
import type { EstadoNotificaciones } from '@/lib/notificaciones-pedidos'

const STORAGE_KEY = 'mi-bodega-alertas-ok'

function alertasMarcadasOk(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

function marcarAlertasOk() {
  try {
    localStorage.setItem(STORAGE_KEY, '1')
  } catch {
    /* ignore */
  }
}

interface PedidoNotificacionesBannerProps {
  permiso: EstadoNotificaciones
  escuchando: boolean
  onActivar: () => void
  onProbar: () => void
}

export function PedidoNotificacionesBanner({
  permiso,
  escuchando,
  onActivar,
  onProbar,
}: PedidoNotificacionesBannerProps) {
  const [oculto, setOculto] = useState(alertasMarcadasOk)

  function omitir() {
    marcarAlertasOk()
    setOculto(true)
  }

  function probarYOcultar() {
    onProbar()
    marcarAlertasOk()
    setOculto(true)
  }

  if (permiso === 'granted' && escuchando && oculto) {
    return null
  }

  if (permiso === 'granted' && escuchando) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-lg border border-emerald-200/80 bg-emerald-50/80 px-3 py-2 text-xs">
        <span className="flex items-center gap-1.5 font-medium text-emerald-800">
          <BellRing className="h-3.5 w-3.5" />
          Alertas activas
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={probarYOcultar}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-100"
          >
            <Volume2 className="h-3 w-3" />
            Probar
          </button>
          <button
            type="button"
            onClick={omitir}
            className="rounded-md p-1 text-emerald-600 hover:bg-emerald-100"
            aria-label="Ocultar aviso"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    )
  }

  if (permiso === 'denied') {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-amber-200/80 bg-amber-50/80 px-3 py-2 text-[11px] text-amber-800">
        <BellOff className="h-3.5 w-3.5 shrink-0" />
        <span>Notificaciones bloqueadas — actívalas en ajustes del celular.</span>
      </div>
    )
  }

  return (
    <div className="flex items-center justify-between gap-2 rounded-lg border border-teal-200/80 bg-teal-50/80 px-3 py-2">
      <span className="flex items-center gap-1.5 text-xs font-medium text-teal-900">
        <Bell className="h-3.5 w-3.5 shrink-0" />
        Alertas de pedidos web
      </span>
      <button
        type="button"
        onClick={onActivar}
        className="shrink-0 rounded-md bg-teal-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-teal-700"
      >
        Activar
      </button>
    </div>
  )
}
