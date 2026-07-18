-- Web Push — suscripciones del panel admin (PWA)
-- Ejecutar en Supabase → SQL Editor

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user ON push_subscriptions(user_id);

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "push_subs_own_select" ON push_subscriptions
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "push_subs_own_insert" ON push_subscriptions
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "push_subs_own_update" ON push_subscriptions
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "push_subs_own_delete" ON push_subscriptions
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ============================================================
-- DESPLIEGUE (una vez)
-- ============================================================
-- 1. Generar claves VAPID (en tu PC):
--    npx web-push generate-vapid-keys
--
-- 2. Frontend (.env y Vercel):
--    VITE_VAPID_PUBLIC_KEY=<public key>
--
-- 3. Secretos Supabase (Dashboard → Edge Functions → Secrets):
--    VAPID_PUBLIC_KEY=<public key>
--    VAPID_PRIVATE_KEY=<private key>
--    PUSH_WEBHOOK_SECRET=<string aleatorio largo>
--
-- 4. Desplegar función:
--    supabase functions deploy notify-pedido-web --no-verify-jwt
--
-- 5. Database Webhook (Dashboard → Database → Webhooks → Create):
--    Name: pedido-web-push
--    Table: pedidos_web
--    Events: INSERT
--    Type: Supabase Edge Function
--    Function: notify-pedido-web
--    HTTP Headers (opcional): x-webhook-secret: <PUSH_WEBHOOK_SECRET>
--
-- 6. En el celular: Pedidos web → Activar (registra suscripción push)
