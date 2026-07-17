-- ============================================================
-- INVENTARIO POR LOTES (FEFO — primero el que vence antes)
-- Ejecutar en Supabase → SQL Editor
-- Requiere: compras-vencimiento-lote.sql (fecha_vencimiento_lote en compra_detalles)
-- ============================================================

CREATE TABLE IF NOT EXISTS producto_lotes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  producto_id UUID NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
  cantidad NUMERIC(12,3) NOT NULL DEFAULT 0 CHECK (cantidad >= 0),
  fecha_vencimiento DATE,
  compra_detalle_id UUID REFERENCES compra_detalles(id) ON DELETE SET NULL,
  notas TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lotes_producto ON producto_lotes(producto_id);
CREATE INDEX IF NOT EXISTS idx_lotes_vencimiento ON producto_lotes(fecha_vencimiento)
  WHERE cantidad > 0;

ALTER TABLE producto_lotes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "lotes_select" ON producto_lotes;
DROP POLICY IF EXISTS "lotes_all" ON producto_lotes;
CREATE POLICY "lotes_select" ON producto_lotes FOR SELECT TO authenticated USING (true);
CREATE POLICY "lotes_all" ON producto_lotes FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Migrar stock existente a un lote por producto
INSERT INTO producto_lotes (producto_id, cantidad, fecha_vencimiento, notas)
SELECT p.id, p.stock, p.fecha_vencimiento, 'Stock inicial'
FROM productos p
WHERE p.stock > 0
  AND NOT EXISTS (
    SELECT 1 FROM producto_lotes pl WHERE pl.producto_id = p.id
  );

-- Sincroniza productos.stock y productos.fecha_vencimiento desde lotes
CREATE OR REPLACE FUNCTION public.sync_producto_from_lotes(p_producto_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_stock NUMERIC;
  v_fecha DATE;
BEGIN
  SELECT COALESCE(SUM(cantidad), 0) INTO v_stock
  FROM producto_lotes
  WHERE producto_id = p_producto_id;

  SELECT MIN(fecha_vencimiento) INTO v_fecha
  FROM producto_lotes
  WHERE producto_id = p_producto_id
    AND cantidad > 0
    AND fecha_vencimiento IS NOT NULL
    AND fecha_vencimiento >= CURRENT_DATE;

  IF v_fecha IS NULL THEN
    SELECT MIN(fecha_vencimiento) INTO v_fecha
    FROM producto_lotes
    WHERE producto_id = p_producto_id
      AND cantidad > 0
      AND fecha_vencimiento IS NOT NULL;
  END IF;

  UPDATE productos
  SET stock = v_stock,
      fecha_vencimiento = v_fecha,
      updated_at = now()
  WHERE id = p_producto_id;
END;
$$;

-- Agregar cantidad a lote (misma fecha = mismo lote)
CREATE OR REPLACE FUNCTION public.fn_lotes_agregar(
  p_producto_id UUID,
  p_cantidad NUMERIC,
  p_fecha_vencimiento DATE,
  p_compra_detalle_id UUID DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lote_id UUID;
BEGIN
  IF p_cantidad <= 0 THEN
    RETURN;
  END IF;

  SELECT id INTO v_lote_id
  FROM producto_lotes
  WHERE producto_id = p_producto_id
    AND cantidad > 0
    AND (
      (fecha_vencimiento IS NULL AND p_fecha_vencimiento IS NULL)
      OR fecha_vencimiento = p_fecha_vencimiento
    )
  ORDER BY created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF v_lote_id IS NOT NULL THEN
    UPDATE producto_lotes
    SET cantidad = cantidad + p_cantidad,
        compra_detalle_id = COALESCE(p_compra_detalle_id, compra_detalle_id)
    WHERE id = v_lote_id;
  ELSE
    INSERT INTO producto_lotes (producto_id, cantidad, fecha_vencimiento, compra_detalle_id)
    VALUES (p_producto_id, p_cantidad, p_fecha_vencimiento, p_compra_detalle_id);
  END IF;

  PERFORM sync_producto_from_lotes(p_producto_id);
END;
$$;

-- Descontar FEFO: primero lo que vence antes (no vende lotes ya vencidos si hay vigentes)
CREATE OR REPLACE FUNCTION public.fn_lotes_descontar_fefo(
  p_producto_id UUID,
  p_cantidad NUMERIC
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_restante NUMERIC := p_cantidad;
  v_lote RECORD;
  v_quitar NUMERIC;
  v_hay_vigente BOOLEAN;
BEGIN
  IF p_cantidad <= 0 THEN
    RETURN;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM producto_lotes
    WHERE producto_id = p_producto_id
      AND cantidad > 0
      AND (fecha_vencimiento IS NULL OR fecha_vencimiento >= CURRENT_DATE)
  ) INTO v_hay_vigente;

  FOR v_lote IN
    SELECT id, cantidad, fecha_vencimiento
    FROM producto_lotes
    WHERE producto_id = p_producto_id
      AND cantidad > 0
      AND (
        NOT v_hay_vigente
        OR fecha_vencimiento IS NULL
        OR fecha_vencimiento >= CURRENT_DATE
      )
    ORDER BY
      CASE WHEN fecha_vencimiento IS NULL THEN 1 ELSE 0 END,
      fecha_vencimiento ASC NULLS LAST,
      created_at ASC
    FOR UPDATE
  LOOP
    EXIT WHEN v_restante <= 0;

    v_quitar := LEAST(v_lote.cantidad, v_restante);

    UPDATE producto_lotes
    SET cantidad = cantidad - v_quitar
    WHERE id = v_lote.id;

    v_restante := v_restante - v_quitar;
  END LOOP;

  IF v_restante > 0.001 THEN
    RAISE EXCEPTION 'Stock insuficiente en lotes para el producto';
  END IF;

  PERFORM sync_producto_from_lotes(p_producto_id);
END;
$$;

-- Reingresar stock (devoluciones): lote con misma fecha o nuevo
CREATE OR REPLACE FUNCTION public.fn_lotes_reingresar(
  p_producto_id UUID,
  p_cantidad NUMERIC,
  p_fecha_vencimiento DATE DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM fn_lotes_agregar(p_producto_id, p_cantidad, p_fecha_vencimiento, NULL);
END;
$$;

-- COMPRAS: crear lote en lugar de solo sumar stock
CREATE OR REPLACE FUNCTION public.fn_compra_aumentar_stock()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM fn_lotes_agregar(
    NEW.producto_id,
    NEW.cantidad,
    NEW.fecha_vencimiento_lote,
    NEW.id
  );

  UPDATE productos
  SET costo = NEW.costo_unitario,
      updated_at = now()
  WHERE id = NEW.producto_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_compra_stock ON compra_detalles;
CREATE TRIGGER trg_compra_stock
  AFTER INSERT ON compra_detalles
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_compra_aumentar_stock();

-- VENTAS: FEFO
CREATE OR REPLACE FUNCTION public.fn_venta_disminuir_stock()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.producto_id IS NOT NULL THEN
    PERFORM fn_lotes_descontar_fefo(NEW.producto_id, NEW.cantidad);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_venta_stock ON venta_detalles;
CREATE TRIGGER trg_venta_stock
  BEFORE INSERT ON venta_detalles
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_venta_disminuir_stock();

-- DEVOLUCIONES: reingresa al lote (usa vencimiento actual del producto)
CREATE OR REPLACE FUNCTION public.fn_devolucion_aumentar_stock()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_fecha DATE;
BEGIN
  IF NEW.producto_id IS NOT NULL THEN
    SELECT fecha_vencimiento INTO v_fecha
    FROM productos
    WHERE id = NEW.producto_id;

    PERFORM fn_lotes_reingresar(NEW.producto_id, NEW.cantidad, v_fecha);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_devolucion_stock ON devolucion_detalles;
CREATE TRIGGER trg_devolucion_stock
  AFTER INSERT ON devolucion_detalles
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_devolucion_aumentar_stock();

-- CONSUMO PROPIO: FEFO
CREATE OR REPLACE FUNCTION public.fn_retiro_consumo_disminuir_stock()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.producto_id IS NOT NULL THEN
    PERFORM fn_lotes_descontar_fefo(NEW.producto_id, NEW.cantidad);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_retiro_consumo_stock ON retiro_consumo_detalles;
CREATE TRIGGER trg_retiro_consumo_stock
  BEFORE INSERT ON retiro_consumo_detalles
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_retiro_consumo_disminuir_stock();

-- Resync todos los productos con lotes
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT DISTINCT producto_id FROM producto_lotes LOOP
    PERFORM sync_producto_from_lotes(r.producto_id);
  END LOOP;
END $$;

SELECT 'Inventario por lotes (FEFO) instalado' AS resultado;
