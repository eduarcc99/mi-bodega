-- ============================================================
-- BODEGA V1.0 — Esquema Supabase
-- Ejecutar en: Supabase Dashboard > SQL Editor
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── ENUMS ────────────────────────────────────────────────────
CREATE TYPE user_role AS ENUM ('duena', 'admin', 'cajero');
CREATE TYPE unidad_medida AS ENUM ('unidad', 'kg', 'litro', 'paquete');
CREATE TYPE metodo_pago AS ENUM ('efectivo', 'yape', 'otro');
CREATE TYPE venta_estado AS ENUM ('completada', 'anulada');

-- ── PERFILES (extiende auth.users) ───────────────────────────
CREATE TABLE perfiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  rol user_role NOT NULL DEFAULT 'cajero',
  activo BOOLEAN NOT NULL DEFAULT true,
  puede_backdate BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── CONFIGURACIÓN GLOBAL ─────────────────────────────────────
CREATE TABLE configuracion (
  id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  margen_default NUMERIC(5,2) NOT NULL DEFAULT 25,
  dias_alerta_vencimiento INT NOT NULL DEFAULT 15,
  descuento_vencimiento_pct NUMERIC(5,2) NOT NULL DEFAULT 0,
  moneda TEXT NOT NULL DEFAULT 'PEN'
);

INSERT INTO configuracion DEFAULT VALUES;

-- ── CATEGORÍAS ───────────────────────────────────────────────
CREATE TABLE categorias (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nombre TEXT NOT NULL UNIQUE,
  margen_default NUMERIC(5,2) NOT NULL DEFAULT 25,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO categorias (nombre, margen_default) VALUES
  ('Lácteos', 20),
  ('Bebidas', 25),
  ('Abarrotes', 15),
  ('Limpieza', 20),
  ('Golosinas', 35);

-- ── PROVEEDORES ──────────────────────────────────────────────
CREATE TABLE proveedores (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nombre TEXT NOT NULL,
  ruc TEXT,
  telefono TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── PRODUCTOS ────────────────────────────────────────────────
CREATE TABLE productos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  codigo_barra TEXT UNIQUE,
  nombre TEXT NOT NULL,
  categoria_id UUID REFERENCES categorias(id) ON DELETE SET NULL,
  unidad unidad_medida NOT NULL DEFAULT 'unidad',
  stock NUMERIC(12,3) NOT NULL DEFAULT 0 CHECK (stock >= 0),
  stock_minimo NUMERIC(12,3) NOT NULL DEFAULT 5,
  costo NUMERIC(12,2) NOT NULL DEFAULT 0,
  precio_venta NUMERIC(12,2) NOT NULL DEFAULT 0,
  margen_pct NUMERIC(5,2),
  fecha_vencimiento DATE,
  activo BOOLEAN NOT NULL DEFAULT true,
  imagen_url TEXT,
  -- Precio mayorista
  cantidad_mayor NUMERIC(12,3),
  precio_mayor NUMERIC(12,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_productos_codigo ON productos(codigo_barra);
CREATE INDEX idx_productos_nombre ON productos(nombre);
CREATE INDEX idx_productos_vencimiento ON productos(fecha_vencimiento) WHERE fecha_vencimiento IS NOT NULL;

-- ── CLIENTES ─────────────────────────────────────────────────
CREATE TABLE clientes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nombre TEXT NOT NULL,
  telefono TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── COMPRAS ──────────────────────────────────────────────────
CREATE TABLE compras (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  proveedor_id UUID REFERENCES proveedores(id) ON DELETE SET NULL,
  proveedor_nombre TEXT,
  fecha DATE NOT NULL DEFAULT CURRENT_DATE,
  numero_factura TEXT,
  total NUMERIC(12,2) NOT NULL DEFAULT 0,
  registrado_por UUID REFERENCES perfiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE compra_detalles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  compra_id UUID NOT NULL REFERENCES compras(id) ON DELETE CASCADE,
  producto_id UUID NOT NULL REFERENCES productos(id),
  cantidad NUMERIC(12,3) NOT NULL CHECK (cantidad > 0),
  costo_unitario NUMERIC(12,2) NOT NULL CHECK (costo_unitario >= 0)
);

-- ── VENTAS ───────────────────────────────────────────────────
CREATE TABLE ventas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cliente_id UUID REFERENCES clientes(id) ON DELETE SET NULL,
  cajero_id UUID NOT NULL REFERENCES perfiles(id),
  fecha TIMESTAMPTZ NOT NULL DEFAULT now(),
  total NUMERIC(12,2) NOT NULL DEFAULT 0,
  metodo_pago metodo_pago NOT NULL DEFAULT 'efectivo',
  estado venta_estado NOT NULL DEFAULT 'completada',
  es_generica BOOLEAN NOT NULL DEFAULT false,
  notas TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE venta_detalles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  venta_id UUID NOT NULL REFERENCES ventas(id) ON DELETE CASCADE,
  producto_id UUID REFERENCES productos(id),
  nombre_producto TEXT NOT NULL,
  cantidad NUMERIC(12,3) NOT NULL CHECK (cantidad > 0),
  precio_original NUMERIC(12,2) NOT NULL,
  precio_unitario NUMERIC(12,2) NOT NULL,
  descuento NUMERIC(12,2) NOT NULL DEFAULT 0,
  costo_unitario NUMERIC(12,2) NOT NULL DEFAULT 0
);

-- ── DEVOLUCIONES ─────────────────────────────────────────────
CREATE TABLE devoluciones (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  venta_id UUID NOT NULL REFERENCES ventas(id),
  motivo TEXT,
  fecha TIMESTAMPTZ NOT NULL DEFAULT now(),
  registrado_por UUID REFERENCES perfiles(id),
  total NUMERIC(12,2) NOT NULL DEFAULT 0,
  metodo_pago metodo_pago
);

CREATE TABLE devolucion_detalles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  devolucion_id UUID NOT NULL REFERENCES devoluciones(id) ON DELETE CASCADE,
  producto_id UUID REFERENCES productos(id),
  venta_detalle_id UUID REFERENCES venta_detalles(id),
  cantidad NUMERIC(12,3) NOT NULL CHECK (cantidad > 0),
  monto_devuelto NUMERIC(12,2) NOT NULL DEFAULT 0
);

-- ── GASTOS DE CAJA ───────────────────────────────────────────
CREATE TABLE gastos_caja (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  fecha DATE NOT NULL DEFAULT CURRENT_DATE,
  monto NUMERIC(12,2) NOT NULL CHECK (monto > 0),
  descripcion TEXT NOT NULL,
  categoria TEXT NOT NULL DEFAULT 'otro',
  afecta_efectivo BOOLEAN NOT NULL DEFAULT true,
  registrado_por UUID REFERENCES perfiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── CIERRES DE CAJA ──────────────────────────────────────────
CREATE TABLE cierres_caja (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cajero_id UUID NOT NULL REFERENCES perfiles(id),
  fecha DATE NOT NULL DEFAULT CURRENT_DATE,
  fecha_hora TIMESTAMPTZ NOT NULL DEFAULT now(),
  efectivo_inicial NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_efectivo NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_yape NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_otros NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_ventas NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_gastos NUMERIC(12,2) NOT NULL DEFAULT 0,
  efectivo_esperado NUMERIC(12,2) NOT NULL DEFAULT 0,
  efectivo_declarado NUMERIC(12,2) NOT NULL DEFAULT 0,
  diferencia NUMERIC(12,2) NOT NULL DEFAULT 0,
  notas TEXT
);

-- ── FUNCIONES AUXILIARES ─────────────────────────────────────

-- Precio venta = Costo / (1 - Margen/100)
CREATE OR REPLACE FUNCTION calcular_precio_venta(costo NUMERIC, margen_pct NUMERIC)
RETURNS NUMERIC AS $$
BEGIN
  IF margen_pct >= 100 THEN RETURN costo * 2; END IF;
  IF margen_pct <= 0 THEN RETURN costo; END IF;
  RETURN ROUND(costo / (1 - margen_pct / 100), 2);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Trigger: actualizar stock al registrar compra
CREATE OR REPLACE FUNCTION fn_compra_aumentar_stock()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE productos
  SET stock = stock + NEW.cantidad,
      costo = NEW.costo_unitario,
      updated_at = now()
  WHERE id = NEW.producto_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_compra_stock
  AFTER INSERT ON compra_detalles
  FOR EACH ROW EXECUTE FUNCTION fn_compra_aumentar_stock();

-- Trigger: descontar stock al vender
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

CREATE TRIGGER trg_venta_stock
  BEFORE INSERT ON venta_detalles
  FOR EACH ROW EXECUTE FUNCTION public.fn_venta_disminuir_stock();

-- Trigger: reingresar stock al devolver
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

CREATE TRIGGER trg_devolucion_stock
  AFTER INSERT ON devolucion_detalles
  FOR EACH ROW EXECUTE FUNCTION public.fn_devolucion_aumentar_stock();

-- Trigger: crear perfil al registrarse
CREATE OR REPLACE FUNCTION public.fn_nuevo_usuario()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.perfiles (id, nombre, rol)
  VALUES (
    NEW.id,
    COALESCE(
      NEW.raw_user_meta_data->>'nombre',
      split_part(NEW.email, '@', 1),
      'Usuario'
    ),
    'cajero'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_nuevo_usuario
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.fn_nuevo_usuario();

-- ── RLS ──────────────────────────────────────────────────────
ALTER TABLE perfiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE categorias ENABLE ROW LEVEL SECURITY;
ALTER TABLE productos ENABLE ROW LEVEL SECURITY;
ALTER TABLE proveedores ENABLE ROW LEVEL SECURITY;
ALTER TABLE compras ENABLE ROW LEVEL SECURITY;
ALTER TABLE compra_detalles ENABLE ROW LEVEL SECURITY;
ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE ventas ENABLE ROW LEVEL SECURITY;
ALTER TABLE venta_detalles ENABLE ROW LEVEL SECURITY;
ALTER TABLE devoluciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE devolucion_detalles ENABLE ROW LEVEL SECURITY;
ALTER TABLE cierres_caja ENABLE ROW LEVEL SECURITY;
ALTER TABLE gastos_caja ENABLE ROW LEVEL SECURITY;
ALTER TABLE configuracion ENABLE ROW LEVEL SECURITY;

-- Helper: obtener rol del usuario actual
CREATE OR REPLACE FUNCTION get_user_rol()
RETURNS user_role AS $$
  SELECT rol FROM perfiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION is_admin_or_duena()
RETURNS BOOLEAN AS $$
  SELECT get_user_rol() IN ('duena', 'admin');
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Perfiles: ver propio, admins ven todos
CREATE POLICY "perfiles_select" ON perfiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR is_admin_or_duena());
CREATE POLICY "perfiles_insert" ON perfiles FOR INSERT TO authenticated, service_role
  WITH CHECK (true);
CREATE POLICY "perfiles_update" ON perfiles FOR UPDATE TO authenticated
  USING (is_admin_or_duena());

-- Productos: cajero ve sin costo (vista separada en app), admin ve todo
CREATE POLICY "productos_select" ON productos FOR SELECT TO authenticated USING (true);
CREATE POLICY "productos_insert" ON productos FOR INSERT TO authenticated WITH CHECK (is_admin_or_duena());
CREATE POLICY "productos_update" ON productos FOR UPDATE TO authenticated USING (is_admin_or_duena());
CREATE POLICY "productos_delete" ON productos FOR DELETE TO authenticated USING (is_admin_or_duena());

-- Categorías, proveedores, compras: solo admin/duena
CREATE POLICY "categorias_all" ON categorias FOR ALL TO authenticated USING (is_admin_or_duena());
CREATE POLICY "proveedores_all" ON proveedores FOR ALL TO authenticated USING (is_admin_or_duena());
CREATE POLICY "compras_all" ON compras FOR ALL TO authenticated USING (is_admin_or_duena());
CREATE POLICY "compra_detalles_all" ON compra_detalles FOR ALL TO authenticated USING (is_admin_or_duena());
CREATE POLICY "configuracion_all" ON configuracion FOR ALL TO authenticated USING (is_admin_or_duena());

-- Ventas: todos los autenticados
CREATE POLICY "ventas_select" ON ventas FOR SELECT TO authenticated USING (true);
CREATE POLICY "ventas_insert" ON ventas FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "venta_detalles_all" ON venta_detalles FOR ALL TO authenticated USING (true);

-- Devoluciones y cierres
CREATE POLICY "devoluciones_all" ON devoluciones FOR ALL TO authenticated USING (true);
CREATE POLICY "devolucion_detalles_all" ON devolucion_detalles FOR ALL TO authenticated USING (true);
CREATE POLICY "cierres_select" ON cierres_caja FOR SELECT TO authenticated USING (true);
CREATE POLICY "cierres_insert" ON cierres_caja FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "cierres_update" ON cierres_caja FOR UPDATE TO authenticated USING (true);
CREATE POLICY "gastos_all" ON gastos_caja FOR ALL TO authenticated USING (true);
CREATE POLICY "clientes_all" ON clientes FOR ALL TO authenticated USING (true);
