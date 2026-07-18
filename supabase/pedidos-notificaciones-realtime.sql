-- Habilitar Realtime en pedidos_web para alertas instantáneas en la PWA
-- Ejecutar una vez en Supabase → SQL Editor

ALTER TABLE pedidos_web REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'pedidos_web'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE pedidos_web;
  END IF;
END $$;
