"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Calculator, Search, Loader2, Download, Edit, Eye, X, FileText, FileSpreadsheet, File } from "lucide-react";

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

  // Edit State
  const [editForm, setEditForm] = useState<any>({});
  const [saving, setSaving] = useState(false);

  const fetchPayroll = async () => {
    if (!tenantSchema) return;
    setLoading(true);
    try {
      const res = await fetch(`http://localhost:8000/api/tenants/${tenantSchema}/payrolls/${month}/${year}`);
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
    const url = `http://localhost:8000/api/tenants/${tenantSchema}/payrolls/${month}/${year}/export/${format}`;
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
      const res = await fetch(`http://localhost:8000/api/tenants/${tenantSchema}/payrolls/${month}/${year}/payslips/${selectedPayslip.id}`, {
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
          <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
            <h2 className="font-bold text-slate-900">Planilla Correspondiente al Mes de {MONTHS[payroll.month-1].toUpperCase()} {payroll.year}</h2>
            <div className="flex gap-2">
               <button onClick={() => handleExportPlanilla("excel")} className="flex items-center gap-2 px-3 py-1.5 text-sm bg-green-50 text-green-700 border border-green-200 rounded-lg hover:bg-green-100 transition">
                 <FileSpreadsheet className="w-4 h-4" /> Excel
               </button>
               <button onClick={() => handleExportPlanilla("pdf")} className="flex items-center gap-2 px-3 py-1.5 text-sm bg-red-50 text-red-700 border border-red-200 rounded-lg hover:bg-red-100 transition">
                 <FileText className="w-4 h-4" /> PDF
               </button>
            </div>
          </div>
          
          <div className="overflow-x-auto w-full max-w-[calc(100vw-2rem)] md:max-w-none pb-4 custom-scrollbar">
                        <table className="w-max text-sm text-left border-collapse min-w-full">
              <thead>
                <tr className="bg-slate-900 text-white border-b border-slate-700">
                  <th className="p-3 border-r border-slate-700 sticky left-0 bg-slate-900 z-10 text-center">N°</th>
                  <th className="p-3 border-r border-slate-700 sticky left-[40px] bg-slate-900 z-10 min-w-[200px]">Apellidos y Nombres</th>
                  <th className="p-3 border-r border-slate-700">Doc. Identidad</th>
                  <th className="p-3 border-r border-slate-700">Fecha Ingreso</th>
                  <th className="p-3 border-r border-slate-700">Cargo</th>
                  <th className="p-3 border-r border-slate-700 text-center">Días Pag.</th>
                  <th className="p-3 border-r border-slate-700 text-center">Horas Pag.</th>
                  <th className="p-3 border-r border-slate-700 text-right">Haber Básico</th>
                  <th className="p-3 border-r border-slate-700 text-right">Bono Antig.</th>
                  <th className="p-3 border-r border-slate-700 text-right">Horas Extra.</th>
                  <th className="p-3 border-r border-slate-700 text-right">Otros Bonos</th>
                  <th className="p-3 border-r border-slate-700 text-right bg-teal-900 font-bold">Total Ganado</th>
                  <th className="p-3 border-r border-slate-700 text-right">AFP (12.71%)</th>
                  <th className="p-3 border-r border-slate-700 text-right">RC-IVA</th>
                  <th className="p-3 border-r border-slate-700 text-right">Anticipos</th>
                  <th className="p-3 border-r border-slate-700 text-right">Otros Desc.</th>
                  <th className="p-3 border-r border-slate-700 text-right bg-rose-900 font-bold">Total Desc.</th>
                  <th className="p-3 border-r border-slate-700 text-right bg-emerald-900 font-bold">Líquido Pagable</th>
                  <th className="p-3 text-center sticky right-0 bg-slate-900 z-10">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {payroll.payslips.map((slip, i) => (
                  <tr key={slip.id} className="border-b border-slate-200 hover:bg-slate-50 transition group bg-white">
                    <td className="p-3 border-r border-slate-200 sticky left-0 bg-white group-hover:bg-slate-50 text-center font-bold text-slate-900">{i + 1}</td>
                    <td className="p-3 border-r border-slate-200 sticky left-[40px] bg-white group-hover:bg-slate-50 font-bold text-slate-900 truncate max-w-[200px]">{slip.employee_name}</td>
                    <td className="p-3 border-r border-slate-200 text-slate-900">{slip.employee_ci}</td>
                    <td className="p-3 border-r border-slate-200 text-slate-900">{slip.employee_fecha_ingreso}</td>
                    <td className="p-3 border-r border-slate-200 text-slate-900">{slip.employee_cargo}</td>
                    <td className="p-3 border-r border-slate-200 text-slate-900 text-center font-semibold">{slip.dias_pagados}</td>
                    <td className="p-3 border-r border-slate-200 text-slate-900 text-center font-semibold">{Math.round(slip.horas_pagadas / (slip.dias_pagados || 30))}</td>
                    <td className="p-3 border-r border-slate-200 text-right text-slate-900 font-medium">{formatBs(slip.haber_basico)}</td>
                    <td className="p-3 border-r border-slate-200 text-right text-slate-900">{formatBs(slip.bono_antiguedad)}</td>
                    <td className="p-3 border-r border-slate-200 text-right text-slate-900">{formatBs(slip.trabajo_extraordinario)}</td>
                    <td className="p-3 border-r border-slate-200 text-right text-slate-900 font-medium">
                      {formatBs(Number(slip.bono_produccion) + Number(slip.subsidio_frontera) + Number(slip.pago_dominical) + Number(slip.otros_bonos) + Number(slip.subsidio_natalidad || 0))}
                    </td>
                    <td className="p-3 border-r border-slate-200 text-right font-bold text-teal-900 bg-teal-50/50">{formatBs(slip.total_ganado)}</td>
                    <td className="p-3 border-r border-slate-200 text-right text-slate-900">{formatBs(slip.aporte_gestora)}</td>
                    <td className="p-3 border-r border-slate-200 text-right text-slate-900">{formatBs(slip.rc_iva)}</td>
                    <td className="p-3 border-r border-slate-200 text-right text-slate-900">{formatBs(slip.anticipos)}</td>
                    <td className="p-3 border-r border-slate-200 text-right text-slate-900">{formatBs(slip.otros_descuentos)}</td>
                    <td className="p-3 border-r border-slate-200 text-right font-bold text-rose-700 bg-rose-50/50">{formatBs(slip.total_descuentos)}</td>
                    <td className="p-3 border-r border-slate-200 text-right font-black text-emerald-700 bg-emerald-50">{formatBs(slip.liquido_pagable)}</td>
                    <td className="p-3 flex justify-center gap-2 sticky right-0 bg-white group-hover:bg-slate-50 border-l border-slate-200">
                      <button onClick={() => handleOpenEdit(slip)} className="p-1.5 text-blue-700 bg-blue-50 rounded-md hover:bg-blue-200 transition-colors" title="Editar Valores">
                        <Edit className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
                {payroll.payslips.length === 0 && (
                  <tr>
                    <td colSpan={18} className="p-8 text-center text-slate-900 font-medium">No hay empleados activos registrados para generar la planilla.</td>
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
