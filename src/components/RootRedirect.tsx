import { Navigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { TIENDA_BASE } from '@/tienda/routes'

/** Raíz: clientes → tienda; staff con sesión → panel */
export function RootRedirect() {
  const { user, loading, isCajero } = useAuth()

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-rose-950">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-rose-200 border-t-transparent" />
      </div>
    )
  }

  if (user) {
    return <Navigate to={isCajero ? '/pos' : '/dashboard'} replace />
  }

  return <Navigate to={TIENDA_BASE} replace />
}
