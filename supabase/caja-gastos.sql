-- ============================================================
-- CAJA: gastos del día + columnas extra en cierre
-- Ejecutar en Supabase → SQL Editor
-- ============================================================

-- Gastos de caja (compra pollo, pago delivery, etc.)
CREATE TABLE IF NOT EXISTS gastos_caja (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  fecha DATE NOT NULL DEFAULT CURRENT_DATE,
  monto NUMERIC(12,2) NOT NULL CHECK (monto > 0),
  descripcion TEXT NOT NULL,
  categoria TEXT NOT NULL DEFAULT 'otro',
  afecta_efectivo BOOLEAN NOT NULL DEFAULT true,
  registrado_por UUID REFERENCES perfiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Ampliar cierres de caja
ALTER TABLE cierres_caja ADD COLUMN IF NOT EXISTS efectivo_inicial NUMERIC(12,2) NOT NULL DEFAULT 0;
ALTER TABLE cierres_caja ADD COLUMN IF NOT EXISTS total_gastos NUMERIC(12,2) NOT NULL DEFAULT 0;
ALTER TABLE cierres_caja ADD COLUMN IF NOT EXISTS efectivo_esperado NUMERIC(12,2) NOT NULL DEFAULT 0;

-- RLS
ALTER TABLE gastos_caja ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "gastos_select" ON gastos_caja;
DROP POLICY IF EXISTS "gastos_insert" ON gastos_caja;
DROP POLICY IF EXISTS "gastos_delete" ON gastos_caja;

CREATE POLICY "gastos_select" ON gastos_caja FOR SELECT TO authenticated USING (true);
CREATE POLICY "gastos_insert" ON gastos_caja FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "gastos_delete" ON gastos_caja FOR DELETE TO authenticated USING (true);

SELECT 'Módulo de caja instalado' AS resultado;
