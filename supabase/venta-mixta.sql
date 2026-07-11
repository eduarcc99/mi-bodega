-- ============================================================
-- VENTA MIXTA: peso (kg) + venta por unidad suelta (tomate)
-- Ejecutar en Supabase → SQL Editor
-- ============================================================

ALTER TABLE productos ADD COLUMN IF NOT EXISTS permite_venta_unidad BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE productos ADD COLUMN IF NOT EXISTS precio_por_unidad NUMERIC(12,2);
ALTER TABLE productos ADD COLUMN IF NOT EXISTS peso_estimado_unidad NUMERIC(12,3);

ALTER TABLE venta_detalles ADD COLUMN IF NOT EXISTS modo_venta TEXT NOT NULL DEFAULT 'normal';
ALTER TABLE venta_detalles ADD COLUMN IF NOT EXISTS unidades_cobradas NUMERIC(12,3);

-- unidades_cobradas en ventas históricas = cantidad
UPDATE venta_detalles SET unidades_cobradas = cantidad WHERE unidades_cobradas IS NULL;

ALTER TABLE venta_detalles ALTER COLUMN unidades_cobradas SET NOT NULL;
ALTER TABLE venta_detalles ALTER COLUMN unidades_cobradas SET DEFAULT 1;

SELECT 'Venta mixta instalada' AS resultado;
