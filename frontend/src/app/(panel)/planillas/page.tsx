"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Calculator, 
  Search, 
  Loader2, 
  Download, 
  Edit, 
  Eye, 
  X, 
  FileText, 
  FileSpreadsheet, 
  File, 
  Plus, 
  Minus, 
  Lock, 
  Unlock, 
  CheckCircle, 
  UserX,
  Building2,
  Gift,
  Building,
  Save,
  ChevronDown,
  ChevronUp
} from "lucide-react";
import { getApiUrl } from "@/utils/api";

// --- INTERFACES: SUELDOS Y SALARIOS (EXISTENTE) ---
interface Payslip {
  id: number;
  payroll_id: number;
  employee_id: number;
  employee_code?: string;
  employee_name: string;
  employee_ci: string;
  employee_cargo: string;
  employee_fecha_ingreso: string;
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

// --- INTERFACES: PLANILLA PATRONAL (IMAGEN 1) ---
interface PatronalDetail {
  id: number;
  employee_id: number;
  employee_code?: string;
  employee_name: string;
  employee_ci?: string;
  employee_cargo?: string;
  total_ganado: number;
  cns: number;
  afp: number;
  fonvi: number;
  aps: number;
  total_aportes: number;
  provision_aguinaldo: number;
  provision_indemnizacion: number;
  total_provisiones: number;
  total_carga_patronal: number;
  is_customized: boolean;
}

interface PatronalPayrollData {
  month: number;
  year: number;
  tenant_name: string;
  tenant_nro_patronal: string;
  tenant_nit: string;
  tenant_ciudad: string;
  details: PatronalDetail[];
  totals: {
    total_ganado: number;
    cns: number;
    afp: number;
    fonvi: number;
    aps: number;
    total_aportes: number;
    provision_aguinaldo: number;
    provision_indemnizacion: number;
    total_provisiones: number;
    total_carga_patronal: number;
  };
}

// --- INTERFACES: PLANILLA DE AGUINALDOS (IMAGEN 3) ---
interface AguinaldoSlip {
  id: number;
  aguinaldo_payroll_id: number;
  employee_id: number;
  employee_code?: string;
  employee_ci?: string;
  employee_name: string;
  employee_nacionalidad?: string;
  employee_fecha_nacimiento?: string;
  employee_sexo?: string;
  employee_cargo?: string;
  employee_fecha_ingreso?: string;
  haber_basico: number;
  bono_antiguedad: number;
  bono_produccion: number;
  subsidio_frontera: number;
  trabajo_extraordinario: number;
  pago_dominical: number;
  otros_bonos: number;
  promedio_total_ganado: number;
  meses_trabajados: number;
  total_aguinaldo: number;
  total_aguinaldo_literal?: string;
  is_customized: boolean;
}

interface AguinaldoPayrollData {
  id: number;
  year: number;
  is_closed: boolean;
  tenant_name: string;
  tenant_nro_patronal: string;
  tenant_nit: string;
  tenant_empleador_nombres?: string;
  tenant_empleador_apellido_paterno?: string;
  tenant_empleador_apellido_materno?: string;
  tenant_empleador_ci?: string;
  slips: AguinaldoSlip[];
  totals: {
    haber_basico: number;
    bono_antiguedad: number;
    bono_produccion: number;
    subsidio_frontera: number;
    trabajo_extraordinario: number;
    pago_dominical: number;
    otros_bonos: number;
    promedio_total_ganado: number;
    meses_trabajados: number;
    total_aguinaldo: number;
  };
}

const MONTHS = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
];

function PlanillasPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const tenantSchema = searchParams.get("tenant");

  // Pestaña activa principal
  const [activeTab, setActiveTab] = useState<'sueldos' | 'patronal' | 'aguinaldos'>('sueldos');
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    setIsAdmin(localStorage.getItem("isAdmin") === "true");
  }, []);

  useEffect(() => {
    if (!tenantSchema) {
      router.push("/seleccionar-empresa");
    }
  }, [tenantSchema, router]);

  const formatBs = (val: number) => Number(val || 0).toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "--/--/----";
    const [y, m, d] = dateStr.split("-");
    if (!m || !d) return dateStr;
    return `${d}/${m}/${y}`;
  };

  // ==========================================
  // ESTADO Y MÉTODOS: PLANILLA DE SUELDOS (INTACTA)
  // ==========================================
  const [month, setMonth] = useState<number>(new Date().getMonth() + 1);
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [payroll, setPayroll] = useState<PayrollData | null>(null);
  const [loading, setLoading] = useState(false);

  const [selectedPayslip, setSelectedPayslip] = useState<Payslip | null>(null);
  const [viewMode, setViewMode] = useState<'boleta' | 'edit' | null>(null);
  const [expandedSlips, setExpandedSlips] = useState<number[]>([]);
  const [editForm, setEditForm] = useState<any>({});
  const [saving, setSaving] = useState(false);

  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [showReopenModal, setShowReopenModal] = useState(false);
  const [reopening, setReopening] = useState(false);

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

  const handleExportPlanilla = (format: 'pdf' | 'excel') => {
    if (!tenantSchema || !month || !year) return;
    const url = `${getApiUrl()}/api/tenants/${tenantSchema}/payrolls/${month}/${year}/export/${format}`;
    window.open(url, '_blank');
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
      const res = await fetch(`${getApiUrl()}/api/tenants/${tenantSchema}/payrolls/${month}/${year}/payslips/${selectedPayslip.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm)
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

  // ==========================================
  // ESTADO Y MÉTODOS: PLANILLA PATRONAL (NUEVA)
  // ==========================================
  const [patronalMonth, setPatronalMonth] = useState<number>(new Date().getMonth() + 1);
  const [patronalYear, setPatronalYear] = useState<number>(new Date().getFullYear());
  const [patronalData, setPatronalData] = useState<PatronalPayrollData | null>(null);
  const [patronalLoading, setPatronalLoading] = useState(false);
  const [selectedPatronalSlip, setSelectedPatronalSlip] = useState<PatronalDetail | null>(null);
  const [editPatronalModal, setEditPatronalModal] = useState(false);
  const [patronalEditForm, setPatronalEditForm] = useState({
    provision_aguinaldo: 0,
    provision_indemnizacion: 0,
    cns: 0,
    afp: 0,
    fonvi: 0,
    aps: 0,
    total_ganado: 0
  });
  const [savingPatronal, setSavingPatronal] = useState(false);

  const fetchPatronal = async () => {
    if (!tenantSchema) return;
    setPatronalLoading(true);
    try {
      const res = await fetch(`${getApiUrl()}/api/tenants/${tenantSchema}/patronal/${patronalMonth}/${patronalYear}`);
      if (res.ok) {
        const data = await res.json();
        setPatronalData(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setPatronalLoading(false);
    }
  };

  const handleOpenPatronalEdit = (detail: PatronalDetail) => {
    setSelectedPatronalSlip(detail);
    setPatronalEditForm({
      provision_aguinaldo: Number(detail.provision_aguinaldo),
      provision_indemnizacion: Number(detail.provision_indemnizacion),
      cns: Number(detail.cns),
      afp: Number(detail.afp),
      fonvi: Number(detail.fonvi),
      aps: Number(detail.aps),
      total_ganado: Number(detail.total_ganado)
    });
    setEditPatronalModal(true);
  };

  const handleSavePatronalEdit = async () => {
    if (!selectedPatronalSlip || !tenantSchema) return;
    setSavingPatronal(true);
    try {
      const res = await fetch(
        `${getApiUrl()}/api/tenants/${tenantSchema}/patronal/${patronalMonth}/${patronalYear}/slips/${selectedPatronalSlip.id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patronalEditForm)
        }
      );
      if (res.ok) {
        const updated = await res.json();
        if (patronalData) {
          const updatedDetails = patronalData.details.map(d => d.id === updated.id ? updated : d);
          // Recalcular totales
          const newTotals = updatedDetails.reduce((acc, curr) => ({
            total_ganado: acc.total_ganado + Number(curr.total_ganado),
            cns: acc.cns + Number(curr.cns),
            afp: acc.afp + Number(curr.afp),
            fonvi: acc.fonvi + Number(curr.fonvi),
            aps: acc.aps + Number(curr.aps),
            total_aportes: acc.total_aportes + Number(curr.total_aportes),
            provision_aguinaldo: acc.provision_aguinaldo + Number(curr.provision_aguinaldo),
            provision_indemnizacion: acc.provision_indemnizacion + Number(curr.provision_indemnizacion),
            total_provisiones: acc.total_provisiones + Number(curr.total_provisiones),
            total_carga_patronal: acc.total_carga_patronal + Number(curr.total_carga_patronal),
          }), {
            total_ganado: 0, cns: 0, afp: 0, fonvi: 0, aps: 0,
            total_aportes: 0, provision_aguinaldo: 0, provision_indemnizacion: 0,
            total_provisiones: 0, total_carga_patronal: 0
          });

          setPatronalData({
            ...patronalData,
            details: updatedDetails,
            totals: newTotals
          });
        }
        setEditPatronalModal(false);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSavingPatronal(false);
    }
  };

  const handleExportPatronal = (format: 'pdf' | 'excel') => {
    if (!tenantSchema) return;
    const url = `${getApiUrl()}/api/tenants/${tenantSchema}/patronal/${patronalMonth}/${patronalYear}/export/${format}`;
    window.open(url, '_blank');
  };

  // ==========================================
  // ESTADO Y MÉTODOS: PLANILLA DE AGUINALDOS (NUEVA)
  // ==========================================
  const [aguinaldoYear, setAguinaldoYear] = useState<number>(new Date().getFullYear());
  const [aguinaldoData, setAguinaldoData] = useState<AguinaldoPayrollData | null>(null);
  const [aguinaldoLoading, setAguinaldoLoading] = useState(false);
  const [selectedAguinaldoSlip, setSelectedAguinaldoSlip] = useState<AguinaldoSlip | null>(null);
  const [editAguinaldoModal, setEditAguinaldoModal] = useState(false);
  const [aguinaldoEditForm, setAguinaldoEditForm] = useState({
    haber_basico: 0,
    bono_antiguedad: 0,
    bono_produccion: 0,
    subsidio_frontera: 0,
    trabajo_extraordinario: 0,
    pago_dominical: 0,
    otros_bonos: 0,
    meses_trabajados: 12
  });
  const [savingAguinaldo, setSavingAguinaldo] = useState(false);
  const [expandedAguinaldoSlips, setExpandedAguinaldoSlips] = useState<number[]>([]);

  const toggleExpandAguinaldo = (id: number) => {
    setExpandedAguinaldoSlips(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const toggleExpandAllAguinaldo = () => {
    if (!aguinaldoData) return;
    if (expandedAguinaldoSlips.length === aguinaldoData.slips.length) {
      setExpandedAguinaldoSlips([]);
    } else {
      setExpandedAguinaldoSlips(aguinaldoData.slips.map(s => s.id));
    }
  };

  const fetchAguinaldo = async () => {
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

  const handleOpenAguinaldoEdit = (slip: AguinaldoSlip) => {
    setSelectedAguinaldoSlip(slip);
    setAguinaldoEditForm({
      haber_basico: Number(slip.haber_basico),
      bono_antiguedad: Number(slip.bono_antiguedad),
      bono_produccion: Number(slip.bono_produccion),
      subsidio_frontera: Number(slip.subsidio_frontera),
      trabajo_extraordinario: Number(slip.trabajo_extraordinario),
      pago_dominical: Number(slip.pago_dominical),
      otros_bonos: Number(slip.otros_bonos),
      meses_trabajados: Number(slip.meses_trabajados)
    });
    setEditAguinaldoModal(true);
  };

  const handleSaveAguinaldoEdit = async () => {
    if (!selectedAguinaldoSlip || !tenantSchema) return;
    setSavingAguinaldo(true);
    try {
      const res = await fetch(
        `${getApiUrl()}/api/tenants/${tenantSchema}/aguinaldos/${aguinaldoYear}/slips/${selectedAguinaldoSlip.id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(aguinaldoEditForm)
        }
      );
      if (res.ok) {
        const updated = await res.json();
        if (aguinaldoData) {
          const updatedSlips = aguinaldoData.slips.map(s => s.id === updated.id ? updated : s);
          const newTotals = updatedSlips.reduce((acc, curr) => ({
            haber_basico: acc.haber_basico + Number(curr.haber_basico),
            bono_antiguedad: acc.bono_antiguedad + Number(curr.bono_antiguedad),
            bono_produccion: acc.bono_produccion + Number(curr.bono_produccion),
            subsidio_frontera: acc.subsidio_frontera + Number(curr.subsidio_frontera),
            trabajo_extraordinario: acc.trabajo_extraordinario + Number(curr.trabajo_extraordinario),
            pago_dominical: acc.pago_dominical + Number(curr.pago_dominical),
            otros_bonos: acc.otros_bonos + Number(curr.otros_bonos),
            promedio_total_ganado: acc.promedio_total_ganado + Number(curr.promedio_total_ganado),
            meses_trabajados: acc.meses_trabajados + Number(curr.meses_trabajados),
            total_aguinaldo: acc.total_aguinaldo + Number(curr.total_aguinaldo),
          }), {
            haber_basico: 0, bono_antiguedad: 0, bono_produccion: 0, subsidio_frontera: 0,
            trabajo_extraordinario: 0, pago_dominical: 0, otros_bonos: 0,
            promedio_total_ganado: 0, meses_trabajados: 0, total_aguinaldo: 0
          });

          setAguinaldoData({
            ...aguinaldoData,
            slips: updatedSlips,
            totals: newTotals
          });
        }
        setEditAguinaldoModal(false);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSavingAguinaldo(false);
    }
  };

  const handleExportAguinaldo = (format: 'pdf' | 'excel') => {
    if (!tenantSchema) return;
    const url = `${getApiUrl()}/api/tenants/${tenantSchema}/aguinaldos/${aguinaldoYear}/export/${format}`;
    window.open(url, '_blank');
  };

  // Carga inicial según pestaña
  useEffect(() => {
    if (activeTab === 'sueldos' && !payroll) {
      fetchPayroll();
    } else if (activeTab === 'patronal' && !patronalData) {
      fetchPatronal();
    } else if (activeTab === 'aguinaldos' && !aguinaldoData) {
      fetchAguinaldo();
    }
  }, [activeTab]);

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* NAVEGACIÓN INTUITIVA POR PESTAÑAS */}
      <div className="bg-white p-2 rounded-2xl shadow-sm border border-slate-200 flex flex-wrap gap-2">
        <button
          onClick={() => setActiveTab('sueldos')}
          className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm transition-all ${
            activeTab === 'sueldos'
              ? 'bg-teal-600 text-white shadow-md'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Calculator className="w-5 h-5" />
          Planilla de Sueldos y Salarios
        </button>

        <button
          onClick={() => setActiveTab('patronal')}
          className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm transition-all ${
            activeTab === 'patronal'
              ? 'bg-teal-600 text-white shadow-md'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Building2 className="w-5 h-5" />
          Planilla Patronal
        </button>

        <button
          onClick={() => setActiveTab('aguinaldos')}
          className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm transition-all ${
            activeTab === 'aguinaldos'
              ? 'bg-teal-600 text-white shadow-md'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Gift className="w-5 h-5" />
          Planilla de Aguinaldos
        </button>
      </div>

      {/* ========================================================= */}
      {/* VISTA 1: PLANILLA DE SUELDOS Y SALARIOS (100% INTACTA)      */}
      {/* ========================================================= */}
      {activeTab === 'sueldos' && (
        <div className="space-y-6">
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

          {payroll && (
            <div className="bg-white rounded-[2rem] shadow-sm border border-slate-100 overflow-hidden flex flex-col">
              <div className="p-4 border-b border-slate-100 bg-slate-50 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="flex items-center gap-3">
                  <h2 className="font-bold text-slate-900">Planilla Correspondiente al Mes de {MONTHS[payroll.month-1].toUpperCase()} {payroll.year}</h2>
                  {payroll.is_closed ? (
                    <span className="bg-slate-800 text-white text-xs font-bold px-3 py-1.5 rounded-xl flex items-center gap-1.5 shadow-sm">
                      <CheckCircle className="w-4 h-4 text-emerald-400" /> Mes Cerrado (Bloqueado)
                    </span>
                  ) : (
                    <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold px-3 py-1.5 rounded-xl flex items-center gap-1.5 shadow-sm">
                      <Unlock className="w-4 h-4 text-emerald-600" /> Mes Abierto (En Edición)
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap gap-2 items-center">
                   {payroll.is_closed ? (
                     <button 
                       onClick={() => setShowReopenModal(true)} 
                       className="flex items-center gap-2 px-4 py-2 text-sm bg-amber-600 text-white border border-amber-700 rounded-xl hover:bg-amber-700 transition shadow-md font-bold"
                       title="Reabrir mes para permitir edición"
                     >
                       <Unlock className="w-4 h-4" /> Reabrir Mes
                     </button>
                   ) : (
                     <button 
                       onClick={() => setShowConfirmModal(true)} 
                       className="flex items-center gap-2 px-4 py-2 text-sm bg-rose-600 text-white border border-rose-700 rounded-xl hover:bg-rose-700 transition shadow-md font-bold"
                       title="Cerrar y bloquear mes para edición y seguridad de la información"
                     >
                       <Lock className="w-4 h-4" /> Cerrar Mes
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
                    {sortedPayslips.map((slip, i) => {
                      const isExpanded = expandedSlips.includes(slip.id);
                      return (
                        <React.Fragment key={slip.id}>
                          <tr className={`border-b border-slate-200 transition bg-white hover:bg-slate-50 cursor-pointer ${isExpanded ? 'bg-slate-50 border-l-4 border-l-teal-500' : ''}`} onClick={() => toggleExpand(slip.id)}>
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
                              {!payroll.is_closed ? (
                                <button onClick={(e) => { e.stopPropagation(); handleOpenEdit(slip); }} className="p-2 text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-600 hover:text-white transition-colors" title="Editar Valores">
                                  <Edit className="w-4 h-4" />
                                </button>
                              ) : (
                                <span className="p-2 text-slate-400 bg-slate-100 rounded-lg cursor-not-allowed" title="Mes cerrado / ineditable">
                                  <Lock className="w-4 h-4" />
                                </span>
                              )}
                              <button onClick={(e) => { e.stopPropagation(); toggleExpand(slip.id); }} className={`p-2 rounded-lg transition-colors ${isExpanded ? 'bg-slate-800 text-white' : 'text-slate-600 bg-slate-100 hover:bg-slate-200'}`} title="Ver Detalles">
                                <Eye className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                          <AnimatePresence>
                            {isExpanded && (
                              <tr>
                                <td colSpan={7} className="p-0 bg-slate-50 border-b-2 border-slate-200">
                                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                                    <div className="p-4 md:p-6 grid grid-cols-1 md:grid-cols-3 gap-4">
                                      <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
                                        <h4 className="text-slate-800 font-bold mb-4 flex items-center gap-2"><Calculator className="w-5 h-5 text-slate-400" /> Datos y Asistencia</h4>
                                        <div className="space-y-2 text-sm">
                                          <div className="flex justify-between border-b border-slate-50 pb-1"><span className="text-slate-500">Fecha Ingreso:</span><span className="font-semibold text-slate-800">{slip.employee_fecha_ingreso}</span></div>
                                          <div className="flex justify-between border-b border-slate-50 pb-1"><span className="text-slate-500">Días Pagados:</span><span className="font-semibold text-slate-800">{slip.dias_pagados}</span></div>
                                          <div className="flex justify-between pb-1"><span className="text-slate-500">Horas Pagadas:</span><span className="font-semibold text-slate-800">{slip.horas_pagadas > 24 ? Math.round(slip.horas_pagadas / (slip.dias_pagados || 30)) : slip.horas_pagadas}</span></div>
                                        </div>
                                      </div>
                                      
                                      <div className="bg-teal-50/30 p-5 rounded-2xl shadow-sm border border-teal-100">
                                        <h4 className="text-teal-800 font-bold mb-4 flex items-center gap-2"><Plus className="w-5 h-5 text-teal-500" /> Ingresos</h4>
                                        <div className="space-y-2 text-sm">
                                          <div className="flex justify-between border-b border-teal-100/50 pb-1"><span className="text-teal-700/80">Haber Básico:</span><span className="font-semibold text-teal-900">{formatBs(slip.haber_basico)}</span></div>
                                          <div className="flex justify-between border-b border-teal-100/50 pb-1"><span className="text-teal-700/80">Bono Antigüedad:</span><span className="font-semibold text-teal-900">{formatBs(slip.bono_antiguedad)}</span></div>
                                          <div className="flex justify-between border-b border-teal-100/50 pb-1"><span className="text-teal-700/80">Horas Extra:</span><span className="font-semibold text-teal-900">{formatBs(slip.trabajo_extraordinario)}</span></div>
                                          <div className="flex justify-between pb-1"><span className="text-teal-700/80">Otros Bonos:</span><span className="font-semibold text-teal-900">{formatBs(Number(slip.bono_produccion) + Number(slip.subsidio_frontera) + Number(slip.pago_dominical) + Number(slip.otros_bonos) + Number(slip.subsidio_natalidad || 0))}</span></div>
                                        </div>
                                      </div>

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
                        <td colSpan={7} className="p-12 text-center text-slate-500 font-medium">No hay empleados registrados para este periodo.</td>
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
      {/* VISTA 2: PLANILLA PATRONAL (SEGÚN IMAGEN 1)                */}
      {/* ========================================================= */}
      {activeTab === 'patronal' && (
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
            <div>
              <h1 className="text-3xl font-bold text-slate-800 flex items-center gap-2">
                <Building2 className="text-teal-600 w-8 h-8" />
                Planilla Patronal
              </h1>
              <p className="text-slate-600 mt-1">Aportes patronales (17.21%) y provisiones sociales (Aguinaldo e Indemnización).</p>
            </div>
            
            <div className="flex items-center gap-3 bg-white p-2 rounded-2xl shadow-sm border border-slate-200">
              <select 
                value={patronalMonth} 
                onChange={(e) => setPatronalMonth(Number(e.target.value))}
                className="bg-slate-50 border-none outline-none text-slate-900 font-semibold px-4 py-2 rounded-xl focus:ring-2 focus:ring-teal-500"
              >
                {MONTHS.map((m, i) => (
                  <option key={i+1} value={i+1}>{m}</option>
                ))}
              </select>
              <input 
                type="number" 
                value={patronalYear}
                onChange={(e) => setPatronalYear(Number(e.target.value))}
                className="w-24 bg-slate-50 border-none outline-none text-slate-900 font-semibold px-4 py-2 rounded-xl focus:ring-2 focus:ring-teal-500"
              />
              <button 
                onClick={fetchPatronal}
                disabled={patronalLoading}
                className="bg-teal-500 text-white px-6 py-2 rounded-xl font-bold shadow-md hover:bg-teal-600 transition flex items-center gap-2"
              >
                {patronalLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
                Cargar Patronal
              </button>
            </div>
          </div>

          {patronalData && (
            <div className="bg-white rounded-[2rem] shadow-sm border border-slate-100 overflow-hidden flex flex-col">
              {/* Header Info Documento */}
              <div className="p-6 border-b border-slate-100 bg-slate-50 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">{patronalData.tenant_name}</h3>
                  <p className="text-xs text-slate-500">{patronalData.tenant_ciudad}</p>
                  <p className="text-sm font-semibold text-teal-800 mt-1">
                    Planilla Patronal Correspondiente al mes de {MONTHS[patronalData.month - 1]} {patronalData.year}
                  </p>
                </div>
                <div className="flex flex-col md:items-end gap-2">
                  <div className="text-xs text-slate-600 flex gap-4">
                    <span><strong>N° Patronal:</strong> {patronalData.tenant_nro_patronal}</span>
                    <span><strong>N° N.I.T.:</strong> {patronalData.tenant_nit}</span>
                  </div>
                  <div className="flex gap-2 mt-1">
                    <button onClick={() => handleExportPatronal("excel")} className="flex items-center gap-2 px-3 py-1.5 text-sm bg-green-50 text-green-700 border border-green-200 rounded-lg hover:bg-green-100 transition font-semibold">
                      <FileSpreadsheet className="w-4 h-4" /> Excel
                    </button>
                    <button onClick={() => handleExportPatronal("pdf")} className="flex items-center gap-2 px-3 py-1.5 text-sm bg-red-50 text-red-700 border border-red-200 rounded-lg hover:bg-red-100 transition font-semibold">
                      <FileText className="w-4 h-4" /> PDF
                    </button>
                  </div>
                </div>
              </div>

              {/* Tabla Patronal idéntica a Imagen 1 */}
              <div className="overflow-x-auto w-full pb-4 custom-scrollbar">
                <table className="w-full text-xs text-left border-collapse min-w-full">
                  <thead>
                    <tr className="bg-[#7E4842] text-white border-b border-[#6A3C37]">
                      <th className="p-3 text-center w-10">No</th>
                      <th className="p-3">NOMBRES Y APELLIDOS<br/><span className="text-[10px] font-normal opacity-80">CARGO</span></th>
                      <th className="p-3 text-right">TOTAL<br/>GANADO</th>
                      <th className="p-3 text-right">CNS<br/>10%</th>
                      <th className="p-3 text-right">AFP's<br/>1,71%</th>
                      <th className="p-3 text-right">FONVI<br/>2%</th>
                      <th className="p-3 text-right">APS<br/>3.5%</th>
                      <th className="p-3 text-right bg-[#6E3C36] font-bold">TOTAL<br/>APORTES</th>
                      <th className="p-3 text-right">PROVISÓN<br/>AGUINALDO</th>
                      <th className="p-3 text-right">PROVISÓN<br/>INDEMNIZ</th>
                      <th className="p-3 text-right bg-[#6E3C36] font-bold">TOTAL<br/>PROVISIONES</th>
                      <th className="p-3 text-right bg-[#5A2C27] font-bold text-amber-200">TOTAL CARGA<br/>PATRONAL</th>
                      <th className="p-3 text-center">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {patronalData.details.map((slip, i) => (
                      <tr key={slip.id} className="border-b border-slate-200 hover:bg-slate-50 transition">
                        <td className="p-3 text-center font-bold text-slate-700">{i + 1}</td>
                        <td className="p-3">
                          <p className="font-bold text-slate-900">{slip.employee_name}</p>
                          <p className="text-[10px] text-slate-500 uppercase">{slip.employee_cargo || "General"}</p>
                        </td>
                        <td className="p-3 text-right font-semibold text-slate-800">{formatBs(slip.total_ganado)}</td>
                        <td className="p-3 text-right text-slate-600">{formatBs(slip.cns)}</td>
                        <td className="p-3 text-right text-slate-600">{formatBs(slip.afp)}</td>
                        <td className="p-3 text-right text-slate-600">{formatBs(slip.fonvi)}</td>
                        <td className="p-3 text-right text-slate-600">{formatBs(slip.aps)}</td>
                        <td className="p-3 text-right font-bold text-slate-900 bg-amber-50/40">{formatBs(slip.total_aportes)}</td>
                        <td className="p-3 text-right text-slate-600">{formatBs(slip.provision_aguinaldo)}</td>
                        <td className="p-3 text-right text-slate-600">{formatBs(slip.provision_indemnizacion)}</td>
                        <td className="p-3 text-right font-bold text-slate-900 bg-amber-50/40">{formatBs(slip.total_provisiones)}</td>
                        <td className="p-3 text-right font-black text-teal-800 bg-teal-50/60 text-sm">{formatBs(slip.total_carga_patronal)}</td>
                        <td className="p-3 text-center">
                          <button 
                            onClick={() => handleOpenPatronalEdit(slip)}
                            className="p-1.5 text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-600 hover:text-white transition"
                            title="Editar Cargas y Provisiones"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                    {patronalData.details.length === 0 && (
                      <tr>
                        <td colSpan={13} className="p-8 text-center text-slate-500">No hay registros patronales para este periodo.</td>
                      </tr>
                    )}
                  </tbody>
                  {/* Fila de TOTALES (Azul/Pizarra idéntica a Imagen 1) */}
                  <tfoot>
                    <tr className="bg-[#2C3E50] text-white font-bold">
                      <td colSpan={2} className="p-3.5 text-center tracking-widest text-sm uppercase">T O T A L E S</td>
                      <td className="p-3.5 text-right">{formatBs(patronalData.totals.total_ganado)}</td>
                      <td className="p-3.5 text-right">{formatBs(patronalData.totals.cns)}</td>
                      <td className="p-3.5 text-right">{formatBs(patronalData.totals.afp)}</td>
                      <td className="p-3.5 text-right">{formatBs(patronalData.totals.fonvi)}</td>
                      <td className="p-3.5 text-right">{formatBs(patronalData.totals.aps)}</td>
                      <td className="p-3.5 text-right text-amber-200">{formatBs(patronalData.totals.total_aportes)}</td>
                      <td className="p-3.5 text-right">{formatBs(patronalData.totals.provision_aguinaldo)}</td>
                      <td className="p-3.5 text-right">{formatBs(patronalData.totals.provision_indemnizacion)}</td>
                      <td className="p-3.5 text-right text-amber-200">{formatBs(patronalData.totals.total_provisiones)}</td>
                      <td className="p-3.5 text-right text-emerald-300 text-sm">{formatBs(patronalData.totals.total_carga_patronal)}</td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* VISTA 3: PLANILLA DE AGUINALDOS (SEGÚN IMAGEN 3)          */}
      {/* ========================================================= */}
      {activeTab === 'aguinaldos' && (
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
            <div>
              <h1 className="text-3xl font-bold text-slate-800 flex items-center gap-2">
                <Gift className="text-teal-600 w-8 h-8" />
                Planilla de Pago de Aguinaldo de Navidad
              </h1>
              <p className="text-slate-600 mt-1">Formato Oficial del Ministerio de Trabajo de Bolivia (Promedios y Duodécimas).</p>
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
                onClick={fetchAguinaldo}
                disabled={aguinaldoLoading}
                className="bg-teal-500 text-white px-6 py-2 rounded-xl font-bold shadow-md hover:bg-teal-600 transition flex items-center gap-2"
              >
                {aguinaldoLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
                Cargar Aguinaldos
              </button>
            </div>
          </div>

          {aguinaldoData && (
            <div className="bg-white rounded-[2rem] shadow-sm border border-slate-100 overflow-hidden flex flex-col">
              {/* Encabezado Ministerial Imagen 3 */}
              <div className="p-6 border-b border-slate-200 bg-slate-50 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
                <div className="space-y-1.5 text-xs text-black">
                  <div>
                    <span className="font-extrabold text-black">NOMBRE O RAZÓN SOCIAL:</span>{" "}
                    <span className="font-bold text-black uppercase">{aguinaldoData.tenant_name}</span>
                  </div>
                  <div>
                    <span className="font-extrabold text-black">N° EMPLEADOR MINISTERIO DE TRABAJO:</span>{" "}
                    <span className="font-bold text-black">{aguinaldoData.tenant_nit}</span>
                  </div>
                  <div>
                    <span className="font-extrabold text-black">N° DE NIT:</span>{" "}
                    <span className="font-bold text-black">{aguinaldoData.tenant_nit}</span> |{" "}
                    <span className="font-extrabold text-black">N° DE EMPLEADOR (Caja de Salud):</span>{" "}
                    <span className="font-bold text-black">{aguinaldoData.tenant_nro_patronal || "350-1-2177"}</span>
                  </div>
                  <p className="text-xs font-black text-black uppercase mt-2 tracking-wide">
                    CORRESPONDIENTE AL MES DE DICIEMBRE DE {aguinaldoData.year}
                  </p>
                </div>
                
                {/* Herramientas de Vista y Exportación */}
                <div className="flex flex-wrap items-center gap-2">
                  <button 
                    onClick={toggleExpandAllAguinaldo}
                    className="flex items-center gap-2 px-3.5 py-2 text-sm bg-slate-200 text-slate-800 border border-slate-300 rounded-xl hover:bg-slate-300 transition font-bold shadow-sm"
                    title={expandedAguinaldoSlips.length === aguinaldoData.slips.length ? 'Colapsar todos los desgloses' : 'Ver todos los desgloses ministeriales'}
                  >
                    <Eye className="w-4 h-4" />
                    {expandedAguinaldoSlips.length === aguinaldoData.slips.length ? 'Colapsar Todo' : 'Expandir Desgloses'}
                  </button>

                  <button onClick={() => handleExportAguinaldo("excel")} className="flex items-center gap-2 px-3.5 py-2 text-sm bg-green-50 text-green-800 border border-green-300 rounded-xl hover:bg-green-100 transition font-bold shadow-sm">
                    <FileSpreadsheet className="w-4 h-4 text-green-700" /> Excel
                  </button>
                  <button onClick={() => handleExportAguinaldo("pdf")} className="flex items-center gap-2 px-3.5 py-2 text-sm bg-red-50 text-red-800 border border-red-300 rounded-xl hover:bg-red-100 transition font-bold shadow-sm">
                    <FileText className="w-4 h-4 text-red-700" /> PDF
                  </button>
                </div>
              </div>

              {/* Tarjetas Resumen de Planilla de Aguinaldos */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-teal-50/40 border-b border-teal-100">
                <div className="bg-white p-3.5 rounded-xl border border-teal-200/80 shadow-sm flex items-center justify-between">
                  <div>
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Total Aguinaldo a Desembolsar</span>
                    <div className="text-xl font-black text-emerald-900 mt-0.5">
                      {formatBs(aguinaldoData.totals.total_aguinaldo)} Bs.
                    </div>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
                    <Gift className="w-5 h-5" />
                  </div>
                </div>

                <div className="bg-white p-3.5 rounded-xl border border-teal-200/80 shadow-sm flex items-center justify-between">
                  <div>
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Trabajadores Beneficiarios</span>
                    <div className="text-xl font-black text-slate-900 mt-0.5">
                      {aguinaldoData.slips.length} Empleados
                    </div>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-teal-100 text-teal-800 flex items-center justify-center font-bold text-sm">
                    100%
                  </div>
                </div>

                <div className="bg-white p-3.5 rounded-xl border border-teal-200/80 shadow-sm flex items-center justify-between">
                  <div>
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Promedio Aguinaldo por Trabajador</span>
                    <div className="text-xl font-black text-teal-900 mt-0.5">
                      {formatBs(aguinaldoData.slips.length ? aguinaldoData.totals.total_aguinaldo / aguinaldoData.slips.length : 0)} Bs.
                    </div>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-800 flex items-center justify-center font-bold">
                    <Calculator className="w-5 h-5" />
                  </div>
                </div>
              </div>

              {/* Tabla de Aguinaldos Adaptada a Pantalla (Sin Scroll Horizontal) */}
              <div className="w-full">
                  <table className="w-full text-xs text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-900 text-white border-b border-slate-700">
                        <th className="p-3 text-center w-10">N°</th>
                        <th className="p-3 text-left">EMPLEADO / DATOS GENERALES</th>
                        <th className="p-3 text-right">Promedio Haber<br/>Básico (A)</th>
                        <th className="p-3 text-right">Promedio Bono<br/>Antigüedad (B)</th>
                        <th className="p-3 text-right">Otros Bonos<br/>Promedio (C a G)</th>
                        <th className="p-3 text-right font-bold text-teal-300">Promedio Total<br/>Ganado (H)</th>
                        <th className="p-3 text-center font-bold w-20">Meses<br/>Trabajados (I)</th>
                        <th className="p-3 text-right font-bold text-emerald-400">Total Aguinaldo<br/>a Pagar (J)</th>
                        <th className="p-3 text-center w-28">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {aguinaldoData.slips.map((slip, idx) => {
                        const isExpanded = expandedAguinaldoSlips.includes(slip.id);
                        const otrosBonosSum = Number(slip.bono_produccion) + 
                                              Number(slip.subsidio_frontera) + 
                                              Number(slip.trabajo_extraordinario) + 
                                              Number(slip.pago_dominical) + 
                                              Number(slip.otros_bonos);

                        return (
                          <React.Fragment key={slip.id}>
                            <tr 
                              onClick={() => toggleExpandAguinaldo(slip.id)}
                              className={`border-b border-slate-200 hover:bg-teal-50/40 transition cursor-pointer ${
                                isExpanded ? 'bg-slate-50 border-l-4 border-l-teal-600' : 'bg-white'
                              }`}
                            >
                              <td className="p-3 text-center font-bold text-black">{idx + 1}</td>
                              <td className="p-3 text-left">
                                <div className="flex flex-col">
                                  <div className="flex items-center gap-2">
                                    <span className="font-black text-black text-sm uppercase">{slip.employee_name}</span>
                                  </div>
                                  <div className="flex items-center gap-2 text-[11px] font-bold text-slate-800 mt-0.5">
                                    <span className="bg-slate-100 text-black px-1.5 py-0.5 rounded border border-slate-300">
                                      CI: {slip.employee_ci}
                                    </span>
                                    <span className="text-teal-900 font-extrabold uppercase">{slip.employee_cargo}</span>
                                  </div>
                                  <div className="text-[10px] text-slate-700 font-medium mt-0.5 flex flex-wrap gap-2">
                                    <span>Ingreso: <strong>{formatDate(slip.employee_fecha_ingreso)}</strong></span>
                                    <span>•</span>
                                    <span>Nac: <strong>{formatDate(slip.employee_fecha_nacimiento)}</strong> ({slip.employee_sexo || 'M'})</span>
                                    <span>•</span>
                                    <span><strong>{slip.employee_nacionalidad || 'BOLIVIANA'}</strong></span>
                                  </div>
                                </div>
                              </td>
                              <td className="p-3 text-right font-bold text-black whitespace-nowrap">{formatBs(slip.haber_basico)}</td>
                              <td className="p-3 text-right font-bold text-black whitespace-nowrap">{formatBs(slip.bono_antiguedad)}</td>
                              <td className="p-3 text-right font-bold text-black whitespace-nowrap">
                                <div>{formatBs(otrosBonosSum)}</div>
                                {otrosBonosSum > 0 && (
                                  <span className="text-[10px] font-extrabold text-blue-700 bg-blue-50 px-1 py-0.5 rounded border border-blue-200">
                                    Bonos Adicionales
                                  </span>
                                )}
                              </td>
                              <td className="p-3 text-right whitespace-nowrap">
                                <span className="font-black text-black bg-slate-100 px-2.5 py-1 rounded-lg">
                                  {formatBs(slip.promedio_total_ganado)}
                                </span>
                              </td>
                              <td className="p-3 text-center font-black text-black text-sm whitespace-nowrap">
                                {slip.meses_trabajados}
                              </td>
                              <td className="p-3 text-right whitespace-nowrap">
                                <span className="font-black text-emerald-950 bg-emerald-100/90 border border-emerald-300 rounded-xl px-2.5 py-1.5 text-xs shadow-sm block text-right">
                                  {formatBs(slip.total_aguinaldo)} Bs.
                                </span>
                              </td>
                              <td className="p-3 text-center" onClick={(e) => e.stopPropagation()}>
                                <div className="flex items-center justify-center gap-1.5">
                                  <button
                                    onClick={() => toggleExpandAguinaldo(slip.id)}
                                    className="p-1.5 text-teal-700 bg-teal-50 border border-teal-200 rounded-lg hover:bg-teal-600 hover:text-white transition shadow-sm"
                                    title={isExpanded ? 'Ocultar desglose' : 'Ver desglose ministerial'}
                                  >
                                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                  </button>
                                  <button 
                                    onClick={() => handleOpenAguinaldoEdit(slip)}
                                    className="p-1.5 text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-600 hover:text-white transition shadow-sm"
                                    title="Editar Promedios y Duodécimas"
                                  >
                                    <Edit className="w-4 h-4" />
                                  </button>
                                </div>
                              </td>
                            </tr>

                            {/* FILA EXPANDIDA CON EL DESGLOSE COMPLETO MINISTERIAL */}
                            {isExpanded && (
                              <tr className="bg-slate-50 border-b-2 border-teal-500">
                                <td colSpan={9} className="p-4 pl-8 lg:pl-12 bg-gradient-to-r from-teal-50/50 via-slate-50 to-white">
                                  <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-slate-100 pb-3">
                                      <div>
                                        <h4 className="font-black text-black text-sm flex items-center gap-2">
                                          <Gift className="w-4 h-4 text-teal-600" />
                                          Desglose Detallado Ministerial (Promedios Sep - Oct - Nov)
                                        </h4>
                                        <p className="text-xs text-slate-700 font-semibold mt-0.5">
                                          Empleado: <span className="font-extrabold text-black uppercase">{slip.employee_name}</span> | CI: <span className="font-bold text-black">{slip.employee_ci}</span>
                                        </p>
                                      </div>
                                      <button
                                        onClick={() => handleOpenAguinaldoEdit(slip)}
                                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-600 hover:text-white transition"
                                      >
                                        <Edit className="w-3.5 h-3.5" /> Editar Valores
                                      </button>
                                    </div>

                                    {/* Cuadrícula de los 7 componentes de promedios */}
                                    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5">
                                      <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                                        <span className="text-[10px] font-bold text-slate-600 uppercase block">(A) Haber Básico</span>
                                        <span className="text-xs font-black text-black mt-1 block">{formatBs(slip.haber_basico)} Bs.</span>
                                      </div>
                                      <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                                        <span className="text-[10px] font-bold text-slate-600 uppercase block">(B) Bono Antigüedad</span>
                                        <span className="text-xs font-black text-black mt-1 block">{formatBs(slip.bono_antiguedad)} Bs.</span>
                                      </div>
                                      <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                                        <span className="text-[10px] font-bold text-slate-600 uppercase block">(C) Bono Producción</span>
                                        <span className="text-xs font-black text-black mt-1 block">{formatBs(slip.bono_produccion)} Bs.</span>
                                      </div>
                                      <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                                        <span className="text-[10px] font-bold text-slate-600 uppercase block">(D) Subsidio Frontera</span>
                                        <span className="text-xs font-black text-black mt-1 block">{formatBs(slip.subsidio_frontera)} Bs.</span>
                                      </div>
                                      <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                                        <span className="text-[10px] font-bold text-slate-600 uppercase block">(E) Extraordinario</span>
                                        <span className="text-xs font-black text-black mt-1 block">{formatBs(slip.trabajo_extraordinario)} Bs.</span>
                                      </div>
                                      <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                                        <span className="text-[10px] font-bold text-slate-600 uppercase block">(F) Pago Dominical</span>
                                        <span className="text-xs font-black text-black mt-1 block">{formatBs(slip.pago_dominical)} Bs.</span>
                                      </div>
                                      <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                                        <span className="text-[10px] font-bold text-slate-600 uppercase block">(G) Otros Bonos</span>
                                        <span className="text-xs font-black text-black mt-1 block">{formatBs(slip.otros_bonos)} Bs.</span>
                                      </div>
                                    </div>

                                    {/* Cuadro de Resumen de Cálculo Oficial */}
                                    <div className="p-3 bg-teal-50 border border-teal-200 rounded-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
                                      <div className="text-xs text-teal-950 font-bold space-y-1">
                                        <div>
                                          <span className="text-teal-800 font-extrabold uppercase">(H) Promedio Total Ganado:</span>{" "}
                                          <span className="text-black font-black text-sm">{formatBs(slip.promedio_total_ganado)} Bs.</span>
                                        </div>
                                        <div className="text-slate-700 font-semibold text-[11px]">
                                          Fórmula de Ley: (Total Ganado Promedio ÷ 12) × {slip.meses_trabajados} Meses = <strong>{formatBs(slip.total_aguinaldo)} Bs.</strong>
                                        </div>
                                      </div>

                                      <div className="flex items-center gap-3 bg-white px-4 py-2 rounded-xl border border-teal-200 shadow-sm">
                                        <span className="text-xs font-extrabold text-slate-700">LÍQUIDO A PAGAR (J):</span>
                                        <span className="text-base font-black text-emerald-800">{formatBs(slip.total_aguinaldo)} Bs.</span>
                                      </div>
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })}
                      {aguinaldoData.slips.length === 0 && (
                        <tr>
                          <td colSpan={9} className="p-8 text-center font-bold text-black">No hay empleados habilitados para el aguinaldo de este año.</td>
                        </tr>
                      )}
                    </tbody>
                    <tfoot>
                      <tr className="bg-slate-900 text-white font-extrabold text-xs">
                        <td colSpan={2} className="p-3.5 text-center uppercase tracking-widest text-sm">TOTALES GENERALES</td>
                        <td className="p-3.5 text-right font-bold whitespace-nowrap">{formatBs(aguinaldoData.totals.haber_basico)}</td>
                        <td className="p-3.5 text-right font-bold whitespace-nowrap">{formatBs(aguinaldoData.totals.bono_antiguedad)}</td>
                        <td className="p-3.5 text-right font-bold whitespace-nowrap">{formatBs(
                          Number(aguinaldoData.totals.bono_produccion) +
                          Number(aguinaldoData.totals.subsidio_frontera) +
                          Number(aguinaldoData.totals.trabajo_extraordinario) +
                          Number(aguinaldoData.totals.pago_dominical) +
                          Number(aguinaldoData.totals.otros_bonos)
                        )}</td>
                        <td className="p-3.5 text-right text-teal-300 font-black whitespace-nowrap">{formatBs(aguinaldoData.totals.promedio_total_ganado)}</td>
                        <td className="p-3.5 text-center font-black whitespace-nowrap">{aguinaldoData.totals.meses_trabajados}</td>
                        <td className="p-3.5 text-right text-emerald-400 font-black text-sm whitespace-nowrap">{formatBs(aguinaldoData.totals.total_aguinaldo)}</td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: EDITAR VALORES SUELDOS (EXISTENTE)                 */}
      {/* ========================================================= */}
      <AnimatePresence>
        {viewMode === 'edit' && selectedPayslip && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
             <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setViewMode(null)} />
             <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden">
                <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                  <h3 className="font-bold text-slate-800">Modificar Planilla: {selectedPayslip.employee_name}</h3>
                  <button onClick={() => setViewMode(null)} className="text-slate-900 hover:text-slate-900"><X className="w-5 h-5"/></button>
                </div>
                <div className="p-6 space-y-4 bg-white max-h-[80vh] overflow-y-auto">
                   <div>
                     <label className="block text-sm font-semibold text-slate-900 mb-1">Bono de Producción (Bs.)</label>
                     <input type="number" step="0.01" value={editForm.bono_produccion} onChange={e => setEditForm({...editForm, bono_produccion: Number(e.target.value)})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 font-semibold text-slate-900 focus:ring-2 focus:ring-teal-500" />
                   </div>
                   <div>
                     <label className="block text-sm font-semibold text-slate-900 mb-1">Subsidio de Frontera (Bs.)</label>
                     <input type="number" step="0.01" value={editForm.subsidio_frontera} onChange={e => setEditForm({...editForm, subsidio_frontera: Number(e.target.value)})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 font-semibold text-slate-900 focus:ring-2 focus:ring-teal-500" />
                   </div>
                   <div>
                     <label className="block text-sm font-semibold text-slate-900 mb-1">Horas Extras / Extraordinario (Bs.)</label>
                     <input type="number" step="0.01" value={editForm.trabajo_extraordinario} onChange={e => setEditForm({...editForm, trabajo_extraordinario: Number(e.target.value)})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 font-semibold text-slate-900 focus:ring-2 focus:ring-teal-500" />
                   </div>
                   <div>
                     <label className="block text-sm font-semibold text-slate-900 mb-1">Pago Dominical (Bs.)</label>
                     <input type="number" step="0.01" value={editForm.pago_dominical} onChange={e => setEditForm({...editForm, pago_dominical: Number(e.target.value)})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 font-semibold text-slate-900 focus:ring-2 focus:ring-teal-500" />
                   </div>
                   <div>
                     <label className="block text-sm font-semibold text-slate-900 mb-1">Otros Bonos (Bs.)</label>
                     <input type="number" step="0.01" value={editForm.otros_bonos} onChange={e => setEditForm({...editForm, otros_bonos: Number(e.target.value)})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 font-semibold text-slate-900 focus:ring-2 focus:ring-teal-500" />
                   </div>
                   <div className="border-t border-slate-100 pt-3">
                     <label className="block text-sm font-semibold text-slate-900 mb-1">Anticipos (Bs.)</label>
                     <input type="number" step="0.01" value={editForm.anticipos} onChange={e => setEditForm({...editForm, anticipos: Number(e.target.value)})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 font-semibold text-slate-900 focus:ring-2 focus:ring-teal-500" />
                   </div>
                   <div>
                     <label className="block text-sm font-semibold text-slate-900 mb-1">Otros Descuentos (Bs.)</label>
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

      {/* ========================================================= */}
      {/* MODAL: EDITAR CARGAS Y PROVISIONES PATRONALES             */}
      {/* ========================================================= */}
      <AnimatePresence>
        {editPatronalModal && selectedPatronalSlip && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setEditPatronalModal(false)} />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative w-full max-w-lg bg-white rounded-2xl shadow-xl overflow-hidden">
              <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                <div>
                  <h3 className="font-bold text-slate-800">Modificar Carga Patronal</h3>
                  <p className="text-xs text-slate-500">{selectedPatronalSlip.employee_name}</p>
                </div>
                <button onClick={() => setEditPatronalModal(false)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5"/></button>
              </div>
              <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
                <div className="bg-teal-50/50 p-3 rounded-xl border border-teal-100">
                  <span className="text-xs font-semibold text-teal-800">Total Ganado Base:</span>
                  <div className="text-lg font-bold text-teal-900">{formatBs(patronalEditForm.total_ganado)} Bs.</div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">CNS (10%)</label>
                    <input 
                      type="number" 
                      step="0.01" 
                      value={patronalEditForm.cns} 
                      onChange={e => setPatronalEditForm({...patronalEditForm, cns: Number(e.target.value)})} 
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-semibold text-slate-900" 
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">AFP Riesgo (1.71%)</label>
                    <input 
                      type="number" 
                      step="0.01" 
                      value={patronalEditForm.afp} 
                      onChange={e => setPatronalEditForm({...patronalEditForm, afp: Number(e.target.value)})} 
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-semibold text-slate-900" 
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">FONVI (2%)</label>
                    <input 
                      type="number" 
                      step="0.01" 
                      value={patronalEditForm.fonvi} 
                      onChange={e => setPatronalEditForm({...patronalEditForm, fonvi: Number(e.target.value)})} 
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-semibold text-slate-900" 
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">APS Solidario (3.5%)</label>
                    <input 
                      type="number" 
                      step="0.01" 
                      value={patronalEditForm.aps} 
                      onChange={e => setPatronalEditForm({...patronalEditForm, aps: Number(e.target.value)})} 
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-semibold text-slate-900" 
                    />
                  </div>
                </div>

                <div className="border-t border-slate-100 pt-3">
                  <h4 className="text-xs font-bold text-slate-700 uppercase mb-2">Provisiones Sociales (8.33% c/u o personalizado)</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Provisión Aguinaldo (Bs.)</label>
                      <input 
                        type="number" 
                        step="0.01" 
                        value={patronalEditForm.provision_aguinaldo} 
                        onChange={e => setPatronalEditForm({...patronalEditForm, provision_aguinaldo: Number(e.target.value)})} 
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-semibold text-slate-900 focus:ring-2 focus:ring-teal-500" 
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Provisión Indemnización (Bs.)</label>
                      <input 
                        type="number" 
                        step="0.01" 
                        value={patronalEditForm.provision_indemnizacion} 
                        onChange={e => setPatronalEditForm({...patronalEditForm, provision_indemnizacion: Number(e.target.value)})} 
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-semibold text-slate-900 focus:ring-2 focus:ring-teal-500" 
                      />
                    </div>
                  </div>
                </div>
              </div>
              <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-2">
                <button onClick={() => setEditPatronalModal(false)} className="px-4 py-2 rounded-xl text-slate-700 font-bold hover:bg-slate-200 transition">Cancelar</button>
                <button onClick={handleSavePatronalEdit} disabled={savingPatronal} className="bg-teal-500 text-white px-6 py-2 rounded-xl font-bold shadow-md hover:bg-teal-600 transition flex items-center gap-2">
                  {savingPatronal ? <Loader2 className="w-4 h-4 animate-spin"/> : "Guardar Cambios"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================= */}
      {/* MODAL: EDITAR PROMEDIOS Y DUODÉCIMAS DE AGUINALDOS         */}
      {/* ========================================================= */}
      <AnimatePresence>
        {editAguinaldoModal && selectedAguinaldoSlip && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setEditAguinaldoModal(false)} />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative w-full max-w-lg bg-white rounded-2xl shadow-xl overflow-hidden">
              <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                <div>
                  <h3 className="font-bold text-slate-800">Modificar Aguinaldo</h3>
                  <p className="text-xs text-slate-500">{selectedAguinaldoSlip.employee_name}</p>
                </div>
                <button onClick={() => setEditAguinaldoModal(false)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5"/></button>
              </div>
              <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-black mb-1">Promedio Haber Básico (A)</label>
                    <input 
                      type="number" 
                      step="0.01" 
                      value={aguinaldoEditForm.haber_basico} 
                      onChange={e => setAguinaldoEditForm({...aguinaldoEditForm, haber_basico: Number(e.target.value)})} 
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-sm font-bold text-black focus:ring-2 focus:ring-teal-500" 
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-black mb-1">Promedio Bono Antigüedad (B)</label>
                    <input 
                      type="number" 
                      step="0.01" 
                      value={aguinaldoEditForm.bono_antiguedad} 
                      onChange={e => setAguinaldoEditForm({...aguinaldoEditForm, bono_antiguedad: Number(e.target.value)})} 
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-sm font-bold text-black focus:ring-2 focus:ring-teal-500" 
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-black mb-1">Promedio Bono Producción (C)</label>
                    <input 
                      type="number" 
                      step="0.01" 
                      value={aguinaldoEditForm.bono_produccion} 
                      onChange={e => setAguinaldoEditForm({...aguinaldoEditForm, bono_produccion: Number(e.target.value)})} 
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-sm font-bold text-black focus:ring-2 focus:ring-teal-500" 
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-black mb-1">Promedio Subsidio Frontera (D)</label>
                    <input 
                      type="number" 
                      step="0.01" 
                      value={aguinaldoEditForm.subsidio_frontera} 
                      onChange={e => setAguinaldoEditForm({...aguinaldoEditForm, subsidio_frontera: Number(e.target.value)})} 
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-sm font-bold text-black focus:ring-2 focus:ring-teal-500" 
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-black mb-1">Promedio Trabajo Extraordinario (E)</label>
                    <input 
                      type="number" 
                      step="0.01" 
                      value={aguinaldoEditForm.trabajo_extraordinario} 
                      onChange={e => setAguinaldoEditForm({...aguinaldoEditForm, trabajo_extraordinario: Number(e.target.value)})} 
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-sm font-bold text-black focus:ring-2 focus:ring-teal-500" 
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-black mb-1">Promedio Pago Dominical (F)</label>
                    <input 
                      type="number" 
                      step="0.01" 
                      value={aguinaldoEditForm.pago_dominical} 
                      onChange={e => setAguinaldoEditForm({...aguinaldoEditForm, pago_dominical: Number(e.target.value)})} 
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-sm font-bold text-black focus:ring-2 focus:ring-teal-500" 
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-black mb-1">Promedio Otros Bonos (G)</label>
                    <input 
                      type="number" 
                      step="0.01" 
                      value={aguinaldoEditForm.otros_bonos} 
                      onChange={e => setAguinaldoEditForm({...aguinaldoEditForm, otros_bonos: Number(e.target.value)})} 
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-sm font-bold text-black focus:ring-2 focus:ring-teal-500" 
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-black mb-1">Meses Trabajados (I)</label>
                    <input 
                      type="number" 
                      step="0.01" 
                      max="12"
                      min="0"
                      value={aguinaldoEditForm.meses_trabajados} 
                      onChange={e => setAguinaldoEditForm({...aguinaldoEditForm, meses_trabajados: Number(e.target.value)})} 
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-sm font-bold text-black focus:ring-2 focus:ring-teal-500" 
                    />
                  </div>
                </div>

                {/* Previsualización en vivo */}
                {(() => {
                  const h = Number(aguinaldoEditForm.haber_basico || 0) +
                            Number(aguinaldoEditForm.bono_antiguedad || 0) +
                            Number(aguinaldoEditForm.bono_produccion || 0) +
                            Number(aguinaldoEditForm.subsidio_frontera || 0) +
                            Number(aguinaldoEditForm.trabajo_extraordinario || 0) +
                            Number(aguinaldoEditForm.pago_dominical || 0) +
                            Number(aguinaldoEditForm.otros_bonos || 0);
                  const j = (h * Number(aguinaldoEditForm.meses_trabajados || 12)) / 12;
                  return (
                    <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-200 flex justify-between items-center">
                      <div>
                        <span className="text-xs font-bold text-emerald-800">Promedio Total Ganado (H):</span>
                        <div className="text-sm font-bold text-emerald-950">{formatBs(h)} Bs.</div>
                      </div>
                      <div className="text-right">
                        <span className="text-xs font-bold text-emerald-800">Aguinaldo a Pagar (J):</span>
                        <div className="text-lg font-black text-emerald-700">{formatBs(j)} Bs.</div>
                      </div>
                    </div>
                  );
                })()}
              </div>
              <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-2">
                <button onClick={() => setEditAguinaldoModal(false)} className="px-4 py-2 rounded-xl text-slate-700 font-bold hover:bg-slate-200 transition">Cancelar</button>
                <button onClick={handleSaveAguinaldoEdit} disabled={savingAguinaldo} className="bg-teal-500 text-white px-6 py-2 rounded-xl font-bold shadow-md hover:bg-teal-600 transition flex items-center gap-2">
                  {savingAguinaldo ? <Loader2 className="w-4 h-4 animate-spin"/> : "Guardar Cambios"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODALES CERRAR / REABRIR MES */}
      <AnimatePresence>
        {showConfirmModal && (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="bg-white rounded-2xl shadow-xl max-w-md w-full overflow-hidden">
              <div className="p-6">
                <div className="w-12 h-12 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mb-4">
                  <Lock className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-2">Cerrar y Bloquear Mes</h3>
                <p className="text-slate-600 mb-4 text-sm leading-relaxed">
                  ¿Estás seguro de que deseas <strong>cerrar y bloquear</strong> la planilla de {MONTHS[month - 1]} {year}?
                  Al cerrarla, los valores de haberes, horas extras, bonos y descuentos quedarán <strong>bloqueados para edición</strong> para garantizar la seguridad y control de la información.
                </p>
                <div className="flex justify-end gap-3 mt-6">
                  <button onClick={() => setShowConfirmModal(false)} className="px-4 py-2 border border-slate-300 text-slate-700 rounded-xl hover:bg-slate-50 transition font-semibold">
                    Cancelar
                  </button>
                  <button onClick={handleConfirmPayroll} disabled={confirming} className="px-4 py-2 bg-rose-600 text-white font-bold rounded-xl hover:bg-rose-700 flex items-center gap-2 transition disabled:opacity-50 shadow-md">
                    {confirming ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
                    Sí, Cerrar Mes
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showReopenModal && (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="bg-white rounded-2xl shadow-xl max-w-md w-full overflow-hidden">
              <div className="p-6">
                <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mb-4">
                  <Unlock className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-2">Reabrir Mes</h3>
                <p className="text-slate-600 mb-4 text-sm leading-relaxed">
                  ¿Estás seguro de que deseas <strong>reabrir el mes</strong> de {MONTHS[month - 1]} {year}?
                  Se habilitará nuevamente la edición de boletas, ingresos y descuentos para los usuarios autorizados.
                </p>
                <div className="flex justify-end gap-3 mt-6">
                  <button onClick={() => setShowReopenModal(false)} className="px-4 py-2 border border-slate-300 text-slate-700 rounded-xl hover:bg-slate-50 transition font-semibold">
                    Cancelar
                  </button>
                  <button onClick={handleReopenPayroll} disabled={reopening} className="px-4 py-2 bg-amber-600 text-white font-bold rounded-xl hover:bg-amber-700 flex items-center gap-2 transition disabled:opacity-50 shadow-md">
                    {reopening ? <Loader2 className="w-4 h-4 animate-spin" /> : <Unlock className="w-4 h-4" />}
                    Sí, Reabrir Mes
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
