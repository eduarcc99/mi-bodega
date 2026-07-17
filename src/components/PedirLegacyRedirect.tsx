import { Navigate, useLocation } from 'react-router-dom'
import { TIENDA_BASE } from '@/tienda/routes'

/** Redirige /pedir/... → /marghot/... (links viejos de WhatsApp) */
export function PedirLegacyRedirect() {
  const { pathname } = useLocation()
  const rest = pathname.replace(/^\/pedir\/?/, '')
  const target = rest ? `${TIENDA_BASE}/${rest}` : TIENDA_BASE
  return <Navigate to={target} replace />
}
