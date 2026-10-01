"use client";

import React, { useState, useEffect, Suspense, useMemo } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  BookOpen,
  Calendar,
  Save,
  RotateCcw,
  Download,
  FileSpreadsheet,
  FileText,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  DollarSign,
  Building2,
  Sparkles,
  Edit3,
  Layers,
  HelpCircle,
  Briefcase,
  Users,
  Plus,
  Trash2,
  Lock,
  Unlock,
  Eye,
  CreditCard,
  Receipt,
  HeartPulse,
  Scale,
  ArrowRight,
  ShieldAlert,
  ChevronRight,
  Check,
  Building,
  History,
  X
} from "lucide-react";
import Swal from "sweetalert2";
import { getApiUrl } from "@/utils/api";
import { getStoredPeriod, setStoredPeriod } from "@/utils/period";

const MONTHS = [
  { id: 1, name: "Enero" },
  { id: 2, name: "Febrero" },
  { id: 3, name: "Marzo" },
  { id: 4, name: "Abril" },
  { id: 5, name: "Mayo" },
  { id: 6, name: "Junio" },
  { id: 7, name: "Julio" },
  { id: 8, name: "Agosto" },
  { id: 9, name: "Septiembre" },
  { id: 10, name: "Octubre" },
  { id: 11, name: "Noviembre" },
  { id: 12, name: "Diciembre" }
];

const CAJAS_SALUD_BOLIVIA = [
  "Caja Petrolera de Salud",
  "Caja Nacional de Salud"
];

interface NumericInputProps {
  value: number | undefined | null;
  onChange: (val: number) => void;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
}

/**
 * Componente de entrada numérica que permite borrar ceros y dejar el campo en blanco
 * sin forzar un "0" pegajoso mientras el usuario escribe o edita.
 */
function NumericInput({
  value,
  onChange,
  disabled = false,
  className = "",
  placeholder = "0.00"
}: NumericInputProps) {
  const [text, setText] = useState<string>(() => {
    if (value === undefined || value === null || value === 0) return "";
    return String(value);
  });
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    if (!isFocused) {
      if (value === undefined || value === null || value === 0) {
        setText("");
      } else {
        setText(String(value));
      }
    }
  }, [value, isFocused]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setText(raw);
    const parsed = raw === "" ? 0 : parseFloat(raw);
    onChange(isNaN(parsed) ? 0 : parsed);
  };

  const handleFocus = () => {
    setIsFocused(true);
    if (text === "0" || text === "0.00") {
      setText("");
    }
  };

  const handleBlur = () => {
    setIsFocused(false);
    if (text === "") {
      onChange(0);
    } else {
      const parsed = parseFloat(text);
      onChange(isNaN(parsed) ? 0 : parsed);
    }
  };

  return (
    <input
      type="number"
      step="0.01"
      disabled={disabled}
      placeholder={placeholder}
      value={text}
      onFocus={handleFocus}
      onChange={handleChange}
      onBlur={handleBlur}
      className={className}
    />
  );
}

interface PaymentExtraItem {
  id?: string;
  tipo: string; // 'interes' | 'actualizacion' | 'multa'
  concepto?: string;
  monto: number;
}

interface PendingSettlementPayment {
  id?: string;
  month_origen: number;
  year_origen: number;
  entidad: string;
  concepto?: string;
  monto_restante: number;
  monto_retenciones?: number;
  monto_patronal?: number;
  interes_mora: number;
  pagar_en_este_mes: boolean;
}

interface ImporteRestanteItem {
  id?: string;
  concepto?: string;
  monto: number;
  activo?: boolean;
  descuento_retenciones?: number;
  descuento_patronal?: number;
}

interface GestoraPaymentData {
  fecha?: string;
  nro_transaccion?: string;
  intereses: PaymentExtraItem[];
  importes_restantes?: ImporteRestanteItem[];
  importe_restante?: number;
  descuento_retenciones?: number;
  descuento_patronal?: number;
  pagos_restantes_anteriores?: PendingSettlementPayment[];
}

interface CajaPaymentData {
  caja_tipo: string;
  fecha?: string;
  nro_transaccion?: string;
  ajustes: PaymentExtraItem[];
  importes_restantes?: ImporteRestanteItem[];
  importe_restante?: number;
  pagos_restantes_anteriores?: PendingSettlementPayment[];
}

interface MinTrabajoPaymentData {
  fecha?: string;
  nro_transaccion?: string;
  ajustes: PaymentExtraItem[];
}

interface DepartmentPayrollItem {
  id?: number;
  nombre: string;
  sueldos: number;
  bono_antiguedad: number;
  total_depto: number;
}

interface DevengamientoData {
  departamentos?: DepartmentPayrollItem[];
  sueldos_adm: number;
  bono_antiguedad_adm: number;
  sueldos_mo: number;
  bono_antiguedad_mo: number;
  retenciones_ley: number;
  sueldos_por_pagar: number;
  arancel_min_trabajo: number;
  caja_salud_choice: string;
  patronal_gestora?: number;
  patronal_caja?: number;
  aguinaldo?: number;
  indemnizacion?: number;
}

interface AccountingEntryItem {
  cuenta: string;
  debe: number;
  haber: number;
  subcuentas?: string[] | null;
  tag?: string | null;
}

interface PaymentInfoSummary {
  fecha?: string;
  nro_transaccion?: string;
  monto_total: number;
  glosa?: string | null;
  tipo_entidad?: string;
}

interface AccountingMonthHistoryItem {
  month: number;
  year: number;
  month_name: string;
  has_data: boolean;
  is_customized: boolean;
  is_cuadrado: boolean;
  diferencia: number;
  total_debe: number;
  total_haber: number;
  total_ganado: number;
  patronal_total: number;
  beneficios_total: number;
  liquido_pagable: number;
  retenciones_ley: number;
  departamentos_count: number;
  pago_gestora?: PaymentInfoSummary | null;
  pago_caja?: PaymentInfoSummary | null;
  pago_min_trabajo?: PaymentInfoSummary | null;
  updated_at?: string | null;
}

interface AnnualHistoryResponse {
  year: number;
  tenant_name: string;
  months: AccountingMonthHistoryItem[];
  total_anual_debe: number;
  total_anual_haber: number;
  meses_registrados: number;
}

interface AccountingSection {
  glosa?: string | null;
  id: string;
  title: string;
  is_payment: boolean;
  payment_label?: string | null;
  items: AccountingEntryItem[];
  subtotal_debe: number;
  subtotal_haber: number;
  voucher_type?: string;
  fecha?: string | null;
}

interface AccountingSheetData {
  month: number;
  year: number;
  month_name: string;
  tenant_name: string;
  caja_banco_name: string;
  caja_salud_name: string;
  arancel_min_trabajo: number;
  devengamiento?: DevengamientoData;
  gestora_payment: GestoraPaymentData;
  caja_payment: CajaPaymentData;
  min_trabajo_payment: MinTrabajoPaymentData;
  sections: AccountingSection[];
  total_debe: number;
  total_haber: number;
  is_cuadrado: boolean;
  diferencia: number;
  has_payroll: boolean;
  payroll_id?: number | null;
  is_customized: boolean;
  is_locked_by_date: boolean;
  is_manually_unlocked: boolean;
  saldos_pendientes_gestora?: PendingSettlementPayment[];
  saldos_pendientes_caja?: PendingSettlementPayment[];
}

function AsientosPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const tenantSchema = searchParams.get("tenant");

  const [selectedMonth, setSelectedMonth] = useState<number>(() => {
    if (typeof window !== "undefined") {
      return getStoredPeriod().month;
    }
    return new Date().getMonth() + 1;
  });
  const [selectedYear, setSelectedYear] = useState<number>(() => {
    if (typeof window !== "undefined") {
      return getStoredPeriod().year;
    }
    return new Date().getFullYear();
  });

  const handleMonthChange = (newMonth: number) => {
    setSelectedMonth(newMonth);
    setStoredPeriod(newMonth, selectedYear, tenantSchema);
  };

  const handleYearChange = (newYear: number) => {
    setSelectedYear(newYear);
    setStoredPeriod(selectedMonth, newYear, tenantSchema);
  };
  const [sheetData, setSheetData] = useState<AccountingSheetData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<"guiado" | "oficial" | "historial">("guiado");
  const [historyData, setHistoryData] = useState<AnnualHistoryResponse | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [exportingMasterExcel, setExportingMasterExcel] = useState(false);
  const [exportingExcel, setExportingExcel] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);

  // Form state for guided editing
  const [devengamiento, setDevengamiento] = useState<DevengamientoData>({
    departamentos: [],
    sueldos_adm: 0,
    bono_antiguedad_adm: 0,
    sueldos_mo: 0,
    bono_antiguedad_mo: 0,
    retenciones_ley: 0,
    sueldos_por_pagar: 0,
    arancel_min_trabajo: 27.0,
    caja_salud_choice: "Caja Petrolera de Salud",
    patronal_gestora: undefined,
    patronal_caja: undefined,
    aguinaldo: undefined,
    indemnizacion: undefined
  });

  const [gestoraPayment, setGestoraPayment] = useState<GestoraPaymentData>({
    fecha: new Date().toISOString().split("T")[0],
    nro_transaccion: "",
    intereses: [],
    importes_restantes: [{ id: "ir_g_1", concepto: "", monto: 0, activo: true }],
    importe_restante: 0,
    descuento_retenciones: 0,
    descuento_patronal: 0,
    pagos_restantes_anteriores: []
  });

  const [cajaPayment, setCajaPayment] = useState<CajaPaymentData>({
    caja_tipo: "Caja Petrolera de Salud",
    fecha: new Date().toISOString().split("T")[0],
    nro_transaccion: "",
    ajustes: [],
    importes_restantes: [{ id: "ir_c_1", concepto: "", monto: 0, activo: true }],
    importe_restante: 0,
    pagos_restantes_anteriores: []
  });

  const [minTrabajoPayment, setMinTrabajoPayment] = useState<MinTrabajoPaymentData>({
    fecha: new Date().toISOString().split("T")[0],
    nro_transaccion: "",
    ajustes: []
  });

  const [isManuallyUnlocked, setIsManuallyUnlocked] = useState(false);

  // Estado para modal de crear departamento desde Asientos
  const [isDeptModalOpen, setIsDeptModalOpen] = useState(false);
  const [newDeptName, setNewDeptName] = useState("");
  const [newDeptDesc, setNewDeptDesc] = useState("");
  const [savingNewDept, setSavingNewDept] = useState(false);

  useEffect(() => {
    if (tenantSchema) {
      const p = getStoredPeriod(tenantSchema);
      setSelectedMonth(p.month);
      setSelectedYear(p.year);
    }
  }, [tenantSchema]);

  useEffect(() => {
    if (!tenantSchema) {
      router.push("/seleccionar-empresa");
      return;
    }
    fetchSheetData();
  }, [tenantSchema, selectedMonth, selectedYear]);

  const fetchSheetData = async () => {
    try {
      setLoading(true);
      const res = await fetch(
        `${getApiUrl()}/api/tenants/${tenantSchema}/asientos/?month=${selectedMonth}&year=${selectedYear}`
      );
      if (!res.ok) {
        throw new Error("No se pudo cargar la información de asientos contables");
      }
      const data: AccountingSheetData = await res.json();
      setSheetData(data);
      setIsManuallyUnlocked(data.is_manually_unlocked || false);

      // Cargar lista de departamentos de la empresa para asegurar sincronización completa
      let currentDeptList: DepartmentPayrollItem[] = data.devengamiento?.departamentos ? [...data.devengamiento.departamentos] : [];
      try {
        const deptRes = await fetch(`${getApiUrl()}/api/tenants/${tenantSchema}/departments/`);
        if (deptRes.ok) {
          const allTenantDepts: Array<{ id: number; name: string; description?: string }> = await deptRes.json();
          const existingIds = new Set(currentDeptList.map(d => d.id).filter(Boolean));
          const existingNames = new Set(currentDeptList.map(d => d.nombre.toLowerCase().trim()));

          for (const td of allTenantDepts) {
            if (!existingIds.has(td.id) && !existingNames.has(td.name.toLowerCase().trim())) {
              currentDeptList.push({
                id: td.id,
                nombre: td.name,
                sueldos: 0,
                bono_antiguedad: 0,
                total_depto: 0
              });
            }
          }
        }
      } catch (e) {
        console.error("Error cargando departamentos complementarios:", e);
      }

      const defaultCajaName = data.caja_salud_name || "Caja Petrolera de Salud";

      if (data.devengamiento) {
        setDevengamiento({
          ...data.devengamiento,
          departamentos: currentDeptList,
          caja_salud_choice: data.devengamiento.caja_salud_choice || defaultCajaName
        });
      } else {
        setDevengamiento({
          departamentos: currentDeptList,
          sueldos_adm: 0,
          bono_antiguedad_adm: 0,
          sueldos_mo: 0,
          bono_antiguedad_mo: 0,
          retenciones_ley: 0,
          sueldos_por_pagar: 0,
          arancel_min_trabajo: 27.0,
          caja_salud_choice: defaultCajaName,
          patronal_gestora: undefined,
          patronal_caja: undefined,
          aguinaldo: undefined,
          indemnizacion: undefined
        });
      }

      if (data.gestora_payment) {
        const pendingGestora = data.gestora_payment.pagos_restantes_anteriores && data.gestora_payment.pagos_restantes_anteriores.length > 0
          ? data.gestora_payment.pagos_restantes_anteriores
          : (data.saldos_pendientes_gestora || []);

        let loadedItemsG: ImporteRestanteItem[] = data.gestora_payment.importes_restantes && data.gestora_payment.importes_restantes.length > 0
          ? [...data.gestora_payment.importes_restantes]
          : [];
        if (loadedItemsG.length === 0) {
          if (data.gestora_payment.importe_restante && data.gestora_payment.importe_restante > 0) {
            loadedItemsG = [{ id: "ir_g_1", concepto: "", monto: data.gestora_payment.importe_restante, activo: true }];
          } else {
            loadedItemsG = [{ id: "ir_g_1", concepto: "", monto: 0, activo: true }];
          }
        }

        setGestoraPayment({
          ...data.gestora_payment,
          importes_restantes: loadedItemsG,
          importe_restante: data.gestora_payment.importe_restante ?? 0,
          descuento_retenciones: data.gestora_payment.descuento_retenciones ?? 0,
          descuento_patronal: data.gestora_payment.descuento_patronal ?? 0,
          pagos_restantes_anteriores: pendingGestora,
          intereses: data.gestora_payment.intereses || []
        });
      } else {
        setGestoraPayment({
          fecha: new Date().toISOString().split("T")[0],
          nro_transaccion: "",
          intereses: [],
          importes_restantes: [{ id: "ir_g_1", concepto: "", monto: 0, activo: true }],
          importe_restante: 0,
          descuento_retenciones: 0,
          descuento_patronal: 0,
          pagos_restantes_anteriores: data.saldos_pendientes_gestora || []
        });
      }

      if (data.caja_payment) {
        const pendingCaja = data.caja_payment.pagos_restantes_anteriores && data.caja_payment.pagos_restantes_anteriores.length > 0
          ? data.caja_payment.pagos_restantes_anteriores
          : (data.saldos_pendientes_caja || []);

        let loadedItemsC: ImporteRestanteItem[] = data.caja_payment.importes_restantes && data.caja_payment.importes_restantes.length > 0
          ? [...data.caja_payment.importes_restantes]
          : [];
        if (loadedItemsC.length === 0) {
          if (data.caja_payment.importe_restante && data.caja_payment.importe_restante > 0) {
            loadedItemsC = [{ id: "ir_c_1", concepto: "", monto: data.caja_payment.importe_restante, activo: true }];
          } else {
            loadedItemsC = [{ id: "ir_c_1", concepto: "", monto: 0, activo: true }];
          }
        }

        setCajaPayment({
          ...data.caja_payment,
          caja_tipo: data.caja_payment.caja_tipo || defaultCajaName,
          importes_restantes: loadedItemsC,
          importe_restante: data.caja_payment.importe_restante ?? 0,
          pagos_restantes_anteriores: pendingCaja,
          ajustes: data.caja_payment.ajustes || []
        });
      } else {
        setCajaPayment({
          caja_tipo: defaultCajaName,
          fecha: new Date().toISOString().split("T")[0],
          nro_transaccion: "",
          ajustes: [],
          importes_restantes: [{ id: "ir_c_1", concepto: "", monto: 0, activo: true }],
          importe_restante: 0,
          pagos_restantes_anteriores: data.saldos_pendientes_caja || []
        });
      }
      if (data.min_trabajo_payment) {
        setMinTrabajoPayment(data.min_trabajo_payment);
      }
    } catch (err: any) {
      Swal.fire({
        icon: "error",
        title: "Error al cargar asientos",
        text: err.message || "Ocurrió un error inesperado.",
        confirmButtonColor: "#1E3A8A"
      });
    } finally {
      setLoading(false);
    }
  };

  // 1. Total Ganado devengado (Suma dinámica de todos los departamentos definidos)
  const totalGanado = useMemo(() => {
    if (devengamiento.departamentos && devengamiento.departamentos.length > 0) {
      return Number(
        devengamiento.departamentos
          .reduce((acc, d) => {
            const s = Number(d.sueldos) || 0;
            const b = Number(d.bono_antiguedad) || 0;
            return acc + s + b;
          }, 0)
          .toFixed(2)
      );
    }
    const sAdm = Number(devengamiento.sueldos_adm) || 0;
    const bAdm = Number(devengamiento.bono_antiguedad_adm) || 0;
    const sMo = Number(devengamiento.sueldos_mo) || 0;
    const bMo = Number(devengamiento.bono_antiguedad_mo) || 0;
    return Number((sAdm + bAdm + sMo + bMo).toFixed(2));
  }, [
    devengamiento.departamentos,
    devengamiento.sueldos_adm,
    devengamiento.bono_antiguedad_adm,
    devengamiento.sueldos_mo,
    devengamiento.bono_antiguedad_mo
  ]);

  // Crear un nuevo departamento directamente desde el módulo de Asientos
  const handleCreateDepartmentFromAsientos = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDeptName.trim()) {
      Swal.fire({
        icon: "warning",
        title: "Nombre requerido",
        text: "Ingresa el nombre del nuevo departamento."
      });
      return;
    }

    setSavingNewDept(true);
    try {
      const res = await fetch(`${getApiUrl()}/api/tenants/${tenantSchema}/departments/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newDeptName.trim(),
          account_type: newDeptName.trim(),
          description: newDeptDesc.trim() || null
        })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "No se pudo crear el departamento");
      }

      const createdDept = await res.json();
      const updatedList = [...(devengamiento.departamentos || [])];
      updatedList.push({
        id: createdDept.id,
        nombre: createdDept.name,
        sueldos: 0,
        bono_antiguedad: 0,
        total_depto: 0
      });

      setDevengamiento({
        ...devengamiento,
        departamentos: updatedList
      });

      setNewDeptName("");
      setNewDeptDesc("");
      setIsDeptModalOpen(false);

      Swal.fire({
        icon: "success",
        title: "¡Departamento Creado!",
        text: `El departamento "${createdDept.name}" ha sido añadido a los asientos contables.`,
        timer: 1800,
        showConfirmButton: false
      });
    } catch (err: any) {
      Swal.fire({
        icon: "error",
        title: "Error al crear departamento",
        text: err.message || "Ocurrió un error inesperado."
      });
    } finally {
      setSavingNewDept(false);
    }
  };

  // Quitar departamento de la vista de asientos
  const handleRemoveDepartment = (idx: number) => {
    const list = [...(devengamiento.departamentos || [])];
    const dept = list[idx];
    Swal.fire({
      title: "¿Quitar departamento?",
      text: `¿Deseas quitar "${dept.nombre}" de este asiento contable?`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#EF4444",
      cancelButtonColor: "#6B7280",
      confirmButtonText: "Sí, quitar",
      cancelButtonText: "Cancelar"
    }).then((result) => {
      if (result.isConfirmed) {
        list.splice(idx, 1);
        setDevengamiento({ ...devengamiento, departamentos: list });
      }
    });
  };

  // Actualizar sueldos o bonos de un departamento específico
  const updateDepartmentItem = (index: number, field: "sueldos" | "bono_antiguedad", value: number) => {
    const list = [...(devengamiento.departamentos || [])];
    const item = { ...list[index], [field]: value };
    item.total_depto = Number(((Number(item.sueldos) || 0) + (Number(item.bono_antiguedad) || 0)).toFixed(2));
    list[index] = item;
    setDevengamiento({ ...devengamiento, departamentos: list });
  };

  // 2. Cuadrante 2: Aportes Patronales (editables o automáticos s/ Total Ganado)
  const patronalGestora = useMemo(() => {
    if (devengamiento.patronal_gestora !== undefined && devengamiento.patronal_gestora !== null && devengamiento.patronal_gestora > 0) {
      return Number(Number(devengamiento.patronal_gestora).toFixed(2));
    }
    return Number((totalGanado * 0.0721).toFixed(2));
  }, [devengamiento.patronal_gestora, totalGanado]);

  const patronalCaja = useMemo(() => {
    if (devengamiento.patronal_caja !== undefined && devengamiento.patronal_caja !== null && devengamiento.patronal_caja > 0) {
      return Number(Number(devengamiento.patronal_caja).toFixed(2));
    }
    return Number((totalGanado * 0.10).toFixed(2));
  }, [devengamiento.patronal_caja, totalGanado]);

  const subtotalPatronal = useMemo(() => {
    return Number((patronalGestora + patronalCaja).toFixed(2));
  }, [patronalGestora, patronalCaja]);

  // 3. Cuadrante 3: Beneficios Sociales (editables o automáticos 1/12)
  const aguinaldo = useMemo(() => {
    if (devengamiento.aguinaldo !== undefined && devengamiento.aguinaldo !== null && devengamiento.aguinaldo > 0) {
      return Number(Number(devengamiento.aguinaldo).toFixed(2));
    }
    return Number((totalGanado * (1 / 12)).toFixed(2));
  }, [devengamiento.aguinaldo, totalGanado]);

  const indemnizacion = useMemo(() => {
    if (devengamiento.indemnizacion !== undefined && devengamiento.indemnizacion !== null && devengamiento.indemnizacion > 0) {
      return Number(Number(devengamiento.indemnizacion).toFixed(2));
    }
    return Number((totalGanado * (1 / 12)).toFixed(2));
  }, [devengamiento.indemnizacion, totalGanado]);

  const subtotalBeneficios = useMemo(() => {
    return Number((aguinaldo + indemnizacion).toFixed(2));
  }, [aguinaldo, indemnizacion]);

  // 4. Arancel Min Trabajo
  const arancelMt = useMemo(() => {
    const val = devengamiento.arancel_min_trabajo !== undefined ? devengamiento.arancel_min_trabajo : 27.0;
    return Number(Number(val).toFixed(2));
  }, [devengamiento.arancel_min_trabajo]);

  // 5. Totales de Asientos de Pago

  // Gestora - Desglose proporcional de deducciones por importes restantes (soporte multi-item)
  const gestoraDeduccionCalc = useMemo(() => {
    const baseRet = Number(devengamiento.retenciones_ley) || 0;
    const basePat = patronalGestora;
    const totBase = baseRet + basePat;

    let pctRet = 0;
    let pctPat = 0;
    if (totBase > 0) {
      pctRet = (baseRet / totBase) * 100;
      pctPat = (basePat / totBase) * 100;
    }

    let totalImpRestante = 0;
    let totalDescRet = 0;
    let totalDescPat = 0;

    const items = (gestoraPayment.importes_restantes || []).map((item) => {
      const isActivo = item.activo !== false;
      const m = Number(item.monto) || 0;
      let dRet = 0;
      let dPat = 0;
      if (isActivo && m > 0 && totBase > 0) {
        dRet = Math.round(m * (baseRet / totBase) * 100) / 100;
        dPat = Math.round((m - dRet) * 100) / 100;
        totalImpRestante += m;
        totalDescRet += dRet;
        totalDescPat += dPat;
      }
      return {
        ...item,
        descRet: dRet,
        descPat: dPat
      };
    });

    totalDescRet = Math.round(totalDescRet * 100) / 100;
    totalDescPat = Math.round(totalDescPat * 100) / 100;
    totalImpRestante = Math.round(totalImpRestante * 100) / 100;

    const netoRet = Math.max(0, Math.round((baseRet - totalDescRet) * 100) / 100);
    const netoPat = Math.max(0, Math.round((basePat - totalDescPat) * 100) / 100);
    const baseEfectiva = Number((netoRet + netoPat).toFixed(2));

    return {
      baseRet,
      basePat,
      totBase,
      pctRet,
      pctPat,
      items,
      totalImpRestante,
      totalDescRet,
      totalDescPat,
      descRet: totalDescRet,
      descPat: totalDescPat,
      impRestante: totalImpRestante,
      netoRet,
      netoPat,
      baseEfectiva
    };
  }, [devengamiento.retenciones_ley, patronalGestora, gestoraPayment.importes_restantes]);

  // Suma de saldos pendientes de meses anteriores seleccionados para liquidar en Gestora
  const sumPriorGestora = useMemo(() => {
    return (gestoraPayment.pagos_restantes_anteriores || [])
      .filter((p) => p.pagar_en_este_mes)
      .reduce((acc, p) => acc + (Number(p.monto_restante) || 0) + (Number(p.interes_mora) || 0), 0);
  }, [gestoraPayment.pagos_restantes_anteriores]);

  const sumInteresesGestora = useMemo(() => {
    return (gestoraPayment.intereses || []).reduce((acc, it) => acc + (Number(it.monto) || 0), 0);
  }, [gestoraPayment.intereses]);

  const totalPagoGestora = useMemo(() => {
    return Number((gestoraDeduccionCalc.baseEfectiva + sumInteresesGestora + sumPriorGestora).toFixed(2));
  }, [gestoraDeduccionCalc.baseEfectiva, sumInteresesGestora, sumPriorGestora]);

  // Caja de Salud - Deducción por importes restantes (soporte multi-item)
  const cajaDeduccionCalc = useMemo(() => {
    const baseSalud = patronalCaja;
    let totalImpRestante = 0;

    const items = (cajaPayment.importes_restantes || []).map((item) => {
      const isActivo = item.activo !== false;
      const m = Number(item.monto) || 0;
      if (isActivo && m > 0) {
        totalImpRestante += m;
      }
      return {
        ...item,
        descSalud: isActivo ? m : 0
      };
    });

    totalImpRestante = Math.round(totalImpRestante * 100) / 100;
    const netoSalud = Math.max(0, Math.round((baseSalud - totalImpRestante) * 100) / 100);
    return {
      baseSalud,
      items,
      totalImpRestante,
      impRestante: totalImpRestante,
      netoSalud
    };
  }, [patronalCaja, cajaPayment.importes_restantes]);

  // Suma de saldos pendientes de meses anteriores seleccionados para liquidar en Caja
  const sumPriorCaja = useMemo(() => {
    return (cajaPayment.pagos_restantes_anteriores || [])
      .filter((p) => p.pagar_en_este_mes)
      .reduce((acc, p) => acc + (Number(p.monto_restante) || 0) + (Number(p.interes_mora) || 0), 0);
  }, [cajaPayment.pagos_restantes_anteriores]);

  const sumAjustesCaja = useMemo(() => {
    return (cajaPayment.ajustes || []).reduce((acc, it) => acc + (Number(it.monto) || 0), 0);
  }, [cajaPayment.ajustes]);

  const totalPagoCaja = useMemo(() => {
    return Number((cajaDeduccionCalc.netoSalud + sumAjustesCaja + sumPriorCaja).toFixed(2));
  }, [cajaDeduccionCalc.netoSalud, sumAjustesCaja, sumPriorCaja]);

  const sumAjustesMt = useMemo(() => {
    return (minTrabajoPayment.ajustes || []).reduce((acc, it) => acc + (Number(it.monto) || 0), 0);
  }, [minTrabajoPayment.ajustes]);

  const totalPagoMinTrabajo = useMemo(() => {
    return Number((arancelMt + sumAjustesMt).toFixed(2));
  }, [arancelMt, sumAjustesMt]);

  // 6. Totales Generales DEBE y HABER en tiempo real
  const liveTotalDebe = useMemo(() => {
    return Number((
      totalGanado +
      subtotalPatronal +
      subtotalBeneficios +
      arancelMt +
      totalPagoGestora +
      totalPagoCaja +
      totalPagoMinTrabajo
    ).toFixed(2));
  }, [totalGanado, subtotalPatronal, subtotalBeneficios, arancelMt, totalPagoGestora, totalPagoCaja, totalPagoMinTrabajo]);

  const liveTotalHaber = useMemo(() => {
    const ret = Number(devengamiento.retenciones_ley) || 0;
    const liq = Number(devengamiento.sueldos_por_pagar) || 0;
    const haberDevengamiento = Number((ret + liq).toFixed(2));

    return Number((
      haberDevengamiento +
      subtotalPatronal +
      subtotalBeneficios +
      arancelMt +
      totalPagoGestora +
      totalPagoCaja +
      totalPagoMinTrabajo
    ).toFixed(2));
  }, [devengamiento.retenciones_ley, devengamiento.sueldos_por_pagar, subtotalPatronal, subtotalBeneficios, arancelMt, totalPagoGestora, totalPagoCaja, totalPagoMinTrabajo]);

  const liveDiferencia = useMemo(() => {
    return Number(Math.abs(liveTotalDebe - liveTotalHaber).toFixed(2));
  }, [liveTotalDebe, liveTotalHaber]);

  const isCuadrado = liveDiferencia === 0.0;

  // Manejador para guardar cambios
  // Obtener historial anual de asientos
  const fetchAnnualHistory = async (year: number) => {
    if (!tenantSchema) return;
    try {
      setLoadingHistory(true);
      const res = await fetch(`${getApiUrl()}/api/tenants/${tenantSchema}/asientos/history?year=${year}`);
      if (!res.ok) throw new Error("Error al obtener el historial de asientos");
      const data: AnnualHistoryResponse = await res.json();
      setHistoryData(data);
    } catch (err: any) {
      console.error("Error fetching history:", err);
    } finally {
      setLoadingHistory(false);
    }
  };

  // Exportar asientos comparativos del año en Excel
  const handleExportMasterExcel = async () => {
    if (!tenantSchema) return;
    try {
      setExportingMasterExcel(true);
      const res = await fetch(
        `${getApiUrl()}/api/tenants/${tenantSchema}/asientos/export/master-excel?year=${selectedYear}`
      );
      if (!res.ok) throw new Error("Error al exportar asientos del año");
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `asientos_comparativo_anual_${tenantSchema}_${selectedYear}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      Swal.fire({
        icon: "error",
        title: "Error al exportar Excel",
        text: err.message || "No se pudo descargar los asientos del año."
      });
    } finally {
      setExportingMasterExcel(false);
    }
  };

  const handleExportMonthExcel = async (mNum: number) => {
    if (!tenantSchema) return;
    try {
      const res = await fetch(
        `${getApiUrl()}/api/tenants/${tenantSchema}/asientos/export/excel?month=${mNum}&year=${selectedYear}`
      );
      if (!res.ok) throw new Error("Error al exportar Excel del mes");
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Asientos_${tenantSchema}_${mNum}_${selectedYear}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      Swal.fire({ icon: "error", title: "Error", text: err.message });
    }
  };

  const handleExportMonthPdf = async (mNum: number) => {
    if (!tenantSchema) return;
    try {
      const res = await fetch(
        `${getApiUrl()}/api/tenants/${tenantSchema}/asientos/export/pdf?month=${mNum}&year=${selectedYear}`
      );
      if (!res.ok) throw new Error("Error al exportar PDF del mes");
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Asientos_${tenantSchema}_${mNum}_${selectedYear}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      Swal.fire({ icon: "error", title: "Error", text: err.message });
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const payload = {
        month: selectedMonth,
        year: selectedYear,
        caja_banco_name: sheetData?.caja_banco_name || "Caja Moneda Nacional",
        caja_salud_name: cajaPayment.caja_tipo || devengamiento.caja_salud_choice || "Caja Petrolera de Salud",
        arancel_min_trabajo: devengamiento.arancel_min_trabajo,
        devengamiento: {
          ...devengamiento,
          caja_salud_choice: cajaPayment.caja_tipo || devengamiento.caja_salud_choice,
          patronal_gestora: patronalGestora,
          patronal_caja: patronalCaja,
          aguinaldo: aguinaldo,
          indemnizacion: indemnizacion
        },
        gestora_payment: {
          ...gestoraPayment,
          importes_restantes: (gestoraPayment.importes_restantes || []).map(item => {
            const isActivo = item.activo !== false;
            const m = Number(item.monto) || 0;
            let dRet = 0;
            let dPat = 0;
            if (isActivo && m > 0 && gestoraDeduccionCalc.totBase > 0) {
              dRet = Math.round(m * (gestoraDeduccionCalc.baseRet / gestoraDeduccionCalc.totBase) * 100) / 100;
              dPat = Math.round((m - dRet) * 100) / 100;
            }
            return {
              ...item,
              descuento_retenciones: dRet,
              descuento_patronal: dPat
            };
          }),
          importe_restante: gestoraDeduccionCalc.totalImpRestante,
          descuento_retenciones: gestoraDeduccionCalc.totalDescRet,
          descuento_patronal: gestoraDeduccionCalc.totalDescPat
        },
        caja_payment: {
          ...cajaPayment,
          importes_restantes: (cajaPayment.importes_restantes || []).map(item => ({ ...item })),
          importe_restante: cajaDeduccionCalc.totalImpRestante
        },
        min_trabajo_payment: minTrabajoPayment,
        is_manually_unlocked: isManuallyUnlocked
      };

      const res = await fetch(
        `${getApiUrl()}/api/tenants/${tenantSchema}/asientos/`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        }
      );

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || "Error al guardar el asiento contable");
      }

      const updatedSheet: AccountingSheetData = await res.json();
      setSheetData(updatedSheet);

      if (updatedSheet.gestora_payment) {
        let loadedItemsG: ImporteRestanteItem[] = updatedSheet.gestora_payment.importes_restantes && updatedSheet.gestora_payment.importes_restantes.length > 0
          ? [...updatedSheet.gestora_payment.importes_restantes]
          : [{ id: "ir_g_1", concepto: "", monto: updatedSheet.gestora_payment.importe_restante || 0, activo: true }];

        setGestoraPayment({
          ...updatedSheet.gestora_payment,
          importes_restantes: loadedItemsG,
          importe_restante: updatedSheet.gestora_payment.importe_restante ?? 0,
          descuento_retenciones: updatedSheet.gestora_payment.descuento_retenciones ?? 0,
          descuento_patronal: updatedSheet.gestora_payment.descuento_patronal ?? 0,
          pagos_restantes_anteriores: updatedSheet.gestora_payment.pagos_restantes_anteriores || updatedSheet.saldos_pendientes_gestora || [],
          intereses: updatedSheet.gestora_payment.intereses || []
        });
      }
      if (updatedSheet.caja_payment) {
        let loadedItemsC: ImporteRestanteItem[] = updatedSheet.caja_payment.importes_restantes && updatedSheet.caja_payment.importes_restantes.length > 0
          ? [...updatedSheet.caja_payment.importes_restantes]
          : [{ id: "ir_c_1", concepto: "", monto: updatedSheet.caja_payment.importe_restante || 0, activo: true }];

        setCajaPayment({
          ...updatedSheet.caja_payment,
          caja_tipo: updatedSheet.caja_payment.caja_tipo || "Caja Petrolera de Salud",
          importes_restantes: loadedItemsC,
          importe_restante: updatedSheet.caja_payment.importe_restante ?? 0,
          pagos_restantes_anteriores: updatedSheet.caja_payment.pagos_restantes_anteriores || updatedSheet.saldos_pendientes_caja || [],
          ajustes: updatedSheet.caja_payment.ajustes || []
        });
      }

      Swal.fire({
        icon: "success",
        title: "¡Asientos Guardados!",
        text: "Los cambios en cuadrantes, deducciones y pagos se guardaron exitosamente.",
        timer: 2000,
        showConfirmButton: false
      });
    } catch (err: any) {
      Swal.fire({
        icon: "error",
        title: "Error al guardar",
        text: err.message || "No se pudo guardar la información.",
        confirmButtonColor: "#1E3A8A"
      });
    } finally {
      setSaving(false);
    }
  };

  // Restablecer desde planilla
  const handleReset = async () => {
    const result = await Swal.fire({
      title: "¿Restablecer asientos contables?",
      text: "Se descartarán las modificaciones personalizadas y se recalcularán automáticamente todos los cuadrantes a partir de la planilla de sueldos del mes.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#1E3A8A",
      cancelButtonColor: "#EF4444",
      confirmButtonText: "Sí, restablecer",
      cancelButtonText: "Cancelar"
    });

    if (!result.isConfirmed) return;

    try {
      setLoading(true);
      const res = await fetch(
        `${getApiUrl()}/api/tenants/${tenantSchema}/asientos/reset?month=${selectedMonth}&year=${selectedYear}`,
        { method: "POST" }
      );
      if (!res.ok) {
        throw new Error("No se pudo restablecer el asiento contable");
      }
      const data: AccountingSheetData = await res.json();
      setSheetData(data);
      if (data.devengamiento) setDevengamiento(data.devengamiento);
      if (data.gestora_payment) {
        let loadedItemsG: ImporteRestanteItem[] = data.gestora_payment.importes_restantes && data.gestora_payment.importes_restantes.length > 0
          ? [...data.gestora_payment.importes_restantes]
          : [{ id: "ir_g_1", concepto: "", monto: data.gestora_payment.importe_restante || 0, activo: true }];

        setGestoraPayment({
          ...data.gestora_payment,
          importes_restantes: loadedItemsG,
          importe_restante: data.gestora_payment.importe_restante ?? 0,
          descuento_retenciones: data.gestora_payment.descuento_retenciones ?? 0,
          descuento_patronal: data.gestora_payment.descuento_patronal ?? 0,
          pagos_restantes_anteriores: data.gestora_payment.pagos_restantes_anteriores || data.saldos_pendientes_gestora || [],
          intereses: data.gestora_payment.intereses || []
        });
      }
      if (data.caja_payment) {
        let loadedItemsC: ImporteRestanteItem[] = data.caja_payment.importes_restantes && data.caja_payment.importes_restantes.length > 0
          ? [...data.caja_payment.importes_restantes]
          : [{ id: "ir_c_1", concepto: "", monto: data.caja_payment.importe_restante || 0, activo: true }];

        setCajaPayment({
          ...data.caja_payment,
          caja_tipo: data.caja_payment.caja_tipo || "Caja Petrolera de Salud",
          importes_restantes: loadedItemsC,
          importe_restante: data.caja_payment.importe_restante ?? 0,
          pagos_restantes_anteriores: data.caja_payment.pagos_restantes_anteriores || data.saldos_pendientes_caja || [],
          ajustes: data.caja_payment.ajustes || []
        });
      }
      if (data.min_trabajo_payment) setMinTrabajoPayment(data.min_trabajo_payment);

      Swal.fire({
        icon: "success",
        title: "Restablecido",
        text: "Los datos han sido recalculados de la planilla original.",
        timer: 2000,
        showConfirmButton: false
      });
    } catch (err: any) {
      Swal.fire({
        icon: "error",
        title: "Error",
        text: err.message || "Error al restablecer.",
        confirmButtonColor: "#1E3A8A"
      });
    } finally {
      setLoading(false);
    }
  };

  // Reflejar datos del mes anterior
  const handleReflejarMesAnterior = async () => {
    const prevM = selectedMonth === 1 ? 12 : selectedMonth - 1;
    const prevY = selectedMonth === 1 ? selectedYear - 1 : selectedYear;
    const prevMName = MONTHS.find(m => m.id === prevM)?.name || prevM;
    const currMName = MONTHS.find(m => m.id === selectedMonth)?.name || selectedMonth;

    const result = await Swal.fire({
      title: "¿Reflejar datos del mes anterior?",
      html: `Se copiarán las entidades de pago, números de transacción, glosas, ajustes y configuración de <b>${prevMName} ${prevY}</b> hacia <b>${currMName} ${selectedYear}</b>.<br/><br/><span class="text-xs text-slate-500">Podrás revisar y editar cualquier dato antes de presionar "Guardar Cambios".</span>`,
      icon: "question",
      showCancelButton: true,
      confirmButtonColor: "#D97706",
      cancelButtonColor: "#64748B",
      confirmButtonText: "Sí, reflejar datos",
      cancelButtonText: "Cancelar"
    });

    if (!result.isConfirmed) return;

    try {
      setLoading(true);
      const res = await fetch(
        `${getApiUrl()}/api/tenants/${tenantSchema}/asientos/reflect-previous?month=${selectedMonth}&year=${selectedYear}`,
        { method: "POST" }
      );
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || "No se pudo reflejar los datos del mes anterior");
      }
      const data: AccountingSheetData = await res.json();
      setSheetData(data);
      if (data.devengamiento) setDevengamiento(data.devengamiento);
      if (data.gestora_payment) {
        let loadedItemsG: ImporteRestanteItem[] = data.gestora_payment.importes_restantes && data.gestora_payment.importes_restantes.length > 0
          ? [...data.gestora_payment.importes_restantes]
          : [{ id: "ir_g_1", concepto: "", monto: data.gestora_payment.importe_restante || 0, activo: true }];

        setGestoraPayment({
          ...data.gestora_payment,
          importes_restantes: loadedItemsG,
          importe_restante: data.gestora_payment.importe_restante ?? 0,
          descuento_retenciones: data.gestora_payment.descuento_retenciones ?? 0,
          descuento_patronal: data.gestora_payment.descuento_patronal ?? 0,
          pagos_restantes_anteriores: data.gestora_payment.pagos_restantes_anteriores || data.saldos_pendientes_gestora || [],
          intereses: data.gestora_payment.intereses || []
        });
      }
      if (data.caja_payment) {
        let loadedItemsC: ImporteRestanteItem[] = data.caja_payment.importes_restantes && data.caja_payment.importes_restantes.length > 0
          ? [...data.caja_payment.importes_restantes]
          : [{ id: "ir_c_1", concepto: "", monto: data.caja_payment.importe_restante || 0, activo: true }];

        setCajaPayment({
          ...data.caja_payment,
          caja_tipo: data.caja_payment.caja_tipo || "Caja Petrolera de Salud",
          importes_restantes: loadedItemsC,
          importe_restante: data.caja_payment.importe_restante ?? 0,
          pagos_restantes_anteriores: data.caja_payment.pagos_restantes_anteriores || data.saldos_pendientes_caja || [],
          ajustes: data.caja_payment.ajustes || []
        });
      }
      if (data.min_trabajo_payment) setMinTrabajoPayment(data.min_trabajo_payment);

      Swal.fire({
        icon: "success",
        title: "¡Datos Reflejados!",
        text: `Se reflejaron los datos de ${prevMName} ${prevY}. Puede editar lo que necesite y presionar "Guardar Cambios".`,
        confirmButtonColor: "#1E3A8A"
      });
    } catch (err: any) {
      Swal.fire({
        icon: "error",
        title: "No se pudo reflejar",
        text: err.message || "Error al reflejar los datos del mes anterior.",
        confirmButtonColor: "#1E3A8A"
      });
    } finally {
      setLoading(false);
    }
  };

  // Exportar a Excel
  const handleExportExcel = async () => {
    try {
      setExportingExcel(true);
      const res = await fetch(
        `${getApiUrl()}/api/tenants/${tenantSchema}/asientos/export/excel?month=${selectedMonth}&year=${selectedYear}`
      );
      if (!res.ok) throw new Error("Error generando el archivo Excel");
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Asientos_${tenantSchema}_${selectedMonth}_${selectedYear}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      Swal.fire({
        icon: "error",
        title: "Error de Exportación",
        text: err.message || "No se pudo exportar a Excel.",
        confirmButtonColor: "#1E3A8A"
      });
    } finally {
      setExportingExcel(false);
    }
  };

  // Exportar a PDF
  const handleExportPdf = async () => {
    try {
      setExportingPdf(true);
      const res = await fetch(
        `${getApiUrl()}/api/tenants/${tenantSchema}/asientos/export/pdf?month=${selectedMonth}&year=${selectedYear}`
      );
      if (!res.ok) throw new Error("Error generando el archivo PDF");
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Asientos_${tenantSchema}_${selectedMonth}_${selectedYear}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      Swal.fire({
        icon: "error",
        title: "Error de Exportación",
        text: err.message || "No se pudo exportar a PDF.",
        confirmButtonColor: "#1E3A8A"
      });
    } finally {
      setExportingPdf(false);
    }
  };

  // Manejo de Desbloqueo Extraordinario de Administrador
  const handleToggleUnlock = () => {
    if (!isManuallyUnlocked) {
      Swal.fire({
        title: "¿Habilitar edición administrativa?",
        text: "Este periodo se encuentra cerrado por fecha calendario. Al habilitar la edición extraordinaria, podrás ajustar los valores de nómina y aranceles bajo tu responsabilidad.",
        icon: "warning",
        showCancelButton: true,
        confirmButtonColor: "#F59E0B",
        cancelButtonColor: "#6B7280",
        confirmButtonText: "Sí, desbloquear edición",
        cancelButtonText: "Cancelar"
      }).then((result) => {
        if (result.isConfirmed) {
          setIsManuallyUnlocked(true);
        }
      });
    } else {
      setIsManuallyUnlocked(false);
    }
  };

  // Métodos para saldos pendientes de meses anteriores (Gestora Pública)
  const togglePriorGestora = (index: number) => {
    const list = [...(gestoraPayment.pagos_restantes_anteriores || [])];
    list[index] = { ...list[index], pagar_en_este_mes: !list[index].pagar_en_este_mes };
    setGestoraPayment({ ...gestoraPayment, pagos_restantes_anteriores: list });
  };

  const updatePriorGestoraMora = (index: number, mora: number) => {
    const list = [...(gestoraPayment.pagos_restantes_anteriores || [])];
    list[index] = { ...list[index], interes_mora: mora };
    setGestoraPayment({ ...gestoraPayment, pagos_restantes_anteriores: list });
  };

  // Métodos para lista dinámica de Importes Restantes (Gestora Pública)
  const addImporteRestanteGestora = () => {
    const list = [...(gestoraPayment.importes_restantes || [])];
    list.push({
      id: `ir_g_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      concepto: "",
      monto: 0,
      activo: true
    });
    setGestoraPayment({ ...gestoraPayment, importes_restantes: list });
  };

  const removeImporteRestanteGestora = (index: number) => {
    let list = [...(gestoraPayment.importes_restantes || [])];
    list.splice(index, 1);
    if (list.length === 0) {
      list = [{ id: `ir_g_${Date.now()}`, concepto: "", monto: 0, activo: true }];
    }
    setGestoraPayment({ ...gestoraPayment, importes_restantes: list });
  };

  const updateImporteRestanteGestora = (index: number, field: keyof ImporteRestanteItem, value: any) => {
    const list = [...(gestoraPayment.importes_restantes || [])];
    list[index] = { ...list[index], [field]: value };
    setGestoraPayment({ ...gestoraPayment, importes_restantes: list });
  };

  // Métodos para lista dinámica de Gestora (Selector tipo + monto, sin descripción)
  const addInteresGestora = () => {
    setGestoraPayment({
      ...gestoraPayment,
      intereses: [
        ...(gestoraPayment.intereses || []),
        { id: Math.random().toString(), tipo: "interes", concepto: "", monto: 0 }
      ]
    });
  };

  const removeInteresGestora = (index: number) => {
    const list = [...(gestoraPayment.intereses || [])];
    list.splice(index, 1);
    setGestoraPayment({ ...gestoraPayment, intereses: list });
  };

  const updateInteresGestora = (index: number, field: keyof PaymentExtraItem, value: any) => {
    const list = [...(gestoraPayment.intereses || [])];
    list[index] = { ...list[index], [field]: value };
    setGestoraPayment({ ...gestoraPayment, intereses: list });
  };

  // Métodos para saldos pendientes de meses anteriores (Caja de Salud)
  const togglePriorCaja = (index: number) => {
    const list = [...(cajaPayment.pagos_restantes_anteriores || [])];
    list[index] = { ...list[index], pagar_en_este_mes: !list[index].pagar_en_este_mes };
    setCajaPayment({ ...cajaPayment, pagos_restantes_anteriores: list });
  };

  const updatePriorCajaMora = (index: number, mora: number) => {
    const list = [...(cajaPayment.pagos_restantes_anteriores || [])];
    list[index] = { ...list[index], interes_mora: mora };
    setCajaPayment({ ...cajaPayment, pagos_restantes_anteriores: list });
  };

  // Métodos para lista dinámica de Importes Restantes (Caja de Salud)
  const addImporteRestanteCaja = () => {
    const list = [...(cajaPayment.importes_restantes || [])];
    list.push({
      id: `ir_c_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      concepto: "",
      monto: 0,
      activo: true
    });
    setCajaPayment({ ...cajaPayment, importes_restantes: list });
  };

  const removeImporteRestanteCaja = (index: number) => {
    let list = [...(cajaPayment.importes_restantes || [])];
    list.splice(index, 1);
    if (list.length === 0) {
      list = [{ id: `ir_c_${Date.now()}`, concepto: "", monto: 0, activo: true }];
    }
    setCajaPayment({ ...cajaPayment, importes_restantes: list });
  };

  const updateImporteRestanteCaja = (index: number, field: keyof ImporteRestanteItem, value: any) => {
    const list = [...(cajaPayment.importes_restantes || [])];
    list[index] = { ...list[index], [field]: value };
    setCajaPayment({ ...cajaPayment, importes_restantes: list });
  };

  // Métodos para lista dinámica de Caja (Selector 2 tipos + monto, sin descripción)
  const addAjusteCaja = () => {
    setCajaPayment({
      ...cajaPayment,
      ajustes: [
        ...(cajaPayment.ajustes || []),
        { id: Math.random().toString(), tipo: "interes", concepto: "", monto: 0 }
      ]
    });
  };

  const removeAjusteCaja = (index: number) => {
    const list = [...(cajaPayment.ajustes || [])];
    list.splice(index, 1);
    setCajaPayment({ ...cajaPayment, ajustes: list });
  };

  const updateAjusteCaja = (index: number, field: keyof PaymentExtraItem, value: any) => {
    const list = [...(cajaPayment.ajustes || [])];
    list[index] = { ...list[index], [field]: value };
    setCajaPayment({ ...cajaPayment, ajustes: list });
  };

  // Métodos para lista dinámica de Min Trabajo (Selector 2 tipos + monto, sin descripción)
  const addAjusteMinTrabajo = () => {
    setMinTrabajoPayment({
      ...minTrabajoPayment,
      ajustes: [
        ...(minTrabajoPayment.ajustes || []),
        { id: Math.random().toString(), tipo: "multa", concepto: "", monto: 0 }
      ]
    });
  };

  const removeAjusteMinTrabajo = (index: number) => {
    const list = [...(minTrabajoPayment.ajustes || [])];
    list.splice(index, 1);
    setMinTrabajoPayment({ ...minTrabajoPayment, ajustes: list });
  };

  const updateAjusteMinTrabajo = (index: number, field: keyof PaymentExtraItem, value: any) => {
    const list = [...(minTrabajoPayment.ajustes || [])];
    list[index] = { ...list[index], [field]: value };
    setMinTrabajoPayment({ ...minTrabajoPayment, ajustes: list });
  };

  // Comprobar si los cuadrantes 1 a 4 están bloqueados
  const isLockedCuadrantes = Boolean(sheetData?.is_locked_by_date && !isManuallyUnlocked);

  return (
    <div className="space-y-6 pb-20 max-w-[1500px] mx-auto">
      {/* 1. Header principal */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 md:p-6 transition-all">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-blue-50 text-blue-800 rounded-xl border border-blue-200">
                <BookOpen className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
                  Asientos Contables
                  <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                    Nómina & Pagos
                  </span>
                </h1>
                <p className="text-sm text-slate-500">
                  Devengamiento por departamentos, aportes patronales editables, beneficios sociales y pagos efectivos.
                </p>
              </div>
            </div>
          </div>

          {/* Selectores de Periodo y Acciones */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Selector de Mes y Año */}
            <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-xl border border-slate-200">
              <Calendar className="w-4 h-4 text-slate-500 ml-2" />
              <select
                value={selectedMonth}
                onChange={(e) => handleMonthChange(Number(e.target.value))}
                className="bg-transparent text-sm font-semibold text-slate-800 focus:outline-none cursor-pointer pr-2"
              >
                {MONTHS.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
              <span className="text-slate-300">|</span>
              <input
                type="number"
                value={selectedYear}
                onChange={(e) => handleYearChange(Number(e.target.value))}
                className="w-16 bg-transparent text-sm font-semibold text-slate-800 focus:outline-none pl-1"
                min="2020"
                max="2035"
              />
            </div>

            {/* Botones de Exportar */}
            <button
              onClick={handleExportExcel}
              disabled={exportingExcel || loading}
              className="flex items-center gap-1.5 px-3 py-2 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 rounded-xl text-xs md:text-sm font-semibold transition shadow-sm disabled:opacity-50"
              title="Exportar comprobante a Excel"
            >
              {exportingExcel ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSpreadsheet className="w-4 h-4" />}
              Excel
            </button>

            <button
              onClick={handleExportPdf}
              disabled={exportingPdf || loading}
              className="flex items-center gap-1.5 px-3 py-2 bg-red-50 text-red-700 hover:bg-red-100 border border-red-200 rounded-xl text-xs md:text-sm font-semibold transition shadow-sm disabled:opacity-50"
              title="Exportar comprobante a PDF"
            >
              {exportingPdf ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
              PDF
            </button>

            {/* Reflejar Mes Anterior */}
            <button
              onClick={handleReflejarMesAnterior}
              disabled={loading || saving}
              className="flex items-center gap-1.5 px-3 py-2 bg-amber-50 text-amber-900 hover:bg-amber-100 border border-amber-300 rounded-xl text-xs md:text-sm font-semibold transition shadow-sm disabled:opacity-50"
              title="Copiar datos, entidades de pago, transacciones y glosas del mes anterior"
            >
              <History className="w-4 h-4 text-amber-700" />
              <span className="hidden sm:inline">Reflejar Mes Anterior</span>
            </button>

            {/* Restablecer */}
            <button
              onClick={handleReset}
              disabled={loading || saving}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-300 rounded-xl text-xs md:text-sm font-medium transition"
              title="Restablecer cálculos automáticos desde la planilla"
            >
              <RotateCcw className="w-4 h-4" />
              <span className="hidden sm:inline">Restablecer</span>
            </button>

            {/* Guardar */}
            <button
              onClick={handleSave}
              disabled={loading || saving}
              className="flex items-center gap-2 px-4 py-2 bg-blue-800 text-white hover:bg-blue-900 rounded-xl text-xs md:text-sm font-bold transition shadow-md shadow-blue-900/20 disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              <span>Guardar Cambios</span>
            </button>
          </div>
        </div>

        {/* Barra de Estado y Balance */}
        <div className="mt-5 pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs md:text-sm">
          <div className="flex flex-wrap items-center gap-3">
            {/* Estado de Cuadratura */}
            <div
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border font-semibold ${
                isCuadrado
                  ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                  : "bg-red-50 text-red-800 border-red-200"
              }`}
            >
              {isCuadrado ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Balance Cuadrado: Bs. {liveTotalDebe.toLocaleString("es-BO", { minimumFractionDigits: 2 })}</span>
                </>
              ) : (
                <>
                  <AlertTriangle className="w-4 h-4 text-red-600" />
                  <span>Descuadrado: Dif. Bs. {liveDiferencia.toLocaleString("es-BO", { minimumFractionDigits: 2 })} (DEBE: {liveTotalDebe} / HABER: {liveTotalHaber})</span>
                </>
              )}
            </div>

            {/* Estado de Bloqueo por Fecha */}
            {sheetData?.is_locked_by_date ? (
              <div className="flex items-center gap-2">
                <div
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold ${
                    isManuallyUnlocked
                      ? "bg-amber-50 text-amber-800 border-amber-300"
                      : "bg-rose-50 text-rose-800 border-rose-200"
                  }`}
                >
                  {isManuallyUnlocked ? (
                    <>
                      <Unlock className="w-3.5 h-3.5 text-amber-600" />
                      <span>Edición Administrativa Habilitada</span>
                    </>
                  ) : (
                    <>
                      <Lock className="w-3.5 h-3.5 text-rose-600" />
                      <span>Periodo Cerrado por Fecha (Solo Lectura Cuadrantes 1-4)</span>
                    </>
                  )}
                </div>

                <button
                  type="button"
                  onClick={handleToggleUnlock}
                  className="text-xs text-blue-700 hover:text-blue-900 underline font-medium cursor-pointer"
                >
                  {isManuallyUnlocked ? "Volver a Proteger" : "¿Desbloquear edición?"}
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 text-xs font-medium border border-slate-200">
                <Check className="w-3.5 h-3.5 text-blue-600" />
                <span>Periodo Abierto para Edición</span>
              </div>
            )}
          </div>

          {/* Switch de Vistas */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              onClick={() => setActiveTab("guiado")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                activeTab === "guiado"
                  ? "bg-white text-blue-900 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              Panel Modular Guiado
            </button>
            <button
              onClick={() => setActiveTab("oficial")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                activeTab === "oficial"
                  ? "bg-white text-blue-900 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              Comprobante Oficial
            </button>
            <button
              onClick={() => {
                setActiveTab("historial");
                fetchAnnualHistory(selectedYear);
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                activeTab === "historial"
                  ? "bg-white text-blue-900 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <History className="w-3.5 h-3.5" />
              Historial de Asientos
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="bg-white rounded-2xl p-16 flex flex-col items-center justify-center text-slate-500 border border-slate-200">
          <Loader2 className="w-10 h-10 animate-spin text-blue-800 mb-3" />
          <p className="text-sm font-medium">Cargando asientos contables y cuadrantes...</p>
        </div>
      ) : activeTab === "guiado" ? (
        /* ================= VISTA MODULAR GUIADA (TARJETAS INTUITIVAS) ================= */
        <div className="space-y-6">
          {/* Mensaje de Bloqueo por Fecha si corresponde */}
          {isLockedCuadrantes && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3 text-amber-900">
              <ShieldAlert className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
              <div className="text-xs md:text-sm">
                <span className="font-bold">Periodo Contable Cerrado: </span>
                Los valores de nómina corresponden a un mes vencido y han sido congelados a partir del primer día del mes siguiente. Los pagos y sus adicionales continúan siendo editables.
                <span
                  onClick={handleToggleUnlock}
                  className="font-bold underline ml-1 cursor-pointer text-amber-800 hover:text-amber-950"
                >
                  Habilitar edición administrativa
                </span>
              </div>
            </div>
          )}

          {/* CUADRANTE 1: PLANILLA Y DEVENGAMIENTO DE SUELDOS (DINÁMICO POR DEPARTAMENTO) */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="bg-linear-to-r from-blue-900 to-indigo-900 text-white p-4 md:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-white/10 rounded-xl">
                  <Users className="w-5 h-5 text-blue-200" />
                </div>
                <div>
                  <h2 className="text-base md:text-lg font-bold">
                    Cuadrante 1: Devengamiento de Nómina
                  </h2>
                  <p className="text-xs text-blue-200">
                    Distribución por departamento ({devengamiento.departamentos?.length || 0} activos)
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsDeptModalOpen(true)}
                  disabled={isLockedCuadrantes}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold transition shadow-xs disabled:opacity-50"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Añadir Departamento
                </button>
                <span className="text-xs px-2.5 py-1 bg-white/20 rounded-full font-medium">
                  {isLockedCuadrantes ? "Solo Lectura" : "Editable"}
                </span>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* Tarjetas Dinámicas por Cada Departamento */}
              {devengamiento.departamentos && devengamiento.departamentos.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {devengamiento.departamentos.map((depto, idx) => {
                    const deptoTotal = Number(((Number(depto.sueldos) || 0) + (Number(depto.bono_antiguedad) || 0)).toFixed(2));
                    return (
                      <div
                        key={depto.id || `dept-${idx}-${depto.nombre}`}
                        className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3 shadow-2xs hover:border-slate-300 transition"
                      >
                        <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                          <div className="flex items-center gap-2">
                            <div className="w-2.5 h-2.5 rounded-full bg-blue-600" />
                            <span className="text-xs font-black uppercase text-slate-800 tracking-wider">
                              {depto.nombre}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-bold text-blue-900 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-100">
                              Bs. {deptoTotal.toLocaleString("es-BO", { minimumFractionDigits: 2 })}
                            </span>
                            {!isLockedCuadrantes && devengamiento.departamentos && devengamiento.departamentos.length > 2 && (
                              <button
                                type="button"
                                onClick={() => handleRemoveDepartment(idx)}
                                title={`Quitar ${depto.nombre}`}
                                className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Sueldos y Salarios de este departamento */}
                        <div className="space-y-1">
                          <label className="text-[11px] font-bold text-slate-600 block">
                            Sueldos y Salarios {depto.nombre}
                          </label>
                          <div className="relative">
                            <span className="absolute left-3 top-2 text-xs font-bold text-slate-400">Bs.</span>
                            <NumericInput
                              disabled={isLockedCuadrantes}
                              value={depto.sueldos}
                              onChange={(val) => updateDepartmentItem(idx, "sueldos", val)}
                              className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs md:text-sm font-bold text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-none disabled:bg-slate-100 text-right"
                            />
                          </div>
                        </div>

                        {/* Bono de Antigüedad de este departamento */}
                        <div className="space-y-1">
                          <label className="text-[11px] font-bold text-slate-600 block">
                            Bono de Antigüedad {depto.nombre}
                          </label>
                          <div className="relative">
                            <span className="absolute left-3 top-2 text-xs font-bold text-slate-400">Bs.</span>
                            <NumericInput
                              disabled={isLockedCuadrantes}
                              value={depto.bono_antiguedad}
                              onChange={(val) => updateDepartmentItem(idx, "bono_antiguedad", val)}
                              className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs md:text-sm font-bold text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-none disabled:bg-slate-100 text-right"
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-8 text-center bg-slate-50 border border-dashed border-slate-300 rounded-xl space-y-3">
                  <Users className="w-10 h-10 text-slate-400 mx-auto" />
                  <p className="text-sm font-medium text-slate-600">
                    No hay departamentos configurados para esta empresa.
                  </p>
                  <button
                    type="button"
                    onClick={() => setIsDeptModalOpen(true)}
                    disabled={isLockedCuadrantes}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg transition"
                  >
                    <Plus className="w-4 h-4" />
                    Añadir Primer Departamento
                  </button>
                </div>
              )}

              {/* Barra de Subtotal Total Ganado */}
              <div className="p-4 rounded-xl bg-blue-50 border border-blue-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-blue-900">
                  <Sparkles className="w-5 h-5 text-blue-700" />
                  <span className="text-sm font-bold">TOTAL GANADO DEVENGADO (DEBE):</span>
                </div>
                <div className="text-xl md:text-2xl font-black text-blue-900">
                  Bs. {totalGanado.toLocaleString("es-BO", { minimumFractionDigits: 2 })}
                </div>
              </div>

              {/* Pasivos Laborales: Retenciones de Ley y Sueldos por Pagar */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Retenciones Laborales (12.71%)
                    </label>
                    {!isLockedCuadrantes && (
                      <button
                        type="button"
                        onClick={() => {
                          const calc = Number((totalGanado * 0.1271).toFixed(2));
                          const liq = Number((totalGanado - calc).toFixed(2));
                          setDevengamiento({ ...devengamiento, retenciones_ley: calc, sueldos_por_pagar: liq });
                        }}
                        className="text-[11px] font-bold text-blue-700 hover:text-blue-900 underline"
                      >
                        Auto-calcular (12.71%)
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-xs font-bold text-slate-400">Bs.</span>
                    <NumericInput
                      disabled={isLockedCuadrantes}
                      value={devengamiento.retenciones_ley}
                      onChange={(val) => {
                        setDevengamiento({
                          ...devengamiento,
                          retenciones_ley: val,
                          sueldos_por_pagar: Number((totalGanado - val).toFixed(2))
                        });
                      }}
                      className="w-full pl-10 pr-3 py-2 bg-white border border-slate-300 rounded-lg text-sm font-bold text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-none disabled:bg-slate-100"
                    />
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Sueldos por Pagar (Líquido)
                    </label>
                    {!isLockedCuadrantes && (
                      <button
                        type="button"
                        onClick={() => {
                          const ret = Number(devengamiento.retenciones_ley) || 0;
                          setDevengamiento({ ...devengamiento, sueldos_por_pagar: Number((totalGanado - ret).toFixed(2)) });
                        }}
                        className="text-[11px] font-bold text-blue-700 hover:text-blue-900 underline"
                      >
                        Ajustar Diferencia
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-xs font-bold text-slate-400">Bs.</span>
                    <NumericInput
                      disabled={isLockedCuadrantes}
                      value={devengamiento.sueldos_por_pagar}
                      onChange={(val) => setDevengamiento({ ...devengamiento, sueldos_por_pagar: val })}
                      className="w-full pl-10 pr-3 py-2 bg-white border border-slate-300 rounded-lg text-sm font-bold text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-none disabled:bg-slate-100"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* /* FILA DE CUADRANTE 2 Y CUADRANTE 3 (CALCULADOS Y EDITABLES) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* CUADRANTE 2: APORTES PATRONALES */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col justify-between">
              <div>
                <div className="bg-emerald-800 px-6 py-4 text-white flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-white/10 rounded-lg">
                      <HeartPulse className="w-5 h-5 text-emerald-200" />
                    </div>
                    <div>
                      <h2 className="text-base font-bold">Cuadrante 2: Aportes Patronales</h2>
                    </div>
                  </div>
                  <span className="text-xs px-2.5 py-1 bg-white/20 rounded-full font-medium">17.21% Base</span>
                </div>

                <div className="p-6 space-y-4">
                  {/* Gestora Pública Patronal (7.21%) */}
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="text-xs font-bold text-slate-700 uppercase">Aportes Patronales - Gestora Pública (7.21%)</div>
                      {!isLockedCuadrantes && (
                        <button
                          type="button"
                          onClick={() => {
                            const autoVal = Number((totalGanado * 0.0721).toFixed(2));
                            setDevengamiento({ ...devengamiento, patronal_gestora: autoVal });
                          }}
                          className="text-[11px] font-bold text-emerald-700 hover:text-emerald-900 underline"
                        >
                          Auto (7.21%)
                        </button>
                      )}
                    </div>
                    <div className="relative">
                      <span className="absolute left-3 top-2.5 text-xs font-bold text-slate-400">Bs.</span>
                      <NumericInput
                        disabled={isLockedCuadrantes}
                        value={devengamiento.patronal_gestora !== undefined ? devengamiento.patronal_gestora : patronalGestora}
                        onChange={(val) => setDevengamiento({ ...devengamiento, patronal_gestora: val })}
                        className="w-full pl-10 pr-3 py-2 bg-white border border-slate-300 rounded-lg text-sm font-bold text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none disabled:bg-slate-100"
                      />
                    </div>
                  </div>

                  {/* Selector de Caja de Salud y Monto */}
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <label className="text-xs font-bold text-slate-700 uppercase">
                        Ente Gestor de Salud (10%)
                      </label>
                      <div className="flex items-center gap-2">
                        <span className="px-3 py-1.5 bg-emerald-50 text-emerald-900 font-bold text-xs rounded-lg border border-emerald-200 shadow-xs">
                          {cajaPayment.caja_tipo || devengamiento.caja_salud_choice || "Caja Petrolera de Salud"}
                        </span>
                        <span className="text-[11px] text-slate-400 italic">
                          (Configurado en Empresa)
                        </span>
                      </div>
                    </div>

                    <div className="space-y-2 pt-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-slate-600 font-semibold">
                          Aporte de Salud (10%):
                        </span>
                        {!isLockedCuadrantes && (
                          <button
                            type="button"
                            onClick={() => {
                              const autoVal = Number((totalGanado * 0.10).toFixed(2));
                              setDevengamiento({ ...devengamiento, patronal_caja: autoVal });
                            }}
                            className="text-[11px] font-bold text-emerald-700 hover:text-emerald-900 underline"
                          >
                            Auto (10%)
                          </button>
                        )}
                      </div>
                      <div className="relative">
                        <span className="absolute left-3 top-2.5 text-xs font-bold text-slate-400">Bs.</span>
                        <NumericInput
                          disabled={isLockedCuadrantes}
                          value={devengamiento.patronal_caja !== undefined ? devengamiento.patronal_caja : patronalCaja}
                          onChange={(val) => setDevengamiento({ ...devengamiento, patronal_caja: val })}
                          className="w-full pl-10 pr-3 py-2 bg-white border border-slate-300 rounded-lg text-sm font-bold text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none disabled:bg-slate-100"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-emerald-50 px-6 py-3 border-t border-emerald-100 flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-900">SUBTOTAL PATRONALES:</span>
                <span className="text-lg font-black text-emerald-900">
                  Bs. {subtotalPatronal.toLocaleString("es-BO", { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            {/* CUADRANTE 3: BENEFICIOS SOCIALES */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col justify-between">
              <div>
                <div className="bg-purple-900 px-6 py-4 text-white flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-white/10 rounded-lg">
                      <Scale className="w-5 h-5 text-purple-200" />
                    </div>
                    <div>
                      <h2 className="text-base font-bold">Cuadrante 3: Beneficios Sociales</h2>
                    </div>
                  </div>
                  <span className="text-xs px-2.5 py-1 bg-white/20 rounded-full font-medium">16.67% Base</span>
                </div>

                <div className="p-6 space-y-4">
                  {/* Aguinaldos */}
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="text-xs font-bold text-slate-700 uppercase">Aguinaldos de Navidad (8.33%)</div>
                      {!isLockedCuadrantes && (
                        <button
                          type="button"
                          onClick={() => {
                            const autoVal = Number((totalGanado * (1 / 12)).toFixed(2));
                            setDevengamiento({ ...devengamiento, aguinaldo: autoVal });
                          }}
                          className="text-[11px] font-bold text-purple-700 hover:text-purple-900 underline"
                        >
                          Auto (1/12)
                        </button>
                      )}
                    </div>
                    <div className="relative">
                      <span className="absolute left-3 top-2.5 text-xs font-bold text-slate-400">Bs.</span>
                      <NumericInput
                        disabled={isLockedCuadrantes}
                        value={devengamiento.aguinaldo !== undefined ? devengamiento.aguinaldo : aguinaldo}
                        onChange={(val) => setDevengamiento({ ...devengamiento, aguinaldo: val })}
                        className="w-full pl-10 pr-3 py-2 bg-white border border-slate-300 rounded-lg text-sm font-bold text-slate-800 focus:ring-2 focus:ring-purple-500 focus:outline-none disabled:bg-slate-100"
                      />
                    </div>
                  </div>

                  {/* Indemnizaciones */}
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="text-xs font-bold text-slate-700 uppercase">Indemnizaciones (8.33%)</div>
                      {!isLockedCuadrantes && (
                        <button
                          type="button"
                          onClick={() => {
                            const autoVal = Number((totalGanado * (1 / 12)).toFixed(2));
                            setDevengamiento({ ...devengamiento, indemnizacion: autoVal });
                          }}
                          className="text-[11px] font-bold text-purple-700 hover:text-purple-900 underline"
                        >
                          Auto (1/12)
                        </button>
                      )}
                    </div>
                    <div className="relative">
                      <span className="absolute left-3 top-2.5 text-xs font-bold text-slate-400">Bs.</span>
                      <NumericInput
                        disabled={isLockedCuadrantes}
                        value={devengamiento.indemnizacion !== undefined ? devengamiento.indemnizacion : indemnizacion}
                        onChange={(val) => setDevengamiento({ ...devengamiento, indemnizacion: val })}
                        className="w-full pl-10 pr-3 py-2 bg-white border border-slate-300 rounded-lg text-sm font-bold text-slate-800 focus:ring-2 focus:ring-purple-500 focus:outline-none disabled:bg-slate-100"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-purple-50 px-6 py-3 border-t border-purple-100 flex items-center justify-between">
                <span className="text-xs font-bold text-purple-900">SUBTOTAL BENEFICIOS:</span>
                <span className="text-lg font-black text-purple-900">
                  Bs. {subtotalBeneficios.toLocaleString("es-BO", { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </div>

          {/* CUADRANTE 4: MINISTERIO DE TRABAJO */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-amber-50 text-amber-700 rounded-xl border border-amber-200">
                <Briefcase className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Cuadrante 4: Ministerio de Trabajo (Arancel OVT)
                </h3>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-xs font-bold text-slate-600">Arancel Mensual:</span>
              <div className="relative w-36">
                <span className="absolute left-3 top-2.5 text-xs font-bold text-slate-400">Bs.</span>
                <NumericInput
                  disabled={isLockedCuadrantes}
                  value={devengamiento.arancel_min_trabajo}
                  onChange={(val) => setDevengamiento({ ...devengamiento, arancel_min_trabajo: val })}
                  className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-300 rounded-lg text-sm font-bold text-slate-800 focus:ring-2 focus:ring-amber-500 focus:outline-none disabled:bg-slate-100 text-right"
                />
              </div>
            </div>
          </div>

          {/* SEPARADOR VISUAL PARA ASIENTOS DE PAGO */}
          <div className="pt-2">
            <div className="flex items-center gap-3 text-slate-400 my-2">
              <div className="h-px bg-slate-200 flex-1" />
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-600 bg-slate-100 px-4 py-1.5 rounded-full border border-slate-200">
                <Receipt className="w-4 h-4 text-blue-700" />
                Asientos de Cancelación Efectiva (Comprobantes de Pago)
              </div>
              <div className="h-px bg-slate-200 flex-1" />
            </div>
          </div>

          {/* ASIENTO 5: CANCELACIÓN GESTORA PÚBLICA */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="bg-gradient-to-r from-slate-900 to-blue-950 px-6 py-4 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/10 rounded-lg">
                  <CreditCard className="w-5 h-5 text-blue-300" />
                </div>
                <div>
                  <h3 className="text-base font-bold">Asiento de Pago: Gestora Pública</h3>
                  <p className="text-xs text-slate-300">
                    Cancelación de Retenciones Laborales y Aporte Patronal Gestora
                  </p>
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs text-slate-300">Total a Pagar Gestora:</div>
                <div className="text-lg font-black text-white">
                  Bs. {totalPagoGestora.toLocaleString("es-BO", { minimumFractionDigits: 2 })}
                </div>
              </div>
            </div>

            <div className="p-6 space-y-5">
              {/* Metadatos de Pago: Fecha y N° Transacción */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 pb-4 border-b border-slate-100">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-600">Fecha de Pago:</label>
                  <input
                    type="date"
                    value={gestoraPayment.fecha || ""}
                    onChange={(e) => setGestoraPayment({ ...gestoraPayment, fecha: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs md:text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-600">N° Transacción / Documento:</label>
                  <input
                    type="text"
                    placeholder="Ej. TRANS-49102"
                    value={gestoraPayment.nro_transaccion || ""}
                    onChange={(e) => setGestoraPayment({ ...gestoraPayment, nro_transaccion: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs md:text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-[11px] font-medium text-slate-500 block">Base Retenciones:</span>
                  <span className="text-sm font-bold text-slate-800">
                    Bs. {Number(devengamiento.retenciones_ley || 0).toLocaleString("es-BO", { minimumFractionDigits: 2 })}
                  </span>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-[11px] font-medium text-slate-500 block">Base Patronal Gestora:</span>
                  <span className="text-sm font-bold text-slate-800">
                    Bs. {patronalGestora.toLocaleString("es-BO", { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              {/* FILA(S) DE IMPORTES RESTANTES (DEDUCCIÓN DE SALDO DIFERIDO GESTORA) */}
              <div className="p-4 rounded-xl bg-amber-50/70 border border-amber-200/80 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-amber-200/70 pb-2.5">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-amber-100 text-amber-800 rounded-lg">
                      <Scale className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-amber-950 uppercase tracking-wide">
                        Importes Restantes (Saldo Diferido / Pago Parcial)
                      </h4>
                      <p className="text-[11px] text-amber-800/80">
                        Monto no cancelado este mes. Se distribuye proporcionalmente entre Retenciones y Aporte Patronal Gestora.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={addImporteRestanteGestora}
                    className="self-start sm:self-auto flex items-center gap-1.5 text-xs px-3 py-1.5 bg-amber-100 hover:bg-amber-200 text-amber-900 rounded-lg font-bold border border-amber-300 transition shadow-xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Agregar Importe Restante
                  </button>
                </div>

                {/* Filas dinámicas alineadas con las 4 columnas superiores */}
                <div className="space-y-3">
                  {gestoraDeduccionCalc.items.map((item, idx) => {
                    const isChecked = item.activo !== false;
                    const hasMonto = Number(item.monto) > 0;
                    return (
                      <div
                        key={item.id || idx}
                        className={`p-3.5 rounded-xl border transition-all space-y-3 ${
                          isChecked && hasMonto
                            ? "bg-white border-amber-300 shadow-xs"
                            : isChecked
                            ? "bg-white/80 border-slate-200"
                            : "bg-slate-50/70 border-slate-200 opacity-60"
                        }`}
                      >
                        {/* Cabecera del Item: Checkbox + Título + Campo Descripción + Botón Eliminar */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2.5 border-b border-amber-100">
                          <div className="flex items-center gap-2.5">
                            <input
                              type="checkbox"
                              id={`ir-gestora-check-${idx}`}
                              checked={isChecked}
                              onChange={(e) => updateImporteRestanteGestora(idx, "activo", e.target.checked)}
                              className="w-4 h-4 text-amber-600 rounded border-slate-300 focus:ring-amber-500 cursor-pointer"
                            />
                            <label
                              htmlFor={`ir-gestora-check-${idx}`}
                              className="text-xs font-bold text-slate-800 cursor-pointer flex items-center gap-1.5 select-none"
                            >
                              <span>Importes Restantes</span>
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 font-extrabold">
                                #{idx + 1}
                              </span>
                            </label>
                            {isChecked ? (
                              <span className="text-[10px] bg-amber-100 text-amber-900 px-2 py-0.5 rounded-full font-semibold">
                                Diferimiento Activo
                              </span>
                            ) : (
                              <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full font-medium">
                                Inactivo (no deduce)
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-2 flex-1 sm:max-w-md">
                            <div className="relative flex-1">
                              <input
                                type="text"
                                value={item.concepto || ""}
                                disabled={!isChecked}
                                onChange={(e) => updateImporteRestanteGestora(idx, "concepto", e.target.value)}
                                placeholder="Descripción / Glosa (ej. Diferimiento cuota 1, acuerdo...)"
                                className="w-full px-3 py-1.5 bg-amber-50/40 border border-amber-200 rounded-lg text-xs font-medium text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-400 disabled:bg-slate-100 disabled:text-slate-400"
                              />
                            </div>
                            {gestoraDeduccionCalc.items.length > 1 && (
                              <button
                                type="button"
                                onClick={() => removeImporteRestanteGestora(idx)}
                                className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition"
                                title="Eliminar este importe restante"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Fila de 4 columnas perfectamente alineadas */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-center">
                          {/* Columna 1: Estado / Resumen */}
                          <div className="p-2.5 bg-slate-50/80 rounded-lg border border-slate-200 text-xs">
                            <span className="text-[10px] font-semibold text-slate-500 block uppercase tracking-wider">Estado Reducción:</span>
                            <span className="font-bold text-slate-700 flex items-center gap-1.5 mt-0.5">
                              <span className={`w-2 h-2 rounded-full ${isChecked && hasMonto ? "bg-amber-500" : isChecked ? "bg-amber-300" : "bg-slate-300"}`} />
                              {isChecked && hasMonto ? "Deducción aplicada" : isChecked ? "Listo para monto" : "Desactivado"}
                            </span>
                          </div>

                          {/* Columna 2: Total a reducir (Input) */}
                          <div className="space-y-1">
                            <label className="text-[11px] font-semibold text-slate-500 block">Total a reducir:</label>
                            <div className="relative">
                              <span className="absolute left-3 top-2 text-xs text-amber-700 font-bold">Bs.</span>
                              <NumericInput
                                value={item.monto}
                                disabled={!isChecked}
                                onChange={(val) => updateImporteRestanteGestora(idx, "monto", val)}
                                className="w-full pl-9 pr-3 py-1.5 bg-white border border-amber-300 rounded-lg text-xs md:text-sm font-bold text-amber-950 focus:outline-none focus:ring-2 focus:ring-amber-500 shadow-xs disabled:bg-slate-100 disabled:text-slate-400"
                                placeholder="0.00"
                              />
                            </div>
                          </div>

                          {/* Columna 3: Deducción en Retenciones */}
                          <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 text-xs">
                            <div className="flex items-center justify-between text-slate-600 text-[11px] mb-0.5">
                              <span className="font-semibold">Retenciones ({gestoraDeduccionCalc.pctRet.toFixed(2)}%):</span>
                            </div>
                            <div className="font-mono text-xs font-bold">
                              {isChecked && hasMonto ? (
                                <span className="text-red-600">
                                  - Bs. {item.descRet.toLocaleString("es-BO", { minimumFractionDigits: 2 })}
                                </span>
                              ) : (
                                <span className="text-slate-400 font-normal">Bs. 0.00</span>
                              )}
                            </div>
                          </div>

                          {/* Columna 4: Deducción en Patronal Gestora */}
                          <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 text-xs">
                            <div className="flex items-center justify-between text-slate-600 text-[11px] mb-0.5">
                              <span className="font-semibold">Patronal Gestora ({gestoraDeduccionCalc.pctPat.toFixed(2)}%):</span>
                            </div>
                            <div className="font-mono text-xs font-bold">
                              {isChecked && hasMonto ? (
                                <span className="text-red-600">
                                  - Bs. {item.descPat.toLocaleString("es-BO", { minimumFractionDigits: 2 })}
                                </span>
                              ) : (
                                <span className="text-slate-400 font-normal">Bs. 0.00</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Banner Informativo de Dinámica de Diferimiento */}
                <div className="p-2.5 bg-amber-100/60 rounded-lg border border-amber-200 text-xs text-amber-900 flex items-center gap-2">
                  <span className="text-base">💡</span>
                  <span>
                    <b>Información del Saldo:</b> Los montos diferidos en esta sección se acumularán automáticamente como <b>Saldos Pendientes</b> en los meses posteriores, donde dispondrá de un checklist para liquidarlos en el mes que elija.
                  </span>
                </div>

                {/* Desglose / Resumen de distribución y Total Base Efectiva */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
                  <div className="p-3 bg-white rounded-xl border border-amber-200 text-xs space-y-1">
                    <div className="flex items-center justify-between text-slate-600">
                      <span className="font-semibold">Retenciones Laborales:</span>
                      <span className="font-bold text-amber-800">{gestoraDeduccionCalc.pctRet.toFixed(2)}%</span>
                    </div>
                    <div className="flex items-center justify-between text-slate-500 text-[11px]">
                      <span>Total Deducido:</span>
                      <span className="font-mono text-red-600 font-semibold">- Bs. {gestoraDeduccionCalc.totalDescRet.toLocaleString("es-BO", { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex items-center justify-between border-t border-slate-100 pt-1 font-bold text-slate-800">
                      <span>Neto a Cancelar:</span>
                      <span className="font-mono text-emerald-700">Bs. {gestoraDeduccionCalc.netoRet.toLocaleString("es-BO", { minimumFractionDigits: 2 })}</span>
                    </div>
                  </div>

                  <div className="p-3 bg-white rounded-xl border border-amber-200 text-xs space-y-1">
                    <div className="flex items-center justify-between text-slate-600">
                      <span className="font-semibold">Patronal Gestora:</span>
                      <span className="font-bold text-amber-800">{gestoraDeduccionCalc.pctPat.toFixed(2)}%</span>
                    </div>
                    <div className="flex items-center justify-between text-slate-500 text-[11px]">
                      <span>Total Deducido:</span>
                      <span className="font-mono text-red-600 font-semibold">- Bs. {gestoraDeduccionCalc.totalDescPat.toLocaleString("es-BO", { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex items-center justify-between border-t border-slate-100 pt-1 font-bold text-slate-800">
                      <span>Neto a Cancelar:</span>
                      <span className="font-mono text-emerald-700">Bs. {gestoraDeduccionCalc.netoPat.toLocaleString("es-BO", { minimumFractionDigits: 2 })}</span>
                    </div>
                  </div>

                  <div className="p-3 bg-gradient-to-br from-amber-50 to-amber-100/80 rounded-xl border border-amber-300 text-xs space-y-1.5 flex flex-col justify-between">
                    <div className="flex items-center justify-between font-bold text-amber-950">
                      <span>Total Base Efectiva:</span>
                      <span className="font-mono text-base text-amber-900">Bs. {gestoraDeduccionCalc.baseEfectiva.toLocaleString("es-BO", { minimumFractionDigits: 2 })}</span>
                    </div>
                    <p className="text-[11px] text-amber-800/90 leading-tight">
                      {gestoraDeduccionCalc.totalImpRestante > 0
                        ? `Se difiere un saldo total de Bs. ${gestoraDeduccionCalc.totalImpRestante.toFixed(2)} para regularización en meses posteriores.`
                        : "Sin saldo diferido. Se cancela el 100% de las bases devengadas."}
                    </p>
                  </div>
                </div>
              </div>

              {/* SALDOS PENDIENTES DE MESES ANTERIORES (GESTORA PÚBLICA) */}
              {Boolean(gestoraPayment.pagos_restantes_anteriores && gestoraPayment.pagos_restantes_anteriores.length > 0) && (
                <div className="p-4 rounded-xl bg-blue-50/80 border border-blue-200 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-blue-200/60 pb-2">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 bg-blue-100 text-blue-800 rounded-lg">
                        <History className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-blue-950 uppercase tracking-wide">
                          Saldos Pendientes de Meses Anteriores ({gestoraPayment.pagos_restantes_anteriores?.length})
                        </h4>
                        <p className="text-[11px] text-blue-800/80">
                          Checklist de regularización: Seleccione qué saldo diferido desea cancelar y liquidar en este mes.
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-blue-600 block uppercase font-semibold">Total a Liquidar este mes:</span>
                      <span className="text-xs font-mono font-black text-blue-950">
                        + Bs. {sumPriorGestora.toLocaleString("es-BO", { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2.5">
                    {(gestoraPayment.pagos_restantes_anteriores || []).map((saldo, sIdx) => {
                      const mName = MONTHS.find(m => m.id === saldo.month_origen)?.name || `Mes ${saldo.month_origen}`;
                      const subtotalSaldo = Number(((Number(saldo.monto_restante) || 0) + (Number(saldo.interes_mora) || 0)).toFixed(2));
                      const isSelected = Boolean(saldo.pagar_en_este_mes);

                      return (
                        <div
                          key={saldo.id || sIdx}
                          className={`p-3.5 rounded-xl border transition-all ${
                            isSelected
                              ? "bg-white border-blue-500 shadow-xs ring-1 ring-blue-400"
                              : "bg-white/70 border-slate-200 opacity-80"
                          }`}
                        >
                          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                            {/* Checkbox + Info Origen + Descripción */}
                            <div className="flex items-start gap-3 flex-1">
                              <input
                                type="checkbox"
                                id={`gestora-saldo-${sIdx}`}
                                checked={isSelected}
                                onChange={() => togglePriorGestora(sIdx)}
                                className="w-5 h-5 mt-0.5 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
                              />
                              <div className="space-y-1.5 flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <label htmlFor={`gestora-saldo-${sIdx}`} className="text-xs font-bold text-slate-900 cursor-pointer flex items-center gap-2">
                                    <span>Saldo Origen: {mName} {saldo.year_origen}</span>
                                  </label>
                                  {isSelected ? (
                                    <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                                      <Check className="w-3 h-3" /> Se sumará al pago de este mes (+ Bs. {subtotalSaldo.toFixed(2)})
                                    </span>
                                  ) : (
                                    <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-medium">
                                      Pendiente (No se sumará este mes)
                                    </span>
                                  )}
                                </div>

                                {/* Descripción / Motivo original si existe */}
                                {saldo.concepto ? (
                                  <div className="text-[11px] text-slate-700 bg-amber-50/70 border border-amber-200/70 px-2.5 py-1 rounded-md">
                                    <span className="font-semibold text-amber-900">Motivo diferido: </span>
                                    <span>{saldo.concepto}</span>
                                  </div>
                                ) : (
                                  <div className="text-[11px] text-slate-400 italic">
                                    Sin descripción registrada al diferir.
                                  </div>
                                )}

                                {/* Desglose de Retenciones y Patronal */}
                                <div className="text-[11px] text-slate-500 flex items-center gap-2 flex-wrap">
                                  <span>Saldo capital: <b className="text-slate-800">Bs. {Number(saldo.monto_restante).toLocaleString("es-BO", { minimumFractionDigits: 2 })}</b></span>
                                  {((Number(saldo.monto_retenciones) || 0) > 0 || (Number(saldo.monto_patronal) || 0) > 0) && (
                                    <span className="text-slate-400">
                                      (Retenciones: Bs. {Number(saldo.monto_retenciones || 0).toFixed(2)} | Patronal: Bs. {Number(saldo.monto_patronal || 0).toFixed(2)})
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Interés / Mora y Subtotal */}
                            <div className="flex items-center gap-4 self-end md:self-auto border-t md:border-t-0 pt-2 md:pt-0 border-slate-100 w-full md:w-auto justify-between md:justify-end">
                              <div className="flex items-center gap-1.5">
                                <label className="text-[11px] font-bold text-slate-600 whitespace-nowrap">
                                  Interés / Mora:
                                </label>
                                <div className="relative w-28">
                                  <span className="absolute left-2.5 top-1.5 text-[11px] text-slate-400 font-bold">Bs.</span>
                                  <NumericInput
                                    value={saldo.interes_mora}
                                    disabled={!isSelected}
                                    onChange={(val) => updatePriorGestoraMora(sIdx, val)}
                                    className="w-full pl-8 pr-2 py-1 bg-white border border-slate-300 rounded text-xs font-bold text-slate-800 text-right focus:outline-none focus:border-blue-500 disabled:bg-slate-100"
                                    placeholder="0.00"
                                  />
                                </div>
                              </div>

                              <div className="text-right min-w-[110px]">
                                <span className="text-[10px] text-slate-400 block font-semibold uppercase">Total Liquidar:</span>
                                <span className={`text-xs font-mono font-black ${isSelected ? "text-emerald-700 text-sm" : "text-slate-400"}`}>
                                  {isSelected ? `+ Bs. ${subtotalSaldo.toLocaleString("es-BO", { minimumFractionDigits: 2 })}` : `Bs. ${subtotalSaldo.toLocaleString("es-BO", { minimumFractionDigits: 2 })}`}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Lista Dinámica de Intereses Gestora (Selector tipo + monto) */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                      Adicionales de Gestora Pública (Intereses / Recargos)
                    </span>
                    <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-semibold">
                      {(gestoraPayment.intereses || []).length} items
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={addInteresGestora}
                    className="flex items-center gap-1 text-xs px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg font-bold border border-blue-200 transition"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Agregar Interés / Recargo
                  </button>
                </div>

                {(gestoraPayment.intereses || []).length === 0 ? (
                  <p className="text-xs text-slate-400 italic bg-slate-50 p-3 rounded-lg border border-dashed border-slate-200">
                    No se han registrado intereses adicionales para este pago de Gestora.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {gestoraPayment.intereses.map((item, idx) => (
                      <div
                        key={item.id || idx}
                        className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 p-2.5 bg-slate-50 rounded-xl border border-slate-200"
                      >
                        <select
                          value={item.tipo || "interes"}
                          onChange={(e) => updateInteresGestora(idx, "tipo", e.target.value)}
                          className="w-full sm:w-44 px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-700 focus:outline-none focus:border-blue-500"
                        >
                          <option value="interes">Interés por Mora</option>
                          <option value="actualizacion">Actualización</option>
                          <option value="multa">Multa / Recargo</option>
                        </select>
                        <input
                          type="text"
                          value={item.concepto || ""}
                          onChange={(e) => updateInteresGestora(idx, "concepto", e.target.value)}
                          placeholder="Descripción / Concepto (opcional)..."
                          className="flex-1 px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-700 placeholder:text-slate-400 focus:outline-none focus:border-blue-500"
                        />
                        <div className="relative w-full sm:w-36">
                          <span className="absolute left-3 top-2 text-xs text-slate-400 font-bold">Bs.</span>
                          <NumericInput
                            value={item.monto}
                            onChange={(val) => updateInteresGestora(idx, "monto", val)}
                            className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800 text-right focus:outline-none focus:border-blue-500"
                            placeholder="0.00"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => removeInteresGestora(idx)}
                          className="self-end sm:self-auto p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition"
                          title="Eliminar adicional"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ASIENTO 6: CANCELACIÓN CAJA DE SALUD */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="bg-gradient-to-r from-emerald-900 to-teal-950 px-6 py-4 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/10 rounded-lg">
                  <HeartPulse className="w-5 h-5 text-emerald-300" />
                </div>
                <div>
                  <h3 className="text-base font-bold">
                    Asiento de Pago: {cajaPayment.caja_tipo || devengamiento.caja_salud_choice}
                  </h3>
                  <p className="text-xs text-emerald-200">
                    Cancelación de Aporte Patronal al Ente Gestor de Salud
                  </p>
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs text-emerald-200">Total a Pagar Caja:</div>
                <div className="text-lg font-black text-white">
                  Bs. {totalPagoCaja.toLocaleString("es-BO", { minimumFractionDigits: 2 })}
                </div>
              </div>
            </div>

            <div className="p-6 space-y-5">
              {/* Metadatos de Pago: Fecha y N° Transacción */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pb-4 border-b border-slate-100">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-600">Fecha de Pago:</label>
                  <input
                    type="date"
                    value={cajaPayment.fecha || ""}
                    onChange={(e) => setCajaPayment({ ...cajaPayment, fecha: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs md:text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-600">N° Transacción / Depósito:</label>
                  <input
                    type="text"
                    placeholder="Ej. DP-883910"
                    value={cajaPayment.nro_transaccion || ""}
                    onChange={(e) => setCajaPayment({ ...cajaPayment, nro_transaccion: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs md:text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-[11px] font-medium text-slate-500 block">Base Aporte Salud:</span>
                  <span className="text-sm font-bold text-slate-800">
                    Bs. {patronalCaja.toLocaleString("es-BO", { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              {/* FILA(S) DE IMPORTES RESTANTES (DEDUCCIÓN DE SALDO DIFERIDO CAJA) */}
              <div className="p-4 rounded-xl bg-amber-50/70 border border-amber-200/80 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-amber-200/70 pb-2.5">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-amber-100 text-amber-800 rounded-lg">
                      <Scale className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-amber-950 uppercase tracking-wide">
                        Importes Restantes (Saldo Diferido / Pago Parcial)
                      </h4>
                      <p className="text-[11px] text-amber-800/80">
                        Monto pendiente que no se cancela este mes. Se deduce directamente del aporte patronal de salud.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={addImporteRestanteCaja}
                    className="self-start sm:self-auto flex items-center gap-1.5 text-xs px-3 py-1.5 bg-amber-100 hover:bg-amber-200 text-amber-900 rounded-lg font-bold border border-amber-300 transition shadow-xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Agregar Importe Restante
                  </button>
                </div>

                {/* Filas dinámicas alineadas con las 3 columnas superiores */}
                <div className="space-y-3">
                  {cajaDeduccionCalc.items.map((item, idx) => {
                    const isChecked = item.activo !== false;
                    const hasMonto = Number(item.monto) > 0;
                    return (
                      <div
                        key={item.id || idx}
                        className={`p-3.5 rounded-xl border transition-all space-y-3 ${
                          isChecked && hasMonto
                            ? "bg-white border-amber-300 shadow-xs"
                            : isChecked
                            ? "bg-white/80 border-slate-200"
                            : "bg-slate-50/70 border-slate-200 opacity-60"
                        }`}
                      >
                        {/* Cabecera del Item: Checkbox + Título + Campo Descripción + Botón Eliminar */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2.5 border-b border-amber-100">
                          <div className="flex items-center gap-2.5">
                            <input
                              type="checkbox"
                              id={`ir-caja-check-${idx}`}
                              checked={isChecked}
                              onChange={(e) => updateImporteRestanteCaja(idx, "activo", e.target.checked)}
                              className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500 cursor-pointer"
                            />
                            <label
                              htmlFor={`ir-caja-check-${idx}`}
                              className="text-xs font-bold text-slate-800 cursor-pointer flex items-center gap-1.5 select-none"
                            >
                              <span>Importes Restantes</span>
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 font-extrabold">
                                #{idx + 1}
                              </span>
                            </label>
                            {isChecked ? (
                              <span className="text-[10px] bg-emerald-100 text-emerald-900 px-2 py-0.5 rounded-full font-semibold">
                                Diferimiento Activo
                              </span>
                            ) : (
                              <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full font-medium">
                                Inactivo (no deduce)
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-2 flex-1 sm:max-w-md">
                            <div className="relative flex-1">
                              <input
                                type="text"
                                value={item.concepto || ""}
                                disabled={!isChecked}
                                onChange={(e) => updateImporteRestanteCaja(idx, "concepto", e.target.value)}
                                placeholder="Descripción / Glosa (ej. Pago diferido mes X, acuerdo...)"
                                className="w-full px-3 py-1.5 bg-amber-50/40 border border-amber-200 rounded-lg text-xs font-medium text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:bg-slate-100 disabled:text-slate-400"
                              />
                            </div>
                            {cajaDeduccionCalc.items.length > 1 && (
                              <button
                                type="button"
                                onClick={() => removeImporteRestanteCaja(idx)}
                                className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition"
                                title="Eliminar este importe restante"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Fila de 3 columnas perfectamente alineadas */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 items-center">
                          {/* Columna 1: Estado / Resumen */}
                          <div className="p-2.5 bg-slate-50/80 rounded-lg border border-slate-200 text-xs">
                            <span className="text-[10px] font-semibold text-slate-500 block uppercase tracking-wider">Estado Reducción:</span>
                            <span className="font-bold text-slate-700 flex items-center gap-1.5 mt-0.5">
                              <span className={`w-2 h-2 rounded-full ${isChecked && hasMonto ? "bg-emerald-500" : isChecked ? "bg-emerald-300" : "bg-slate-300"}`} />
                              {isChecked && hasMonto ? "Deducción aplicada" : isChecked ? "Listo para monto" : "Desactivado"}
                            </span>
                          </div>

                          {/* Columna 2: Total a reducir (Input) */}
                          <div className="space-y-1">
                            <label className="text-[11px] font-semibold text-slate-500 block">Total a reducir:</label>
                            <div className="relative">
                              <span className="absolute left-3 top-2 text-xs text-amber-700 font-bold">Bs.</span>
                              <NumericInput
                                value={item.monto}
                                disabled={!isChecked}
                                onChange={(val) => updateImporteRestanteCaja(idx, "monto", val)}
                                className="w-full pl-9 pr-3 py-1.5 bg-white border border-amber-300 rounded-lg text-xs md:text-sm font-bold text-amber-950 focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-xs disabled:bg-slate-100 disabled:text-slate-400"
                                placeholder="0.00"
                              />
                            </div>
                          </div>

                          {/* Columna 3: Deducción en Aporte Salud */}
                          <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 text-xs">
                            <div className="flex items-center justify-between text-slate-600 text-[11px] mb-0.5">
                              <span className="font-semibold">Aporte Salud (100%):</span>
                            </div>
                            <div className="font-mono text-xs font-bold">
                              {isChecked && hasMonto ? (
                                <span className="text-red-600">
                                  - Bs. {Number(item.monto).toLocaleString("es-BO", { minimumFractionDigits: 2 })}
                                </span>
                              ) : (
                                <span className="text-slate-400 font-normal">Bs. 0.00</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Banner Informativo de Dinámica de Diferimiento */}
                <div className="p-2.5 bg-amber-100/60 rounded-lg border border-amber-200 text-xs text-amber-900 flex items-center gap-2">
                  <span className="text-base">💡</span>
                  <span>
                    <b>Información del Saldo:</b> Los montos diferidos de la Caja de Salud se acumularán automáticamente como <b>Saldos Pendientes</b> en los meses posteriores, donde dispondrá de un checklist para liquidarlos en el mes que elija.
                  </span>
                </div>

                {/* Desglose / Resumen Caja */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                  <div className="p-3 bg-white rounded-xl border border-amber-200 text-xs space-y-1">
                    <div className="flex items-center justify-between text-slate-600">
                      <span className="font-semibold">Base Aporte Salud:</span>
                      <span className="font-mono font-bold text-slate-800">Bs. {cajaDeduccionCalc.baseSalud.toLocaleString("es-BO", { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex items-center justify-between text-slate-500 text-[11px]">
                      <span>Total Deducido (Saldo diferido):</span>
                      <span className="font-mono text-red-600 font-semibold">- Bs. {cajaDeduccionCalc.totalImpRestante.toLocaleString("es-BO", { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex items-center justify-between border-t border-slate-100 pt-1 font-bold text-slate-800">
                      <span>Neto a Cancelar Este Mes:</span>
                      <span className="font-mono text-emerald-700">Bs. {cajaDeduccionCalc.netoSalud.toLocaleString("es-BO", { minimumFractionDigits: 2 })}</span>
                    </div>
                  </div>

                  <div className="p-3 bg-gradient-to-br from-amber-50 to-amber-100/80 rounded-xl border border-amber-300 text-xs space-y-1.5 flex flex-col justify-between">
                    <div className="flex items-center justify-between font-bold text-amber-950">
                      <span>Total Base Efectiva Caja:</span>
                      <span className="font-mono text-base text-amber-900">Bs. {cajaDeduccionCalc.netoSalud.toLocaleString("es-BO", { minimumFractionDigits: 2 })}</span>
                    </div>
                    <p className="text-[11px] text-amber-800/90 leading-tight">
                      {cajaDeduccionCalc.totalImpRestante > 0
                        ? `Se difiere un saldo total de Bs. ${cajaDeduccionCalc.totalImpRestante.toFixed(2)} para su regularización en meses posteriores.`
                        : "Sin saldo diferido. Se cancela el 100% del aporte devengado."}
                    </p>
                  </div>
                </div>
              </div>

              {/* SALDOS PENDIENTES DE MESES ANTERIORES (CAJA DE SALUD) */}
              {Boolean(cajaPayment.pagos_restantes_anteriores && cajaPayment.pagos_restantes_anteriores.length > 0) && (
                <div className="p-4 rounded-xl bg-teal-50/80 border border-teal-200 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-teal-200/60 pb-2">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 bg-teal-100 text-teal-800 rounded-lg">
                        <History className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-teal-950 uppercase tracking-wide">
                          Saldos Pendientes de Meses Anteriores ({cajaPayment.pagos_restantes_anteriores?.length})
                        </h4>
                        <p className="text-[11px] text-teal-800/80">
                          Checklist de regularización: Seleccione qué saldo diferido desea cancelar y liquidar en este mes.
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-teal-600 block uppercase font-semibold">Total a Liquidar este mes:</span>
                      <span className="text-xs font-mono font-black text-teal-950">
                        + Bs. {sumPriorCaja.toLocaleString("es-BO", { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2.5">
                    {(cajaPayment.pagos_restantes_anteriores || []).map((saldo, sIdx) => {
                      const mName = MONTHS.find(m => m.id === saldo.month_origen)?.name || `Mes ${saldo.month_origen}`;
                      const subtotalSaldo = Number(((Number(saldo.monto_restante) || 0) + (Number(saldo.interes_mora) || 0)).toFixed(2));
                      const isSelected = Boolean(saldo.pagar_en_este_mes);

                      return (
                        <div
                          key={saldo.id || sIdx}
                          className={`p-3.5 rounded-xl border transition-all ${
                            isSelected
                              ? "bg-white border-teal-500 shadow-xs ring-1 ring-teal-400"
                              : "bg-white/70 border-slate-200 opacity-80"
                          }`}
                        >
                          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                            {/* Checkbox + Info Origen + Descripción */}
                            <div className="flex items-start gap-3 flex-1">
                              <input
                                type="checkbox"
                                id={`caja-saldo-${sIdx}`}
                                checked={isSelected}
                                onChange={() => togglePriorCaja(sIdx)}
                                className="w-5 h-5 mt-0.5 text-teal-600 rounded border-slate-300 focus:ring-teal-500 cursor-pointer"
                              />
                              <div className="space-y-1.5 flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <label htmlFor={`caja-saldo-${sIdx}`} className="text-xs font-bold text-slate-900 cursor-pointer flex items-center gap-2">
                                    <span>Saldo Origen: {mName} {saldo.year_origen}</span>
                                  </label>
                                  {isSelected ? (
                                    <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                                      <Check className="w-3 h-3" /> Se sumará al pago de este mes (+ Bs. {subtotalSaldo.toFixed(2)})
                                    </span>
                                  ) : (
                                    <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-medium">
                                      Pendiente (No se sumará este mes)
                                    </span>
                                  )}
                                </div>

                                {/* Descripción / Motivo original si existe */}
                                {saldo.concepto ? (
                                  <div className="text-[11px] text-slate-700 bg-teal-50/70 border border-teal-200/70 px-2.5 py-1 rounded-md">
                                    <span className="font-semibold text-teal-900">Motivo diferido: </span>
                                    <span>{saldo.concepto}</span>
                                  </div>
                                ) : (
                                  <div className="text-[11px] text-slate-400 italic">
                                    Sin descripción registrada al diferir.
                                  </div>
                                )}

                                <div className="text-[11px] text-slate-500">
                                  <span>Saldo capital: <b className="text-slate-800">Bs. {Number(saldo.monto_restante).toLocaleString("es-BO", { minimumFractionDigits: 2 })}</b></span>
                                </div>
                              </div>
                            </div>

                            {/* Interés / Actualización y Subtotal */}
                            <div className="flex items-center gap-4 self-end md:self-auto border-t md:border-t-0 pt-2 md:pt-0 border-slate-100 w-full md:w-auto justify-between md:justify-end">
                              <div className="flex items-center gap-1.5">
                                <label className="text-[11px] font-bold text-slate-600 whitespace-nowrap">
                                  Interés / Actualización:
                                </label>
                                <div className="relative w-28">
                                  <span className="absolute left-2.5 top-1.5 text-[11px] text-slate-400 font-bold">Bs.</span>
                                  <NumericInput
                                    value={saldo.interes_mora}
                                    disabled={!isSelected}
                                    onChange={(val) => updatePriorCajaMora(sIdx, val)}
                                    className="w-full pl-8 pr-2 py-1 bg-white border border-slate-300 rounded text-xs font-bold text-slate-800 text-right focus:outline-none focus:border-teal-500 disabled:bg-slate-100"
                                    placeholder="0.00"
                                  />
                                </div>
                              </div>

                              <div className="text-right min-w-[110px]">
                                <span className="text-[10px] text-slate-400 block font-semibold uppercase">Total Liquidar:</span>
                                <span className={`text-xs font-mono font-black ${isSelected ? "text-emerald-700 text-sm" : "text-slate-400"}`}>
                                  {isSelected ? `+ Bs. ${subtotalSaldo.toLocaleString("es-BO", { minimumFractionDigits: 2 })}` : `Bs. ${subtotalSaldo.toLocaleString("es-BO", { minimumFractionDigits: 2 })}`}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Lista Dinámica de Intereses y Actualizaciones (Selector 2 tipos + monto) */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                      Intereses y Actualizaciones UFV (Caja de Salud)
                    </span>
                    <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-semibold">
                      {(cajaPayment.ajustes || []).length} items
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={addAjusteCaja}
                    className="flex items-center gap-1 text-xs px-3 py-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-lg font-bold border border-emerald-200 transition"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Agregar Ajuste
                  </button>
                </div>

                {(cajaPayment.ajustes || []).length === 0 ? (
                  <p className="text-xs text-slate-400 italic bg-slate-50 p-3 rounded-lg border border-dashed border-slate-200">
                    No se han registrado intereses ni actualizaciones para la Caja de Salud.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {cajaPayment.ajustes.map((item, idx) => (
                      <div
                        key={item.id || idx}
                        className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 p-2.5 bg-slate-50 rounded-xl border border-slate-200"
                      >
                        <select
                          value={item.tipo || "interes"}
                          onChange={(e) => updateAjusteCaja(idx, "tipo", e.target.value)}
                          className="w-full sm:w-44 px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-700 focus:outline-none focus:border-emerald-500"
                        >
                          <option value="interes">Interés por Mora</option>
                          <option value="actualizacion">Actualización UFV</option>
                        </select>
                        <input
                          type="text"
                          value={item.concepto || ""}
                          onChange={(e) => updateAjusteCaja(idx, "concepto", e.target.value)}
                          placeholder="Descripción / Concepto (opcional)..."
                          className="flex-1 px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-700 placeholder:text-slate-400 focus:outline-none focus:border-emerald-500"
                        />
                        <div className="relative w-full sm:w-36">
                          <span className="absolute left-3 top-2 text-xs text-slate-400 font-bold">Bs.</span>
                          <NumericInput
                            value={item.monto}
                            onChange={(val) => updateAjusteCaja(idx, "monto", val)}
                            className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800 text-right focus:outline-none focus:border-emerald-500"
                            placeholder="0.00"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => removeAjusteCaja(idx)}
                          className="self-end sm:self-auto p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition"
                          title="Eliminar ajuste"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ASIENTO 7: CANCELACIÓN MINISTERIO DE TRABAJO */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="bg-gradient-to-r from-amber-900 to-orange-950 px-6 py-4 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/10 rounded-lg">
                  <Briefcase className="w-5 h-5 text-amber-300" />
                </div>
                <div>
                  <h3 className="text-base font-bold">Asiento de Pago: Ministerio de Trabajo</h3>
                  <p className="text-xs text-amber-200">
                    Cancelación de Arancel Oficina Virtual de Trámites (OVT)
                  </p>
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs text-amber-200">Total a Pagar Min. Trabajo:</div>
                <div className="text-lg font-black text-white">
                  Bs. {totalPagoMinTrabajo.toLocaleString("es-BO", { minimumFractionDigits: 2 })}
                </div>
              </div>
            </div>

            <div className="p-6 space-y-5">
              {/* Metadatos de Pago: Fecha y N° Transacción */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pb-4 border-b border-slate-100">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-600">Fecha de Pago:</label>
                  <input
                    type="date"
                    value={minTrabajoPayment.fecha || ""}
                    onChange={(e) => setMinTrabajoPayment({ ...minTrabajoPayment, fecha: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs md:text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-600">N° Transacción / Comprobante:</label>
                  <input
                    type="text"
                    placeholder="Ej. OVT-10928"
                    value={minTrabajoPayment.nro_transaccion || ""}
                    onChange={(e) => setMinTrabajoPayment({ ...minTrabajoPayment, nro_transaccion: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs md:text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-[11px] font-medium text-slate-500 block">Base Arancel OVT:</span>
                  <span className="text-sm font-bold text-slate-800">
                    Bs. {arancelMt.toLocaleString("es-BO", { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              {/* Lista Dinámica de Multas e Intereses (Selector 2 tipos + monto) */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                      Multas e Intereses Ministerio de Trabajo
                    </span>
                    <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-semibold">
                      {(minTrabajoPayment.ajustes || []).length} items
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={addAjusteMinTrabajo}
                    className="flex items-center gap-1 text-xs px-3 py-1.5 bg-amber-50 text-amber-800 hover:bg-amber-100 rounded-lg font-bold border border-amber-300 transition"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Agregar Multa / Interés
                  </button>
                </div>

                {(minTrabajoPayment.ajustes || []).length === 0 ? (
                  <p className="text-xs text-slate-400 italic bg-slate-50 p-3 rounded-lg border border-dashed border-slate-200">
                    No se han registrado multas ni intereses adicionales para el Ministerio de Trabajo.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {minTrabajoPayment.ajustes.map((item, idx) => (
                      <div
                        key={item.id || idx}
                        className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 p-2.5 bg-slate-50 rounded-xl border border-slate-200"
                      >
                        <select
                          value={item.tipo || "multa"}
                          onChange={(e) => updateAjusteMinTrabajo(idx, "tipo", e.target.value)}
                          className="w-full sm:w-44 px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-700 focus:outline-none focus:border-amber-500"
                        >
                          <option value="multa">Multa presentación</option>
                          <option value="interes">Interés por mora</option>
                        </select>
                        <input
                          type="text"
                          value={item.concepto || ""}
                          onChange={(e) => updateAjusteMinTrabajo(idx, "concepto", e.target.value)}
                          placeholder="Descripción / Concepto (opcional)..."
                          className="flex-1 px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-700 placeholder:text-slate-400 focus:outline-none focus:border-amber-500"
                        />
                        <div className="relative w-full sm:w-36">
                          <span className="absolute left-3 top-2 text-xs text-slate-400 font-bold">Bs.</span>
                          <NumericInput
                            value={item.monto}
                            onChange={(val) => updateAjusteMinTrabajo(idx, "monto", val)}
                            className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800 text-right focus:outline-none focus:border-amber-500"
                            placeholder="0.00"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => removeAjusteMinTrabajo(idx)}
                          className="self-end sm:self-auto p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition"
                          title="Eliminar ajuste"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : activeTab === "oficial" ? (
        /* ================= VISTA COMPROBANTE OFICIAL (FORMATO OFICIAL CANÓNICO) ================= */
        <div className="space-y-6">
          {/* Cabecera del Panel Oficial */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
              <div>
                <h2 className="text-lg font-black text-slate-900 tracking-wide uppercase">
                  {sheetData?.tenant_name} {selectedYear}
                </h2>
                <p className="text-sm font-bold text-blue-900 uppercase">
                  COMPROBANTES CONTABLES DE NÓMINA Y APORTES - {sheetData?.month_name}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-xs text-slate-500 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
                  Expresado en Bolivianos (Bs.)
                </div>
                <button
                  onClick={handleExportExcel}
                  disabled={exportingExcel || loading}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-bold shadow-sm transition disabled:opacity-50"
                  title="Descargar mes en Excel"
                >
                  {exportingExcel ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileSpreadsheet className="w-3.5 h-3.5" />}
                  <span>Excel</span>
                </button>
                <button
                  onClick={handleExportPdf}
                  disabled={exportingPdf || loading}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-red-700 hover:bg-red-800 text-white rounded-lg text-xs font-bold shadow-sm transition disabled:opacity-50"
                  title="Descargar mes en PDF"
                >
                  {exportingPdf ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5" />}
                  <span>PDF</span>
                </button>
              </div>
            </div>
          </div>

          {/* 1. CUADRANTES 1 A 4: TABLA UNIFICADA TRADICIONAL DE DEVENGAMIENTO Y PROVISIONES (TAL COMO ESTABA ANTES) */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-md overflow-hidden">
            {/* Header Superior idéntico a la hoja contable física */}
            <div className="border-b border-slate-200 flex flex-col sm:flex-row items-stretch">
              <div className="bg-yellow-300 px-6 py-3.5 flex-1 flex items-center justify-center border-b sm:border-b-0 sm:border-r border-slate-300">
                <span className="font-black text-slate-900 text-sm sm:text-base tracking-wider uppercase">
                  {sheetData?.tenant_name} {selectedYear}
                </span>
              </div>
              <div className="bg-slate-50 sm:w-64 px-6 py-3.5 flex items-center justify-center">
                <span className="font-black text-blue-900 text-sm sm:text-base tracking-widest uppercase">
                  {sheetData?.month_name}
                </span>
              </div>
            </div>

            {/* Tabla Continua de los Cuadrantes 1 a 4 */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs md:text-sm">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 text-xs font-black uppercase tracking-wider border-b border-slate-200">
                    <th className="p-3.5 pl-6">DETALLE DE CUENTAS</th>
                    <th className="p-3.5 w-44 text-right">DEBE</th>
                    <th className="p-3.5 pr-6 w-44 text-right">HABER</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(sheetData?.sections || []).filter(s => !s.is_payment).map((section) => (
                    <React.Fragment key={section.id}>
                      {/* Cuentas de la sección */}
                      {section.items.map((item, itemIdx) => {
                        if (item.debe === 0 && item.haber === 0 && !item.subcuentas) return null;
                        return (
                          <React.Fragment key={itemIdx}>
                            <tr className="hover:bg-slate-50/70 transition">
                              <td className="p-2.5 pl-6 font-semibold text-slate-800">
                                <span>{item.cuenta}</span>
                                {item.tag && (
                                  <span className="ml-2 text-[10px] px-2 py-0.5 rounded font-normal bg-slate-100 text-slate-600">
                                    {item.tag}
                                  </span>
                                )}
                              </td>
                              <td className="p-2.5 text-right font-mono text-xs font-bold text-slate-900">
                                {item.debe > 0 ? item.debe.toLocaleString("es-BO", { minimumFractionDigits: 2 }) : ""}
                              </td>
                              <td className="p-2.5 pr-6 text-right font-mono text-xs font-bold text-slate-900">
                                {item.haber > 0 ? item.haber.toLocaleString("es-BO", { minimumFractionDigits: 2 }) : ""}
                              </td>
                            </tr>
                            {/* Subcuentas si existen */}
                            {(item.subcuentas || []).map((sub, sIdx) => (
                              <tr key={`sub-${sIdx}`} className="text-slate-500 text-xs italic bg-slate-50/40">
                                <td className="py-1 px-6 pl-10 font-normal">↳ {sub}</td>
                                <td className="py-1 px-4 text-right"></td>
                                <td className="py-1 pr-6 text-right"></td>
                              </tr>
                            ))}
                          </React.Fragment>
                        );
                      })}

                      {/* Subtotal de la sección */}
                      <tr className="bg-slate-50/90 font-bold border-t border-b border-slate-200">
                        <td className="p-2.5 pl-6 text-xs text-slate-600 uppercase tracking-wider font-bold">
                          Subtotal {section.title}
                        </td>
                        <td className="p-2.5 text-right font-mono text-xs font-black text-slate-900 border-t border-slate-300">
                          {section.subtotal_debe.toLocaleString("es-BO", { minimumFractionDigits: 2 })}
                        </td>
                        <td className="p-2.5 pr-6 text-right font-mono text-xs font-black text-slate-900 border-t border-slate-300">
                          {section.subtotal_haber.toLocaleString("es-BO", { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* 2. ASIENTOS CONTABLES DE PAGO: COMPROBANTES INDIVIDUALES CON LA PLANTILLA OFICIAL (COMPROBANTE DE EGRESO) */}
          <div className="space-y-6">
            <div className="flex items-center gap-3 pt-2">
              <div className="h-px bg-slate-200 flex-1" />
              <span className="text-xs font-black text-slate-500 uppercase tracking-widest px-3 py-1 bg-slate-100 rounded-full border border-slate-200">
                Comprobantes de Pago Efectivo (Egresos)
              </span>
              <div className="h-px bg-slate-200 flex-1" />
            </div>

            {(sheetData?.sections || []).filter(s => s.is_payment).map((section) => (
              <div
                key={section.id}
                className="bg-white rounded-xl border-2 border-slate-700 shadow-sm overflow-hidden"
              >
                {/* Encabezado Superior del Comprobante */}
                <div className="bg-slate-100 border-b-2 border-slate-700 py-2.5 px-4 flex items-center justify-between">
                  <span className="text-xs text-slate-500 font-bold uppercase">{section.title}</span>
                  <span className="text-sm font-black text-slate-900 tracking-wider uppercase">
                    {section.voucher_type || "Comprobante de Egreso"}
                  </span>
                  <span className="text-xs text-slate-600 font-mono font-bold">
                    {section.fecha || ""}
                  </span>
                </div>

                {/* Tabla de 4 Columnas Oficiales: Fecha | Detalle | Debe | Haber */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs md:text-sm">
                    <thead>
                      <tr className="border-b-2 border-slate-700 bg-slate-50 font-bold text-slate-800 text-xs uppercase tracking-wider">
                        <th className="py-2.5 px-4 w-[16%]">Fecha</th>
                        <th className="py-2.5 px-4 w-[50%]">Detalle</th>
                        <th className="py-2.5 px-4 w-[17%] text-right">Debe</th>
                        <th className="py-2.5 px-4 w-[17%] text-right">Haber</th>
                      </tr>
                    </thead>
                    <tbody>
                      {section.items.map((item, idx) => {
                        if (item.debe === 0 && item.haber === 0 && !item.subcuentas) return null;
                        const isCredit = item.haber > 0 && item.debe === 0;
                        return (
                          <React.Fragment key={idx}>
                            <tr className="hover:bg-slate-50/50 transition">
                              <td className="py-1.5 px-4 font-mono text-slate-700 text-xs">
                                {idx === 0 ? (section.fecha || "") : ""}
                              </td>
                              <td className={`py-1.5 px-4 text-slate-900 ${isCredit ? "pl-10 font-medium" : "font-normal"}`}>
                                {item.cuenta}
                                {item.tag && (
                                  <span className="ml-2 text-[10px] px-2 py-0.5 rounded font-normal bg-slate-100 text-slate-600">
                                    {item.tag}
                                  </span>
                                )}
                              </td>
                              <td className="py-1.5 px-4 text-right font-mono text-slate-900">
                                {item.debe > 0 ? item.debe.toLocaleString("es-BO", { minimumFractionDigits: 2 }) : ""}
                              </td>
                              <td className="py-1.5 px-4 text-right font-mono text-slate-900">
                                {item.haber > 0 ? item.haber.toLocaleString("es-BO", { minimumFractionDigits: 2 }) : ""}
                              </td>
                            </tr>

                            {/* Subcuentas si existen */}
                            {(item.subcuentas || []).map((sub, sIdx) => (
                              <tr key={`sub-${sIdx}`} className="text-slate-500 text-xs italic">
                                <td className="py-0.5 px-4"></td>
                                <td className="py-0.5 px-14 font-normal">{sub}</td>
                                <td className="py-0.5 px-4 text-right"></td>
                                <td className="py-0.5 px-4 text-right"></td>
                              </tr>
                            ))}
                          </React.Fragment>
                        );
                      })}

                      {/* Glosa bajo las cuentas en columna Detalle */}
                      {section.glosa && (
                        <tr>
                          <td className="py-2 px-4"></td>
                          <td className="py-2 px-4 text-xs italic text-slate-700 leading-relaxed" colSpan={3}>
                            {section.glosa}
                          </td>
                        </tr>
                      )}

                      {/* Fila Sumas iguales con doble subrayado */}
                      <tr className="font-bold text-slate-900">
                        <td className="py-2.5 px-4"></td>
                        <td className="py-2.5 px-4 text-right font-bold text-slate-900">
                          Sumas iguales
                        </td>
                        <td
                          className="py-2.5 px-4 text-right font-mono font-bold text-slate-900 border-t border-slate-700"
                          style={{ borderBottom: "3px double #0f172a" }}
                        >
                          {section.subtotal_debe.toLocaleString("es-BO", { minimumFractionDigits: 2 })}
                        </td>
                        <td
                          className="py-2.5 px-4 text-right font-mono font-bold text-slate-900 border-t border-slate-700"
                          style={{ borderBottom: "3px double #0f172a" }}
                        >
                          {section.subtotal_haber.toLocaleString("es-BO", { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>

          {/* TOTALES GENERALES CONSOLIDADOS */}
          <div className="bg-slate-100 rounded-2xl border-2 border-slate-400 p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-black text-slate-800 uppercase tracking-wide">
                Totales Generales Consolidados del Mes
              </h3>
              <p className="text-xs text-slate-600">
                Suma acumulada de débitos y créditos del periodo contable {sheetData?.month_name} {selectedYear}
              </p>
            </div>
            <div className="flex items-center gap-6">
              <div className="text-right">
                <span className="text-[11px] font-bold text-slate-500 uppercase block">Total Debe</span>
                <span className="text-base md:text-lg font-black font-mono text-slate-900 border-b-2 border-slate-800">
                  Bs. {sheetData?.total_debe.toLocaleString("es-BO", { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="text-right">
                <span className="text-[11px] font-bold text-slate-500 uppercase block">Total Haber</span>
                <span className="text-base md:text-lg font-black font-mono text-slate-900 border-b-2 border-slate-800">
                  Bs. {sheetData?.total_haber.toLocaleString("es-BO", { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="pl-4 border-l border-slate-300 flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                <span className="text-xs font-black text-emerald-800 uppercase">Balance Cuadrado</span>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* ================= VISTA HISTORIAL ANUAL DE ASIENTOS ================= */
        <div className="space-y-6">
          {/* Cabecera y Resumen Anual */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-6 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-blue-900 text-white rounded-2xl shadow-md">
                  <History className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-lg font-black text-slate-900">
                    Historial Anual de Asientos Contables ({selectedYear})
                  </h2>
                  <p className="text-xs text-slate-500">
                    Resumen mensual consolidado de nómina, cargas patronales, beneficios y pagos en {sheetData?.tenant_name}
                  </p>
                </div>
              </div>

              {/* Botón Exportar Asientos del Año */}
              <div className="flex items-center gap-3">
                <button
                  onClick={handleExportMasterExcel}
                  disabled={exportingMasterExcel}
                  className="flex items-center gap-2 px-4 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs md:text-sm font-bold shadow-md transition disabled:opacity-50"
                  title="Exportar comparativo anual de asientos contables con Debe y Haber por cada mes (Enero a Diciembre)"
                >
                  {exportingMasterExcel ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <FileSpreadsheet className="w-4 h-4" />
                  )}
                  <span>Exportar Asientos del Año</span>
                </button>
              </div>
            </div>

            {/* Tarjetas de Resumen General */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-6">
              <div className="p-4 rounded-xl bg-blue-50/70 border border-blue-100 space-y-1">
                <span className="text-xs font-bold text-blue-700 uppercase tracking-wider">Total Debe Anual</span>
                <div className="text-xl md:text-2xl font-black text-blue-900">
                  Bs. {historyData?.total_anual_debe.toLocaleString("es-BO", { minimumFractionDigits: 2 }) || "0.00"}
                </div>
                <p className="text-[11px] text-blue-600">Consolidado general de débitos del ejercicio</p>
              </div>

              <div className="p-4 rounded-xl bg-emerald-50/70 border border-emerald-100 space-y-1">
                <span className="text-xs font-bold text-emerald-700 uppercase tracking-wider">Total Haber Anual</span>
                <div className="text-xl md:text-2xl font-black text-emerald-900">
                  Bs. {historyData?.total_anual_haber.toLocaleString("es-BO", { minimumFractionDigits: 2 }) || "0.00"}
                </div>
                <p className="text-[11px] text-emerald-600">Balance cuadrado al centavo con el Debe</p>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Meses Registrados</span>
                <div className="text-xl md:text-2xl font-black text-slate-800">
                  {historyData?.meses_registrados || 0} / 12 meses
                </div>
                <p className="text-[11px] text-slate-500">Periodos contables con información procesada</p>
              </div>
            </div>
          </div>

          {/* Grid de los 12 Meses del Año */}
          {loadingHistory ? (
            <div className="bg-white rounded-2xl p-16 flex flex-col items-center justify-center text-slate-500 border border-slate-200">
              <Loader2 className="w-10 h-10 animate-spin text-blue-800 mb-3" />
              <p className="text-sm font-medium">Cargando historial mensual de asientos...</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {(historyData?.months || []).map((m) => (
                <div
                  key={m.month}
                  className={`bg-white rounded-2xl border transition shadow-sm overflow-hidden flex flex-col justify-between ${
                    m.has_data ? "border-slate-200 hover:border-blue-400 hover:shadow-md" : "border-slate-100 bg-slate-50/40 opacity-70"
                  }`}
                >
                  <div>
                    {/* Cabecera del Mes */}
                    <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-black text-slate-900 uppercase tracking-wider">
                          {m.month_name} {m.year}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {m.has_data ? (
                          <>
                            {m.is_customized ? (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800">
                                Guardado
                              </span>
                            ) : (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-blue-100 text-blue-800">
                                Planilla
                              </span>
                            )}
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-200 text-slate-700">
                              ✓ Cuadrado
                            </span>
                          </>
                        ) : (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-200 text-slate-600">
                            Sin registro
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Contenido del Mes */}
                    {m.has_data ? (
                      <div className="p-4 space-y-3 text-xs">
                        <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                          <span className="text-slate-500 font-medium">Total Balance (Debe/Haber):</span>
                          <span className="font-bold text-slate-900 font-mono">
                            Bs. {m.total_debe.toLocaleString("es-BO", { minimumFractionDigits: 2 })}
                          </span>
                        </div>

                        <div className="space-y-1.5 text-[11px] text-slate-600">
                          <div className="flex justify-between">
                            <span>Total Ganado ({m.departamentos_count} deptos):</span>
                            <span className="font-semibold text-slate-800">Bs. {m.total_ganado.toLocaleString("es-BO", { minimumFractionDigits: 2 })}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Aportes Patronales (17.21%):</span>
                            <span className="font-semibold text-slate-800">Bs. {m.patronal_total.toLocaleString("es-BO", { minimumFractionDigits: 2 })}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Beneficios Sociales (16.66%):</span>
                            <span className="font-semibold text-slate-800">Bs. {m.beneficios_total.toLocaleString("es-BO", { minimumFractionDigits: 2 })}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Líquido a Pagar:</span>
                            <span className="font-semibold text-slate-800">Bs. {m.liquido_pagable.toLocaleString("es-BO", { minimumFractionDigits: 2 })}</span>
                          </div>
                        </div>

                        {/* Pagos / Glosas */}
                        <div className="pt-2 border-t border-slate-100 space-y-1 text-[10px] text-slate-500">
                          <div className="flex items-center justify-between">
                            <span>Gestora: {m.pago_gestora?.fecha || "Pendiente"}</span>
                            <span className="font-mono text-slate-700">{m.pago_gestora?.nro_transaccion ? `N° ${m.pago_gestora.nro_transaccion}` : "S/N"}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span>Caja: {m.pago_caja?.fecha || "Pendiente"}</span>
                            <span className="font-mono text-slate-700">{m.pago_caja?.nro_transaccion ? `N° ${m.pago_caja.nro_transaccion}` : "S/N"}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span>Min. Trabajo: {m.pago_min_trabajo?.fecha || "Pendiente"}</span>
                            <span className="font-mono text-slate-700">{m.pago_min_trabajo?.nro_transaccion ? `N° ${m.pago_min_trabajo.nro_transaccion}` : "S/N"}</span>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="p-8 text-center text-slate-400 space-y-2">
                        <p className="text-xs">No hay asientos procesados para este periodo.</p>
                      </div>
                    )}
                  </div>

                  {/* Acciones del Mes */}
                  <div className="p-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-1 text-xs">
                    <button
                      onClick={() => {
                        handleMonthChange(m.month);
                        setActiveTab("guiado");
                      }}
                      className="flex-1 py-1.5 px-2 bg-blue-800 hover:bg-blue-900 text-white rounded-lg font-bold text-center transition flex items-center justify-center gap-1"
                      title="Abrir en panel modular para ver o actualizar"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>{m.has_data ? "Editar" : "Crear"}</span>
                    </button>

                    {m.has_data && (
                      <>
                        <button
                          onClick={() => {
                            handleMonthChange(m.month);
                            setActiveTab("oficial");
                          }}
                          className="py-1.5 px-2.5 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-lg font-semibold transition"
                          title="Ver comprobante contable oficial"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleExportMonthExcel(m.month)}
                          className="py-1.5 px-2.5 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 text-emerald-700 rounded-lg font-semibold transition"
                          title="Descargar Excel"
                        >
                          <FileSpreadsheet className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleExportMonthPdf(m.month)}
                          className="py-1.5 px-2.5 bg-red-50 border border-red-200 hover:bg-red-100 text-red-700 rounded-lg font-semibold transition"
                          title="Descargar PDF"
                        >
                          <FileText className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* MODAL PARA AÑADIR NUEVO DEPARTAMENTO DESDE ASIENTOS */}
      <AnimatePresence>
        {isDeptModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden"
            >
              <div className="bg-blue-900 text-white p-5 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-white/10 rounded-lg">
                    <Building className="w-5 h-5 text-blue-200" />
                  </div>
                  <div>
                    <h3 className="font-bold text-base">Nuevo Departamento</h3>
                    <p className="text-xs text-blue-200">Añadir área contable para sueldos y bonos</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsDeptModalOpen(false)}
                  className="text-white/80 hover:text-white p-1 rounded-lg hover:bg-white/10 transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCreateDepartmentFromAsientos} className="p-6 space-y-4">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1 uppercase tracking-wider">
                    Nombre del Departamento <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={newDeptName}
                    onChange={(e) => setNewDeptName(e.target.value)}
                    placeholder="Ej. Marketing, Ventas, Logística, Taller..."
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-semibold text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-600 focus:outline-none transition"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    El nombre define automáticamente la clasificación y cuenta en los asientos de nómina.
                  </p>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1 uppercase tracking-wider">
                    Descripción (Opcional)
                  </label>
                  <textarea
                    rows={2}
                    value={newDeptDesc}
                    onChange={(e) => setNewDeptDesc(e.target.value)}
                    placeholder="Detalles sobre el personal o funciones de este departamento..."
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-600 focus:outline-none transition resize-none"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsDeptModalOpen(false)}
                    className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={savingNewDept || !newDeptName.trim()}
                    className="flex items-center gap-2 px-5 py-2 bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold rounded-xl shadow-md transition disabled:opacity-50"
                  >
                    {savingNewDept ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Guardando...
                      </>
                    ) : (
                      <>
                        <Plus className="w-4 h-4" />
                        Crear Departamento
                      </>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Barra de Acciones Flotante Fija para Guardar Cambios (Modo Guiado) */}
      <AnimatePresence>
        {activeTab === "guiado" && (
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 30 }}
            className="fixed bottom-6 right-6 z-40"
          >
            <div className="bg-slate-900/95 backdrop-blur-md text-white px-5 py-3 rounded-2xl shadow-2xl border border-slate-700/80 flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className={`w-2.5 h-2.5 rounded-full ${isCuadrado ? "bg-emerald-400" : "bg-rose-500 animate-ping"}`} />
                <span className="text-xs font-bold text-slate-200">
                  {isCuadrado ? (
                    <span className="text-emerald-400">Balance Cuadrado: Bs. {liveTotalDebe.toLocaleString("es-BO", { minimumFractionDigits: 2 })}</span>
                  ) : (
                    <span className="text-rose-400">Descuadre: Bs. {liveDiferencia.toLocaleString("es-BO", { minimumFractionDigits: 2 })}</span>
                  )}
                </span>
              </div>

              <div className="h-4 w-px bg-slate-700" />

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleReset}
                  disabled={loading || saving}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-xl text-xs font-semibold transition border border-slate-700 disabled:opacity-50"
                  title="Restablecer cuadrantes a valores de la planilla"
                >
                  <RotateCcw className="w-3.5 h-3.5 inline mr-1" />
                  Restablecer
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={loading || saving}
                  className="flex items-center gap-2 px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition shadow-lg shadow-blue-600/30 disabled:opacity-50 cursor-pointer"
                  title="Guardar todos los cambios"
                >
                  {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  <span>Guardar Cambios</span>
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function AsientosPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-96 items-center justify-center">
          <Loader2 className="w-10 h-10 animate-spin text-blue-800" />
        </div>
      }
    >
      <AsientosPageContent />
    </Suspense>
  );
}
