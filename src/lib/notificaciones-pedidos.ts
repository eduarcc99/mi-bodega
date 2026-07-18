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

export function reproducirAlertaPedido(): void {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (!AudioCtx) return

    const ctx = new AudioCtx()
    const tonos = [880, 988, 880]

    tonos.forEach((freq, i) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = freq
      gain.gain.value = 0.25
      osc.connect(gain)
      gain.connect(ctx.destination)
      const t = ctx.currentTime + i * 0.22
      osc.start(t)
      osc.stop(t + 0.18)
    })

    setTimeout(() => void ctx.close(), 900)

    if ('vibrate' in navigator) {
      navigator.vibrate([300, 100, 300, 100, 400])
    }
  } catch {
    /* silencioso si el navegador bloquea audio */
  }
}
