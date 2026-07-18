import { Bell, BellOff, BellRing, Smartphone, Volume2 } from 'lucide-react'
import type { EstadoNotificaciones } from '@/lib/notificaciones-pedidos'

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
  if (permiso === 'granted' && escuchando) {
    return (
      <div className="flex flex-col gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <BellRing className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
          <div>
            <p className="text-sm font-semibold text-emerald-900">Alertas activas</p>
            <p className="text-xs text-emerald-700">
              Te avisamos con sonido y notificación cuando llegue un pedido nuevo, aunque tengas
              otra app abierta.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onProbar}
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-emerald-300 bg-white px-3 py-2 text-xs font-semibold text-emerald-800 hover:bg-emerald-100"
        >
          <Volume2 className="h-4 w-4" />
          Probar alerta
        </button>
      </div>
    )
  }

  if (permiso === 'denied') {
    return (
      <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
        <BellOff className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
        <div>
          <p className="text-sm font-semibold text-amber-900">Notificaciones bloqueadas</p>
          <p className="text-xs text-amber-800">
            En tu celular ve a Ajustes del navegador → Mi Bodega → Notificaciones → Permitir.
            También revisa que la app esté instalada en la pantalla de inicio.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-teal-200 bg-teal-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <Smartphone className="mt-0.5 h-5 w-5 shrink-0 text-teal-600" />
        <div>
          <p className="text-sm font-semibold text-teal-900">Activa alertas de pedidos</p>
          <p className="text-xs text-teal-800">
            Para no perder clientes de noche: sonido + vibración + notificación push cuando entra un
            pedido web.
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={onActivar}
        className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-700"
      >
        <Bell className="h-4 w-4" />
        Activar notificaciones
      </button>
    </div>
  )
}
