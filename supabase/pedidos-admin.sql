-- ============================================================
-- PANEL PEDIDOS WEB — confirmar / cancelar / entregar (venta + stock)
-- Ejecutar después de pedidos-web.sql y pedidos-delivery-inauguracion.sql
-- ============================================================

ALTER TABLE pedidos_web ADD COLUMN IF NOT EXISTS venta_id UUID REFERENCES ventas(id);

ALTER TABLE pedido_web_detalles ADD COLUMN IF NOT EXISTS modo_venta TEXT NOT NULL DEFAULT 'normal';
ALTER TABLE pedido_web_detalles ADD COLUMN IF NOT EXISTS unidades_cobradas NUMERIC(12,3);
ALTER TABLE pedido_web_detalles ADD COLUMN IF NOT EXISTS cantidad_stock NUMERIC(12,3);

UPDATE pedido_web_detalles
SET unidades_cobradas = cantidad, cantidad_stock = cantidad
WHERE unidades_cobradas IS NULL;

ALTER TABLE pedido_web_detalles ALTER COLUMN unidades_cobradas SET NOT NULL;
ALTER TABLE pedido_web_detalles ALTER COLUMN cantidad_stock SET NOT NULL;

CREATE POLICY "pedidos_web_staff_update" ON pedidos_web
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- Quitar versión vieja con p_zona_delivery (pedidos-delivery-zonas.sql)
DROP FUNCTION IF EXISTS public.crear_pedido_web(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB);

-- Recrear crear_pedido_web guardando stock para entrega
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
  v_modo TEXT;
  v_stock NUMERIC;
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

    v_modo := COALESCE(v_item->>'modo', 'normal');
    IF v_modo = 'unidad_suelta' THEN
      IF v_producto.peso_estimado_unidad IS NULL OR v_producto.peso_estimado_unidad <= 0 THEN
        RAISE EXCEPTION 'Producto % no configurado para venta por unidad', v_producto.nombre;
      END IF;
      v_stock := round(v_cantidad * v_producto.peso_estimado_unidad * 1000) / 1000;
    ELSE
      v_stock := v_cantidad;
    END IF;

    IF v_producto.stock < v_stock THEN
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
    v_modo := COALESCE(v_item->>'modo', 'normal');
    IF v_modo = 'unidad_suelta' THEN
      v_stock := round(v_cantidad * v_producto.peso_estimado_unidad * 1000) / 1000;
    ELSE
      v_stock := v_cantidad;
    END IF;

    v_precio := COALESCE((v_item->>'precio_unitario')::NUMERIC, v_producto.precio_venta);
    v_linea_subtotal := round(v_precio * v_cantidad * 100) / 100;
    v_nombre := COALESCE(v_item->>'nombre_producto', v_producto.nombre);

    INSERT INTO pedido_web_detalles (
      pedido_id, producto_id, nombre_producto, cantidad, precio_unitario, subtotal,
      modo_venta, unidades_cobradas, cantidad_stock
    ) VALUES (
      v_pedido_id, v_producto.id, v_nombre, v_cantidad, v_precio, v_linea_subtotal,
      v_modo, v_cantidad, v_stock
    );
  END LOOP;

  RETURN v_pedido_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.crear_pedido_web(TEXT, TEXT, TEXT, TEXT, TEXT, JSONB) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.actualizar_estado_pedido_web(
  p_pedido_id UUID,
  p_estado pedido_web_estado
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actual pedido_web_estado;
BEGIN
  SELECT estado INTO v_actual FROM pedidos_web WHERE id = p_pedido_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pedido no encontrado';
  END IF;

  IF v_actual IN ('entregado', 'cancelado') THEN
    RAISE EXCEPTION 'Este pedido ya está %', v_actual;
  END IF;

  IF p_estado = 'confirmado' AND v_actual <> 'pendiente' THEN
    RAISE EXCEPTION 'Solo se confirman pedidos pendientes';
  END IF;

  IF p_estado = 'cancelado' AND v_actual NOT IN ('pendiente', 'confirmado') THEN
    RAISE EXCEPTION 'No se puede cancelar este pedido';
  END IF;

  IF p_estado = 'entregado' THEN
    RAISE EXCEPTION 'Usa entregar_pedido_web para marcar como entregado';
  END IF;

  UPDATE pedidos_web SET estado = p_estado WHERE id = p_pedido_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.actualizar_estado_pedido_web(UUID, pedido_web_estado) TO authenticated;

CREATE OR REPLACE FUNCTION public.entregar_pedido_web(
  p_pedido_id UUID,
  p_cajero_id UUID,
  p_metodo_pago metodo_pago DEFAULT 'efectivo'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pedido pedidos_web%ROWTYPE;
  v_det RECORD;
  v_venta_id UUID;
  v_producto productos%ROWTYPE;
  v_stock_actual NUMERIC;
BEGIN
  SELECT * INTO v_pedido FROM pedidos_web WHERE id = p_pedido_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pedido no encontrado';
  END IF;

  IF v_pedido.estado IN ('entregado', 'cancelado') THEN
    RAISE EXCEPTION 'Este pedido ya está %', v_pedido.estado;
  END IF;

  FOR v_det IN
    SELECT d.* FROM pedido_web_detalles d WHERE d.pedido_id = p_pedido_id
  LOOP
    IF v_det.producto_id IS NOT NULL THEN
      SELECT * INTO v_producto FROM productos WHERE id = v_det.producto_id;
      IF NOT FOUND OR NOT v_producto.activo THEN
        RAISE EXCEPTION 'Producto % ya no está disponible', v_det.nombre_producto;
      END IF;
      IF v_producto.stock < v_det.cantidad_stock THEN
        RAISE EXCEPTION 'Stock insuficiente para % (quedan %)', v_det.nombre_producto, v_producto.stock;
      END IF;
    END IF;
  END LOOP;

  INSERT INTO ventas (cajero_id, total, metodo_pago, es_generica, notas, fecha)
  VALUES (
    p_cajero_id,
    v_pedido.total,
    p_metodo_pago,
    false,
    'Pedido web #' || upper(left(p_pedido_id::text, 8)),
    now()
  )
  RETURNING id INTO v_venta_id;

  FOR v_det IN
    SELECT d.* FROM pedido_web_detalles d WHERE d.pedido_id = p_pedido_id
  LOOP
    v_producto := NULL;
    IF v_det.producto_id IS NOT NULL THEN
      SELECT * INTO v_producto FROM productos WHERE id = v_det.producto_id;
    END IF;

    INSERT INTO venta_detalles (
      venta_id, producto_id, nombre_producto, cantidad, unidades_cobradas, modo_venta,
      precio_original, precio_unitario, descuento, costo_unitario
    ) VALUES (
      v_venta_id,
      v_det.producto_id,
      v_det.nombre_producto,
      v_det.cantidad_stock,
      v_det.unidades_cobradas,
      COALESCE(v_det.modo_venta, 'normal'),
      v_det.precio_unitario,
      v_det.precio_unitario,
      0,
      COALESCE(v_producto.costo, 0)
    );
  END LOOP;

  IF v_pedido.costo_delivery > 0 THEN
    INSERT INTO venta_detalles (
      venta_id, producto_id, nombre_producto, cantidad, unidades_cobradas, modo_venta,
      precio_original, precio_unitario, descuento, costo_unitario
    ) VALUES (
      v_venta_id, NULL, 'Delivery', 1, 1, 'normal',
      v_pedido.costo_delivery, v_pedido.costo_delivery, 0, 0
    );
  END IF;

  UPDATE pedidos_web
  SET estado = 'entregado', venta_id = v_venta_id
  WHERE id = p_pedido_id;

  RETURN v_venta_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.entregar_pedido_web(UUID, UUID, metodo_pago) TO authenticated;

SELECT 'Panel pedidos web instalado' AS resultado;
