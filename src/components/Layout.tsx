import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  RotateCcw,
  LayoutDashboard,
  ShoppingCart,
  Package,
  Truck,
  FileText,
  Wallet,
  LogOut,
  Menu,
  X,
  Store,
  ClipboardList,
} from 'lucide-react'
import { useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'

const adminLinks = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/productos', label: 'Productos', icon: Package },
  { to: '/pedidos-web', label: 'Pedidos web', icon: ClipboardList },
  { to: '/compras', label: 'Compras', icon: Truck },
  { to: '/devoluciones', label: 'Devoluciones', icon: RotateCcw },
  { to: '/reportes', label: 'Reportes', icon: FileText },
  { to: '/cierre-caja', label: 'Cierre de caja', icon: Wallet },
]

const cajeroLinks = [
  { to: '/pos', label: 'Punto de venta', icon: ShoppingCart },
  { to: '/pedidos-web', label: 'Pedidos web', icon: ClipboardList },
  { to: '/devoluciones', label: 'Devoluciones', icon: RotateCcw },
  { to: '/cierre-caja', label: 'Cierre de caja', icon: Wallet },
]

export function Layout() {
  const { perfil, signOut, isAdmin } = useAuth()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)

  const links = isAdmin ? [...adminLinks, { to: '/pos', label: 'Punto de venta', icon: ShoppingCart }] : cajeroLinks

  async function handleLogout() {
    await signOut()
    navigate('/login')
  }

  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* Sidebar desktop */}
      <aside className="hidden w-64 flex-col border-r border-slate-200 bg-white lg:flex">
        <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-600 text-white">
            <Store className="h-5 w-5" />
          </div>
          <div>
            <p className="font-bold text-slate-900">Mi Bodega</p>
            <p className="text-xs capitalize text-slate-500">{perfil?.rol ?? 'usuario'}</p>
          </div>
        </div>

        <nav className="flex-1 space-y-1 p-3">
          {links.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-teal-50 text-teal-700'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`
              }
            >
              <Icon className="h-5 w-5 shrink-0" />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-slate-100 p-3">
          <p className="truncate px-3 py-1 text-sm font-medium text-slate-700">{perfil?.nombre}</p>
          <button
            onClick={handleLogout}
            className="mt-1 flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-red-600 hover:bg-red-50"
          >
            <LogOut className="h-5 w-5" />
            Cerrar sesión
          </button>
        </div>
      </aside>

      {/* Mobile header */}
      <div className="flex flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 lg:hidden">
          <div className="flex items-center gap-2">
            <Store className="h-6 w-6 text-teal-600" />
            <span className="font-bold text-slate-900">Mi Bodega</span>
          </div>
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="rounded-lg p-2 text-slate-600 hover:bg-slate-100"
            aria-label="Menú"
          >
            {menuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </header>

        {menuOpen && (
          <nav className="border-b border-slate-200 bg-white p-3 lg:hidden">
            {links.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                onClick={() => setMenuOpen(false)}
                className={({ isActive }) =>
                  `mb-1 flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium ${
                    isActive ? 'bg-teal-50 text-teal-700' : 'text-slate-600'
                  }`
                }
              >
                <Icon className="h-5 w-5" />
                {label}
              </NavLink>
            ))}
            <button
              onClick={handleLogout}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-sm text-red-600"
            >
              <LogOut className="h-5 w-5" />
              Cerrar sesión
            </button>
          </nav>
        )}

        <main className="flex-1 overflow-auto p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}