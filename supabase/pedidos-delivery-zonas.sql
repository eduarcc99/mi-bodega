-- ============================================================
-- OBSOLETO — NO EJECUTAR
-- Usar pedidos-delivery-inauguracion.sql + pedidos-admin.sql
-- Este archivo dejó una función duplicada (p_zona_delivery) que rompe el RPC
-- ============================================================

ALTER TABLE pedidos_web ADD COLUMN IF NOT EXISTS costo_delivery NUMERIC(12,2) NOT NULL DEFAULT 0;
ALTER TABLE pedidos_web ADD COLUMN IF NOT EXISTS zona_delivery TEXT;

CREATE OR REPLACE FUNCTION public.crear_pedido_web(
  p_cliente_nombre TEXT,
  p_cliente_telefono TEXT,
  p_direccion TEXT,
  p_referencia TEXT DEFAULT NULL,
  p_notas TEXT DEFAULT NULL,
  p_zona_delivery TEXT DEFAULT 'cerca',
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
  v_pedido_minimo NUMERIC := 10;
BEGIN
  IF trim(p_cliente_nombre) = '' OR trim(p_cliente_telefono) = '' OR trim(p_direccion) = '' THEN
    RAISE EXCEPTION 'Completa nombre, teléfono y dirección';
  END IF;

  IF jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'El pedido está vacío';
  END IF;

  v_costo_delivery := CASE trim(lower(p_zona_delivery))
    WHEN 'cerca' THEN 1
    WHEN 'lejos' THEN 2
    ELSE NULL
  END;

  IF v_costo_delivery IS NULL THEN
    RAISE EXCEPTION 'Zona de delivery inválida';
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

  IF v_subtotal < v_pedido_minimo THEN
    RAISE EXCEPTION 'Pedido mínimo S/ % en productos (sin delivery)', v_pedido_minimo;
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
    trim(lower(p_zona_delivery)),
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

GRANT EXECUTE ON FUNCTION public.crear_pedido_web(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB) TO anon, authenticated;

SELECT 'Delivery zonas + mínimo instalado' AS resultado;
