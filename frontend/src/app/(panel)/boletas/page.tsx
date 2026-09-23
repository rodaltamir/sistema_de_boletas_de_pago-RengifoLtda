"use client";

import React, { useState, useEffect, Suspense, useMemo } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Search, 
  Loader2, 
  Eye, 
  X, 
  FileText, 
  FileSpreadsheet, 
  File, 
  Users, 
  Calculator, 
  Edit, 
  Lock, 
  Unlock, 
  CheckCircle, 
  UserX,
  Gift,
  Building2,
  Download
} from "lucide-react";
import { getApiUrl } from "@/utils/api";

interface Payslip {
  id: number;
  payroll_id: number;
  employee_id: number;
  employee_code?: string;
  employee_name: string;
  employee_ci: string;
  employee_cargo: string;
  employee_fecha_ingreso?: string;
  employee_nacionalidad?: string;
  employee_fecha_nacimiento?: string;
  employee_sexo?: string;
  employee_is_active?: boolean;
  
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

// --- INTERFACES: AGUINALDOS (PAPELETAS) ---
interface AguinaldoSlip {
  id: number;
  aguinaldo_payroll_id: number;
  employee_id: number;
  employee_code?: string;
  employee_ci?: string;
  employee_name: string;
  employee_cargo?: string;
  employee_fecha_ingreso?: string;
  promedio_total_ganado: number;
  meses_trabajados: number;
  total_aguinaldo: number;
  total_aguinaldo_literal?: string;
}

interface AguinaldoPayrollData {
  id: number;
  year: number;
  tenant_name: string;
  tenant_nro_patronal: string;
  tenant_nit: string;
  slips: AguinaldoSlip[];
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

function BoletasPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const tenantSchema = searchParams.get("tenant");

  // Pestañas principales: 'pago' | 'aguinaldo'
  const [boletasTab, setBoletasTab] = useState<'pago' | 'aguinaldo'>('pago');

  // ==========================================
  // ESTADO: BOLETAS DE PAGO (MENSUAL REGULAR)
  // ==========================================
  const [month, setMonth] = useState<number>(new Date().getMonth() + 1);
  const [year, setYear] = useState<number>(new Date().getFullYear());
  
  const [payroll, setPayroll] = useState<PayrollData | null>(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    setIsAdmin(localStorage.getItem("isAdmin") === "true");
  }, []);

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

  const sortedPayslips = React.useMemo(() => {
    if (!payroll?.payslips) return [];
    const lastDay = new Date(year, month, 0).getDate();
    const endOfMonthStr = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

    return [...payroll.payslips]
      .filter((p) => {
        if (!p.employee_fecha_ingreso) return true;
        return p.employee_fecha_ingreso <= endOfMonthStr;
      })
      .sort((a, b) => {
        const codeA = a.employee_code || a.employee_id;
        const codeB = b.employee_code || b.employee_id;
        const numA = parseInt(String(codeA).replace(/\D/g, ''), 10);
        const numB = parseInt(String(codeB).replace(/\D/g, ''), 10);
        if (!isNaN(numA) && !isNaN(numB)) {
          return numA - numB;
        }
        return String(codeA).localeCompare(String(codeB));
      });
  }, [payroll, month, year]);

  const fetchPayroll = async () => {
    if (!tenantSchema) return;
    setLoading(true);
    try {
      const res = await fetch(`${getApiUrl()}/api/tenants/${tenantSchema}/payrolls/${month}/${year}`);
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
    } else {
      fetchPayroll();
    }
  }, [tenantSchema, month, year, router]);

  const handleOpenBoleta = (slip: Payslip) => {
    setSelectedPayslip(slip);
    setViewMode('boleta');
  };

  const handleOpenEdit = (slip: Payslip) => {
    setSelectedPayslip(slip);
    setEditForm({
      dias_pagados: Number(slip.dias_pagados) || 30,
      horas_pagadas: Number(slip.horas_pagadas) > 24 ? Math.round(Number(slip.horas_pagadas) / (Number(slip.dias_pagados) || 30)) : (Number(slip.horas_pagadas) || 8),
      bono_produccion: Number(slip.bono_produccion),
      subsidio_frontera: Number(slip.subsidio_frontera),
      trabajo_extraordinario: Number(slip.trabajo_extraordinario),
      pago_dominical: Number(slip.pago_dominical),
      otros_bonos: Number(slip.otros_bonos),
      subsidio_natalidad: Number(slip.subsidio_natalidad || 0),
      anticipos: Number(slip.anticipos),
      otros_descuentos: Number(slip.otros_descuentos)
    });
    setViewMode('edit');
  };

  const handleSaveEdit = async () => {
    if (!selectedPayslip || !tenantSchema || !payroll) return;
    setSaving(true);
    try {
      const payload = {
        ...editForm,
        horas_pagadas: editForm.horas_pagadas
      };
      const res = await fetch(`${getApiUrl()}/api/tenants/${tenantSchema}/payrolls/slip/${selectedPayslip.id}`, {
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

  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [showReopenModal, setShowReopenModal] = useState(false);
  const [reopening, setReopening] = useState(false);

  const handleConfirmPayroll = async () => {
    if (!tenantSchema || !month || !year) return;
    setConfirming(true);
    try {
      const res = await fetch(`${getApiUrl()}/api/tenants/${tenantSchema}/payrolls/${month}/${year}/close`, {
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

  const handleReopenPayroll = async () => {
    if (!tenantSchema || !month || !year) return;
    setReopening(true);
    try {
      const res = await fetch(`${getApiUrl()}/api/tenants/${tenantSchema}/payrolls/${month}/${year}/reopen`, {
        method: "POST"
      });
      if (res.ok) {
        const data = await res.json();
        setPayroll(data);
        setShowReopenModal(false);
      } else {
        const errData = await res.json();
        alert(errData.detail || "Error al desconfirmar la planilla");
      }
    } catch (e) {
      alert("Error de conexión");
    } finally {
      setReopening(false);
    }
  };

  const formatBs = (val: number) => Number(val || 0).toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  
  const getLeteral = (val: number) => {
    const entero = Math.floor(val);
    const centavos = Math.round((val - entero) * 100);
    const textoEntero = numeroALetras(entero).trim();
    return `${textoEntero} ${centavos.toString().padStart(2, '0')}/100 Bolivianos`;
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "--/--/----";
    const [y, m, d] = dateStr.split("-");
    if (!m || !d) return dateStr;
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

  // ==========================================
  // ESTADO: BOLETAS DE AGUINALDO (IMAGEN 2)
  // ==========================================
  const [aguinaldoYear, setAguinaldoYear] = useState<number>(new Date().getFullYear());
  const [aguinaldoData, setAguinaldoData] = useState<AguinaldoPayrollData | null>(null);
  const [aguinaldoLoading, setAguinaldoLoading] = useState(false);
  const [aguinaldoSearch, setAguinaldoSearch] = useState("");
  const [selectedAguinaldoSlip, setSelectedAguinaldoSlip] = useState<AguinaldoSlip | null>(null);
  const [aguinaldoModalOpen, setAguinaldoModalOpen] = useState(false);
  const [aguinaldoSlipIndex, setAguinaldoSlipIndex] = useState(1);

  const fetchAguinaldos = async () => {
    if (!tenantSchema) return;
    setAguinaldoLoading(true);
    try {
      const res = await fetch(`${getApiUrl()}/api/tenants/${tenantSchema}/aguinaldos/${aguinaldoYear}`);
      if (res.ok) {
        const data = await res.json();
        setAguinaldoData(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setAguinaldoLoading(false);
    }
  };

  useEffect(() => {
    if (boletasTab === 'aguinaldo' && !aguinaldoData && tenantSchema) {
      fetchAguinaldos();
    }
  }, [boletasTab, aguinaldoYear, tenantSchema]);

  const handleOpenAguinaldoPreview = (slip: AguinaldoSlip, idx: number) => {
    setSelectedAguinaldoSlip(slip);
    setAguinaldoSlipIndex(idx);
    setAguinaldoModalOpen(true);
  };

  const handleExportAguinaldoSingle = (slipId: number, format: 'pdf' | 'excel') => {
    if (!tenantSchema) return;
    const url = `${getApiUrl()}/api/tenants/${tenantSchema}/aguinaldos/${aguinaldoYear}/papeletas/${slipId}/export/${format}`;
    window.open(url, '_blank');
  };

  const handleExportAguinaldoBatch = (format: 'pdf' | 'excel') => {
    if (!tenantSchema) return;
    const url = `${getApiUrl()}/api/tenants/${tenantSchema}/aguinaldos/${aguinaldoYear}/papeletas/export/${format}`;
    window.open(url, '_blank');
  };

  const filteredAguinaldoSlips = useMemo(() => {
    if (!aguinaldoData?.slips) return [];
    return aguinaldoData.slips.filter(s => {
      const q = aguinaldoSearch.toLowerCase();
      return (
        s.employee_name.toLowerCase().includes(q) ||
        (s.employee_ci && s.employee_ci.toLowerCase().includes(q)) ||
        (s.employee_cargo && s.employee_cargo.toLowerCase().includes(q)) ||
        (s.employee_code && String(s.employee_code).toLowerCase().includes(q))
      );
    });
  }, [aguinaldoData, aguinaldoSearch]);

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Selector de Pestañas: Boletas de Pago vs Boletas de Aguinaldo */}
      <div className="bg-white p-2 rounded-2xl shadow-sm border border-slate-200 flex flex-wrap gap-2">
        <button
          onClick={() => setBoletasTab('pago')}
          className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm transition-all ${
            boletasTab === 'pago'
              ? 'bg-teal-600 text-white shadow-md'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <FileText className="w-5 h-5" />
          Boletas de Pago
        </button>

        <button
          onClick={() => setBoletasTab('aguinaldo')}
          className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm transition-all ${
            boletasTab === 'aguinaldo'
              ? 'bg-teal-600 text-white shadow-md'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Gift className="w-5 h-5" />
          Boletas de Aguinaldo
        </button>
      </div>

      {/* ========================================================= */}
      {/* PESTAÑA 1: BOLETAS DE PAGO (EXISTENTE 100% INTACTA)       */}
      {/* ========================================================= */}
      {boletasTab === 'pago' && (
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
            <div>
              <h1 className="text-3xl font-bold text-slate-800 flex items-center gap-2">
                <FileText className="text-teal-600 w-8 h-8" />
                Boletas de Pago
              </h1>
              <p className="text-slate-500 mt-1">Generación y visualización de papeletas individuales mensuales.</p>
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

          {/* Buscador y Controles */}
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="relative w-full md:w-96">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
              <input 
                type="text" 
                placeholder="Buscar por nombre, código o CI..." 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 font-medium text-slate-700 shadow-sm"
              />
            </div>
            
            {payroll && (
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-slate-500">Total Boletas: {sortedPayslips.length}</span>
                {payroll.is_closed ? (
                  <span className="flex items-center gap-1 text-xs font-bold bg-slate-800 text-white px-3 py-1.5 rounded-xl shadow-sm">
                    <CheckCircle className="w-3.5 h-3.5" /> Mes Cerrado
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200 px-3 py-1.5 rounded-xl shadow-sm">
                    <Unlock className="w-3.5 h-3.5" /> Mes Abierto
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Tabla de Boletas */}
          {payroll && (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-900 text-white border-b border-slate-700">
                      <th className="p-4 font-semibold text-center w-12">N°</th>
                      <th className="p-4 font-semibold">Empleado</th>
                      <th className="p-4 font-semibold hidden md:table-cell">Cargo</th>
                      <th className="p-4 font-semibold text-right text-teal-400">Total Ganado</th>
                      <th className="p-4 font-semibold text-right text-rose-400">Total Desc.</th>
                      <th className="p-4 font-semibold text-right text-emerald-400">Líquido Pagable</th>
                      <th className="p-4 font-semibold text-center">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedPayslips
                      .filter(s => 
                        s.employee_name.toLowerCase().includes(search.toLowerCase()) || 
                        s.employee_ci.includes(search) ||
                        (s.employee_code && s.employee_code.toLowerCase().includes(search.toLowerCase()))
                      )
                      .map((slip, i) => (
                        <tr key={slip.id} className="border-b border-slate-100 hover:bg-slate-50 transition">
                          <td className="p-4 text-center font-bold text-slate-700">{i + 1}</td>
                          <td className="p-4">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-teal-800 bg-teal-50 border border-teal-200 px-2 py-0.5 rounded-md">
                                Cód. {slip.employee_code || slip.employee_id}
                              </span>
                              <p className="font-bold text-slate-900">{slip.employee_name}</p>
                              {slip.employee_is_active === false && (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200 flex items-center gap-1 shadow-sm">
                                  <UserX className="w-3 h-3" /> Desvinculado
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-slate-500 mt-0.5">CI: {slip.employee_ci ? slip.employee_ci.replace(/\s*-\s*/, ' ') : ''}</p>
                          </td>
                          <td className="p-4 text-slate-600 hidden md:table-cell">{slip.employee_cargo}</td>
                          <td className="p-4 text-right font-bold text-teal-700">{formatBs(slip.total_ganado)}</td>
                          <td className="p-4 text-right font-bold text-rose-600">{formatBs(slip.total_descuentos)}</td>
                          <td className="p-4 text-right font-black text-emerald-600 text-base">{formatBs(slip.liquido_pagable)}</td>
                          <td className="p-4 text-center flex justify-center gap-2">
                            <button 
                              onClick={() => handleOpenBoleta(slip)}
                              className="p-2 text-teal-600 bg-teal-50 rounded-lg hover:bg-teal-600 hover:text-white transition"
                              title="Ver Papeleta"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            {!payroll.is_closed ? (
                              <button 
                                onClick={() => handleOpenEdit(slip)}
                                className="p-2 text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-600 hover:text-white transition"
                                title="Editar"
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                            ) : (
                              <span className="p-2 text-slate-400 bg-slate-100 rounded-lg cursor-not-allowed" title="Mes Cerrado">
                                <Lock className="w-4 h-4" />
                              </span>
                            )}
                            <button 
                              onClick={() => {
                                const url = `${getApiUrl()}/api/tenants/${tenantSchema}/payrolls/${month}/${year}/payslips/${slip.id}/export/pdf`;
                                window.open(url, '_blank');
                              }}
                              className="p-2 text-red-600 bg-red-50 rounded-lg hover:bg-red-600 hover:text-white transition"
                              title="Descargar PDF"
                            >
                              <FileText className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={() => {
                                const url = `${getApiUrl()}/api/tenants/${tenantSchema}/payrolls/${month}/${year}/payslips/${slip.id}/export/excel`;
                                window.open(url, '_blank');
                              }}
                              className="p-2 text-green-600 bg-green-50 rounded-lg hover:bg-green-600 hover:text-white transition"
                              title="Descargar Excel"
                            >
                              <FileSpreadsheet className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* PESTAÑA 2: BOLETAS DE AGUINALDO (IMAGEN 2)                */}
      {/* ========================================================= */}
      {boletasTab === 'aguinaldo' && (
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
            <div>
              <h1 className="text-3xl font-bold text-slate-800 flex items-center gap-2">
                <Gift className="text-teal-600 w-8 h-8" />
                Boletas de Aguinaldo
              </h1>
              <p className="text-slate-500 mt-1">Papeletas individuales de aguinaldo de navidad vinculadas a la planilla oficial.</p>
            </div>
            
            <div className="flex items-center gap-3 bg-white p-2 rounded-2xl shadow-sm border border-slate-200">
              <span className="text-xs font-bold text-slate-500 uppercase ml-2">Año:</span>
              <input 
                type="number" 
                value={aguinaldoYear}
                onChange={(e) => setAguinaldoYear(Number(e.target.value))}
                className="w-28 bg-slate-50 border-none outline-none text-slate-900 font-semibold px-4 py-2 rounded-xl focus:ring-2 focus:ring-teal-500"
              />
              <button 
                onClick={fetchAguindos => fetchAguinaldos()}
                disabled={aguinaldoLoading}
                className="bg-teal-500 text-white px-6 py-2 rounded-xl font-bold shadow-md hover:bg-teal-600 transition flex items-center gap-2"
              >
                {aguinaldoLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
                Cargar Boletas
              </button>
            </div>
          </div>

          {/* Buscador y Exportación Masiva */}
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="relative w-full md:w-96">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
              <input 
                type="text" 
                placeholder="Buscar empleado de aguinaldo..." 
                value={aguinaldoSearch}
                onChange={(e) => setAguinaldoSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 font-medium text-slate-700 shadow-sm"
              />
            </div>
            
            <div className="flex gap-2">
              <button 
                onClick={() => handleExportAguinaldoBatch("pdf")}
                className="flex items-center gap-2 px-4 py-2.5 bg-red-600 text-white font-bold text-sm rounded-xl hover:bg-red-700 shadow-sm transition"
              >
                <FileText className="w-4 h-4" /> Exportar Todas a PDF (2 por hoja)
              </button>
              <button 
                onClick={() => handleExportAguinaldoBatch("excel")}
                className="flex items-center gap-2 px-4 py-2.5 bg-green-600 text-white font-bold text-sm rounded-xl hover:bg-green-700 shadow-sm transition"
              >
                <FileSpreadsheet className="w-4 h-4" /> Exportar Todas a Excel
              </button>
            </div>
          </div>

          {/* Tabla de Papeletas de Aguinaldo */}
          {aguinaldoData && (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-900 text-white border-b border-slate-700">
                      <th className="p-4 font-semibold text-center w-12">N°</th>
                      <th className="p-4 font-semibold">Empleado</th>
                      <th className="p-4 font-semibold">Cargo</th>
                      <th className="p-4 font-semibold text-center">Fecha Ingreso</th>
                      <th className="p-4 font-semibold text-center">Nro. Meses</th>
                      <th className="p-4 font-semibold text-right text-emerald-400">Líquido Pagable (Bs.)</th>
                      <th className="p-4 font-semibold text-center">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAguinaldoSlips.map((slip, idx) => (
                      <tr key={slip.id} className="border-b border-slate-100 hover:bg-slate-50 transition">
                        <td className="p-4 text-center font-bold text-slate-700">{idx + 1}</td>
                        <td className="p-4">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-teal-800 bg-teal-50 border border-teal-200 px-2 py-0.5 rounded-md">
                              Cód. {slip.employee_code || slip.employee_id}
                            </span>
                            <p className="font-bold text-slate-900">{slip.employee_name}</p>
                          </div>
                          <p className="text-xs text-slate-500 mt-0.5">CI: {slip.employee_ci}</p>
                        </td>
                        <td className="p-4 text-slate-600 uppercase font-medium">{slip.employee_cargo}</td>
                        <td className="p-4 text-center text-slate-600">{formatDate(slip.employee_fecha_ingreso)}</td>
                        <td className="p-4 text-center font-bold text-slate-700">{slip.meses_trabajados}</td>
                        <td className="p-4 text-right font-black text-emerald-600 text-base">{formatBs(slip.total_aguinaldo)}</td>
                        <td className="p-4 text-center flex justify-center gap-2">
                          <button 
                            onClick={() => handleOpenAguinaldoPreview(slip, idx + 1)}
                            className="p-2 text-teal-600 bg-teal-50 rounded-lg hover:bg-teal-600 hover:text-white transition"
                            title="Ver Papeleta de Aguinaldo"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => handleExportAguinaldoSingle(slip.id, "pdf")}
                            className="p-2 text-red-600 bg-red-50 rounded-lg hover:bg-red-600 hover:text-white transition"
                            title="Descargar PDF"
                          >
                            <FileText className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => handleExportAguinaldoSingle(slip.id, "excel")}
                            className="p-2 text-green-600 bg-green-50 rounded-lg hover:bg-green-600 hover:text-white transition"
                            title="Descargar Excel"
                          >
                            <FileSpreadsheet className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                    {filteredAguinaldoSlips.length === 0 && (
                      <tr>
                        <td colSpan={7} className="p-8 text-center text-slate-500">No se encontraron papeletas de aguinaldo para mostrar.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: PREVISUALIZAR PAPELETA DE AGUINALDO (IMAGEN 2)     */}
      {/* ========================================================= */}
      <AnimatePresence>
        {aguinaldoModalOpen && selectedAguinaldoSlip && aguinaldoData && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }} 
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" 
              onClick={() => setAguinaldoModalOpen(false)} 
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }} 
              animate={{ opacity: 1, scale: 1 }} 
              exit={{ opacity: 0, scale: 0.95 }} 
              className="relative w-full max-w-3xl bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col"
            >
              {/* Header Modal */}
              <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <Gift className="text-teal-600 w-5 h-5" />
                  <h3 className="font-bold text-slate-800">Previsualización de Papeleta de Aguinaldo</h3>
                </div>
                <button onClick={() => setAguinaldoModalOpen(false)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5"/></button>
              </div>

              {/* Contenedor Papeleta en Hoja Estilo Impresión (Idéntica a Imagen 2) */}
              <div className="p-8 bg-slate-100/70 overflow-y-auto max-h-[75vh] flex justify-center">
                <div className="w-full max-w-2xl bg-white border border-black p-6 font-sans text-xs text-black shadow-md">
                  
                  {/* Fila 1: Empresa y N° Papeleta */}
                  <div className="flex justify-between items-start mb-4">
                    <div className="font-bold text-sm tracking-wide uppercase">
                      {aguinaldoData.tenant_name}
                    </div>
                    <div className="border border-black px-3 py-1 text-xs font-bold">
                      Papeleta : &nbsp; {aguinaldoSlipIndex}
                    </div>
                  </div>

                  {/* Título Central */}
                  <div className="text-center my-4">
                    <h2 className="text-lg font-bold underline tracking-wide">PAPELETA DE AGUINALDO</h2>
                    <p className="text-xs font-bold mt-1">AGUINALDO CORRESPONDIENTE AL PERIODO : &nbsp; {aguinaldoData.year}</p>
                  </div>

                  <div className="border-b border-black mb-4"></div>

                  {/* Datos del Empleado */}
                  <div className="grid grid-cols-2 gap-y-2 gap-x-4 mb-16 text-xs font-bold">
                    <div className="flex">
                      <span className="w-24 shrink-0">CODIGO :</span>
                      <span className="font-normal">{selectedAguinaldoSlip.employee_code || selectedAguinaldoSlip.employee_id}</span>
                    </div>
                    <div className="flex">
                      <span className="w-24 shrink-0">NOMBRE :</span>
                      <span className="font-normal uppercase">{selectedAguinaldoSlip.employee_name}</span>
                    </div>
                    <div className="flex">
                      <span className="w-24 shrink-0">CARGO :</span>
                      <span className="font-normal uppercase">{selectedAguinaldoSlip.employee_cargo}</span>
                    </div>
                    <div className="flex">
                      <span className="w-32 shrink-0">NRO. DE MESES :</span>
                      <span className="font-normal">{selectedAguinaldoSlip.meses_trabajados}</span>
                    </div>
                    <div className="flex col-span-2">
                      <span className="w-32 shrink-0">FECHA INGRESO :</span>
                      <span className="font-normal">{formatDate(selectedAguinaldoSlip.employee_fecha_ingreso)}</span>
                    </div>
                  </div>

                  {/* Cuadro Líquido Pagable */}
                  <div className="flex border border-black mb-16 items-center">
                    <div className="border-r border-black p-2 font-bold whitespace-nowrap bg-slate-50/50">
                      LIQUIDO PAGABLE: &nbsp; {formatBs(selectedAguinaldoSlip.total_aguinaldo)}
                    </div>
                    <div className="p-2 font-normal italic uppercase text-[11px] flex-1">
                      {selectedAguinaldoSlip.total_aguinaldo_literal || getLeteral(selectedAguinaldoSlip.total_aguinaldo)}
                    </div>
                  </div>

                  {/* Firmas al pie */}
                  <div className="flex justify-between items-end mt-12 pt-4 px-6 text-center text-xs">
                    <div>
                      <div className="border-t border-dashed border-black w-48 mb-1"></div>
                      <span className="font-bold">RECIBI CONFORME</span>
                    </div>
                    <div>
                      <span className="font-bold uppercase block">{aguinaldoData.tenant_name}</span>
                    </div>
                  </div>

                </div>
              </div>

              {/* Acciones de exportación */}
              <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
                <button onClick={() => setAguinaldoModalOpen(false)} className="px-4 py-2 border border-slate-300 text-slate-700 rounded-xl font-bold hover:bg-slate-100 transition">
                  Cerrar
                </button>
                <button 
                  onClick={() => handleExportAguinaldoSingle(selectedAguinaldoSlip.id, "excel")} 
                  className="px-4 py-2 bg-green-600 text-white rounded-xl font-bold hover:bg-green-700 flex items-center gap-2 transition"
                >
                  <FileSpreadsheet className="w-4 h-4"/> Descargar Excel
                </button>
                <button 
                  onClick={() => handleExportAguinaldoSingle(selectedAguinaldoSlip.id, "pdf")} 
                  className="px-4 py-2 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 flex items-center gap-2 transition"
                >
                  <FileText className="w-4 h-4"/> Descargar PDF
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL: VER BOLETA DE PAGO MENSUAL (EXISTENTE) */}
      <AnimatePresence>
        {viewMode === 'boleta' && selectedPayslip && payroll && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
             <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setViewMode(null)} />
             <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative w-full max-w-2xl bg-white rounded-2xl shadow-xl overflow-hidden flex flex-col">
                <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                  <h3 className="font-bold text-slate-800">Previsualización de Boleta</h3>
                  <button onClick={() => setViewMode(null)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5"/></button>
                </div>
                
                <div className="p-6 overflow-y-auto max-h-[75vh]">
                   <div className="w-full bg-white border border-black p-4 font-sans text-xs text-black">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <p className="font-bold text-sm uppercase">{payroll.tenant_name || "EMPRESA"}</p>
                          <p>N° Patronal: {payroll.tenant_nro_patronal || "---"}</p>
                        </div>
                        <div className="border border-black px-2 py-1 flex items-center gap-2">
                          <span className="font-bold">N°:</span>
                          <span className="font-bold">{selectedPayslip.employee_code || selectedPayslip.employee_id}</span>
                        </div>
                      </div>

                      <h2 className="text-center text-xl font-bold underline mb-4">PAPELETA DE PAGO</h2>
                      
                      <div className="flex justify-between mb-4 border-b border-black pb-2 font-bold">
                        <span>MES {MONTHS[payroll.month-1]}</span>
                        <span>AÑO {payroll.year}</span>
                        <span>FECHA {(() => {
                          const lastDay = new Date(payroll.year, payroll.month, 0).getDate();
                          return `${String(lastDay).padStart(2, '0')}/${String(payroll.month).padStart(2, '0')}/${payroll.year}`;
                        })()}</span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 mb-4 font-bold">
                        <div>CODIGO : <span className="font-normal">{selectedPayslip.employee_code || selectedPayslip.employee_id}</span></div>
                        <div>NOMBRE : <span className="font-normal uppercase">{selectedPayslip.employee_name}</span></div>
                        <div>CARGO : <span className="font-normal uppercase">{selectedPayslip.employee_cargo}</span></div>
                        <div>FECHA INGRESO : <span className="font-normal">{formatDate(selectedPayslip.employee_fecha_ingreso)}</span></div>
                        <div className="col-span-2 text-right">SALDO I.V.A. : <span className="font-normal">0.00</span></div>
                      </div>

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

                      <div className="flex font-bold border border-black mb-4 bg-gray-100/50">
                        <div className="w-1/2 p-2 flex justify-between border-r border-black">
                          <span>TOTAL GANADO</span><span>{formatBs(selectedPayslip.total_ganado)}</span>
                        </div>
                        <div className="w-1/2 p-2 flex justify-between">
                          <span>TOTAL DESCUENTOS</span><span>{formatBs(selectedPayslip.total_descuentos)}</span>
                        </div>
                      </div>

                      <div className="flex border border-black p-2 font-bold mb-16">
                        <span className="w-48 shrink-0">LIQUIDO PAGABLE:</span>
                        <span className="text-lg w-32 shrink-0 border-r border-black">{formatBs(selectedPayslip.liquido_pagable)}</span>
                        <span className="pl-4 font-normal italic w-full uppercase">*** {getLeteral(selectedPayslip.liquido_pagable)} ***</span>
                      </div>

                      <div className="flex justify-between mt-12 px-8 text-center">
                        <div className="border-t border-dashed border-black w-64 pt-1">Verificado Contabilidad/Gerencia</div>
                        <div className="border-t border-dashed border-black w-64 pt-1 uppercase">{selectedPayslip.employee_name}</div>
                      </div>
                   </div>
                </div>

                <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-2">
                   <button onClick={() => setViewMode(null)} className="px-4 py-2 rounded-xl text-slate-700 font-bold hover:bg-slate-200 transition">Cerrar</button>
                   <button 
                     onClick={() => {
                        const url = `${getApiUrl()}/api/tenants/${tenantSchema}/payrolls/${month}/${year}/payslips/${selectedPayslip.id}/export/excel`;
                        window.open(url, '_blank');
                     }} 
                     className="px-4 py-2 bg-green-600 text-white rounded-xl font-bold hover:bg-green-700 flex items-center gap-2 transition"
                   >
                      <FileSpreadsheet className="w-4 h-4"/> Excel
                   </button>
                   <button 
                     onClick={() => {
                        const url = `${getApiUrl()}/api/tenants/${tenantSchema}/payrolls/${month}/${year}/payslips/${selectedPayslip.id}/export/pdf`;
                        window.open(url, '_blank');
                     }} 
                     className="px-4 py-2 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 flex items-center gap-2 transition"
                   >
                      <FileText className="w-4 h-4"/> PDF
                   </button>
                </div>
             </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL: EDITAR VALORES SUELDOS (EXISTENTE) */}
      <AnimatePresence>
        {viewMode === 'edit' && selectedPayslip && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
             <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setViewMode(null)} />
             <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden">
                <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                  <h3 className="font-bold text-slate-800">Modificar Planilla: {selectedPayslip.employee_name}</h3>
                  <button onClick={() => setViewMode(null)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5"/></button>
                </div>
                <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
                   <div>
                     <label className="block text-sm font-semibold text-slate-700 mb-1">Días Pagados</label>
                     <input type="number" value={editForm.dias_pagados} onChange={e => setEditForm({...editForm, dias_pagados: Number(e.target.value)})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 font-semibold text-slate-900 focus:ring-2 focus:ring-teal-500" />
                   </div>
                   <div>
                     <label className="block text-sm font-semibold text-slate-700 mb-1">Horas Pagadas (Día)</label>
                     <input type="number" value={editForm.horas_pagadas} onChange={e => setEditForm({...editForm, horas_pagadas: Number(e.target.value)})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 font-semibold text-slate-900 focus:ring-2 focus:ring-teal-500" />
                   </div>
                   <div>
                     <label className="block text-sm font-semibold text-slate-700 mb-1">Bono de Producción (Bs.)</label>
                     <input type="number" step="0.01" value={editForm.bono_produccion} onChange={e => setEditForm({...editForm, bono_produccion: Number(e.target.value)})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 font-semibold text-slate-900 focus:ring-2 focus:ring-teal-500" />
                   </div>
                   <div>
                     <label className="block text-sm font-semibold text-slate-700 mb-1">Subsidio de Frontera (Bs.)</label>
                     <input type="number" step="0.01" value={editForm.subsidio_frontera} onChange={e => setEditForm({...editForm, subsidio_frontera: Number(e.target.value)})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 font-semibold text-slate-900 focus:ring-2 focus:ring-teal-500" />
                   </div>
                   <div>
                     <label className="block text-sm font-semibold text-slate-700 mb-1">Horas Extras / Extraordinario (Bs.)</label>
                     <input type="number" step="0.01" value={editForm.trabajo_extraordinario} onChange={e => setEditForm({...editForm, trabajo_extraordinario: Number(e.target.value)})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 font-semibold text-slate-900 focus:ring-2 focus:ring-teal-500" />
                   </div>
                   <div>
                     <label className="block text-sm font-semibold text-slate-700 mb-1">Pago Dominical (Bs.)</label>
                     <input type="number" step="0.01" value={editForm.pago_dominical} onChange={e => setEditForm({...editForm, pago_dominical: Number(e.target.value)})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 font-semibold text-slate-900 focus:ring-2 focus:ring-teal-500" />
                   </div>
                   <div>
                     <label className="block text-sm font-semibold text-slate-700 mb-1">Otros Bonos (Bs.)</label>
                     <input type="number" step="0.01" value={editForm.otros_bonos} onChange={e => setEditForm({...editForm, otros_bonos: Number(e.target.value)})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 font-semibold text-slate-900 focus:ring-2 focus:ring-teal-500" />
                   </div>
                   <div>
                     <label className="block text-sm font-semibold text-slate-700 mb-1">Subsidio Natalidad (Bs.)</label>
                     <input type="number" step="0.01" value={editForm.subsidio_natalidad} onChange={e => setEditForm({...editForm, subsidio_natalidad: Number(e.target.value)})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 font-semibold text-slate-900 focus:ring-2 focus:ring-teal-500" />
                   </div>
                   <div className="border-t border-slate-100 pt-3">
                     <label className="block text-sm font-semibold text-slate-700 mb-1">Anticipos (Bs.)</label>
                     <input type="number" step="0.01" value={editForm.anticipos} onChange={e => setEditForm({...editForm, anticipos: Number(e.target.value)})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 font-semibold text-slate-900 focus:ring-2 focus:ring-teal-500" />
                   </div>
                   <div>
                     <label className="block text-sm font-semibold text-slate-700 mb-1">Otros Descuentos (Bs.)</label>
                     <input type="number" step="0.01" value={editForm.otros_descuentos} onChange={e => setEditForm({...editForm, otros_descuentos: Number(e.target.value)})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 font-semibold text-slate-900 focus:ring-2 focus:ring-teal-500" />
                   </div>
                </div>
                <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-2">
                   <button onClick={() => setViewMode(null)} className="px-4 py-2 rounded-xl text-slate-700 font-bold hover:bg-slate-200 transition">Cancelar</button>
                   <button onClick={handleSaveEdit} disabled={saving} className="bg-teal-500 text-white px-6 py-2 rounded-xl font-bold shadow-md hover:bg-teal-600 transition flex items-center gap-2">
                      {saving ? <Loader2 className="w-4 h-4 animate-spin"/> : "Guardar Cambios"}
                   </button>
                </div>
             </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default function BoletasPage() {
  return (
    <Suspense fallback={<div className="flex justify-center p-12"><div className="w-8 h-8 border-4 border-teal-500 border-t-transparent rounded-full animate-spin"></div></div>}>
      <BoletasPageContent />
    </Suspense>
  );
}
