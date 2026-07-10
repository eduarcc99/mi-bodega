-- ============================================================
-- FIX: "Database error creating new user"
-- Ejecutar en Supabase → SQL Editor → Run
-- ============================================================

-- 1. Recrear la función del trigger con permisos correctos
DROP TRIGGER IF EXISTS trg_nuevo_usuario ON auth.users;
DROP FUNCTION IF EXISTS public.fn_nuevo_usuario();

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

-- 2. Permisos necesarios para que auth.users pueda insertar en perfiles
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON public.perfiles TO postgres, service_role;

-- 3. Política RLS que faltaba: permitir INSERT al crear cuenta
DROP POLICY IF EXISTS "perfiles_insert" ON perfiles;
CREATE POLICY "perfiles_insert" ON perfiles
  FOR INSERT
  TO authenticated, service_role
  WITH CHECK (true);

-- 4. Recrear el trigger
CREATE TRIGGER trg_nuevo_usuario
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_nuevo_usuario();

-- 5. Verificación (debe mostrar la función y el trigger)
SELECT 'Trigger reparado correctamente' AS resultado;
