"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Users, Plus, Edit, Trash2, X, Search, Loader2, UserPlus, AlertCircle, CheckCircle, UserX, RotateCcw, Eye } from "lucide-react";
import { getApiUrl } from "@/utils/api";

interface Employee {
  id: number;
  internal_code: string | null;
  documento_identidad: string;
  ext_ci: string | null;
  nombres: string;
  apellido_paterno: string;
  apellido_materno: string;
  nacionalidad: string;
  fecha_nacimiento: string;
  sexo: string;
  ocupacion: string;
  fecha_ingreso: string;
  haber_basico: number;
  is_active: boolean;
}

function EmpleadosPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const tenantSchema = searchParams.get("tenant");

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<"todos" | "activos" | "desvinculados">("todos");
  const [reactivatingId, setReactivatingId] = useState<number | null>(null);
  const [viewingEmployee, setViewingEmployee] = useState<Employee | null>(null);

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  
  const [formData, setFormData] = useState<Partial<Employee>>({
    internal_code: "",
    documento_identidad: "",
    ext_ci: "LP",
    nombres: "",
    apellido_paterno: "",
    apellido_materno: "",
    nacionalidad: "Boliviana",
    fecha_nacimiento: "",
    sexo: "M",
    ocupacion: "",
    fecha_ingreso: "",
    haber_basico: 3300
  });

  const fetchEmployees = async () => {
    if (!tenantSchema) return;
    try {
      const res = await fetch(`${getApiUrl()}/api/tenants/${tenantSchema}/employees/`);
      if (res.ok) {
        const data = await res.json();
        setEmployees(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (!tenantSchema) {
      router.push("/seleccionar-empresa");
      return;
    }
    setIsAdmin(localStorage.getItem("isAdmin") === "true");
    fetchEmployees();
  }, [tenantSchema]);

  const handleOpenModal = (emp?: Employee) => {
    setError("");
    if (emp) {
      setIsEditing(true);
      setFormData(emp);
    } else {
      setIsEditing(false);
      setFormData({
        internal_code: "",
        documento_identidad: "",
        ext_ci: "LP",
        nombres: "",
        apellido_paterno: "",
    apellido_materno: "",
        nacionalidad: "Boliviana",
        fecha_nacimiento: "",
        sexo: "M",
        ocupacion: "",
        fecha_ingreso: "",
        haber_basico: 3300
      });
    }
    setShowModal(true);
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "";
    const [y, m, d] = dateStr.split("-");
    return `${d}/${m}/${y}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    
    try {
      const url = isEditing 
        ? `${getApiUrl()}/api/tenants/${tenantSchema}/employees/${formData.id}`
        : `${getApiUrl()}/api/tenants/${tenantSchema}/employees/`;
      
      const res = await fetch(url, {
        method: isEditing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData)
      });
      
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.detail || "Error al guardar el empleado");
      }
      
      await fetchEmployees();
      setShowModal(false);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleReactivate = async (emp: Employee) => {
    const fullName = `${emp.nombres} ${emp.apellido_paterno}`;
    if (!confirm(`¿Está seguro de REACTIVAR a ${fullName}? El empleado volverá a estar ACTIVO en el sistema y disponible para generar planillas y boletas.`)) return;
    
    setReactivatingId(emp.id);
    try {
      const res = await fetch(`${getApiUrl()}/api/tenants/${tenantSchema}/employees/${emp.id}/reactivate`, {
        method: "POST"
      });
      if (res.ok) {
        const updated = await res.json();
        setEmployees(prev => prev.map(e => e.id === updated.id ? updated : e));
        alert(`¡Empleado ${fullName} reactivado exitosamente! Ahora está activo.`);
      } else {
        alert("Error al reactivar el empleado.");
      }
    } catch (err) {
      console.error(err);
      alert("Error de conexión al reactivar el empleado.");
    } finally {
      setReactivatingId(null);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("¿Estás seguro de eliminar este empleado? Esta acción no se puede deshacer.")) return;
    
    try {
      const res = await fetch(`${getApiUrl()}/api/tenants/${tenantSchema}/employees/${id}`, {
        method: "DELETE"
      });
      if (res.ok) {
        setEmployees(employees.filter(e => e.id !== id));
      } else {
        alert("Error al eliminar el empleado");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const activeCount = employees.filter(e => e.is_active).length;
  const inactiveCount = employees.filter(e => !e.is_active).length;

  const filteredEmployees = employees.filter(emp => {
    const term = search.toLowerCase();
    const fullName = `${emp.apellido_paterno} ${emp.apellido_materno || ""} ${emp.nombres}`.toLowerCase();
    const ci = emp.documento_identidad.toLowerCase();
    const code = (emp.internal_code || "").toLowerCase();
    const matchesSearch = fullName.includes(term) || ci.includes(term) || code.includes(term);
    
    if (!matchesSearch) return false;
    if (filterStatus === "activos") return emp.is_active;
    if (filterStatus === "desvinculados") return !emp.is_active;
    return true;
  });

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center min-h-[60vh]">
        <Loader2 className="w-12 h-12 text-teal-500 animate-spin" />
      </div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Cabecera */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 flex items-center gap-2">
            <Users className="text-teal-600 w-8 h-8" />
            Nómina de Empleados
          </h1>
          <p className="text-slate-900 font-medium mt-1">Administra el personal, sus cargos y salarios base.</p>
        </div>
        
        <button 
          onClick={() => handleOpenModal()}
          className="flex items-center gap-2 px-5 py-2.5 bg-teal-500 text-white font-bold rounded-xl hover:bg-teal-600 transition shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
        >
          <UserPlus className="w-5 h-5" /> Agregar Empleado
        </button>
      </div>

      {/* Buscador y Tabla */}
      <div className="bg-white rounded-[2rem] shadow-sm border border-slate-100 overflow-hidden">
        
        {/* Barra de Búsqueda y Filtros de Estado */}
        <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-4">
          <div className="relative max-w-md flex-1">
            <Search className="absolute left-4 top-3 text-slate-900 font-semibold w-5 h-5" />
            <input 
              type="text" 
              placeholder="Buscar por nombre, apellido, CI o código..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-12 pr-4 py-2.5 rounded-xl border border-slate-300 text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white text-sm"
            />
          </div>

          {/* Filtros: Todos / Activos / Desvinculados */}
          <div className="flex bg-slate-200/80 p-1 rounded-xl gap-1">
            <button
              onClick={() => setFilterStatus("todos")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${filterStatus === "todos" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"}`}
            >
              Todos ({employees.length})
            </button>
            <button
              onClick={() => setFilterStatus("activos")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${filterStatus === "activos" ? "bg-emerald-600 text-white shadow-sm" : "text-slate-600 hover:text-slate-900"}`}
            >
              <CheckCircle className="w-3.5 h-3.5" />
              Activos ({activeCount})
            </button>
            <button
              onClick={() => setFilterStatus("desvinculados")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${filterStatus === "desvinculados" ? "bg-rose-600 text-white shadow-sm" : "text-slate-600 hover:text-slate-900"}`}
            >
              <UserX className="w-3.5 h-3.5" />
              Desvinculados ({inactiveCount})
            </button>
          </div>
        </div>

        {/* Tabla Responsiva */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-900 font-medium text-sm border-b border-slate-100">
                <th className="p-4 font-semibold">C.I. / Documento</th>
                <th className="p-4 font-semibold">Apellidos y Nombres</th>
                <th className="p-4 font-semibold">Cargo</th>
                <th className="p-4 font-semibold">F. Ingreso</th>
                <th className="p-4 font-semibold">Haber Básico</th>
                <th className="p-4 font-semibold text-center">Estado</th>
                <th className="p-4 font-semibold text-center">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filteredEmployees.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-900 font-semibold">
                    No se encontraron empleados registrados en esta empresa.
                  </td>
                </tr>
              ) : (
                filteredEmployees.map((emp) => (
                  <tr key={emp.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition">
                    <td className="p-4 font-medium text-slate-700">
                      {emp.documento_identidad} {emp.ext_ci ? `- ${emp.ext_ci}` : ''}
                    </td>
                    <td className="p-4">
                      <div className="font-bold text-slate-800">{`${emp.apellido_paterno} ${emp.apellido_materno || ""} ${emp.nombres}`.trim().replace(/  +/g, " ").toUpperCase()}</div>
                      <div className="text-xs text-slate-900 font-semibold">{emp.internal_code ? `Cód: ${emp.internal_code}` : ''}</div>
                    </td>
                    <td className="p-4">
                      <span className="bg-teal-50 text-teal-700 px-3 py-1 rounded-lg text-sm font-medium border border-teal-100">
                        {emp.ocupacion}
                      </span>
                    </td>
                    <td className="p-4 text-slate-900 font-medium">{formatDate(emp.fecha_ingreso)}</td>
                    <td className="p-4 font-bold text-slate-800">
                      Bs. {Number(emp.haber_basico).toLocaleString('es-BO', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="p-4 text-center">
                      {emp.is_active ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-sm">
                          <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                          Activo
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200 shadow-sm">
                          <UserX className="w-3.5 h-3.5 text-rose-600" />
                          Desvinculado
                        </span>
                      )}
                    </td>
                    <td className="p-4">
                      <div className="flex items-center justify-center gap-2">
                        {!emp.is_active && isAdmin && (
                          <button 
                            onClick={() => handleReactivate(emp)}
                            disabled={reactivatingId === emp.id}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-sm disabled:opacity-50"
                            title="Reactivar / Reincorporar a la empresa"
                          >
                            {reactivatingId === emp.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
                            Reactivar
                          </button>
                        )}
                        <button 
                          onClick={() => setViewingEmployee(emp)}
                          className="p-2 text-teal-600 hover:bg-teal-50 rounded-lg transition"
                          title="Ver todos los datos del empleado"
                        >
                          <Eye className="w-5 h-5" />
                        </button>
                        <button 
                          onClick={() => handleOpenModal(emp)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                          title="Editar"
                        >
                          <Edit className="w-5 h-5" />
                        </button>
                        {isAdmin && (
                          <button 
                            onClick={() => handleDelete(emp.id)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                            title="Eliminar permanentemente"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de Registro / Edición Glassmorphism */}
      <AnimatePresence>
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !submitting && setShowModal(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-3xl bg-white/10 backdrop-blur-2xl border border-white/20 rounded-[2rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="p-6 border-b border-white/10 flex justify-between items-center bg-slate-900/40">
                <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                  <UserPlus className="text-teal-400 w-6 h-6" /> 
                  {isEditing ? "Editar Empleado" : "Registrar Nuevo Empleado"}
                </h2>
                <button onClick={() => !submitting && setShowModal(false)} className="text-white/50 hover:text-white transition">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="p-6 overflow-y-auto custom-scrollbar">
                <form id="employeeForm" onSubmit={handleSubmit} className="space-y-6">
                  
                  {/* Fila 1: Identificación */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="md:col-span-1">
                      <label className="block text-sm font-medium text-teal-100 mb-1">C.I. *</label>
                      <input 
                        type="text" required placeholder="Ej. 1234567"
                        value={formData.documento_identidad} onChange={e => setFormData({...formData, documento_identidad: e.target.value})}
                        className="w-full bg-black/20 border border-white/20 text-white rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-teal-400"
                      />
                    </div>
                    <div className="md:col-span-1">
                      <label className="block text-sm font-medium text-teal-100 mb-1">Extensión (Exp.) *</label>
                      <input 
                        type="text" required placeholder="LP, OR, CB..."
                        list="ci_extensions"
                        value={formData.ext_ci || ""} onChange={e => setFormData({...formData, ext_ci: e.target.value})}
                        className="w-full bg-black/20 border border-white/20 text-white rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-teal-400"
                      />
                      <datalist id="ci_extensions">
                        <option value="LP" />
                        <option value="OR" />
                        <option value="CB" />
                        <option value="PT" />
                        <option value="CH" />
                        <option value="TJ" />
                        <option value="SC" />
                        <option value="BE" />
                        <option value="PD" />
                      </datalist>
                    </div>
                    <div className="md:col-span-1">
                      <label className="block text-sm font-medium text-teal-100 mb-1">Cód. Interno (Opcional)</label>
                      <input 
                        type="text" placeholder="Ej. EMP-001"
                        value={formData.internal_code || ""} onChange={e => setFormData({...formData, internal_code: e.target.value})}
                        className="w-full bg-black/20 border border-white/20 text-white rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-teal-400"
                      />
                    </div>
                  </div>

                  {/* Fila 2: Nombres y Apellidos */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-teal-100 mb-1">Nombres *</label>
                      <input 
                        type="text" required placeholder="Nombres del empleado"
                        value={formData.nombres} onChange={e => setFormData({...formData, nombres: e.target.value})}
                        className="w-full bg-black/20 border border-white/20 text-white rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-teal-400"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-teal-100 mb-1">Ap. Paterno *</label>
                      <input 
                        type="text" required placeholder="Paterno"
                        value={formData.apellido_paterno} onChange={e => setFormData({...formData, apellido_paterno: e.target.value})}
                        className="w-full bg-black/20 border border-white/20 text-white rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-teal-400"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-teal-100 mb-1">Ap. Materno</label>
                      <input 
                        type="text" placeholder="Materno (Opcional)"
                        value={formData.apellido_materno || ""} onChange={e => setFormData({...formData, apellido_materno: e.target.value})}
                        className="w-full bg-black/20 border border-white/20 text-white rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-teal-400"
                      />
                    </div>
                  </div>

                  {/* Fila 3: Nacimiento, Sexo, Nacionalidad */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-teal-100 mb-1">Fecha Nacimiento *</label>
                      <input 
                        type="date" required
                        value={formData.fecha_nacimiento} onChange={e => setFormData({...formData, fecha_nacimiento: e.target.value})}
                        className="w-full bg-black/20 border border-white/20 text-white rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-teal-400 [color-scheme:dark]"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-teal-100 mb-1">Sexo *</label>
                      <select 
                        required
                        value={formData.sexo} onChange={e => setFormData({...formData, sexo: e.target.value})}
                        className="w-full bg-slate-800 border border-white/20 text-white rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-teal-400"
                      >
                        <option value="M">Masculino</option>
                        <option value="V">Femenino</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-teal-100 mb-1">Nacionalidad *</label>
                      <input 
                        type="text" required
                        value={formData.nacionalidad} onChange={e => setFormData({...formData, nacionalidad: e.target.value})}
                        className="w-full bg-black/20 border border-white/20 text-white rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-teal-400"
                      />
                    </div>
                  </div>

                  {/* Fila 4: Cargo y Salario */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="md:col-span-1">
                      <label className="block text-sm font-medium text-teal-100 mb-1">Fecha Ingreso *</label>
                      <input 
                        type="date" required
                        value={formData.fecha_ingreso} onChange={e => setFormData({...formData, fecha_ingreso: e.target.value})}
                        className="w-full bg-black/20 border border-white/20 text-white rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-teal-400 [color-scheme:dark]"
                      />
                    </div>
                    <div className="md:col-span-1">
                      <label className="block text-sm font-medium text-teal-100 mb-1">Cargo / Ocupación *</label>
                      <input 
                        type="text" required placeholder="Ej. Contador"
                        value={formData.ocupacion} onChange={e => setFormData({...formData, ocupacion: e.target.value})}
                        className="w-full bg-black/20 border border-white/20 text-white rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-teal-400"
                      />
                    </div>
                    <div className="md:col-span-1">
                      <label className="block text-sm font-medium text-teal-100 mb-1">Haber Básico (Bs.) *</label>
                      <input 
                        type="number" required step="0.01" min="0"
                        value={formData.haber_basico} onChange={e => setFormData({...formData, haber_basico: parseFloat(e.target.value)})}
                        className="w-full bg-black/20 border border-white/20 text-white rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-teal-400"
                      />
                    </div>
                  </div>

                  {error && (
                    <div className="bg-red-500/20 border border-red-500/50 text-red-200 text-sm p-3 rounded-lg flex items-center gap-2">
                      <AlertCircle className="w-5 h-5 shrink-0" />
                      <span>{error}</span>
                    </div>
                  )}

                </form>
              </div>

              {/* Botonera inferior */}
              <div className="p-6 border-t border-white/10 bg-slate-900/40 flex justify-end gap-4 mt-auto">
                <button 
                  type="button" 
                  onClick={() => setShowModal(false)}
                  disabled={submitting}
                  className="px-6 py-2.5 rounded-xl border border-white/20 text-white hover:bg-white/10 transition disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  form="employeeForm"
                  disabled={submitting}
                  className="px-6 py-2.5 rounded-xl bg-teal-500 text-slate-900 font-bold hover:bg-teal-400 hover:scale-105 transition-all shadow-lg flex items-center gap-2 disabled:opacity-50 disabled:hover:scale-100"
                >
                  {submitting ? <><Loader2 className="w-5 h-5 animate-spin" /> Guardando...</> : 'Guardar Empleado'}
                </button>
              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL: VER DETALLES COMPLETOS DEL EMPLEADO */}
      <AnimatePresence>
        {viewingEmployee && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-slate-900 border border-white/10 rounded-[2rem] w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
            >
              {/* Encabezado */}
              <div className="p-6 border-b border-white/10 flex justify-between items-center bg-slate-900/50">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-teal-500/20 text-teal-400 rounded-xl">
                    <Users className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-white">
                      Detalles del Empleado
                    </h2>
                    <p className="text-sm text-slate-400">
                      Información personal y laboral registrada en el sistema.
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => setViewingEmployee(null)}
                  className="text-slate-400 hover:text-white p-2 rounded-xl hover:bg-white/5 transition"
                  title="Cerrar"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              {/* Contenido */}
              <div className="p-6 overflow-y-auto space-y-6">
                {/* Resumen Superior */}
                <div className="bg-white/5 border border-white/10 rounded-2xl p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div>
                    <span className="text-xs font-semibold text-teal-400 tracking-wider uppercase">
                      {viewingEmployee.internal_code ? `Código: ${viewingEmployee.internal_code}` : `ID: #${viewingEmployee.id}`}
                    </span>
                    <h3 className="text-2xl font-bold text-white mt-0.5">
                      {`${viewingEmployee.apellido_paterno} ${viewingEmployee.apellido_materno || ""} ${viewingEmployee.nombres}`.trim().replace(/  +/g, " ").toUpperCase()}
                    </h3>
                    <p className="text-slate-300 font-medium text-sm mt-1">
                      <span className="px-2.5 py-0.5 rounded-lg bg-teal-500/20 text-teal-300 border border-teal-500/30 text-xs font-semibold">
                        {viewingEmployee.ocupacion}
                      </span>
                    </p>
                  </div>
                  <div>
                    {viewingEmployee.is_active ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shadow-sm">
                        <CheckCircle className="w-4 h-4 text-emerald-400" />
                        Activo en Planilla
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30 shadow-sm">
                        <UserX className="w-4 h-4 text-rose-400" />
                        Desvinculado
                      </span>
                    )}
                  </div>
                </div>

                {/* Sección 1: Datos Personales */}
                <div>
                  <h4 className="text-xs font-bold text-teal-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-teal-400"></span>
                    Datos Personales
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div className="bg-white/5 border border-white/10 rounded-xl p-3.5">
                      <span className="text-xs text-slate-400 font-medium">Documento de Identidad (C.I.)</span>
                      <p className="text-base font-bold text-white mt-0.5">
                        {viewingEmployee.documento_identidad} {viewingEmployee.ext_ci ? `(${viewingEmployee.ext_ci})` : ''}
                      </p>
                    </div>

                    <div className="bg-white/5 border border-white/10 rounded-xl p-3.5">
                      <span className="text-xs text-slate-400 font-medium">Nacionalidad</span>
                      <p className="text-base font-bold text-white mt-0.5">
                        {viewingEmployee.nacionalidad || "Boliviana"}
                      </p>
                    </div>

                    <div className="bg-white/5 border border-white/10 rounded-xl p-3.5">
                      <span className="text-xs text-slate-400 font-medium">Fecha de Nacimiento</span>
                      <p className="text-base font-bold text-white mt-0.5">
                        {formatDate(viewingEmployee.fecha_nacimiento)}
                      </p>
                    </div>

                    <div className="bg-white/5 border border-white/10 rounded-xl p-3.5">
                      <span className="text-xs text-slate-400 font-medium">Género / Sexo</span>
                      <p className="text-base font-bold text-white mt-0.5">
                        {viewingEmployee.sexo === "M" || viewingEmployee.sexo === "V" ? "Masculino / Varón" : "Femenino / Mujer"}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Sección 2: Información Laboral y Salarial */}
                <div>
                  <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                    Información Laboral
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div className="bg-white/5 border border-white/10 rounded-xl p-3.5">
                      <span className="text-xs text-slate-400 font-medium">Cargo / Ocupación</span>
                      <p className="text-base font-bold text-white mt-0.5">
                        {viewingEmployee.ocupacion}
                      </p>
                    </div>

                    <div className="bg-white/5 border border-white/10 rounded-xl p-3.5">
                      <span className="text-xs text-slate-400 font-medium">Haber Básico (Sueldo Mensual)</span>
                      <p className="text-base font-bold text-emerald-400 mt-0.5">
                        Bs. {Number(viewingEmployee.haber_basico).toLocaleString('es-BO', { minimumFractionDigits: 2 })}
                      </p>
                    </div>

                    <div className="bg-white/5 border border-white/10 rounded-xl p-3.5">
                      <span className="text-xs text-slate-400 font-medium">Fecha de Ingreso</span>
                      <p className="text-base font-bold text-white mt-0.5">
                        {formatDate(viewingEmployee.fecha_ingreso)}
                      </p>
                    </div>

                    <div className="bg-white/5 border border-white/10 rounded-xl p-3.5">
                      <span className="text-xs text-slate-400 font-medium">Código Interno</span>
                      <p className="text-base font-bold text-white mt-0.5">
                        {viewingEmployee.internal_code || "No asignado"}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Botonera Inferior */}
              <div className="p-6 border-t border-white/10 bg-slate-900/40 flex justify-between items-center gap-4 mt-auto">
                <button 
                  type="button" 
                  onClick={() => {
                    const empToEdit = viewingEmployee;
                    setViewingEmployee(null);
                    handleOpenModal(empToEdit);
                  }}
                  className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold transition flex items-center gap-2 shadow-sm text-sm"
                >
                  <Edit className="w-4 h-4" /> Editar Datos
                </button>

                <button 
                  type="button" 
                  onClick={() => setViewingEmployee(null)}
                  className="px-6 py-2.5 rounded-xl border border-white/20 text-white hover:bg-white/10 transition text-sm font-semibold"
                >
                  Cerrar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </motion.div>
  );
}


export default function EmpleadosPage() {
  return (
    <Suspense fallback={<div className="flex justify-center p-12"><div className="w-8 h-8 border-4 border-teal-500 border-t-transparent rounded-full animate-spin"></div></div>}>
      <EmpleadosPageContent />
    </Suspense>
  );
}
