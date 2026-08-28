"use client";

import Link from 'next/link';
import Image from 'next/image';
import { useSearchParams } from 'next/navigation';
import { useState, useEffect, Suspense } from "react";
import { Building2, Briefcase, Factory, Store, Building, LogOut, RefreshCw } from 'lucide-react';

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
  const tenantSchema = searchParams.get("tenant");
  const [tenantName, setTenantName] = useState("Cargando...");
  const [tenantIcon, setTenantIcon] = useState<IconName>("Building2");
  const [tenantLogo, setTenantLogo] = useState<string | null>(null);

  useEffect(() => {
    if (tenantSchema) {
      const host = window.location.hostname;
      fetch(`http://${host}:8000/api/tenants/${tenantSchema}/dashboard`)
        .then(res => res.json())
        .then(data => {
          if (data && data.tenant) {
            setTenantName(data.tenant.name);
            setTenantIcon((data.tenant.icon as IconName) || "Building2");
            setTenantLogo(data.tenant.logo_base64 || null);
          }
        })
        .catch(err => console.error(err));
    }
  }, [tenantSchema]);

  const SelectedIcon = ICON_OPTIONS[tenantIcon] || Building2;

  // Rutas protegidas que mantienen el tenant
  const getHref = (path: string) => tenantSchema ? `${path}?tenant=${tenantSchema}` : path;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <nav className="bg-slate-900 text-white shadow-2xl border-b border-teal-500/30 sticky top-0 z-50">
        <div className="w-full mx-auto px-4 sm:px-8 lg:px-12">
          <div className="flex items-center justify-between h-20">
            
            {/* Sección Izquierda: Logos y Links */}
            <div className="flex items-center gap-8">
              
              {/* Branding combinado */}
              <div className="flex items-center gap-4">
                {/* Logo Principal Sistema */}
                <div className="w-16 h-16 relative bg-white p-3 rounded-xl shadow-sm hidden sm:block">
                  <Image 
                    src="/rengifo_logo_ icon.svg" 
                    alt="SaaS Rengifo" 
                    fill 
                    className="object-contain p-1"
                  />
                </div>
                
                <div className="h-8 w-px bg-white/20 hidden sm:block"></div>
                
                {/* Logo/Icono de la Empresa Activa */}
                {tenantSchema && (
                  <div className="flex items-center gap-3 bg-white/5 px-4 py-2 rounded-xl border border-teal-500/30 shadow-inner">
                    {tenantLogo ? (
                      <div className="w-8 h-8 relative rounded-md overflow-hidden bg-white">
                        <img src={tenantLogo} alt={tenantName} className="object-cover w-full h-full" />
                      </div>
                    ) : (
                      <div className="bg-teal-500/20 p-1.5 rounded-lg text-teal-300">
                        <SelectedIcon className="w-5 h-5" />
                      </div>
                    )}
                    <span className="font-bold text-teal-50 tracking-wide truncate max-w-[150px] md:max-w-[200px]">
                      {tenantName}
                    </span>
                  </div>
                )}
              </div>

              {/* Links de Navegación */}
              {tenantSchema && (
                <div className="hidden lg:block">
                  <div className="flex items-baseline space-x-1">
                    <Link href={getHref("/inicio")} className="px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-300 hover:text-teal-300 hover:bg-white/10 transition-all">Panel de Control</Link>
                    <Link href={getHref("/empleados")} className="px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-300 hover:text-teal-300 hover:bg-white/10 transition-all">Empleados</Link>
                    <Link href={getHref("/boletas")} className="px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-300 hover:text-teal-300 hover:bg-white/10 transition-all">Boletas de Pago</Link>
                    <Link href={getHref("/planillas")} className="px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-300 hover:text-teal-300 hover:bg-white/10 transition-all">Planillas</Link>
                    <Link href={getHref("/prefiniquitos")} className="px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-300 hover:text-teal-300 hover:bg-white/10 transition-all">Prefiniquitos</Link>
                  </div>
                </div>
              )}
            </div>

            {/* Sección Derecha: Acciones */}
            <div className="flex items-center gap-3">
              <Link 
                href="/seleccionar-empresa" 
                className="flex items-center gap-2 text-sm bg-slate-800 border border-slate-600 text-slate-200 px-4 py-2 rounded-xl hover:bg-slate-700 transition-all"
              >
                <RefreshCw className="w-4 h-4" />
                <span className="hidden sm:inline">Cambiar Entorno</span>
              </Link>
              
              <Link 
                href="/" 
                className="flex items-center gap-2 text-sm bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-2 rounded-xl hover:bg-red-500 hover:text-white transition-all shadow-lg"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline">Cerrar Sesión</span>
              </Link>
            </div>
            
          </div>
        </div>
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
