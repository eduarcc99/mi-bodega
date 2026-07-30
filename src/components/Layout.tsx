import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useDocumentMeta } from "@/hooks/useDocumentMeta";
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
  Clock,
  Layers,
  ClipboardList,
  ShoppingBasket,
  Receipt,
} from "lucide-react";
import { useState, type ComponentType } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { BrandThemeToggle } from "@/components/BrandThemeToggle";
import {
  PedidoNotificationsProvider,
  usePedidoNotificationsContext,
} from "@/contexts/PedidoNotificationsContext";
import { PedidoPendienteAlertas } from "@/components/PedidoPendienteAlertas";

type NavItem = {
  to: string;
  label: string;
  shortLabel?: string;
  icon: ComponentType<{ className?: string }>;
  iconBg: string;
};

const adminLinks: NavItem[] = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, iconBg: "bg-blue-500" },
  { to: "/productos", label: "Productos", icon: Package, iconBg: "bg-teal-500" },
  { to: "/pedidos-web", label: "Pedidos web", shortLabel: "Pedidos", icon: ClipboardList, iconBg: "bg-amber-500" },
  { to: "/pos", label: "Punto de venta", shortLabel: "POS", icon: ShoppingCart, iconBg: "bg-emerald-500" },
  { to: "/consumo", label: "Consumo propio", shortLabel: "Consumo", icon: ShoppingBasket, iconBg: "bg-orange-500" },
  { to: "/compras", label: "Compras", icon: Truck, iconBg: "bg-violet-500" },
  { to: "/lotes", label: "Lotes / vencimientos", shortLabel: "Lotes", icon: Layers, iconBg: "bg-yellow-500" },
  { to: "/deudas-proveedor", label: "Deudas proveedor", shortLabel: "Deudas", icon: Clock, iconBg: "bg-rose-500" },
  { to: "/tickets", label: "Tickets", icon: Receipt, iconBg: "bg-indigo-500" },
  { to: "/devoluciones", label: "Devoluciones", icon: RotateCcw, iconBg: "bg-sky-500" },
  { to: "/reportes", label: "Reportes", icon: FileText, iconBg: "bg-cyan-600" },
  { to: "/cierre-caja", label: "Cierre de caja", shortLabel: "Caja", icon: Wallet, iconBg: "bg-purple-600" },
];

const cajeroLinks: NavItem[] = [
  { to: "/pos", label: "Punto de venta", shortLabel: "POS", icon: ShoppingCart, iconBg: "bg-emerald-500" },
  { to: "/tickets", label: "Tickets", icon: Receipt, iconBg: "bg-indigo-500" },
  { to: "/pedidos-web", label: "Pedidos web", shortLabel: "Pedidos", icon: ClipboardList, iconBg: "bg-amber-500" },
  { to: "/consumo", label: "Consumo propio", shortLabel: "Consumo", icon: ShoppingBasket, iconBg: "bg-orange-500" },
  { to: "/devoluciones", label: "Devoluciones", icon: RotateCcw, iconBg: "bg-sky-500" },
  { to: "/cierre-caja", label: "Cierre de caja", shortLabel: "Caja", icon: Wallet, iconBg: "bg-purple-600" },
];

function NavGrid({
  items,
  onNavigate,
  columns = 2,
  pedidosPendientes,
}: {
  items: NavItem[];
  onNavigate?: () => void;
  columns?: 2 | 3;
  pedidosPendientes: number;
}) {
  return (
    <div
      className={`grid gap-2 ${columns === 3 ? "grid-cols-3" : "grid-cols-2"}`}
    >
      {items.map(({ to, label, shortLabel, icon: Icon, iconBg }) => (
        <NavLink
          key={to}
          to={to}
          onClick={onNavigate}
          title={label}
          className={({ isActive }) =>
            `group flex flex-col items-center gap-2 rounded-2xl px-2 py-3 transition-all ${
              isActive
                ? "bg-slate-100 ring-2 ring-teal-500 ring-offset-2 ring-offset-white dark:bg-slate-800 dark:ring-offset-slate-900"
                : "hover:bg-slate-50 dark:hover:bg-slate-800/80"
            }`
          }
        >
          {({ isActive }) => (
            <>
              <span className="relative">
                <span
                  className={`flex h-12 w-12 items-center justify-center rounded-2xl shadow-md transition-transform group-hover:scale-105 ${iconBg} ${
                    isActive ? "scale-105 ring-2 ring-white/40" : ""
                  }`}
                >
                  <Icon className="h-6 w-6 text-white" />
                </span>
                {to === "/pedidos-web" && pedidosPendientes > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white shadow">
                    {pedidosPendientes > 9 ? "9+" : pedidosPendientes}
                  </span>
                )}
              </span>
              <span
                className={`text-center text-[11px] font-semibold leading-tight ${
                  isActive
                    ? "text-teal-700 dark:text-teal-300"
                    : "text-slate-600 dark:text-slate-300"
                }`}
              >
                {shortLabel ?? label}
              </span>
            </>
          )}
        </NavLink>
      ))}
    </div>
  );
}

function LayoutContent() {
  const { perfil, signOut, isAdmin } = useAuth();
  const { pendientesCount } = usePedidoNotificationsContext();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  useDocumentMeta("Mi Bodega", "/favicon_.svg");

  async function handleLogout() {
    await signOut();
    navigate("/login");
  }

  const navItems = isAdmin ? adminLinks : cajeroLinks;

  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Sidebar desktop — cuadrícula de iconos */}
      <aside className="hidden w-64 flex-col border-r border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 lg:flex">
        <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-5 dark:border-slate-800">
          <BrandThemeToggle size="md" />
          <div>
            <p className="font-bold text-slate-900 dark:text-slate-100">Mi Bodega</p>
            <p className="text-xs capitalize text-slate-500 dark:text-slate-400">
              {perfil?.rol ?? "usuario"}
            </p>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto p-3">
          <NavGrid items={navItems} columns={2} pedidosPendientes={pendientesCount} />
        </nav>

        <div className="border-t border-slate-100 p-3 dark:border-slate-800">
          <p className="truncate px-2 py-1 text-center text-sm font-medium text-slate-700 dark:text-slate-200">
            {perfil?.nombre}
          </p>
          <button
            onClick={handleLogout}
            className="mt-2 flex w-full flex-col items-center gap-2 rounded-2xl px-2 py-3 text-red-600 transition-colors hover:bg-red-50 dark:hover:bg-red-950/40"
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-500 shadow-md">
              <LogOut className="h-6 w-6 text-white" />
            </span>
            <span className="text-[11px] font-semibold">Cerrar sesión</span>
          </button>
        </div>
      </aside>

      {/* Mobile */}
      <div className="flex flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900 lg:hidden">
          <div className="flex items-center gap-2">
            <BrandThemeToggle size="sm" />
            <span className="font-bold text-slate-900 dark:text-slate-100">Mi Bodega</span>
          </div>
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="relative rounded-lg p-2 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
            aria-label="Menú"
          >
            {menuOpen ? (
              <X className="h-6 w-6" />
            ) : (
              <>
                <Menu className="h-6 w-6" />
                {pendientesCount > 0 && (
                  <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-bold text-white">
                    {pendientesCount > 9 ? "9+" : pendientesCount}
                  </span>
                )}
              </>
            )}
          </button>
        </header>

        {menuOpen && (
          <nav className="max-h-[75vh] overflow-y-auto border-b border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 lg:hidden">
            <NavGrid
              items={navItems}
              columns={3}
              onNavigate={() => setMenuOpen(false)}
              pedidosPendientes={pendientesCount}
            />
            <button
              onClick={handleLogout}
              className="mt-3 flex w-full flex-col items-center gap-2 rounded-2xl py-3 text-red-600"
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-500 shadow-md">
                <LogOut className="h-6 w-6 text-white" />
              </span>
              <span className="text-[11px] font-semibold">Cerrar sesión</span>
            </button>
          </nav>
        )}

        <PedidoPendienteAlertas />

        <main className="flex-1 overflow-auto p-4 md:p-6 dark:bg-slate-950">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export function Layout() {
  const { perfil, user } = useAuth();

  return (
    <PedidoNotificationsProvider activo={Boolean(perfil)} userId={user?.id ?? null}>
      <LayoutContent />
    </PedidoNotificationsProvider>
  );
}
