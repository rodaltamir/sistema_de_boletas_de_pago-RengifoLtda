"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Search, 
  Loader2, 
  UserX, 
  FileText, 
  Calculator, 
  Download, 
  CheckCircle, 
  CreditCard, 
  Clock, 
  Calendar, 
  Check, 
  Undo2, 
  X, 
  AlertCircle,
  History,
  TrendingDown
} from "lucide-react";
import { getApiUrl } from "@/utils/api";

interface Employee {
  id: number;
  nombres: string;
  apellido_paterno: string;
  apellido_materno?: string | null;
  documento_identidad: string;
  fecha_ingreso: string;
  ocupacion: string;
  haber_basico: number;
  is_active: boolean;
}

interface CuotaItem {
  numero: number;
  monto: number;
  fecha_programada?: string | null;
  fecha_pago?: string | null;
  estado: "pendiente" | "pagado";
  comprobante?: string | null;
  observacion?: string | null;
}

interface PrefiniquitoCalc {
  employee_id: number;
  fecha_retiro: string;
  motivo: string;
  anios_trabajados: number;
  meses_trabajados: number;
  dias_trabajados: number;
  sueldo_promedio: number;
  desahucio: number;
  indemnizacion_anios: number;
  indemnizacion_meses: number;
  indemnizacion_dias: number;
  aguinaldo_meses: number;
  aguinaldo_dias: number;
  dias_vacacion_pendientes: number;
  vacaciones: number;
  otros_pagos: number;
  tipo_otros_pagos?: string;
  otros_pagos_detalle?: string | null;
  cuotas_total?: number;
  cuotas_pagadas?: number;
  monto_cuota?: number;
  cuotas_historial?: CuotaItem[];
  descuentos: number;
  total_calculo: number;
  multa_30: number;
  total_final: number;
}

interface PrefiniquitoRecord extends PrefiniquitoCalc {
  id: number;
  employee?: Employee | null;
}

const MOTIVOS = [
  "Despido Intempestivo",
  "Retiro Forzoso",
  "Renuncia Voluntaria",
  "Terminación de Contrato",
  "Acuerdo Mutuo"
];

function PrefiniquitosPageContent() {
  const searchParams = useSearchParams();
  const tenantSchema = searchParams.get("tenant");

  // Tabs: "calculo" | "historial"
  const [activeTab, setActiveTab] = useState<"calculo" | "historial">("calculo");

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Selection and Form
  const [selectedEmpId, setSelectedEmpId] = useState<number | "">("");
  const [fechaRetiro, setFechaRetiro] = useState(new Date().toISOString().split('T')[0]);
  const [motivo, setMotivo] = useState("Renuncia Voluntaria");
  const [sueldoPromedio, setSueldoPromedio] = useState<number | "">("");
  const [diasVacacion, setDiasVacacion] = useState<number>(0);
  
  // Otros Pagos: Directo vs Cuotas
  const [tipoOtrosPagos, setTipoOtrosPagos] = useState<"directo" | "cuotas">("directo");
  const [otrosPagos, setOtrosPagos] = useState<number>(0);
  const [cuotasTotal, setCuotasTotal] = useState<number>(2);
  const [otrosPagosDetalle, setOtrosPagosDetalle] = useState<string>("");

  const [descuentos, setDescuentos] = useState<number>(0);
  const [aplicarMulta, setAplicarMulta] = useState(false);
  
  // Calculation State
  const [calcLoading, setCalcLoading] = useState(false);
  const [calcResult, setCalcResult] = useState<PrefiniquitoCalc | null>(null);
  
  // Process State
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  const [exportLoading, setExportLoading] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  // Historial and Cuotas State
  const [savedRecords, setSavedRecords] = useState<PrefiniquitoRecord[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historialSearch, setHistorialSearch] = useState("");
  const [selectedPref, setSelectedPref] = useState<PrefiniquitoRecord | null>(null);
  
  // Cuota payment form in modal
  const [payingCuotaNum, setPayingCuotaNum] = useState<number | null>(null);
  const [pagoFecha, setPagoFecha] = useState(new Date().toISOString().split('T')[0]);
  const [pagoComprobante, setPagoComprobante] = useState("");
  const [pagoObservacion, setPagoObservacion] = useState("");
  const [payingLoading, setPayingLoading] = useState(false);

  useEffect(() => {
    if (!tenantSchema) return;
    setIsAdmin(localStorage.getItem("isAdmin") === "true");
    fetchEmployees();
    fetchHistory();
  }, [tenantSchema]);

  const fetchEmployees = () => {
    if (!tenantSchema) return;
    fetch(`${getApiUrl()}/api/tenants/${tenantSchema}/employees/`)
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) {
          setEmployees(data.filter((e: Employee) => e.is_active));
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  const fetchHistory = () => {
    if (!tenantSchema) return;
    setLoadingHistory(true);
    fetch(`${getApiUrl()}/api/tenants/${tenantSchema}/prefiniquitos/`)
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) {
          setSavedRecords(data);
        }
        setLoadingHistory(false);
      })
      .catch(() => setLoadingHistory(false));
  };

  const selectedEmp = employees.find(e => e.id === Number(selectedEmpId));

  // Sync default sueldo promedio
  useEffect(() => {
    if (selectedEmp) {
      setSueldoPromedio(selectedEmp.haber_basico);
    } else {
      setSueldoPromedio("");
    }
  }, [selectedEmp]);

  const formatBs = (num: number | undefined | null) => {
    if (num === undefined || num === null) return "0,00 Bs";
    return new Intl.NumberFormat('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(num) + ' Bs';
  };

  const handleCalculate = async () => {
    if (!selectedEmpId || !fechaRetiro || sueldoPromedio === "") return;
    setCalcLoading(true);
    setSuccess(false);
    try {
      const res = await fetch(`${getApiUrl()}/api/tenants/${tenantSchema}/prefiniquitos/preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employee_id: Number(selectedEmpId),
          fecha_retiro: fechaRetiro,
          motivo,
          sueldo_promedio: Number(sueldoPromedio),
          dias_vacacion_pendientes: diasVacacion,
          otros_pagos: otrosPagos,
          tipo_otros_pagos: tipoOtrosPagos,
          otros_pagos_detalle: otrosPagosDetalle,
          cuotas_total: tipoOtrosPagos === "cuotas" ? cuotasTotal : 1,
          descuentos,
          aplicar_multa: aplicarMulta
        })
      });
      if (res.ok) {
        const data = await res.json();
        setCalcResult(data);
      }
    } catch(e) {
      console.error(e);
    } finally {
      setCalcLoading(false);
    }
  };

  const handleExport = (format: "excel" | "pdf" | "word") => {
    if (!selectedEmpId || !fechaRetiro || sueldoPromedio === "") return;
    
    setExportLoading(format);
    
    fetch(`${getApiUrl()}/api/tenants/${tenantSchema}/prefiniquitos/export/${format}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employee_id: Number(selectedEmpId),
          fecha_retiro: fechaRetiro,
          motivo,
          sueldo_promedio: Number(sueldoPromedio),
          dias_vacacion_pendientes: diasVacacion,
          otros_pagos: otrosPagos,
          tipo_otros_pagos: tipoOtrosPagos,
          otros_pagos_detalle: otrosPagosDetalle,
          cuotas_total: tipoOtrosPagos === "cuotas" ? cuotasTotal : 1,
          descuentos,
          aplicar_multa: aplicarMulta
        })
    })
    .then(res => {
      if (!res.ok) throw new Error("Error exporting");
      return res.blob();
    })
    .then(blob => {
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const extension = format === 'excel' ? 'xlsx' : format === 'word' ? 'docx' : 'pdf';
      a.download = `Prefiniquito_${selectedEmp?.nombres}_${selectedEmp?.apellido_paterno}.${extension}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    })
    .catch(err => console.error(err))
    .finally(() => setExportLoading(null));
  };

  const handleExportSaved = (id: number, format: "excel" | "pdf" | "word", trabajadorNombre: string = "Prefiniquito") => {
    setExportLoading(`saved_${id}_${format}`);
    fetch(`${getApiUrl()}/api/tenants/${tenantSchema}/prefiniquitos/${id}/export/${format}`)
      .then(res => {
        if (!res.ok) throw new Error("Error al exportar");
        return res.blob();
      })
      .then(blob => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        const extension = format === 'excel' ? 'xlsx' : format === 'word' ? 'docx' : 'pdf';
        a.download = `Prefiniquito_${trabajadorNombre.replace(/\s+/g, "_")}.${extension}`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
      })
      .catch(err => console.error(err))
      .finally(() => setExportLoading(null));
  };

  const handleFinalize = async () => {
    if (!calcResult || !selectedEmpId) return;
    if (!confirm(`¿Está seguro de generar el Prefiniquito para ${selectedEmp?.nombres}? El empleado pasará a estado INACTIVO.`)) return;
    
    setSaving(true);
    try {
      const res = await fetch(`${getApiUrl()}/api/tenants/${tenantSchema}/prefiniquitos/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employee_id: Number(selectedEmpId),
          fecha_retiro: fechaRetiro,
          motivo,
          sueldo_promedio: Number(sueldoPromedio),
          dias_vacacion_pendientes: diasVacacion,
          otros_pagos: otrosPagos,
          tipo_otros_pagos: tipoOtrosPagos,
          otros_pagos_detalle: otrosPagosDetalle,
          cuotas_total: tipoOtrosPagos === "cuotas" ? cuotasTotal : 1,
          descuentos,
          aplicar_multa: aplicarMulta
        })
      });
      
      if (res.ok) {
        setSuccess(true);
        fetchEmployees();
        fetchHistory();
        setSelectedEmpId("");
        setCalcResult(null);
      }
    } catch(e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const handlePagarCuota = async (id: number, cuotaNum: number) => {
    setPayingLoading(true);
    try {
      const res = await fetch(`${getApiUrl()}/api/tenants/${tenantSchema}/prefiniquitos/${id}/cuotas/${cuotaNum}/pagar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fecha_pago: pagoFecha,
          comprobante: pagoComprobante,
          observacion: pagoObservacion
        })
      });
      if (res.ok) {
        const updated = await res.json();
        setSavedRecords(prev => prev.map(r => r.id === updated.id ? updated : r));
        setSelectedPref(updated);
        setPayingCuotaNum(null);
        setPagoComprobante("");
        setPagoObservacion("");
      }
    } catch (e) {
      console.error(e);
    } finally {
      setPayingLoading(false);
    }
  };

  const handleRevertirCuota = async (id: number, cuotaNum: number) => {
    if (!confirm(`¿Desea revertir el pago de la Cuota #${cuotaNum} a estado Pendiente?`)) return;
    setPayingLoading(true);
    try {
      const res = await fetch(`${getApiUrl()}/api/tenants/${tenantSchema}/prefiniquitos/${id}/cuotas/${cuotaNum}/revertir`, {
        method: "POST",
        headers: { "Content-Type": "application/json" }
      });
      if (res.ok) {
        const updated = await res.json();
        setSavedRecords(prev => prev.map(r => r.id === updated.id ? updated : r));
        setSelectedPref(updated);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setPayingLoading(false);
    }
  };

  const filteredHistory = savedRecords.filter(r => {
    const q = historialSearch.toLowerCase();
    const empName = r.employee ? `${r.employee.nombres} ${r.employee.apellido_paterno} ${r.employee.apellido_materno || ""}`.toLowerCase() : "";
    const ci = r.employee?.documento_identidad || "";
    return empName.includes(q) || ci.includes(q) || r.motivo.toLowerCase().includes(q);
  });

  const pendingCuotasCount = savedRecords.reduce((acc, r) => {
    if (r.tipo_otros_pagos === "cuotas") {
      const total = r.cuotas_total || 1;
      const pagadas = r.cuotas_pagadas || 0;
      return acc + (total - pagadas);
    }
    return acc;
  }, 0);

  if (loading) {
    return <div className="flex justify-center p-12"><Loader2 className="w-12 h-12 animate-spin text-teal-600" /></div>;
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* HEADER Y TABS */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 flex items-center gap-2">
            <UserX className="text-rose-600 w-8 h-8" />
            Prefiniquitos y Desvinculaciones
          </h1>
          <p className="text-slate-500 mt-1">Cálculo de beneficios sociales y seguimiento de pagos en cuotas según la Ley Laboral de Bolivia.</p>
        </div>

        {/* TAB BUTTONS */}
        <div className="flex bg-slate-100 p-1.5 rounded-2xl border border-slate-200">
          <button
            onClick={() => setActiveTab("calculo")}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition ${
              activeTab === "calculo"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Calculator className="w-4 h-4 text-teal-600" />
            Nuevo Prefiniquito
          </button>
          <button
            onClick={() => { setActiveTab("historial"); fetchHistory(); }}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition relative ${
              activeTab === "historial"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <History className="w-4 h-4 text-blue-600" />
            Historial y Cuotas
            {pendingCuotasCount > 0 && (
              <span className="ml-1.5 px-2 py-0.5 text-xs font-bold rounded-full bg-amber-500 text-white animate-pulse">
                {pendingCuotasCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* TAB 1: NUEVO PREFINIQUITO / CÁLCULO */}
      {activeTab === "calculo" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* PANEL IZQUIERDO - FORMULARIO */}
          <div className="lg:col-span-4 space-y-6">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
              <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                <Calculator className="w-5 h-5 text-teal-600" /> Parámetros de Cálculo
              </h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Seleccionar Empleado Activo</label>
                  <select 
                    value={selectedEmpId} 
                    onChange={(e) => setSelectedEmpId(e.target.value ? Number(e.target.value) : "")}
                    className="w-full text-slate-900 border border-slate-300 rounded-xl px-4 py-2.5 bg-slate-50 focus:bg-white"
                  >
                    <option value="">-- Seleccione --</option>
                    {employees.map(emp => (
                      <option key={emp.id} value={emp.id}>
                        {`${emp.apellido_paterno} ${emp.apellido_materno || ""} ${emp.nombres}`.trim().replace(/  +/g, " ")} (CI: {emp.documento_identidad})
                      </option>
                    ))}
                  </select>
                </div>

                {selectedEmp && (
                  <>
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-sm text-slate-900">
                      <div><span className="font-semibold">Cargo:</span> {selectedEmp.ocupacion}</div>
                      <div><span className="font-semibold">Ingreso:</span> {selectedEmp.fecha_ingreso}</div>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1">Fecha de Retiro</label>
                      <input 
                        type="date" 
                        value={fechaRetiro}
                        onChange={e => setFechaRetiro(e.target.value)}
                        className="w-full text-slate-900 border border-slate-300 rounded-xl px-4 py-2.5"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1">Motivo de Retiro</label>
                      <select 
                        value={motivo}
                        onChange={e => setMotivo(e.target.value)}
                        className="w-full text-slate-900 border border-slate-300 rounded-xl px-4 py-2.5"
                      >
                        {MOTIVOS.map(m => <option key={m} value={m}>{m}</option>)}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1">Sueldo Promedio (Indemnizable)</label>
                      <input 
                        type="number" 
                        value={sueldoPromedio}
                        onChange={e => setSueldoPromedio(e.target.value ? Number(e.target.value) : "")}
                        className="w-full text-slate-900 border border-slate-300 rounded-xl px-4 py-2.5"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1">Días Vacación Pendientes</label>
                      <input 
                        type="number" 
                        value={diasVacacion}
                        onChange={e => setDiasVacacion(Number(e.target.value))}
                        className="w-full text-slate-900 border border-slate-300 rounded-xl px-4 py-2.5"
                      />
                    </div>

                    {/* SECCIÓN OTROS PAGOS: PAGO ÚNICO VS CUOTAS */}
                    <div className="border border-slate-200 bg-slate-50/50 p-4 rounded-xl space-y-3">
                      <div className="flex justify-between items-center">
                        <label className="block text-sm font-bold text-slate-800 flex items-center gap-1.5">
                          <CreditCard className="w-4 h-4 text-indigo-600" />
                          Otros Pagos
                        </label>
                        
                        {/* Selector Pago Único / Cuotas */}
                        <div className="flex bg-slate-200 p-0.5 rounded-lg text-xs font-semibold">
                          <button
                            type="button"
                            onClick={() => setTipoOtrosPagos("directo")}
                            className={`px-3 py-1 rounded-md transition ${tipoOtrosPagos === "directo" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600"}`}
                          >
                            Pago Único
                          </button>
                          <button
                            type="button"
                            onClick={() => setTipoOtrosPagos("cuotas")}
                            className={`px-3 py-1 rounded-md transition ${tipoOtrosPagos === "cuotas" ? "bg-indigo-600 text-white shadow-sm" : "text-slate-600"}`}
                          >
                            En Cuotas
                          </button>
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">
                          {tipoOtrosPagos === "cuotas" ? "Monto Total de Otros Pagos (Bs.)" : "Monto de Pago Directo (Bs.)"}
                        </label>
                        <input 
                          type="number" 
                          value={otrosPagos}
                          onChange={e => setOtrosPagos(Number(e.target.value))}
                          className="w-full text-slate-900 border border-slate-300 rounded-xl px-3 py-2 bg-white"
                        />
                      </div>

                      {tipoOtrosPagos === "cuotas" && otrosPagos > 0 && (
                        <div className="space-y-3 pt-2 border-t border-slate-200">
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-xs font-semibold text-slate-600 mb-1">N° de Cuotas</label>
                              <select 
                                value={cuotasTotal}
                                onChange={e => setCuotasTotal(Number(e.target.value))}
                                className="w-full text-slate-900 border border-slate-300 rounded-xl px-3 py-2 bg-white font-bold"
                              >
                                {[2, 3, 4, 5, 6, 8, 10, 12].map(n => (
                                  <option key={n} value={n}>{n} cuotas</option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label className="block text-xs font-semibold text-slate-600 mb-1">Monto por Cuota</label>
                              <div className="px-3 py-2 bg-indigo-50 border border-indigo-200 rounded-xl text-indigo-900 font-bold text-sm">
                                {formatBs(otrosPagos / cuotasTotal)}
                              </div>
                            </div>
                          </div>

                          <div>
                            <label className="block text-xs font-semibold text-slate-600 mb-1">Concepto / Detalle (Opcional)</label>
                            <input 
                              type="text" 
                              placeholder="ej. Convenio de pago en cuotas mensuales"
                              value={otrosPagosDetalle}
                              onChange={e => setOtrosPagosDetalle(e.target.value)}
                              className="w-full text-slate-900 border border-slate-300 rounded-xl px-3 py-2 text-xs bg-white"
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1">Descuentos</label>
                      <input 
                        type="number" 
                        value={descuentos}
                        onChange={e => setDescuentos(Number(e.target.value))}
                        className="w-full text-slate-900 border border-slate-300 rounded-xl px-4 py-2.5"
                      />
                    </div>

                    <label className="flex items-center gap-2 cursor-pointer mt-2">
                      <input 
                        type="checkbox" 
                        checked={aplicarMulta}
                        onChange={e => setAplicarMulta(e.target.checked)}
                        className="w-4 h-4 text-teal-600 rounded"
                      />
                      <span className="text-sm font-semibold text-slate-700">Aplicar Multa 30% (Retraso)</span>
                    </label>

                    <button 
                      onClick={handleCalculate}
                      disabled={calcLoading}
                      className="w-full mt-4 bg-slate-900 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-slate-800 transition shadow-md"
                    >
                      {calcLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Generar Vista Previa"}
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* PANEL DERECHO - VISTA PREVIA DEL DOCUMENTO */}
          <div className="lg:col-span-8">
            <AnimatePresence>
              {success && (
                <motion.div key="success" initial={{opacity:0, y:-10}} animate={{opacity:1, y:0}} exit={{opacity:0}} className="bg-emerald-50 text-emerald-800 p-4 rounded-xl mb-6 flex items-center gap-3 border border-emerald-200">
                  <CheckCircle className="w-6 h-6 text-emerald-600" />
                  <div>
                    <h4 className="font-bold">¡Prefiniquito Generado y Guardado Exitosamente!</h4>
                    <p className="text-sm">El empleado ha sido desvinculado. Puedes hacer seguimiento a sus cuotas en la pestaña "Historial y Cuotas".</p>
                  </div>
                </motion.div>
              )}

              {calcResult && (
                <motion.div key="calcResult" initial={{opacity:0, scale:0.98}} animate={{opacity:1, scale:1}} exit={{opacity:0}} className="bg-white border border-slate-300 shadow-xl max-w-3xl mx-auto overflow-hidden rounded-xl">
                  {/* BARRA SUPERIOR DE ACCIONES */}
                  <div className="bg-slate-50 border-b border-slate-200 px-6 py-3 flex flex-wrap justify-between items-center gap-3">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Vista Previa Oficial (Formato Ministerio de Trabajo)</span>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => handleExport("excel")} 
                        disabled={exportLoading !== null} 
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white text-xs font-bold rounded-lg hover:bg-emerald-700 transition disabled:opacity-50"
                      >
                        {exportLoading === "excel" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />} Excel
                      </button>
                      <button 
                        onClick={() => handleExport("word")} 
                        disabled={exportLoading !== null} 
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
                      >
                        {exportLoading === "word" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5" />} Word
                      </button>
                      <button 
                        onClick={() => handleExport("pdf")} 
                        disabled={exportLoading !== null} 
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 text-white text-xs font-bold rounded-lg hover:bg-rose-700 transition disabled:opacity-50"
                      >
                        {exportLoading === "pdf" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />} PDF
                      </button>
                    </div>
                  </div>

                  {/* DOCUMENTO RENDERIZADO */}
                  <div className="p-10 text-slate-800 text-sm font-sans space-y-6">
                    {/* ENCABEZADO */}
                    <div className="text-center border-b-2 border-slate-900 pb-4">
                      <h2 className="text-xl font-bold tracking-widest text-slate-900">PRELIQUIDACIÓN O PREFINIQUITO</h2>
                      <p className="text-xs text-slate-500 font-semibold mt-1">ESTADO PLURINACIONAL DE BOLIVIA</p>
                    </div>
                    
                    {/* DATOS GENERALES */}
                    <div className="border border-slate-300 rounded-lg p-4 space-y-1.5 text-xs bg-slate-50/50">
                      <div><span className="font-bold text-slate-700">NOMBRE DEL TRABAJADOR:</span> {`${selectedEmp?.apellido_paterno || ""} ${selectedEmp?.apellido_materno || ""} ${selectedEmp?.nombres || ""}`.trim().replace(/  +/g, " ").toUpperCase()}</div>
                      <div><span className="font-bold text-slate-700">FECHA DE INGRESO:</span> {selectedEmp?.fecha_ingreso}</div>
                      <div><span className="font-bold text-slate-700">FECHA DE RETIRO:</span> {fechaRetiro}</div>
                      <div className="flex gap-4">
                        <span className="font-bold text-slate-700">TIEMPO DE TRABAJO:</span> 
                        <span>Años: <b>{calcResult.anios_trabajados}</b></span>
                        <span>Meses: <b>{calcResult.meses_trabajados}</b></span>
                        <span>Días: <b>{calcResult.dias_trabajados}</b></span>
                      </div>
                      <div><span className="font-bold text-slate-700">SUELDO PROMEDIO (Bs):</span> {formatBs(calcResult.sueldo_promedio)}</div>
                    </div>

                    {/* BENEFICIOS SOCIALES */}
                    <div className="border border-slate-300 rounded-lg p-5 space-y-3 text-xs">
                      <div className="flex justify-between font-bold text-slate-700 border-b border-slate-100 pb-1">
                        <span>DESAHUCIO:</span>
                        <span>{formatBs(calcResult.desahucio)}</span>
                      </div>

                      <div className="space-y-1">
                        <div className="font-bold text-slate-700">INDEMNIZACIÓN POR TIEMPO DE SERVICIO:</div>
                        {calcResult.anios_trabajados > 0 && (
                          <div className="pl-6 flex justify-between text-slate-600">
                            <span>{calcResult.anios_trabajados} Años</span>
                            <span>{formatBs(calcResult.indemnizacion_anios)}</span>
                          </div>
                        )}
                        {calcResult.meses_trabajados > 0 && (
                          <div className="pl-6 flex justify-between text-slate-600">
                            <span>{calcResult.meses_trabajados} Meses</span>
                            <span>{formatBs(calcResult.indemnizacion_meses)}</span>
                          </div>
                        )}
                        {calcResult.dias_trabajados > 0 && (
                          <div className="pl-6 flex justify-between text-slate-600">
                            <span>{calcResult.dias_trabajados} Días</span>
                            <span>{formatBs(calcResult.indemnizacion_dias)}</span>
                          </div>
                        )}
                      </div>

                      <div className="space-y-1 pt-1 border-t border-slate-100">
                        <div className="font-bold text-slate-700">AGUINALDO:</div>
                        <div className="pl-6 flex justify-between text-slate-600">
                          <span>Duodécimas Meses</span>
                          <span>{formatBs(calcResult.aguinaldo_meses)}</span>
                        </div>
                        <div className="pl-6 flex justify-between text-slate-600">
                          <span>Duodécimas Días</span>
                          <span>{formatBs(calcResult.aguinaldo_dias)}</span>
                        </div>
                      </div>

                      <div className="flex justify-between font-bold text-slate-700 pt-1 border-t border-slate-100">
                        <span>VACACIONES ({calcResult.dias_vacacion_pendientes} Días):</span>
                        <span>{formatBs(calcResult.vacaciones)}</span>
                      </div>
                      
                      {/* OTROS PAGOS EN EL DOCUMENTO */}
                      <div className="pt-2 border-t border-slate-200">
                        <div className="flex justify-between font-bold text-slate-800">
                          <span>
                            {calcResult.tipo_otros_pagos === "cuotas" 
                              ? `OTROS PAGOS (${calcResult.cuotas_total} Cuotas)` 
                              : "OTROS PAGOS (PAGO ÚNICO)"}:
                          </span>
                          <span>{formatBs(calcResult.otros_pagos)}</span>
                        </div>

                        {calcResult.tipo_otros_pagos === "cuotas" && (
                          <div className="mt-2 p-3 bg-indigo-50/70 border border-indigo-200 rounded-lg space-y-2">
                            <div className="flex justify-between text-xs font-bold text-indigo-900">
                              <span>Plan de Cuotas: 0/{calcResult.cuotas_total} Pagadas</span>
                              <span>Saldo: {formatBs(calcResult.otros_pagos)}</span>
                            </div>
                            
                            {calcResult.cuotas_historial && (
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 text-[11px]">
                                {calcResult.cuotas_historial.map((c) => (
                                  <div key={c.numero} className="flex justify-between items-center bg-white p-2 rounded border border-indigo-100">
                                    <span className="font-semibold text-slate-700">Cuota #{c.numero} ({c.fecha_programada}):</span>
                                    <span className="font-bold text-indigo-700">{formatBs(c.monto)}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                      
                      <div className="flex justify-between font-bold text-rose-700 pt-1 border-t border-slate-100">
                        <span>DESCUENTOS:</span>
                        <span>{formatBs(calcResult.descuentos)}</span>
                      </div>

                      {/* TOTALES */}
                      <div className="border-t-2 border-slate-800 pt-3 mt-3 space-y-1.5">
                        <div className="flex justify-between font-bold text-sm">
                          <span>TOTAL CÁLCULO:</span>
                          <span>{formatBs(calcResult.total_calculo)}</span>
                        </div>
                        {calcResult.multa_30 > 0 && (
                          <div className="flex justify-between font-bold text-rose-700 text-sm">
                            <span>MULTA 30%:</span>
                            <span>{formatBs(calcResult.multa_30)}</span>
                          </div>
                        )}
                        <div className="flex justify-between font-bold text-base bg-slate-100 p-2.5 rounded-lg border border-slate-300">
                          <span>TOTAL FINAL A LIQUIDAR:</span>
                          <span className="text-teal-700 font-extrabold">{formatBs(calcResult.total_final)}</span>
                        </div>
                      </div>
                    </div>
                    
                    {/* FIRMAS */}
                    <div className="pt-12 grid grid-cols-2 gap-12 text-center text-xs">
                      <div>
                        <div className="border-t border-slate-700 pt-2 font-bold text-slate-800">SELLO Y FIRMA EMPLEADOR</div>
                        <span className="text-[10px] text-slate-400">Representante Legal</span>
                      </div>
                      <div>
                        <div className="border-t border-slate-700 pt-2 font-bold text-slate-800">FIRMA DEL TRABAJADOR</div>
                        <span className="text-[10px] text-slate-400">Conforme Recibí</span>
                      </div>
                    </div>
                  </div>

                  {/* BOTÓN FINALIZAR (ADMIN) */}
                  {isAdmin && (
                    <div className="bg-slate-100 p-4 border-t border-slate-200 flex justify-end">
                      <button 
                        onClick={handleFinalize}
                        disabled={saving}
                        className="flex items-center gap-2 px-6 py-2.5 bg-rose-600 text-white font-bold rounded-xl hover:bg-rose-700 shadow-md transition disabled:opacity-50"
                      >
                        {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <UserX className="w-5 h-5" />} 
                        Finalizar Desvinculación
                      </button>
                    </div>
                  )}
                </motion.div>
              )}
              
              {!calcResult && !success && (
                <div className="h-96 flex flex-col items-center justify-center text-slate-400 border-2 border-dashed border-slate-200 rounded-2xl p-12 bg-slate-50/50">
                  <FileText className="w-16 h-16 mb-3 text-slate-300" />
                  <p className="font-semibold text-slate-600">Selecciona un empleado y haz clic en "Generar Vista Previa"</p>
                  <p className="text-xs text-slate-400 mt-1">Podrás visualizar el documento oficial y configurar pagos directos o en cuotas.</p>
                </div>
              )}
            </AnimatePresence>
          </div>
        </div>
      )}

      {/* TAB 2: HISTORIAL Y SEGUIMIENTO DE CUOTAS */}
      {activeTab === "historial" && (
        <div className="space-y-6">
          {/* BUSCADOR Y RESUMEN */}
          <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
              <input 
                type="text" 
                placeholder="Buscar por empleado, C.I. o motivo de desvinculación..."
                value={historialSearch}
                onChange={e => setHistorialSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 text-sm text-slate-900 border border-slate-200 rounded-xl bg-slate-50 focus:bg-white"
              />
            </div>
            
            <div className="flex items-center gap-3">
              <div className="px-4 py-2 bg-indigo-50 border border-indigo-200 rounded-xl text-xs font-semibold text-indigo-900">
                Total Registros: <b className="text-sm">{savedRecords.length}</b>
              </div>
              <div className="px-4 py-2 bg-amber-50 border border-amber-200 rounded-xl text-xs font-semibold text-amber-900">
                Cuotas Pendientes: <b className="text-sm">{pendingCuotasCount}</b>
              </div>
            </div>
          </div>

          {/* TABLA DE PREFINIQUITOS */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            {loadingHistory ? (
              <div className="p-12 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-teal-600" /></div>
            ) : filteredHistory.length === 0 ? (
              <div className="p-12 text-center text-slate-400">
                <History className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                <p className="font-semibold text-slate-600">No hay prefiniquitos registrados</p>
                <p className="text-xs text-slate-400 mt-1">Genera un nuevo prefiniquito en la pestaña anterior para visualizar su historial y gestionar cuotas.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-700">
                  <thead className="bg-slate-50 border-b border-slate-200 text-xs uppercase font-bold text-slate-500">
                    <tr>
                      <th className="px-5 py-3.5">Trabajador / C.I.</th>
                      <th className="px-5 py-3.5">Fecha Retiro</th>
                      <th className="px-5 py-3.5">Motivo</th>
                      <th className="px-5 py-3.5">Total Finiquito</th>
                      <th className="px-5 py-3.5">Modalidad Otros Pagos</th>
                      <th className="px-5 py-3.5">Estado de Cuotas</th>
                      <th className="px-5 py-3.5 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredHistory.map((item) => {
                      const empName = item.employee 
                        ? `${item.employee.apellido_paterno} ${item.employee.apellido_materno || ""} ${item.employee.nombres}`.trim()
                        : `Empleado #${item.employee_id}`;
                      const ci = item.employee?.documento_identidad || "-";
                      const isCuotas = item.tipo_otros_pagos === "cuotas" && item.otros_pagos > 0;
                      const cTotal = item.cuotas_total || 1;
                      const cPagadas = item.cuotas_pagadas || 0;
                      const cMonto = item.monto_cuota || (item.otros_pagos / cTotal);
                      const saldo = Math.max(0, item.otros_pagos - (cPagadas * cMonto));
                      const progressPct = isCuotas ? Math.min(100, Math.round((cPagadas / cTotal) * 100)) : 100;

                      return (
                        <tr key={item.id} className="hover:bg-slate-50/70 transition">
                          <td className="px-5 py-4 font-semibold text-slate-900">
                            <div>{empName}</div>
                            <div className="text-xs text-slate-400 font-normal">CI: {ci}</div>
                          </td>
                          <td className="px-5 py-4 text-slate-600 text-xs">
                            {item.fecha_retiro}
                          </td>
                          <td className="px-5 py-4 text-xs font-medium text-slate-700">
                            {item.motivo}
                          </td>
                          <td className="px-5 py-4 font-bold text-slate-900">
                            {formatBs(item.total_final)}
                          </td>
                          <td className="px-5 py-4">
                            {isCuotas ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                                <CreditCard className="w-3 h-3" />
                                {cTotal} Cuotas ({formatBs(item.otros_pagos)})
                              </span>
                            ) : item.otros_pagos > 0 ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200">
                                Pago Único ({formatBs(item.otros_pagos)})
                              </span>
                            ) : (
                              <span className="text-xs text-slate-400">Sin otros pagos</span>
                            )}
                          </td>
                          <td className="px-5 py-4">
                            {isCuotas ? (
                              <div className="space-y-1.5 w-44">
                                <div className="flex justify-between text-xs font-semibold">
                                  <span className={cPagadas === cTotal ? "text-emerald-600" : "text-amber-600"}>
                                    {cPagadas}/{cTotal} Pagadas
                                  </span>
                                  <span className="text-slate-500 font-bold">{formatBs(saldo)}</span>
                                </div>
                                <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                                  <div 
                                    className={`h-full rounded-full transition-all duration-500 ${cPagadas === cTotal ? "bg-emerald-500" : "bg-indigo-600"}`} 
                                    style={{ width: `${progressPct}%` }}
                                  />
                                </div>
                              </div>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700">
                                <Check className="w-3 h-3" /> Liquidado
                              </span>
                            )}
                          </td>
                          <td className="px-5 py-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              {isCuotas && (
                                <button
                                  onClick={() => setSelectedPref(item)}
                                  className="flex items-center gap-1 px-3 py-1.5 bg-indigo-600 text-white text-xs font-bold rounded-lg hover:bg-indigo-700 shadow-sm transition"
                                >
                                  <CreditCard className="w-3.5 h-3.5" />
                                  Gestionar Cuotas
                                </button>
                              )}
                              
                              {/* QUICK EXPORTS */}
                              <div className="flex gap-1 border-l border-slate-200 pl-2">
                                <button 
                                  title="Exportar Excel"
                                  onClick={() => handleExportSaved(item.id, "excel", empName)}
                                  disabled={exportLoading === `saved_${item.id}_excel`}
                                  className="p-1.5 text-emerald-700 hover:bg-emerald-50 rounded-md transition"
                                >
                                  {exportLoading === `saved_${item.id}_excel` ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                                </button>
                                <button 
                                  title="Exportar Word"
                                  onClick={() => handleExportSaved(item.id, "word", empName)}
                                  disabled={exportLoading === `saved_${item.id}_word`}
                                  className="p-1.5 text-blue-700 hover:bg-blue-50 rounded-md transition"
                                >
                                  {exportLoading === `saved_${item.id}_word` ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                                </button>
                                <button 
                                  title="Exportar PDF"
                                  onClick={() => handleExportSaved(item.id, "pdf", empName)}
                                  disabled={exportLoading === `saved_${item.id}_pdf`}
                                  className="p-1.5 text-rose-700 hover:bg-rose-50 rounded-md transition"
                                >
                                  {exportLoading === `saved_${item.id}_pdf` ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                                </button>
                              </div>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL PARA GESTIÓN Y SEGUIMIENTO DE CUOTAS */}
      <AnimatePresence>
        {selectedPref && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col"
            >
              {/* MODAL HEADER */}
              <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
                <div>
                  <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                    <CreditCard className="w-5 h-5 text-indigo-600" />
                    Seguimiento y Registro de Cuotas
                  </h3>
                  <p className="text-xs text-slate-500">
                    {selectedPref.employee 
                      ? `${selectedPref.employee.nombres} ${selectedPref.employee.apellido_paterno} (CI: ${selectedPref.employee.documento_identidad})`
                      : `Prefiniquito #${selectedPref.id}`}
                  </p>
                </div>
                <button 
                  onClick={() => { setSelectedPref(null); setPayingCuotaNum(null); }}
                  className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200 transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* MODAL CONTENT */}
              <div className="p-6 overflow-y-auto space-y-6">
                {/* TARJETA DE RESUMEN FINANCIERO */}
                {(() => {
                  const cTotal = selectedPref.cuotas_total || 1;
                  const cPagadas = selectedPref.cuotas_pagadas || 0;
                  const cMonto = selectedPref.monto_cuota || (selectedPref.otros_pagos / cTotal);
                  const totalPagado = cPagadas * cMonto;
                  const saldo = Math.max(0, selectedPref.otros_pagos - totalPagado);
                  const progressPct = Math.min(100, Math.round((cPagadas / cTotal) * 100));

                  return (
                    <div className="space-y-3">
                      <div className="grid grid-cols-3 gap-3">
                        <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-center">
                          <span className="text-[11px] font-semibold text-slate-500 uppercase">Total Cuotas</span>
                          <div className="text-base font-extrabold text-slate-800">{formatBs(selectedPref.otros_pagos)}</div>
                          <span className="text-[10px] text-slate-400">{cTotal} Cuotas de {formatBs(cMonto)}</span>
                        </div>
                        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-center">
                          <span className="text-[11px] font-semibold text-emerald-700 uppercase">Total Pagado</span>
                          <div className="text-base font-extrabold text-emerald-800">{formatBs(totalPagado)}</div>
                          <span className="text-[10px] text-emerald-600 font-bold">{cPagadas} de {cTotal} Pagadas</span>
                        </div>
                        <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-center">
                          <span className="text-[11px] font-semibold text-amber-700 uppercase">Saldo Pendiente</span>
                          <div className="text-base font-extrabold text-amber-800">{formatBs(saldo)}</div>
                          <span className="text-[10px] text-amber-600 font-bold">{cTotal - cPagadas} Cuotas Restantes</span>
                        </div>
                      </div>

                      {/* BARRA DE PROGRESO */}
                      <div className="space-y-1">
                        <div className="flex justify-between text-xs font-semibold text-slate-600">
                          <span>Progreso de Liquidación: {progressPct}%</span>
                          {cPagadas === cTotal ? (
                            <span className="text-emerald-600 font-bold flex items-center gap-1">
                              <CheckCircle className="w-3.5 h-3.5" /> ¡Completado!
                            </span>
                          ) : (
                            <span className="text-amber-600 font-bold">En curso</span>
                          )}
                        </div>
                        <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                          <div 
                            className={`h-full rounded-full transition-all duration-500 ${cPagadas === cTotal ? "bg-emerald-500" : "bg-indigo-600"}`} 
                            style={{ width: `${progressPct}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* FORMULARIO INLINE PARA REGISTRAR PAGO */}
                {payingCuotaNum !== null && (
                  <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-xl space-y-3">
                    <div className="flex justify-between items-center">
                      <h4 className="font-bold text-sm text-indigo-900 flex items-center gap-1.5">
                        <CreditCard className="w-4 h-4" />
                        Registrar Pago de Cuota #{payingCuotaNum}
                      </h4>
                      <button 
                        onClick={() => setPayingCuotaNum(null)}
                        className="text-xs text-slate-500 hover:text-slate-800"
                      >
                        Cancelar
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      <div>
                        <label className="block font-semibold text-slate-700 mb-1">Fecha de Pago</label>
                        <input 
                          type="date" 
                          value={pagoFecha}
                          onChange={e => setPagoFecha(e.target.value)}
                          className="w-full text-slate-900 border border-slate-300 rounded-lg px-3 py-1.5 bg-white"
                        />
                      </div>
                      <div>
                        <label className="block font-semibold text-slate-700 mb-1">N° Comprobante / Recibo (Opcional)</label>
                        <input 
                          type="text" 
                          placeholder="ej. REC-00123"
                          value={pagoComprobante}
                          onChange={e => setPagoComprobante(e.target.value)}
                          className="w-full text-slate-900 border border-slate-300 rounded-lg px-3 py-1.5 bg-white"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Observación (Opcional)</label>
                      <input 
                        type="text" 
                        placeholder="ej. Depósito bancario, Pago en efectivo en oficina"
                        value={pagoObservacion}
                        onChange={e => setPagoObservacion(e.target.value)}
                        className="w-full text-xs text-slate-900 border border-slate-300 rounded-lg px-3 py-1.5 bg-white"
                      />
                    </div>

                    <div className="flex justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setPayingCuotaNum(null)}
                        className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-200 rounded-lg transition"
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        disabled={payingLoading}
                        onClick={() => handlePagarCuota(selectedPref.id, payingCuotaNum)}
                        className="flex items-center gap-1.5 px-4 py-1.5 bg-indigo-600 text-white text-xs font-bold rounded-lg hover:bg-indigo-700 transition disabled:opacity-50"
                      >
                        {payingLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                        Confirmar Pago
                      </button>
                    </div>
                  </div>
                )}

                {/* LISTA DETALLADA DE CUOTAS */}
                <div className="space-y-2">
                  <h4 className="font-bold text-xs uppercase tracking-wider text-slate-500">Historial del Cronograma</h4>
                  <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
                    {(selectedPref.cuotas_historial || []).map((cuota) => (
                      <div key={cuota.numero} className="p-3.5 flex flex-wrap items-center justify-between gap-3 bg-white hover:bg-slate-50/70 transition">
                        <div className="flex items-center gap-3">
                          <span className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${
                            cuota.estado === "pagado" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
                          }`}>
                            #{cuota.numero}
                          </span>
                          <div>
                            <div className="font-bold text-slate-800 text-sm">
                              {formatBs(cuota.monto)}
                              {cuota.estado === "pagado" ? (
                                <span className="ml-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                  <Check className="w-2.5 h-2.5" /> Pagado ({cuota.fecha_pago})
                                </span>
                              ) : (
                                <span className="ml-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                  <Clock className="w-2.5 h-2.5" /> Pendiente {cuota.fecha_programada ? `(Límite: ${cuota.fecha_programada})` : ""}
                                </span>
                              )}
                            </div>
                            {(cuota.comprobante || cuota.observacion) && (
                              <div className="text-xs text-slate-500 mt-0.5">
                                {cuota.comprobante && <span className="font-semibold text-slate-600 mr-2">Doc: {cuota.comprobante}</span>}
                                {cuota.observacion && <span>{cuota.observacion}</span>}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* ACCIONES DE CUOTA */}
                        <div>
                          {cuota.estado === "pendiente" ? (
                            <button
                              onClick={() => {
                                setPayingCuotaNum(cuota.numero);
                                setPagoFecha(new Date().toISOString().split('T')[0]);
                              }}
                              className="px-3 py-1.5 bg-emerald-600 text-white text-xs font-bold rounded-lg hover:bg-emerald-700 shadow-sm transition flex items-center gap-1"
                            >
                              <Check className="w-3.5 h-3.5" />
                              Registrar Pago
                            </button>
                          ) : (
                            <button
                              onClick={() => handleRevertirCuota(selectedPref.id, cuota.numero)}
                              disabled={payingLoading}
                              className="px-2.5 py-1 text-slate-400 hover:text-rose-600 text-xs font-semibold hover:bg-rose-50 rounded-lg transition flex items-center gap-1"
                              title="Revertir a Pendiente"
                            >
                              <Undo2 className="w-3.5 h-3.5" />
                              Revertir
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* DESCARGAS DE ESTE PREFINIQUITO ACTUALIZADO */}
                {(() => {
                  const workerName = selectedPref.employee 
                    ? `${selectedPref.employee.nombres} ${selectedPref.employee.apellido_paterno}` 
                    : `Prefiniquito_${selectedPref.id}`;
                  return (
                    <div className="pt-2 border-t border-slate-200 flex flex-wrap justify-between items-center gap-3">
                      <span className="text-xs font-semibold text-slate-500">Descargar documento actualizado:</span>
                      <div className="flex gap-2">
                        <button 
                          onClick={() => handleExportSaved(selectedPref.id, "excel", workerName)} 
                          disabled={exportLoading !== null} 
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white text-xs font-bold rounded-lg hover:bg-emerald-700 transition"
                        >
                          <Download className="w-3.5 h-3.5" /> Excel
                        </button>
                        <button 
                          onClick={() => handleExportSaved(selectedPref.id, "word", workerName)} 
                          disabled={exportLoading !== null} 
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-700 transition"
                        >
                          <FileText className="w-3.5 h-3.5" /> Word
                        </button>
                        <button 
                          onClick={() => handleExportSaved(selectedPref.id, "pdf", workerName)} 
                          disabled={exportLoading !== null} 
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 text-white text-xs font-bold rounded-lg hover:bg-rose-700 transition"
                        >
                          <Download className="w-3.5 h-3.5" /> PDF
                        </button>
                      </div>
                    </div>
                  );
                })()}

              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function PrefiniquitosPage() {
  return (
    <Suspense fallback={<div className="flex justify-center p-12"><div className="w-8 h-8 border-4 border-teal-500 border-t-transparent rounded-full animate-spin"></div></div>}>
      <PrefiniquitosPageContent />
    </Suspense>
  );
}
