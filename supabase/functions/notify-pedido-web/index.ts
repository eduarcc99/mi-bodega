import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'
import webpush from 'npm:web-push@3.6.7'

interface PedidoRecord {
  id: string
  cliente_nombre: string
  total: number | string
  estado?: string
}

interface WebhookPayload {
  type?: string
  record?: PedidoRecord
}

interface PushSubscriptionRow {
  id: string
  endpoint: string
  p256dh: string
  auth: string
}

const vapidPublic = Deno.env.get('VAPID_PUBLIC_KEY') ?? ''
const vapidPrivate = Deno.env.get('VAPID_PRIVATE_KEY') ?? ''
const webhookSecret = Deno.env.get('PUSH_WEBHOOK_SECRET')
const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

if (vapidPublic && vapidPrivate) {
  webpush.setVapidDetails('mailto:pedidos@mi-bodega.app', vapidPublic, vapidPrivate)
}

function formatMoney(n: number): string {
  return `S/ ${n.toFixed(2)}`
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  if (webhookSecret) {
    const header = req.headers.get('x-webhook-secret')
    if (header !== webhookSecret) {
      return new Response('Unauthorized', { status: 401 })
    }
  }

  if (!vapidPublic || !vapidPrivate || !supabaseUrl || !serviceRoleKey) {
    return new Response(JSON.stringify({ error: 'Missing VAPID or Supabase env' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  let body: WebhookPayload
  try {
    body = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const record = body.record
  if (!record?.id || record.estado !== 'pendiente') {
    return new Response(JSON.stringify({ ok: true, skipped: true }), {
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey)
  const { data: subs, error: subsError } = await supabase.from('push_subscriptions').select('id, endpoint, p256dh, auth')

  if (subsError) {
    return new Response(JSON.stringify({ error: subsError.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const total = Number(record.total)
  const pushPayload = JSON.stringify({
    title: '🛒 Nuevo pedido web',
    body: `${record.cliente_nombre} · ${formatMoney(total)}`,
    tag: `pedido-${record.id}`,
    url: '/pedidos-web',
    pedidoId: record.id,
  })

  let sent = 0
  let failed = 0

  for (const sub of (subs ?? []) as PushSubscriptionRow[]) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        pushPayload,
        { TTL: 86400, urgency: 'high' },
      )
      sent++
    } catch (err: unknown) {
      failed++
      const statusCode = (err as { statusCode?: number }).statusCode
      if (statusCode === 404 || statusCode === 410) {
        await supabase.from('push_subscriptions').delete().eq('id', sub.id)
      }
      console.error('Push failed', sub.id, statusCode, err)
    }
  }

  return new Response(JSON.stringify({ ok: true, sent, failed, total: subs?.length ?? 0 }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
