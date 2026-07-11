-- ============================================================
-- FIX: error "Could not choose the best candidate function"
-- Causa: quedaron 2 versiones de crear_pedido_web (zonas + inauguración)
-- Ejecutar UNA vez en Supabase SQL Editor
-- ============================================================

-- Versión obsoleta de pedidos-delivery-zonas.sql (tenía p_zona_delivery)
DROP FUNCTION IF EXISTS public.crear_pedido_web(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB);

SELECT 'Función duplicada eliminada — prueba enviar pedido de nuevo' AS resultado;
