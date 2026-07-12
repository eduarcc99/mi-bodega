-- ============================================================
-- CONSUMO PROPIO / RETIRO DUEÑO
-- Baja stock al COSTO. NO toca ventas ni efectivo de caja.
-- Ejecutar en Supabase → SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS retiros_consumo (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  registrado_por UUID NOT NULL REFERENCES perfiles(id),
  fecha TIMESTAMPTZ NOT NULL DEFAULT now(),
  total_costo NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (total_costo >= 0),
  total_venta_potencial NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (total_venta_potencial >= 0),
  motivo TEXT,
  notas TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS retiro_consumo_detalles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  retiro_id UUID NOT NULL REFERENCES retiros_consumo(id) ON DELETE CASCADE,
  producto_id UUID REFERENCES productos(id),
  nombre_producto TEXT NOT NULL,
  cantidad NUMERIC(12,3) NOT NULL CHECK (cantidad > 0),
  unidades_cobradas NUMERIC(12,3) NOT NULL CHECK (unidades_cobradas > 0),
  modo_venta TEXT NOT NULL DEFAULT 'normal',
  costo_unitario NUMERIC(12,2) NOT NULL DEFAULT 0,
  precio_venta_unitario NUMERIC(12,2) NOT NULL DEFAULT 0,
  subtotal_costo NUMERIC(12,2) NOT NULL DEFAULT 0,
  subtotal_venta_potencial NUMERIC(12,2) NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_retiros_consumo_fecha ON retiros_consumo(fecha DESC);
CREATE INDEX IF NOT EXISTS idx_retiro_detalles_retiro ON retiro_consumo_detalles(retiro_id);

ALTER TABLE retiros_consumo ENABLE ROW LEVEL SECURITY;
ALTER TABLE retiro_consumo_detalles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "retiros_consumo_select" ON retiros_consumo;
DROP POLICY IF EXISTS "retiros_consumo_insert" ON retiros_consumo;
DROP POLICY IF EXISTS "retiro_detalles_select" ON retiro_consumo_detalles;
DROP POLICY IF EXISTS "retiro_detalles_insert" ON retiro_consumo_detalles;

CREATE POLICY "retiros_consumo_select" ON retiros_consumo
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "retiros_consumo_insert" ON retiros_consumo
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "retiro_detalles_select" ON retiro_consumo_detalles
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "retiro_detalles_insert" ON retiro_consumo_detalles
  FOR INSERT TO authenticated WITH CHECK (true);

-- Baja stock al registrar detalle (igual criterio que ventas)
CREATE OR REPLACE FUNCTION public.fn_retiro_consumo_disminuir_stock()
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

DROP TRIGGER IF EXISTS trg_retiro_consumo_stock ON retiro_consumo_detalles;
CREATE TRIGGER trg_retiro_consumo_stock
  BEFORE INSERT ON retiro_consumo_detalles
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_retiro_consumo_disminuir_stock();

SELECT 'Módulo consumo propio instalado' AS resultado;
