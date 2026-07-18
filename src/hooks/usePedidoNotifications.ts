import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import {
  mostrarNotificacionPedido,
  obtenerEstadoNotificaciones,
  reproducirAlertaPedido,
  solicitarPermisoNotificaciones,
  type EstadoNotificaciones,
  type ResumenPedidoAlerta,
} from '@/lib/notificaciones-pedidos'

const STORAGE_KEY = 'mi-bodega-pedidos-notificados'
const POLL_MS = 15_000

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

export function usePedidoNotifications(activo: boolean) {
  const [permiso, setPermiso] = useState<EstadoNotificaciones>(obtenerEstadoNotificaciones())
  const [escuchando, setEscuchando] = useState(false)
  const notificadosRef = useRef(cargarNotificados())
  const inicializadoRef = useRef(false)
  const ultimoIdRef = useRef<string | null>(null)

  const alertar = useCallback(
    async (pedido: ResumenPedidoAlerta) => {
      if (notificadosRef.current.has(pedido.id)) return
      notificadosRef.current.add(pedido.id)
      guardarNotificados(notificadosRef.current)

      reproducirAlertaPedido()
      if (permiso === 'granted') {
        await mostrarNotificacionPedido(pedido)
      }
    },
    [permiso],
  )

  const activarNotificaciones = useCallback(async () => {
    const p = await solicitarPermisoNotificaciones()
    setPermiso(p)
    if (p === 'granted') {
      await marcarPendientesActuales(notificadosRef.current)
      inicializadoRef.current = true
    }
    return p
  }, [])

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
      return
    }

    let cancelado = false

    async function iniciar() {
      if (!inicializadoRef.current) {
        await marcarPendientesActuales(notificadosRef.current)
        inicializadoRef.current = true
      }

      if (cancelado) return
      setEscuchando(true)
    }

    void iniciar()

    return () => {
      cancelado = true
      setEscuchando(false)
    }
  }, [activo])

  useEffect(() => {
    if (!activo || !escuchando) return

    async function poll() {
      const { data } = await supabase
        .from('pedidos_web')
        .select('id, cliente_nombre, total, estado, created_at')
        .eq('estado', 'pendiente')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (!data) return

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
      .channel('pedidos-web-nuevos')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'pedidos_web' },
        (payload) => {
          const row = payload.new as ResumenPedidoAlerta & { estado?: string }
          if (row.estado === 'pendiente') {
            ultimoIdRef.current = row.id
            void alertar(row)
          }
        },
      )
      .subscribe()

    void poll()
    const interval = setInterval(poll, POLL_MS)

    return () => {
      clearInterval(interval)
      void supabase.removeChannel(channel)
    }
  }, [activo, escuchando, alertar])

  return {
    permiso,
    escuchando,
    activarNotificaciones,
    probarAlerta,
  }
}
