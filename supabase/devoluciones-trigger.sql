-- ============================================================
-- DEVOLUCIONES: columnas extra + trigger de stock
-- Ejecutar en Supabase → SQL Editor
-- ============================================================

ALTER TABLE devoluciones ADD COLUMN IF NOT EXISTS total NUMERIC(12,2) NOT NULL DEFAULT 0;
ALTER TABLE devoluciones ADD COLUMN IF NOT EXISTS metodo_pago metodo_pago;

ALTER TABLE devolucion_detalles ADD COLUMN IF NOT EXISTS venta_detalle_id UUID REFERENCES venta_detalles(id);
ALTER TABLE devolucion_detalles ADD COLUMN IF NOT EXISTS monto_devuelto NUMERIC(12,2) NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.fn_devolucion_aumentar_stock()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.producto_id IS NOT NULL THEN
    UPDATE productos
    SET stock = stock + NEW.cantidad,
        updated_at = now()
    WHERE id = NEW.producto_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_devolucion_stock ON devolucion_detalles;
CREATE TRIGGER trg_devolucion_stock
  AFTER INSERT ON devolucion_detalles
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_devolucion_aumentar_stock();

SELECT 'Devoluciones instaladas' AS resultado;
