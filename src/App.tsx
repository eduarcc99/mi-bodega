import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from '@/contexts/AuthContext'
import { ProtectedRoute, AdminRoute, CajeroRedirect } from '@/components/ProtectedRoute'
import { Layout } from '@/components/Layout'
import { LoginPage } from '@/pages/LoginPage'
import { DashboardPage } from '@/pages/DashboardPage'
import { ProductosPage } from '@/pages/ProductosPage'
import { PosPage } from '@/pages/PosPage'
import { CierreCajaPage } from '@/pages/CierreCajaPage'
import { ComprasPage } from '@/pages/ComprasPage'
import { DevolucionesPage } from '@/pages/DevolucionesPage'
import { ReportesPage } from '@/pages/ReportesPage'

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />

          <Route element={<ProtectedRoute />}>
            <Route index element={<CajeroRedirect />} />
            <Route element={<Layout />}>
              <Route path="/pos" element={<PosPage />} />
              <Route path="/devoluciones" element={<DevolucionesPage />} />
              <Route path="/cierre-caja" element={<CierreCajaPage />} />

              <Route element={<AdminRoute />}>
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route path="/productos" element={<ProductosPage />} />
                <Route path="/compras" element={<ComprasPage />} />
                <Route path="/reportes" element={<ReportesPage />} />
              </Route>
            </Route>
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
