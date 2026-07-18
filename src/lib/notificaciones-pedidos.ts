import { formatMoney } from '@/lib/utils'

export type EstadoNotificaciones = NotificationPermission | 'unsupported'

export interface ResumenPedidoAlerta {
  id: string
  cliente_nombre: string
  total: number
}

export function soporteNotificaciones(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window
}

export function obtenerEstadoNotificaciones(): EstadoNotificaciones {
  if (!soporteNotificaciones()) return 'unsupported'
  return Notification.permission
}

export async function solicitarPermisoNotificaciones(): Promise<EstadoNotificaciones> {
  if (!soporteNotificaciones()) return 'unsupported'
  if (Notification.permission === 'granted') return 'granted'
  if (Notification.permission === 'denied') return 'denied'
  return Notification.requestPermission()
}

export async function mostrarNotificacionPedido(pedido: ResumenPedidoAlerta): Promise<void> {
  if (!soporteNotificaciones() || Notification.permission !== 'granted') return

  const title = '🛒 Nuevo pedido web'
  const body = `${pedido.cliente_nombre} · ${formatMoney(pedido.total)}`
  const options = {
    body,
    icon: '/favicon_.svg',
    badge: '/favicon_.svg',
    tag: `pedido-${pedido.id}`,
    vibrate: [300, 100, 300, 100, 500],
    requireInteraction: true,
    data: { url: '/pedidos-web', pedidoId: pedido.id },
  } as NotificationOptions & { renotify?: boolean }
  options.renotify = true

  if ('serviceWorker' in navigator) {
    try {
      const reg = await navigator.serviceWorker.ready
      await reg.showNotification(title, options)
      return
    } catch {
      /* fallback abajo */
    }
  }

  new Notification(title, options)
}

/** Timbre de tienda ~3 s — square wave, volumen alto */
const ALERTA_TONOS: { freq: number; at: number; dur: number }[] = [
  { freq: 1046, at: 0, dur: 0.32 },
  { freq: 1318, at: 0.5, dur: 0.32 },
  { freq: 1046, at: 1.0, dur: 0.32 },
  { freq: 1318, at: 1.5, dur: 0.32 },
  { freq: 1046, at: 2.0, dur: 0.32 },
  { freq: 1567, at: 2.5, dur: 0.45 },
]

const ALERTA_VOLUMEN = 0.85
const ALERTA_DURACION_MS = 3200

export function reproducirAlertaPedido(): void {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (!AudioCtx) return

    const ctx = new AudioCtx()

    for (const { freq, at, dur } of ALERTA_TONOS) {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'square'
      osc.frequency.value = freq
      gain.gain.setValueAtTime(0, ctx.currentTime + at)
      gain.gain.linearRampToValueAtTime(ALERTA_VOLUMEN, ctx.currentTime + at + 0.02)
      gain.gain.setValueAtTime(ALERTA_VOLUMEN, ctx.currentTime + at + dur - 0.04)
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + at + dur)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(ctx.currentTime + at)
      osc.stop(ctx.currentTime + at + dur)
    }

    setTimeout(() => void ctx.close(), ALERTA_DURACION_MS)

    if ('vibrate' in navigator) {
      navigator.vibrate([400, 120, 400, 120, 400, 120, 600])
    }
  } catch {
    /* silencioso si el navegador bloquea audio */
  }
}

export function actualizarBadgeApp(pendientes: number): void {
  if (!('setAppBadge' in navigator)) return
  try {
    if (pendientes > 0) {
      void navigator.setAppBadge(pendientes)
    } else {
      void navigator.clearAppBadge()
    }
  } catch {
    /* ignore */
  }
}
