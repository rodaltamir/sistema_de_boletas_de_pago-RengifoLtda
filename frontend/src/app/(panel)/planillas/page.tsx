"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Calculator, Search, Loader2, Download, Edit, Eye, X, FileText, FileSpreadsheet, File, Plus, Minus, Lock, CheckCircle } from "lucide-react";

interface Payslip {
  id: number;
  payroll_id: number;
  employee_id: number;
  employee_name: string;
  employee_ci: string;
  employee_cargo: string;
  employee_fecha_ingreso: string;
  
  dias_pagados: number;
  horas_pagadas: number;
  
  haber_basico: number;
  bono_antiguedad: number;
  bono_produccion: number;
  subsidio_frontera: number;
  trabajo_extraordinario: number;
  pago_dominical: number;
  otros_bonos: number;
  subsidio_natalidad: number;
  total_ganado: number;
  
  aporte_gestora: number;
  rc_iva: number;
  anticipos: number;
  otros_descuentos: number;
  total_descuentos: number;
  
  liquido_pagable: number;
}

interface PayrollData {
  id: number;
  month: number;
  year: number;
  is_closed: boolean;
  payslips: Payslip[];
}

const MONTHS = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
];

function PlanillasPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const tenantSchema = searchParams.get("tenant");

  const [month, setMonth] = useState<number>(new Date().getMonth() + 1);
  const [year, setYear] = useState<number>(new Date().getFullYear());
  
  const [payroll, setPayroll] = useState<PayrollData | null>(null);
  const [loading, setLoading] = useState(false);

  const [selectedPayslip, setSelectedPayslip] = useState<Payslip | null>(null);
  const [viewMode, setViewMode] = useState<'boleta' | 'edit' | null>(null);
  const [expandedSlips, setExpandedSlips] = useState<number[]>([]);

  const toggleExpand = (id: number) => {
    setExpandedSlips(prev => 
      prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
    );
  };

  const toggleExpandAll = () => {
    if (payroll) {
      if (expandedSlips.length === payroll.payslips.length) {
        setExpandedSlips([]);
      } else {
        setExpandedSlips(payroll.payslips.map(s => s.id));
      }
    }
  };

  // Edit State
  const [editForm, setEditForm] = useState<any>({});
  const [saving, setSaving] = useState(false);

  const fetchPayroll = async () => {
    if (!tenantSchema) return;
    setLoading(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://Rengifo_Ltda:8000"}/api/tenants/${tenantSchema}/payrolls/${month}/${year}`);
      if (res.ok) {
        const data = await res.json();
        setPayroll(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!tenantSchema) {
      router.push("/seleccionar-empresa");
    }
  }, [tenantSchema, router]);

  
  const handleExportPlanilla = (format: 'pdf' | 'excel') => {
    if (!tenantSchema || !month || !year) return;
    const url = `${process.env.NEXT_PUBLIC_API_URL || "http://Rengifo_Ltda:8000"}/api/tenants/${tenantSchema}/payrolls/${month}/${year}/export/${format}`;
    window.open(url, '_blank');
  };

  const handleOpenBoleta = (slip: Payslip) => {
    setSelectedPayslip(slip);
    setViewMode('boleta');
  };

  const handleOpenEdit = (slip: Payslip) => {
    setSelectedPayslip(slip);
    setEditForm({
      bono_produccion: slip.bono_produccion,
      subsidio_frontera: slip.subsidio_frontera,
      trabajo_extraordinario: slip.trabajo_extraordinario,
      pago_dominical: slip.pago_dominical,
      otros_bonos: slip.otros_bonos,
      anticipos: slip.anticipos,
      otros_descuentos: slip.otros_descuentos
    });
    setViewMode('edit');
  };

  const handleSaveEdit = async () => {
    if (!selectedPayslip || !payroll) return;
    setSaving(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://Rengifo_Ltda:8000"}/api/tenants/${tenantSchema}/payrolls/${month}/${year}/payslips/${selectedPayslip.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm)
      });
      if (res.ok) {
        const updatedSlip = await res.json();
        // Update local state
        setPayroll({
          ...payroll,
          payslips: payroll.payslips.map(s => s.id === updatedSlip.id ? updatedSlip : s)
        });
        setViewMode(null);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const formatBs = (val: number) => Number(val).toLocaleString('es-BO', { minimumFractionDigits: 2 });

  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const handleConfirmPayroll = async () => {
    if (!tenantSchema || !month || !year) return;
    setConfirming(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://Rengifo_Ltda:8000"}/api/tenants/${tenantSchema}/payrolls/${month}/${year}/close`, {
        method: "POST"
      });
      if (res.ok) {
        const data = await res.json();
        setPayroll(data);
        setShowConfirmModal(false);
      } else {
        const errData = await res.json();
        alert(errData.detail || "Error al confirmar la planilla");
      }
    } catch (e) {
      alert("Error de conexión");
    } finally {
      setConfirming(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Cabecera y Filtros */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 flex items-center gap-2">
            <Calculator className="text-teal-600 w-8 h-8" />
            Planilla de Sueldos y Salarios
          </h1>
          <p className="text-slate-900 mt-1">Cálculo de haberes, descuentos y generación de boletas.</p>
        </div>
        
        <div className="flex items-center gap-3 bg-white p-2 rounded-2xl shadow-sm border border-slate-200">
          <select 
            value={month} 
            onChange={(e) => setMonth(Number(e.target.value))}
            className="bg-slate-50 border-none outline-none text-slate-900 font-semibold px-4 py-2 rounded-xl focus:ring-2 focus:ring-teal-500"
          >
            {MONTHS.map((m, i) => (
              <option key={i+1} value={i+1}>{m}</option>
            ))}
          </select>
          <input 
            type="number" 
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="w-24 bg-slate-50 border-none outline-none text-slate-900 font-semibold px-4 py-2 rounded-xl focus:ring-2 focus:ring-teal-500"
          />
          <button 
            onClick={fetchPayroll}
            disabled={loading}
            className="bg-teal-500 text-white px-6 py-2 rounded-xl font-bold shadow-md hover:bg-teal-600 transition flex items-center gap-2"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
            Cargar Planilla
          </button>
        </div>
      </div>

      {/* Planilla Data Table (Estilo Excel Preview) */}
      {payroll && (
        <div className="bg-white rounded-[2rem] shadow-sm border border-slate-100 overflow-hidden flex flex-col">
          <div className="p-4 border-b border-slate-100 bg-slate-50 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="flex items-center gap-3">
              <h2 className="font-bold text-slate-900">Planilla Correspondiente al Mes de {MONTHS[payroll.month-1].toUpperCase()} {payroll.year}</h2>
              {payroll.is_closed && (
                <span className="bg-slate-800 text-white text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1">
                  <CheckCircle className="w-4 h-4" /> Cerrada / Confirmada
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
               {!payroll.is_closed && (
                 <button onClick={() => setShowConfirmModal(true)} className="flex items-center gap-2 px-3 py-1.5 text-sm bg-blue-600 text-white border border-blue-700 rounded-lg hover:bg-blue-700 transition shadow-sm font-semibold">
                   <Lock className="w-4 h-4" /> Confirmar Mes
                 </button>
               )}
               <button onClick={toggleExpandAll} className="flex items-center gap-2 px-3 py-1.5 text-sm bg-slate-200 text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-300 transition">
                 <Eye className="w-4 h-4" /> {expandedSlips.length === payroll.payslips.length ? 'Colapsar Todo' : 'Expandir Todo'}
               </button>
               <button onClick={() => handleExportPlanilla("excel")} className="flex items-center gap-2 px-3 py-1.5 text-sm bg-green-50 text-green-700 border border-green-200 rounded-lg hover:bg-green-100 transition">
                 <FileSpreadsheet className="w-4 h-4" /> Excel
               </button>
               <button onClick={() => handleExportPlanilla("pdf")} className="flex items-center gap-2 px-3 py-1.5 text-sm bg-red-50 text-red-700 border border-red-200 rounded-lg hover:bg-red-100 transition">
                 <FileText className="w-4 h-4" /> PDF
               </button>
            </div>
          </div>
                    <div className="overflow-x-auto w-full pb-4 custom-scrollbar">
            <table className="w-full text-sm text-left border-collapse">
              <thead>
                <tr className="bg-slate-900 text-white border-b border-slate-700">
                  <th className="p-4 font-semibold text-center w-12 rounded-tl-xl">N°</th>
                  <th className="p-4 font-semibold">Empleado</th>
                  <th className="p-4 font-semibold hidden md:table-cell">Cargo</th>
                  <th className="p-4 font-semibold text-right text-teal-400">Total Ganado</th>
                  <th className="p-4 font-semibold text-right text-rose-400">Total Descuentos</th>
                  <th className="p-4 font-semibold text-right text-emerald-400 rounded-tr-xl">Líquido Pagable</th>
                  <th className="p-4 font-semibold text-center">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {payroll.payslips.map((slip, i) => {
                  const isExpanded = expandedSlips.includes(slip.id);
                  return (
                    <React.Fragment key={slip.id}>
                      <tr className={`border-b border-slate-200 transition bg-white hover:bg-slate-50 cursor-pointer ${isExpanded ? 'bg-slate-50 border-l-4 border-l-teal-500' : ''}`} onClick={() => toggleExpand(slip.id)}>
                        <td className="p-4 text-center font-bold text-slate-700">{i + 1}</td>
                        <td className="p-4">
                          <p className="font-bold text-slate-900">{slip.employee_name}</p>
                          <p className="text-xs text-slate-500">CI: {slip.employee_ci}</p>
                        </td>
                        <td className="p-4 text-slate-600 hidden md:table-cell">{slip.employee_cargo}</td>
                        <td className="p-4 text-right font-bold text-teal-700">{formatBs(slip.total_ganado)}</td>
                        <td className="p-4 text-right font-bold text-rose-600">{formatBs(slip.total_descuentos)}</td>
                        <td className="p-4 text-right font-black text-emerald-600 text-base">{formatBs(slip.liquido_pagable)}</td>
                        <td className="p-4 text-center flex justify-center gap-2">
                          {!payroll.is_closed && (
                            <button onClick={(e) => { e.stopPropagation(); handleOpenEdit(slip); }} className="p-2 text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-600 hover:text-white transition-colors" title="Editar Valores">
                              <Edit className="w-4 h-4" />
                            </button>
                          )}
                          <button onClick={(e) => { e.stopPropagation(); toggleExpand(slip.id); }} className={`p-2 rounded-lg transition-colors ${isExpanded ? 'bg-slate-800 text-white' : 'text-slate-600 bg-slate-100 hover:bg-slate-200'}`} title="Ver Detalles">
                            <Eye className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                      {/* Fila expandible con detalles */}
                      <AnimatePresence>
                        {isExpanded && (
                          <tr>
                            <td colSpan={7} className="p-0 bg-slate-50 border-b-2 border-slate-200">
                              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                                <div className="p-4 md:p-6 grid grid-cols-1 md:grid-cols-3 gap-4">
                                  {/* Columna Asistencia */}
                                  <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
                                    <h4 className="text-slate-800 font-bold mb-4 flex items-center gap-2"><Calculator className="w-5 h-5 text-slate-400" /> Datos y Asistencia</h4>
                                    <div className="space-y-2 text-sm">
                                      <div className="flex justify-between border-b border-slate-50 pb-1"><span className="text-slate-500">Fecha Ingreso:</span><span className="font-semibold text-slate-800">{slip.employee_fecha_ingreso}</span></div>
                                      <div className="flex justify-between border-b border-slate-50 pb-1"><span className="text-slate-500">Días Pagados:</span><span className="font-semibold text-slate-800">{slip.dias_pagados}</span></div>
                                      <div className="flex justify-between pb-1"><span className="text-slate-500">Horas Pagadas:</span><span className="font-semibold text-slate-800">{Math.round(slip.horas_pagadas / (slip.dias_pagados || 30))}</span></div>
                                    </div>
                                  </div>
                                  
                                  {/* Columna Ingresos */}
                                  <div className="bg-teal-50/30 p-5 rounded-2xl shadow-sm border border-teal-100">
                                    <h4 className="text-teal-800 font-bold mb-4 flex items-center gap-2"><Plus className="w-5 h-5 text-teal-500" /> Ingresos</h4>
                                    <div className="space-y-2 text-sm">
                                      <div className="flex justify-between border-b border-teal-100/50 pb-1"><span className="text-teal-700/80">Haber Básico:</span><span className="font-semibold text-teal-900">{formatBs(slip.haber_basico)}</span></div>
                                      <div className="flex justify-between border-b border-teal-100/50 pb-1"><span className="text-teal-700/80">Bono Antigüedad:</span><span className="font-semibold text-teal-900">{formatBs(slip.bono_antiguedad)}</span></div>
                                      <div className="flex justify-between border-b border-teal-100/50 pb-1"><span className="text-teal-700/80">Horas Extra:</span><span className="font-semibold text-teal-900">{formatBs(slip.trabajo_extraordinario)}</span></div>
                                      <div className="flex justify-between pb-1"><span className="text-teal-700/80">Otros Bonos:</span><span className="font-semibold text-teal-900">{formatBs(Number(slip.bono_produccion) + Number(slip.subsidio_frontera) + Number(slip.pago_dominical) + Number(slip.otros_bonos) + Number(slip.subsidio_natalidad || 0))}</span></div>
                                    </div>
                                  </div>

                                  {/* Columna Descuentos */}
                                  <div className="bg-rose-50/30 p-5 rounded-2xl shadow-sm border border-rose-100">
                                    <h4 className="text-rose-800 font-bold mb-4 flex items-center gap-2"><Minus className="w-5 h-5 text-rose-500" /> Descuentos</h4>
                                    <div className="space-y-2 text-sm">
                                      <div className="flex justify-between border-b border-rose-100/50 pb-1"><span className="text-rose-700/80">AFP (12.71%):</span><span className="font-semibold text-rose-900">{formatBs(slip.aporte_gestora)}</span></div>
                                      <div className="flex justify-between border-b border-rose-100/50 pb-1"><span className="text-rose-700/80">RC-IVA:</span><span className="font-semibold text-rose-900">{formatBs(slip.rc_iva)}</span></div>
                                      <div className="flex justify-between border-b border-rose-100/50 pb-1"><span className="text-rose-700/80">Anticipos:</span><span className="font-semibold text-rose-900">{formatBs(slip.anticipos)}</span></div>
                                      <div className="flex justify-between pb-1"><span className="text-rose-700/80">Otros Desc.:</span><span className="font-semibold text-rose-900">{formatBs(slip.otros_descuentos)}</span></div>
                                    </div>
                                  </div>
                                </div>
                              </motion.div>
                            </td>
                          </tr>
                        )}
                      </AnimatePresence>
                    </React.Fragment>
                  );
                })}
                {payroll.payslips.length === 0 && (
                  <tr>
                    <td colSpan={7} className="p-12 text-center text-slate-500 font-medium">No hay empleados activos registrados para generar la planilla.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL: EDITAR VALORES */}
      <AnimatePresence>
        {viewMode === 'edit' && selectedPayslip && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
             <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setViewMode(null)} />
             <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden">
                <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                  <h3 className="font-bold text-slate-800">Modificar Planilla: {selectedPayslip.employee_name}</h3>
                  <button onClick={() => setViewMode(null)} className="text-slate-900 hover:text-slate-900"><X className="w-5 h-5"/></button>
                </div>
                <div className="p-6 space-y-4 bg-white">
                   <div>
                     <label className="block text-sm font-semibold text-slate-900 mb-1">Bono de Producción (Bs.)</label>
                     <input type="number" value={editForm.bono_produccion} onChange={e => setEditForm({...editForm, bono_produccion: parseFloat(e.target.value)||0})} className="w-full border border-slate-300 rounded-lg px-3 py-2" />
                   </div>
                   <div>
                     <label className="block text-sm font-semibold text-slate-900 mb-1">Otros Bonos (Bs.)</label>
                     <input type="number" value={editForm.otros_bonos} onChange={e => setEditForm({...editForm, otros_bonos: parseFloat(e.target.value)||0})} className="w-full border border-slate-300 rounded-lg px-3 py-2" />
                   </div>
                   <div>
                     <label className="block text-sm font-semibold text-slate-900 mb-1">Anticipos (Bs.)</label>
                     <input type="number" value={editForm.anticipos} onChange={e => setEditForm({...editForm, anticipos: parseFloat(e.target.value)||0})} className="w-full border border-slate-300 rounded-lg px-3 py-2" />
                   </div>
                   <div>
                     <label className="block text-sm font-semibold text-slate-900 mb-1">Otros Descuentos (Bs.)</label>
                     <input type="number" value={editForm.otros_descuentos} onChange={e => setEditForm({...editForm, otros_descuentos: parseFloat(e.target.value)||0})} className="w-full border border-slate-300 rounded-lg px-3 py-2" />
                   </div>
                   <div className="pt-4 flex justify-end gap-3">
                     <button onClick={() => setViewMode(null)} className="px-4 py-2 border border-slate-300 text-slate-900 rounded-lg">Cancelar</button>
                     <button onClick={handleSaveEdit} disabled={saving} className="px-4 py-2 bg-teal-500 text-white rounded-lg flex items-center gap-2 font-semibold">
                       {saving ? <Loader2 className="w-4 h-4 animate-spin"/> : <Calculator className="w-4 h-4"/>}
                       Recalcular
                     </button>
                   </div>
                </div>
             </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal Confirmación Planilla */}
      <AnimatePresence>
        {showConfirmModal && (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="bg-white rounded-2xl shadow-xl max-w-md w-full overflow-hidden">
              <div className="p-6">
                <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mb-4">
                  <Lock className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-2">Confirmar Planilla del Mes</h3>
                <p className="text-slate-600 mb-4 text-sm leading-relaxed">
                  Estás a punto de <strong>cerrar y confirmar</strong> la planilla del mes de {MONTHS[month - 1]}. 
                  Una vez confirmada, la planilla quedará en <strong>modo lectura</strong> para preservar la integridad de los datos. No podrás agregar más boletas ni editar los valores actuales.
                </p>
                <div className="flex justify-end gap-3 mt-6">
                  <button onClick={() => setShowConfirmModal(false)} className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition">
                    Cancelar
                  </button>
                  <button onClick={handleConfirmPayroll} disabled={confirming} className="px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 flex items-center gap-2 transition disabled:opacity-50">
                    {confirming ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                    Sí, Confirmar Planilla
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default function PlanillasPage() {
  return (
    <Suspense fallback={<div className="flex justify-center p-12"><div className="w-8 h-8 border-4 border-teal-500 border-t-transparent rounded-full animate-spin"></div></div>}>
      <PlanillasPageContent />
    </Suspense>
  );
}
