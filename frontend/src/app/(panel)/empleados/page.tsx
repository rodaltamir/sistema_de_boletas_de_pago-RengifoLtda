"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users,
  Plus,
  Edit,
  Trash2,
  X,
  Search,
  Loader2,
  UserPlus,
  AlertCircle,
  CheckCircle,
  UserX,
  RotateCcw,
  Eye,
  Building2,
  Briefcase,
  Layers,
  Save,
  Check
} from "lucide-react";
import Swal from "sweetalert2";
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
  department_id?: number | null;
  departamento?: string | null;
  fecha_ingreso: string;
  haber_basico: number;
  is_active: boolean;
}

interface Department {
  id: number;
  name: string;
  account_type: string;
  description?: string | null;
  employee_count?: number;
}

function EmpleadosPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const tenantSchema = searchParams.get("tenant");

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<"todos" | "activos" | "desvinculados">("todos");
  const [filterDept, setFilterDept] = useState<string>("todos");
  const [reactivatingId, setReactivatingId] = useState<number | null>(null);
  const [viewingEmployee, setViewingEmployee] = useState<Employee | null>(null);

  // Modal Empleado
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
    department_id: null,
    departamento: null,
    fecha_ingreso: "",
    haber_basico: 3300
  });

  // Modal Gestión de Departamentos
  const [showDeptModal, setShowDeptModal] = useState(false);
  const [deptName, setDeptName] = useState("");
  const [deptType, setDeptType] = useState("MANO_DE_OBRA");
  const [deptDesc, setDeptDesc] = useState("");
  const [editingDeptId, setEditingDeptId] = useState<number | null>(null);
  const [savingDept, setSavingDept] = useState(false);

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

  const fetchDepartments = async () => {
    if (!tenantSchema) return;
    try {
      const res = await fetch(`${getApiUrl()}/api/tenants/${tenantSchema}/departments/`);
      if (res.ok) {
        const data = await res.json();
        setDepartments(data);
      }
    } catch (err) {
      console.error(err);
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
    fetchDepartments();
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
        department_id: departments.length > 0 ? departments[0].id : null,
        departamento: departments.length > 0 ? departments[0].name : null,
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

    if (formData.fecha_nacimiento && formData.fecha_ingreso) {
      const birth = new Date(formData.fecha_nacimiento);
      const hire = new Date(formData.fecha_ingreso);
      if (hire <= birth) {
        setError("La fecha de ingreso no puede ser anterior o igual a la fecha de nacimiento.");
        setSubmitting(false);
        return;
      }
      const ageAtHire = hire.getFullYear() - birth.getFullYear() - (
        (hire.getMonth() < birth.getMonth() || (hire.getMonth() === birth.getMonth() && hire.getDate() < birth.getDate())) ? 1 : 0
      );
      if (ageAtHire < 14) {
        setError(`Fecha de ingreso inválida: el empleado tendría ${ageAtHire} años al ingresar (la edad mínima legal de trabajo en Bolivia es de 14 años).`);
        setSubmitting(false);
        return;
      }
    }
    
    try {
      const url = isEditing 
        ? `${getApiUrl()}/api/tenants/${tenantSchema}/employees/${formData.id}/`
        : `${getApiUrl()}/api/tenants/${tenantSchema}/employees/`;
      
      const method = isEditing ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData)
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.detail || "Error al procesar la solicitud");
      }

      setShowModal(false);
      fetchEmployees();
      fetchDepartments();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeactivate = async (id: number) => {
    if (!confirm("¿Está seguro de marcar este empleado como desvinculado/inactivo? No aparecerá en las próximas planillas.")) return;
    try {
      const res = await fetch(`${getApiUrl()}/api/tenants/${tenantSchema}/employees/${id}/deactivate/`, {
        method: "PUT"
      });
      if (res.ok) {
        fetchEmployees();
        fetchDepartments();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleReactivate = async (id: number) => {
    setReactivatingId(id);
    try {
      const res = await fetch(`${getApiUrl()}/api/tenants/${tenantSchema}/employees/${id}/reactivate/`, {
        method: "PUT"
      });
      if (res.ok) {
        fetchEmployees();
        fetchDepartments();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setReactivatingId(null);
    }
  };

  const handleDeletePermanent = async (id: number) => {
    if (!confirm("¿Deseas ELIMINAR PERMANENTEMENTE este empleado? Esta acción no se puede deshacer y borrará todo su historial.")) return;
    try {
      const res = await fetch(`${getApiUrl()}/api/tenants/${tenantSchema}/employees/${id}/`, {
        method: "DELETE"
      });
      if (res.ok) {
        fetchEmployees();
        fetchDepartments();
      } else {
        const d = await res.json();
        alert(d.detail || "Error al eliminar");
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Departamentos CRUD
  const handleSaveDepartment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deptName.trim()) return;
    setSavingDept(true);
    try {
      const payload = {
        name: deptName.trim(),
        account_type: deptType,
        description: deptDesc.trim() || null
      };

      const url = editingDeptId
        ? `${getApiUrl()}/api/tenants/${tenantSchema}/departments/${editingDeptId}`
        : `${getApiUrl()}/api/tenants/${tenantSchema}/departments/`;
      const method = editingDeptId ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        setDeptName("");
        setDeptDesc("");
        setDeptType("MANO_DE_OBRA");
        setEditingDeptId(null);
        fetchDepartments();
        fetchEmployees();
        Swal.fire({
          title: "¡Departamento Guardado!",
          icon: "success",
          timer: 1500,
          showConfirmButton: false
        });
      } else {
        const err = await res.json();
        alert(err.detail || "Error al guardar departamento");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSavingDept(false);
    }
  };

  const handleDeleteDepartment = async (deptId: number, deptName: string) => {
    const res = await Swal.fire({
      title: `¿Eliminar departamento "${deptName}"?`,
      text: "Los empleados asignados quedarán sin departamento hasta que los reasignes.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Sí, eliminar",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#e11d48"
    });

    if (res.isConfirmed) {
      try {
        const delRes = await fetch(`${getApiUrl()}/api/tenants/${tenantSchema}/departments/${deptId}`, {
          method: "DELETE"
        });
        if (delRes.ok) {
          fetchDepartments();
          fetchEmployees();
        }
      } catch (err) {
        console.error(err);
      }
    }
  };

  const handleEditDept = (dept: Department) => {
    setEditingDeptId(dept.id);
    setDeptName(dept.name);
    setDeptType(dept.account_type);
    setDeptDesc(dept.description || "");
  };

  const handleCancelDeptEdit = () => {
    setEditingDeptId(null);
    setDeptName("");
    setDeptDesc("");
    setDeptType("MANO_DE_OBRA");
  };

  const activeCount = employees.filter(e => e.is_active).length;
  const inactiveCount = employees.filter(e => !e.is_active).length;

  const filteredEmployees = employees.filter(emp => {
    const q = search.toLowerCase();
    const matchesSearch = 
      emp.nombres.toLowerCase().includes(q) ||
      emp.apellido_paterno.toLowerCase().includes(q) ||
      (emp.apellido_materno && emp.apellido_materno.toLowerCase().includes(q)) ||
      emp.documento_identidad.includes(q) ||
      (emp.internal_code && emp.internal_code.toLowerCase().includes(q)) ||
      emp.ocupacion.toLowerCase().includes(q) ||
      (emp.departamento && emp.departamento.toLowerCase().includes(q));

    if (!matchesSearch) return false;

    if (filterStatus === "activos") return emp.is_active;
    if (filterStatus === "desvinculados") return !emp.is_active;

    if (filterDept !== "todos") {
      if (filterDept === "sin_depto") return !emp.department_id;
      return emp.department_id === parseInt(filterDept);
    }

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
      className="space-y-6 max-w-7xl mx-auto"
    >
      {/* Cabecera */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-black text-slate-900 flex items-center gap-2 tracking-tight">
            <Users className="text-teal-600 w-8 h-8" />
            Nómina de Empleados
          </h1>
          <p className="text-slate-500 text-sm mt-1">Administra el personal, departamentos contables, cargos y salarios base.</p>
        </div>
        
        <div className="flex items-center gap-3">
          {isAdmin && (
            <button
              onClick={() => setShowDeptModal(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-800 font-bold rounded-xl text-sm transition shadow-xs"
            >
              <Building2 className="w-4 h-4 text-teal-600" /> Gestionar Departamentos ({departments.length})
            </button>
          )}

          <button 
            onClick={() => handleOpenModal()}
            className="flex items-center gap-2 px-5 py-2.5 bg-teal-600 text-white font-bold rounded-xl hover:bg-teal-700 transition shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 text-sm"
          >
            <UserPlus className="w-4 h-4" /> Agregar Empleado
          </button>
        </div>
      </div>

      {/* Buscador y Tabla */}
      <div className="bg-white rounded-[2rem] shadow-xs border border-slate-200/80 overflow-hidden">
        
        {/* Barra de Búsqueda y Filtros */}
        <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex flex-col md:flex-row justify-between items-stretch md:items-center gap-4">
          <div className="relative max-w-md flex-1">
            <Search className="absolute left-4 top-3 text-slate-400 w-4 h-4" />
            <input 
              type="text" 
              placeholder="Buscar por nombre, CI, cargo o departamento..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-11 pr-4 py-2 rounded-xl border border-slate-300 text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white text-sm"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Filtro por Departamento */}
            <select
              value={filterDept}
              onChange={(e) => setFilterDept(e.target.value)}
              className="text-xs font-bold text-slate-700 bg-white border border-slate-300 rounded-xl px-3 py-2 focus:ring-2 focus:ring-teal-500"
            >
              <option value="todos">Todos los Departamentos</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id.toString()}>
                  {d.name} ({d.employee_count || 0})
                </option>
              ))}
              <option value="sin_depto">Sin Departamento</option>
            </select>

            {/* Filtros: Todos / Activos / Desvinculados */}
            <div className="flex bg-slate-200/80 p-1 rounded-xl gap-1">
              <button
                onClick={() => setFilterStatus("todos")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${filterStatus === "todos" ? "bg-white text-slate-900 shadow-xs" : "text-slate-600 hover:text-slate-900"}`}
              >
                Todos ({employees.length})
              </button>
              <button
                onClick={() => setFilterStatus("activos")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${filterStatus === "activos" ? "bg-emerald-600 text-white shadow-xs" : "text-slate-600 hover:text-slate-900"}`}
              >
                <CheckCircle className="w-3.5 h-3.5" />
                Activos ({activeCount})
              </button>
              <button
                onClick={() => setFilterStatus("desvinculados")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${filterStatus === "desvinculados" ? "bg-rose-600 text-white shadow-xs" : "text-slate-600 hover:text-slate-900"}`}
              >
                <UserX className="w-3.5 h-3.5" />
                Desvinculados ({inactiveCount})
              </button>
            </div>
          </div>
        </div>

        {/* Tabla Responsiva */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-700 font-semibold text-xs uppercase tracking-wider border-b border-slate-200">
                <th className="p-4 pl-6">C.I. / Documento</th>
                <th className="p-4">Apellidos y Nombres</th>
                <th className="p-4">Cargo / Área</th>
                <th className="p-4">F. Ingreso</th>
                <th className="p-4">Haber Básico</th>
                <th className="p-4 text-center">Estado</th>
                <th className="p-4 pr-6 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {filteredEmployees.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-400 font-medium">
                    No se encontraron empleados con los filtros seleccionados.
                  </td>
                </tr>
              ) : (
                filteredEmployees.map((emp) => (
                  <tr key={emp.id} className="hover:bg-slate-50/70 transition">
                    <td className="p-4 pl-6 font-mono text-xs font-bold text-slate-700">
                      <div>{emp.documento_identidad} {emp.ext_ci}</div>
                      {emp.internal_code && (
                        <div className="text-[10px] text-teal-600 font-bold">Cód: {emp.internal_code}</div>
                      )}
                    </td>

                    <td className="p-4 font-bold text-slate-900">
                      {emp.apellido_paterno} {emp.apellido_materno || ""} {emp.nombres}
                    </td>

                    <td className="p-4">
                      <div className="font-semibold text-slate-800">{emp.ocupacion}</div>
                      {emp.departamento ? (
                        <span className={`inline-flex items-center px-2 py-0.5 mt-0.5 rounded-md text-[10px] font-bold ${
                          emp.departamento.toLowerCase().includes("admin")
                            ? "bg-blue-50 text-blue-700 border border-blue-200"
                            : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                        }`}>
                          {emp.departamento}
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-400 italic">Sin departamento</span>
                      )}
                    </td>

                    <td className="p-4 text-xs text-slate-600 font-mono">
                      {formatDate(emp.fecha_ingreso)}
                    </td>

                    <td className="p-4 font-mono font-bold text-slate-900">
                      Bs. {emp.haber_basico.toLocaleString("es-BO", { minimumFractionDigits: 2 })}
                    </td>

                    <td className="p-4 text-center">
                      {emp.is_active ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle className="w-3 h-3" /> Activo
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
                          <UserX className="w-3 h-3" /> Retirado
                        </span>
                      )}
                    </td>

                    <td className="p-4 pr-6 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => setViewingEmployee(emp)}
                          className="p-1.5 text-slate-400 hover:text-teal-600 rounded-lg hover:bg-slate-100 transition"
                          title="Ver Ficha"
                        >
                          <Eye className="w-4 h-4" />
                        </button>

                        {isAdmin && (
                          <button
                            onClick={() => handleOpenModal(emp)}
                            className="p-1.5 text-slate-400 hover:text-blue-600 rounded-lg hover:bg-slate-100 transition"
                            title="Editar"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                        )}

                        {isAdmin && (
                          emp.is_active ? (
                            <button
                              onClick={() => handleDeactivate(emp.id)}
                              className="p-1.5 text-slate-400 hover:text-amber-600 rounded-lg hover:bg-slate-100 transition"
                              title="Desvincular / Inactivar"
                            >
                              <UserX className="w-4 h-4" />
                            </button>
                          ) : (
                            <button
                              onClick={() => handleReactivate(emp.id)}
                              disabled={reactivatingId === emp.id}
                              className="p-1.5 text-slate-400 hover:text-emerald-600 rounded-lg hover:bg-slate-100 transition"
                              title="Reincorporar empleado"
                            >
                              <RotateCcw className={`w-4 h-4 ${reactivatingId === emp.id ? "animate-spin text-emerald-600" : ""}`} />
                            </button>
                          )
                        )}

                        {isAdmin && (
                          <button
                            onClick={() => handleDeletePermanent(emp.id)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-slate-100 transition"
                            title="Eliminar permanentemente"
                          >
                            <Trash2 className="w-4 h-4" />
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

      {/* MODAL: GESTIONAR DEPARTAMENTOS */}
      <AnimatePresence>
        {showDeptModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowDeptModal(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="p-6 border-b border-slate-200 flex justify-between items-center bg-slate-50">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-teal-50 text-teal-700 rounded-2xl border border-teal-200">
                    <Building2 className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-slate-900">
                      Gestión de Departamentos
                    </h2>
                    <p className="text-xs text-slate-500">
                      Define las áreas para clasificar a los colaboradores y contabilizar sueldos vs mano de obra.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowDeptModal(false)}
                  className="text-slate-400 hover:text-slate-700 p-2 rounded-xl hover:bg-slate-200 transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 overflow-y-auto space-y-6">
                {/* Formulario de Crear / Editar Departamento */}
                <form onSubmit={handleSaveDepartment} className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                      {editingDeptId ? "Editar Departamento" : "Nuevo Departamento"}
                    </h3>
                    {editingDeptId && (
                      <button
                        type="button"
                        onClick={handleCancelDeptEdit}
                        className="text-xs text-slate-500 hover:text-slate-800 underline"
                      >
                        Cancelar Edición
                      </button>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Nombre del Departamento / Área *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Ej. Administración, Mano de Obra, Marketing, Ventas, Taller..."
                      value={deptName}
                      onChange={(e) => setDeptName(e.target.value)}
                      className="w-full text-xs font-semibold border border-slate-300 rounded-xl px-3 py-2 bg-white text-slate-900 focus:ring-2 focus:ring-teal-500"
                    />
                    <p className="text-[11px] text-slate-500 mt-1">
                      Cada departamento generará automáticamente sus cuentas de Sueldos y Salarios y Bono de Antigüedad en los Asientos Contables.
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Descripción / Notas (Opcional)</label>
                    <input
                      type="text"
                      placeholder="Ej. Personal de planta y mantenimiento"
                      value={deptDesc}
                      onChange={(e) => setDeptDesc(e.target.value)}
                      className="w-full text-xs font-semibold border border-slate-300 rounded-xl px-3 py-2 bg-white text-slate-900 focus:ring-2 focus:ring-teal-500"
                    />
                  </div>

                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={savingDept}
                      className="flex items-center gap-1.5 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl text-xs transition shadow-xs"
                    >
                      {savingDept ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                      {editingDeptId ? "Actualizar Departamento" : "Agregar Departamento"}
                    </button>
                  </div>
                </form>

                {/* Lista de Departamentos Existentes */}
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-3">
                    Departamentos Registrados ({departments.length})
                  </h3>

                  <div className="divide-y divide-slate-100 border border-slate-200 rounded-2xl overflow-hidden bg-white">
                    {departments.length === 0 ? (
                      <div className="p-6 text-center text-xs text-slate-400">
                        No hay departamentos configurados aún.
                      </div>
                    ) : (
                      departments.map((d) => (
                        <div key={d.id} className="p-4 flex items-center justify-between hover:bg-slate-50 transition">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-slate-900 text-sm">{d.name}</span>
                              <span className="text-xs text-slate-500 font-mono">
                                ({d.employee_count || 0} empleados)
                              </span>
                            </div>
                            {d.description && (
                              <p className="text-xs text-slate-500 mt-0.5">{d.description}</p>
                            )}
                          </div>

                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleEditDept(d)}
                              className="p-1.5 text-slate-400 hover:text-blue-600 rounded-lg hover:bg-slate-100"
                              title="Editar Departamento"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteDepartment(d.id, d.name)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-slate-100"
                              title="Eliminar Departamento"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal de Registro / Edición de Empleado */}
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
              className="relative w-full max-w-3xl bg-slate-900 border border-slate-700 rounded-[2rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="p-6 border-b border-white/10 flex justify-between items-center bg-slate-900/80">
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
                        className="w-full bg-black/30 border border-white/20 text-white rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-teal-400"
                      />
                    </div>
                    <div className="md:col-span-1">
                      <label className="block text-sm font-medium text-teal-100 mb-1">Extensión (Exp.) *</label>
                      <input 
                        type="text" required placeholder="LP, OR, CB..."
                        list="ci_extensions"
                        value={formData.ext_ci || ""} onChange={e => setFormData({...formData, ext_ci: e.target.value})}
                        className="w-full bg-black/30 border border-white/20 text-white rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-teal-400"
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
                        className="w-full bg-black/30 border border-white/20 text-white rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-teal-400"
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
                        className="w-full bg-black/30 border border-white/20 text-white rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-teal-400"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-teal-100 mb-1">Ap. Paterno *</label>
                      <input 
                        type="text" required placeholder="Paterno"
                        value={formData.apellido_paterno} onChange={e => setFormData({...formData, apellido_paterno: e.target.value})}
                        className="w-full bg-black/30 border border-white/20 text-white rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-teal-400"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-teal-100 mb-1">Ap. Materno</label>
                      <input 
                        type="text" placeholder="Materno (Opcional)"
                        value={formData.apellido_materno || ""} onChange={e => setFormData({...formData, apellido_materno: e.target.value})}
                        className="w-full bg-black/30 border border-white/20 text-white rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-teal-400"
                      />
                    </div>
                  </div>

                  {/* Fila 3: Datos Personales */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-teal-100 mb-1">Fecha Nacimiento *</label>
                      <input 
                        type="date" required
                        value={formData.fecha_nacimiento} onChange={e => setFormData({...formData, fecha_nacimiento: e.target.value})}
                        className="w-full bg-black/30 border border-white/20 text-white rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-teal-400 [color-scheme:dark]"
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
                        className="w-full bg-black/30 border border-white/20 text-white rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-teal-400"
                      />
                    </div>
                  </div>

                  {/* Fila 4: Cargo, Departamento y Salario */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-teal-100 mb-1">Fecha Ingreso *</label>
                      <input 
                        type="date" required
                        value={formData.fecha_ingreso} onChange={e => setFormData({...formData, fecha_ingreso: e.target.value})}
                        className="w-full bg-black/30 border border-white/20 text-white rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-teal-400 [color-scheme:dark]"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-teal-100 mb-1">Cargo / Ocupación *</label>
                      <input 
                        type="text" required placeholder="Ej. Tornero, Contador"
                        value={formData.ocupacion} onChange={e => setFormData({...formData, ocupacion: e.target.value})}
                        className="w-full bg-black/30 border border-white/20 text-white rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-teal-400"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-teal-100 mb-1">Haber Básico (Bs.) *</label>
                      <input 
                        type="number" required step="0.01" min="0"
                        value={formData.haber_basico} onChange={e => setFormData({...formData, haber_basico: parseFloat(e.target.value)})}
                        className="w-full bg-black/30 border border-white/20 text-white rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-teal-400"
                      />
                    </div>
                  </div>

                  {/* Fila 5: Departamento Asignado */}
                  <div>
                    <label className="block text-sm font-medium text-teal-100 mb-1">
                      Departamento / Área Contable
                    </label>
                    <select
                      value={formData.department_id || ""}
                      onChange={(e) => {
                        const val = e.target.value ? parseInt(e.target.value) : null;
                        const dep = departments.find((d) => d.id === val);
                        setFormData({
                          ...formData,
                          department_id: val,
                          departamento: dep ? dep.name : null
                        });
                      }}
                      className="w-full bg-slate-800 border border-white/20 text-white rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-teal-400"
                    >
                      <option value="">-- Sin Departamento Asignado --</option>
                      {departments.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name}
                        </option>
                      ))}
                    </select>
                    <p className="text-[11px] text-teal-300/70 mt-1">
                      Asigna el departamento para la distribución contable de sueldos y bonos en los asientos.
                    </p>
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
              <div className="p-6 border-t border-white/10 bg-slate-900/80 flex justify-end gap-4 mt-auto">
                <button 
                  type="button" 
                  onClick={() => setShowModal(false)}
                  disabled={submitting}
                  className="px-6 py-2.5 rounded-xl border border-white/20 text-white hover:bg-white/10 transition disabled:opacity-50 text-sm"
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  form="employeeForm"
                  disabled={submitting}
                  className="px-6 py-2.5 rounded-xl bg-teal-500 text-slate-950 font-bold hover:bg-teal-400 transition-all shadow-lg flex items-center gap-2 disabled:opacity-50 text-sm"
                >
                  {submitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Guardando...</> : 'Guardar Empleado'}
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

              <div className="p-6 overflow-y-auto space-y-6">
                <div className="flex items-center gap-4 bg-white/5 p-4 rounded-2xl border border-white/10">
                  <div className="w-14 h-14 rounded-2xl bg-teal-500/20 text-teal-300 flex items-center justify-center font-black text-xl">
                    {viewingEmployee.nombres.charAt(0)}{viewingEmployee.apellido_paterno.charAt(0)}
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white">
                      {viewingEmployee.apellido_paterno} {viewingEmployee.apellido_materno || ""} {viewingEmployee.nombres}
                    </h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs font-mono text-teal-300 bg-teal-500/10 px-2 py-0.5 rounded border border-teal-500/20">
                        CI: {viewingEmployee.documento_identidad} {viewingEmployee.ext_ci}
                      </span>
                      {viewingEmployee.departamento && (
                        <span className="text-xs font-bold text-blue-300 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20">
                          {viewingEmployee.departamento}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="p-3.5 bg-white/5 rounded-xl border border-white/5">
                    <p className="text-xs text-slate-400">Cargo / Ocupación</p>
                    <p className="font-bold text-white mt-1">{viewingEmployee.ocupacion}</p>
                  </div>
                  <div className="p-3.5 bg-white/5 rounded-xl border border-white/5">
                    <p className="text-xs text-slate-400">Haber Básico Mensual</p>
                    <p className="font-bold text-emerald-400 font-mono mt-1">
                      Bs. {viewingEmployee.haber_basico.toLocaleString("es-BO", { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                  <div className="p-3.5 bg-white/5 rounded-xl border border-white/5">
                    <p className="text-xs text-slate-400">Fecha de Ingreso</p>
                    <p className="font-bold text-white mt-1">{formatDate(viewingEmployee.fecha_ingreso)}</p>
                  </div>
                  <div className="p-3.5 bg-white/5 rounded-xl border border-white/5">
                    <p className="text-xs text-slate-400">Fecha de Nacimiento</p>
                    <p className="font-bold text-white mt-1">{formatDate(viewingEmployee.fecha_nacimiento)}</p>
                  </div>
                  <div className="p-3.5 bg-white/5 rounded-xl border border-white/5">
                    <p className="text-xs text-slate-400">Nacionalidad</p>
                    <p className="font-bold text-white mt-1">{viewingEmployee.nacionalidad}</p>
                  </div>
                  <div className="p-3.5 bg-white/5 rounded-xl border border-white/5">
                    <p className="text-xs text-slate-400">Sexo</p>
                    <p className="font-bold text-white mt-1">{viewingEmployee.sexo === "M" ? "Masculino" : "Femenino"}</p>
                  </div>
                </div>
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
