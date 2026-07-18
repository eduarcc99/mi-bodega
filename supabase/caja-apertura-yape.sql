-- ============================================================
-- CAJA: apertura con Yape inicial
-- Ejecutar en Supabase → SQL Editor
-- ============================================================

ALTER TABLE aperturas_caja
  ADD COLUMN IF NOT EXISTS monto_yape NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (monto_yape >= 0);

SELECT 'Apertura con Yape instalada' AS resultado;
