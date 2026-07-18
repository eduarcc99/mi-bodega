import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import {
  actualizarBadgeApp,
  mostrarNotificacionPedido,
  obtenerEstadoNotificaciones,
  reproducirAlertaPedido,
  solicitarPermisoNotificaciones,
  soportePush,
  suscribirPushUsuario,
  type EstadoNotificaciones,
  type ResumenPedidoAlerta,
} from '@/lib/notificaciones-pedidos'

const STORAGE_KEY = 'mi-bodega-pedidos-notificados'
const POLL_MS = 15_000
const RECORDATORIO_MS = 60_000

function cargarNotificados(): Set<string> {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (raw) return new Set(JSON.parse(raw) as string[])
  } catch {
    /* ignore */
  }
  return new Set()
}

function guardarNotificados(ids: Set<string>) {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify([...ids].slice(-120)))
}

async function marcarPendientesActuales(ids: Set<string>) {
  const { data } = await supabase.from('pedidos_web').select('id').eq('estado', 'pendiente')
  for (const p of data ?? []) ids.add(p.id)
  guardarNotificados(ids)
}

async function contarPendientesDb(): Promise<number> {
  const { count, error } = await supabase
    .from('pedidos_web')
    .select('id', { count: 'exact', head: true })
    .eq('estado', 'pendiente')

  if (error) return 0
  return count ?? 0
}

export function usePedidoNotifications(activo: boolean, userId: string | null) {
  const [permiso, setPermiso] = useState<EstadoNotificaciones>(obtenerEstadoNotificaciones())
  const [escuchando, setEscuchando] = useState(false)
  const [pushActivo, setPushActivo] = useState(false)
  const [pendientesCount, setPendientesCount] = useState(0)
  const [pedidoToast, setPedidoToast] = useState<ResumenPedidoAlerta | null>(null)

  const notificadosRef = useRef(cargarNotificados())
  const inicializadoRef = useRef(false)
  const ultimoIdRef = useRef<string | null>(null)
  const pendientesRef = useRef(0)
  const pushActivoRef = useRef(false)

  const registrarPush = useCallback(async (uid: string) => {
    if (!soportePush()) {
      pushActivoRef.current = false
      setPushActivo(false)
      return false
    }
    const ok = await suscribirPushUsuario(uid)
    pushActivoRef.current = ok
    setPushActivo(ok)
    return ok
  }, [])

  const refrescarPendientes = useCallback(async () => {
    const n = await contarPendientesDb()
    pendientesRef.current = n
    setPendientesCount(n)
    actualizarBadgeApp(n)
    return n
  }, [])

  const alertar = useCallback(
    async (pedido: ResumenPedidoAlerta) => {
      if (notificadosRef.current.has(pedido.id)) return
      notificadosRef.current.add(pedido.id)
      guardarNotificados(notificadosRef.current)

      const visible = document.visibilityState === 'visible'
      if (visible) {
        setPedidoToast(pedido)
        reproducirAlertaPedido()
      }

      // Con Web Push activo, el servidor envía la notificación (app cerrada o en redes)
      if (permiso === 'granted' && !pushActivoRef.current && visible) {
        await mostrarNotificacionPedido(pedido)
      }

      void refrescarPendientes()
    },
    [permiso, refrescarPendientes],
  )

  const descartarToast = useCallback(() => setPedidoToast(null), [])

  const activarNotificaciones = useCallback(async () => {
    const p = await solicitarPermisoNotificaciones()
    setPermiso(p)
    if (p === 'granted') {
      await marcarPendientesActuales(notificadosRef.current)
      inicializadoRef.current = true
      if (userId) await registrarPush(userId)
    }
    return p
  }, [userId, registrarPush])

  const probarAlerta = useCallback(async () => {
    reproducirAlertaPedido()
    if (permiso === 'granted') {
      await mostrarNotificacionPedido({
        id: 'test',
        cliente_nombre: 'Cliente de prueba',
        total: 25.5,
      })
    }
  }, [permiso])

  useEffect(() => {
    if (!activo) {
      setEscuchando(false)
      setPendientesCount(0)
      setPushActivo(false)
      pushActivoRef.current = false
      actualizarBadgeApp(0)
      return
    }

    let cancelado = false

    async function iniciar() {
      if (!inicializadoRef.current) {
        await marcarPendientesActuales(notificadosRef.current)
        inicializadoRef.current = true
      }

      if (cancelado) return
      await refrescarPendientes()
      if (cancelado) return

      if (userId && permiso === 'granted') {
        await registrarPush(userId)
      }

      if (cancelado) return
      setEscuchando(true)
    }

    void iniciar()

    return () => {
      cancelado = true
      setEscuchando(false)
    }
  }, [activo, userId, permiso, refrescarPendientes, registrarPush])

  useEffect(() => {
    if (!activo || !escuchando) return

    async function poll() {
      await refrescarPendientes()

      const { data } = await supabase
        .from('pedidos_web')
        .select('id, cliente_nombre, total, estado, created_at')
        .eq('estado', 'pendiente')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (!data) {
        ultimoIdRef.current = null
        return
      }

      if (ultimoIdRef.current === null) {
        ultimoIdRef.current = data.id
        return
      }

      if (data.id !== ultimoIdRef.current) {
        ultimoIdRef.current = data.id
        await alertar(data)
      }
    }

    const channel = supabase
      .channel('pedidos-web-alertas')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'pedidos_web' },
        (payload) => {
          const row = payload.new as ResumenPedidoAlerta & { estado?: string }
          void refrescarPendientes()
          if (row.estado === 'pendiente') {
            ultimoIdRef.current = row.id
            void alertar(row)
          }
        },
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'pedidos_web' },
        () => {
          void refrescarPendientes()
        },
      )
      .subscribe()

    void poll()
    const interval = setInterval(poll, POLL_MS)

    return () => {
      clearInterval(interval)
      void supabase.removeChannel(channel)
    }
  }, [activo, escuchando, alertar, refrescarPendientes])

  useEffect(() => {
    if (!activo || pendientesCount === 0) return

    const interval = setInterval(() => {
      if (pendientesRef.current > 0 && document.visibilityState === 'visible') {
        reproducirAlertaPedido()
      }
    }, RECORDATORIO_MS)

    return () => clearInterval(interval)
  }, [activo, pendientesCount])

  useEffect(() => {
    if (pendientesCount === 0) setPedidoToast(null)
  }, [pendientesCount])

  return {
    permiso,
    escuchando,
    pushActivo,
    pendientesCount,
    pedidoToast,
    descartarToast,
    activarNotificaciones,
    probarAlerta,
  }
}
