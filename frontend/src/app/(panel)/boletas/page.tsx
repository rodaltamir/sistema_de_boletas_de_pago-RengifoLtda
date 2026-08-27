"use client";

import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Loader2, Eye, X, FileText, FileSpreadsheet, File, Users, Calculator } from "lucide-react";

interface Payslip {
  id: number;
  payroll_id: number;
  employee_id: number;
  employee_name: string;
  employee_ci: string;
  employee_cargo: string;
  employee_fecha_ingreso?: string;
  employee_nacionalidad?: string;
  employee_fecha_nacimiento?: string;
  employee_sexo?: string;
  
  dias_pagados: number;
  horas_pagadas: number;
  
  haber_basico: number;
  bono_antiguedad: number;
  bono_produccion: number;
  subsidio_frontera: number;
  trabajo_extraordinario: number;
  pago_dominical: number;
  otros_bonos: number;
  subsidio_natalidad?: number;
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
  tenant_name?: string;
  tenant_nro_patronal?: string;
  payslips: Payslip[];
}

const MONTHS = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
];

function numeroALetras(num: number): string {
  const UNIDADES = ["", "Un ", "Dos ", "Tres ", "Cuatro ", "Cinco ", "Seis ", "Siete ", "Ocho ", "Nueve "];
  const DECENAS = ["Diez ", "Once ", "Doce ", "Trece ", "Catorce ", "Quince ", "Dieciseis ", "Diecisiete ", "Dieciocho ", "Diecinueve ", "Veinte ", "Treinta ", "Cuarenta ", "Cincuenta ", "Sesenta ", "Setenta ", "Ochenta ", "Noventa "];
  const CENTENAS = ["", "Ciento ", "Doscientos ", "Trescientos ", "Cuatrocientos ", "Quinientos ", "Seiscientos ", "Setecientos ", "Ochocientos ", "Novecientos "];

  if (num === 0) return "Cero ";
  if (num === 100) return "Cien ";

  let str = "";
  let miles = Math.floor(num / 1000);
  let resto = num % 1000;

  if (miles > 0) {
    if (miles === 1) str += "Mil ";
    else str += numeroALetras(miles) + "Mil ";
  }

  let c = Math.floor(resto / 100);
  let d = Math.floor((resto % 100) / 10);
  let u = resto % 10;

  if (c > 0) str += CENTENAS[c];

  if (d === 1) {
    str += DECENAS[u];
  } else if (d === 2) {
    if (u === 0) str += "Veinte ";
    else str += "Veinti" + UNIDADES[u].toLowerCase();
  } else if (d > 2) {
    str += DECENAS[d + 8];
    if (u > 0) str += "y " + UNIDADES[u];
  } else {
    str += UNIDADES[u];
  }

  return str;
}

export default function BoletasPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const tenantSchema = searchParams.get("tenant");

  const [month, setMonth] = useState<number>(new Date().getMonth() + 1);
  const [year, setYear] = useState<number>(new Date().getFullYear());
  
  const [payroll, setPayroll] = useState<PayrollData | null>(null);
  const [loading, setLoading] = useState(false);

  const [selectedPayslip, setSelectedPayslip] = useState<Payslip | null>(null);
  const [viewMode, setViewMode] = useState<'boleta' | 'edit' | null>(null);
  const [editForm, setEditForm] = useState({ 
    dias_pagados: 30,
    horas_pagadas: 8,
    bono_produccion: 0, 
    subsidio_frontera: 0,
    trabajo_extraordinario: 0,
    pago_dominical: 0,
    otros_bonos: 0,
    subsidio_natalidad: 0, 
    anticipos: 0, 
    otros_descuentos: 0 
  });
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

  
  const handleExportBoleta = (format: 'pdf' | 'excel', id: number) => {
    if (!tenantSchema || !month || !year) return;
    const url = `http://localhost:8000/api/tenants/${tenantSchema}/payrolls/${month}/${year}/payslips/${id}/export/${format}`;
    window.open(url, '_blank');
  };

  const handleOpenBoleta = (slip: Payslip) => {
    setSelectedPayslip(slip);
    setViewMode('boleta');
  };

  const handleOpenEdit = (slip: Payslip) => {
    setSelectedPayslip(slip);
    // Para simplificar, la UI pide horas_pagadas como "Horas pagadas (Día)", el backend asume un total mensual (e.g. 240). 
    // Usaremos el valor diario en el formulario y lo multiplicaremos si es necesario o simplemente lo pasaremos. 
    // Según la captura, "Horas pagadas (Día)" es 8.
    setEditForm({
      dias_pagados: Number(slip.dias_pagados) || 30,
      horas_pagadas: (Number(slip.horas_pagadas) / (Number(slip.dias_pagados)||30)) || 8,
      bono_produccion: Number(slip.bono_produccion),
      subsidio_frontera: Number(slip.subsidio_frontera) || 0,
      trabajo_extraordinario: Number(slip.trabajo_extraordinario) || 0,
      pago_dominical: Number(slip.pago_dominical) || 0,
      otros_bonos: Number(slip.otros_bonos),
      subsidio_natalidad: Number((slip as any).subsidio_natalidad) || 0,
      anticipos: Number(slip.anticipos),
      otros_descuentos: Number(slip.otros_descuentos)
    });
    setViewMode('edit');
  };

  const handleSaveEdit = async () => {
    if (!selectedPayslip || !tenantSchema || !payroll) return;
    setSaving(true);
    try {
      // El backend espera horas totales mensuales
      const payload = {
        ...editForm,
        horas_pagadas: editForm.horas_pagadas * editForm.dias_pagados
      };
      const res = await fetch(`http://localhost:8000/api/tenants/${tenantSchema}/payrolls/slip/${selectedPayslip.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        const updatedSlip = await res.json();
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

  const formatBs = (val: number) => Number(val).toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  
  const getLeteral = (val: number) => {
    const entero = Math.floor(val);
    const centavos = Math.round((val - entero) * 100);
    const textoEntero = numeroALetras(entero).trim();
    return `${textoEntero} ${centavos.toString().padStart(2, '0')}/100 Bolivianos`;
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "--/--/----";
    const [y, m, d] = dateStr.split("-");
    return `${d}/${m}/${y}`;
  };


  const previewData = selectedPayslip ? (() => {
    const base = Number(selectedPayslip.haber_basico) || 0;
    const antig = Number(selectedPayslip.bono_antiguedad) || 0;
    
    const bono_prod = Number(editForm.bono_produccion) || 0;
    const frontera = Number(editForm.subsidio_frontera) || 0;
    const extra = Number(editForm.trabajo_extraordinario) || 0;
    const dominical = Number(editForm.pago_dominical) || 0;
    const otros_b = Number(editForm.otros_bonos) || 0;
    
    const total_ganado = base + antig + bono_prod + frontera + extra + dominical + otros_b;
    
    const gestora = total_ganado * 0.1271;
    const solidario = total_ganado * 0.005;
    const gestora_p = gestora - solidario;
    
    const neto = total_ganado - gestora;
    let rc_iva = 0;
    if (neto > 6600) {
       rc_iva = (neto - 6600) * 0.13 - (6600 * 0.13);
       if (rc_iva < 0) rc_iva = 0;
    }
    
    const otros_desc = (Number(editForm.anticipos) || 0) + (Number(editForm.otros_descuentos) || 0);
    const total_desc = gestora + rc_iva + otros_desc;
    
    const natalidad = Number(editForm.subsidio_natalidad) || 0;
    const liquido = total_ganado - total_desc + natalidad;
    
    return { base, antig, otros_ing: bono_prod + frontera + extra + dominical + otros_b, total_ganado, gestora_p, solidario, rc_iva, otros_desc, total_desc, natalidad, liquido };
  })() : null;

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
            <FileText className="text-teal-600 w-8 h-8" />
            Boletas de Pago
          </h1>
          <p className="text-slate-500 mt-1">Generación y visualización de papeletas individuales.</p>
        </div>
        
        <div className="flex items-center gap-3 bg-white p-2 rounded-2xl shadow-sm border border-slate-200">
          <select 
            value={month} 
            onChange={(e) => setMonth(Number(e.target.value))}
            className="bg-slate-50 border-none outline-none text-slate-700 font-semibold px-4 py-2 rounded-xl focus:ring-2 focus:ring-teal-500"
          >
            {MONTHS.map((m, i) => (
              <option key={i+1} value={i+1}>{m}</option>
            ))}
          </select>
          <input 
            type="number" 
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="w-24 bg-slate-50 border-none outline-none text-slate-700 font-semibold px-4 py-2 rounded-xl focus:ring-2 focus:ring-teal-500"
          />
          <button 
            onClick={fetchPayroll}
            disabled={loading}
            className="bg-teal-500 text-white px-6 py-2 rounded-xl font-bold shadow-md hover:bg-teal-600 transition flex items-center gap-2"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
            Buscar
          </button>
        </div>
      </div>

      {/* Grid de Empleados */}
      {payroll && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {payroll.payslips.length === 0 ? (
            <div className="col-span-full p-8 text-center text-slate-500 bg-white rounded-2xl border border-slate-100 shadow-sm">
              No hay empleados activos para este mes.
            </div>
          ) : (
            payroll.payslips.map((slip) => (
              <div 
                key={slip.id} 
                onClick={() => handleOpenEdit(slip)}
                className="bg-white border border-slate-100 shadow-sm rounded-2xl p-5 hover:shadow-md hover:border-teal-300 hover:ring-2 hover:ring-teal-100 transition group cursor-pointer"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="bg-teal-50 text-teal-600 p-3 rounded-xl group-hover:bg-teal-500 group-hover:text-white transition">
                    <Users className="w-6 h-6" />
                  </div>
                  <span className="text-xs font-bold text-slate-900 bg-slate-200 px-2 py-1 rounded-md">
                    Cód. {slip.employee_id}
                  </span>
                </div>
                <h3 className="font-bold text-slate-800 text-lg leading-tight truncate">{slip.employee_name}</h3>
                <p className="text-slate-900 font-medium text-sm mt-1">{slip.employee_cargo}</p>
                
                <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between">
                  <div>
                    <p className="text-xs text-slate-900 font-semibold">Líquido Pagable</p>
                    <p className="font-bold text-emerald-600">Bs. {formatBs(slip.liquido_pagable)}</p>
                  </div>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOpenBoleta(slip);
                    }}
                    className="flex items-center gap-1.5 bg-slate-900 text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-teal-600 transition"
                  >
                    <Eye className="w-4 h-4" /> Ver
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* MODAL: BOLETA DE PAGO (Diseño Calca) */}
      <AnimatePresence>
        {viewMode === 'boleta' && selectedPayslip && payroll && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm" onClick={() => setViewMode(null)} />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 10 }} className="relative w-full max-w-4xl bg-white rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[95vh]">
              
              <div className="bg-slate-100 p-3 flex justify-between items-center border-b border-slate-200">
                <h3 className="font-bold text-slate-700 flex items-center gap-2"><FileText className="w-5 h-5 text-teal-600"/> Previsualización de Boleta</h3>
                <div className="flex items-center gap-2">
                  <button onClick={() => handleExportBoleta("pdf", selectedPayslip.id)} className="text-xs flex items-center gap-1 bg-red-600 text-white px-2 py-1 rounded hover:bg-red-700"><FileText className="w-3 h-3"/> PDF</button>
                  <button onClick={() => handleExportBoleta("excel", selectedPayslip.id)} className="text-xs flex items-center gap-1 bg-green-600 text-white px-2 py-1 rounded hover:bg-green-700"><FileSpreadsheet className="w-3 h-3"/> Excel</button>
                  
                  <button onClick={() => setViewMode(null)} className="ml-2 text-slate-400 hover:text-slate-900"><X className="w-5 h-5"/></button>
                </div>
              </div>

              {/* El diseño que calca la imagen 1 */}
              <div className="p-8 overflow-y-auto bg-white text-black font-mono text-sm leading-relaxed">
                <div className="border border-black p-4 relative">
                  
                  {/* Header Empresa */}
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <div className="font-bold text-lg uppercase">{payroll.tenant_name?.toUpperCase() || "EMPRESA AQUI"}</div>
                      <div className="font-bold">Nro. Patronal: <span className="font-normal">{payroll.tenant_nro_patronal || "--"}</span></div>
                    </div>
                    <div className="border border-black px-2 py-1 flex gap-4">
                      <span>Número :</span>
                      <span className="font-bold">{selectedPayslip.employee_id}</span>
                    </div>
                  </div>

                  <h2 className="text-center text-xl font-bold underline mb-4">PAPELETA DE PAGO</h2>
                  
                  <div className="flex justify-between mb-4 border-b border-black pb-2 font-bold">
                    <span>MES {MONTHS[payroll.month-1]}</span>
                    <span>AÑO {payroll.year}</span>
                    <span>FECHA {new Date().toLocaleDateString('es-BO')}</span>
                  </div>

                  {/* Datos Empleado */}
                  <div className="grid grid-cols-2 gap-2 mb-4 font-bold">
                    <div>CODIGO : <span className="font-normal">{selectedPayslip.employee_id}</span></div>
                    <div>NOMBRE : <span className="font-normal uppercase">{selectedPayslip.employee_name}</span></div>
                    <div>CARGO : <span className="font-normal uppercase">{selectedPayslip.employee_cargo}</span></div>
                    <div>FECHA INGRESO : <span className="font-normal">{formatDate(selectedPayslip.employee_fecha_ingreso)}</span></div>
                    <div className="col-span-2 text-right">SALDO I.V.A. : <span className="font-normal">0.00</span></div>
                  </div>

                  {/* Tabla Ingresos / Descuentos */}
                  <div className="border border-black flex mb-4">
                    <div className="w-1/2 border-r border-black">
                      <div className="border-b border-black text-center font-bold p-1">INGRESOS</div>
                      <div className="p-2 space-y-1">
                        <div className="flex justify-between"><span>Sueldo Básico</span><span>{formatBs(selectedPayslip.haber_basico)}</span></div>
                        <div className="flex justify-between"><span>Bono de Antigüedad</span><span>{formatBs(selectedPayslip.bono_antiguedad)}</span></div>
                        <div className="flex justify-between"><span>Otros Ingresos/Bonos</span><span>{formatBs(Number(selectedPayslip.bono_produccion)+Number(selectedPayslip.otros_bonos)+Number(selectedPayslip.subsidio_frontera)+Number(selectedPayslip.trabajo_extraordinario)+Number(selectedPayslip.pago_dominical))}</span></div>
                      </div>
                    </div>
                    <div className="w-1/2">
                      <div className="border-b border-black text-center font-bold p-1">DESCUENTOS</div>
                      <div className="p-2 space-y-1">
                        <div className="flex justify-between"><span>R.C. - I.V.A.</span><span>{formatBs(selectedPayslip.rc_iva)}</span></div>
                        <div className="flex justify-between"><span>Gestora Pública de Bolivia</span><span>{formatBs(selectedPayslip.aporte_gestora - (selectedPayslip.total_ganado * 0.005))}</span></div>
                        <div className="flex justify-between"><span>Aporte Solidario Asegurado</span><span>{formatBs(selectedPayslip.total_ganado * 0.005)}</span></div>
                        <div className="flex justify-between"><span>Anticipo</span><span>{formatBs(selectedPayslip.anticipos)}</span></div>
                        <div className="flex justify-between"><span>Otros Desctos.</span><span>{formatBs(selectedPayslip.otros_descuentos)}</span></div>
                      </div>
                    </div>
                  </div>

                  {/* Totales */}
                  <div className="flex font-bold border border-black mb-4 bg-gray-100/50">
                    <div className="w-1/2 p-2 flex justify-between border-r border-black">
                      <span>TOTAL GANADO</span><span>{formatBs(selectedPayslip.total_ganado)}</span>
                    </div>
                    <div className="w-1/2 p-2 flex justify-between">
                      <span>TOTAL DESCUENTOS</span><span>{formatBs(selectedPayslip.total_descuentos)}</span>
                    </div>
                  </div>

                  {/* Líquido */}
                  <div className="flex border border-black p-2 font-bold mb-16">
                    <span className="w-48 shrink-0">LIQUIDO PAGABLE:</span>
                    <span className="text-lg w-32 shrink-0 border-r border-black">{formatBs(selectedPayslip.liquido_pagable)}</span>
                    <span className="pl-4 font-normal italic w-full uppercase">*** {getLeteral(selectedPayslip.liquido_pagable)} ***</span>
                  </div>

                  {/* Firmas */}
                  <div className="flex justify-between mt-12 px-8 text-center">
                    <div className="border-t border-dashed border-black w-64 pt-1">Verificado Contabilidad/Gerencia</div>
                    <div className="border-t border-dashed border-black w-64 pt-1 uppercase">{selectedPayslip.employee_name}</div>
                  </div>

                </div>
              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL: EDITAR VALORES Y VALIDACIÓN COMPLETA */}
      <AnimatePresence>
        {viewMode === 'edit' && selectedPayslip && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4">
             <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setViewMode(null)} />
             <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative w-full max-w-[95vw] bg-white rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[95vh]">
                <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center shrink-0">
                  <h3 className="font-bold text-slate-800 flex items-center gap-2">
                    <Users className="w-5 h-5 text-teal-600"/> 
                    Validación y Edición de Planilla: {selectedPayslip.employee_name}
                  </h3>
                  <button onClick={() => setViewMode(null)} className="text-slate-400 hover:text-slate-900"><X className="w-5 h-5"/></button>
                </div>
                
                <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-slate-50">
                  <div className="flex flex-col xl:flex-row gap-6 mb-8">
                    {/* LADO IZQUIERDO: FORMULARIO DETALLADO */}
                    <div className="flex-1 space-y-4 bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                      <h4 className="font-bold text-teal-700 border-b border-teal-100 pb-2 mb-4">Ingresar / Editar Variables</h4>
                      
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        <div>
                          <label className="block text-xs font-bold text-slate-800 mb-1">Días Trabajados</label>
                          <input type="number" min="0" max="31" value={editForm.dias_pagados} onChange={e => setEditForm({...editForm, dias_pagados: parseInt(e.target.value)||0})} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 font-semibold focus:ring-2 focus:ring-teal-500 focus:outline-none bg-slate-50" />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-800 mb-1">Horas pagadas (Día)</label>
                          <input type="number" min="0" max="24" value={editForm.horas_pagadas} onChange={e => setEditForm({...editForm, horas_pagadas: parseInt(e.target.value)||0})} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 font-semibold focus:ring-2 focus:ring-teal-500 focus:outline-none bg-slate-50" />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-800 mb-1">Bono de Producción (Bs.)</label>
                          <input type="number" value={editForm.bono_produccion} onChange={e => setEditForm({...editForm, bono_produccion: parseFloat(e.target.value)||0})} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 font-semibold focus:ring-2 focus:ring-teal-500 focus:outline-none bg-slate-50" />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-800 mb-1">Subsidio de frontera (Bs.)</label>
                          <input type="number" value={editForm.subsidio_frontera} onChange={e => setEditForm({...editForm, subsidio_frontera: parseFloat(e.target.value)||0})} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 font-semibold focus:ring-2 focus:ring-teal-500 focus:outline-none bg-slate-50" />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-800 mb-1">Trabajo extraord. / nocturno</label>
                          <input type="number" value={editForm.trabajo_extraordinario} onChange={e => setEditForm({...editForm, trabajo_extraordinario: parseFloat(e.target.value)||0})} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 font-semibold focus:ring-2 focus:ring-teal-500 focus:outline-none bg-slate-50" />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-800 mb-1">Pago dominical (Bs.)</label>
                          <input type="number" value={editForm.pago_dominical} onChange={e => setEditForm({...editForm, pago_dominical: parseFloat(e.target.value)||0})} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 font-semibold focus:ring-2 focus:ring-teal-500 focus:outline-none bg-slate-50" />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-800 mb-1">Otros Bonos (Bs.)</label>
                          <input type="number" value={editForm.otros_bonos} onChange={e => setEditForm({...editForm, otros_bonos: parseFloat(e.target.value)||0})} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 font-semibold focus:ring-2 focus:ring-teal-500 focus:outline-none bg-slate-50" />
                        </div>
                        {selectedPayslip.employee_sexo === 'F' && (
                          <div>
                            <label className="block text-xs font-bold text-slate-800 mb-1">Subsidio de Natalidad (Bs.)</label>
                            <input type="number" value={editForm.subsidio_natalidad} onChange={e => setEditForm({...editForm, subsidio_natalidad: parseFloat(e.target.value)||0})} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 font-semibold focus:ring-2 focus:ring-teal-500 focus:outline-none bg-slate-50" />
                          </div>
                        )}
                        <div>
                          <label className="block text-xs font-bold text-slate-800 mb-1">Anticipos (Bs.)</label>
                          <input type="number" value={editForm.anticipos} onChange={e => setEditForm({...editForm, anticipos: parseFloat(e.target.value)||0})} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 font-semibold focus:ring-2 focus:ring-teal-500 focus:outline-none bg-slate-50" />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-800 mb-1">Otros Descuentos (Bs.)</label>
                          <input type="number" value={editForm.otros_descuentos} onChange={e => setEditForm({...editForm, otros_descuentos: parseFloat(e.target.value)||0})} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 font-semibold focus:ring-2 focus:ring-teal-500 focus:outline-none bg-slate-50" />
                        </div>
                      </div>
                      
                      <div className="pt-4 flex justify-end gap-3 border-t border-slate-100 mt-6">
                        <button onClick={() => setViewMode(null)} className="px-4 py-2 border border-slate-300 text-slate-900 rounded-lg text-sm hover:bg-slate-50">Cancelar</button>
                        <button onClick={handleSaveEdit} disabled={saving} className="px-4 py-2 bg-teal-500 hover:bg-teal-600 text-white rounded-lg text-sm flex items-center gap-2 font-semibold transition shadow-md">
                          {saving ? <Loader2 className="w-4 h-4 animate-spin"/> : <Calculator className="w-4 h-4"/>}
                          Aplicar Cambios en Planilla
                        </button>
                      </div>
                    </div>

                    {/* LADO DERECHO: RESUMEN RAPIDO */}
                    <div className="w-full xl:w-[420px] bg-white p-5 rounded-xl border border-slate-200 shadow-sm font-mono text-sm shrink-0">
                      <h4 className="font-bold text-slate-800 border-b border-slate-200 pb-2 mb-4">Resumen Rápido</h4>
                      
                      {previewData && (
                        <div className="space-y-4 text-slate-900 font-medium">
                          {/* INGRESOS */}
                          <div className="bg-slate-50 rounded-lg p-3">
                            <div className="font-bold border-b border-slate-200 pb-1 mb-2 text-slate-900">INGRESOS</div>
                            <div className="flex justify-between text-xs mb-1 gap-4">
                              <span>Haber Básico:</span>
                              <span className="whitespace-nowrap">Bs. {formatBs(previewData.base)}</span>
                            </div>
                            <div className="flex justify-between text-xs mb-1 gap-4">
                              <span>Bono de Antigüedad:</span>
                              <span className="whitespace-nowrap">Bs. {formatBs(previewData.antig)}</span>
                            </div>
                            <div className="flex justify-between text-xs mb-1 border-b border-slate-200 pb-2 gap-4">
                              <span>Otros Ingresos (Prod, Front, Dominical...):</span>
                              <span className="whitespace-nowrap">Bs. {formatBs(previewData.otros_ing)}</span>
                            </div>
                            <div className="flex justify-between mt-2 font-bold text-teal-800 text-sm">
                              <span>TOTAL GANADO:</span>
                              <span className="whitespace-nowrap">Bs. {formatBs(previewData.total_ganado)}</span>
                            </div>
                          </div>

                          {/* DESCUENTOS */}
                          <div className="bg-slate-50 rounded-lg p-3">
                            <div className="font-bold border-b border-slate-200 pb-1 mb-2 text-slate-900">DESCUENTOS</div>
                            <div className="flex justify-between text-xs mb-1 gap-4">
                              <span>Aporte AFP / Gestora (12.21%):</span>
                              <span className="whitespace-nowrap">Bs. {formatBs(previewData.gestora_p)}</span>
                            </div>
                            <div className="flex justify-between text-xs mb-1 gap-4">
                              <span>Aporte Solidario (0.5%):</span>
                              <span className="whitespace-nowrap">Bs. {formatBs(previewData.solidario)}</span>
                            </div>
                            <div className="flex justify-between text-xs mb-1 gap-4">
                              <span>RC-IVA:</span>
                              <span className="whitespace-nowrap">Bs. {formatBs(previewData.rc_iva)}</span>
                            </div>
                            <div className="flex justify-between text-xs mb-1 border-b border-slate-200 pb-2 gap-4">
                              <span>Otros Descuentos:</span>
                              <span className="whitespace-nowrap">Bs. {formatBs(previewData.otros_desc)}</span>
                            </div>
                            <div className="flex justify-between mt-2 font-bold text-red-800 text-sm">
                              <span>TOTAL DESCUENTOS:</span>
                              <span className="whitespace-nowrap">Bs. {formatBs(previewData.total_desc)}</span>
                            </div>
                          </div>

                          {/* BENEFICIOS SOCIALES */}
                          {previewData.natalidad > 0 && (
                            <div className="bg-blue-50 rounded-lg p-3">
                              <div className="font-bold border-b border-blue-200 pb-1 mb-2 text-blue-900">OTROS BENEFICIOS</div>
                              <div className="flex justify-between text-xs mb-1 gap-4 text-blue-800">
                                <span>Subsidio de Natalidad:</span>
                                <span className="whitespace-nowrap">Bs. {formatBs(previewData.natalidad)}</span>
                              </div>
                            </div>
                          )}

                          {/* LÍQUIDO */}
                          <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200">
                            <div className="flex justify-between font-bold text-slate-900 mb-1 text-sm gap-4">
                              <span>LÍQUIDO PAGABLE:</span>
                              <span className="text-emerald-800 whitespace-nowrap">Bs. {formatBs(previewData.liquido)}</span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* VISTA PREVIA FILA PLANILLA OFICIAL (SCROLL HORIZONTAL) */}
                  <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm mt-4">
                    <h4 className="font-bold text-slate-800 mb-4 border-b border-slate-200 pb-2 flex items-center gap-2">
                      <FileSpreadsheet className="w-5 h-5 text-green-600"/> 
                      Fila en Planilla Oficial de Sueldos y Salarios (Vista Completa)
                    </h4>
                    <div className="overflow-x-auto pb-4 custom-scrollbar">
                      <table className="w-max border-collapse border border-slate-300 text-[11px] text-center font-mono whitespace-nowrap">
                        <thead className="bg-slate-100 text-slate-800">
                          <tr>
                            <th className="border border-slate-300 p-2 min-w-[30px]">Nº</th>
                            <th className="border border-slate-300 p-2 min-w-[100px]">Doc. Identidad</th>
                            <th className="border border-slate-300 p-2 min-w-[200px]">Apellidos y nombres</th>
                            <th className="border border-slate-300 p-2 min-w-[80px]">País de nacionalidad</th>
                            <th className="border border-slate-300 p-2 min-w-[80px]">Fecha de nacimiento</th>
                            <th className="border border-slate-300 p-2 min-w-[40px]">Sexo (V/M)</th>
                            <th className="border border-slate-300 p-2 min-w-[150px]">Ocupación que desempeña</th>
                            <th className="border border-slate-300 p-2 min-w-[80px]">Fecha de Ingreso</th>
                            <th className="border border-slate-300 p-2 min-w-[60px]">Horas pagad. (Día)</th>
                            <th className="border border-slate-300 p-2 min-w-[60px]">Días pagad. (Mes)</th>
                            <th className="border border-slate-300 p-2 min-w-[80px]">(1) Haber básico</th>
                            <th className="border border-slate-300 p-2 min-w-[80px]">(2) Bono de Antigüedad</th>
                            <th className="border border-slate-300 p-2 min-w-[80px]">(3) Bono de producción</th>
                            <th className="border border-slate-300 p-2 min-w-[80px]">(4) Subsidio de frontera</th>
                            <th className="border border-slate-300 p-2 min-w-[80px]">(5) Trabajo extraord. y nocturno</th>
                            <th className="border border-slate-300 p-2 min-w-[80px]">(6) Pago dominical</th>
                            <th className="border border-slate-300 p-2 min-w-[80px]">(7) Otros bonos</th>
                            <th className="border border-slate-300 p-2 min-w-[90px] bg-teal-50 text-teal-900 font-bold">(8) TOTAL GANADO Suma (1 a 7)</th>
                            <th className="border border-slate-300 p-2 min-w-[80px]">(9) Aporte a las AFPs</th>
                            <th className="border border-slate-300 p-2 min-w-[80px]">(10) RC-IVA</th>
                            <th className="border border-slate-300 p-2 min-w-[80px]">(11) Otros descuentos</th>
                            <th className="border border-slate-300 p-2 min-w-[90px] bg-red-50 text-red-900 font-bold">(12) TOTAL DESCUENTOS Suma (9 a 11)</th>
                            <th className="border border-slate-300 p-2 min-w-[90px] bg-emerald-50 text-emerald-900 font-bold">(13) LÍQUIDO PAGABLE (8-12)</th>
                            <th className="border border-slate-300 p-2 min-w-[150px] text-slate-500 font-normal italic">(14) Firma</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white text-slate-900 font-medium">
                          <tr className="hover:bg-blue-50 transition">
                            <td className="border border-slate-300 p-2">1</td>
                            <td className="border border-slate-300 p-2">{selectedPayslip.employee_ci}</td>
                            <td className="border border-slate-300 p-2 uppercase font-bold text-slate-900">{selectedPayslip.employee_name}</td>
                            <td className="border border-slate-300 p-2">{selectedPayslip.employee_nacionalidad || 'BOLIVIANO'}</td>
                            <td className="border border-slate-300 p-2">{formatDate(selectedPayslip.employee_fecha_nacimiento)}</td>
                            <td className="border border-slate-300 p-2">{selectedPayslip.employee_sexo || 'M'}</td>
                            <td className="border border-slate-300 p-2 uppercase">{selectedPayslip.employee_cargo}</td>
                            <td className="border border-slate-300 p-2">{formatDate(selectedPayslip.employee_fecha_ingreso)}</td>
                            <td className="border border-slate-300 p-2 bg-slate-50 font-bold">{Math.round((Number(selectedPayslip.horas_pagadas) / (Number(selectedPayslip.dias_pagados)||30)) * 10) / 10 || 8}</td>
                            <td className="border border-slate-300 p-2 bg-slate-50 font-bold">{selectedPayslip.dias_pagados}</td>
                            
                            <td className="border border-slate-300 p-2 text-right">{formatBs(selectedPayslip.haber_basico)}</td>
                            <td className="border border-slate-300 p-2 text-right">{formatBs(selectedPayslip.bono_antiguedad)}</td>
                            <td className="border border-slate-300 p-2 text-right">{formatBs(selectedPayslip.bono_produccion)}</td>
                            <td className="border border-slate-300 p-2 text-right">{formatBs(selectedPayslip.subsidio_frontera)}</td>
                            <td className="border border-slate-300 p-2 text-right">{formatBs(selectedPayslip.trabajo_extraordinario)}</td>
                            <td className="border border-slate-300 p-2 text-right">{formatBs(selectedPayslip.pago_dominical)}</td>
                            <td className="border border-slate-300 p-2 text-right">{formatBs(selectedPayslip.otros_bonos)}</td>
                            <td className="border border-slate-300 p-2 text-right bg-teal-50 font-bold text-teal-900">{formatBs(selectedPayslip.total_ganado)}</td>
                            
                            <td className="border border-slate-300 p-2 text-right">{formatBs(selectedPayslip.aporte_gestora)}</td>
                            <td className="border border-slate-300 p-2 text-right">{formatBs(selectedPayslip.rc_iva)}</td>
                            <td className="border border-slate-300 p-2 text-right">{formatBs(Number(selectedPayslip.anticipos) + Number(selectedPayslip.otros_descuentos))}</td>
                            <td className="border border-slate-300 p-2 text-right bg-red-50 font-bold text-red-900">{formatBs(selectedPayslip.total_descuentos)}</td>
                            <td className="border border-slate-300 p-2 text-right bg-emerald-100 font-bold text-emerald-900">{formatBs(selectedPayslip.liquido_pagable)}</td>
                            <td className="border border-slate-300 p-2"></td>
                          </tr>
                        </tbody>
                      </table>
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
