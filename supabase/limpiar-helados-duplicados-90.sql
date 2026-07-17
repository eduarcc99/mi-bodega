-- ============================================================
-- Limpiar helados duplicados de prueba (stock = 90)
-- NO toca "Helado san antonio" con 96 unidades (producto real)
--
-- Al probar sin stock se crearon productos helado con 90 uds.
-- El de 96 ("Helado san antonio") NO es copia — no se toca.
--
-- Ejecutar en Supabase → SQL Editor
-- ============================================================


-- ── PASO 1: Vista previa ────────────────────────────────────
SELECT
  p.id,
  p.nombre,
  p.activo,
  p.stock,
  COUNT(pl.id) AS lotes,
  COALESCE(SUM(pl.cantidad), 0) AS suma_lotes
FROM productos p
LEFT JOIN producto_lotes pl ON pl.producto_id = p.id
WHERE p.nombre ILIKE '%helado%'
GROUP BY p.id, p.nombre, p.activo, p.stock
ORDER BY p.stock DESC, p.nombre;

-- Esperado antes de limpiar:
--   Helado san antonio        → 96  activo   ← NO SE TOCA
--   Helado en cono            → 90  inactivo ← basura
--   Helado en cono san Antonio → 90  activo  ← basura (prueba)


-- ════════════════════════════════════════════════════════════
-- OPCIÓN A (recomendada): Solo el inactivo "Helado en cono"
-- Deja "Helado en cono san Antonio" (90) si aún lo vendes
-- ════════════════════════════════════════════════════════════

-- UPDATE producto_lotes pl SET cantidad = 0
-- FROM productos p
-- WHERE pl.producto_id = p.id
--   AND p.nombre = 'Helado en cono'
--   AND p.activo = false;

-- UPDATE productos
-- SET stock = 0, updated_at = now()
-- WHERE nombre = 'Helado en cono' AND activo = false;


-- ════════════════════════════════════════════════════════════
-- OPCIÓN B: Todos los helado con stock = 90 (los que agregaste mal)
-- Usa esto si los dos de 90 son prueba y solo queda el de 96
-- ════════════════════════════════════════════════════════════

UPDATE producto_lotes pl
SET cantidad = 0
FROM productos p
WHERE pl.producto_id = p.id
  AND p.nombre ILIKE '%helado%'
  AND p.stock = 90;

UPDATE productos
SET stock = 0,
    activo = false,
    updated_at = now()
WHERE nombre ILIKE '%helado%'
  AND stock = 90;


-- ── PASO 3 (opcional): Borrar del catálogo si no tienen ventas ─
-- Descomenta solo si ya no los necesitas en la lista de productos
/*
DELETE FROM productos p
WHERE p.stock = 0
  AND p.activo = false
  AND p.nombre ILIKE '%helado%'
  AND p.nombre <> 'Helado san antonio'
  AND NOT EXISTS (SELECT 1 FROM venta_detalles vd WHERE vd.producto_id = p.id)
  AND NOT EXISTS (SELECT 1 FROM compra_detalles cd WHERE cd.producto_id = p.id);
*/


-- ── Verificar ───────────────────────────────────────────────
SELECT
  p.nombre,
  p.activo,
  p.stock,
  COALESCE(SUM(pl.cantidad), 0) AS suma_lotes
FROM productos p
LEFT JOIN producto_lotes pl ON pl.producto_id = p.id
WHERE p.nombre ILIKE '%helado%'
GROUP BY p.id, p.nombre, p.activo, p.stock
ORDER BY p.nombre;

-- Esperado después (opción B):
--   Helado san antonio → 96 activo, suma_lotes 96
--   Los de 90 → stock 0, inactivos, sin lotes

SELECT 'Limpieza helados duplicados completada' AS resultado;
