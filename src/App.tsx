import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from '@/contexts/AuthContext'
import { ThemeProvider } from '@/contexts/ThemeContext'
import { ProtectedRoute, AdminRoute } from '@/components/ProtectedRoute'
import { RootRedirect } from '@/components/RootRedirect'
import { PedirLegacyRedirect } from '@/components/PedirLegacyRedirect'
import { Layout } from '@/components/Layout'
import { LoginPage } from '@/pages/LoginPage'
import { DashboardPage } from '@/pages/DashboardPage'
import { ProductosPage } from '@/pages/ProductosPage'
import { PosPage } from '@/pages/PosPage'
import { CierreCajaPage } from '@/pages/CierreCajaPage'
import { ComprasPage } from '@/pages/ComprasPage'
import { DeudasProveedorPage } from '@/pages/DeudasProveedorPage'
import { LotesPage } from '@/pages/LotesPage'
import { DevolucionesPage } from '@/pages/DevolucionesPage'
import { ReportesPage } from '@/pages/ReportesPage'
import { PedidosWebPage } from '@/pages/PedidosWebPage'
import { ConsumoPage } from '@/pages/ConsumoPage'
import { HistorialTicketsPage } from '@/pages/HistorialTicketsPage'
import { TiendaCartProvider } from '@/tienda/context/TiendaCartContext'
import { TiendaLayout } from '@/tienda/components/TiendaLayout'
import { TiendaPage } from '@/tienda/pages/TiendaPage'
import { CarritoPage } from '@/tienda/pages/CarritoPage'
import { CheckoutPage } from '@/tienda/pages/CheckoutPage'
import { ConfirmadoPage } from '@/tienda/pages/ConfirmadoPage'
import { TIENDA_BASE } from '@/tienda/routes'

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
        <Routes>
          <Route path="/" element={<RootRedirect />} />
          <Route path="/login" element={<LoginPage />} />

          {/* Link antiguo → tienda */}
          <Route path="/pedir/*" element={<PedirLegacyRedirect />} />

          {/* Tienda pública MARGHOT — sin login */}
          <Route
            path={TIENDA_BASE}
            element={
              <TiendaCartProvider>
                <TiendaLayout />
              </TiendaCartProvider>
            }
          >
            <Route index element={<TiendaPage />} />
            <Route path="carrito" element={<CarritoPage />} />
            <Route path="checkout" element={<CheckoutPage />} />
            <Route path="confirmado" element={<ConfirmadoPage />} />
          </Route>

          <Route element={<ProtectedRoute />}>
            <Route element={<Layout />}>
              <Route path="/pos" element={<PosPage />} />
              <Route path="/tickets" element={<HistorialTicketsPage />} />
              <Route path="/pedidos-web" element={<PedidosWebPage />} />
              <Route path="/consumo" element={<ConsumoPage />} />
              <Route path="/devoluciones" element={<DevolucionesPage />} />
              <Route path="/cierre-caja" element={<CierreCajaPage />} />

              <Route element={<AdminRoute />}>
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route path="/productos" element={<ProductosPage />} />
                <Route path="/compras" element={<ComprasPage />} />
                <Route path="/deudas-proveedor" element={<DeudasProveedorPage />} />
                <Route path="/lotes" element={<LotesPage />} />
                <Route path="/reportes" element={<ReportesPage />} />
              </Route>
            </Route>
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
    </ThemeProvider>
  )
}
