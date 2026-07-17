-- ============================================================
-- Resync: productos con stock pero sin lotes (registro manual)
-- Ejecutar en Supabase → SQL Editor si hay desincronización
-- ============================================================

INSERT INTO producto_lotes (producto_id, cantidad, fecha_vencimiento, notas)
SELECT p.id, p.stock, p.fecha_vencimiento, 'Stock inicial (resync)'
FROM productos p
WHERE p.stock > 0
  AND NOT EXISTS (
    SELECT 1 FROM producto_lotes pl
    WHERE pl.producto_id = p.id
  );

SELECT 'Lotes resync manual completado' AS resultado;
