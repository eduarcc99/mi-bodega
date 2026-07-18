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
  icon: ComponentType<{ className?: string }>;
};

const adminLinks: NavItem[] = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/productos", label: "Productos", icon: Package },
  { to: "/pedidos-web", label: "Pedidos web", icon: ClipboardList },
  { to: "/pos", label: "Punto de venta", icon: ShoppingCart },
  { to: "/consumo", label: "Consumo propio", icon: ShoppingBasket },
  { to: "/compras", label: "Compras", icon: Truck },
  { to: "/lotes", label: "Lotes / vencimientos", icon: Layers },
  { to: "/deudas-proveedor", label: "Deudas proveedor", icon: Clock },
  { to: "/tickets", label: "Tickets", icon: Receipt },
  { to: "/devoluciones", label: "Devoluciones", icon: RotateCcw },
  { to: "/reportes", label: "Reportes", icon: FileText },
  { to: "/cierre-caja", label: "Cierre de caja", icon: Wallet },
];

const cajeroLinks: NavItem[] = [
  { to: "/pos", label: "Punto de venta", icon: ShoppingCart },
  { to: "/tickets", label: "Tickets", icon: Receipt },
  { to: "/pedidos-web", label: "Pedidos web", icon: ClipboardList },
  { to: "/consumo", label: "Consumo propio", icon: ShoppingBasket },
  { to: "/devoluciones", label: "Devoluciones", icon: RotateCcw },
  { to: "/cierre-caja", label: "Cierre de caja", icon: Wallet },
];

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
    isActive
      ? "bg-teal-50 text-teal-700 dark:bg-teal-950 dark:text-teal-300"
      : "text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100"
  }`;

const mobileLinkClass = ({ isActive }: { isActive: boolean }) =>
  `mb-1 flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium ${
    isActive
      ? "bg-teal-50 text-teal-700 dark:bg-teal-950 dark:text-teal-300"
      : "text-slate-600 dark:text-slate-300"
  }`;

function NavItems({
  items,
  onNavigate,
  classNameFn,
  pedidosPendientes,
}: {
  items: NavItem[];
  onNavigate?: () => void;
  classNameFn: (args: { isActive: boolean }) => string;
  pedidosPendientes: number;
}) {
  return (
    <>
      {items.map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          onClick={onNavigate}
          className={classNameFn}
        >
          <span className="relative shrink-0">
            <Icon className="h-5 w-5" />
            {to === "/pedidos-web" && pedidosPendientes > 0 && (
              <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-bold text-white">
                {pedidosPendientes > 9 ? "9+" : pedidosPendientes}
              </span>
            )}
          </span>
          {label}
        </NavLink>
      ))}
    </>
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

  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Sidebar desktop */}
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

        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {isAdmin ? (
            <NavItems items={adminLinks} classNameFn={linkClass} pedidosPendientes={pendientesCount} />
          ) : (
            <NavItems items={cajeroLinks} classNameFn={linkClass} pedidosPendientes={pendientesCount} />
          )}
        </nav>

        <div className="border-t border-slate-100 p-3 dark:border-slate-800">
          <p className="truncate px-3 py-1 text-sm font-medium text-slate-700 dark:text-slate-200">
            {perfil?.nombre}
          </p>
          <button
            onClick={handleLogout}
            className="mt-1 flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40"
          >
            <LogOut className="h-5 w-5" />
            Cerrar sesión
          </button>
        </div>
      </aside>

      {/* Mobile header */}
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
          <nav className="max-h-[70vh] overflow-y-auto border-b border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900 lg:hidden">
            {isAdmin ? (
              <NavItems
                items={adminLinks}
                onNavigate={() => setMenuOpen(false)}
                classNameFn={mobileLinkClass}
                pedidosPendientes={pendientesCount}
              />
            ) : (
              <NavItems
                items={cajeroLinks}
                onNavigate={() => setMenuOpen(false)}
                classNameFn={mobileLinkClass}
                pedidosPendientes={pendientesCount}
              />
            )}
            <button
              onClick={handleLogout}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-sm text-red-600"
            >
              <LogOut className="h-5 w-5" />
              Cerrar sesión
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
  const { perfil } = useAuth();

  return (
    <PedidoNotificationsProvider activo={Boolean(perfil)}>
      <LayoutContent />
    </PedidoNotificationsProvider>
  );
}
