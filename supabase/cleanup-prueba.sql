-- ============================================================
-- Limpiar datos de PRUEBA (ejecutar DESPUÉS del deploy venta mixta)
-- NO borra usuarios ni categorías
-- ============================================================

DELETE FROM devolucion_detalles;
DELETE FROM devoluciones;
DELETE FROM venta_detalles;
DELETE FROM ventas;
DELETE FROM compra_detalles;
DELETE FROM compras;
DELETE FROM gastos_caja;
DELETE FROM cierres_caja;
DELETE FROM productos;

SELECT 'Datos de prueba eliminados — vuelve a registrar productos' AS resultado;
