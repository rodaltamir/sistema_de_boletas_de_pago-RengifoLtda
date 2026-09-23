"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Building2,
  Save,
  Edit3,
  Loader2,
  Users,
  Receipt,
  Briefcase,
  FileText,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  Copy,
  Check,
  DollarSign,
  ArrowRight,
  RefreshCw,
  Award,
  Layers,
  Sparkles,
  Info,
  CheckCircle,
  UserCheck,
  BookOpen
} from "lucide-react";
import Swal from "sweetalert2";
import { getApiUrl } from "@/utils/api";

interface DepartmentStat {
  name: string;
  count: number;
}

interface RecentEmployeeStat {
  id: number;
  full_name: string;
  cargo: string;
  fecha_ingreso?: string | null;
  haber_basico: number;
}

interface LatestPayrollStat {
  id: number;
  month: number;
  year: number;
  is_closed: boolean;
  payslips_count: number;
}

interface TenantData {
  tenant: {
    id: number;
    name: string;
    schema_name: string;
    nit: string | null;
    numero_patronal: string | null;
    caja_salud?: string | null;
    min_trabajo_id: string | null;
    empleador_nombres: string | null;
    empleador_apellido_paterno: string | null;
    empleador_apellido_materno: string | null;
    empleador_ci: string | null;
    empleador_nit: string | null;
    icon: string | null;
    logo_base64: string | null;
  };
  total_employees: number;
  total_desvinculados?: number;
  total_payrolls: number;
  total_departments: number;
  total_payroll_base?: number;
  avg_salary?: number;
  gender_distribution?: { V?: number; M?: number };
  top_departments?: DepartmentStat[];
  recent_employees?: RecentEmployeeStat[];
  latest_payroll?: LatestPayrollStat | null;
  total_prefiniquitos?: number;
  current_smn: number;
  current_year: number;
}

const MONTH_NAMES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
];

const CAJAS_SALUD_BOLIVIA = [
  "Caja Petrolera de Salud",
  "Caja Nacional de Salud"
];

function InicioDashboardContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const tenantSchema = searchParams.get("tenant");

  const [data, setData] = useState<TenantData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<"empresa" | "representante" | "parametros">("empresa");
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Form State (Preserving 100% of data editing fields)
  const [formData, setFormData] = useState({
    name: "",
    nit: "",
    numero_patronal: "",
    caja_salud: "Caja Petrolera de Salud",
    min_trabajo_id: "",
    empleador_nombres: "",
    empleador_apellido_paterno: "",
    empleador_apellido_materno: "",
    empleador_ci: "",
    empleador_nit: "",
    current_smn: 0
  });

  const fetchData = async (showLoader = true) => {
    if (!tenantSchema) {
      router.push("/seleccionar-empresa");
      return;
    }
    if (showLoader) setLoading(true);
    else setRefreshing(true);

    try {
      const res = await fetch(`${getApiUrl()}/api/tenants/${tenantSchema}/dashboard`);
      if (res.ok) {
        const json: TenantData = await res.json();
        setData(json);
        setFormData({
          name: json.tenant.name || "",
          nit: json.tenant.nit || "",
          numero_patronal: json.tenant.numero_patronal || "",
          caja_salud: json.tenant.caja_salud || "Caja Petrolera de Salud",
          min_trabajo_id: json.tenant.min_trabajo_id || "",
          empleador_nombres: json.tenant.empleador_nombres || "",
          empleador_apellido_paterno: json.tenant.empleador_apellido_paterno || "",
          empleador_apellido_materno: json.tenant.empleador_apellido_materno || "",
          empleador_ci: json.tenant.empleador_ci || "",
          empleador_nit: json.tenant.empleador_nit || "",
          current_smn: json.current_smn || 3300
        });
      } else {
        router.push("/seleccionar-empresa");
      }
    } catch (err) {
      console.error("Error fetching dashboard", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    setIsAdmin(localStorage.getItem("isAdmin") === "true");
    fetchData(true);
  }, [tenantSchema]);

  const copyToClipboard = (text: string | null | undefined, fieldKey: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedField(fieldKey);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleStartEditing = (tab?: "empresa" | "representante" | "parametros") => {
    if (tab) setActiveTab(tab);
    setIsEditing(true);
    setTimeout(() => {
      const el = document.getElementById("seccion-configuracion");
      if (el) {
        const yOffset = -90;
        const y = el.getBoundingClientRect().top + window.pageYOffset + yOffset;
        window.scrollTo({ top: y, behavior: "smooth" });
        const firstInput = el.querySelector("input") as HTMLInputElement | null;
        if (firstInput) {
          firstInput.focus();
        }
      }
    }, 150);
  };

  const handleCancelEdit = () => {
    if (!data) return;
    setFormData({
      name: data.tenant.name || "",
      nit: data.tenant.nit || "",
      numero_patronal: data.tenant.numero_patronal || "",
      caja_salud: data.tenant.caja_salud || "Caja Petrolera de Salud",
      min_trabajo_id: data.tenant.min_trabajo_id || "",
      empleador_nombres: data.tenant.empleador_nombres || "",
      empleador_apellido_paterno: data.tenant.empleador_apellido_paterno || "",
      empleador_apellido_materno: data.tenant.empleador_apellido_materno || "",
      empleador_ci: data.tenant.empleador_ci || "",
      empleador_nit: data.tenant.empleador_nit || "",
      current_smn: data.current_smn || 3300
    });
    setIsEditing(false);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      Swal.fire({
        title: "Campo requerido",
        text: "La Razón Social de la empresa no puede estar vacía.",
        icon: "warning",
        confirmButtonColor: "#0d9488"
      });
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`${getApiUrl()}/api/tenants/${tenantSchema}/dashboard`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData)
      });

      if (res.ok) {
        const json: TenantData = await res.json();
        setData(json);
        setFormData({
          name: json.tenant.name || "",
          nit: json.tenant.nit || "",
          numero_patronal: json.tenant.numero_patronal || "",
          caja_salud: json.tenant.caja_salud || "Caja Petrolera de Salud",
          min_trabajo_id: json.tenant.min_trabajo_id || "",
          empleador_nombres: json.tenant.empleador_nombres || "",
          empleador_apellido_paterno: json.tenant.empleador_apellido_paterno || "",
          empleador_apellido_materno: json.tenant.empleador_apellido_materno || "",
          empleador_ci: json.tenant.empleador_ci || "",
          empleador_nit: json.tenant.empleador_nit || "",
          current_smn: json.current_smn || 3300
        });
        setIsEditing(false);

        Swal.fire({
          title: "¡Configuración Guardada!",
          text: "Los datos de la empresa y parámetros fueron actualizados exitosamente.",
          icon: "success",
          timer: 2000,
          showConfirmButton: false
        });
      } else {
        const errorData = await res.json().catch(() => ({}));
        Swal.fire({
          title: "Error al guardar",
          text: errorData.detail || "No se pudo actualizar la información.",
          icon: "error",
          confirmButtonColor: "#e11d48"
        });
      }
    } catch (err) {
      console.error("Error saving data", err);
      Swal.fire({
        title: "Error de conexión",
        text: "Ocurrió un error al intentar comunicarse con el servidor.",
        icon: "error",
        confirmButtonColor: "#e11d48"
      });
    } finally {
      setSaving(false);
    }
  };

  const formatBs = (val?: number) => {
    return `Bs. ${(val || 0).toLocaleString("es-BO", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })}`;
  };

  if (loading) {
    return (
      <div className="flex flex-col h-full items-center justify-center min-h-[60vh] gap-4">
        <div className="relative">
          <div className="w-16 h-16 rounded-2xl bg-teal-500/10 border-2 border-teal-500/30 flex items-center justify-center animate-pulse">
            <Building2 className="w-8 h-8 text-teal-600" />
          </div>
          <Loader2 className="w-6 h-6 text-teal-600 animate-spin absolute -bottom-1 -right-1" />
        </div>
        <p className="text-slate-500 font-medium text-sm animate-pulse">Cargando Panel de Control...</p>
      </div>
    );
  }

  if (!data) return null;

  // Checklist de Cumplimiento Legal (Bolivia)
  const complianceItems = [
    {
      label: "NIT de la Empresa",
      registered: !!data.tenant.nit,
      value: data.tenant.nit,
      key: "nit",
      tab: "empresa" as const,
      desc: "Servicio de Impuestos Nacionales (SIN)"
    },
    {
      label: "N° Patronal (Caja de Salud)",
      registered: !!data.tenant.numero_patronal,
      value: data.tenant.numero_patronal,
      key: "numero_patronal",
      tab: "empresa" as const,
      desc: "Seguridad Social a Corto Plazo"
    },
    {
      label: "ID Ministerio de Trabajo (ROE)",
      registered: !!data.tenant.min_trabajo_id,
      value: data.tenant.min_trabajo_id,
      key: "min_trabajo_id",
      tab: "empresa" as const,
      desc: "Registro Obligatorio de Empleadores"
    },
    {
      label: "Representante Legal Acreditado",
      registered: !!(data.tenant.empleador_nombres && data.tenant.empleador_ci),
      value: data.tenant.empleador_nombres
        ? `${data.tenant.empleador_nombres} ${data.tenant.empleador_apellido_paterno || ""} (CI: ${data.tenant.empleador_ci || "S/N"})`
        : null,
      key: "rep_legal",
      tab: "representante" as const,
      desc: "Poder para planillas y finiquitos"
    }
  ];

  const complianceCount = complianceItems.filter(i => i.registered).length;
  const isComplianceComplete = complianceCount === complianceItems.length;

  // Quick actions
  const quickActions = [
    {
      title: "Planillas de Sueldos",
      subtitle: data.latest_payroll
        ? `Último: ${MONTH_NAMES[data.latest_payroll.month - 1]} ${data.latest_payroll.year}`
        : "Procesar y liquidar salarios",
      href: `/planillas?tenant=${tenantSchema}`,
      icon: Receipt,
      badge: data.latest_payroll ? (data.latest_payroll.is_closed ? "Cerrada" : "Abierta") : "Sin procesar",
      badgeClass: data.latest_payroll?.is_closed
        ? "bg-slate-100 text-slate-700 border-slate-200"
        : "bg-emerald-50 text-emerald-700 border-emerald-200",
      accent: "from-blue-600 to-indigo-600",
      borderHover: "hover:border-blue-400"
    },
    {
      title: "Directorio de Personal",
      subtitle: `${data.total_employees} colaboradores activos`,
      href: `/empleados?tenant=${tenantSchema}`,
      icon: Users,
      badge: Number(data.total_desvinculados || 0) > 0 ? `${data.total_desvinculados} retirados` : "100% activo",
      badgeClass: "bg-teal-50 text-teal-700 border-teal-200",
      accent: "from-teal-600 to-emerald-600",
      borderHover: "hover:border-teal-400"
    },
    {
      title: "Boletas",
      subtitle: "Papeletas de pago mensual y de aguinaldo",
      href: `/boletas?tenant=${tenantSchema}`,
      icon: FileText,
      badge: "Formato Oficial",
      badgeClass: "bg-purple-50 text-purple-700 border-purple-200",
      accent: "from-purple-600 to-indigo-600",
      borderHover: "hover:border-purple-400"
    },
    {
      title: "Prefiniquitos & Liquidación",
      subtitle: "Cálculo según Ley General del Trabajo",
      href: `/prefiniquitos?tenant=${tenantSchema}`,
      icon: Briefcase,
      badge: `${data.total_prefiniquitos || 0} emitidos`,
      badgeClass: "bg-amber-50 text-amber-700 border-amber-200",
      accent: "from-amber-600 to-orange-600",
      borderHover: "hover:border-amber-400"
    },
    {
      title: "Asientos Contables",
      subtitle: "Comprobantes de nómina y cargas patronales",
      href: `/asientos?tenant=${tenantSchema}`,
      icon: BookOpen,
      badge: "Planillas & Pagos",
      badgeClass: "bg-teal-50 text-teal-700 border-teal-200",
      accent: "from-emerald-600 to-teal-600",
      borderHover: "hover:border-emerald-400"
    }
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-8 max-w-7xl mx-auto pb-12"
    >
      {/* 1. HERO BANNER EJECUTIVO */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-850 to-slate-950 text-white p-6 sm:p-8 shadow-xl border border-slate-800">
        <div className="absolute top-0 right-0 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
        <div className="absolute bottom-0 left-1/3 w-64 h-64 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-start sm:items-center gap-5">
            {/* Logo o Icono de Empresa */}
            <div className="relative group shrink-0">
              {data.tenant.logo_base64 ? (
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-white p-2 shadow-lg border border-teal-500/30 overflow-hidden flex items-center justify-center">
                  <img
                    src={data.tenant.logo_base64}
                    alt={data.tenant.name}
                    className="w-full h-full object-contain"
                  />
                </div>
              ) : (
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-tr from-teal-500 to-emerald-400 p-0.5 shadow-lg shadow-teal-500/20">
                  <div className="w-full h-full bg-slate-900 rounded-[14px] flex items-center justify-center">
                    <Building2 className="w-8 h-8 sm:w-10 sm:h-10 text-teal-400" />
                  </div>
                </div>
              )}
              <span className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 border-2 border-slate-900 rounded-full" title="Entorno Conectado" />
            </div>

            <div>
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-teal-500/15 text-teal-300 border border-teal-500/30">
                  <Sparkles className="w-3 h-3 text-teal-400" /> Entorno Activo
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-mono text-slate-400 bg-white/5 border border-white/10">
                  esquema: {data.tenant.schema_name}
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold text-slate-300 bg-slate-800/80 border border-slate-700">
                  Gestión Fiscal {data.current_year}
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight text-white">
                {data.tenant.name}
              </h1>
              <p className="text-slate-400 text-sm mt-1 max-w-2xl">
                Centro de mando central para liquidación de nómina, control laboral y cumplimiento institucional.
              </p>
            </div>
          </div>

          {/* Acciones de Cabecera */}
          <div className="flex items-center gap-3 shrink-0 self-start md:self-center">
            <button
              onClick={() => fetchData(false)}
              disabled={refreshing}
              className="p-2.5 bg-slate-800/90 hover:bg-slate-700 border border-slate-700 text-slate-300 rounded-xl transition shadow hover:text-white"
              title="Actualizar métricas"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin text-teal-400" : ""}`} />
            </button>

            {isAdmin && (
              !isEditing ? (
                <button
                  onClick={() => handleStartEditing("empresa")}
                  className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-teal-500 to-emerald-600 text-white font-bold rounded-xl hover:from-teal-600 hover:to-emerald-700 transition shadow-lg shadow-teal-500/25 hover:scale-[1.02] active:scale-[0.98]"
                >
                  <Edit3 className="w-4 h-4" /> Editar Configuración
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCancelEdit}
                    disabled={saving}
                    className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-600 font-medium rounded-xl transition"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-2 px-5 py-2.5 bg-teal-500 hover:bg-teal-600 text-slate-950 font-black rounded-xl transition shadow-lg shadow-teal-500/30"
                  >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Guardar Cambios
                  </button>
                </div>
              )
            )}
          </div>
        </div>
      </div>

      {/* 2. ACCIONES RÁPIDAS (WORKFLOW DEL SISTEMA) */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
            <Layers className="w-4 h-4 text-teal-600" /> Accesos Rápidos de Operación
          </h2>
          <span className="text-xs text-slate-500">Módulos principales del entorno</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {quickActions.map((action, idx) => {
            const IconComp = action.icon;
            return (
              <Link
                key={idx}
                href={action.href}
                className={`group bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md transition-all duration-200 ${action.borderHover} hover:-translate-y-0.5 flex flex-col justify-between`}
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className={`p-2.5 rounded-xl bg-gradient-to-tr ${action.accent} text-white shadow-sm group-hover:scale-105 transition-transform`}>
                      <IconComp className="w-5 h-5" />
                    </div>
                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${action.badgeClass}`}>
                      {action.badge}
                    </span>
                  </div>
                  <h3 className="font-bold text-slate-800 group-hover:text-teal-600 transition-colors text-base">
                    {action.title}
                  </h3>
                  <p className="text-xs text-slate-500 mt-1 line-clamp-1">
                    {action.subtitle}
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-semibold text-slate-600 group-hover:text-teal-600">
                  <span>Ir al módulo</span>
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      {/* 3. GRID DE KPIS Y MÉTRICAS ESTRATÉGICAS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Tarjeta 1: Personal */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md transition flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Personal</span>
              <div className="p-2.5 bg-teal-50 rounded-xl text-teal-600">
                <Users className="w-5 h-5" />
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-slate-900">{data.total_employees}</span>
              <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                Activos
              </span>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>Desvinculados:</span>
            <span className={`font-bold ${Number(data.total_desvinculados || 0) > 0 ? "text-rose-600" : "text-slate-700"}`}>
              {data.total_desvinculados || 0} registros
            </span>
          </div>
        </div>

        {/* Tarjeta 2: Masa Salarial Básica */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md transition flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Masa Salarial Activa</span>
              <div className="p-2.5 bg-blue-50 rounded-xl text-blue-600">
                <DollarSign className="w-5 h-5" />
              </div>
            </div>
            <div>
              <div className="text-2xl font-black text-slate-900">
                {formatBs(data.total_payroll_base)}
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">Sueldo mensual base contratado</p>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>Promedio:</span>
            <span className="font-bold text-slate-700">{formatBs(data.avg_salary)} / emp.</span>
          </div>
        </div>

        {/* Tarjeta 3: Planillas Procesadas */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md transition flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Ciclo de Planillas</span>
              <div className="p-2.5 bg-indigo-50 rounded-xl text-indigo-600">
                <Receipt className="w-5 h-5" />
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-slate-900">{data.total_payrolls}</span>
              <span className="text-xs text-slate-500 font-medium">periodos</span>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>Última emisión:</span>
            {data.latest_payroll ? (
              <span className="font-bold text-indigo-700">
                {MONTH_NAMES[data.latest_payroll.month - 1]} {data.latest_payroll.year}
              </span>
            ) : (
              <span className="text-slate-400">Sin registros</span>
            )}
          </div>
        </div>

        {/* Tarjeta 4: Salario Mínimo Nacional Bolivia */}
        <div className="bg-gradient-to-br from-teal-500/10 via-emerald-500/5 to-transparent p-6 rounded-2xl border border-teal-200/80 shadow-xs hover:shadow-md transition flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-teal-800">SMN Oficial {data.current_year}</span>
              <div className="p-2.5 bg-teal-600 text-white rounded-xl shadow-xs">
                <Award className="w-5 h-5" />
              </div>
            </div>
            <div className="text-2xl font-black text-teal-900">
              {formatBs(data.current_smn)}
            </div>
            <p className="text-[11px] text-teal-700/80 mt-0.5">Normativa Laboral de Bolivia</p>
          </div>

          <div className="mt-4 pt-3 border-teal-200/50 flex items-center justify-between text-xs text-teal-900 font-semibold">
            <span>Base Antigüedad (3 SMN):</span>
            <span className="font-black text-teal-700">{formatBs((data.current_smn || 0) * 3)}</span>
          </div>
        </div>
      </div>

      {/* 4. SEMÁFORO DE CUMPLIMIENTO INSTITUCIONAL (BOLIVIA) */}
      <div className="bg-white p-6 sm:p-7 rounded-3xl border border-slate-200/80 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
          <div>
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-teal-600" />
              Cumplimiento y Registros Obligatorios de la Empresa (Bolivia)
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Requisitos legales para la emisión de planillas de sueldos ante el Ministerio de Trabajo y Seguridad Social.
            </p>
          </div>

          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold border self-start sm:self-center"
            style={{
              backgroundColor: isComplianceComplete ? "#ecfdf5" : "#fffbeb",
              borderColor: isComplianceComplete ? "#a7f3d0" : "#fde68a",
              color: isComplianceComplete ? "#047857" : "#b45309"
            }}
          >
            {isComplianceComplete ? (
              <>
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Registros Completos (4/4)</span>
              </>
            ) : (
              <>
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                <span>{complianceCount} de 4 Requisitos Registrados</span>
              </>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {complianceItems.map((item, idx) => (
            <div
              key={idx}
              className={`p-4 rounded-2xl border transition-all ${
                item.registered
                  ? "bg-slate-50/70 border-slate-200 hover:bg-slate-50"
                  : "bg-amber-50/40 border-amber-200/80 hover:bg-amber-50"
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-700">{item.label}</span>
                <div className="flex items-center gap-1.5">
                  {item.registered ? (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 flex items-center gap-1">
                      <Check className="w-2.5 h-2.5" /> Al día
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 flex items-center gap-1">
                      <AlertTriangle className="w-2.5 h-2.5" /> Pendiente
                    </span>
                  )}
                  {isAdmin && (
                    <button
                      onClick={() => handleStartEditing(item.tab)}
                      className="p-1 text-slate-400 hover:text-teal-600 rounded-md hover:bg-slate-200/50 transition"
                      title={`Editar en ${item.tab === "empresa" ? "Ficha Empresa" : "Representante Legal"}`}
                    >
                      <Edit3 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between gap-2 mt-2">
                <span className="font-mono text-xs font-bold text-slate-900 truncate">
                  {item.value || "No registrado"}
                </span>
                {item.value && (
                  <button
                    onClick={() => copyToClipboard(item.value, item.key)}
                    className="p-1 text-slate-400 hover:text-teal-600 rounded transition shrink-0"
                    title="Copiar al portapapeles"
                  >
                    {copiedField === item.key ? (
                      <Check className="w-3.5 h-3.5 text-teal-600" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                )}
              </div>

              <p className="text-[11px] text-slate-400 mt-2">{item.desc}</p>
            </div>
          ))}
        </div>

        {!isComplianceComplete && (
          <div className="mt-4 p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Info className="w-4 h-4 text-amber-600 shrink-0" />
              <span>
                Faltan registrar algunos datos legales de la empresa. Puedes agregarlos haciendo clic en <strong>Editar Configuración</strong>.
              </span>
            </div>
            {isAdmin && !isEditing && (
              <button
                onClick={() => handleStartEditing("empresa")}
                className="font-bold underline text-amber-900 hover:text-amber-950 ml-4 shrink-0 flex items-center gap-1"
              >
                Completar ahora <ArrowRight className="w-3 h-3" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* 5. ESTRUCTURA DE PERSONAL Y ACTIVIDAD RECIENTE (2 COLUMNAS) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Columna Izquierda: Top Cargos / Departamentos */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-slate-900 flex items-center gap-2 text-base">
                <Briefcase className="w-4 h-4 text-teal-600" /> Concentración por Cargos
              </h3>
              <span className="text-xs text-slate-500 font-medium">
                {data.total_departments} cargos distintos
              </span>
            </div>

            {data.top_departments && data.top_departments.length > 0 ? (
              <div className="space-y-3.5">
                {data.top_departments.map((dept, i) => {
                  const percent = data.total_employees > 0
                    ? Math.round((dept.count / data.total_employees) * 100)
                    : 0;
                  return (
                    <div key={i}>
                      <div className="flex justify-between text-xs font-semibold mb-1">
                        <span className="text-slate-800">{dept.name}</span>
                        <span className="text-slate-500 font-mono">
                          {dept.count} {dept.count === 1 ? "empleado" : "empleados"} ({percent}%)
                        </span>
                      </div>
                      <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-teal-500 to-emerald-500 rounded-full transition-all duration-500"
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8 text-slate-400 text-xs">
                No hay cargos registrados aún en el personal activo.
              </div>
            )}
          </div>

          <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>Aportes Patronales Bolivia:</span>
            <span className="font-semibold text-slate-700">16.71% (Caja 10%, Riesgo 1.71%, Viv. 2%, Sol. 3%)</span>
          </div>
        </div>

        {/* Columna Derecha: Empleados Recientes */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-slate-900 flex items-center gap-2 text-base">
                <UserCheck className="w-4 h-4 text-teal-600" /> Colaboradores Recientes
              </h3>
              <Link
                href={`/empleados?tenant=${tenantSchema}`}
                className="text-xs font-bold text-teal-600 hover:text-teal-700 flex items-center gap-1"
              >
                Ver todos <ArrowRight className="w-3 h-3" />
              </Link>
            </div>

            {data.recent_employees && data.recent_employees.length > 0 ? (
              <div className="divide-y divide-slate-100">
                {data.recent_employees.map((emp) => (
                  <div key={emp.id} className="py-2.5 flex items-center justify-between hover:bg-slate-50/50 px-2 rounded-xl transition">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-teal-50 text-teal-700 font-bold text-xs flex items-center justify-center shrink-0">
                        {emp.full_name.charAt(0)}
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-900 leading-tight">{emp.full_name}</p>
                        <p className="text-[11px] text-slate-500">{emp.cargo}</p>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <p className="text-xs font-bold text-slate-800 font-mono">{formatBs(emp.haber_basico)}</p>
                      <p className="text-[10px] text-slate-400">
                        {emp.fecha_ingreso ? `Ingreso: ${emp.fecha_ingreso}` : ""}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-slate-400 text-xs">
                No hay colaboradores registrados.
              </div>
            )}
          </div>

          <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>Beneficios Sociales Obligatorios:</span>
            <span className="font-semibold text-slate-700">Aguinaldo (8.33%) e Indemnización (8.33%)</span>
          </div>
        </div>
      </div>

      {/* 6. FICHA INSTITUCIONAL Y LEGAL (EDICIÓN DE DATOS PRESERVADA AL 100%) */}
      <div
        id="seccion-configuracion"
        className={`bg-white rounded-3xl border transition-all duration-300 shadow-xs overflow-hidden scroll-mt-24 ${
          isEditing ? "ring-4 ring-teal-500/20 border-teal-500 shadow-xl" : "border-slate-200/80"
        }`}
      >
        {/* Encabezado con Pestañas y Acciones */}
        <div className="p-6 pb-0 border-b border-slate-200/80">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-4">
            <div className="flex items-start sm:items-center gap-3">
              <div className={`p-2.5 rounded-2xl transition-colors ${isEditing ? "bg-teal-500 text-white shadow-md shadow-teal-500/30" : "bg-teal-50 text-teal-600"}`}>
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-slate-900">
                    Ficha Institucional y Configuración del Entorno
                  </h2>
                  {isEditing && (
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-teal-50 text-teal-700 border border-teal-200 flex items-center gap-1.5 animate-pulse">
                      <Edit3 className="w-3.5 h-3.5" /> Modo Edición Activo
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  {isEditing
                    ? "Modifica los campos requeridos y presiona 'Guardar Cambios' para persistir los datos de la empresa."
                    : "Información legal, datos del empleador y parámetros del sistema de nómina."}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 self-start lg:self-center">
              {/* Selector de Pestañas */}
              <div className="flex items-center bg-slate-100 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => setActiveTab("empresa")}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition ${
                    activeTab === "empresa"
                      ? "bg-white text-slate-900 shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  1. Empresa
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("representante")}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition ${
                    activeTab === "representante"
                      ? "bg-white text-slate-900 shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  2. Representante Legal
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("parametros")}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition ${
                    activeTab === "parametros"
                      ? "bg-white text-slate-900 shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  3. Parámetros & SMN
                </button>
              </div>

              {/* Botón de edición directo en la cabecera de la ficha */}
              {isAdmin && !isEditing && (
                <button
                  type="button"
                  onClick={() => handleStartEditing(activeTab)}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 bg-teal-50 hover:bg-teal-100 text-teal-700 font-bold rounded-xl text-xs transition border border-teal-200 shadow-xs"
                >
                  <Edit3 className="w-3.5 h-3.5" /> Editar Ficha
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Contenido de la Ficha por Pestaña */}
        <div className="p-6 sm:p-8">
          {/* TAB 1: DATOS DE LA EMPRESA */}
          {activeTab === "empresa" && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
                    Razón Social de la Empresa <span className="text-rose-500">*</span>
                  </label>
                  {isEditing ? (
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="Ej. Rengifo Ltda."
                      className="w-full text-slate-900 font-semibold border border-slate-300 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white"
                    />
                  ) : (
                    <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl flex items-center justify-between">
                      <span className="font-bold text-slate-900">{data.tenant.name}</span>
                    </div>
                  )}
                  <p className="text-[11px] text-slate-400 mt-1">Nombre legal registrado en Fundempresa / SEPREC.</p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
                    Número de Identificación Tributaria (NIT)
                  </label>
                  {isEditing ? (
                    <input
                      type="text"
                      value={formData.nit}
                      onChange={(e) => setFormData({ ...formData, nit: e.target.value.replace(/\D/g, "") })}
                      placeholder="Ej. 6570013013"
                      className="w-full text-slate-900 font-semibold border border-slate-300 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white"
                    />
                  ) : (
                    <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl flex items-center justify-between">
                      <span className="font-mono font-bold text-slate-900">{data.tenant.nit || "No registrado"}</span>
                      {data.tenant.nit && (
                        <button
                          onClick={() => copyToClipboard(data.tenant.nit, "nit_tab")}
                          className="text-slate-400 hover:text-teal-600 p-1"
                          title="Copiar NIT"
                        >
                          {copiedField === "nit_tab" ? <Check className="w-4 h-4 text-teal-600" /> : <Copy className="w-4 h-4" />}
                        </button>
                      )}
                    </div>
                  )}
                  <p className="text-[11px] text-slate-400 mt-1">Número de NIT del Servicio de Impuestos Nacionales.</p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
                    Ente Gestor de Salud (Caja de Seguro)
                  </label>
                  {isEditing ? (
                    <select
                      value={formData.caja_salud}
                      onChange={(e) => setFormData({ ...formData, caja_salud: e.target.value })}
                      className="w-full text-slate-900 font-semibold border border-slate-300 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white cursor-pointer"
                    >
                      {CAJAS_SALUD_BOLIVIA.map((caja) => (
                        <option key={caja} value={caja}>
                          {caja}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl flex items-center justify-between">
                      <span className="font-bold text-slate-900">{data.tenant.caja_salud || "Caja Petrolera de Salud"}</span>
                    </div>
                  )}
                  <p className="text-[11px] text-slate-400 mt-1">Entidad de seguridad social a corto plazo para aportes patronales del 10%.</p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
                    N° Patronal (Caja de Salud)
                  </label>
                  {isEditing ? (
                    <input
                      type="text"
                      value={formData.numero_patronal}
                      onChange={(e) => setFormData({ ...formData, numero_patronal: e.target.value })}
                      placeholder="Ej. 350-1-2177"
                      className="w-full text-slate-900 font-semibold border border-slate-300 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white"
                    />
                  ) : (
                    <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl flex items-center justify-between">
                      <span className="font-mono font-bold text-slate-900">{data.tenant.numero_patronal || "No registrado"}</span>
                      {data.tenant.numero_patronal && (
                        <button
                          onClick={() => copyToClipboard(data.tenant.numero_patronal, "patronal_tab")}
                          className="text-slate-400 hover:text-teal-600 p-1"
                          title="Copiar N° Patronal"
                        >
                          {copiedField === "patronal_tab" ? <Check className="w-4 h-4 text-teal-600" /> : <Copy className="w-4 h-4" />}
                        </button>
                      )}
                    </div>
                  )}
                  <p className="text-[11px] text-slate-400 mt-1">Código de afiliación a la Caja Nacional u otra gestora de salud.</p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
                    ID Ministerio de Trabajo (ROE)
                  </label>
                  {isEditing ? (
                    <input
                      type="text"
                      value={formData.min_trabajo_id}
                      onChange={(e) => setFormData({ ...formData, min_trabajo_id: e.target.value })}
                      placeholder="Ej. 6570013013"
                      className="w-full text-slate-900 font-semibold border border-slate-300 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white"
                    />
                  ) : (
                    <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl flex items-center justify-between">
                      <span className="font-mono font-bold text-slate-900">{data.tenant.min_trabajo_id || "No registrado"}</span>
                      {data.tenant.min_trabajo_id && (
                        <button
                          onClick={() => copyToClipboard(data.tenant.min_trabajo_id, "roe_tab")}
                          className="text-slate-400 hover:text-teal-600 p-1"
                          title="Copiar ID ROE"
                        >
                          {copiedField === "roe_tab" ? <Check className="w-4 h-4 text-teal-600" /> : <Copy className="w-4 h-4" />}
                        </button>
                      )}
                    </div>
                  )}
                  <p className="text-[11px] text-slate-400 mt-1">Identificador del Registro Obligatorio de Empleadores (OVT).</p>
                </div>
              </div>
            </motion.div>
          )}

          {/* TAB 2: REPRESENTANTE LEGAL (EMPLEADOR) */}
          {activeTab === "representante" && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
                    Nombres del Representante Legal
                  </label>
                  {isEditing ? (
                    <input
                      type="text"
                      value={formData.empleador_nombres}
                      onChange={(e) => setFormData({ ...formData, empleador_nombres: e.target.value })}
                      placeholder="Ej. Hipolito"
                      className="w-full text-slate-900 font-semibold border border-slate-300 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white"
                    />
                  ) : (
                    <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl">
                      <span className="font-bold text-slate-900">{data.tenant.empleador_nombres || "No registrado"}</span>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
                      Apellido Paterno
                    </label>
                    {isEditing ? (
                      <input
                        type="text"
                        value={formData.empleador_apellido_paterno}
                        onChange={(e) => setFormData({ ...formData, empleador_apellido_paterno: e.target.value })}
                        placeholder="Ej. Manrrique"
                        className="w-full text-slate-900 font-semibold border border-slate-300 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white"
                      />
                    ) : (
                      <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl">
                        <span className="font-bold text-slate-900">{data.tenant.empleador_apellido_paterno || "No registrado"}</span>
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
                      Apellido Materno
                    </label>
                    {isEditing ? (
                      <input
                        type="text"
                        value={formData.empleador_apellido_materno}
                        onChange={(e) => setFormData({ ...formData, empleador_apellido_materno: e.target.value })}
                        placeholder="Ej. Santi"
                        className="w-full text-slate-900 font-semibold border border-slate-300 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white"
                      />
                    ) : (
                      <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl">
                        <span className="font-bold text-slate-900">{data.tenant.empleador_apellido_materno || "No registrado"}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
                    Cédula de Identidad (CI)
                  </label>
                  {isEditing ? (
                    <input
                      type="text"
                      value={formData.empleador_ci}
                      onChange={(e) => setFormData({ ...formData, empleador_ci: e.target.value })}
                      placeholder="Ej. 6570013"
                      className="w-full text-slate-900 font-semibold border border-slate-300 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white"
                    />
                  ) : (
                    <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl flex items-center justify-between">
                      <span className="font-mono font-bold text-slate-900">{data.tenant.empleador_ci || "No registrado"}</span>
                      {data.tenant.empleador_ci && (
                        <button
                          onClick={() => copyToClipboard(data.tenant.empleador_ci, "ci_tab")}
                          className="text-slate-400 hover:text-teal-600 p-1"
                          title="Copiar CI"
                        >
                          {copiedField === "ci_tab" ? <Check className="w-4 h-4 text-teal-600" /> : <Copy className="w-4 h-4" />}
                        </button>
                      )}
                    </div>
                  )}
                  <p className="text-[11px] text-slate-400 mt-1">Cédula de Identidad para la firma de planillas y finiquitos.</p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
                    NIT del Empleador
                  </label>
                  {isEditing ? (
                    <input
                      type="text"
                      value={formData.empleador_nit}
                      onChange={(e) => setFormData({ ...formData, empleador_nit: e.target.value.replace(/\D/g, "") })}
                      placeholder="Ej. 6570013013"
                      className="w-full text-slate-900 font-semibold border border-slate-300 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white"
                    />
                  ) : (
                    <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl flex items-center justify-between">
                      <span className="font-mono font-bold text-slate-900">{data.tenant.empleador_nit || "No registrado"}</span>
                      {data.tenant.empleador_nit && (
                        <button
                          onClick={() => copyToClipboard(data.tenant.empleador_nit, "emp_nit_tab")}
                          className="text-slate-400 hover:text-teal-600 p-1"
                          title="Copiar NIT Empleador"
                        >
                          {copiedField === "emp_nit_tab" ? <Check className="w-4 h-4 text-teal-600" /> : <Copy className="w-4 h-4" />}
                        </button>
                      )}
                    </div>
                  )}
                  <p className="text-[11px] text-slate-400 mt-1">NIT personal del empleador (en caso de empresa unipersonal).</p>
                </div>
              </div>
            </motion.div>
          )}

          {/* TAB 3: PARÁMETROS LABORALES Y SISTEMA */}
          {activeTab === "parametros" && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Salario Mínimo Nacional */}
                <div className="bg-teal-50/50 p-5 rounded-2xl border border-teal-200">
                  <div className="flex items-center gap-2 mb-3">
                    <Award className="w-5 h-5 text-teal-600" />
                    <h4 className="font-bold text-teal-900 text-sm">Salario Mínimo Nacional (SMN) {data.current_year}</h4>
                  </div>
                  <label className="block text-xs font-semibold text-teal-800 mb-1.5">
                    Monto Oficial en Bolivianos
                  </label>
                  {isEditing ? (
                    <div className="relative">
                      <span className="absolute left-4 top-2.5 text-slate-500 font-bold text-sm">Bs.</span>
                      <input
                        type="number"
                        step="0.01"
                        value={formData.current_smn}
                        onChange={(e) => setFormData({ ...formData, current_smn: parseFloat(e.target.value) || 0 })}
                        className="w-full text-slate-900 font-bold border border-teal-300 rounded-xl pl-12 pr-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white"
                      />
                    </div>
                  ) : (
                    <div className="p-3 bg-white border border-teal-200 rounded-xl">
                      <span className="text-xl font-black text-teal-900">{formatBs(data.current_smn)}</span>
                    </div>
                  )}
                  <p className="text-[11px] text-teal-700/80 mt-2 leading-relaxed">
                    Este valor determina automáticamente el cálculo del Bono de Antigüedad (base legal de 3 SMN = {formatBs((formData.current_smn || 0) * 3)}), subsidios prenatales y topes de aportes.
                  </p>
                </div>

                {/* Información Técnica del Entorno Multi-Tenant */}
                <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200/80 space-y-3">
                  <h4 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-slate-600" /> Entorno Multi-Tenant PostgreSQL
                  </h4>

                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between py-1 border-b border-slate-200/60">
                      <span className="text-slate-500 font-medium">Esquema BD Privado:</span>
                      <span className="font-mono font-bold text-slate-800">{data.tenant.schema_name}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-200/60">
                      <span className="text-slate-500 font-medium">Estado del Entorno:</span>
                      <span className="inline-flex items-center gap-1 font-bold text-emerald-700">
                        <CheckCircle className="w-3 h-3 text-emerald-600" /> Operativo / Activo
                      </span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-200/60">
                      <span className="text-slate-500 font-medium">Aporte Gestora Pública:</span>
                      <span className="font-mono font-bold text-slate-800">12.71% Ley de Pensiones</span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-slate-500 font-medium">R.C. - I.V.A. Dependientes:</span>
                      <span className="font-mono font-bold text-slate-800">13% Régimen Complementario</span>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </div>

        {/* Footer de la Ficha con Botones de Acción */}
        {isAdmin && isEditing && (
          <div className="p-4 sm:p-6 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-3">
            <button
              onClick={handleCancelEdit}
              disabled={saving}
              className="px-5 py-2.5 border border-slate-300 text-slate-700 font-semibold rounded-xl hover:bg-slate-100 transition"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-6 py-2.5 bg-teal-600 text-white font-bold rounded-xl hover:bg-teal-700 transition shadow-lg shadow-teal-600/20"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Guardar Cambios
            </button>
          </div>
        )}
      </div>

      {/* Dock Flotante de Edición Activa */}
      <AnimatePresence>
        {isAdmin && isEditing && (
          <motion.div
            initial={{ opacity: 0, y: 40, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 40, scale: 0.95 }}
            className="fixed bottom-6 inset-x-0 mx-auto max-w-xl px-4 z-50 pointer-events-none"
          >
            <div className="pointer-events-auto bg-slate-900/95 backdrop-blur-md text-white px-5 py-3.5 rounded-2xl shadow-2xl border border-slate-700/80 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-teal-500"></span>
                </span>
                <div>
                  <p className="text-xs font-bold text-white flex items-center gap-1.5">
                    Modo Edición Activo
                  </p>
                  <p className="text-[11px] text-slate-400">
                    Sección: {activeTab === "empresa" ? "1. Empresa" : activeTab === "representante" ? "2. Representante Legal" : "3. Parámetros"}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleCancelEdit}
                  disabled={saving}
                  className="px-3.5 py-1.5 text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition border border-slate-700"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold text-slate-950 bg-teal-400 hover:bg-teal-300 rounded-xl transition shadow-lg shadow-teal-500/25"
                >
                  {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  Guardar Cambios
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}


export default function InicioDashboard() {
  return (
    <Suspense fallback={<div className="flex justify-center p-12"><div className="w-8 h-8 border-4 border-teal-500 border-t-transparent rounded-full animate-spin"></div></div>}>
      <InicioDashboardContent />
    </Suspense>
  );
}
