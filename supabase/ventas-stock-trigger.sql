-- ============================================================
-- Trigger: descontar stock al registrar venta
-- Ejecutar en Supabase → SQL Editor (si aún no lo hiciste)
-- ============================================================

CREATE OR REPLACE FUNCTION public.fn_venta_disminuir_stock()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  stock_actual NUMERIC;
BEGIN
  IF NEW.producto_id IS NOT NULL THEN
    SELECT stock INTO stock_actual
    FROM productos
    WHERE id = NEW.producto_id
    FOR UPDATE;

    IF stock_actual IS NULL THEN
      RAISE EXCEPTION 'Producto no encontrado';
    END IF;

    IF stock_actual < NEW.cantidad THEN
      RAISE EXCEPTION 'Stock insuficiente para "%"', NEW.nombre_producto;
    END IF;

    UPDATE productos
    SET stock = stock - NEW.cantidad,
        updated_at = now()
    WHERE id = NEW.producto_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_venta_stock ON venta_detalles;
CREATE TRIGGER trg_venta_stock
  BEFORE INSERT ON venta_detalles
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_venta_disminuir_stock();

SELECT 'Trigger de ventas instalado' AS resultado;
