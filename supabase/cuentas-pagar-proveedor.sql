-- ============================================================
-- CUENTAS POR PAGAR A PROVEEDORES (fiado, cuotas, pago parcial)
-- Ejecutar en Supabase → SQL Editor (después de compras-pago-caja.sql)
-- ============================================================

ALTER TABLE compras
  ADD COLUMN IF NOT EXISTS monto_pagado NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (monto_pagado >= 0);

ALTER TABLE compras
  ADD COLUMN IF NOT EXISTS monto_pendiente NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (monto_pendiente >= 0);

ALTER TABLE compras
  ADD COLUMN IF NOT EXISTS estado_pago TEXT NOT NULL DEFAULT 'pagado'
    CHECK (estado_pago IN ('pagado', 'parcial', 'pendiente'));

CREATE TABLE IF NOT EXISTS cuotas_proveedor (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  compra_id UUID NOT NULL REFERENCES compras(id) ON DELETE CASCADE,
  monto NUMERIC(12,2) NOT NULL CHECK (monto > 0),
  fecha_vencimiento DATE NOT NULL,
  descripcion TEXT,
  pagado BOOLEAN NOT NULL DEFAULT false,
  fecha_pago TIMESTAMPTZ,
  metodo_pago metodo_pago,
  gasto_caja_id UUID REFERENCES gastos_caja(id) ON DELETE SET NULL,
  registrado_por UUID REFERENCES perfiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cuotas_proveedor_vencimiento ON cuotas_proveedor(fecha_vencimiento);
CREATE INDEX IF NOT EXISTS idx_cuotas_proveedor_pendiente ON cuotas_proveedor(pagado) WHERE pagado = false;
CREATE INDEX IF NOT EXISTS idx_cuotas_proveedor_compra ON cuotas_proveedor(compra_id);

ALTER TABLE cuotas_proveedor ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cuotas_proveedor_all" ON cuotas_proveedor;
CREATE POLICY "cuotas_proveedor_all" ON cuotas_proveedor
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Compras ya pagadas antes de este módulo
UPDATE compras
SET
  monto_pagado = total,
  monto_pendiente = 0,
  estado_pago = 'pagado'
WHERE monto_pendiente = 0 AND monto_pagado = 0 AND metodo_pago IN ('efectivo', 'yape');

UPDATE compras
SET
  monto_pagado = 0,
  monto_pendiente = total,
  estado_pago = 'pendiente'
WHERE monto_pendiente = 0 AND monto_pagado = 0 AND metodo_pago = 'otro';

SELECT 'Cuentas por pagar a proveedores instaladas' AS resultado;
