import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
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
  ShoppingBasket,
  Receipt,
  ChevronDown,
  MoreHorizontal,
} from "lucide-react";
import { useEffect, useState, type ComponentType } from "react";
import { useAuth } from "@/contexts/AuthContext";

type NavItem = {
  to: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
};

const adminPrimaryLinks: NavItem[] = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/productos", label: "Productos", icon: Package },
  { to: "/pedidos-web", label: "Pedidos web", icon: ClipboardList },
  { to: "/pos", label: "Punto de venta", icon: ShoppingCart },
];

const adminMoreLinks: NavItem[] = [
  { to: "/consumo", label: "Consumo propio", icon: ShoppingBasket },
  { to: "/compras", label: "Compras", icon: Truck },
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
      ? "bg-teal-50 text-teal-700"
      : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
  }`;

const mobileLinkClass = ({ isActive }: { isActive: boolean }) =>
  `mb-1 flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium ${
    isActive ? "bg-teal-50 text-teal-700" : "text-slate-600"
  }`;

function NavItems({
  items,
  onNavigate,
  classNameFn,
}: {
  items: NavItem[];
  onNavigate?: () => void;
  classNameFn: (args: { isActive: boolean }) => string;
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
          <Icon className="h-5 w-5 shrink-0" />
          {label}
        </NavLink>
      ))}
    </>
  );
}

export function Layout() {
  const { perfil, signOut, isAdmin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);

  const inMoreSection =
    isAdmin && adminMoreLinks.some((l) => location.pathname.startsWith(l.to));

  useEffect(() => {
    if (inMoreSection) setMoreOpen(true);
  }, [inMoreSection]);

  async function handleLogout() {
    await signOut();
    navigate("/login");
  }

  function renderAdminNav(onNavigate?: () => void, mobile = false) {
    const classNameFn = mobile ? mobileLinkClass : linkClass;
    return (
      <>
        <NavItems
          items={adminPrimaryLinks}
          onNavigate={onNavigate}
          classNameFn={classNameFn}
        />
        <div className={mobile ? "mb-1" : ""}>
          <button
            type="button"
            onClick={() => setMoreOpen((v) => !v)}
            className={`flex w-full items-center gap-3 rounded-lg px-3 text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 ${
              mobile ? "py-3" : "py-2.5"
            } ${inMoreSection && !moreOpen ? "bg-slate-50 text-teal-700" : ""}`}
            aria-expanded={moreOpen}
          >
            <MoreHorizontal className="h-5 w-5 shrink-0" />
            <span className="flex-1 text-left">Más</span>
            <ChevronDown
              className={`h-4 w-4 shrink-0 transition-transform ${
                moreOpen ? "rotate-180" : ""
              }`}
            />
          </button>
          {moreOpen && (
            <div className={`mt-1 space-y-1 ${mobile ? "" : "pl-2"}`}>
              <NavItems
                items={adminMoreLinks}
                onNavigate={onNavigate}
                classNameFn={classNameFn}
              />
            </div>
          )}
        </div>
      </>
    );
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
            <p className="text-xs capitalize text-slate-500">
              {perfil?.rol ?? "usuario"}
            </p>
          </div>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {isAdmin ? (
            renderAdminNav()
          ) : (
            <NavItems items={cajeroLinks} classNameFn={linkClass} />
          )}
        </nav>

        <div className="border-t border-slate-100 p-3">
          <p className="truncate px-3 py-1 text-sm font-medium text-slate-700">
            {perfil?.nombre}
          </p>
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
            {menuOpen ? (
              <X className="h-6 w-6" />
            ) : (
              <Menu className="h-6 w-6" />
            )}
          </button>
        </header>

        {menuOpen && (
          <nav className="border-b border-slate-200 bg-white p-3 lg:hidden">
            {isAdmin ? (
              renderAdminNav(() => setMenuOpen(false), true)
            ) : (
              <NavItems
                items={cajeroLinks}
                onNavigate={() => setMenuOpen(false)}
                classNameFn={mobileLinkClass}
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

        <main className="flex-1 overflow-auto p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
