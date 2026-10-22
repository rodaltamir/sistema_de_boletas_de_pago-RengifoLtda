"use client";

import Link from 'next/link';
import Image from 'next/image';
import { useSearchParams, usePathname } from 'next/navigation';
import { useState, useEffect, Suspense } from "react";
import { 
  Building2, 
  Briefcase, 
  Factory, 
  Store, 
  Building, 
  LogOut, 
  RefreshCw, 
  Calendar,
  LayoutDashboard,
  Users,
  Calculator,
  Receipt,
  BookOpen,
  UserMinus,
  Menu,
  X
} from 'lucide-react';
import { getApiUrl } from "@/utils/api";

const ICON_OPTIONS = {
  Building2,
  Briefcase,
  Factory,
  Store,
  Building
};
type IconName = keyof typeof ICON_OPTIONS;

function DashboardLayoutContent({
  children,
}: {
  children: React.ReactNode;
}) {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const tenantSchema = searchParams.get("tenant");
  const [tenantName, setTenantName] = useState("Cargando...");
  const [tenantIcon, setTenantIcon] = useState<IconName>("Building2");
  const [tenantLogo, setTenantLogo] = useState<string | null>(null);
  const [hasVacaciones, setHasVacaciones] = useState(false);
  const [hasEventuales, setHasEventuales] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (tenantSchema) {
      fetch(`${getApiUrl()}/api/tenants/${tenantSchema}/dashboard`)
        .then(res => res.json())
        .then(data => {
          if (data && data.tenant) {
            setTenantName(data.tenant.name);
            setTenantIcon((data.tenant.icon as IconName) || "Building2");
            setTenantLogo(data.tenant.logo_base64 || null);
            setHasVacaciones(Boolean(data.tenant.has_vacaciones));
            setHasEventuales(Boolean(data.tenant.has_eventuales));
          }
        })
        .catch(err => console.error(err));
    }
  }, [tenantSchema]);

  const SelectedIcon = ICON_OPTIONS[tenantIcon] || Building2;

  // Rutas protegidas que mantienen el tenant
  const getHref = (path: string) => tenantSchema ? `${path}?tenant=${tenantSchema}` : path;

  // Determinar si una ruta está activa
  const isItemActive = (path: string) => {
    if (!pathname) return false;
    if (path === "/inicio") {
      return pathname === "/inicio" || pathname === "/";
    }
    return pathname === path || pathname.startsWith(path + "/");
  };

  const navItems = [
    { name: "Panel de Control", path: "/inicio", icon: LayoutDashboard },
    { name: "Personal", path: "/empleados", icon: Users },
    { name: "Planillas", path: "/planillas", icon: Calculator },
    ...(hasVacaciones ? [{ name: "Vacaciones", path: "/vacaciones", icon: Calendar }] : []),
    { name: "Boletas", path: "/boletas", icon: Receipt },
    { name: "Asientos", path: "/asientos", icon: BookOpen },
    { name: "Prefiniquitos", path: "/prefiniquitos", icon: UserMinus },
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <nav className="bg-slate-900 text-white shadow-2xl border-b border-teal-500/30 sticky top-0 z-50">
        <div className="w-full mx-auto px-3 sm:px-5 lg:px-7">
          <div className="flex items-center justify-between h-20 gap-3">
            
            {/* Sección Izquierda: Logos y Branding */}
            <div className="flex items-center gap-4 min-w-0 shrink-0">
              
              {/* Logo Principal Sistema */}
              <Link href={getHref("/inicio")} className="flex items-center gap-2 group shrink-0">
                <div className="w-13 h-13 sm:w-14 sm:h-14 relative bg-white p-2 sm:p-2.5 rounded-xl shadow-md border border-white/10 group-hover:scale-105 transition-transform shrink-0">
                  <Image 
                    src="/rengifo_logo_ icon.svg" 
                    alt="SaaS Rengifo" 
                    fill 
                    className="object-contain p-1"
                  />
                </div>
              </Link>
              
              <div className="h-8 w-px bg-white/15 hidden sm:block shrink-0"></div>
              
              {/* Logo/Icono y Nombre Completo de la Empresa Activa */}
              {tenantSchema && (
                <div className="flex items-center gap-2.5 bg-slate-800/80 px-3.5 py-1.5 rounded-xl border border-teal-500/30 shadow-sm shrink-0">
                  {tenantLogo ? (
                    <div className="w-7 h-7 sm:w-8 sm:h-8 relative rounded-lg overflow-hidden bg-white shrink-0 shadow-xs border border-white/20">
                      <img src={tenantLogo} alt={tenantName} className="object-cover w-full h-full" />
                    </div>
                  ) : (
                    <div className="bg-teal-500/20 p-1.5 rounded-lg text-teal-300 shrink-0">
                      <SelectedIcon className="w-4 h-4" />
                    </div>
                  )}
                  <div className="flex flex-col min-w-0 pr-1">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-teal-400/90 leading-none">
                      Empresa
                    </span>
                    <span className="font-bold text-xs sm:text-sm text-teal-50 whitespace-nowrap leading-snug mt-0.5">
                      {tenantName}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Links de Navegación (Desktop) */}
            {tenantSchema && (
              <div className="hidden lg:flex items-center gap-1 xl:gap-1.5 overflow-x-auto py-1 scrollbar-none">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const active = isItemActive(item.path);
                  return (
                    <Link
                      key={item.path}
                      href={getHref(item.path)}
                      className={`group px-3 py-1.5 rounded-xl text-xs xl:text-sm font-medium transition-all duration-200 flex items-center gap-1.5 whitespace-nowrap ${
                        active
                          ? "bg-sky-500/15 text-sky-200 border border-sky-400/80 shadow-md shadow-sky-500/20 font-semibold ring-1 ring-sky-400/30"
                          : "text-slate-300 hover:text-white hover:bg-white/10 border border-transparent"
                      }`}
                    >
                      <span>{item.name}</span>
                      <Icon
                        className={`w-4 h-4 transition-transform group-hover:scale-110 shrink-0 ${
                          active ? "text-sky-300 drop-shadow" : "text-slate-400 group-hover:text-slate-200"
                        }`}
                      />
                    </Link>
                  );
                })}
              </div>
            )}

            {/* Sección Derecha: Acciones y Botón Móvil */}
            <div className="flex items-center gap-2 sm:gap-3 shrink-0">
              <Link 
                href="/seleccionar-empresa" 
                className="hidden sm:flex items-center gap-2 text-xs sm:text-sm bg-slate-800 border border-slate-700 text-slate-200 px-3.5 py-2 rounded-xl hover:bg-slate-700 hover:border-slate-500 transition-all shadow-xs whitespace-nowrap"
              >
                <RefreshCw className="w-3.5 h-3.5 text-teal-400" />
                <span>Cambiar Entorno</span>
              </Link>
              
              <Link 
                href="/" 
                className="hidden sm:flex items-center gap-2 text-xs sm:text-sm bg-red-500/10 border border-red-500/30 text-red-300 px-3.5 py-2 rounded-xl hover:bg-red-500 hover:text-white transition-all shadow-xs whitespace-nowrap"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Cerrar Sesión</span>
              </Link>

              {/* Botón menú móvil */}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="lg:hidden p-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-200 hover:text-white hover:bg-slate-700 transition-all"
                aria-label="Abrir menú"
              >
                {mobileMenuOpen ? <X className="w-5 h-5 text-teal-400" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>
            
          </div>
        </div>

        {/* Menú Móvil desplegable */}
        {mobileMenuOpen && (
          <div className="lg:hidden border-t border-slate-800 bg-slate-900/95 backdrop-blur-md px-4 py-4 space-y-2">
            {tenantSchema && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const active = isItemActive(item.path);
                  return (
                    <Link
                      key={item.path}
                      href={getHref(item.path)}
                      onClick={() => setMobileMenuOpen(false)}
                      className={`px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all flex items-center justify-between ${
                        active
                          ? "bg-sky-500/20 text-sky-200 border border-sky-400/80 shadow-md font-semibold"
                          : "text-slate-300 hover:text-white hover:bg-white/5 border border-transparent"
                      }`}
                    >
                      <span>{item.name}</span>
                      <Icon className={`w-4 h-4 ${active ? "text-sky-300" : "text-slate-400"}`} />
                    </Link>
                  );
                })}
              </div>
            )}

            <div className="pt-2 border-t border-slate-800 flex flex-col gap-2">
              <Link 
                href="/seleccionar-empresa" 
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center justify-between text-sm bg-slate-800 border border-slate-700 text-slate-200 px-4 py-2.5 rounded-xl hover:bg-slate-700 transition-all"
              >
                <span>Cambiar Entorno</span>
                <RefreshCw className="w-4 h-4 text-teal-400" />
              </Link>
              
              <Link 
                href="/" 
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center justify-between text-sm bg-red-500/10 border border-red-500/30 text-red-300 px-4 py-2.5 rounded-xl hover:bg-red-500 hover:text-white transition-all"
              >
                <span>Cerrar Sesión</span>
                <LogOut className="w-4 h-4" />
              </Link>
            </div>
          </div>
        )}
      </nav>

      <main className="flex-1 w-full mx-auto p-4 sm:p-8 lg:p-12">
        {children}
      </main>
    </div>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-900 flex items-center justify-center"><div className="w-8 h-8 border-4 border-teal-500 border-t-transparent rounded-full animate-spin"></div></div>}>
      <DashboardLayoutContent>{children}</DashboardLayoutContent>
    </Suspense>
  );
}
