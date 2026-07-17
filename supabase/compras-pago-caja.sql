-- ============================================================
-- COMPRAS: método de pago + enlace con gastos de caja
-- Ejecutar en Supabase → SQL Editor
-- ============================================================

ALTER TABLE compras
  ADD COLUMN IF NOT EXISTS metodo_pago metodo_pago NOT NULL DEFAULT 'efectivo';

ALTER TABLE compras
  ADD COLUMN IF NOT EXISTS gasto_caja_id UUID REFERENCES gastos_caja(id) ON DELETE SET NULL;

ALTER TABLE gastos_caja
  ADD COLUMN IF NOT EXISTS compra_id UUID REFERENCES compras(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_compras_fecha ON compras(fecha DESC);
CREATE INDEX IF NOT EXISTS idx_compras_metodo_pago ON compras(metodo_pago);

SELECT 'Compras con pago y caja instalado' AS resultado;
