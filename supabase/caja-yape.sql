-- ============================================================
-- CAJA: conciliación Yape en cierre
-- Ejecutar en Supabase → SQL Editor
-- ============================================================

ALTER TABLE cierres_caja ADD COLUMN IF NOT EXISTS yape_esperado NUMERIC(12,2) NOT NULL DEFAULT 0;
ALTER TABLE cierres_caja ADD COLUMN IF NOT EXISTS yape_declarado NUMERIC(12,2) NOT NULL DEFAULT 0;
ALTER TABLE cierres_caja ADD COLUMN IF NOT EXISTS diferencia_yape NUMERIC(12,2) NOT NULL DEFAULT 0;

SELECT 'Conciliación Yape instalada' AS resultado;
