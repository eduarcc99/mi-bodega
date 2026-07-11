-- ============================================================
-- TIENDA WEB / DELIVERY — Barrio Prado (demo MARGHOT)
-- Ejecutar en Supabase → SQL Editor (después de venta-mixta.sql)
-- ============================================================

CREATE TYPE pedido_web_estado AS ENUM ('pendiente', 'confirmado', 'entregado', 'cancelado');

CREATE TABLE IF NOT EXISTS pedidos_web (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cliente_nombre TEXT NOT NULL,
  cliente_telefono TEXT NOT NULL,
  direccion TEXT NOT NULL,
  referencia TEXT,
  notas TEXT,
  subtotal NUMERIC(12,2) NOT NULL CHECK (subtotal >= 0),
  costo_delivery NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (costo_delivery >= 0),
  zona_delivery TEXT,
  total NUMERIC(12,2) NOT NULL CHECK (total >= 0),
  estado pedido_web_estado NOT NULL DEFAULT 'pendiente',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS pedido_web_detalles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pedido_id UUID NOT NULL REFERENCES pedidos_web(id) ON DELETE CASCADE,
  producto_id UUID REFERENCES productos(id) ON DELETE SET NULL,
  nombre_producto TEXT NOT NULL,
  cantidad NUMERIC(12,3) NOT NULL CHECK (cantidad > 0),
  precio_unitario NUMERIC(12,2) NOT NULL CHECK (precio_unitario >= 0),
  subtotal NUMERIC(12,2) NOT NULL CHECK (subtotal >= 0)
);

CREATE INDEX IF NOT EXISTS idx_pedidos_web_fecha ON pedidos_web(created_at DESC);

ALTER TABLE pedidos_web ENABLE ROW LEVEL SECURITY;
ALTER TABLE pedido_web_detalles ENABLE ROW LEVEL SECURITY;

-- Staff ve pedidos web
CREATE POLICY "pedidos_web_staff_select" ON pedidos_web
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "pedido_web_detalles_staff_select" ON pedido_web_detalles
  FOR SELECT TO authenticated USING (true);

-- Catálogo público (sin costos) vía función
CREATE OR REPLACE FUNCTION public.get_catalogo_tienda()
RETURNS TABLE (
  id UUID,
  nombre TEXT,
  categoria_id UUID,
  categoria_nombre TEXT,
  unidad unidad_medida,
  stock NUMERIC,
  precio_venta NUMERIC,
  imagen_url TEXT,
  permite_venta_unidad BOOLEAN,
  precio_por_unidad NUMERIC,
  peso_estimado_unidad NUMERIC
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT
    p.id,
    p.nombre,
    p.categoria_id,
    c.nombre AS categoria_nombre,
    p.unidad,
    p.stock,
    p.precio_venta,
    p.imagen_url,
    COALESCE(p.permite_venta_unidad, false),
    p.precio_por_unidad,
    p.peso_estimado_unidad
  FROM productos p
  LEFT JOIN categorias c ON c.id = p.categoria_id
  WHERE p.activo = true
    AND p.stock > 0
  ORDER BY c.nombre NULLS LAST, p.nombre;
$$;

GRANT EXECUTE ON FUNCTION public.get_catalogo_tienda() TO anon, authenticated;

-- Crear pedido desde la web (valida stock, no descuenta aún)
-- Envío gratis desde S/ 10 · S/ 1 si el pedido es menor (inauguración)
CREATE OR REPLACE FUNCTION public.crear_pedido_web(
  p_cliente_nombre TEXT,
  p_cliente_telefono TEXT,
  p_direccion TEXT,
  p_referencia TEXT DEFAULT NULL,
  p_notas TEXT DEFAULT NULL,
  p_items JSONB DEFAULT '[]'::JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pedido_id UUID;
  v_item JSONB;
  v_producto productos%ROWTYPE;
  v_cantidad NUMERIC;
  v_precio NUMERIC;
  v_linea_subtotal NUMERIC;
  v_subtotal NUMERIC := 0;
  v_nombre TEXT;
  v_costo_delivery NUMERIC;
  v_envio_gratis_desde NUMERIC := 10;
BEGIN
  IF trim(p_cliente_nombre) = '' OR trim(p_cliente_telefono) = '' OR trim(p_direccion) = '' THEN
    RAISE EXCEPTION 'Completa nombre, teléfono y dirección';
  END IF;

  IF jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'El pedido está vacío';
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    SELECT * INTO v_producto
    FROM productos
    WHERE id = (v_item->>'producto_id')::UUID
      AND activo = true;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Producto no disponible: %', v_item->>'producto_id';
    END IF;

    v_cantidad := (v_item->>'cantidad')::NUMERIC;
    IF v_cantidad IS NULL OR v_cantidad <= 0 THEN
      RAISE EXCEPTION 'Cantidad inválida para %', v_producto.nombre;
    END IF;

    IF COALESCE(v_item->>'modo', 'normal') = 'unidad_suelta' THEN
      IF v_producto.peso_estimado_unidad IS NULL OR v_producto.peso_estimado_unidad <= 0 THEN
        RAISE EXCEPTION 'Producto % no configurado para venta por unidad', v_producto.nombre;
      END IF;
      IF v_producto.stock < round(v_cantidad * v_producto.peso_estimado_unidad * 1000) / 1000 THEN
        RAISE EXCEPTION 'Stock insuficiente para %', v_producto.nombre;
      END IF;
    ELSIF v_producto.stock < v_cantidad THEN
      RAISE EXCEPTION 'Stock insuficiente para %', v_producto.nombre;
    END IF;

    v_precio := COALESCE((v_item->>'precio_unitario')::NUMERIC, v_producto.precio_venta);
    v_linea_subtotal := round(v_precio * v_cantidad * 100) / 100;
    v_subtotal := v_subtotal + v_linea_subtotal;
  END LOOP;

  IF v_subtotal >= v_envio_gratis_desde THEN
    v_costo_delivery := 0;
  ELSE
    v_costo_delivery := 1;
  END IF;

  INSERT INTO pedidos_web (
    cliente_nombre, cliente_telefono, direccion, referencia, notas,
    subtotal, costo_delivery, zona_delivery, total
  ) VALUES (
    trim(p_cliente_nombre),
    trim(p_cliente_telefono),
    trim(p_direccion),
    NULLIF(trim(p_referencia), ''),
    NULLIF(trim(p_notas), ''),
    v_subtotal,
    v_costo_delivery,
    CASE WHEN v_costo_delivery = 0 THEN 'gratis' ELSE 'pequeno' END,
    v_subtotal + v_costo_delivery
  )
  RETURNING id INTO v_pedido_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    SELECT * INTO v_producto
    FROM productos
    WHERE id = (v_item->>'producto_id')::UUID;

    v_cantidad := (v_item->>'cantidad')::NUMERIC;
    v_precio := COALESCE((v_item->>'precio_unitario')::NUMERIC, v_producto.precio_venta);
    v_linea_subtotal := round(v_precio * v_cantidad * 100) / 100;
    v_nombre := COALESCE(v_item->>'nombre_producto', v_producto.nombre);

    INSERT INTO pedido_web_detalles (
      pedido_id, producto_id, nombre_producto, cantidad, precio_unitario, subtotal
    ) VALUES (
      v_pedido_id, v_producto.id, v_nombre, v_cantidad, v_precio, v_linea_subtotal
    );
  END LOOP;

  RETURN v_pedido_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.crear_pedido_web(TEXT, TEXT, TEXT, TEXT, TEXT, JSONB) TO anon, authenticated;

SELECT 'Tienda web / pedidos instalados' AS resultado;
