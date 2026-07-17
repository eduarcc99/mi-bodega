import { useState } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import { Loader2, MessageCircle, MapPin, User, Phone, Sparkles } from 'lucide-react'
import { formatMoney } from '@/lib/utils'
import { useTiendaCart } from '@/tienda/context/TiendaCartContext'
import { crearPedidoWeb } from '@/tienda/lib/pedidos'
import { buildWhatsAppPedidoUrl } from '@/tienda/lib/whatsapp'
import { isTiendaAbierta } from '@/tienda/lib/horario'
import {
  costoDelivery,
  etiquetaDelivery,
  tieneEnvioGratis,
  totalConDelivery,
} from '@/tienda/lib/delivery'
import { TIENDA_CONFIG } from '@/tienda/config'
import { tiendaPath } from '@/tienda/routes'
import type { CheckoutForm } from '@/tienda/types'

const emptyForm: CheckoutForm = {
  nombre: '',
  telefono: '',
  direccion: '',
  referencia: '',
  notas: '',
}

export function CheckoutPage() {
  const { items, total: subtotal, clearCart } = useTiendaCart()
  const navigate = useNavigate()
  const [form, setForm] = useState<CheckoutForm>(emptyForm)
  const [error, setError] = useState('')
  const [processing, setProcessing] = useState(false)

  const delivery = costoDelivery(subtotal)
  const total = totalConDelivery(subtotal)
  const envioGratis = tieneEnvioGratis(subtotal)

  if (!isTiendaAbierta()) {
    return <Navigate to={tiendaPath()} replace />
  }

  if (items.length === 0) {
    return <Navigate to={tiendaPath('carrito')} replace />
  }

  function update(field: keyof CheckoutForm, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setProcessing(true)
    try {
      const pedidoId = await crearPedidoWeb(form, items)
      const waUrl = buildWhatsAppPedidoUrl(
        pedidoId,
        form,
        items,
        subtotal,
        delivery,
        total,
      )
      clearCart()
      navigate(tiendaPath('confirmado'), {
        state: { waUrl, pedidoId, subtotal, delivery, total, nombre: form.nombre },
        replace: true,
      })
      window.open(waUrl, '_blank', 'noopener,noreferrer')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al enviar pedido')
    } finally {
      setProcessing(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {envioGratis ? (
        <div className="flex items-start gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <Sparkles className="mt-0.5 h-4 w-4 shrink-0" />
          <span>¡Envío gratis! Tu pedido califica por la promo de inauguración en {TIENDA_CONFIG.zona}.</span>
        </div>
      ) : (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Pedido pequeño: envío {formatMoney(TIENDA_CONFIG.deliveryPedidoPequeno)}. Agrega{' '}
          {formatMoney(TIENDA_CONFIG.envioGratisDesde - subtotal)} más y el envío es gratis.
        </div>
      )}

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="space-y-2 text-sm">
          <div className="flex justify-between text-slate-600">
            <span>Subtotal productos</span>
            <span>{formatMoney(subtotal)}</span>
          </div>
          <div className="flex justify-between text-slate-600">
            <span>Delivery</span>
            <span className={envioGratis ? 'font-semibold text-emerald-600' : ''}>
              {envioGratis ? 'GRATIS' : formatMoney(delivery)}
            </span>
          </div>
          <p className="text-xs text-slate-400">{etiquetaDelivery(subtotal)}</p>
          <div className="flex justify-between border-t border-slate-100 pt-2 text-lg font-bold text-slate-900">
            <span>Total</span>
            <span className="text-rose-800">{formatMoney(total)}</span>
          </div>
        </div>
      </div>

      <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="font-semibold text-slate-900">Datos de entrega</h2>

        <div>
          <label className="mb-1 flex items-center gap-1 text-xs font-medium text-slate-600">
            <User className="h-3.5 w-3.5" /> Nombre *
          </label>
          <input
            required
            value={form.nombre}
            onChange={(e) => update('nombre', e.target.value)}
            className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-rose-400"
            placeholder="Tu nombre"
          />
        </div>

        <div>
          <label className="mb-1 flex items-center gap-1 text-xs font-medium text-slate-600">
            <Phone className="h-3.5 w-3.5" /> Celular *
          </label>
          <input
            required
            type="tel"
            value={form.telefono}
            onChange={(e) => update('telefono', e.target.value)}
            className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-rose-400"
            placeholder="9XX XXX XXX"
          />
        </div>

        <div>
          <label className="mb-1 flex items-center gap-1 text-xs font-medium text-slate-600">
            <MapPin className="h-3.5 w-3.5" /> Dirección en Barrio Prado *
          </label>
          <input
            required
            value={form.direccion}
            onChange={(e) => update('direccion', e.target.value)}
            className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-rose-400"
            placeholder="Calle, mz, lt, piso…"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Referencia</label>
          <input
            value={form.referencia}
            onChange={(e) => update('referencia', e.target.value)}
            className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-rose-400"
            placeholder="Portón azul, frente al parque…"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Notas (opcional)</label>
          <input
            value={form.notas}
            onChange={(e) => update('notas', e.target.value)}
            className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-rose-400"
            placeholder="Yape, cambio, etc."
          />
        </div>
      </div>

      {error && (
        <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      <button
        type="submit"
        disabled={processing}
        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#25D366] py-4 text-base font-bold text-white shadow-lg shadow-emerald-600/20 hover:bg-[#20bd5a] disabled:opacity-50"
      >
        {processing ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : (
          <MessageCircle className="h-5 w-5" />
        )}
        Enviar pedido por WhatsApp · {formatMoney(total)}
      </button>

      <p className="text-center text-[11px] text-slate-400">
        Al confirmar, se abre WhatsApp con el resumen para coordinar la entrega.
      </p>
    </form>
  )
}
