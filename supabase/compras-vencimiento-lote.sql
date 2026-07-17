-- ============================================================
-- COMPRAS: vencimiento del lote por línea de compra
-- Ejecutar en Supabase → SQL Editor
-- ============================================================

ALTER TABLE compra_detalles
  ADD COLUMN IF NOT EXISTS fecha_vencimiento_lote DATE;

SELECT 'Vencimiento de lote en compras instalado' AS resultado;
