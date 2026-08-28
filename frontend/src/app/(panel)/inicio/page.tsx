"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Building2, Save, Edit3, Loader2, Users, Receipt, Briefcase, FileText } from "lucide-react";

interface TenantData {
  tenant: {
    id: number;
    name: string;
    schema_name: string;
    nit: string | null;
    numero_patronal: string | null;
    min_trabajo_id: string | null;
    empleador_nombres: string | null;
    empleador_apellido_paterno: string | null;
    empleador_apellido_materno: string | null;
    empleador_ci: string | null;
    empleador_nit: string | null;
    icon: string | null;
  };
  total_employees: number;
  total_payrolls: number;
  total_departments: number;
  current_smn: number;
  current_year: number;
}

function InicioDashboardContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const tenantSchema = searchParams.get("tenant");

  const [data, setData] = useState<TenantData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    name: "",
    nit: "",
    numero_patronal: "",
    min_trabajo_id: "",
    empleador_nombres: "",
    empleador_apellido_paterno: "",
    empleador_apellido_materno: "",
    empleador_ci: "",
    empleador_nit: "",
    current_smn: 0
  });

  useEffect(() => {
    if (!tenantSchema) {
      router.push("/seleccionar-empresa");
      return;
    }

    const fetchData = async () => {
      try {
        const host = window.location.hostname;
        const res = await fetch(`http://${host}:8000/api/tenants/${tenantSchema}/dashboard`);
        if (res.ok) {
          const json = await res.json();
          setData(json);
          setFormData({
            name: json.tenant.name,
            nit: json.tenant.nit || "",
            numero_patronal: json.tenant.numero_patronal || "",
            min_trabajo_id: json.tenant.min_trabajo_id || "",
            empleador_nombres: json.tenant.empleador_nombres || "",
            empleador_apellido_paterno: json.tenant.empleador_apellido_paterno || "",
            empleador_apellido_materno: json.tenant.empleador_apellido_materno || "",
            empleador_ci: json.tenant.empleador_ci || "",
            empleador_nit: json.tenant.empleador_nit || "",
            current_smn: json.current_smn
          });
        } else {
          router.push("/seleccionar-empresa");
        }
      } catch (err) {
        console.error("Error fetching dashboard", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [tenantSchema, router]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const host = window.location.hostname;
      const res = await fetch(`http://${host}:8000/api/tenants/${tenantSchema}/dashboard`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData)
      });
      if (res.ok) {
        const json = await res.json();
        setData(json);
        setFormData({
            name: json.tenant.name,
            nit: json.tenant.nit || "",
            numero_patronal: json.tenant.numero_patronal || "",
            min_trabajo_id: json.tenant.min_trabajo_id || "",
            empleador_nombres: json.tenant.empleador_nombres || "",
            empleador_apellido_paterno: json.tenant.empleador_apellido_paterno || "",
            empleador_apellido_materno: json.tenant.empleador_apellido_materno || "",
            empleador_ci: json.tenant.empleador_ci || "",
            empleador_nit: json.tenant.empleador_nit || "",
            current_smn: json.current_smn
        });
        setIsEditing(false);
      }
    } catch (err) {
      console.error("Error saving data", err);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center min-h-[60vh]">
        <Loader2 className="w-12 h-12 text-teal-500 animate-spin" />
      </div>
    );
  }

  if (!data) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 flex items-center gap-2">
            <Building2 className="text-teal-600 w-8 h-8" />
            Resumen: {data.tenant.name}
          </h1>
          <p className="text-slate-500 mt-1">Panel general de administración y configuración del entorno.</p>
        </div>

        {/* Toggle de Edición (Asumimos rol Admin para MVP) */}
        {!isEditing ? (
          <button
            onClick={() => setIsEditing(true)}
            className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition shadow-lg"
          >
            <Edit3 className="w-4 h-4" /> Editar Configuración
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsEditing(false)}
              className="px-4 py-2 border border-slate-300 text-slate-600 rounded-lg hover:bg-slate-50 transition"
              disabled={saving}
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              className="flex items-center gap-2 px-4 py-2 bg-teal-500 text-white font-bold rounded-lg hover:bg-teal-600 transition shadow-lg"
              disabled={saving}
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Guardar Cambios
            </button>
          </div>
        )}
      </div>

      {/* Grid Superior: Tarjetas de Métricas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4 hover:shadow-md transition">
          <div className="p-4 bg-teal-50 rounded-xl">
            <Users className="w-8 h-8 text-teal-600" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500">Empleados Registrados</p>
            <h3 className="text-2xl font-bold text-slate-800">{data.total_employees}</h3>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4 hover:shadow-md transition">
          <div className="p-4 bg-blue-50 rounded-xl">
            <Receipt className="w-8 h-8 text-blue-600" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500">Planillas Generadas</p>
            <h3 className="text-2xl font-bold text-slate-800">{data.total_payrolls}</h3>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4 hover:shadow-md transition">
          <div className="p-4 bg-indigo-50 rounded-xl">
            <Briefcase className="w-8 h-8 text-indigo-600" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500">Departamentos</p>
            <h3 className="text-2xl font-bold text-slate-800">{data.total_departments}</h3>
          </div>
        </div>
      </div>

      {/* Formulario de Datos Generales (Estilo Glass/Cards) */}
      <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-slate-100 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none">
          <Building2 className="w-64 h-64 text-slate-900" />
        </div>

        <h2 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
          <FileText className="text-teal-600" /> Información General y Legal
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 relative z-10">

          {/* Bloque Empresa */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Razón Social</label>
              {isEditing ? (
                <input
                  type="text"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  className="w-full text-slate-900 border border-slate-300 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              ) : (
                <p className="text-slate-800 bg-slate-50 px-4 py-2.5 rounded-xl border border-transparent">{data.tenant.name}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">NIT</label>
              {isEditing ? (
                <input
                  type="text"
                  value={formData.nit}
                  onChange={e => setFormData({ ...formData, nit: e.target.value.replace(/\D/g, '') })}
                  className="w-full text-slate-900 border border-slate-300 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              ) : (
                <p className="text-slate-800 bg-slate-50 px-4 py-2.5 rounded-xl border border-transparent">{data.tenant.nit || "No registrado"}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Nº Patronal (Caja de Salud)</label>
              {isEditing ? (
                <input
                  type="text"
                  value={formData.numero_patronal}
                  onChange={e => setFormData({ ...formData, numero_patronal: e.target.value })}
                  className="w-full text-slate-900 border border-slate-300 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              ) : (
                <p className="text-slate-800 bg-slate-50 px-4 py-2.5 rounded-xl border border-transparent">{data.tenant.numero_patronal || "No registrado"}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">ID Ministerio de Trabajo (ROE)</label>
              {isEditing ? (
                <input
                  type="text"
                  value={formData.min_trabajo_id}
                  onChange={e => setFormData({ ...formData, min_trabajo_id: e.target.value })}
                  className="w-full text-slate-900 border border-slate-300 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              ) : (
                <p className="text-slate-800 bg-slate-50 px-4 py-2.5 rounded-xl border border-transparent">{data.tenant.min_trabajo_id || "No registrado"}</p>
              )}
            </div>
          </div>

          {/* Bloque Representante Legal */}
          <div className="space-y-4">
            <h3 className="font-semibold text-slate-800 border-b border-slate-100 pb-2">Datos del Representante Legal (Empleador)</h3>
            
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Nombres</label>
              {isEditing ? (
                <input
                  type="text"
                  value={formData.empleador_nombres}
                  onChange={e => setFormData({ ...formData, empleador_nombres: e.target.value })}
                  className="w-full text-slate-900 border border-slate-300 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              ) : (
                <p className="text-slate-800 bg-slate-50 px-4 py-2.5 rounded-xl border border-transparent">{data.tenant.empleador_nombres || "No registrado"}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Apellido Paterno</label>
                {isEditing ? (
                  <input
                    type="text"
                    value={formData.empleador_apellido_paterno}
                    onChange={e => setFormData({ ...formData, empleador_apellido_paterno: e.target.value })}
                    className="w-full text-slate-900 border border-slate-300 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                ) : (
                  <p className="text-slate-800 bg-slate-50 px-4 py-2.5 rounded-xl border border-transparent">{data.tenant.empleador_apellido_paterno || "No registrado"}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Apellido Materno</label>
                {isEditing ? (
                  <input
                    type="text"
                    value={formData.empleador_apellido_materno}
                    onChange={e => setFormData({ ...formData, empleador_apellido_materno: e.target.value })}
                    className="w-full text-slate-900 border border-slate-300 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                ) : (
                  <p className="text-slate-800 bg-slate-50 px-4 py-2.5 rounded-xl border border-transparent">{data.tenant.empleador_apellido_materno || "No registrado"}</p>
                )}
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Cédula de Identidad (CI)</label>
              {isEditing ? (
                <input
                  type="text"
                  value={formData.empleador_ci}
                  onChange={e => setFormData({ ...formData, empleador_ci: e.target.value })}
                  className="w-full text-slate-900 border border-slate-300 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              ) : (
                <p className="text-slate-800 bg-slate-50 px-4 py-2.5 rounded-xl border border-transparent">{data.tenant.empleador_ci || "No registrado"}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">NIT del Empleador</label>
              {isEditing ? (
                <input
                  type="text"
                  value={formData.empleador_nit}
                  onChange={e => setFormData({ ...formData, empleador_nit: e.target.value })}
                  className="w-full text-slate-900 border border-slate-300 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              ) : (
                <p className="text-slate-800 bg-slate-50 px-4 py-2.5 rounded-xl border border-transparent">{data.tenant.empleador_nit || "No registrado"}</p>
              )}
            </div>
          </div>

          {/* Bloque Parametros Generales (Ley Boliviana) */}
          <div className="space-y-4">
            <div className="bg-teal-50 p-6 rounded-2xl border border-teal-100">
              <h3 className="font-bold text-teal-900 mb-4 flex items-center gap-2">Parámetros Nacionales (Bolivia)</h3>

              <div>
                <label className="block text-sm font-semibold text-teal-800 mb-1">Salario Mínimo Nacional (SMN) {data.current_year}</label>
                {isEditing ? (
                  <div className="relative">
                    <span className="absolute left-4 top-2.5 text-slate-500">Bs.</span>
                    <input
                      type="number"
                      value={formData.current_smn}
                      onChange={e => setFormData({ ...formData, current_smn: parseFloat(e.target.value) || 0 })}
                      className="w-full text-slate-900 border border-slate-300 rounded-xl pl-12 pr-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-teal-500"
                    />
                  </div>
                ) : (
                  <p className="text-slate-800 bg-white px-4 py-2.5 rounded-xl font-bold shadow-sm inline-block">
                    Bs. {data.current_smn.toLocaleString('es-BO', { minimumFractionDigits: 2 })}
                  </p>
                )}
              </div>
            </div>

            <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
              <h3 className="font-bold text-slate-700 mb-2">Información del Entorno</h3>
              <p className="text-sm text-slate-500 mb-1"><span className="font-semibold">Esquema BD:</span> {data.tenant.schema_name}</p>
              <p className="text-sm text-slate-500"><span className="font-semibold">Estado:</span> <span className="text-emerald-600 font-bold bg-emerald-100 px-2 py-0.5 rounded-full">Activo</span></p>
            </div>
          </div>

        </div>
      </div>

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
