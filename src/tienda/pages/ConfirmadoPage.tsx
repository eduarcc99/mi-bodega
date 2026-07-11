import { Link, useLocation, Navigate } from 'react-router-dom'
import { CheckCircle, MessageCircle, ShoppingBag } from 'lucide-react'
import { formatMoney } from '@/lib/utils'
import { TIENDA_CONFIG } from '@/tienda/config'

interface ConfirmadoState {
  waUrl: string
  pedidoId: string
  subtotal: number
  delivery: number
  total: number
  nombre: string
}

export function ConfirmadoPage() {
  const location = useLocation()
  const state = location.state as ConfirmadoState | null

  if (!state?.pedidoId) {
    return <Navigate to="/pedir" replace />
  }

  return (
    <div className="space-y-6 py-4 text-center">
      <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100">
        <CheckCircle className="h-10 w-10 text-emerald-600" />
      </div>

      <div>
        <h2 className="text-2xl font-bold text-slate-900">¡Listo, {state.nombre}!</h2>
        <p className="mt-2 text-slate-600">
          Tu pedido en <strong>{TIENDA_CONFIG.nombre}</strong> fue registrado.
        </p>
        <p className="mt-1 text-sm text-slate-400">
          Ticket #{state.pedidoId.slice(0, 8).toUpperCase()}
        </p>
        <p className="mt-2 text-sm text-slate-600">
          Productos {formatMoney(state.subtotal)} + delivery {formatMoney(state.delivery)} ={' '}
          <strong className="text-rose-800">{formatMoney(state.total)}</strong>
        </p>
      </div>

      <div className="rounded-2xl border border-emerald-100 bg-emerald-50/50 px-4 py-4 text-sm text-emerald-800">
        Confirma el pedido por WhatsApp para que lo preparemos y salga a tu dirección en{' '}
        <strong>{TIENDA_CONFIG.zona}</strong>.
      </div>

      <a
        href={state.waUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#25D366] py-4 font-bold text-white shadow-lg"
      >
        <MessageCircle className="h-5 w-5" />
        Abrir WhatsApp
      </a>

      <Link
        to="/pedir"
        className="inline-flex items-center gap-2 text-sm font-semibold text-rose-800 hover:text-rose-900"
      >
        <ShoppingBag className="h-4 w-4" />
        Seguir comprando
      </Link>
    </div>
  )
}
