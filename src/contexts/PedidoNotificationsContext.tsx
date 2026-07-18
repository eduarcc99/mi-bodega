import { createContext, useContext, type ReactNode } from 'react'
import { usePedidoNotifications } from '@/hooks/usePedidoNotifications'
import type { EstadoNotificaciones, ResumenPedidoAlerta } from '@/lib/notificaciones-pedidos'

interface PedidoNotificationsContextValue {
  permiso: EstadoNotificaciones
  escuchando: boolean
  pushActivo: boolean
  pendientesCount: number
  pedidoToast: ResumenPedidoAlerta | null
  descartarToast: () => void
  activarNotificaciones: () => Promise<EstadoNotificaciones>
  probarAlerta: () => Promise<void>
}

const PedidoNotificationsContext = createContext<PedidoNotificationsContextValue | null>(null)

export function PedidoNotificationsProvider({
  activo,
  userId,
  children,
}: {
  activo: boolean
  userId: string | null
  children: ReactNode
}) {
  const value = usePedidoNotifications(activo, userId)
  return (
    <PedidoNotificationsContext.Provider value={value}>{children}</PedidoNotificationsContext.Provider>
  )
}

export function usePedidoNotificationsContext() {
  const ctx = useContext(PedidoNotificationsContext)
  if (!ctx) {
    throw new Error('usePedidoNotificationsContext debe usarse dentro de PedidoNotificationsProvider')
  }
  return ctx
}
