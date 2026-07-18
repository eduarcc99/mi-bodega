-- ============================================================
-- CAJA V2: apertura del día + motivo de diferencia en cierre
-- Ejecutar en Supabase → SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS aperturas_caja (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  fecha DATE NOT NULL UNIQUE,
  cajero_id UUID NOT NULL REFERENCES perfiles(id),
  monto NUMERIC(12,2) NOT NULL CHECK (monto >= 0),
  monto_yape NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (monto_yape >= 0),
  notas TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_aperturas_caja_fecha ON aperturas_caja(fecha DESC);

ALTER TABLE aperturas_caja ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "aperturas_select" ON aperturas_caja;
DROP POLICY IF EXISTS "aperturas_insert" ON aperturas_caja;
DROP POLICY IF EXISTS "aperturas_update" ON aperturas_caja;

CREATE POLICY "aperturas_select" ON aperturas_caja
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "aperturas_insert" ON aperturas_caja
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "aperturas_update" ON aperturas_caja
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE cierres_caja ADD COLUMN IF NOT EXISTS motivo_diferencia TEXT;

SELECT 'Apertura de caja y motivo diferencia instalados' AS resultado;
