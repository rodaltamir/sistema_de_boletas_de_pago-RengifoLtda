"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Building2, Plus, ArrowRight, Briefcase, Factory, Store, X, Upload, CheckCircle2, AlertCircle, Building, Loader2 } from "lucide-react";

import Swal from "sweetalert2";

// Mapeo de iconos disponibles
const ICON_OPTIONS = {
  Building2,
  Briefcase,
  Factory,
  Store,
  Building
};

type IconName = keyof typeof ICON_OPTIONS;

interface Tenant {
  id: number;
  name: string;
  schema_name: string;
  nit: string | null;
  icon: string | null;
}

export default function SeleccionarEmpresa() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Estado del formulario
  const [formData, setFormData] = useState({
    name: "",
    nit: "",
    numero_patronal: "",
    min_trabajo_id: "",
    icon: "Building2" as IconName,
    logo_base64: "",
    empleador_nombres: "",
    empleador_apellido_paterno: "",
    empleador_apellido_materno: "",
    empleador_ci: "",
    empleador_nit: ""
  });

  // Cargar empresas desde el Backend
  const fetchTenants = async () => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://Rengifo_Ltda:8000"}/api/tenants/`);
      if (res.ok) {
        const data = await res.json();
        setTenants(data);
      } else {
        console.error("Error al obtener empresas", await res.text());
      }
    } catch (err) {
      console.error("Error cargando empresas", err);
      Swal.fire({
        title: "Error de conexión",
        text: "No se pudo conectar con el servidor para obtener las empresas. Verifica que el backend esté ejecutándose.",
        icon: "error",
        background: "#1e293b",
        color: "#fff",
        confirmButtonColor: "#14b8a6"
      });
    } finally {
      setLoading(false);
    }
  };

  const [isAdmin, setIsAdmin] = useState(false);
  const [editingTenant, setEditingTenant] = useState<string | null>(null);

  useEffect(() => {
    setIsAdmin(localStorage.getItem("isAdmin") === "true");
    fetchTenants();
  }, []);

  // Manejar subida de archivo y convertir a Base64
  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData({ ...formData, logo_base64: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  // Abrir modal para editar
  const handleEdit = (tenant: any) => {
    setEditingTenant(tenant.schema_name);
    setFormData({
      name: tenant.name || "",
      nit: tenant.nit || "",
      numero_patronal: tenant.numero_patronal || "",
      min_trabajo_id: tenant.min_trabajo_id || "",
      icon: (tenant.icon as IconName) || "Building2",
      logo_base64: tenant.logo_base64 || "",
      empleador_nombres: tenant.empleador_nombres || "",
      empleador_apellido_paterno: tenant.empleador_apellido_paterno || "",
      empleador_apellido_materno: tenant.empleador_apellido_materno || "",
      empleador_ci: tenant.empleador_ci || "",
      empleador_nit: tenant.empleador_nit || ""
    });
    setShowModal(true);
  };

  // Eliminar empresa
  const handleDelete = async (schemaName: string) => {
    const result = await Swal.fire({
      title: "¿Estás seguro?",
      text: "Se eliminará esta empresa (desactivación lógica). No podrás revertir esto.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#14b8a6", // teal-500
      cancelButtonColor: "#ef4444", // red-500
      confirmButtonText: "Sí, eliminar",
      cancelButtonText: "Cancelar",
      background: "#1e293b", // slate-800
      color: "#fff"
    });

    if (!result.isConfirmed) return;

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://Rengifo_Ltda:8000"}/api/tenants/${schemaName}`, {
        method: "DELETE"
      });
      if (res.ok) {
        Swal.fire({
          title: "¡Eliminado!",
          text: "La empresa ha sido eliminada.",
          icon: "success",
          background: "#1e293b",
          color: "#fff",
          confirmButtonColor: "#14b8a6"
        });
        fetchTenants();
      } else {
        Swal.fire({
          title: "Error",
          text: "Error al eliminar la empresa. (Asegúrate de haber reiniciado el servidor backend)",
          icon: "error",
          background: "#1e293b",
          color: "#fff",
          confirmButtonColor: "#14b8a6"
        });
      }
    } catch (err) {
      Swal.fire({
        title: "Error de conexión",
        text: "No se pudo conectar con el servidor.",
        icon: "error",
        background: "#1e293b",
        color: "#fff",
        confirmButtonColor: "#14b8a6"
      });
    }
  };

  // Enviar formulario al Backend
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");

    // Validaciones estrictas
    if (formData.name.trim().length < 3) {
      const msg = "El nombre de la empresa debe tener al menos 3 caracteres.";
      setError(msg);
      Swal.fire({ title: "Validación", text: msg, icon: "warning", background: "#1e293b", color: "#fff" });
      setSubmitting(false);
      return;
    }
    
    if (formData.nit && !/^\d+$/.test(formData.nit.replace(/\s/g, ''))) {
      const msg = "El NIT debe contener únicamente números.";
      setError(msg);
      Swal.fire({ title: "Validación", text: msg, icon: "warning", background: "#1e293b", color: "#fff" });
      setSubmitting(false);
      return;
    }
    
    if (formData.numero_patronal && formData.numero_patronal.length < 5) {
      const msg = "El Nº Patronal ingresado no parece válido.";
      setError(msg);
      Swal.fire({ title: "Validación", text: msg, icon: "warning", background: "#1e293b", color: "#fff" });
      setSubmitting(false);
      return;
    }

    try {
      const url = editingTenant 
        ? `${process.env.NEXT_PUBLIC_API_URL || "http://Rengifo_Ltda:8000"}/api/tenants/${editingTenant}`
        : `${process.env.NEXT_PUBLIC_API_URL || "http://Rengifo_Ltda:8000"}/api/tenants/`;
      const method = editingTenant ? "PUT" : "POST";

      const res = await fetch(url, {
        method: method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData)
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({ detail: "Error desconocido del servidor" }));
        throw new Error(data.detail || "Error al procesar la empresa");
      }

      await fetchTenants(); // Recargar la lista
      setShowModal(false); // Cerrar modal
      
      Swal.fire({
        title: "¡Éxito!",
        text: editingTenant ? "Empresa actualizada correctamente." : "Entorno empresarial creado correctamente.",
        icon: "success",
        background: "#1e293b",
        color: "#fff",
        confirmButtonColor: "#14b8a6"
      });
      
      setEditingTenant(null);
      // Resetear formulario
      setFormData({
        name: "", nit: "", numero_patronal: "", min_trabajo_id: "", icon: "Building2", logo_base64: "",
        empleador_nombres: "", empleador_apellido_paterno: "", empleador_apellido_materno: "", empleador_ci: "", empleador_nit: ""
      });
    } catch (err: any) {
      setError(err.message);
      Swal.fire({
        title: "Error de conexión o validación",
        text: err.message === "Failed to fetch" 
          ? "No se pudo conectar con el backend. Verifica tu conexión o los ajustes del puerto 8000."
          : err.message,
        icon: "error",
        background: "#1e293b",
        color: "#fff",
        confirmButtonColor: "#ef4444"
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-slate-900 via-teal-900 to-cyan-900 p-4 sm:p-8">
      <div className="w-full max-w-6xl">
        
        {/* Encabezado sin logo */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12 mt-8"
        >
          <h1 className="text-4xl font-extrabold text-white drop-shadow-md">Entornos Empresariales</h1>
          <p className="text-teal-200 mt-3 text-lg">Selecciona la empresa que deseas administrar o registra una nueva.</p>
        </motion.div>

        {/* Grid de Empresas */}
        {loading ? (
          <div className="flex justify-center items-center py-20">
            <Loader2 className="w-12 h-12 text-teal-400 animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            
            {/* Tarjetas de Empresas Existentes */}
            {tenants.map((tenant, idx) => {
              const SelectedIcon = ICON_OPTIONS[(tenant.icon as IconName) || "Building2"] || Building2;
              return (
                <motion.div
                  key={tenant.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.1 * idx }}
                  className="relative group h-full"
                >
                  {isAdmin && (
                    <div className="absolute top-4 right-4 z-20 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={(e) => { e.preventDefault(); handleEdit(tenant); }}
                        className="bg-blue-500 hover:bg-blue-600 text-white p-2 rounded-full shadow-lg transition"
                        title="Editar Empresa"
                      >
                        <Briefcase className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={(e) => { e.preventDefault(); handleDelete(tenant.schema_name); }}
                        className="bg-red-500 hover:bg-red-600 text-white p-2 rounded-full shadow-lg transition"
                        title="Eliminar Empresa"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                  <Link href={`/inicio?tenant=${tenant.schema_name}`} className="block h-full">
                    <div className="h-full bg-white/10 backdrop-blur-xl border border-white/20 p-8 rounded-3xl shadow-2xl hover:bg-white/20 hover:border-teal-400/50 transition-all duration-300 relative overflow-hidden flex flex-col">
                      <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 group-hover:scale-110 transition-all">
                        <SelectedIcon className="w-32 h-32 text-white" />
                      </div>
                      
                      <div className="bg-teal-500/20 w-16 h-16 rounded-2xl flex items-center justify-center border border-teal-400/30 mb-6 group-hover:scale-110 transition-transform">
                        <SelectedIcon className="text-teal-300 w-8 h-8" />
                      </div>
                      <h2 className="text-2xl font-bold text-white mb-2 line-clamp-2">{tenant.name}</h2>
                      <p className="text-teal-100/70 text-sm mb-6 flex-grow">
                        NIT: {tenant.nit || "No registrado"} <br/> 
                        Esquema BD: {tenant.schema_name}
                      </p>
                      
                      <div className="flex items-center text-teal-300 font-semibold group-hover:text-teal-100 transition-colors mt-auto">
                        Administrar Planillas <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
                      </div>
                    </div>
                  </Link>
                </motion.div>
              );
            })}

            {/* Botón Tarjeta Nueva Empresa (Solo Admin) */}
            {isAdmin && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.2 }}
              >
                <button 
                  onClick={() => setShowModal(true)}
                  className="w-full h-full text-left group"
                >
                  <div className="h-full bg-black/20 backdrop-blur-xl border-2 border-dashed border-white/20 p-8 rounded-3xl hover:bg-white/5 hover:border-teal-400/50 transition-all duration-300 flex flex-col items-center justify-center min-h-[300px]">
                    <div className="bg-white/5 w-16 h-16 rounded-full flex items-center justify-center border border-white/10 mb-4 group-hover:scale-110 group-hover:bg-teal-500/20 transition-all shadow-lg">
                      <Plus className="text-white/50 group-hover:text-teal-300 w-8 h-8" />
                    </div>
                    <h2 className="text-xl font-bold text-white/70 group-hover:text-white mb-2 text-center">Registrar Nueva Empresa</h2>
                    <p className="text-white/40 text-sm text-center">Configura un nuevo entorno aislado</p>
                  </div>
                </button>
              </motion.div>
            )}
          </div>
        )}
      </div>

      {/* Modal Glassmorphism de Registro de Empresa */}
      <AnimatePresence>
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !submitting && (setShowModal(false), setEditingTenant(null))}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-2xl bg-white/10 backdrop-blur-2xl border border-white/20 rounded-[2rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="p-6 border-b border-white/10 flex justify-between items-center bg-black/20">
                <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                  <Building2 className="text-teal-400 w-6 h-6" /> {editingTenant ? "Editar Empresa" : "Nueva Empresa (Tenant)"}
                </h2>
                <button onClick={() => !submitting && (setShowModal(false), setEditingTenant(null))} className="text-white/50 hover:text-white transition">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="p-6 overflow-y-auto custom-scrollbar">
                <form id="tenantForm" onSubmit={handleSubmit} className="space-y-6">
                  
                  {/* Fila 1: Nombre */}
                  <div>
                    <label className="block text-sm font-medium text-teal-100 mb-1">Razón Social o Nombre *</label>
                    <input 
                      type="text" required placeholder="Ej. Constructora Rengifo S.A."
                      value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})}
                      className="w-full bg-black/20 border border-white/20 text-white rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-teal-400"
                    />
                  </div>

                  {/* Fila 2: Datos Legales */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-teal-100 mb-1">NIT</label>
                      <input 
                        type="text" placeholder="Ej. 123456020"
                        value={formData.nit} onChange={e => setFormData({...formData, nit: e.target.value})}
                        className="w-full bg-black/20 border border-white/20 text-white rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-teal-400"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-teal-100 mb-1">Nº Patronal (Caja)</label>
                      <input 
                        type="text" placeholder="Ej. 01-234-56"
                        value={formData.numero_patronal} onChange={e => setFormData({...formData, numero_patronal: e.target.value})}
                        className="w-full bg-black/20 border border-white/20 text-white rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-teal-400"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-teal-100 mb-1">Min. Trabajo ID</label>
                      <input 
                        type="text" placeholder="Nº ROE"
                        value={formData.min_trabajo_id} onChange={e => setFormData({...formData, min_trabajo_id: e.target.value})}
                        className="w-full bg-black/20 border border-white/20 text-white rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-teal-400"
                      />
                    </div>
                  </div>

                  {/* Fila: Datos del Empleador */}
                  <div>
                    <h3 className="text-lg font-semibold text-white mb-3 mt-2 border-b border-white/10 pb-2">Datos del Representante Legal (Empleador)</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      <div>
                        <label className="block text-sm font-medium text-teal-100 mb-1">Nombres</label>
                        <input 
                          type="text" placeholder="Ej. Juan Carlos"
                          value={formData.empleador_nombres} onChange={e => setFormData({...formData, empleador_nombres: e.target.value})}
                          className="w-full bg-black/20 border border-white/20 text-white rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-teal-400"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-teal-100 mb-1">Ap. Paterno</label>
                          <input 
                            type="text" placeholder="Pérez"
                            value={formData.empleador_apellido_paterno} onChange={e => setFormData({...formData, empleador_apellido_paterno: e.target.value})}
                            className="w-full bg-black/20 border border-white/20 text-white rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-teal-400"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-teal-100 mb-1">Ap. Materno</label>
                          <input 
                            type="text" placeholder="Gómez"
                            value={formData.empleador_apellido_materno} onChange={e => setFormData({...formData, empleador_apellido_materno: e.target.value})}
                            className="w-full bg-black/20 border border-white/20 text-white rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-teal-400"
                          />
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-teal-100 mb-1">Cédula de Identidad (CI)</label>
                        <input 
                          type="text" placeholder="Ej. 1234567"
                          value={formData.empleador_ci} onChange={e => setFormData({...formData, empleador_ci: e.target.value})}
                          className="w-full bg-black/20 border border-white/20 text-white rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-teal-400"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-teal-100 mb-1">NIT del Empleador</label>
                        <input 
                          type="text" placeholder="Ej. 1234567010"
                          value={formData.empleador_nit} onChange={e => setFormData({...formData, empleador_nit: e.target.value})}
                          className="w-full bg-black/20 border border-white/20 text-white rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-teal-400"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Fila 3: Icono Representativo */}
                  <div>
                    <label className="block text-sm font-medium text-teal-100 mb-3">Icono Representativo</label>
                    <div className="flex gap-4 flex-wrap">
                      {Object.keys(ICON_OPTIONS).map((iconKey) => {
                        const IconElement = ICON_OPTIONS[iconKey as IconName];
                        const isSelected = formData.icon === iconKey;
                        return (
                          <button
                            key={iconKey}
                            type="button"
                            onClick={() => setFormData({...formData, icon: iconKey as IconName})}
                            className={`p-4 rounded-2xl border-2 transition-all ${isSelected ? 'border-teal-400 bg-teal-500/20 shadow-lg shadow-teal-500/20 scale-110' : 'border-white/10 bg-black/20 hover:border-white/30 text-white/50 hover:text-white'}`}
                          >
                            <IconElement className={`w-8 h-8 ${isSelected ? 'text-teal-400' : ''}`} />
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Fila 4: Subir Logo (Base64) */}
                  <div>
                    <label className="block text-sm font-medium text-teal-100 mb-1">Logo de la Empresa (Opcional)</label>
                    <div className="relative group cursor-pointer">
                      <input 
                        type="file" 
                        accept="image/*"
                        onChange={handleLogoUpload}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                      />
                      <div className={`w-full border-2 border-dashed rounded-xl px-4 py-6 flex flex-col items-center justify-center transition-all ${formData.logo_base64 ? 'border-teal-400 bg-teal-500/10' : 'border-white/20 bg-black/20 group-hover:bg-black/40 group-hover:border-white/40'}`}>
                        {formData.logo_base64 ? (
                          <>
                            <CheckCircle2 className="w-8 h-8 text-teal-400 mb-2" />
                            <span className="text-teal-300 font-medium">Logo cargado correctamente</span>
                          </>
                        ) : (
                          <>
                            <Upload className="w-8 h-8 text-white/50 mb-2 group-hover:text-teal-300 transition-colors" />
                            <span className="text-white/50 group-hover:text-teal-300 transition-colors font-medium">Haz clic para subir una imagen</span>
                          </>
                        )}
                      </div>
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
              <div className="p-6 border-t border-white/10 bg-black/20 flex justify-end gap-4 mt-auto">
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
                  form="tenantForm"
                  disabled={submitting}
                  className="px-6 py-2.5 rounded-xl bg-teal-500 text-slate-900 font-bold hover:bg-teal-400 hover:scale-105 transition-all shadow-lg flex items-center gap-2 disabled:opacity-50 disabled:hover:scale-100"
                >
                  {submitting ? <><Loader2 className="w-5 h-5 animate-spin" /> Creando entorno...</> : 'Confirmar y Crear Entorno'}
                </button>
              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </main>
  );
}
