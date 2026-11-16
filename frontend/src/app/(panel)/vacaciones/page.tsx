"use client";

import React, { useState, useEffect, Suspense, useMemo, useCallback, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Calendar as CalendarIcon,
  Search,
  Loader2,
  Download,
  Plus,
  Trash2,
  X,
  FileSpreadsheet,
  FileText,
  Clock,
  CheckCircle2,
  AlertCircle,
  Users,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Eye,
  CalendarDays,
  ShieldCheck,
  UserCheck,
  TrendingDown,
  Info,
  MousePointerClick,
  ArrowRightLeft,
  Check,
  RotateCcw,
  CalendarCheck,
  CalendarRange,
  Banknote,
  Pencil,
  Printer,
  Receipt,
  FileCheck,
  ChevronDown
} from "lucide-react";
import Swal from "sweetalert2";
import { getApiUrl } from "@/utils/api";
import {
  getStoredVacationsPeriod,
  setStoredVacationsPeriod,
  getStoredVacationsModalPeriod,
  setStoredVacationsModalPeriod
} from "@/utils/period";

interface VacationRecord {
  id: number;
  employee_id: number;
  employee_name?: string;
  tipo: string;
  fecha_inicio: string;
  fecha_fin: string;
  dias: number;
  fechas_detalle?: string[];
  motivo?: string;
  fecha_solicitud?: string | null;
  gestion: number;
  aprobado_por?: string;
  es_cierre_conciliado?: boolean;
  modo_calculo?: string;
  created_at?: string;
}

interface KardexItem {
  id: string;
  recordId?: number;
  fecha: string;
  fecha_fin: string;
  tipo: string;
  tipoLabel: string;
  diasGanados: number;
  diasTomados: number;
  saldoRestante: number;
  motivo?: string;
  fecha_solicitud?: string | null;
  es_cierre_conciliado?: boolean;
  isFractionalCierre?: boolean;
  isRecord: boolean;
  isApertura?: boolean;
  kardexIndex?: number | string;
}

interface DetailedKardexItem {
  id: string;
  recordId?: number;
  mesKey: string;
  mesLabel: string;
  fecha: string;
  fecha_fin: string;
  tipo: string;
  tipoLabel: string;
  diasGanados: number;
  diasTomados: number;
  saldoRestante: number;
  motivo?: string;
  fecha_solicitud?: string | null;
  es_cierre_conciliado?: boolean;
  isFractionalCierre?: boolean;
  diasEspecificos: string[];
  diasEspecificosFormato: string;
  isRecord: boolean;
  isApertura?: boolean;
  kardexIndex?: number | string;
}

interface MonthlySummaryItem {
  mesKey: string;
  mesLabel: string;
  diasGanados: number;
  diasTomados: number;
  saldoCierre: number;
  count: number;
}


interface EmployeeVacationSummary {
  employee_id: number;
  employee_code?: string;
  employee_name: string;
  employee_ci: string;
  employee_cargo: string;
  fecha_ingreso: string;
  fecha_afiliacion?: string;
  haber_basico?: number;
  otros?: number;
  total_ganado_mensual?: number;
  antiguedad_anios: number;
  antiguedad_meses: number;
  antiguedad_dias: number;
  antiguedad_formato: string;
  escala_dias: number;
  dias_acumulados: number;
  dias_por_anios?: number;
  dias_por_meses?: number;
  dias_por_dias?: number;
  tasa_mensual?: number;
  tasa_diaria?: number;
  dias_acumulados_fraccionado?: number;
  saldo_fraccionado?: number;
  tiene_cierre_conciliado?: boolean;
  fecha_ultimo_cierre?: string | null;
  dias_ultimo_cierre?: number;
  id_ultimo_cierre?: number | null;
  dias_a_cuenta: number;
  dias_pagados?: number;
  dias_solicitadas: number;
  dias_colectivas: number;
  total_dias_tomados: number;
  saldo_dias_pendientes: number;
  records: VacationRecord[];
}

interface CompanyVacationSummary {
  tenant_name: string;
  tenant_nit?: string;
  tenant_nro_patronal?: string;
  tenant_empleador?: string;
  tenant_empleador_ci?: string;
  total_empleados: number;
  total_dias_acumulados: number;
  total_dias_a_cuenta: number;
  total_dias_pagados?: number;
  total_dias_solicitadas: number;
  total_dias_colectivas: number;
  total_dias_tomados: number;
  total_saldo_pendiente: number;
  employees: EmployeeVacationSummary[];
}

const MONTH_NAMES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
];

const WEEK_DAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

const NUM_UNIDADES = ["", "un", "dos", "tres", "cuatro", "cinco", "seis", "siete", "ocho", "nueve", "diez", "once", "doce", "trece", "catorce", "quince", "dieciséis", "diecisiete", "dieciocho", "diecinueve", "veinte", "veintiuno", "veintidós", "veintitrés", "veinticuatro", "veinticinco", "veintiséis", "veintisiete", "veintiocho", "veintinueve"];
const NUM_DECENAS = ["", "diez", "veinte", "treinta", "cuarenta", "cincuenta", "sesenta", "setenta", "ochenta", "noventa"];
const NUM_CENTENAS = ["", "ciento", "doscientos", "trescientos", "cuatrocientos", "quinientos", "seiscientos", "setecientos", "ochocientos", "novecientos"];

function numeroALetrasEs(n: number): string {
  const num = Math.floor(Math.abs(n));
  if (num === 0) return "cero";
  if (num === 100) return "cien";
  if (num < 30) return NUM_UNIDADES[num];
  if (num < 100) {
    const u = num % 10;
    const d = Math.floor(num / 10);
    return u === 0 ? NUM_DECENAS[d] : `${NUM_DECENAS[d]} y ${NUM_UNIDADES[u]}`;
  }
  if (num < 1000) {
    const c = Math.floor(num / 100);
    const resto = num % 100;
    return resto === 0 ? (c === 1 ? "cien" : NUM_CENTENAS[c]) : `${NUM_CENTENAS[c]} ${numeroALetrasEs(resto)}`;
  }
  if (num < 1000000) {
    const miles = Math.floor(num / 1000);
    const resto = num % 1000;
    const milesStr = miles === 1 ? "mil" : `${numeroALetrasEs(miles)} mil`;
    return resto === 0 ? milesStr : `${milesStr} ${numeroALetrasEs(resto)}`;
  }
  const millones = Math.floor(num / 1000000);
  const resto = num % 1000000;
  const millStr = millones === 1 ? "un millón" : `${numeroALetrasEs(millones)} millones`;
  return resto === 0 ? millStr : `${millStr} ${numeroALetrasEs(resto)}`;
}

function formatearMontoLiteral(monto: number): string {
  const entero = Math.floor(Math.abs(monto));
  const centavos = Math.round((Math.abs(monto) - entero) * 100);
  const letras = numeroALetrasEs(entero);
  const capitalizado = letras.charAt(0).toUpperCase() + letras.slice(1);
  const centavosStr = centavos.toString().padStart(2, "0");
  return `${capitalizado} ${centavosStr}/100`;
}

function formatearDiasLiteral(dias: number): string {
  if (Number.isInteger(dias)) {
    return `${dias} (${numeroALetrasEs(dias)})`;
  }
  return `${Number(dias.toFixed(2))}`;
}

function fmtDias(val?: number | null): string {
  const v = Number(val || 0);
  if (Math.round(v * 100) % 10 !== 0) {
    return v.toFixed(2);
  }
  return v.toFixed(1);
}

function diffYMD(startStr: string, endStr: string): { anios: number; meses: number; dias: number } {
  if (!startStr || !endStr || endStr <= startStr) {
    return { anios: 0, meses: 0, dias: 0 };
  }
  const p1 = startStr.slice(0, 10).split("-").map(Number);
  const p2 = endStr.slice(0, 10).split("-").map(Number);
  if (p1.length !== 3 || p2.length !== 3) return { anios: 0, meses: 0, dias: 0 };

  let anios = p2[0] - p1[0];
  let meses = p2[1] - p1[1];
  let dias = p2[2] - p1[2];

  if (dias < 0) {
    meses -= 1;
    const prevMonth = p2[1] > 1 ? p2[1] - 1 : 12;
    const prevYear = p2[1] > 1 ? p2[0] : p2[0] - 1;
    const daysInPrev = new Date(prevYear, prevMonth, 0).getDate();
    dias += daysInPrev;
  }

  if (meses < 0) {
    anios -= 1;
    meses += 12;
  }

  return { anios: Math.max(0, anios), meses: Math.max(0, meses), dias: Math.max(0, dias) };
}

function getScaleForCompletedYears(completedYears: number): number {
  if (completedYears < 5) return 15;
  if (completedYears < 10) return 20;
  return 30;
}

function getDaysForYearIndex(yearNum: number): number {
  if (yearNum <= 5) return 15;
  if (yearNum <= 10) return 20;
  return 30;
}

function getAnnivStr(startStr: string, targetYear: number): string {
  const parts = startStr.slice(0, 10).split("-").map(Number);
  if (parts.length !== 3) return startStr;
  const [, month, day] = parts;
  const d = new Date(targetYear, month - 1, day);
  if (d.getMonth() !== month - 1) {
    return `${targetYear}-02-28`;
  }
  return `${targetYear}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function calcularLiquidacionEmpleado(
  emp: EmployeeVacationSummary,
  fechaCorteStr: string,
  excludeRecId?: number | null
) {
  const corte = (fechaCorteStr || "").slice(0, 10);
  const allRecs = [...(emp.records || [])]
    .filter(r => !excludeRecId || r.id !== excludeRecId)
    .sort((a, b) => (a.fecha_inicio.localeCompare(b.fecha_inicio) || a.id - b.id));

  const cierreRecs = allRecs.filter(r => Boolean(r.es_cierre_conciliado) && r.fecha_inicio <= corte);
  const lastCierre = cierreRecs.length > 0 ? cierreRecs[cierreRecs.length - 1] : null;

  const activeRecs = lastCierre
    ? allRecs.filter(r =>
        (r.fecha_inicio > lastCierre.fecha_inicio || (r.fecha_inicio === lastCierre.fecha_inicio && r.id > lastCierre.id))
        && r.fecha_inicio <= corte
      )
    : allRecs.filter(r => r.fecha_inicio <= corte);

  const cycleStartStr = lastCierre ? lastCierre.fecha_inicio : emp.fecha_ingreso;
  const totalTenure = diffYMD(emp.fecha_ingreso, corte);
  const cycleTenure = diffYMD(cycleStartStr, corte);

  const escala = getScaleForCompletedYears(totalTenure.anios);
  const tasaMensual = escala / 12;
  const tasaDiaria = tasaMensual / 30;

  let diasPorAnios = 0;
  if (lastCierre) {
    const startY = parseInt(lastCierre.fecha_inicio.slice(0, 4)) || new Date().getFullYear();
    for (let k = 1; k <= cycleTenure.anios; k++) {
      const annivC = getAnnivStr(lastCierre.fecha_inicio, startY + k);
      const totalAtAnniv = Math.max(1, diffYMD(emp.fecha_ingreso, annivC).anios);
      diasPorAnios += getDaysForYearIndex(totalAtAnniv);
    }
  } else {
    const y1_5 = Math.min(cycleTenure.anios, 5);
    const y6_10 = Math.max(0, Math.min(cycleTenure.anios - 5, 5));
    const y11_plus = Math.max(0, cycleTenure.anios - 10);
    diasPorAnios = y1_5 * 15 + y6_10 * 20 + y11_plus * 30;
  }

  const diasPorMeses = Number((cycleTenure.meses * tasaMensual).toFixed(2));
  const diasPorDias = Number((cycleTenure.dias * tasaDiaria).toFixed(2));
  const totalFraccionado = Number((diasPorAnios + (cycleTenure.meses * tasaMensual) + (cycleTenure.dias * tasaDiaria)).toFixed(2));
  const totalEstandar = Number(diasPorAnios.toFixed(2));

  const rebajaSolicitadas = Number(
    activeRecs.filter(r => r.tipo === "solicitada").reduce((acc, r) => acc + (Number(r.dias) || 0), 0).toFixed(2)
  );
  const rebajaColectivas = Number(
    activeRecs.filter(r => r.tipo === "colectiva").reduce((acc, r) => acc + (Number(r.dias) || 0), 0).toFixed(2)
  );
  const rebajaPagados = Number(
    activeRecs.filter(r => r.tipo === "dias_pagados" || r.tipo === "a_cuenta").reduce((acc, r) => acc + (Number(r.dias) || 0), 0).toFixed(2)
  );
  const totalRebaja = Number((rebajaSolicitadas + rebajaColectivas + rebajaPagados).toFixed(2));

  const saldoFraccionado = Number((totalFraccionado - totalRebaja).toFixed(2));
  const saldoEstandar = Number((totalEstandar - totalRebaja).toFixed(2));

  return {
    anios: cycleTenure.anios,
    meses: cycleTenure.meses,
    dias: cycleTenure.dias,
    escala,
    tasaMensual,
    tasaDiaria,
    diasPorAnios,
    diasPorMeses,
    diasPorDias,
    totalFraccionado,
    totalEstandar,
    rebajaSolicitadas,
    rebajaColectivas,
    rebajaPagados,
    totalRebaja,
    saldoFraccionado,
    saldoEstandar,
    tieneCierrePrevio: Boolean(lastCierre),
    fechaCierrePrevio: lastCierre ? lastCierre.fecha_inicio : null
  };
}

function VacacionesContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const tenantSchema = searchParams.get("tenant");

  const [summary, setSummary] = useState<CompanyVacationSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshingEmployee, setRefreshingEmployee] = useState(false);
  const [search, setSearch] = useState("");
  const [scaleFilter, setScaleFilter] = useState<string>("todos");
  const [exportingExcel, setExportingExcel] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);

  // Estados para exportación en lote (Empresa)
  const [batchDropdownOpen, setBatchDropdownOpen] = useState(false);
  const [batchSoloConPagos, setBatchSoloConPagos] = useState(true);
  const [batchSoloConVacaciones, setBatchSoloConVacaciones] = useState(true);
  const [exportingBatchReciboExcel, setExportingBatchReciboExcel] = useState(false);
  const [exportingBatchReciboPdf, setExportingBatchReciboPdf] = useState(false);
  const [exportingBatchFichaExcel, setExportingBatchFichaExcel] = useState(false);
  const [exportingBatchFichaPdf, setExportingBatchFichaPdf] = useState(false);
  const batchMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (batchMenuRef.current && !batchMenuRef.current.contains(event.target as Node)) {
        setBatchDropdownOpen(false);
      }
    };
    if (batchDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [batchDropdownOpen]);

  // Rango de fechas para el periodo ("DEL ... AL ...") con guardado inteligente
  const currentYear = new Date().getFullYear();
  const [fechaDesde, setFechaDesde] = useState<string>(() => {
    if (typeof window !== "undefined") {
      return getStoredVacationsPeriod().desde;
    }
    return `${currentYear}-01-01`;
  });
  const [fechaHasta, setFechaHasta] = useState<string>(() => {
    if (typeof window !== "undefined") {
      return getStoredVacationsPeriod().hasta;
    }
    return `${currentYear}-12-31`;
  });

  const updateFechaDesde = (val: string) => {
    setFechaDesde(val);
    setStoredVacationsPeriod(val, fechaHasta, tenantSchema);
  };

  const updateFechaHasta = (val: string) => {
    setFechaHasta(val);
    setStoredVacationsPeriod(fechaDesde, val, tenantSchema);
  };

  const [modoFraccionado, setModoFraccionado] = useState<boolean>(false);

  const updatePeriodoCompleto = (d1: string, d2: string, autoFetch: boolean = true) => {
    setFechaDesde(d1);
    setFechaHasta(d2);
    setStoredVacationsPeriod(d1, d2, tenantSchema);
    if (autoFetch) {
      fetchSummary(d1, d2, modoFraccionado);
    }
  };

  // Modal Registro de Vacaciones
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [editingRecordId, setEditingRecordId] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [selectedEmpId, setSelectedEmpId] = useState<number | null>(null);
  const [vacationType, setVacationType] = useState<"dias_pagados" | "solicitada" | "colectiva">("solicitada");
  const [motivo, setMotivo] = useState("");
  const [fechaSolicitud, setFechaSolicitud] = useState<string>("");
  const [onlyBusinessDays, setOnlyBusinessDays] = useState(true);

  // Días Pagados (número de días, fecha de liquidación, modo exacto/fraccionado y cierre conciliado)
  const [diasPagadosInput, setDiasPagadosInput] = useState<string>("");
  const [fechaPago, setFechaPago] = useState<string>("");
  const [liquidacionFraccionada, setLiquidacionFraccionada] = useState<boolean>(false);
  const [esCierreConciliado, setEsCierreConciliado] = useState<boolean>(false);

  // Notificación de último registro guardado para permanecer en la ventana
  const [lastSavedAlert, setLastSavedAlert] = useState<{ empName: string; dias: number; tipo: string } | null>(null);

  // Calendario Interactivo
  const [calMonth, setCalMonth] = useState<number>(new Date().getMonth());
  const [calYear, setCalYear] = useState<number>(new Date().getFullYear());
  const [selectedDates, setSelectedDates] = useState<string[]>([]);
  const [rangeStart, setRangeStart] = useState<string | null>(null);
  const [selectionMode, setSelectionMode] = useState<"individual" | "rango">("individual");

  // Modal Ficha Individual y Periodo Evaluado
  const [viewingEmployee, setViewingEmployee] = useState<EmployeeVacationSummary | null>(null);
  const [kardexViewMode, setKardexViewMode] = useState<"general" | "detallado">("general");
  const [modalPeriodMode, setModalPeriodMode] = useState<"principal" | "historico" | "gestion" | "personalizado">("principal");
  const [modalFechaDesde, setModalFechaDesde] = useState<string>("");
  const [modalFechaHasta, setModalFechaHasta] = useState<string>("");
  const [exportingEmpExcel, setExportingEmpExcel] = useState(false);
  const [exportingEmpPdf, setExportingEmpPdf] = useState(false);

  // Modal Recibos y Comprobantes de Vacaciones (Pagadas y Solicitadas - Colectivas)
  const [showReceiptsModal, setShowReceiptsModal] = useState(false);
  const [receiptEmployee, setReceiptEmployee] = useState<EmployeeVacationSummary | null>(null);
  const [receiptDocType, setReceiptDocType] = useState<"pago" | "solicitadas">("pago");
  const [showReceiptSettings, setShowReceiptSettings] = useState(false);

  // Campos Recibo de Pago + Liquidación Exacta/Fraccionada y Cierre Conciliado
  const [reciboNro, setReciboNro] = useState<string>("001");
  const [reciboPaidRecordId, setReciboPaidRecordId] = useState<number | "all" | "manual">("all");
  const [reciboTotalGanado, setReciboTotalGanado] = useState<number>(3300);
  const [reciboSalarioDiario, setReciboSalarioDiario] = useState<number>(110);
  const [reciboDiasPagados, setReciboDiasPagados] = useState<number>(10);
  const [reciboImporteCancelado, setReciboImporteCancelado] = useState<number>(1100);
  const [reciboLugarFecha, setReciboLugarFecha] = useState<string>("");
  const [reciboEmpleadorNombre, setReciboEmpleadorNombre] = useState<string>("");
  const [reciboEmpleadorRol, setReciboEmpleadorRol] = useState<string>("propietario");
  const [reciboEmpleadorCi, setReciboEmpleadorCi] = useState<string>("");
  const [reciboFirmasEnBlanco, setReciboFirmasEnBlanco] = useState<boolean>(true);
  const [reciboModoFraccionado, setReciboModoFraccionado] = useState<boolean>(false);
  const [reciboFechaCorte, setReciboFechaCorte] = useState<string>("");
  const [savingCierreRecibo, setSavingCierreRecibo] = useState<boolean>(false);

  // Campos Ficha Solicitadas y Colectivas
  const [fichaTipoFilter, setFichaTipoFilter] = useState<"todas" | "solicitada" | "colectiva">("todas");
  const [fichaSelectedRecordIds, setFichaSelectedRecordIds] = useState<number[]>([]);
  const [fichaObservaciones, setFichaObservaciones] = useState<string>("");
  const [fichaResponsableNombre, setFichaResponsableNombre] = useState<string>("");
  const [fichaFecha, setFichaFecha] = useState<string>("");

  const [exportingReceiptExcel, setExportingReceiptExcel] = useState(false);
  const [exportingReceiptPdf, setExportingReceiptPdf] = useState(false);

  const formatYMD = (d: Date) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const formatDMY = (val?: string) => {
    if (!val) return "-";
    const parts = val.split("-");
    if (parts.length === 3) {
      const [y, m, d] = parts;
      return `${d.padStart(2, "0")}/${m.padStart(2, "0")}/${y}`;
    }
    return val;
  };

  const formatKardexPeriodo = (fechaIni?: string, fechaFin?: string) => {
    if (!fechaIni) return "-";
    if (!fechaFin || fechaIni === fechaFin) {
      return formatDMY(fechaIni);
    }
    const p1 = fechaIni.split("-").map(Number);
    const p2 = fechaFin.split("-").map(Number);
    if (p1.length === 3 && p2.length === 3) {
      // Rango dentro del mismo mes y año: simplificar directamente al mes y año
      if (p1[0] === p2[0] && p1[1] === p2[1]) {
        return `${MONTH_NAMES[p1[1] - 1]} ${p1[0]}`;
      }
      // Rango que abarca meses distintos del mismo año
      if (p1[0] === p2[0]) {
        return `${MONTH_NAMES[p1[1] - 1]} a ${MONTH_NAMES[p2[1] - 1]} ${p1[0]}`;
      }
      return `${MONTH_NAMES[p1[1] - 1]} ${p1[0]} a ${MONTH_NAMES[p2[1] - 1]} ${p2[0]}`;
    }
    return `${formatDMY(fechaIni)} al ${formatDMY(fechaFin)}`;
  };

  const cleanMotivo = (motivo?: string, tipo?: string, fechaSol?: string | null, esCierre?: boolean, fechaEv?: string) => {
    let m = motivo?.trim() || "";
    if (esCierre || m.toUpperCase().includes("CIERRE CONCILIADO")) {
      const refFmt = formatDMY(fechaSol || fechaEv);
      return refFmt && refFmt !== "-" ? `CIERRE CONCILIADO (${refFmt})` : "CIERRE CONCILIADO";
    }
    if (!m) {
      if (tipo === "dias_pagados" || tipo === "a_cuenta") m = "Compensación de días pagados";
      else if (tipo === "colectiva") m = "Vacación colectiva institucional";
      else m = "Descanso vacacional solicitado";
    } else {
      m = m
        .replace(/Vacaciones a_cuenta/gi, "Compensación de días pagados")
        .replace(/a_cuenta/gi, "días pagados")
        .replace(/solicitada/gi, "solicitada")
        .replace(/colectiva/gi, "colectiva");
    }
    if (fechaSol) {
      const fSolFmt = formatDMY(fechaSol);
      if (fSolFmt && fSolFmt !== "-") {
        m = `${m} (Sol: ${fSolFmt})`;
      }
    }
    return m;
  };

  const getDaysForYear = (yearNum: number) => {
    if (yearNum <= 5) return 15;
    if (yearNum <= 10) return 20;
    return 30;
  };

  const getAnniversaryDate = (hireDateStr: string, targetYear: number) => {
    const parts = hireDateStr.split("-").map(Number);
    if (parts.length !== 3) return null;
    const [, month, day] = parts;
    const d = new Date(targetYear, month - 1, day);
    if (d.getMonth() !== month - 1) {
      const lastDayFeb = new Date(targetYear, 1, 28);
      return formatYMD(lastDayFeb);
    }
    return formatYMD(d);
  };

  const expandRecordDates = (fIniStr: string, fFinStr: string, diasTot: number, fechasDetalle?: string[]) => {
    if (fechasDetalle && fechasDetalle.length > 0) {
      return [...fechasDetalle].sort();
    }
    const result: string[] = [];
    if (!fIniStr) return result;
    const partsIni = fIniStr.split("-").map(Number);
    const partsFin = (fFinStr || fIniStr).split("-").map(Number);
    if (partsIni.length !== 3 || partsFin.length !== 3) {
      return [fIniStr];
    }
    const cur = new Date(partsIni[0], partsIni[1] - 1, partsIni[2]);
    const end = new Date(partsFin[0], partsFin[1] - 1, partsFin[2]);

    while (cur <= end && result.length < diasTot) {
      const day = cur.getDay();
      if (day !== 0 && day !== 6) {
        result.push(formatYMD(cur));
      }
      cur.setDate(cur.getDate() + 1);
    }
    if (result.length === 0 && fIniStr) {
      result.push(fIniStr);
    }
    return result;
  };

  // Kárdex unificado y ordenado según especificación:
  // 1° Agregaciones de días por año cumplido (Derechos Anuales ganados)
  // 2° Vacaciones con fecha de solicitud (de las más antiguas a las actuales)
  // 3° Vacaciones sin fecha de solicitud (primeras agregadas más arriba, últimas más abajo)
  const kardexData = useMemo(() => {
    if (!viewingEmployee) {
      return {
        apertura: null,
        timeline: [] as KardexItem[],
        hasSaldoAnterior: false,
        ganadosPre: 0,
        tomadosPre: 0,
        saldoPre: 0,
        ganadosPeriodo: 0,
        tomadosPeriodo: 0,
        totalComputablePeriodo: 0,
        saldoFinalPeriodo: 0,
        totGanadosHist: 0,
        totTomadosHist: 0,
        saldoFinalHist: 0,
        totGanados: 0,
        totTomados: 0,
        saldoFinal: 0
      };
    }

    const hireDateStr = viewingEmployee.fecha_ingreso;
    const parts = hireDateStr.split("-").map(Number);
    const hireYear = parts[0] || new Date().getFullYear();
    const todayStr = formatYMD(new Date());

    const activeDesde = modalFechaDesde || fechaDesde || hireDateStr;
    const activeHasta = modalFechaHasta || fechaHasta || todayStr;
    const cutoffDate = activeHasta;
    const startDate = activeDesde;

    // 1. Parsear registros de vacaciones tomadas / pagadas / cierres conciliados hasta cutoffDate
    const recEvents: KardexItem[] = [];
    (viewingEmployee.records || []).forEach(r => {
      if (!r.fecha_inicio || r.fecha_inicio > cutoffDate) return;
      const isPagado = r.tipo === "dias_pagados" || r.tipo === "a_cuenta";
      const isCierre = Boolean(r.es_cierre_conciliado);
      recEvents.push({
        id: `rec-${r.id}`,
        recordId: r.id,
        fecha: r.fecha_inicio,
        fecha_fin: r.fecha_fin,
        tipo: r.tipo,
        tipoLabel: isCierre ? "Cierre Conciliado" : isPagado ? "Días Pagados" : r.tipo === "colectiva" ? "Colectiva" : "Solicitada",
        diasGanados: 0,
        diasTomados: Number(r.dias || 0),
        saldoRestante: 0,
        motivo: r.motivo,
        fecha_solicitud: r.fecha_solicitud,
        es_cierre_conciliado: isCierre,
        isRecord: true
      });
    });

    // 2. Generar derechos anuales respetando cierres conciliados
    const cierreEvents = recEvents
      .filter(e => e.es_cierre_conciliado)
      .sort((a, b) => a.fecha.localeCompare(b.fecha) || ((a.recordId || 0) - (b.recordId || 0)));

    const annivEvents: KardexItem[] = [];
    if (cierreEvents.length === 0) {
      const cutoffYear = parseInt(cutoffDate.split("-")[0]) || new Date().getFullYear();
      const maxYears = Math.max(0, cutoffYear - hireYear + 1);
      for (let y = 1; y <= maxYears; y++) {
        const annivStr = getAnniversaryDate(hireDateStr, hireYear + y);
        if (annivStr && annivStr <= cutoffDate) {
          const days = getDaysForYear(y);
          annivEvents.push({
            id: `anniv-${y}`,
            fecha: annivStr,
            fecha_fin: annivStr,
            tipo: "derecho_anual",
            tipoLabel: "Derecho Anual",
            diasGanados: days,
            diasTomados: 0,
            saldoRestante: 0,
            motivo: `${y}° Año de antigüedad cumplido (+${days} d/año)`,
            fecha_solicitud: null,
            es_cierre_conciliado: false,
            isRecord: false
          });
        }
      }
    } else {
      const firstCierreDate = cierreEvents[0].fecha;
      const maxYears = Math.max(0, parseInt(firstCierreDate.split("-")[0]) - hireYear + 1);
      for (let y = 1; y <= maxYears; y++) {
        const annivStr = getAnniversaryDate(hireDateStr, hireYear + y);
        if (annivStr && annivStr <= firstCierreDate) {
          const days = getDaysForYear(y);
          annivEvents.push({
            id: `anniv-${y}`,
            fecha: annivStr,
            fecha_fin: annivStr,
            tipo: "derecho_anual",
            tipoLabel: "Derecho Anual",
            diasGanados: days,
            diasTomados: 0,
            saldoRestante: 0,
            motivo: `${y}° Año de antigüedad cumplido (+${days} d/año)`,
            fecha_solicitud: null,
            es_cierre_conciliado: false,
            isRecord: false
          });
        }
      }

      cierreEvents.forEach((cEv, ci) => {
        const cStart = cEv.fecha;
        const cEnd = ci + 1 < cierreEvents.length ? cierreEvents[ci + 1].fecha : cutoffDate;
        const cStartYear = parseInt(cStart.split("-")[0]) || new Date().getFullYear();
        let k = 1;
        while (k < 60) {
          const annivC = getAnniversaryDate(cStart, cStartYear + k);
          if (!annivC || annivC > cEnd) break;
          const totalY = Math.max(1, diffYMD(hireDateStr, annivC).anios);
          const days = getDaysForYear(totalY);
          annivEvents.push({
            id: `anniv-c${cEv.recordId || ci}-${k}`,
            fecha: annivC,
            fecha_fin: annivC,
            tipo: "derecho_anual",
            tipoLabel: "Derecho Anual",
            diasGanados: days,
            diasTomados: 0,
            saldoRestante: 0,
            motivo: `${k}° Año post-cierre cumplido (+${days} d/año)`,
            fecha_solicitud: null,
            es_cierre_conciliado: false,
            isRecord: false
          });
          k += 1;
        }
      });
    }

    // 3. Orden cronológico unificado e inserción de Devengado Fraccionado en cierres
    const allSorted = [...annivEvents, ...recEvents].sort((a, b) => {
      const cmpDate = a.fecha.localeCompare(b.fecha);
      if (cmpDate !== 0) return cmpDate;
      const aType = a.tipo === "derecho_anual" ? 0 : 1;
      const bType = b.tipo === "derecho_anual" ? 0 : 1;
      if (aType !== bType) return aType - bType;
      const aCierre = a.es_cierre_conciliado ? 1 : 0;
      const bCierre = b.es_cierre_conciliado ? 1 : 0;
      if (aCierre !== bCierre) return aCierre - bCierre;
      const cmpSol = (a.fecha_solicitud || "").localeCompare(b.fecha_solicitud || "");
      if (cmpSol !== 0) return cmpSol;
      return (a.recordId || 0) - (b.recordId || 0);
    });

    const fullTimeline: KardexItem[] = [];
    let runningBal = 0;
    allSorted.forEach(ev => {
      if (ev.tipo === "derecho_anual") {
        runningBal = Math.round((runningBal + ev.diasGanados) * 100) / 100;
        fullTimeline.push({ ...ev, saldoRestante: runningBal });
      } else if (ev.es_cierre_conciliado) {
        const diffFrac = Math.round((ev.diasTomados - runningBal) * 100) / 100;
        if (Math.abs(diffFrac) >= 0.01) {
          runningBal = Math.round((runningBal + diffFrac) * 100) / 100;
          fullTimeline.push({
            id: `frac-cierre-${ev.recordId || ev.id}`,
            fecha: ev.fecha,
            fecha_fin: ev.fecha,
            tipo: "derecho_anual",
            tipoLabel: "Devengado Fraccionado",
            diasGanados: diffFrac > 0 ? diffFrac : 0,
            diasTomados: diffFrac < 0 ? Math.abs(diffFrac) : 0,
            saldoRestante: runningBal,
            motivo: "Días devengados fraccionados computados al Cierre Conciliado",
            fecha_solicitud: null,
            es_cierre_conciliado: false,
            isFractionalCierre: true,
            isRecord: false
          });
        }
        runningBal = Math.round((runningBal - ev.diasTomados) * 100) / 100;
        fullTimeline.push({ ...ev, saldoRestante: runningBal });
      } else {
        runningBal = Math.round((runningBal - ev.diasTomados) * 100) / 100;
        fullTimeline.push({ ...ev, saldoRestante: runningBal });
      }
    });

    // 4. Separar eventos previos a startDate (para consolidación en apertura / saldo anterior)
    const preEvents = fullTimeline.filter(e => e.fecha < startDate);
    const orderedTimeline = fullTimeline.filter(e => e.fecha >= startDate && e.fecha <= cutoffDate);

    const ganadosPre = Math.round(preEvents.reduce((acc, e) => acc + e.diasGanados, 0) * 100) / 100;
    const tomadosPre = Math.round(preEvents.reduce((acc, e) => acc + e.diasTomados, 0) * 100) / 100;
    const saldoPre = Math.round((ganadosPre - tomadosPre) * 100) / 100;
    const hasSaldoAnterior = preEvents.length > 0;

    const ganadosPeriodo = Math.round(orderedTimeline.reduce((acc, e) => acc + e.diasGanados, 0) * 100) / 100;
    const tomadosPeriodo = Math.round(orderedTimeline.reduce((acc, e) => acc + e.diasTomados, 0) * 100) / 100;
    const totalComputablePeriodo = Math.round((saldoPre + ganadosPeriodo) * 100) / 100;
    const saldoFinalPeriodo = orderedTimeline.length > 0 ? orderedTimeline[orderedTimeline.length - 1].saldoRestante : saldoPre;

    let apertura: KardexItem | null = null;
    if (hasSaldoAnterior) {
      apertura = {
        id: "apertura-saldo-ant",
        fecha: startDate,
        fecha_fin: startDate,
        tipo: "saldo_anterior",
        tipoLabel: "Saldo Anterior",
        diasGanados: saldoPre > 0 ? saldoPre : 0,
        diasTomados: 0,
        saldoRestante: saldoPre,
        motivo: `Saldo inicial acumulado al ${formatDMY(startDate)}`,
        isRecord: false,
        isApertura: true,
        kardexIndex: "Inicio"
      };
    } else {
      apertura = {
        id: "apertura-ingreso",
        fecha: hireDateStr,
        fecha_fin: hireDateStr,
        tipo: "ingreso",
        tipoLabel: "Ingreso Empresa",
        diasGanados: 0,
        diasTomados: 0,
        saldoRestante: 0,
        motivo: "Inicio de relación laboral",
        isRecord: false,
        isApertura: true,
        kardexIndex: "Inicio"
      };
    }

    const totGanados = Math.round(fullTimeline.reduce((acc, e) => acc + e.diasGanados, 0) * 100) / 100;
    const totTomados = Math.round(fullTimeline.reduce((acc, e) => acc + e.diasTomados, 0) * 100) / 100;
    const saldoFinal = Math.round((totGanados - totTomados) * 100) / 100;

    const timelineWithIdx = orderedTimeline.map((e, idx) => ({
      ...e,
      kardexIndex: idx + 1
    }));

    return {
      apertura,
      timeline: timelineWithIdx,
      hasSaldoAnterior,
      ganadosPre,
      tomadosPre,
      saldoPre,
      ganadosPeriodo,
      tomadosPeriodo,
      totalComputablePeriodo,
      saldoFinalPeriodo,
      totGanadosHist: totGanados,
      totTomadosHist: totTomados,
      saldoFinalHist: saldoFinal,
      totGanados,
      totTomados,
      saldoFinal
    };
  }, [viewingEmployee, fechaDesde, fechaHasta, modalFechaDesde, modalFechaHasta]);

  // Kárdex Detallado por Mes y Días en Específico:
  const kardexDetailedData = useMemo(() => {
    if (!viewingEmployee || !kardexData.apertura) {
      return {
        apertura: null,
        timeline: [] as DetailedKardexItem[],
        resumenMensual: [] as MonthlySummaryItem[]
      };
    }

    const hireDateStr = viewingEmployee.fecha_ingreso;
    const todayStr = formatYMD(new Date());
    const activeDesde = modalFechaDesde || fechaDesde || hireDateStr;
    const activeHasta = modalFechaHasta || fechaHasta || todayStr;
    const cutoffDate = activeHasta;
    const startDate = activeDesde;

    const detailedEvents: DetailedKardexItem[] = [];

    // 1. Derechos Anuales y Devengados Fraccionados
    const annivList = kardexData.timeline.filter(e => e.tipo === "derecho_anual");
    annivList.forEach(ev => {
      const parts = ev.fecha.split("-").map(Number);
      const mIdx = parts[1] - 1;
      const y = parts[0];
      const mKey = `${parts[0]}-${String(parts[1]).padStart(2, "0")}`;
      const mLabel = `${MONTH_NAMES[mIdx]} ${y}`;
      const dObj = new Date(parts[0], mIdx, parts[2]);
      const dayIdx = dObj.getDay();
      const dayName = WEEK_DAYS[dayIdx === 0 ? 6 : dayIdx - 1] || "";
      const espStr = ev.isFractionalCierre
        ? `• ${dayName} ${formatDMY(ev.fecha)} (Cómputo Fraccionado al Cierre)`
        : `• ${dayName} ${formatDMY(ev.fecha)} (Vacación Devengada)`;

      detailedEvents.push({
        id: ev.id,
        recordId: ev.recordId,
        mesKey: mKey,
        mesLabel: mLabel,
        fecha: ev.fecha,
        fecha_fin: ev.fecha_fin,
        tipo: "derecho_anual",
        tipoLabel: ev.tipoLabel || "Derecho Anual",
        diasGanados: ev.diasGanados,
        diasTomados: ev.diasTomados || 0,
        saldoRestante: 0,
        motivo: ev.motivo,
        fecha_solicitud: null,
        es_cierre_conciliado: false,
        isFractionalCierre: Boolean(ev.isFractionalCierre),
        diasEspecificos: [ev.fecha],
        diasEspecificosFormato: espStr,
        isRecord: false
      });
    });

    // 2. Registros de vacaciones tomadas o compensaciones
    const recsList = kardexData.timeline.filter(e => e.isRecord);
    recsList.forEach(ev => {
      const isPagado = ev.tipo === "dias_pagados" || ev.tipo === "a_cuenta";
      const isCierre = Boolean(ev.es_cierre_conciliado);
      const parts = ev.fecha.split("-").map(Number);
      const mIdx = parts[1] - 1;
      const y = parts[0];
      const mKey = `${parts[0]}-${String(parts[1]).padStart(2, "0")}`;
      const mLabel = `${MONTH_NAMES[mIdx]} ${y}`;

      if (isPagado) {
        detailedEvents.push({
          id: ev.id,
          recordId: ev.recordId,
          mesKey: mKey,
          mesLabel: mLabel,
          fecha: ev.fecha,
          fecha_fin: ev.fecha_fin,
          tipo: "dias_pagados",
          tipoLabel: isCierre ? "Cierre Conciliado" : "Días Pagados",
          diasGanados: 0,
          diasTomados: ev.diasTomados,
          saldoRestante: 0,
          motivo: ev.motivo,
          fecha_solicitud: ev.fecha_solicitud,
          es_cierre_conciliado: isCierre,
          diasEspecificos: [],
          diasEspecificosFormato: isCierre
            ? "Liquidación total y Cierre Conciliado (Saldo reiniciado a 0)"
            : "No aplica (Días pagados / compensación económica en dinero)",
          isRecord: true
        });
      } else {
        const origRec = (viewingEmployee.records || []).find(r => r.id === ev.recordId);
        const allDates = expandRecordDates(
          ev.fecha,
          ev.fecha_fin,
          ev.diasTomados,
          origRec?.fechas_detalle
        );

        let rangeDates = allDates.filter(d => d >= startDate && d <= cutoffDate);
        if (rangeDates.length === 0) {
          rangeDates = allDates;
        }

        const byMonth: Record<string, string[]> = {};
        rangeDates.forEach(dStr => {
          const mk = dStr.substring(0, 7);
          if (!byMonth[mk]) byMonth[mk] = [];
          byMonth[mk].push(dStr);
        });

        Object.keys(byMonth).sort().forEach(mk => {
          const [mY, mM] = mk.split("-").map(Number);
          const monthLabel = `${MONTH_NAMES[mM - 1]} ${mY}`;
          const mDates = byMonth[mk];
          const diasCount = mDates.length;

          const chipsStr = mDates.map(dStr => {
            const [dy, dm, dd] = dStr.split("-").map(Number);
            const dObj = new Date(dy, dm - 1, dd);
            const dayIdx = dObj.getDay();
            const dName = WEEK_DAYS[dayIdx === 0 ? 6 : dayIdx - 1] || "";
            return `• ${dName} ${dd}/${String(dm).padStart(2, "0")}`;
          }).join("\n");

          const espStr = diasCount > 0
            ? chipsStr
            : "Sin desglose de fechas específicas";

          detailedEvents.push({
            id: `${ev.id}-${mk}`,
            recordId: ev.recordId,
            mesKey: mk,
            mesLabel: monthLabel,
            fecha: mDates[0] || ev.fecha,
            fecha_fin: mDates[mDates.length - 1] || ev.fecha_fin,
            tipo: ev.tipo,
            tipoLabel: ev.tipoLabel,
            diasGanados: 0,
            diasTomados: diasCount,
            saldoRestante: 0,
            motivo: ev.motivo,
            fecha_solicitud: ev.fecha_solicitud,
            es_cierre_conciliado: false,
            diasEspecificos: mDates,
            diasEspecificosFormato: espStr,
            isRecord: true
          });
        });
      }
    });

    detailedEvents.sort((a, b) => {
      const cmpDate = a.fecha.localeCompare(b.fecha);
      if (cmpDate !== 0) return cmpDate;
      const aType = a.tipo === "derecho_anual" ? 0 : 1;
      const bType = b.tipo === "derecho_anual" ? 0 : 1;
      if (aType !== bType) return aType - bType;
      const aCierre = a.es_cierre_conciliado ? 1 : 0;
      const bCierre = b.es_cierre_conciliado ? 1 : 0;
      if (aCierre !== bCierre) return aCierre - bCierre;
      const cmpSol = (a.fecha_solicitud || "").localeCompare(b.fecha_solicitud || "");
      if (cmpSol !== 0) return cmpSol;
      return (a.recordId || 0) - (b.recordId || 0);
    });

    let cur = kardexData.apertura.saldoRestante;
    detailedEvents.forEach(ev => {
      cur = Math.round((cur + ev.diasGanados - ev.diasTomados) * 100) / 100;
      ev.saldoRestante = cur;
    });

    const detailedTimelineWithIdx = detailedEvents.map((e, idx) => ({
      ...e,
      kardexIndex: idx + 1
    }));

    const monthlyMap: Record<string, MonthlySummaryItem> = {};
    detailedTimelineWithIdx.forEach(dev => {
      const mk = dev.mesKey;
      if (!monthlyMap[mk]) {
        monthlyMap[mk] = {
          mesKey: mk,
          mesLabel: dev.mesLabel,
          diasGanados: 0,
          diasTomados: 0,
          saldoCierre: 0,
          count: 0
        };
      }
      monthlyMap[mk].diasGanados = Math.round((monthlyMap[mk].diasGanados + dev.diasGanados) * 100) / 100;
      monthlyMap[mk].diasTomados = Math.round((monthlyMap[mk].diasTomados + dev.diasTomados) * 100) / 100;
      monthlyMap[mk].saldoCierre = dev.saldoRestante;
      monthlyMap[mk].count += 1;
    });

    const resumenMensual = Object.values(monthlyMap);

    return {
      apertura: kardexData.apertura,
      timeline: detailedTimelineWithIdx,
      resumenMensual
    };
  }, [viewingEmployee, kardexData, modalFechaDesde, modalFechaHasta, fechaDesde, fechaHasta]);

  const fetchSummary = useCallback(async (customDesde?: string, customHasta?: string, customFraccionado?: boolean) => {
    if (!tenantSchema) return;
    try {
      if (!summary) {
        setLoading(true);
      } else {
        setIsRefreshing(true);
      }
      const dVal = customDesde !== undefined ? customDesde : fechaDesde;
      const hVal = customHasta !== undefined ? customHasta : fechaHasta;
      const fVal = customFraccionado !== undefined ? customFraccionado : modoFraccionado;
      const qParams = new URLSearchParams();
      if (dVal) qParams.set("desde", dVal);
      if (hVal) qParams.set("hasta", hVal);
      if (fVal) qParams.set("fraccionado", "true");
      const qs = qParams.toString() ? `?${qParams.toString()}` : "";

      const res = await fetch(`${getApiUrl()}/api/tenants/${tenantSchema}/vacaciones/summary/${qs}`);
      if (res.ok) {
        const data: CompanyVacationSummary = await res.json();
        setSummary(data);
        setReceiptEmployee(prev => prev ? (data.employees.find(e => e.employee_id === prev.employee_id) || prev) : prev);
      } else {
        console.error("Error al obtener resumen de vacaciones", await res.text());
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [tenantSchema, fechaDesde, fechaHasta, modoFraccionado, summary]);

  const refreshEmployeeData = async (empId: number, customDesde?: string, customHasta?: string, customFraccionado?: boolean) => {
    if (!tenantSchema) return;
    try {
      setRefreshingEmployee(true);
      const dVal = customDesde !== undefined ? customDesde : (modalFechaDesde || fechaDesde);
      const hVal = customHasta !== undefined ? customHasta : (modalFechaHasta || fechaHasta);
      const fVal = customFraccionado !== undefined ? customFraccionado : modoFraccionado;
      const qParams = new URLSearchParams();
      if (dVal) qParams.set("desde", dVal);
      if (hVal) qParams.set("hasta", hVal);
      if (fVal) qParams.set("fraccionado", "true");
      const qs = qParams.toString() ? `?${qParams.toString()}` : "";

      const updatedRes = await fetch(`${getApiUrl()}/api/tenants/${tenantSchema}/vacaciones/employee/${empId}/${qs}`);
      if (updatedRes.ok) {
        const empData = await updatedRes.json();
        setViewingEmployee(empData);
      }
    } catch (err) {
      console.error("Error al actualizar ficha de empleado:", err);
    } finally {
      setRefreshingEmployee(false);
    }
  };

  useEffect(() => {
    if (!tenantSchema) {
      router.push("/seleccionar-empresa");
    } else {
      const stored = getStoredVacationsPeriod(tenantSchema);
      setFechaDesde(stored.desde);
      setFechaHasta(stored.hasta);
      fetchSummary(stored.desde, stored.hasta, false);
    }
  }, [tenantSchema]);

  const handleExportCompany = async (format: "excel" | "pdf") => {
    if (!tenantSchema) return;
    try {
      if (format === "excel") setExportingExcel(true);
      else setExportingPdf(true);

      const qParams = new URLSearchParams();
      if (fechaDesde) qParams.set("desde", fechaDesde);
      if (fechaHasta) qParams.set("hasta", fechaHasta);
      if (modoFraccionado) qParams.set("fraccionado", "true");
      const qs = qParams.toString() ? `?${qParams.toString()}` : "";

      const res = await fetch(`${getApiUrl()}/api/tenants/${tenantSchema}/vacaciones/export/company/${format}${qs}`);
      if (!res.ok) throw new Error("Error al exportar planilla de vacaciones");
      
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const ext = format === "excel" ? "xlsx" : "pdf";
      a.download = `Control_Vacaciones_${tenantSchema}.${ext}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      Swal.fire({
        icon: "error",
        title: "Error al exportar",
        text: err.message || "No se pudo generar el archivo de vacaciones.",
        confirmButtonColor: "#0D9488"
      });
    } finally {
      if (format === "excel") setExportingExcel(false);
      else setExportingPdf(false);
    }
  };

  const handleExportBatchRecibos = async (format: "excel" | "pdf") => {
    if (!tenantSchema) return;
    try {
      if (format === "excel") setExportingBatchReciboExcel(true);
      else setExportingBatchReciboPdf(true);

      const qParams = new URLSearchParams();
      qParams.set("firmas_en_blanco", "true");
      qParams.set("solo_con_pagos", batchSoloConPagos ? "true" : "false");

      const res = await fetch(
        `${getApiUrl()}/api/tenants/${tenantSchema}/vacaciones/export/lote/recibos-pago/${format}?${qParams.toString()}`
      );
      if (!res.ok) {
        const errJson = await res.json().catch(() => null);
        throw new Error(errJson?.detail || "Error al exportar lote de recibos de pago");
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const ext = format === "excel" ? "xlsx" : "pdf";
      a.download = `Recibos_Vacaciones_Lote_${tenantSchema}.${ext}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      setBatchDropdownOpen(false);
    } catch (err: any) {
      Swal.fire({
        icon: "error",
        title: "Error al exportar recibos en lote",
        text: err.message || "No se pudo generar el lote de recibos.",
        confirmButtonColor: "#0D9488"
      });
    } finally {
      if (format === "excel") setExportingBatchReciboExcel(false);
      else setExportingBatchReciboPdf(false);
    }
  };

  const handleExportBatchFichas = async (format: "excel" | "pdf") => {
    if (!tenantSchema) return;
    try {
      if (format === "excel") setExportingBatchFichaExcel(true);
      else setExportingBatchFichaPdf(true);

      const qParams = new URLSearchParams();
      qParams.set("firmas_en_blanco", "true");
      qParams.set("solo_con_vacaciones", batchSoloConVacaciones ? "true" : "false");

      const res = await fetch(
        `${getApiUrl()}/api/tenants/${tenantSchema}/vacaciones/export/lote/fichas-solicitadas/${format}?${qParams.toString()}`
      );
      if (!res.ok) {
        const errJson = await res.json().catch(() => null);
        throw new Error(errJson?.detail || "Error al exportar lote de fichas de vacaciones");
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const ext = format === "excel" ? "xlsx" : "pdf";
      a.download = `Fichas_Vacaciones_Lote_${tenantSchema}.${ext}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      setBatchDropdownOpen(false);
    } catch (err: any) {
      Swal.fire({
        icon: "error",
        title: "Error al exportar fichas en lote",
        text: err.message || "No se pudo generar el lote de fichas.",
        confirmButtonColor: "#0D9488"
      });
    } finally {
      if (format === "excel") setExportingBatchFichaExcel(false);
      else setExportingBatchFichaPdf(false);
    }
  };

  const handleExportEmployee = async (empId: number, format: "excel" | "pdf", customDesde?: string, customHasta?: string) => {
    if (!tenantSchema) return;
    try {
      if (format === "excel") setExportingEmpExcel(true);
      else setExportingEmpPdf(true);

      const qParams = new URLSearchParams();
      const dVal = customDesde !== undefined ? customDesde : (modalFechaDesde || fechaDesde);
      const hVal = customHasta !== undefined ? customHasta : (modalFechaHasta || fechaHasta);
      if (dVal) qParams.set("desde", dVal);
      if (hVal) qParams.set("hasta", hVal);
      if (modoFraccionado) qParams.set("fraccionado", "true");
      const qs = qParams.toString() ? `?${qParams.toString()}` : "";

      const res = await fetch(`${getApiUrl()}/api/tenants/${tenantSchema}/vacaciones/export/employee/${empId}/${format}${qs}`);
      if (!res.ok) throw new Error("Error al exportar ficha individual");
      
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const ext = format === "excel" ? "xlsx" : "pdf";
      a.download = `Ficha_Vacaciones_${empId}.${ext}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      Swal.fire({
        icon: "error",
        title: "Error al exportar ficha",
        text: err.message || "No se pudo generar la ficha de vacaciones.",
        confirmButtonColor: "#0D9488"
      });
    } finally {
      if (format === "excel") setExportingEmpExcel(false);
      else setExportingEmpPdf(false);
    }
  };

  const handleDeleteRecord = async (recordId: number, empId: number) => {
    const res = await Swal.fire({
      title: "¿Eliminar registro de vacación?",
      text: "Se restituirán los días de vacación al saldo del empleado.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Sí, eliminar",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#e11d48",
      cancelButtonColor: "#64748b"
    });

    if (!res.isConfirmed) return;

    try {
      const delRes = await fetch(`${getApiUrl()}/api/tenants/${tenantSchema}/vacaciones/record/${recordId}`, {
        method: "DELETE"
      });
      if (delRes.ok) {
        Swal.fire({
          icon: "success",
          title: "Eliminado",
          text: "El registro ha sido eliminado exitosamente.",
          timer: 1500,
          showConfirmButton: false
        });
        await fetchSummary(fechaDesde, fechaHasta);
        // Actualizar ficha si está abierta manteniendo el periodo evaluado
        if (viewingEmployee) {
          const activeModalDesde = modalFechaDesde || fechaDesde;
          const activeModalHasta = modalFechaHasta || fechaHasta;
          await refreshEmployeeData(empId, activeModalDesde, activeModalHasta);
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  // ==========================================
  // LÓGICA DEL CALENDARIO INTERACTIVO
  // ==========================================
  const isWeekend = (dateStr: string) => {
    const [y, m, d] = dateStr.split("-").map(Number);
    const dateObj = new Date(y, m - 1, d);
    const dayOfWeek = dateObj.getDay();
    return dayOfWeek === 0 || dayOfWeek === 6; // 0=Domingo, 6=Sábado
  };

  const selectedEmp = useMemo(() => {
    if (!summary || !selectedEmpId) return null;
    return summary.employees.find(e => e.employee_id === selectedEmpId) || null;
  }, [summary, selectedEmpId]);

  const formatDateChip = (dateStr: string) => {
    const [y, m, d] = dateStr.split("-").map(Number);
    const dateObj = new Date(y, m - 1, d);
    const dayNames = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
    const monthNames = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
    const dayName = dayNames[dateObj.getDay()] || "";
    const monthName = monthNames[m - 1] || "";
    return { dayName, formatted: `${dayName} ${d} ${monthName}` };
  };

  const handleDateClick = (dateStr: string) => {
    if (onlyBusinessDays && isWeekend(dateStr)) {
      Swal.fire({
        icon: "info",
        title: "Día no hábil",
        text: "Los sábados y domingos no son laborables en el cómputo de vacaciones según la normativa laboral.",
        timer: 1400,
        showConfirmButton: false
      });
      return;
    }

    if (selectionMode === "individual") {
      // SELECCIÓN INDIVIDUAL POR CLIC (TOGGLE)
      if (selectedDates.includes(dateStr)) {
        setSelectedDates(prev => prev.filter(d => d !== dateStr));
      } else {
        setSelectedDates(prev => [...prev, dateStr].sort());
      }
    } else {
      // SELECCIÓN POR RANGO (INICIO Y FIN)
      if (!rangeStart) {
        setRangeStart(dateStr);
        if (!selectedDates.includes(dateStr)) {
          setSelectedDates(prev => [...prev, dateStr].sort());
        }
      } else {
        const d1 = new Date(rangeStart + "T00:00:00");
        const d2 = new Date(dateStr + "T00:00:00");
        const [start, end] = d1 <= d2 ? [d1, d2] : [d2, d1];
        
        const rangeDates: string[] = [];
        const cur = new Date(start);
        while (cur <= end) {
          const ymd = formatYMD(cur);
          if (!onlyBusinessDays || !isWeekend(ymd)) {
            rangeDates.push(ymd);
          }
          cur.setDate(cur.getDate() + 1);
        }

        setSelectedDates(prev => Array.from(new Set([...prev, ...rangeDates])).sort());
        setRangeStart(null);
      }
    }
  };

  const removeDate = (dateStr: string) => {
    setSelectedDates(prev => prev.filter(d => d !== dateStr));
  };

  const handleOpenRegisterModal = (empId?: number) => {
    const todayYmd = formatYMD(new Date());
    setEditingRecordId(null);
    if (empId) {
      setSelectedEmpId(empId);
    } else if (summary && summary.employees.length > 0) {
      setSelectedEmpId(summary.employees[0].employee_id);
    }
    setVacationType("solicitada");
    setSelectionMode("individual");
    setMotivo("");
    setFechaSolicitud(todayYmd);
    setSelectedDates([]);
    setRangeStart(null);
    setDiasPagadosInput("");
    setFechaPago(todayYmd);
    setLiquidacionFraccionada(false);
    setEsCierreConciliado(false);
    setLastSavedAlert(null);
    setCalMonth(new Date().getMonth());
    setCalYear(new Date().getFullYear());
    setShowRegisterModal(true);
  };

  const handleOpenEditModal = (record: VacationRecord | any) => {
    const recId = record.id || record.recordId;
    setEditingRecordId(recId);
    setSelectedEmpId(record.employee_id || viewingEmployee?.employee_id || null);
    const tipo = record.tipo === "a_cuenta" ? "dias_pagados" : (record.tipo || "solicitada");
    setVacationType(tipo);
    setSelectionMode("individual");
    setMotivo(record.motivo || "");
    setFechaSolicitud(record.fecha_solicitud || "");
    setLastSavedAlert(null);

    if (tipo === "dias_pagados") {
      const isCierreMode = Boolean(record.es_cierre_conciliado || record.modo_calculo === "fraccionado");
      const recDate = record.fecha_inicio || formatYMD(new Date());
      setDiasPagadosInput(String(record.dias ?? record.diasTomados ?? ""));
      setFechaPago(recDate);
      if (isCierreMode && !record.fecha_solicitud) {
        setFechaSolicitud(recDate);
      }
      setLiquidacionFraccionada(isCierreMode);
      setEsCierreConciliado(isCierreMode);
      setSelectedDates([]);
      setRangeStart(null);
    } else {
      setDiasPagadosInput("");
      setFechaPago(formatYMD(new Date()));
      setLiquidacionFraccionada(false);
      setEsCierreConciliado(false);
      const dates = record.fechas_detalle && record.fechas_detalle.length > 0
        ? [...record.fechas_detalle]
        : record.fecha_inicio
        ? [record.fecha_inicio]
        : [];
      setSelectedDates(dates);
      setRangeStart(null);

      const targetDate = dates[0] || record.fecha_inicio;
      if (targetDate) {
        const parts = targetDate.split("-").map(Number);
        if (parts.length >= 2) {
          setCalYear(parts[0]);
          setCalMonth(parts[1] - 1);
        }
      }
    }
    setShowRegisterModal(true);
  };

  // Lista de años disponibles para regularización (desde 30 años atrás hasta +2)
  const yearOptions = useMemo(() => {
    const list: number[] = [];
    for (let y = currentYear + 2; y >= currentYear - 30; y--) {
      list.push(y);
    }
    return list;
  }, [currentYear]);

  // Saltar al año/mes de ingreso del empleado seleccionado
  const handleJumpToHireDate = () => {
    if (!selectedEmp || !selectedEmp.fecha_ingreso) return;
    const parts = selectedEmp.fecha_ingreso.split("-").map(Number);
    if (parts.length === 3) {
      const [y, m] = parts;
      setCalYear(y);
      setCalMonth(m - 1);
    }
  };

  // Abrir Ficha Individual y Kárdex con Periodo Inicial Sincronizado
  const handleOpenKardex = (emp: EmployeeVacationSummary) => {
    setViewingEmployee(emp);
    const savedModal = getStoredVacationsModalPeriod(tenantSchema);
    if (savedModal) {
      setModalPeriodMode("personalizado");
      setModalFechaDesde(savedModal.desde);
      setModalFechaHasta(savedModal.hasta);
      refreshEmployeeData(emp.employee_id, savedModal.desde, savedModal.hasta);
    } else {
      setModalPeriodMode("principal");
      setModalFechaDesde(fechaDesde);
      setModalFechaHasta(fechaHasta);
      refreshEmployeeData(emp.employee_id, fechaDesde, fechaHasta);
    }
  };

  // Abrir Modal de Recibos y Comprobantes de Vacaciones (opcionalmente centrado en un registro específico)
  const handleOpenReceiptsModal = (emp: EmployeeVacationSummary, targetRecordId?: number | null) => {
    setReceiptEmployee(emp);
    setShowReceiptsModal(true);
    setShowReceiptSettings(false);

    const paidRecs = (emp.records || []).filter(r => r.tipo === "dias_pagados" || r.tipo === "a_cuenta");
    const solColRecs = (emp.records || []).filter(r => r.tipo === "solicitada" || r.tipo === "colectiva");

    let targetRec: VacationRecord | undefined = undefined;
    if (targetRecordId) {
      targetRec = (emp.records || []).find(r => r.id === targetRecordId);
    }

    const isTargetPaid = targetRec && (targetRec.tipo === "dias_pagados" || targetRec.tipo === "a_cuenta");
    const isTargetSol = targetRec && (targetRec.tipo === "solicitada" || targetRec.tipo === "colectiva");

    if (isTargetPaid) {
      setReceiptDocType("pago");
    } else if (isTargetSol) {
      setReceiptDocType("solicitadas");
    } else if (paidRecs.length > 0) {
      setReceiptDocType("pago");
    } else if (solColRecs.length > 0) {
      setReceiptDocType("solicitadas");
    } else {
      setReceiptDocType("pago");
    }

    const tg = (emp.total_ganado_mensual && emp.total_ganado_mensual > 0) ? emp.total_ganado_mensual : (((emp.haber_basico || 0) + (emp.otros || 0) > 0) ? ((emp.haber_basico || 0) + (emp.otros || 0)) : 3300);
    const sd = Number((tg / 30).toFixed(2));

    const selectedPaid = isTargetPaid
      ? targetRec!
      : (paidRecs.length > 0 ? paidRecs[0] : null);

    const dp = selectedPaid
      ? Number(selectedPaid.dias)
      : (emp.saldo_dias_pendientes > 0 ? emp.saldo_dias_pendientes : ((emp.dias_pagados && emp.dias_pagados > 0) ? emp.dias_pagados : 0));

    setReciboNro(selectedPaid ? `00${selectedPaid.id}` : "001");
    setReciboPaidRecordId(selectedPaid ? selectedPaid.id : "manual");
    setReciboTotalGanado(tg);
    setReciboSalarioDiario(sd);
    setReciboDiasPagados(dp);
    setReciboImporteCancelado(Number((sd * dp).toFixed(2)));
    setReciboModoFraccionado(Boolean(selectedPaid?.modo_calculo === "fraccionado"));

    const today = new Date();
    const meses = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
    
    // Lugar y fecha: si se seleccionó un registro de vacación pagada, tomar su fecha para la vista previa;
    // para la Fecha de Conciliación usar la fecha del cierre si ya es cierre, caso contrario hoy por defecto.
    let recDate = today;
    let corteStr = formatYMD(today);
    const isSelectedPaidCierre = Boolean(selectedPaid?.es_cierre_conciliado || selectedPaid?.modo_calculo === "fraccionado");
    if (selectedPaid) {
      const recDateStr = selectedPaid.fecha_solicitud || selectedPaid.fecha_inicio;
      if (recDateStr) {
        const cleanStr = recDateStr.includes("T") ? recDateStr.split("T")[0] : recDateStr;
        if (isSelectedPaidCierre) {
          corteStr = cleanStr;
        }
        const parts = cleanStr.split("-").map(Number);
        if (parts.length === 3 && parts[0] > 1900 && parts[1] >= 1 && parts[1] <= 12) {
          recDate = new Date(parts[0], parts[1] - 1, parts[2]);
        }
      }
    }
    setReciboFechaCorte(corteStr);
    setReciboLugarFecha(`La Paz, ${recDate.getDate()} de ${meses[recDate.getMonth()]} de ${recDate.getFullYear()}`);
    setReciboEmpleadorNombre(summary?.tenant_empleador || "Hipólito Manrrique Santi");
    setReciboEmpleadorRol("propietario");
    setReciboEmpleadorCi(summary?.tenant_empleador_ci || "6570013");

    // Ficha Solicitadas
    setFichaTipoFilter(isTargetSol ? (targetRec!.tipo as any) : "todas");
    setFichaSelectedRecordIds(isTargetSol ? [targetRec!.id] : solColRecs.map(r => r.id));
    setFichaObservaciones("");
    setFichaResponsableNombre(summary?.tenant_empleador || "Hipólito Manrrique Santi");
    const fichaDateStr = isTargetSol ? (targetRec!.fecha_solicitud || targetRec!.fecha_inicio) : null;
    setFichaFecha(fichaDateStr ? formatDMY(fichaDateStr) : formatDMY(formatYMD(today)));
  };

  const handleSelectPaidRecord = (val: string) => {
    if (!receiptEmployee) return;
    const paidRecs = (receiptEmployee.records || []).filter(r => r.tipo === "dias_pagados" || r.tipo === "a_cuenta");
    
    if (val === "all") {
      setReciboPaidRecordId("all");
      setReciboModoFraccionado(false);
      const dp = receiptEmployee.dias_pagados || 0;
      setReciboDiasPagados(dp);
      setReciboImporteCancelado(Number((reciboSalarioDiario * dp).toFixed(2)));
    } else if (val === "manual") {
      setReciboPaidRecordId("manual");
    } else {
      const recId = Number(val);
      setReciboPaidRecordId(recId);
      const found = paidRecs.find(r => r.id === recId);
      if (found) {
        setReciboNro(`00${found.id}`);
        setReciboModoFraccionado(Boolean(found.modo_calculo === "fraccionado"));
        const dp = Number(found.dias);
        setReciboDiasPagados(dp);
        setReciboImporteCancelado(Number((reciboSalarioDiario * dp).toFixed(2)));
        const recDateStr = found.fecha_solicitud || found.fecha_inicio;
        if (recDateStr) {
          const cleanStr = recDateStr.includes("T") ? recDateStr.split("T")[0] : recDateStr;
          setReciboFechaCorte(cleanStr);
          const parts = cleanStr.split("-").map(Number);
          if (parts.length === 3 && parts[0] > 1900 && parts[1] >= 1 && parts[1] <= 12) {
            const d = new Date(parts[0], parts[1] - 1, parts[2]);
            const meses = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
            setReciboLugarFecha(`La Paz, ${d.getDate()} de ${meses[d.getMonth()]} de ${d.getFullYear()}`);
          }
        }
      }
    }
  };

  const handleToggleReciboFraccionado = (enabled: boolean) => {
    if (!receiptEmployee) return;
    setReciboModoFraccionado(enabled);
    const corteStr = reciboFechaCorte || formatYMD(new Date());
    if (enabled) {
      setReciboPaidRecordId("manual");
      const calc = calcularLiquidacionEmpleado(receiptEmployee, corteStr);
      const diasLiq = Math.max(0, calc.saldoFraccionado);
      setReciboDiasPagados(diasLiq);
      setReciboImporteCancelado(Number((reciboSalarioDiario * diasLiq).toFixed(2)));
      const parts = corteStr.split("-").map(Number);
      if (parts.length === 3) {
        const d = new Date(parts[0], parts[1] - 1, parts[2]);
        const meses = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
        setReciboLugarFecha(`La Paz, ${d.getDate()} de ${meses[d.getMonth()]} de ${d.getFullYear()}`);
      }
    } else {
      const calc = calcularLiquidacionEmpleado(receiptEmployee, corteStr);
      const diasStd = Math.max(0, calc.saldoEstandar);
      setReciboDiasPagados(diasStd);
      setReciboImporteCancelado(Number((reciboSalarioDiario * diasStd).toFixed(2)));
    }
  };

  const handleReciboFechaCorteChange = (newDate: string) => {
    setReciboFechaCorte(newDate);
    if (!newDate) return;
    const parts = newDate.split("-").map(Number);
    if (parts.length === 3 && parts[0] > 1900 && parts[1] >= 1 && parts[1] <= 12) {
      const d = new Date(parts[0], parts[1] - 1, parts[2]);
      const meses = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
      setReciboLugarFecha(`La Paz, ${d.getDate()} de ${meses[d.getMonth()]} de ${d.getFullYear()}`);
    }
    if (receiptEmployee && reciboModoFraccionado) {
      const calc = calcularLiquidacionEmpleado(receiptEmployee, newDate);
      const diasLiq = Math.max(0, calc.saldoFraccionado);
      setReciboDiasPagados(diasLiq);
      setReciboImporteCancelado(Number((reciboSalarioDiario * diasLiq).toFixed(2)));
    }
  };

  const handleSaveCierreFromReceipt = async () => {
    if (!receiptEmployee || !tenantSchema) return;
    if (reciboDiasPagados <= 0) {
      Swal.fire({
        icon: "warning",
        title: "Sin días pendientes",
        text: "El saldo calculado es 0 o negativo. Verifica la fecha de corte o ingresa los días a liquidar.",
        confirmButtonColor: "#0D9488"
      });
      return;
    }

    const corte = reciboFechaCorte || formatYMD(new Date());
    const confirm = await Swal.fire({
      title: "¿Guardar Cierre Conciliado?",
      html: `<div class="text-sm text-left space-y-1.5">
        <p>Se registrará una liquidación y <strong>Cierre Conciliado</strong> para <strong>${receiptEmployee.employee_name}</strong> por:</p>
        <p class="font-mono font-bold text-teal-700">• ${fmtDias(reciboDiasPagados)} días — Bs ${reciboImporteCancelado.toLocaleString("es-BO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
        <p class="text-xs text-slate-600">Todas las obligaciones de vacación previas quedarán saldadas y su saldo activo se reiniciará en <strong>0.0 días</strong> a partir del <strong>${formatDMY(corte)}</strong>.</p>
      </div>`,
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Sí, consolidar y saldar en 0",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#0D9488"
    });

    if (!confirm.isConfirmed) return;

    setSavingCierreRecibo(true);
    try {
      const payload = {
        employee_id: receiptEmployee.employee_id,
        tipo: "dias_pagados",
        fecha_inicio: corte,
        fecha_fin: corte,
        fecha_solicitud: corte,
        dias: reciboDiasPagados,
        fechas_detalle: [],
        motivo: "CIERRE CONCILIADO",
        gestion: parseInt(corte.split("-")[0]) || new Date().getFullYear(),
        aprobado_por: reciboEmpleadorNombre || "",
        es_cierre_conciliado: true,
        modo_calculo: "fraccionado"
      };

      const res = await fetch(`${getApiUrl()}/api/tenants/${tenantSchema}/vacaciones/record/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({ detail: "Error al registrar cierre conciliado" }));
        throw new Error(errData.detail || "No se pudo guardar el cierre conciliado");
      }

      const savedRec: VacationRecord = await res.json();
      setReciboPaidRecordId(savedRec.id);
      setReciboNro(`00${savedRec.id}`);

      await fetchSummary(fechaDesde, fechaHasta, modoFraccionado);
      if (viewingEmployee && viewingEmployee.employee_id === receiptEmployee.employee_id) {
        await refreshEmployeeData(receiptEmployee.employee_id, modalFechaDesde || fechaDesde, modalFechaHasta || fechaHasta, modoFraccionado);
      }

      Swal.fire({
        toast: true,
        position: "top-end",
        icon: "success",
        title: "Cierre Conciliado Guardado",
        text: `Saldo liquidado (${fmtDias(reciboDiasPagados)} d). El trabajador inicia un nuevo ciclo en 0.0 días.`,
        timer: 3800,
        showConfirmButton: false,
        timerProgressBar: true
      });
    } catch (err: any) {
      Swal.fire({
        icon: "error",
        title: "Error al guardar cierre",
        text: err.message || "Ocurrió un problema al guardar el cierre conciliado."
      });
    } finally {
      setSavingCierreRecibo(false);
    }
  };

  const handleTotalGanadoChange = (newTg: number) => {
    setReciboTotalGanado(newTg);
    const newSd = Number((newTg / 30).toFixed(2));
    setReciboSalarioDiario(newSd);
    setReciboImporteCancelado(Number((newSd * reciboDiasPagados).toFixed(2)));
  };

  const handleDiasPagadosChange = (newDias: number) => {
    setReciboDiasPagados(newDias);
    setReciboImporteCancelado(Number((reciboSalarioDiario * newDias).toFixed(2)));
  };

  const employeeFichaRecords = useMemo(() => {
    if (!receiptEmployee) return [];
    return (receiptEmployee.records || []).filter(r => {
      if (fichaTipoFilter === "solicitada") return r.tipo === "solicitada";
      if (fichaTipoFilter === "colectiva") return r.tipo === "colectiva";
      return r.tipo === "solicitada" || r.tipo === "colectiva";
    });
  }, [receiptEmployee, fichaTipoFilter]);

  const activeFichaRecords = useMemo(() => {
    return employeeFichaRecords.filter(r => fichaSelectedRecordIds.includes(r.id));
  }, [employeeFichaRecords, fichaSelectedRecordIds]);

  const totalDiasFicha = useMemo(() => {
    return activeFichaRecords.reduce((acc, r) => acc + (Number(r.dias) || 0), 0);
  }, [activeFichaRecords]);

  const handleToggleFichaRecord = (id: number) => {
    setFichaSelectedRecordIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleExportReceiptBackend = async (format: "excel" | "pdf") => {
    if (!receiptEmployee || !tenantSchema) return;
    try {
      if (format === "excel") setExportingReceiptExcel(true);
      else setExportingReceiptPdf(true);

      const qParams = new URLSearchParams();
      if (typeof reciboPaidRecordId === "number") {
        qParams.set("record_id", String(reciboPaidRecordId));
      }
      qParams.set("dias", String(reciboDiasPagados));
      qParams.set("total_ganado", String(reciboTotalGanado));
      qParams.set("recibo_nro", reciboNro);
      if (reciboLugarFecha) qParams.set("lugar_fecha", reciboLugarFecha);
      if (reciboEmpleadorNombre) qParams.set("empleador_nombre", reciboEmpleadorNombre);
      if (reciboEmpleadorRol) qParams.set("empleador_rol", reciboEmpleadorRol);
      if (reciboEmpleadorCi) qParams.set("empleador_ci", reciboEmpleadorCi);
      qParams.set("firmas_en_blanco", String(reciboFirmasEnBlanco));

      const qs = qParams.toString() ? `?${qParams.toString()}` : "";
      const res = await fetch(`${getApiUrl()}/api/tenants/${tenantSchema}/vacaciones/recibo-pago/${receiptEmployee.employee_id}/${format}${qs}`);
      if (!res.ok) throw new Error("Error al exportar recibo de pago");

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const ext = format === "excel" ? "xlsx" : "pdf";
      const empSlug = receiptEmployee.employee_name.toLowerCase().replace(/\s+/g, "_");
      a.download = `Recibo_Vacaciones_${empSlug}.${ext}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      console.error(err);
      Swal.fire({
        icon: "error",
        title: "Error al exportar",
        text: err.message || "No se pudo generar el recibo."
      });
    } finally {
      setExportingReceiptExcel(false);
      setExportingReceiptPdf(false);
    }
  };

  const handleExportFichaBackend = async (format: "excel" | "pdf") => {
    if (!receiptEmployee || !tenantSchema) return;
    try {
      if (format === "excel") setExportingReceiptExcel(true);
      else setExportingReceiptPdf(true);

      const qParams = new URLSearchParams();
      qParams.set("tipo", fichaTipoFilter);
      if (fichaSelectedRecordIds.length > 0) {
        qParams.set("record_ids", fichaSelectedRecordIds.join(","));
      }
      if (fichaObservaciones) qParams.set("observaciones", fichaObservaciones);
      if (fichaResponsableNombre) qParams.set("responsable_nombre", fichaResponsableNombre);
      if (fichaFecha) qParams.set("fecha", fichaFecha);
      qParams.set("firmas_en_blanco", String(reciboFirmasEnBlanco));

      const qs = qParams.toString() ? `?${qParams.toString()}` : "";
      const res = await fetch(`${getApiUrl()}/api/tenants/${tenantSchema}/vacaciones/ficha-solicitadas/${receiptEmployee.employee_id}/${format}${qs}`);
      if (!res.ok) throw new Error("Error al exportar ficha de vacaciones");

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const ext = format === "excel" ? "xlsx" : "pdf";
      const empSlug = receiptEmployee.employee_name.toLowerCase().replace(/\s+/g, "_");
      a.download = `Ficha_Vacaciones_${empSlug}.${ext}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      console.error(err);
      Swal.fire({
        icon: "error",
        title: "Error al exportar",
        text: err.message || "No se pudo generar la ficha de vacaciones."
      });
    } finally {
      setExportingReceiptExcel(false);
      setExportingReceiptPdf(false);
    }
  };

  const handlePrintDocument = () => {
    window.print();
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmpId) {
      Swal.fire({ icon: "warning", title: "Atención", text: "Selecciona un empleado." });
      return;
    }

    let computedDays = 0;
    let startDate = "";
    let endDate = "";
    let fechasDetalle: string[] = [];

    if (vacationType === "dias_pagados") {
      const numDays = parseFloat(diasPagadosInput);
      if (!numDays || numDays <= 0) {
        Swal.fire({ icon: "warning", title: "Atención", text: "Ingresa el número de días pagados (mayor a 0)." });
        return;
      }
      computedDays = numDays;
      const paymentDate = fechaPago || formatYMD(new Date());
      startDate = paymentDate;
      endDate = paymentDate;
      fechasDetalle = [];
    } else {
      if (selectedDates.length === 0) {
        Swal.fire({ icon: "warning", title: "Atención", text: "Selecciona al menos un día en el calendario." });
        return;
      }
      const sortedDates = [...selectedDates].sort();
      startDate = sortedDates[0];
      endDate = sortedDates[sortedDates.length - 1];
      computedDays = sortedDates.length;
      fechasDetalle = sortedDates;
    }

    setSubmitting(true);
    try {
      const isPaidType = vacationType === "dias_pagados";
      const isUnifiedCierre = isPaidType && (esCierreConciliado || liquidacionFraccionada);
      const finalMotivo = isUnifiedCierre
        ? "CIERRE CONCILIADO"
        : (motivo.trim() || (isPaidType ? "Días de vacación pagados en liquidación / compensación" : `Vacaciones ${vacationType}`));
      const finalFechaSolicitud = isUnifiedCierre
        ? startDate
        : (fechaSolicitud ? fechaSolicitud : null);

      const payload = {
        employee_id: selectedEmpId,
        tipo: vacationType,
        fecha_inicio: startDate,
        fecha_fin: endDate,
        dias: computedDays,
        fechas_detalle: fechasDetalle,
        motivo: finalMotivo,
        fecha_solicitud: finalFechaSolicitud,
        gestion: parseInt(startDate.split("-")[0]) || new Date().getFullYear(),
        aprobado_por: "",
        es_cierre_conciliado: isUnifiedCierre,
        modo_calculo: isUnifiedCierre ? "fraccionado" : "estandar"
      };

      let res;
      if (editingRecordId) {
        res = await fetch(`${getApiUrl()}/api/tenants/${tenantSchema}/vacaciones/record/${editingRecordId}/`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
      } else {
        res = await fetch(`${getApiUrl()}/api/tenants/${tenantSchema}/vacaciones/record/`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
      }

      if (!res.ok) {
        const errData = await res.json().catch(() => ({ detail: "Error procesando vacación" }));
        throw new Error(errData.detail || "Error al procesar el registro");
      }

      // Actualizar resumen en segundo plano para que el saldo se actualice en la pantalla
      await fetchSummary(fechaDesde, fechaHasta, modoFraccionado);

      // Si la ficha individual del empleado está abierta, refrescarla de inmediato con el periodo evaluado activo
      if (viewingEmployee && (viewingEmployee.employee_id === selectedEmpId || editingRecordId)) {
        const empToRefresh = selectedEmpId || viewingEmployee.employee_id;
        const activeModalDesde = modalFechaDesde || fechaDesde;
        const activeModalHasta = modalFechaHasta || fechaHasta;
        await refreshEmployeeData(empToRefresh, activeModalDesde, activeModalHasta, modoFraccionado);
      }

      const empName = selectedEmp?.employee_name || "Trabajador";
      const tipoLabel = isPaidType
        ? (esCierreConciliado ? "Cierre Conciliado" : "Días Pagados")
        : vacationType === "colectiva" ? "Colectiva" : "Solicitada";

      if (editingRecordId) {
        setShowRegisterModal(false);
        setEditingRecordId(null);
        setSelectedDates([]);
        setRangeStart(null);
        setDiasPagadosInput("");
        setMotivo("");
        setFechaSolicitud("");
        setLiquidacionFraccionada(false);
        setEsCierreConciliado(false);

        Swal.fire({
          toast: true,
          position: "top-end",
          icon: "success",
          title: "¡Registro Modificado!",
          text: `Se actualizaron correctamente los datos de vacación para ${empName}.`,
          timer: 3000,
          showConfirmButton: false,
          timerProgressBar: true
        });
      } else {
        // Guardar información del último registro y NO cerrar la ventana en creación continua
        setLastSavedAlert({ empName, dias: computedDays, tipo: tipoLabel });

        // Limpiar campos para el siguiente registro manteniendo al empleado seleccionado
        const nextTodayYmd = formatYMD(new Date());
        setSelectedDates([]);
        setRangeStart(null);
        setDiasPagadosInput("");
        setMotivo("");
        setFechaPago(nextTodayYmd);
        setFechaSolicitud(nextTodayYmd);
        setLiquidacionFraccionada(false);
        setEsCierreConciliado(false);

        // Notificación toast moderna
        Swal.fire({
          toast: true,
          position: "top-end",
          icon: "success",
          title: "¡Vacación Registrada!",
          text: `Se registraron ${computedDays} días para ${empName}. Saldo actualizado. Puedes continuar registrando.`,
          timer: 3500,
          showConfirmButton: false,
          timerProgressBar: true
        });
      }
    } catch (err: any) {
      Swal.fire({
        icon: "error",
        title: "Error al guardar",
        text: err.message || "No se pudo registrar la vacación.",
        confirmButtonColor: "#0D9488"
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Días del mes en calendario moderno y estilizado
  const renderCalendarDays = () => {
    const firstDayIndex = new Date(calYear, calMonth, 1).getDay(); // 0 Dom, 1 Lun...
    const adjustedFirstDay = firstDayIndex === 0 ? 6 : firstDayIndex - 1; // 0 Lun, 6 Dom
    const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();

    const todayStr = formatYMD(new Date());

    const cells = [];
    // Celdas vacías previas
    for (let i = 0; i < adjustedFirstDay; i++) {
      cells.push(<div key={`empty-${i}`} className="h-10 w-full"></div>);
    }

    // Color del botón según el tipo de vacación
    const getSelectedGradient = () => {
      if (vacationType === "colectiva") return "bg-gradient-to-br from-purple-500 to-violet-600 text-white shadow-lg shadow-purple-500/40 ring-2 ring-purple-300 scale-105";
      return "bg-gradient-to-br from-teal-500 to-emerald-600 text-white shadow-lg shadow-teal-500/40 ring-2 ring-teal-300 scale-105";
    };

    // Celdas de los días del mes
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${calYear}-${String(calMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      const isWeekendDay = isWeekend(dateStr);
      const isSelected = selectedDates.includes(dateStr);
      const isStart = rangeStart === dateStr;
      const isToday = dateStr === todayStr;

      let btnClasses = "h-10 w-full rounded-xl flex flex-col items-center justify-center text-xs font-bold transition-all duration-150 relative select-none ";
      
      if (isSelected) {
        btnClasses += `${getSelectedGradient()} z-10 `;
      } else if (isStart) {
        btnClasses += "bg-amber-500/30 text-amber-300 border-2 border-amber-400 scale-105 z-10 animate-pulse ";
      } else if (isWeekendDay) {
        btnClasses += onlyBusinessDays 
          ? "text-slate-600 bg-slate-900/30 border border-slate-800/30 line-through opacity-40 cursor-not-allowed " 
          : "text-slate-400 bg-slate-800/40 hover:bg-slate-800 cursor-pointer border border-white/5 ";
      } else {
        btnClasses += "text-slate-200 bg-slate-800/60 hover:bg-slate-700/80 hover:text-white cursor-pointer border border-slate-700/50 hover:border-teal-400/50 ";
      }

      if (isToday && !isSelected) {
        btnClasses += "ring-1 ring-teal-400/80 text-teal-300 font-black ";
      }

      cells.push(
        <button
          key={dateStr}
          type="button"
          onClick={() => handleDateClick(dateStr)}
          className={btnClasses}
          title={isWeekendDay && onlyBusinessDays ? "Día inhábil (fin de semana)" : `Día ${day} de ${MONTH_NAMES[calMonth]} ${calYear}`}
        >
          <span>{day}</span>
          {isSelected && (
            <span className="w-1.5 h-1.5 rounded-full bg-white mt-0.5 shadow-sm"></span>
          )}
          {isToday && !isSelected && (
            <span className="text-[9px] text-teal-400 font-normal leading-none mt-0.5">Hoy</span>
          )}
        </button>
      );
    }
    return cells;
  };

  const filteredEmployees = useMemo(() => {
    if (!summary?.employees) return [];
    const q = search.trim().toLowerCase();

    return summary.employees.filter(emp => {
      if (scaleFilter !== "todos" && String(emp.escala_dias) !== scaleFilter) {
        return false;
      }
      if (!q) return true;
      return (
        emp.employee_name.toLowerCase().includes(q) ||
        emp.employee_ci.toLowerCase().includes(q) ||
        emp.employee_cargo.toLowerCase().includes(q) ||
        (emp.employee_code && emp.employee_code.toLowerCase().includes(q))
      );
    });
  }, [summary, search, scaleFilter]);

  if (loading && !summary) {
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
      {/* Cabecera Principal */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-2">
        <div>
          <h1 className="text-3xl font-black text-slate-900 flex items-center gap-2.5 tracking-tight">
            <CalendarIcon className="text-teal-600 w-8 h-8" />
            Control y Cómputo de Vacaciones
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Control y cómputo de días hábiles y saldos de vacación del personal.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => handleExportCompany("excel")}
            disabled={exportingExcel}
            className="flex items-center gap-2 px-3.5 py-2.5 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 text-emerald-800 font-bold rounded-xl text-sm transition shadow-xs disabled:opacity-50"
            title="Exportar Planilla General en Excel"
          >
            {exportingExcel ? <Loader2 className="w-4 h-4 animate-spin text-emerald-800" /> : <FileSpreadsheet className="w-4 h-4 text-emerald-800" />}
            <span>Exportar Excel</span>
          </button>

          <button
            onClick={() => handleExportCompany("pdf")}
            disabled={exportingPdf}
            className="flex items-center gap-2 px-3.5 py-2.5 bg-rose-50 hover:bg-rose-100 border border-rose-300 text-rose-800 font-bold rounded-xl text-sm transition shadow-xs disabled:opacity-50"
            title="Exportar Planilla General en PDF"
          >
            {exportingPdf ? <Loader2 className="w-4 h-4 animate-spin text-rose-800" /> : <FileText className="w-4 h-4 text-rose-800" />}
            <span>Exportar PDF</span>
          </button>

          {/* Menú Desplegable de Exportación en Lote (Recibos y Fichas Empresa) */}
          <div className="relative" ref={batchMenuRef}>
            <button
              type="button"
              onClick={() => setBatchDropdownOpen((prev) => !prev)}
              className="flex items-center gap-2 px-3.5 py-2.5 bg-indigo-50 hover:bg-indigo-100 border border-indigo-300 text-indigo-900 font-bold rounded-xl text-sm transition shadow-xs"
              title="Exportar Recibos de Pago y Fichas de Vacación en Lote para toda la empresa (2 por hoja)"
            >
              <Receipt className="w-4 h-4 text-indigo-700" />
              <span>Recibos y Fichas (Lote)</span>
              <ChevronDown className={`w-3.5 h-3.5 text-indigo-600 transition-transform duration-200 ${batchDropdownOpen ? "rotate-180" : ""}`} />
            </button>

            {batchDropdownOpen && (
              <div className="absolute right-0 mt-2 w-80 md:w-96 bg-white rounded-2xl shadow-2xl border border-slate-200 p-4 z-50 text-slate-800 animate-in fade-in slide-in-from-top-2 duration-150">
                <div className="px-1 py-1 mb-3 border-b border-slate-100">
                  <div className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                    <Receipt className="w-4 h-4 text-indigo-600" />
                    <span>Emisión de Recibos y Fichas en Lote</span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Plantillas continuas tamaño Carta con 2 empleados distintos por hoja (corte al centro) para toda la empresa.
                  </p>
                </div>

                {/* Sección 1: Recibos de Pago de Vacación */}
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/90 mb-3">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                      <Banknote className="w-4 h-4 text-teal-600" />
                      Recibos de Pago de Vacaciones
                    </span>
                    <span className="text-[10px] bg-teal-100 text-teal-800 font-extrabold px-2 py-0.5 rounded-full border border-teal-200">
                      2 por hoja
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 mb-2.5">
                    Recibo económico con salario diario, desglose y firmas listas para corte e impresión.
                  </p>
                  
                  <label className="flex items-center gap-2 text-[11px] text-slate-700 font-medium cursor-pointer mb-3 select-none">
                    <input
                      type="checkbox"
                      checked={batchSoloConPagos}
                      onChange={(e) => setBatchSoloConPagos(e.target.checked)}
                      className="rounded text-teal-600 focus:ring-teal-500 w-4 h-4"
                    />
                    <span>Solo empleados con días pagados &gt; 0</span>
                  </label>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => handleExportBatchRecibos("excel")}
                      disabled={exportingBatchReciboExcel}
                      className="flex items-center justify-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold rounded-xl text-xs transition shadow-xs"
                      title="Descargar lote de Recibos de Pago en Excel (2 empleados por hoja con corte al centro)"
                    >
                      {exportingBatchReciboExcel ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileSpreadsheet className="w-3.5 h-3.5" />}
                      <span>Excel Lote</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleExportBatchRecibos("pdf")}
                      disabled={exportingBatchReciboPdf}
                      className="flex items-center justify-center gap-1.5 px-3 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-bold rounded-xl text-xs transition shadow-xs"
                      title="Descargar lote de Recibos de Pago en PDF (2 empleados por hoja con corte al centro)"
                    >
                      {exportingBatchReciboPdf ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5" />}
                      <span>PDF Lote</span>
                    </button>
                  </div>
                </div>

                {/* Sección 2: Fichas Solicitadas y Colectivas */}
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/90">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                      <FileCheck className="w-4 h-4 text-indigo-600" />
                      Fichas Solicitadas y Colectivas
                    </span>
                    <span className="text-[10px] bg-indigo-100 text-indigo-800 font-extrabold px-2 py-0.5 rounded-full border border-indigo-200">
                      2 por hoja
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 mb-2.5">
                    Ficha de registro de días tomados, detalle y líneas punteadas de conformidad.
                  </p>

                  <label className="flex items-center gap-2 text-[11px] text-slate-700 font-medium cursor-pointer mb-3 select-none">
                    <input
                      type="checkbox"
                      checked={batchSoloConVacaciones}
                      onChange={(e) => setBatchSoloConVacaciones(e.target.checked)}
                      className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                    />
                    <span>Solo empleados con vacaciones tomadas</span>
                  </label>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => handleExportBatchFichas("excel")}
                      disabled={exportingBatchFichaExcel}
                      className="flex items-center justify-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold rounded-xl text-xs transition shadow-xs"
                      title="Descargar lote de Fichas en Excel (2 empleados por hoja con corte al centro)"
                    >
                      {exportingBatchFichaExcel ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileSpreadsheet className="w-3.5 h-3.5" />}
                      <span>Excel Lote</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleExportBatchFichas("pdf")}
                      disabled={exportingBatchFichaPdf}
                      className="flex items-center justify-center gap-1.5 px-3 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-bold rounded-xl text-xs transition shadow-xs"
                      title="Descargar lote de Fichas en PDF (2 empleados por hoja con corte al centro)"
                    >
                      {exportingBatchFichaPdf ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5" />}
                      <span>PDF Lote</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          <button
            onClick={() => handleOpenRegisterModal()}
            className="flex items-center gap-2 px-4 py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl text-sm transition shadow-md hover:shadow-lg transform hover:-translate-y-0.5"
          >
            <Plus className="w-4 h-4" />
            <span>Registrar Vacación</span>
          </button>
        </div>
      </div>

      {/* Periodo de Cómputo Principal */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-teal-50 text-teal-700 rounded-xl">
            <CalendarRange className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-black text-slate-800 uppercase tracking-wider block">
                Periodo de Cómputo
              </span>
              <span className="text-[11px] font-mono font-bold text-teal-700 bg-teal-50 border border-teal-200 px-2 py-0.5 rounded-md">
                DEL {formatDMY(fechaDesde)} AL {formatDMY(fechaHasta)}
              </span>
            </div>
            <span className="text-xs text-slate-500">
              Cómputo activo de derechos, movimientos y exportaciones.
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Accesos rápidos de periodo */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              type="button"
              onClick={() => {
                const d1 = `${currentYear}-01-01`;
                const d2 = `${currentYear}-12-31`;
                updatePeriodoCompleto(d1, d2);
              }}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition ${
                fechaDesde === `${currentYear}-01-01` && fechaHasta === `${currentYear}-12-31`
                  ? "bg-white text-teal-700 shadow-xs border border-slate-200"
                  : "text-slate-600 hover:text-slate-900"
              }`}
              title="Ajustar al año en curso y recargar datos"
            >
              Gestión {currentYear}
            </button>
            <button
              type="button"
              onClick={() => {
                const now = new Date();
                const y = now.getFullYear();
                const m = now.getMonth();
                const firstDay = new Date(y, m, 1);
                const lastDay = new Date(y, m + 1, 0);
                const d1 = formatYMD(firstDay);
                const d2 = formatYMD(lastDay);
                updatePeriodoCompleto(d1, d2);
              }}
              className="px-3 py-1.5 text-xs font-bold rounded-lg text-slate-600 hover:text-slate-900 transition"
              title="Ajustar al mes en curso y recargar datos"
            >
              Mes Actual
            </button>
            <button
              type="button"
              onClick={() => {
                const d1 = `${currentYear - 1}-01-01`;
                const d2 = `${currentYear - 1}-12-31`;
                updatePeriodoCompleto(d1, d2);
              }}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition ${
                fechaDesde === `${currentYear - 1}-01-01` && fechaHasta === `${currentYear - 1}-12-31`
                  ? "bg-white text-teal-700 shadow-xs border border-slate-200"
                  : "text-slate-600 hover:text-slate-900"
              }`}
              title={`Ajustar al año ${currentYear - 1} y recargar datos`}
            >
              Año {currentYear - 1}
            </button>
            <button
              type="button"
              onClick={() => {
                const d1 = "2000-01-01";
                const d2 = formatYMD(new Date());
                updatePeriodoCompleto(d1, d2);
              }}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition ${
                fechaDesde === "2000-01-01"
                  ? "bg-white text-teal-700 shadow-xs border border-slate-200"
                  : "text-slate-600 hover:text-slate-900"
              }`}
              title="Ajustar al historial total desde el inicio y recargar datos"
            >
              Histórico
            </button>
          </div>

          {/* Inputs de fecha Desde y Hasta con guardado inteligente */}
          <div className="flex items-center gap-1.5 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200 text-xs">
            <span className="font-bold text-slate-600 text-[11px]">Desde:</span>
            <input
              type="date"
              value={fechaDesde}
              onChange={(e) => updateFechaDesde(e.target.value)}
              className="px-2 py-0.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
            <span className="font-bold text-slate-600 text-[11px] ml-1">Hasta:</span>
            <input
              type="date"
              value={fechaHasta}
              onChange={(e) => updateFechaHasta(e.target.value)}
              className="px-2 py-0.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>

          {/* Toggle Cómputo Anual vs Exacto / Fraccionado */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200/80">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider px-2">Cómputo:</span>
            <button
              type="button"
              onClick={() => {
                if (modoFraccionado) {
                  setModoFraccionado(false);
                  fetchSummary(fechaDesde, fechaHasta, false);
                }
              }}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                !modoFraccionado
                  ? "bg-white text-slate-900 shadow-xs border border-slate-200"
                  : "text-slate-500 hover:text-slate-800"
              }`}
              title="Cálculo legal estándar por años completos (Art. 44 LGT)"
            >
              Anual
            </button>
            <button
              type="button"
              onClick={() => {
                if (!modoFraccionado) {
                  setModoFraccionado(true);
                  fetchSummary(fechaDesde, fechaHasta, true);
                }
              }}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                modoFraccionado
                  ? "bg-teal-600 text-white shadow-xs"
                  : "text-slate-500 hover:text-slate-800"
              }`}
              title="Cálculo proporcional exacto considerando años, meses (÷12) y días (÷30)"
            >
              Exacto / Fraccionado
            </button>
          </div>

          {/* Botón de Recargar Principal */}
          <button
            type="button"
            onClick={() => {
              setStoredVacationsPeriod(fechaDesde, fechaHasta, tenantSchema);
              fetchSummary(fechaDesde, fechaHasta, modoFraccionado);
            }}
            disabled={isRefreshing}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold transition shadow-xs disabled:opacity-50 active:scale-95 cursor-pointer"
            title="Recargar y actualizar cómputo de vacaciones con las fechas seleccionadas"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
            <span>{isRefreshing ? "Actualizando..." : "Recargar"}</span>
          </button>
        </div>
      </div>

      {/* Tarjetas KPI de Resumen Global */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between gap-1">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Derecho Acumulado</span>
            {modoFraccionado && (
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-teal-100 text-teal-800 border border-teal-200 uppercase">
                Exacto
              </span>
            )}
          </div>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-2xl font-black text-slate-900">{fmtDias(summary?.total_dias_acumulados)}</span>
            <span className="text-xs font-semibold text-slate-400">días</span>
          </div>
          <span className="text-[11px] text-teal-600 font-medium mt-1">
            {modoFraccionado ? "Incluye fracción meses y días" : "Derecho acumulado"}
          </span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Días Pagados</span>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-2xl font-black text-emerald-600">
              {fmtDias(summary?.total_dias_pagados ?? summary?.total_dias_a_cuenta ?? 0)}
            </span>
            <span className="text-xs font-semibold text-slate-400">días</span>
          </div>
          <span className="text-[11px] text-emerald-600 font-medium mt-1">Días pagados</span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Solicitadas</span>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-2xl font-black text-indigo-600">{fmtDias(summary?.total_dias_solicitadas)}</span>
            <span className="text-xs font-semibold text-slate-400">días</span>
          </div>
          <span className="text-[11px] text-indigo-600 font-medium mt-1">Vacaciones solicitadas</span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Colectivas</span>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-2xl font-black text-purple-600">{fmtDias(summary?.total_dias_colectivas)}</span>
            <span className="text-xs font-semibold text-slate-400">días</span>
          </div>
          <span className="text-[11px] text-purple-600 font-medium mt-1">Vacaciones colectivas</span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Gozadas</span>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-2xl font-black text-amber-600">{fmtDias(summary?.total_dias_tomados)}</span>
            <span className="text-xs font-semibold text-slate-400">días</span>
          </div>
          <span className="text-[11px] text-amber-600 font-medium mt-1">Total gozadas</span>
        </div>

        <div className="bg-teal-50/70 p-5 rounded-2xl border border-teal-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between gap-1">
            <span className="text-xs font-bold text-teal-800 uppercase tracking-wider">Saldo Pendiente</span>
            {modoFraccionado && (
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-teal-600 text-white uppercase">
                Fracc.
              </span>
            )}
          </div>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-2xl font-black text-teal-700">{fmtDias(summary?.total_saldo_pendiente)}</span>
            <span className="text-xs font-semibold text-teal-600">días</span>
          </div>
          <span className="text-[11px] text-teal-700 font-bold mt-1">Saldo disponible</span>
        </div>
      </div>

      {/* Tabla Principal y Filtros */}
      <div className="bg-white rounded-[2rem] shadow-xs border border-slate-200/80 overflow-hidden">
        
        {/* Barra de Filtros */}
        <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex flex-col md:flex-row justify-between items-stretch md:items-center gap-4">
          <div className="relative max-w-md flex-1">
            <Search className="absolute left-4 top-3 text-slate-400 w-4 h-4" />
            <input 
              type="text" 
              placeholder="Buscar por empleado, C.I., código o cargo..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-11 pr-4 py-2 rounded-xl border border-slate-300 text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white text-sm"
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-500">Filtrar Escala:</span>
            <div className="flex bg-slate-200/80 p-1 rounded-xl gap-1">
              <button
                onClick={() => setScaleFilter("todos")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${scaleFilter === "todos" ? "bg-white text-slate-900 shadow-xs" : "text-slate-600 hover:text-slate-900"}`}
              >
                Todas ({summary?.employees.length || 0})
              </button>
              <button
                onClick={() => setScaleFilter("15")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${scaleFilter === "15" ? "bg-teal-600 text-white shadow-xs" : "text-slate-600 hover:text-slate-900"}`}
              >
                15 Días
              </button>
              <button
                onClick={() => setScaleFilter("20")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${scaleFilter === "20" ? "bg-teal-600 text-white shadow-xs" : "text-slate-600 hover:text-slate-900"}`}
              >
                20 Días
              </button>
              <button
                onClick={() => setScaleFilter("30")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${scaleFilter === "30" ? "bg-teal-600 text-white shadow-xs" : "text-slate-600 hover:text-slate-900"}`}
              >
                30 Días
              </button>
            </div>
          </div>
        </div>

        {/* Tabla General de Control de Vacaciones */}
        <div className="w-full overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          <table className="w-full text-left border-collapse text-xs sm:text-sm">
            <thead>
              <tr className="bg-slate-50 text-slate-700 font-semibold text-xs uppercase tracking-wider border-b border-slate-200">
                <th className="py-3 px-3 pl-5 w-28">C.I. / Cód.</th>
                <th className="py-3 px-3">Trabajador / Cargo</th>
                <th className="py-3 px-3">Antigüedad / Escala</th>
                <th className="py-3 px-2 text-right" title="Días ganados acumulados por ley">Derecho (+)</th>
                <th className="py-3 px-2 text-right" title="Días pagados / compensados económicamente">Pagados</th>
                <th className="py-3 px-2 text-right" title="Días solicitados individualmente">Solicitadas</th>
                <th className="py-3 px-2 text-right" title="Días decretados de vacación colectiva">Colectivas</th>
                <th className="py-3 px-2.5 text-right" title="Total días gozados a la fecha">Gozadas (-)</th>
                <th className="py-3 px-3 text-right" title="Saldo disponible a la fecha de corte">Saldo (=)</th>
                <th className="py-3 px-3 pr-5 text-center w-24">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {filteredEmployees.length === 0 ? (
                <tr>
                  <td colSpan={10} className="p-8 text-center text-slate-400 font-medium">
                    No se encontraron empleados con los criterios seleccionados.
                  </td>
                </tr>
              ) : (
                filteredEmployees.map((emp) => (
                  <tr key={emp.employee_id} className="hover:bg-slate-50/70 transition">
                    <td className="py-3 px-3 pl-5 font-mono text-xs font-bold text-slate-700 whitespace-nowrap">
                      <div>{emp.employee_ci}</div>
                      {emp.employee_code && (
                        <div className="text-[10px] text-teal-600 font-bold">Cód: {emp.employee_code}</div>
                      )}
                    </td>

                    <td className="py-3 px-3">
                      <div className="font-bold text-slate-900 leading-snug">{emp.employee_name}</div>
                      <div className="text-[11px] text-slate-500 font-medium">{emp.employee_cargo}</div>
                    </td>

                    <td className="py-3 px-3">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-slate-700 font-semibold">{emp.antiguedad_formato}</span>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          emp.escala_dias === 30 
                            ? "bg-purple-100 text-purple-700 border border-purple-200"
                            : emp.escala_dias === 20
                            ? "bg-blue-100 text-blue-700 border border-blue-200"
                            : "bg-teal-100 text-teal-800 border border-teal-200"
                        }`}>
                          {emp.escala_dias} d/año
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono mt-0.5">Desde: {formatDMY(emp.fecha_ingreso)}</div>
                      {emp.tiene_cierre_conciliado && emp.fecha_ultimo_cierre && (
                        <div
                          className="mt-1 inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold"
                          title={`Último Cierre Conciliado: ${formatDMY(emp.fecha_ultimo_cierre)} (${fmtDias(emp.dias_ultimo_cierre)} d liquidados)`}
                        >
                          ✓ Cierre Conciliado: {formatDMY(emp.fecha_ultimo_cierre)}
                        </div>
                      )}
                    </td>

                    <td className="py-3 px-2 text-right font-mono font-bold text-slate-900 text-xs sm:text-sm">
                      <div>{fmtDias(emp.dias_acumulados)}</div>
                      {modoFraccionado && emp.dias_por_meses !== undefined && (
                        <div className="text-[10px] font-normal text-teal-600" title={`Años: ${fmtDias(emp.dias_por_anios)} | Meses: ${fmtDias(emp.dias_por_meses)} | Días: ${fmtDias(emp.dias_por_dias)}`}>
                          Fracc.
                        </div>
                      )}
                    </td>

                    <td className="py-3 px-2 text-right font-mono text-emerald-700 font-semibold text-xs sm:text-sm">
                      {fmtDias(emp.dias_pagados ?? emp.dias_a_cuenta ?? 0)}
                    </td>

                    <td className="py-3 px-2 text-right font-mono text-indigo-700 text-xs sm:text-sm">
                      {fmtDias(emp.dias_solicitadas)}
                    </td>

                    <td className="py-3 px-2 text-right font-mono text-purple-700 text-xs sm:text-sm">
                      {fmtDias(emp.dias_colectivas)}
                    </td>

                    <td className="py-3 px-2.5 text-right font-mono font-bold text-amber-700 text-xs sm:text-sm">
                      {fmtDias(emp.total_dias_tomados)}
                    </td>

                    <td className="py-3 px-3 text-right font-mono font-black text-sm sm:text-base whitespace-nowrap">
                      <span className={emp.saldo_dias_pendientes > 0 ? "text-teal-600" : emp.saldo_dias_pendientes === 0 ? "text-slate-400" : "text-rose-600"}>
                        {fmtDias(emp.saldo_dias_pendientes)} d
                      </span>
                    </td>

                    <td className="py-3 px-3 pr-5 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => handleOpenKardex(emp)}
                          className="p-1.5 text-slate-400 hover:text-teal-600 rounded-lg hover:bg-slate-100 transition"
                          title="Ver Ficha y Kárdex de Vacaciones"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleOpenRegisterModal(emp.employee_id)}
                          className="p-1.5 text-slate-400 hover:text-blue-600 rounded-lg hover:bg-slate-100 transition"
                          title="Registrar Vacación para este empleado"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleOpenReceiptsModal(emp)}
                          className="p-1.5 text-slate-400 hover:text-indigo-600 rounded-lg hover:bg-slate-100 transition"
                          title="Recibos y Comprobantes de Vacación (Pagadas, Solicitadas y Colectivas)"
                        >
                          <Receipt className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ========================================================= */}
      {/* MODAL 1: REGISTRO DE VACACIONES CON CALENDARIO INTUITIVO  */}
      {/* ========================================================= */}
      <AnimatePresence>
        {showRegisterModal && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-slate-900 border border-slate-700 rounded-[2rem] w-full max-w-4xl overflow-hidden shadow-2xl flex flex-col max-h-[94vh]"
            >
              {/* Header Modal */}
              <div className="p-6 border-b border-white/10 flex justify-between items-center bg-slate-900/90">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-teal-500/20 text-teal-400 rounded-xl">
                    <CalendarIcon className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-white">
                      {editingRecordId ? "Editar Registro de Vacación" : "Registrar Vacaciones de Personal"}
                    </h2>
                    <p className="text-xs text-slate-400">
                      {editingRecordId
                        ? "Modificación de días y fechas del registro."
                        : "Registro y cómputo de vacaciones del personal."}
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => {
                    if (!submitting) {
                      setShowRegisterModal(false);
                      setEditingRecordId(null);
                      setLastSavedAlert(null);
                    }
                  }}
                  className="text-slate-400 hover:text-white p-2 rounded-xl hover:bg-white/5 transition"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              {/* Form Content */}
              <div className="p-6 overflow-y-auto space-y-5 custom-scrollbar">
                
                {/* Banner de Confirmación Dinámica de Registro Guardado (Sin Salirse de la Ventana) */}
                {lastSavedAlert && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-emerald-500/15 border border-emerald-500/40 text-emerald-200 px-4 py-3 rounded-2xl flex items-center justify-between gap-3 shadow-md"
                  >
                    <div className="flex items-center gap-2.5 text-xs sm:text-sm">
                      <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                      <div>
                        <span className="font-bold text-white">¡Registro guardado exitosamente!</span>{" "}
                        <span>
                          Se registraron <strong className="text-emerald-300">{lastSavedAlert.dias} días</strong> ({lastSavedAlert.tipo}) para <strong className="text-white">{lastSavedAlert.empName}</strong>. El saldo se actualizó y puedes continuar registrando en esta misma ventana.
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setLastSavedAlert(null)}
                      className="text-emerald-400 hover:text-white p-1 rounded-lg transition"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </motion.div>
                )}

                <form id="vacationRegisterForm" onSubmit={handleRegisterSubmit} className="space-y-5">
                  
                  {/* Selector de Empleado y Tipo de Vacación */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-300 uppercase tracking-wide mb-1.5">
                        Trabajador Seleccionado *
                      </label>
                      <select
                        value={selectedEmpId || ""}
                        onChange={(e) => {
                          const newId = Number(e.target.value);
                          setSelectedEmpId(newId);
                          if (vacationType === "dias_pagados" && liquidacionFraccionada) {
                            const empObj = summary?.employees.find(em => em.employee_id === newId);
                            if (empObj) {
                              const c = calcularLiquidacionEmpleado(
                                empObj,
                                fechaPago || formatYMD(new Date()),
                                editingRecordId ?? undefined
                              );
                              if (c) setDiasPagadosInput(String(Math.max(0, c.saldoFraccionado)));
                            }
                          }
                        }}
                        className="w-full bg-slate-950/80 border border-slate-700 text-white rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-teal-400 text-sm font-semibold shadow-inner"
                      >
                        {summary?.employees.map(emp => {
                          const optSaldo = (vacationType === "dias_pagados" && liquidacionFraccionada)
                            ? (calcularLiquidacionEmpleado(emp, fechaPago || formatYMD(new Date()), editingRecordId ?? undefined)?.saldoFraccionado ?? emp.saldo_dias_pendientes)
                            : emp.saldo_dias_pendientes;
                          return (
                            <option key={emp.employee_id} value={emp.employee_id} className="bg-slate-900 text-white">
                              {emp.employee_name} — Saldo: {fmtDias(optSaldo)} d
                            </option>
                          );
                        })}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-300 uppercase tracking-wide mb-1.5">
                        Tipo de Vacación *
                      </label>
                      <div className="grid grid-cols-3 gap-2">
                        {/* Tipo: Días Pagados (Reemplaza a cuenta) */}
                        <button
                          type="button"
                          onClick={() => setVacationType("dias_pagados")}
                          className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all flex flex-col items-center justify-center gap-0.5 ${
                            vacationType === "dias_pagados" 
                              ? "bg-emerald-600 text-white border-emerald-400 shadow-md shadow-emerald-500/30 scale-[1.02]" 
                              : "bg-slate-950/60 text-slate-400 border-slate-700/80 hover:text-white hover:border-slate-600"
                          }`}
                        >
                          <span className="flex items-center gap-1">
                            <Banknote className="w-3.5 h-3.5" /> Días Pagados
                          </span>
                          <span className="text-[10px] font-normal opacity-80">Compensación</span>
                        </button>

                        {/* Tipo: Solicitada */}
                        <button
                          type="button"
                          onClick={() => setVacationType("solicitada")}
                          className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all flex flex-col items-center justify-center gap-0.5 ${
                            vacationType === "solicitada" 
                              ? "bg-teal-600 text-white border-teal-400 shadow-md shadow-teal-500/30 scale-[1.02]" 
                              : "bg-slate-950/60 text-slate-400 border-slate-700/80 hover:text-white hover:border-slate-600"
                          }`}
                        >
                          <span>Solicitada</span>
                          <span className="text-[10px] font-normal opacity-80">Ordinarias</span>
                        </button>

                        {/* Tipo: Colectiva */}
                        <button
                          type="button"
                          onClick={() => setVacationType("colectiva")}
                          className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all flex flex-col items-center justify-center gap-0.5 ${
                            vacationType === "colectiva" 
                              ? "bg-purple-600 text-white border-purple-400 shadow-md shadow-purple-500/30 scale-[1.02]" 
                              : "bg-slate-950/60 text-slate-400 border-slate-700/80 hover:text-white hover:border-slate-600"
                          }`}
                        >
                          <span>Colectiva</span>
                          <span className="text-[10px] font-normal opacity-80">Cierre grupal</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Ficha Resumen Rápido del Empleado Seleccionado */}
                  {selectedEmp && (() => {
                    const activeCorteModal = fechaPago || formatYMD(new Date());
                    const modalCalc = (vacationType === "dias_pagados" && (liquidacionFraccionada || esCierreConciliado))
                      ? calcularLiquidacionEmpleado(selectedEmp, activeCorteModal, editingRecordId ?? undefined)
                      : null;
                    const baseSaldoModal = modalCalc ? modalCalc.saldoFraccionado : selectedEmp.saldo_dias_pendientes;
                    const descuentoModal = vacationType === "dias_pagados" ? (parseFloat(diasPagadosInput) || 0) : selectedDates.length;
                    const saldoRestanteModal = Number((baseSaldoModal - descuentoModal).toFixed(2));
                    return (
                    <div className="bg-slate-950/70 border border-slate-700/80 rounded-2xl p-3.5 flex flex-wrap items-center justify-between gap-3 text-xs">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-teal-500/20 text-teal-400 border border-teal-500/30 flex items-center justify-center font-black text-sm">
                          {selectedEmp.employee_name.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div className="text-white font-bold">{selectedEmp.employee_name}</div>
                          <div className="text-slate-400 text-[11px]">
                            CI: {selectedEmp.employee_ci} • Cargo: {selectedEmp.employee_cargo} • Ingreso: <strong className="text-slate-300">{selectedEmp.fecha_ingreso}</strong>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <div className="bg-slate-900 border border-slate-700/80 px-3 py-1.5 rounded-xl text-center">
                          <span className="text-[10px] text-slate-400 block font-semibold">
                            {modalCalc ? "Saldo al Cierre" : "Saldo Disponible"}
                          </span>
                          <span className="text-sm font-black text-amber-400">{fmtDias(baseSaldoModal)} d</span>
                        </div>
                        <div className="bg-slate-900 border border-slate-700/80 px-3 py-1.5 rounded-xl text-center">
                          <span className="text-[10px] text-slate-400 block font-semibold">A Descontar</span>
                          <span className="text-sm font-black text-teal-400">
                            -{fmtDias(descuentoModal)} d
                          </span>
                        </div>
                        <div className={`border px-3 py-1.5 rounded-xl text-center ${
                          saldoRestanteModal < -0.001
                            ? "bg-rose-500/10 border-rose-500/30 text-rose-400"
                            : "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                        }`}>
                          <span className="text-[10px] opacity-80 block font-semibold">Saldo Restante</span>
                          <span className="text-sm font-black">
                            {fmtDias(Math.abs(saldoRestanteModal) < 0.005 ? 0 : saldoRestanteModal)} d
                          </span>
                        </div>
                      </div>
                    </div>
                    );
                  })()}

                  {/* ======================================================== */}
                  {/* CASO A: TIPO DÍAS PAGADOS (Número y Fecha de Liquidación) */}
                  {/* ======================================================== */}
                  {vacationType === "dias_pagados" ? (() => {
                    const todayYmd = formatYMD(new Date());
                    const corteTarget = fechaPago || todayYmd;
                    const isUnifiedActive = liquidacionFraccionada || esCierreConciliado;
                    const calcFracc = selectedEmp
                      ? calcularLiquidacionEmpleado(selectedEmp, corteTarget, editingRecordId ?? undefined)
                      : null;
                    return (
                    <div className="bg-slate-950/80 p-5 rounded-2xl border border-emerald-500/30 shadow-xl space-y-4">
                      {/* Opción Unificada: Liquidación Exacta / Fraccionada — Cierre Conciliado */}
                      <button
                        type="button"
                        onClick={() => {
                          const nextVal = !isUnifiedActive;
                          setLiquidacionFraccionada(nextVal);
                          setEsCierreConciliado(nextVal);
                          if (nextVal) {
                            const activeDate = fechaPago || todayYmd;
                            if (!fechaPago) setFechaPago(activeDate);
                            setFechaSolicitud(activeDate);
                            setMotivo("CIERRE CONCILIADO");
                            if (calcFracc) {
                              setDiasPagadosInput(String(Math.max(0, calcFracc.saldoFraccionado)));
                            }
                          } else {
                            if (motivo === "CIERRE CONCILIADO") setMotivo("");
                            if (calcFracc) {
                              setDiasPagadosInput(String(Math.max(0, calcFracc.saldoEstandar)));
                            }
                          }
                        }}
                        className={`w-full p-3.5 rounded-xl border text-left transition flex items-center justify-between gap-4 cursor-pointer ${
                          isUnifiedActive
                            ? "bg-gradient-to-r from-teal-500/15 to-emerald-500/15 border-emerald-400/70 text-white shadow-sm"
                            : "bg-slate-900/90 border-slate-700/80 text-slate-300 hover:border-slate-500"
                        }`}
                      >
                        <div>
                          <div className="text-xs font-bold flex flex-wrap items-center gap-2">
                            <span>Liquidación Exacta / Fraccionada — Cierre Conciliado</span>
                            {isUnifiedActive && (
                              <span className="text-[9px] font-black px-2 py-0.5 rounded bg-emerald-400 text-slate-950 uppercase tracking-wide">
                                ACTIVO • SALDO A 0
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-400 mt-1">
                            Calcula años completos + meses (÷ 12) + días (÷ 30) hasta la fecha de conciliación, descuenta vacaciones tomadas/pagadas y guarda el Cierre Conciliado reiniciando el saldo en 0.0 días.
                          </div>
                        </div>
                        <div className={`w-11 h-6 rounded-full shrink-0 p-0.5 transition ${isUnifiedActive ? "bg-emerald-500" : "bg-slate-700"}`}>
                          <div className={`w-5 h-5 rounded-full bg-white transition-transform ${isUnifiedActive ? "translate-x-5" : "translate-x-0"}`} />
                        </div>
                      </button>

                      {/* Desglose Matemático Fraccionado */}
                      {isUnifiedActive && calcFracc && (
                        <div className="bg-slate-900/90 border border-teal-500/30 rounded-xl p-3.5 text-xs space-y-2.5">
                          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2">
                            <span className="text-teal-300 font-bold">
                              Desglose Proporcional al {formatDMY(corteTarget)}
                              {calcFracc.tieneCierrePrevio && calcFracc.fechaCierrePrevio ? (
                                <span className="text-emerald-300 font-normal ml-1.5">
                                  (Ciclo desde cierre {formatDMY(calcFracc.fechaCierrePrevio)})
                                </span>
                              ) : (
                                <span className="text-slate-400 font-normal ml-1.5">(Desde ingreso)</span>
                              )}
                            </span>
                            <span className="font-mono text-[11px] text-slate-300">
                              Tiempo: <strong className="text-white">{calcFracc.anios}a {calcFracc.meses}m {calcFracc.dias}d</strong> • Escala actual: <strong className="text-teal-300">{calcFracc.escala} d/año</strong>
                            </span>
                          </div>

                          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 font-mono">
                            <div className="bg-slate-950/70 rounded-lg p-2 border border-slate-800">
                              <span className="text-[10px] text-slate-400 block font-sans">Años ({calcFracc.anios}a)</span>
                              <span className="font-bold text-white">{fmtDias(calcFracc.diasPorAnios)} d</span>
                            </div>
                            <div className="bg-slate-950/70 rounded-lg p-2 border border-slate-800" title={`${calcFracc.escala} ÷ 12 = ${calcFracc.tasaMensual.toFixed(4)} d/mes`}>
                              <span className="text-[10px] text-slate-400 block font-sans">Meses ({calcFracc.meses} × ÷12)</span>
                              <span className="font-bold text-teal-300">+{fmtDias(calcFracc.diasPorMeses)} d</span>
                            </div>
                            <div className="bg-slate-950/70 rounded-lg p-2 border border-slate-800" title={`${calcFracc.tasaMensual.toFixed(4)} ÷ 30 = ${calcFracc.tasaDiaria.toFixed(4)} d/día`}>
                              <span className="text-[10px] text-slate-400 block font-sans">Días ({calcFracc.dias} × ÷30)</span>
                              <span className="font-bold text-teal-300">+{fmtDias(calcFracc.diasPorDias)} d</span>
                            </div>
                            <div className="bg-slate-950/70 rounded-lg p-2 border border-slate-800" title={`Solicitadas: ${fmtDias(calcFracc.rebajaSolicitadas)} | Colectivas: ${fmtDias(calcFracc.rebajaColectivas)} | Pagadas: ${fmtDias(calcFracc.rebajaPagados)}`}>
                              <span className="text-[10px] text-slate-400 block font-sans">Rebajas (Tom/Pag)</span>
                              <span className="font-bold text-amber-300">-{fmtDias(calcFracc.totalRebaja)} d</span>
                            </div>
                            <div className="bg-teal-500/15 rounded-lg p-2 border border-teal-500/40 flex flex-col justify-between">
                              <span className="text-[10px] text-teal-200 block font-sans font-bold">Saldo Exacto</span>
                              <span className="font-black text-emerald-300 text-sm">{fmtDias(calcFracc.saldoFraccionado)} d</span>
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400">
                            <span>
                              Bruto acumulado: <strong className="text-slate-200">{fmtDias(calcFracc.totalFraccionado)} d</strong> • Solicitadas: <strong className="text-slate-200">{fmtDias(calcFracc.rebajaSolicitadas)} d</strong> • Colectivas: <strong className="text-slate-200">{fmtDias(calcFracc.rebajaColectivas)} d</strong> • Pagadas previas: <strong className="text-slate-200">{fmtDias(calcFracc.rebajaPagados)} d</strong>
                            </span>
                            <button
                              type="button"
                              onClick={() => setDiasPagadosInput(String(Math.max(0, calcFracc.saldoFraccionado)))}
                              className="px-2.5 py-1 bg-teal-600 hover:bg-teal-500 text-white font-bold rounded-lg transition cursor-pointer"
                            >
                              Aplicar {fmtDias(calcFracc.saldoFraccionado)} d
                            </button>
                          </div>
                        </div>
                      )}

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-bold text-slate-300 uppercase tracking-wide mb-1.5">
                            Número de Días Pagados *
                          </label>
                          <div className="relative">
                            <input
                              type="number"
                              step="0.01"
                              min="0.01"
                              placeholder="Ej. 15 o 12.58"
                              value={diasPagadosInput}
                              onChange={(e) => setDiasPagadosInput(e.target.value)}
                              className="w-full bg-slate-900 border border-slate-700 text-emerald-300 text-xl font-black rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-400 shadow-inner"
                              required
                              autoFocus
                            />
                            <span className="absolute right-4 top-3.5 text-xs font-bold text-slate-400">
                              Días
                            </span>
                          </div>
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-slate-300 uppercase tracking-wide mb-1.5">
                            {isUnifiedActive ? "Fecha de Conciliación (Hasta aquí) *" : "Fecha de Liquidación / Pago *"}
                          </label>
                          <input
                            type="date"
                            value={corteTarget}
                            onChange={(e) => {
                              const newVal = e.target.value;
                              setFechaPago(newVal);
                              if (isUnifiedActive) {
                                setFechaSolicitud(newVal);
                              }
                              if (isUnifiedActive && selectedEmp && newVal) {
                                const nextC = calcularLiquidacionEmpleado(selectedEmp, newVal, editingRecordId ?? undefined);
                                if (nextC) {
                                  setDiasPagadosInput(String(Math.max(0, nextC.saldoFraccionado)));
                                }
                              }
                            }}
                            className="w-full bg-slate-900 border border-slate-700 text-white text-base font-bold rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-400 shadow-inner"
                            required
                          />
                          {isUnifiedActive && (
                            <span className="text-[10px] text-slate-400 block mt-1">
                              Por defecto es el día actual; puedes ajustarla a una fecha pasada para cierres históricos.
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Accesos rápidos numéricos (ocultos cuando Cierre Conciliado / Exacto está activo) */}
                      {!isUnifiedActive && (
                        <div className="flex flex-wrap items-center gap-1.5 pt-1">
                          <span className="text-[10px] text-slate-400 font-semibold mr-1">Rápido:</span>
                          {[0.5, 1, 5, 10, 15, 20, 30].map(val => (
                            <button
                              key={val}
                              type="button"
                              onClick={() => setDiasPagadosInput(String(val))}
                              className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-lg border border-slate-700 transition"
                            >
                              +{val}
                            </button>
                          ))}
                          {(() => {
                            const targetFull = selectedEmp?.saldo_dias_pendientes ?? 0;
                            if (!selectedEmp || targetFull <= 0) return null;
                            return (
                              <button
                                type="button"
                                onClick={() => setDiasPagadosInput(String(targetFull))}
                                className="px-2.5 py-1 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 text-xs font-bold rounded-lg border border-emerald-500/30 transition"
                              >
                                Todo el Saldo ({fmtDias(targetFull)} d)
                              </button>
                            );
                          })()}
                        </div>
                      )}

                      {/* Previsualización en Vivo del Recibo de Pago de Vacaciones */}
                      {selectedEmp && (() => {
                        const previewDias = parseFloat(diasPagadosInput) || 0;
                        const previewTg = (selectedEmp.total_ganado_mensual && selectedEmp.total_ganado_mensual > 0)
                          ? selectedEmp.total_ganado_mensual
                          : (((selectedEmp.haber_basico || 0) + (selectedEmp.otros || 0) > 0)
                              ? ((selectedEmp.haber_basico || 0) + (selectedEmp.otros || 0))
                              : 3300);
                        const previewSd = Number((previewTg / 30).toFixed(2));
                        const previewImporte = Number((previewSd * previewDias).toFixed(2));
                        const empleadorNombre = summary?.tenant_empleador || "Hipólito Manrrique Santi";
                        const empleadorCi = summary?.tenant_empleador_ci || "6570013";
                        const empleadorRol = "propietario";
                        const mesesEs = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
                        const cParts = (corteTarget || "").split("-").map(Number);
                        const lugarFechaPreview = (cParts.length === 3 && cParts[0] > 1900 && cParts[1] >= 1 && cParts[1] <= 12)
                          ? `La Paz, ${cParts[2]} de ${mesesEs[cParts[1] - 1]} de ${cParts[0]}`
                          : `La Paz, ${formatDMY(corteTarget)}`;
                        const allIds = (summary?.employees || []).flatMap(em => (em.records || []).map(r => r.id || 0));
                        const maxRecId = allIds.length > 0 ? Math.max(...allIds) : 0;
                        const previewReciboNro = editingRecordId ? `00${editingRecordId}` : `00${maxRecId + 1}`;

                        return (
                          <div className="pt-2 border-t border-slate-800 space-y-2.5">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <Receipt className="w-4 h-4 text-emerald-400" />
                                <span className="text-xs font-bold text-white uppercase tracking-wide">
                                  Previsualización del Recibo de Pago
                                </span>
                                {isUnifiedActive && (
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                    Cierre Conciliado • Saldo a 0
                                  </span>
                                )}
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  handleOpenReceiptsModal(selectedEmp, editingRecordId ?? undefined);
                                  setReceiptDocType("pago");
                                  setReciboPaidRecordId(editingRecordId ?? "manual");
                                  setReciboNro(previewReciboNro);
                                  setReciboTotalGanado(previewTg);
                                  setReciboSalarioDiario(previewSd);
                                  setReciboDiasPagados(previewDias);
                                  setReciboImporteCancelado(previewImporte);
                                  setReciboFechaCorte(corteTarget);
                                  setReciboLugarFecha(lugarFechaPreview);
                                  setReciboModoFraccionado(isUnifiedActive);
                                }}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-teal-300 hover:text-white border border-slate-700 text-[11px] font-bold transition cursor-pointer"
                                title="Abrir este recibo en Comprobantes para imprimir o descargar en PDF / Excel"
                              >
                                <Printer className="w-3.5 h-3.5" />
                                <span>Abrir en Comprobantes / Exportar</span>
                              </button>
                            </div>

                            {/* Plantilla Blanca Oficial del Recibo de Pago */}
                            <div className="bg-white text-slate-900 rounded-xl border border-slate-300 shadow-lg p-5 sm:p-6 font-sans text-xs leading-relaxed">
                              <div className="flex justify-end items-center mb-2">
                                <div className="border border-slate-700 px-3 py-0.5 font-bold text-[11px] tracking-wide text-slate-900 bg-slate-50">
                                  RECIBO N.º {previewReciboNro}
                                </div>
                              </div>

                              <h4 className="text-sm font-black text-center text-slate-900 tracking-wider mb-3 uppercase">
                                RECIBO DE PAGO DE VACACIONES
                              </h4>

                              <p className="text-[11.5px] sm:text-xs text-slate-800 leading-relaxed mb-3 text-justify">
                                Yo, <span className="font-bold uppercase underline decoration-slate-400">{selectedEmp.employee_name}</span> con C.I. <span className="font-bold font-mono">{selectedEmp.employee_ci}</span>, declaro haber recibido de <span className="font-bold uppercase">{empleadorNombre}</span>, <span className="italic">{empleadorRol}</span>, la suma de <span className="font-bold">Bs {previewImporte.toLocaleString("es-BO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ({formatearMontoLiteral(previewImporte)} Bolivianos)</span> por concepto de {isUnifiedActive ? `liquidación y cierre conciliado al ${formatDMY(corteTarget)} correspondiente al pago de ` : "pago de "}<span className="font-bold">{formatearDiasLiteral(previewDias)}</span> días de vacaciones devengadas.
                              </p>

                              <div className="mb-3 pl-1">
                                <div className="font-bold text-xs text-slate-900 mb-1">Detalle:</div>
                                <ul className="space-y-0.5 text-[11px] sm:text-xs text-slate-800">
                                  <li className="flex items-center gap-2">
                                    <span className="font-bold text-slate-400">•</span>
                                    <span className="w-56">Total ganado mensual:</span>
                                    <span className="font-bold font-mono">Bs {previewTg.toLocaleString("es-BO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                  </li>
                                  <li className="flex items-center gap-2">
                                    <span className="font-bold text-slate-400">•</span>
                                    <span className="w-56">Salario diario:</span>
                                    <span className="font-bold font-mono">Bs {previewTg.toLocaleString("es-BO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ÷ 30 = Bs {previewSd.toLocaleString("es-BO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                  </li>
                                  {isUnifiedActive && calcFracc && (
                                    <li className="flex items-center gap-2">
                                      <span className="font-bold text-slate-400">•</span>
                                      <span className="w-56">Cómputo proporcional ({calcFracc.anios}a {calcFracc.meses}m {calcFracc.dias}d):</span>
                                      <span className="font-semibold font-mono text-slate-700">{fmtDias(calcFracc.totalFraccionado)} d acumulados − {fmtDias(calcFracc.totalRebaja)} d rebajados</span>
                                    </li>
                                  )}
                                  <li className="flex items-center gap-2">
                                    <span className="font-bold text-slate-400">•</span>
                                    <span className="w-56">Días de vacaciones pagados:</span>
                                    <span className="font-bold font-mono">{fmtDias(previewDias)} días</span>
                                  </li>
                                  <li className="flex items-center gap-2">
                                    <span className="font-bold text-slate-400">•</span>
                                    <span className="w-56 font-bold">Importe cancelado:</span>
                                    <span className="font-bold font-mono text-xs sm:text-sm text-slate-900">Bs {previewImporte.toLocaleString("es-BO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                  </li>
                                  {isUnifiedActive && (
                                    <li className="flex items-center gap-2 text-emerald-700">
                                      <span className="font-bold">•</span>
                                      <span className="w-56 font-bold">Saldo restante post-cierre:</span>
                                      <span className="font-bold font-mono">0.0 días (Cierre Conciliado)</span>
                                    </li>
                                  )}
                                </ul>
                              </div>

                              <p className="text-[11px] text-slate-800 mb-1.5">
                                En constancia de conformidad con el pago recibido, firmo el presente documento.
                              </p>

                              <div className="text-[11px] text-slate-800 mb-4">
                                <span>Lugar y fecha: </span>
                                <span className="font-medium underline decoration-slate-400">{lugarFechaPreview}</span>
                              </div>

                              <div className="grid grid-cols-2 gap-6 text-center pt-2.5 border-t border-slate-200">
                                <div className="space-y-1 text-left text-[10.5px] text-slate-800 px-1">
                                  <div className="font-bold text-[11px] text-slate-900 uppercase text-center mb-1">RECIBÍ CONFORME</div>
                                  <div className="h-12"></div>
                                  <div className="flex items-center"><span className="font-semibold text-slate-600 shrink-0 mr-1">Firma:</span><span className="text-slate-400 font-mono overflow-hidden whitespace-nowrap w-full">........................................................................</span></div>
                                  <div className="flex items-center"><span className="font-semibold text-slate-600 shrink-0 mr-1">Nombre:</span><span className="text-slate-400 font-mono overflow-hidden whitespace-nowrap w-full">........................................................................</span></div>
                                  <div className="flex items-center"><span className="font-semibold text-slate-600 shrink-0 mr-1">C.I.:</span><span className="text-slate-400 font-mono overflow-hidden whitespace-nowrap w-full">........................................................................</span></div>
                                </div>
                                <div className="space-y-1 text-left text-[10.5px] text-slate-800 px-1">
                                  <div className="font-bold text-[11px] text-slate-900 uppercase text-center mb-1">ENTREGUÉ CONFORME</div>
                                  <div className="h-12"></div>
                                  <div className="flex items-center"><span className="font-semibold text-slate-600 shrink-0 mr-1">Firma:</span><span className="text-slate-400 font-mono overflow-hidden whitespace-nowrap w-full">........................................................................</span></div>
                                  <div className="flex items-center"><span className="font-semibold text-slate-600 shrink-0 mr-1">Nombre:</span><span className="text-slate-800 font-semibold truncate">{empleadorNombre}</span></div>
                                  <div className="flex items-center"><span className="font-semibold text-slate-600 shrink-0 mr-1">C.I.:</span><span className="text-slate-800 font-semibold font-mono truncate">{empleadorCi}</span></div>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                    );
                  })() : (
                    /* ======================================================== */
                    /* CASO B: CALENDARIO INTERACTIVO                           */
                    /* ======================================================== */
                    <div className="space-y-4">
                      {/* Calendario Navegable Completo */}
                      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 bg-slate-950/70 p-4 rounded-2xl border border-slate-800 shadow-xl">
                        
                        {/* Columna Izquierda: Calendario (7 columnas) */}
                        <div className="lg:col-span-7 space-y-3">
                          
                          {/* Barra superior de modo de selección */}
                          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2.5">
                            <div className="flex items-center gap-1.5 bg-slate-900/90 p-1 rounded-xl border border-slate-800">
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectionMode("individual");
                                  setRangeStart(null);
                                }}
                                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition ${
                                  selectionMode === "individual"
                                    ? "bg-teal-500 text-slate-950 shadow-sm"
                                    : "text-slate-400 hover:text-white"
                                }`}
                              >
                                <MousePointerClick className="w-3.5 h-3.5" />
                                <span>Individual (Clic a Clic)</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  setSelectionMode("rango");
                                  setRangeStart(null);
                                }}
                                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition ${
                                  selectionMode === "rango"
                                    ? "bg-teal-500 text-slate-950 shadow-sm"
                                    : "text-slate-400 hover:text-white"
                                }`}
                              >
                                <ArrowRightLeft className="w-3.5 h-3.5" />
                                <span>Por Rango (Inicio - Fin)</span>
                              </button>
                            </div>

                            {/* Accesos Rápidos de Salto Temporal */}
                            <div className="flex items-center gap-1.5">
                              {selectedEmp && selectedEmp.fecha_ingreso && (
                                <button
                                  type="button"
                                  onClick={handleJumpToHireDate}
                                  className="text-[11px] font-bold text-amber-300 hover:text-amber-200 px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/20 transition flex items-center gap-1"
                                  title={`Saltar al año de ingreso: ${selectedEmp.fecha_ingreso}`}
                                >
                                  <Clock className="w-3 h-3" /> Año Ingreso ({selectedEmp.fecha_ingreso.split("-")[0]})
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => {
                                  setCalMonth(new Date().getMonth());
                                  setCalYear(new Date().getFullYear());
                                }}
                                className="text-[11px] font-bold text-teal-400 hover:text-teal-300 px-2.5 py-1 rounded-lg bg-teal-500/10 border border-teal-500/20 transition flex items-center gap-1"
                              >
                                <RotateCcw className="w-3 h-3" /> Hoy
                              </button>
                            </div>
                          </div>

                          {/* Header Navegable con Selectores Directos de Mes y Año */}
                          <div className="flex flex-wrap items-center justify-between gap-2 px-1">
                            {/* Selector Directo de Mes y Año */}
                            <div className="flex items-center gap-1.5">
                              <select
                                value={calMonth}
                                onChange={(e) => setCalMonth(Number(e.target.value))}
                                className="bg-slate-900 border border-slate-700 text-teal-300 rounded-lg px-2.5 py-1 text-xs font-bold focus:outline-none focus:ring-1 focus:ring-teal-400 cursor-pointer shadow-xs"
                              >
                                {MONTH_NAMES.map((name, idx) => (
                                  <option key={name} value={idx} className="bg-slate-900 text-white">
                                    {name}
                                  </option>
                                ))}
                              </select>

                              <select
                                value={calYear}
                                onChange={(e) => setCalYear(Number(e.target.value))}
                                className="bg-slate-900 border border-slate-700 text-teal-300 rounded-lg px-2.5 py-1 text-xs font-bold focus:outline-none focus:ring-1 focus:ring-teal-400 cursor-pointer shadow-xs"
                              >
                                {yearOptions.map(y => (
                                  <option key={y} value={y} className="bg-slate-900 text-white">
                                    {y}
                                  </option>
                                ))}
                              </select>
                            </div>

                            {/* Botones de Navegación Rápida: -1 Año, -1 Mes, +1 Mes, +1 Año */}
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => setCalYear(prev => prev - 1)}
                                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition border border-slate-700"
                                title="Año anterior (-1 año)"
                              >
                                <ChevronsLeft className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  if (calMonth === 0) {
                                    setCalMonth(11);
                                    setCalYear(prev => prev - 1);
                                  } else {
                                    setCalMonth(prev => prev - 1);
                                  }
                                }}
                                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition border border-slate-700"
                                title="Mes anterior"
                              >
                                <ChevronLeft className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  if (calMonth === 11) {
                                    setCalMonth(0);
                                    setCalYear(prev => prev + 1);
                                  } else {
                                    setCalMonth(prev => prev + 1);
                                  }
                                }}
                                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition border border-slate-700"
                                title="Mes siguiente"
                              >
                                <ChevronRight className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setCalYear(prev => prev + 1)}
                                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition border border-slate-700"
                                title="Año siguiente (+1 año)"
                              >
                                <ChevronsRight className="w-4 h-4" />
                              </button>
                            </div>
                          </div>

                          {/* Días de la semana */}
                          <div className="grid grid-cols-7 gap-1.5 text-center">
                            {WEEK_DAYS.map((d, idx) => (
                              <span 
                                key={d} 
                                className={`text-[11px] font-bold uppercase tracking-wider py-0.5 ${
                                  idx >= 5 ? "text-rose-400/70" : "text-slate-400"
                                }`}
                              >
                                {d}
                              </span>
                            ))}
                          </div>

                          {/* Cuadrícula de días en modo dark integrado */}
                          <div className="grid grid-cols-7 gap-1.5 bg-slate-900/90 p-2.5 rounded-2xl border border-slate-800 shadow-inner">
                            {renderCalendarDays()}
                          </div>

                          {/* Opciones y ayuda inferior */}
                          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs text-slate-400">
                            <label className="flex items-center gap-2 cursor-pointer select-none">
                              <input
                                type="checkbox"
                                checked={onlyBusinessDays}
                                onChange={(e) => setOnlyBusinessDays(e.target.checked)}
                                className="w-4 h-4 rounded text-teal-500 bg-slate-900 border-slate-700 focus:ring-teal-400 focus:ring-offset-0"
                              />
                              <span className="text-[11px] font-medium text-slate-300">
                                Omitir fines de semana (Días hábiles)
                              </span>
                            </label>

                            {selectionMode === "rango" && rangeStart && (
                              <span className="text-[11px] font-bold text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded-md border border-amber-400/20 animate-pulse">
                                Haz clic en la fecha final del rango
                              </span>
                            )}

                            {selectionMode === "individual" && (
                              <span className="text-[11px] text-teal-400 font-semibold flex items-center gap-1">
                                <MousePointerClick className="w-3 h-3" /> Clic para sumar o restar días
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Columna Derecha: Fechas Computadas & Cómputo (5 columnas) */}
                        <div className="lg:col-span-5 flex flex-col justify-between bg-slate-900/70 p-4 rounded-2xl border border-slate-800">
                          <div>
                            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5 mb-3">
                              <h4 className="text-xs font-bold text-teal-300 flex items-center gap-1.5 uppercase tracking-wide">
                                <Clock className="w-3.5 h-3.5 text-teal-400" /> Fechas Seleccionadas
                              </h4>
                              {selectedDates.length > 0 && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedDates([]);
                                    setRangeStart(null);
                                  }}
                                  className="text-[11px] text-rose-400 hover:text-rose-300 font-bold transition flex items-center gap-1"
                                >
                                  <Trash2 className="w-3 h-3" /> Limpiar ({selectedDates.length})
                                </button>
                              )}
                            </div>

                            {selectedDates.length === 0 ? (
                              <div className="p-6 text-center text-slate-400 text-xs flex flex-col items-center justify-center border border-dashed border-slate-800 rounded-xl min-h-[190px]">
                                <div className="w-12 h-12 rounded-2xl bg-teal-500/10 text-teal-400 flex items-center justify-center mb-2.5">
                                  <MousePointerClick className="w-6 h-6 opacity-70" />
                                </div>
                                <p className="font-bold text-slate-300 mb-1">Ningún día seleccionado</p>
                                <p className="text-[11px] text-slate-500 max-w-[220px]">
                                  Haz clic en los días del calendario o utiliza la regularización por rango para cargarlos de golpe.
                                </p>
                              </div>
                            ) : (
                              <div className="max-h-[220px] overflow-y-auto custom-scrollbar pr-1 space-y-1.5">
                                <div className="flex flex-wrap gap-1.5">
                                  {selectedDates.map(d => {
                                    const chip = formatDateChip(d);
                                    return (
                                      <span
                                        key={d}
                                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-teal-500/15 text-teal-200 border border-teal-500/30 group hover:border-teal-400 transition"
                                      >
                                        <span className="font-semibold text-teal-400 text-[10px] uppercase">
                                          {chip.dayName}
                                        </span>
                                        <span>{chip.formatted.split(" ").slice(1).join(" ")}</span>
                                        <button
                                          type="button"
                                          onClick={() => removeDate(d)}
                                          className="text-teal-400 hover:text-rose-400 p-0.5 rounded transition"
                                          title="Quitar este día"
                                        >
                                          <X className="w-3 h-3" />
                                        </button>
                                      </span>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Caja de Cómputo Total */}
                          <div className="mt-4 pt-3 border-t border-slate-800 space-y-2">
                            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex justify-between items-center">
                              <div>
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block">
                                  Total Días Hábiles
                                </span>
                                <span className="text-xs text-slate-500 font-medium">
                                  (Excluyendo fines de semana)
                                </span>
                              </div>
                              <span className="text-2xl font-black text-teal-400">
                                {selectedDates.length} <span className="text-sm font-semibold text-teal-200">días</span>
                              </span>
                            </div>

                            {selectedEmp && selectedEmp.saldo_dias_pendientes - selectedDates.length < 0 && (
                              <div className="bg-rose-500/10 border border-rose-500/30 text-rose-300 text-[11px] p-2.5 rounded-xl flex items-start gap-2">
                                <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
                                <span>
                                  <strong>Atención:</strong> Los días seleccionados ({selectedDates.length}) superan el saldo disponible ({selectedEmp.saldo_dias_pendientes.toFixed(1)} d).
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Motivo y Fecha de Solicitud / Conciliación (en par) */}
                  {vacationType === "dias_pagados" && (liquidacionFraccionada || esCierreConciliado) ? (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div className="md:col-span-2">
                        <label className="block text-xs font-bold text-emerald-300 uppercase tracking-wide mb-1">
                          Descripción en Historial / Kárdex (Cierre Conciliado)
                        </label>
                        <input
                          type="text"
                          readOnly
                          value={`CIERRE CONCILIADO (Conciliación al ${formatDMY(fechaPago || formatYMD(new Date()))} — Saldo en 0)`}
                          className="w-full bg-emerald-950/40 border border-emerald-500/40 text-emerald-300 rounded-xl px-4 py-2.5 text-sm font-bold cursor-default focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-emerald-300 uppercase tracking-wide mb-1">
                          Fecha de Conciliación *
                        </label>
                        <input
                          type="date"
                          required
                          value={fechaPago || formatYMD(new Date())}
                          onChange={(e) => {
                            const newVal = e.target.value;
                            setFechaPago(newVal);
                            setFechaSolicitud(newVal);
                            if (selectedEmp && newVal) {
                              const nextC = calcularLiquidacionEmpleado(selectedEmp, newVal, editingRecordId ?? undefined);
                              if (nextC) {
                                setDiasPagadosInput(String(Math.max(0, nextC.saldoFraccionado)));
                              }
                            }
                          }}
                          className="w-full bg-slate-950/80 border border-emerald-500/40 text-white rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-400 text-sm font-bold"
                          title="Fecha límite de conciliación (hoy por defecto o fecha histórica)"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div className="md:col-span-2">
                        <label className="block text-xs font-bold text-slate-300 uppercase tracking-wide mb-1">
                          Motivo / Detalle
                        </label>
                        <input
                          type="text"
                          placeholder="Ej. Vacaciones anuales correspondientes a la gestión..."
                          value={motivo}
                          onChange={(e) => setMotivo(e.target.value)}
                          className="w-full bg-slate-950/80 border border-slate-700 text-white rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-teal-400 text-sm font-medium"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-300 uppercase tracking-wide mb-1 flex items-center justify-between">
                          <span>F. Solicitud <span className="text-[10px] text-slate-400 font-normal lowercase">(opcional)</span></span>
                        </label>
                        <input
                          type="date"
                          value={fechaSolicitud}
                          onChange={(e) => setFechaSolicitud(e.target.value)}
                          className="w-full bg-slate-950/80 border border-slate-700 text-white rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-teal-400 text-sm font-medium"
                          title="Fecha en la cual el trabajador realizó o solicitó la vacación"
                        />
                      </div>
                    </div>
                  )}

                </form>
              </div>

              {/* Botonera Modal */}
              <div className="p-6 border-t border-white/10 bg-slate-900/90 flex flex-col sm:flex-row justify-between items-center gap-3">
                <div className="text-xs text-slate-400 text-center sm:text-left">
                  {editingRecordId ? (
                    <span className="text-teal-300 flex items-center gap-1 font-semibold">
                      <Pencil className="w-3.5 h-3.5" /> Editando registro existente #{editingRecordId}. Los cambios actualizarán el saldo de inmediato.
                    </span>
                  ) : lastSavedAlert ? (
                    <span className="text-emerald-400 flex items-center gap-1 font-semibold">
                      <Check className="w-3.5 h-3.5" /> Saldo actualizado. Puedes continuar registrando o cerrar la ventana.
                    </span>
                  ) : (
                    <span>Al confirmar, el registro se guardará y permanecerás en esta ventana para seguir regularizando.</span>
                  )}
                </div>

                <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      setShowRegisterModal(false);
                      setEditingRecordId(null);
                      setLastSavedAlert(null);
                    }}
                    disabled={submitting}
                    className="px-5 py-2.5 rounded-xl border border-white/20 text-white hover:bg-white/10 text-sm font-bold transition disabled:opacity-50"
                  >
                    Cerrar Ventana
                  </button>
                  <button
                    type="submit"
                    form="vacationRegisterForm"
                    disabled={
                      submitting || 
                      (vacationType === "dias_pagados" ? (!diasPagadosInput || parseFloat(diasPagadosInput) <= 0) : selectedDates.length === 0)
                    }
                    className="px-6 py-2.5 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-900 font-black text-sm transition shadow-lg flex items-center gap-2 disabled:opacity-50"
                  >
                    {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                    {editingRecordId ? "Guardar Cambios" : "Confirmar y Guardar Vacación"}
                  </button>
                </div>
              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================= */}
      {/* MODAL 2: FICHA INDIVIDUAL DE VACACIONES DEL TRABAJADOR      */}
      {/* ========================================================= */}
      <AnimatePresence>
        {viewingEmployee && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/60 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-slate-900 border border-slate-700 rounded-[2rem] w-full max-w-[96vw] 2xl:max-w-[1550px] overflow-hidden shadow-2xl flex flex-col max-h-[94vh]"
            >
              {/* Header Ficha */}
              <div className="p-6 border-b border-white/10 flex justify-between items-center bg-slate-900/80">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-teal-500/20 text-teal-400 rounded-xl">
                    <UserCheck className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-white">Ficha Individual de Vacaciones</h2>
                    <p className="text-xs text-slate-400">Historial completo y cómputo de saldos de vacación.</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <div className="hidden xl:flex items-center gap-1.5 px-3 py-1.5 bg-teal-500/10 border border-teal-500/20 text-teal-300 rounded-xl text-[11px] font-medium mr-2">
                    <FileSpreadsheet className="w-3.5 h-3.5 text-teal-400 shrink-0" />
                    <span>Excel incluye <strong>Kárdex General</strong> (Hoja 1) y <strong>Detallado</strong> (Hoja 2)</span>
                  </div>

                  <button
                    onClick={() => handleExportEmployee(viewingEmployee.employee_id, "excel", modalFechaDesde, modalFechaHasta)}
                    disabled={exportingEmpExcel}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 rounded-xl text-xs font-bold transition disabled:opacity-50"
                  >
                    {exportingEmpExcel ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileSpreadsheet className="w-3.5 h-3.5" />}
                    <span>Descargar Excel</span>
                  </button>

                  <button
                    onClick={() => handleExportEmployee(viewingEmployee.employee_id, "pdf", modalFechaDesde, modalFechaHasta)}
                    disabled={exportingEmpPdf}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-rose-300 rounded-xl text-xs font-bold transition disabled:opacity-50"
                  >
                    {exportingEmpPdf ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5" />}
                    <span>Descargar PDF</span>
                  </button>

                  <button 
                    onClick={() => setViewingEmployee(null)}
                    className="text-slate-400 hover:text-white p-2 rounded-xl hover:bg-white/5 transition ml-2"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>
              </div>

              {/* Contenido Ficha */}
              <div className="p-6 overflow-y-auto space-y-5 custom-scrollbar">
                
                {/* Perfil del Trabajador */}
                <div className="bg-white/5 p-4 rounded-2xl border border-white/10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  <div>
                    <h3 className="text-lg font-bold text-white">{viewingEmployee.employee_name}</h3>
                    <div className="flex flex-wrap items-center gap-3 mt-1 text-xs text-slate-300">
                      <span>C.I.: <strong>{viewingEmployee.employee_ci}</strong></span>
                      <span>•</span>
                      <span>Cargo: <strong>{viewingEmployee.employee_cargo}</strong></span>
                      <span>•</span>
                      <span>Ingreso: <strong>{formatDMY(viewingEmployee.fecha_ingreso)}</strong></span>
                      {viewingEmployee.fecha_afiliacion && (
                        <>
                          <span>•</span>
                          <span>Afiliación: <strong>{formatDMY(viewingEmployee.fecha_afiliacion)}</strong></span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="bg-teal-500/10 border border-teal-500/30 px-3 py-1.5 rounded-xl text-center">
                      <span className="text-[10px] text-teal-300 uppercase block font-bold">Antigüedad</span>
                      <span className="text-sm font-bold text-white">{viewingEmployee.antiguedad_formato}</span>
                    </div>
                    <div className="bg-purple-500/10 border border-purple-500/30 px-3 py-1.5 rounded-xl text-center">
                      <span className="text-[10px] text-purple-300 uppercase block font-bold">Escala Legal</span>
                      <span className="text-sm font-bold text-white">{viewingEmployee.escala_dias} días/año</span>
                    </div>
                  </div>
                </div>

                {/* Barra Intuitiva de Periodo de Cómputo de la Ficha Individual */}
                <div className="bg-slate-950/80 p-3.5 rounded-2xl border border-slate-700/80 flex flex-col xl:flex-row items-start xl:items-center justify-between gap-3 shadow-md">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-teal-500/20 text-teal-400 rounded-xl">
                      <CalendarRange className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-white uppercase tracking-wider">
                          Periodo Evaluado:
                        </span>
                        <span className="text-xs font-mono font-bold text-teal-300 bg-teal-500/10 border border-teal-500/30 px-2 py-0.5 rounded-md">
                          DEL {formatDMY(modalFechaDesde || fechaDesde)} AL {formatDMY(modalFechaHasta || fechaHasta)}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        {modalPeriodMode === "principal" ? (
                          <span className="text-teal-400 font-semibold">✓ Tomando fechas del Periodo Principal del sistema</span>
                        ) : modalPeriodMode === "historico" ? (
                          <span className="text-amber-400 font-semibold">✓ Histórico total acumulado desde su ingreso ({formatDMY(viewingEmployee.fecha_ingreso)})</span>
                        ) : modalPeriodMode === "gestion" ? (
                          <span className="text-indigo-400 font-semibold">✓ Gestión anual {currentYear}</span>
                        ) : (
                          <span className="text-purple-400 font-semibold">✓ Periodo personalizado para este trabajador</span>
                        )}
                      </p>
                    </div>
                  </div>

                  {/* Accesos rápidos e inputs de fecha */}
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800">
                      <button
                        type="button"
                        onClick={() => {
                          setModalPeriodMode("principal");
                          setModalFechaDesde(fechaDesde);
                          setModalFechaHasta(fechaHasta);
                          setStoredVacationsModalPeriod(fechaDesde, fechaHasta, tenantSchema);
                          refreshEmployeeData(viewingEmployee.employee_id, fechaDesde, fechaHasta);
                        }}
                        className={`px-3 py-1.5 text-xs font-bold rounded-lg transition ${
                          modalPeriodMode === "principal"
                            ? "bg-teal-600 text-white shadow-sm"
                            : "text-slate-400 hover:text-white"
                        }`}
                        title="Usar las mismas fechas del filtro principal de la pantalla y recargar"
                      >
                        Periodo Principal
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const today = formatYMD(new Date());
                          setModalPeriodMode("historico");
                          setModalFechaDesde(viewingEmployee.fecha_ingreso);
                          setModalFechaHasta(today);
                          setStoredVacationsModalPeriod(viewingEmployee.fecha_ingreso, today, tenantSchema);
                          refreshEmployeeData(viewingEmployee.employee_id, viewingEmployee.fecha_ingreso, today);
                        }}
                        className={`px-3 py-1.5 text-xs font-bold rounded-lg transition ${
                          modalPeriodMode === "historico"
                            ? "bg-teal-600 text-white shadow-sm"
                            : "text-slate-400 hover:text-white"
                        }`}
                        title={`Historial total desde fecha de ingreso (${formatDMY(viewingEmployee.fecha_ingreso)}) y recargar`}
                      >
                        Desde Ingreso
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const d1 = `${currentYear}-01-01`;
                          const d2 = `${currentYear}-12-31`;
                          setModalPeriodMode("gestion");
                          setModalFechaDesde(d1);
                          setModalFechaHasta(d2);
                          setStoredVacationsModalPeriod(d1, d2, tenantSchema);
                          refreshEmployeeData(viewingEmployee.employee_id, d1, d2);
                        }}
                        className={`px-3 py-1.5 text-xs font-bold rounded-lg transition ${
                          modalPeriodMode === "gestion"
                            ? "bg-teal-600 text-white shadow-sm"
                            : "text-slate-400 hover:text-white"
                        }`}
                        title={`Año en curso ${currentYear} y recargar`}
                      >
                        Gestión {currentYear}
                      </button>
                    </div>

                    <div className="flex items-center gap-1.5 bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-800 text-xs">
                      <span className="font-bold text-slate-400 text-[11px]">Desde:</span>
                      <input
                        type="date"
                        value={modalFechaDesde || fechaDesde}
                        onChange={(e) => {
                          const val = e.target.value;
                          setModalPeriodMode("personalizado");
                          setModalFechaDesde(val);
                          setStoredVacationsModalPeriod(val, modalFechaHasta || fechaHasta, tenantSchema);
                        }}
                        className="px-2 py-0.5 bg-slate-800 border border-slate-700 rounded-md text-xs font-bold text-white focus:outline-none focus:ring-1 focus:ring-teal-500"
                      />
                      <span className="font-bold text-slate-400 text-[11px] ml-1">Hasta:</span>
                      <input
                        type="date"
                        value={modalFechaHasta || fechaHasta}
                        onChange={(e) => {
                          const val = e.target.value;
                          setModalPeriodMode("personalizado");
                          setModalFechaHasta(val);
                          setStoredVacationsModalPeriod(modalFechaDesde || fechaDesde, val, tenantSchema);
                        }}
                        className="px-2 py-0.5 bg-slate-800 border border-slate-700 rounded-md text-xs font-bold text-white focus:outline-none focus:ring-1 focus:ring-teal-500"
                      />
                    </div>

                    {/* Botón de Recargar Ficha Individual */}
                    <button
                      type="button"
                      onClick={() => {
                        const dVal = modalFechaDesde || fechaDesde;
                        const hVal = modalFechaHasta || fechaHasta;
                        setStoredVacationsModalPeriod(dVal, hVal, tenantSchema);
                        refreshEmployeeData(viewingEmployee.employee_id, dVal, hVal);
                      }}
                      disabled={refreshingEmployee}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-600 hover:bg-teal-500 text-white rounded-xl text-xs font-bold transition shadow-xs disabled:opacity-50 active:scale-95 cursor-pointer"
                      title="Recargar y actualizar cómputo de la ficha con las fechas seleccionadas"
                    >
                      <RotateCcw className={`w-3.5 h-3.5 ${refreshingEmployee ? "animate-spin" : ""}`} />
                      <span>{refreshingEmployee ? "Actualizando..." : "Recargar"}</span>
                    </button>
                  </div>
                </div>

                {/* Tarjetas de Resumen Claras y Sencillas (Adaptadas si hay Saldo Anterior o Vista Histórica) */}
                {kardexData.hasSaldoAnterior ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                      {/* Saldo Anterior */}
                      <div className="bg-slate-800/90 p-3.5 rounded-2xl border border-slate-700/60 shadow-xs flex flex-col justify-between">
                        <div>
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider">
                              Saldo Anterior (+)
                            </span>
                            <span className="w-2 h-2 rounded-full bg-slate-400"></span>
                          </div>
                          <div className="mt-2 flex items-baseline gap-1.5">
                            <span className="text-2xl font-black text-white">
                              {kardexData.saldoPre.toFixed(1)}
                            </span>
                            <span className="text-xs font-semibold text-slate-400">días</span>
                          </div>
                        </div>
                        <span className="text-[10px] text-slate-400 mt-2 truncate">
                          Acumulado previo al {formatDMY(modalFechaDesde || fechaDesde)}
                        </span>
                      </div>

                      {/* Ganados en Periodo */}
                      <div className="bg-slate-800/90 p-3.5 rounded-2xl border border-teal-500/30 shadow-xs flex flex-col justify-between">
                        <div>
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold text-teal-400 uppercase tracking-wider">
                              Ganados en Periodo (+)
                            </span>
                            <span className="w-2 h-2 rounded-full bg-teal-400"></span>
                          </div>
                          <div className="mt-2 flex items-baseline gap-1.5">
                            <span className="text-2xl font-black text-teal-300">
                              +{kardexData.ganadosPeriodo.toFixed(1)}
                            </span>
                            <span className="text-xs font-semibold text-slate-400">días</span>
                          </div>
                        </div>
                        <span className="text-[10px] text-slate-400 mt-2">
                          Ganados en el periodo
                        </span>
                      </div>

                      {/* Tomados en Periodo */}
                      <div className="bg-slate-800/90 p-3.5 rounded-2xl border border-amber-500/30 shadow-xs flex flex-col justify-between">
                        <div>
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold text-amber-400 uppercase tracking-wider">
                              Tomados en Periodo (-)
                            </span>
                            <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                          </div>
                          <div className="mt-2 flex items-baseline gap-1.5">
                            <span className="text-2xl font-black text-amber-300">
                              -{kardexData.tomadosPeriodo.toFixed(1)}
                            </span>
                            <span className="text-xs font-semibold text-slate-400">días</span>
                          </div>
                        </div>
                        <span className="text-[10px] text-slate-400 mt-2">
                          Consumidos en el periodo
                        </span>
                      </div>

                      {/* Saldo Disponible */}
                      <div className="bg-teal-500/15 p-3.5 rounded-2xl border-2 border-teal-500/50 shadow-md flex flex-col justify-between">
                        <div>
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-black text-teal-300 uppercase tracking-wider">
                              Saldo Disponible (=)
                            </span>
                            <span className="w-2.5 h-2.5 rounded-full bg-teal-400 animate-pulse"></span>
                          </div>
                          <div className="mt-2 flex items-baseline gap-1.5">
                            <span className="text-2xl font-black text-teal-300">
                              {kardexData.saldoFinalPeriodo.toFixed(1)}
                            </span>
                            <span className="text-xs font-bold text-teal-200">días hábiles</span>
                          </div>
                        </div>
                        <span className="text-[10px] text-teal-300/80 font-medium mt-2">
                          Saldo al cierre
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-slate-800/90 p-4 rounded-2xl border border-teal-500/30 shadow-xs flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold text-teal-400 uppercase tracking-wider">
                            Días Ganados (+)
                          </span>
                          <span className="w-2 h-2 rounded-full bg-teal-400"></span>
                        </div>
                        <div className="mt-2 flex items-baseline gap-1.5">
                          <span className="text-3xl font-black text-white">
                            {fmtDias(kardexData.totGanados)}
                          </span>
                          <span className="text-xs font-semibold text-slate-400">días</span>
                        </div>
                      </div>
                      <span className="text-[11px] text-slate-400 mt-2">
                        Total derecho acumulado
                      </span>
                    </div>

                    <div className="bg-slate-800/90 p-4 rounded-2xl border border-amber-500/30 shadow-xs flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold text-amber-400 uppercase tracking-wider">
                            Días Tomados (-)
                          </span>
                          <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                        </div>
                        <div className="mt-2 flex items-baseline gap-1.5">
                          <span className="text-3xl font-black text-amber-300">
                            {fmtDias(kardexData.totTomados)}
                          </span>
                          <span className="text-xs font-semibold text-slate-400">días</span>
                        </div>
                      </div>
                      <span className="text-[11px] text-slate-400 mt-2 truncate" title={`Pagados: ${fmtDias(viewingEmployee.dias_pagados ?? viewingEmployee.dias_a_cuenta ?? 0)} d • Solicitadas: ${fmtDias(viewingEmployee.dias_solicitadas)} d • Colectivas: ${fmtDias(viewingEmployee.dias_colectivas)} d`}>
                        Pagados: {fmtDias(viewingEmployee.dias_pagados ?? viewingEmployee.dias_a_cuenta ?? 0)} d • Solicitadas: {fmtDias(viewingEmployee.dias_solicitadas)} d • Colectivas: {fmtDias(viewingEmployee.dias_colectivas)} d
                      </span>
                    </div>

                    <div className="bg-teal-500/15 p-4 rounded-2xl border-2 border-teal-500/50 shadow-md flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-black text-teal-300 uppercase tracking-wider">
                            Saldo Disponible (=)
                          </span>
                          <span className="w-2.5 h-2.5 rounded-full bg-teal-400 animate-pulse"></span>
                        </div>
                        <div className="mt-2 flex items-baseline gap-1.5">
                          <span className="text-3xl font-black text-teal-300">
                            {fmtDias(kardexData.saldoFinal)}
                          </span>
                          <span className="text-xs font-bold text-teal-200">días hábiles</span>
                        </div>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center justify-between gap-1.5">
                        <span className="text-[11px] text-teal-300/80 font-medium">
                          Días hábiles disponibles
                        </span>
                        {viewingEmployee.tiene_cierre_conciliado && viewingEmployee.fecha_ultimo_cierre && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                            ✓ Cierre: {formatDMY(viewingEmployee.fecha_ultimo_cierre)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Historial de Registros - Selector de Formato Kárdex */}
                <div className="bg-slate-800/80 rounded-2xl border border-white/10 overflow-hidden shadow-lg">
                  <div className="p-4 border-b border-white/10 flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                      {/* Pestañas de Selección Kárdex General vs Detallado */}
                      <div className="flex items-center gap-1 bg-slate-900/90 p-1.5 rounded-xl border border-white/10 shadow-xs">
                        <button
                          type="button"
                          onClick={() => setKardexViewMode("general")}
                          className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition flex items-center gap-2 cursor-pointer ${
                            kardexViewMode === "general"
                              ? "bg-teal-600 text-white shadow-md"
                              : "text-slate-400 hover:text-white hover:bg-white/5"
                          }`}
                          title="Ver formato oficial unificado por movimiento"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          <span>Kárdex General</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setKardexViewMode("detallado")}
                          className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition flex items-center gap-2 cursor-pointer ${
                            kardexViewMode === "detallado"
                              ? "bg-teal-600 text-white shadow-md"
                              : "text-slate-400 hover:text-white hover:bg-white/5"
                          }`}
                          title="Ver formato desglosado por mes con días específicos tomados"
                        >
                          <CalendarDays className="w-3.5 h-3.5" />
                          <span>Kárdex Detallado por Mes</span>
                        </button>
                      </div>

                      <div className="border-l border-white/10 pl-3 hidden sm:block">
                        <span className="text-xs font-bold text-white block">
                          {kardexViewMode === "general" ? "Formato Oficial por Movimiento" : "Formato Desglosado con Días en Específico"}
                        </span>
                        <span className="text-[11px] text-slate-400">
                          {kardexViewMode === "general"
                            ? `${kardexData.timeline.length + (kardexData.apertura ? 1 : 0)} movimientos • Del ${formatDMY(modalFechaDesde || fechaDesde)} al ${formatDMY(modalFechaHasta || fechaHasta)}`
                            : `${kardexDetailedData.timeline.length + (kardexDetailedData.apertura ? 1 : 0)} filas desglosadas por mes • Del ${formatDMY(modalFechaDesde || fechaDesde)} al ${formatDMY(modalFechaHasta || fechaHasta)}`}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 w-full xl:w-auto justify-between xl:justify-end">
                      <button
                        onClick={() => {
                          handleOpenRegisterModal(viewingEmployee.employee_id);
                        }}
                        className="px-3.5 py-1.5 bg-teal-600 hover:bg-teal-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm ml-auto cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" /> Agregar Registro
                      </button>
                    </div>
                  </div>

                  {kardexViewMode === "general" ? (
                    /* ================= TABLA KÁRDEX GENERAL ================= */
                    <div className="w-full overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="bg-slate-900/60 text-slate-400 uppercase tracking-wider font-bold border-b border-white/10 text-[11px]">
                            <th className="p-3 pl-4 text-center w-12">N°</th>
                            <th className="p-3">Fecha / Periodo</th>
                            <th className="p-3">Tipo de Vacación</th>
                            <th className="p-3 text-right">Días Ganados (+)</th>
                            <th className="p-3 text-right">Días Tomados (-)</th>
                            <th className="p-3 text-right">Saldo Restante (=)</th>
                            <th className="p-3">Motivo / Detalle</th>
                            <th className="p-3 pr-4 text-center w-20">Acción</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5 text-slate-300">
                          {/* Fila 0 de Apertura de Kárdex */}
                          {kardexData.apertura && (
                            <tr className="bg-slate-900/40 font-medium border-b border-white/10">
                              <td className="p-3 pl-4 text-center text-slate-400 font-mono font-bold">
                                {kardexData.apertura.kardexIndex}
                              </td>
                              <td className="p-3 font-mono text-slate-300">
                                {kardexData.apertura.tipo === "saldo_anterior"
                                  ? `Previo al ${formatDMY(kardexData.apertura.fecha)}`
                                  : `${formatDMY(kardexData.apertura.fecha)} (Ingreso)`}
                              </td>
                              <td className="p-3">
                                <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold ${
                                  kardexData.apertura.tipo === "saldo_anterior"
                                    ? "bg-slate-700/60 text-slate-200 border border-slate-600"
                                    : "bg-teal-500/20 text-teal-300 border border-teal-500/30"
                                }`}>
                                  {kardexData.apertura.tipoLabel}
                                </span>
                              </td>
                              <td className="p-3 text-right font-mono font-bold text-slate-200">
                                {kardexData.apertura.diasGanados > 0 ? `+${fmtDias(kardexData.apertura.diasGanados)} d` : "-"}
                              </td>
                              <td className="p-3 text-right font-mono text-slate-500">
                                -
                              </td>
                              <td className="p-3 text-right font-mono font-bold text-slate-200 text-sm">
                                {fmtDias(kardexData.apertura.saldoRestante)} d
                              </td>
                              <td className="p-3 text-slate-400 italic">
                                {kardexData.apertura.motivo}
                              </td>
                              <td className="p-3 pr-4 text-center text-slate-500">-</td>
                            </tr>
                          )}

                          {kardexData.timeline.length === 0 ? (
                            <tr>
                              <td colSpan={8} className="p-6 text-center text-slate-500 italic">
                                No registra movimientos de vacación en el periodo evaluado.
                              </td>
                            </tr>
                          ) : (
                            kardexData.timeline.map((r) => {
                              const isColectiva = r.tipo === "colectiva";
                              const isSolicitada = r.tipo === "solicitada";
                              const isCierre = Boolean(r.es_cierre_conciliado || r.tipoLabel === "Cierre Conciliado");
                              const isDevFrac = r.tipoLabel === "Devengado Fraccionado";
                              const rowBg = isCierre
                                ? "bg-emerald-500/15 hover:bg-emerald-500/20"
                                : isDevFrac
                                ? "bg-teal-500/10 hover:bg-teal-500/15"
                                : isColectiva
                                ? "bg-rose-500/10 hover:bg-rose-500/15"
                                : isSolicitada
                                ? "bg-emerald-500/10 hover:bg-emerald-500/15"
                                : "hover:bg-white/5";
                              return (
                                <tr key={r.id} className={`${rowBg} transition`}>
                                  <td className="p-3 pl-4 text-center font-mono font-bold text-slate-400">
                                    {r.kardexIndex}
                                  </td>
                                  <td className="p-3 font-mono text-slate-200">
                                    {r.tipo === "derecho_anual"
                                      ? formatDMY(r.fecha)
                                      : r.tipo === "dias_pagados" || r.tipo === "a_cuenta" 
                                      ? `${isCierre ? "Cierre" : "Compensación"} (${formatDMY(r.fecha)})` 
                                      : formatKardexPeriodo(r.fecha, r.fecha_fin)}
                                  </td>
                                  <td className="p-3">
                                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold ${
                                      isCierre
                                        ? "bg-emerald-900/70 text-emerald-200 border border-emerald-500/50"
                                        : isDevFrac
                                        ? "bg-teal-950/70 text-teal-200 border border-teal-500/40"
                                        : r.tipo === "derecho_anual"
                                        ? "bg-slate-700/60 text-slate-100 border border-slate-500/40"
                                        : r.tipo === "dias_pagados" || r.tipo === "a_cuenta"
                                        ? "bg-slate-800 text-slate-200 border border-slate-700"
                                        : isColectiva
                                        ? "bg-rose-950/60 text-rose-200 border border-rose-700/40"
                                        : "bg-emerald-950/60 text-emerald-200 border border-emerald-700/40"
                                    }`}>
                                      {r.tipoLabel}
                                    </span>
                                  </td>
                                <td className="p-3 text-right font-mono font-bold text-slate-200">
                                  {r.diasGanados > 0 ? `+${fmtDias(r.diasGanados)} d` : "-"}
                                </td>
                                <td className="p-3 text-right font-mono font-bold text-slate-300">
                                  {r.diasTomados > 0 ? `-${fmtDias(r.diasTomados)} d` : "-"}
                                </td>
                                <td className="p-3 text-right font-mono font-black text-white">
                                  {fmtDias(r.saldoRestante)} d
                                </td>
                                <td className="p-3 text-slate-300">
                                  {r.tipo === "derecho_anual"
                                    ? r.motivo
                                    : cleanMotivo(r.motivo, r.tipo, r.fecha_solicitud, r.es_cierre_conciliado, r.fecha)}
                                </td>
                                <td className="p-3 pr-4 text-center">
                                  {r.isRecord && r.recordId ? (
                                    <div className="flex items-center justify-center gap-1.5">
                                      {(r.tipo === "dias_pagados" || r.tipo === "a_cuenta") && (
                                        <button
                                          onClick={() => handleOpenReceiptsModal(viewingEmployee, r.recordId)}
                                          className="p-1.5 text-emerald-400 hover:text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 rounded-lg transition cursor-pointer shadow-sm"
                                          title={`Ver y Exportar Recibo de Pago (Reg #${r.recordId})`}
                                        >
                                          <Receipt className="w-4 h-4" />
                                        </button>
                                      )}
                                      <button
                                        onClick={() => {
                                          const origRec = (viewingEmployee.records || []).find(rec => rec.id === r.recordId);
                                          handleOpenEditModal(origRec || r);
                                        }}
                                        className="p-1.5 text-slate-400 hover:text-teal-400 hover:bg-teal-500/10 rounded-lg transition cursor-pointer"
                                        title="Editar este registro de vacación"
                                      >
                                        <Pencil className="w-4 h-4" />
                                      </button>
                                      <button
                                        onClick={() => handleDeleteRecord(r.recordId!, viewingEmployee.employee_id)}
                                        className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition cursor-pointer"
                                        title="Eliminar este registro"
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </button>
                                    </div>
                                  ) : (
                                    <span className="text-slate-600">-</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })
                        )}
                        </tbody>
                        <tfoot>
                          <tr className="bg-slate-900/90 font-bold border-t-2 border-white/20 text-white">
                            <td colSpan={3} className="p-3 pl-4 text-right uppercase tracking-wider text-slate-300 text-[11px]">
                              Totales y Saldo Final:
                            </td>
                            <td className="p-3 text-right font-mono font-bold text-slate-200">
                              +{fmtDias(kardexData.hasSaldoAnterior ? kardexData.totalComputablePeriodo : kardexData.totGanados)} d
                            </td>
                            <td className="p-3 text-right font-mono font-black text-slate-300">
                              -{fmtDias(kardexData.hasSaldoAnterior ? kardexData.tomadosPeriodo : kardexData.totTomados)} d
                            </td>
                            <td className="p-3 text-right font-mono font-black text-white text-sm">
                              {fmtDias(kardexData.hasSaldoAnterior ? kardexData.saldoFinalPeriodo : kardexData.saldoFinal)} d
                            </td>
                            <td colSpan={2} className="p-3 text-teal-400 font-bold text-[11px]">
                              Saldo disponible
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  ) : (
                    /* ================= TABLA KÁRDEX DETALLADO POR MES ================= */
                    <div>
                      {/* Tarjetas de Resumen Consolidado por Mes */}
                      {kardexDetailedData.resumenMensual.length > 0 && (
                        <div className="p-4 bg-slate-900/50 border-b border-white/10">
                          <span className="text-[11px] font-bold text-teal-400 uppercase tracking-wider block mb-2.5">
                            Desglose Mensual Consolidado (Justificación Mes a Mes)
                          </span>
                          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2.5">
                            {kardexDetailedData.resumenMensual.map((m) => (
                              <div key={m.mesKey} className="bg-slate-800/90 border border-white/10 rounded-xl p-2.5 shadow-xs">
                                <span className="text-xs font-bold text-white block truncate">{m.mesLabel}</span>
                                <div className="flex items-center justify-between text-[11px] mt-1.5 text-slate-300 font-mono">
                                  <span>{m.diasGanados > 0 ? `+${fmtDias(m.diasGanados)}d ` : ""}{m.diasTomados > 0 ? `-${fmtDias(m.diasTomados)}d` : m.diasGanados === 0 ? "0d" : ""}</span>
                                  <span className="font-bold text-teal-300 bg-teal-500/10 px-1.5 py-0.5 rounded border border-teal-500/20">
                                    {fmtDias(m.saldoCierre)} d
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Tabla Detallada con Días Específicos sin Scroll Horizontal */}
                      <div className="w-full overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="bg-slate-900/60 text-slate-400 uppercase tracking-wider font-bold border-b border-white/10 text-[11px]">
                              <th className="p-3 pl-4 text-center w-12">N°</th>
                              <th className="p-3 w-36">Mes</th>
                              <th className="p-3 w-32">Concepto</th>
                              <th className="p-3">Días en Específico Computados</th>
                              <th className="p-3 text-right w-24">Ganados (+)</th>
                              <th className="p-3 text-right w-24">Tomados (-)</th>
                              <th className="p-3 text-right w-28">Saldo (=)</th>
                              <th className="p-3">Motivo / Solicitud</th>
                              <th className="p-3 pr-4 text-center w-20">Acción</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-white/5 text-slate-300">
                            {/* Fila 0 de Apertura */}
                            {kardexDetailedData.apertura && (
                              <tr className="bg-slate-900/40 font-medium border-b border-white/10">
                                <td className="p-3 pl-4 text-center text-slate-400 font-mono font-bold">
                                  {kardexDetailedData.apertura.kardexIndex}
                                </td>
                                <td className="p-3 font-bold text-teal-300">
                                  {kardexDetailedData.apertura.tipo === "saldo_anterior" ? "Saldo Inicial" : "Ingreso"}
                                </td>
                                <td className="p-3">
                                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-slate-700/60 text-slate-200 border border-slate-600">
                                    {kardexDetailedData.apertura.tipoLabel}
                                  </span>
                                </td>
                                <td className="p-3 font-mono text-slate-300">
                                  {kardexDetailedData.apertura.tipo === "saldo_anterior"
                                    ? `Acumulado previo al ${formatDMY(kardexDetailedData.apertura.fecha)}`
                                    : `${formatDMY(kardexDetailedData.apertura.fecha)} (Ingreso a la empresa)`}
                                </td>
                                <td className="p-3 text-right font-mono font-bold text-slate-200">
                                  {kardexDetailedData.apertura.diasGanados > 0 ? `+${fmtDias(kardexDetailedData.apertura.diasGanados)} d` : "-"}
                                </td>
                                <td className="p-3 text-right font-mono text-slate-500">-</td>
                                <td className="p-3 text-right font-mono font-bold text-slate-200 text-sm">
                                  {fmtDias(kardexDetailedData.apertura.saldoRestante)} d
                                </td>
                                <td className="p-3 text-slate-400 italic">
                                  {kardexDetailedData.apertura.motivo}
                                </td>
                                <td className="p-3 pr-4 text-center text-slate-500">-</td>
                              </tr>
                            )}

                            {kardexDetailedData.timeline.length === 0 ? (
                              <tr>
                                <td colSpan={9} className="p-6 text-center text-slate-500 italic">
                                  No registra movimientos desglosados en el periodo evaluado.
                                </td>
                              </tr>
                            ) : (
                              kardexDetailedData.timeline.map((r) => {
                                const isColectiva = r.tipo === "colectiva";
                                const isSolicitada = r.tipo === "solicitada";
                                const isCierre = Boolean(r.es_cierre_conciliado || r.tipoLabel === "Cierre Conciliado");
                                const isDevFrac = r.tipoLabel === "Devengado Fraccionado";
                                const rowBg = isCierre
                                  ? "bg-emerald-500/15 hover:bg-emerald-500/20"
                                  : isDevFrac
                                  ? "bg-teal-500/10 hover:bg-teal-500/15"
                                  : isColectiva
                                  ? "bg-rose-500/10 hover:bg-rose-500/15"
                                  : isSolicitada
                                  ? "bg-emerald-500/10 hover:bg-emerald-500/15"
                                  : "hover:bg-white/5";
                                return (
                                  <tr key={r.id} className={`${rowBg} transition`}>
                                    <td className="p-3 pl-4 text-center font-mono font-bold text-slate-400">
                                      {r.kardexIndex}
                                    </td>
                                    <td className="p-3 font-bold text-slate-200">
                                      <span className="bg-slate-900/70 border border-teal-500/30 px-2 py-0.5 rounded-md text-[11px] font-mono text-teal-300 inline-block">
                                        {r.mesLabel}
                                      </span>
                                    </td>
                                    <td className="p-3">
                                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold ${
                                        isCierre
                                          ? "bg-emerald-900/70 text-emerald-200 border border-emerald-500/50"
                                          : isDevFrac
                                          ? "bg-teal-950/70 text-teal-200 border border-teal-500/40"
                                          : r.tipo === "derecho_anual"
                                          ? "bg-slate-700/60 text-slate-100 border border-slate-500/40"
                                          : r.tipo === "dias_pagados" || r.tipo === "a_cuenta"
                                          ? "bg-slate-800 text-slate-200 border border-slate-700"
                                          : isColectiva
                                          ? "bg-rose-950/60 text-rose-200 border border-rose-700/40"
                                          : "bg-emerald-950/60 text-emerald-200 border border-emerald-700/40"
                                      }`}>
                                        {r.tipoLabel}
                                      </span>
                                    </td>
                                  <td className="p-3">
                                    {r.tipo === "derecho_anual" ? (
                                      <span className="text-xs text-teal-300 font-semibold inline-flex items-center gap-1.5">
                                        <span className="w-1.5 h-1.5 rounded-full bg-teal-400 shrink-0"></span>
                                        <span>{(r.diasEspecificosFormato || "").replace(/^•\s*/, "")}</span>
                                      </span>
                                    ) : r.tipo === "dias_pagados" || r.tipo === "a_cuenta" ? (
                                      <span className="text-xs text-slate-400 italic block">
                                        {r.diasEspecificosFormato}
                                      </span>
                                    ) : (
                                      <div className="flex flex-col gap-1 py-0.5">
                                        {r.diasEspecificos && r.diasEspecificos.length > 0 ? (
                                          r.diasEspecificos.map((dStr, idx) => {
                                            const [dy, dm, dd] = dStr.split("-").map(Number);
                                            const dObj = new Date(dy, dm - 1, dd);
                                            const dayIdx = dObj.getDay();
                                            const dName = WEEK_DAYS[dayIdx === 0 ? 6 : dayIdx - 1] || "";
                                            return (
                                              <div key={idx} className="flex items-center gap-1.5 text-xs text-amber-200">
                                                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0"></span>
                                                <span className="font-mono font-medium">{dName} {dd}/{String(dm).padStart(2, "0")}/{dy}</span>
                                              </div>
                                            );
                                          })
                                        ) : (
                                          <span className="text-xs text-slate-400 italic">{r.diasEspecificosFormato}</span>
                                        )}
                                      </div>
                                    )}
                                  </td>
                                  <td className="p-3 text-right font-mono font-bold text-slate-200">
                                    {r.diasGanados > 0 ? `+${fmtDias(r.diasGanados)} d` : "-"}
                                  </td>
                                  <td className="p-3 text-right font-mono font-bold text-slate-300">
                                    {r.diasTomados > 0 ? `-${fmtDias(r.diasTomados)} d` : "-"}
                                  </td>
                                  <td className="p-3 text-right font-mono font-black text-white">
                                    {fmtDias(r.saldoRestante)} d
                                  </td>
                                  <td className="p-3 text-slate-300">
                                    {r.tipo === "derecho_anual"
                                      ? r.motivo
                                      : cleanMotivo(r.motivo, r.tipo, r.fecha_solicitud, r.es_cierre_conciliado, r.fecha)}
                                  </td>
                                  <td className="p-3 pr-4 text-center">
                                    {r.isRecord && r.recordId ? (
                                      <div className="flex items-center justify-center gap-1.5">
                                        {(r.tipo === "dias_pagados" || r.tipo === "a_cuenta") && (
                                          <button
                                            onClick={() => handleOpenReceiptsModal(viewingEmployee, r.recordId)}
                                            className="p-1.5 text-emerald-400 hover:text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 rounded-lg transition cursor-pointer shadow-sm"
                                            title={`Ver y Exportar Recibo de Pago (Reg #${r.recordId})`}
                                          >
                                            <Receipt className="w-4 h-4" />
                                          </button>
                                        )}
                                        <button
                                          onClick={() => {
                                            const origRec = (viewingEmployee.records || []).find(rec => rec.id === r.recordId);
                                            handleOpenEditModal(origRec || r);
                                          }}
                                          className="p-1.5 text-slate-400 hover:text-teal-400 hover:bg-teal-500/10 rounded-lg transition cursor-pointer"
                                          title="Editar este registro de vacación"
                                        >
                                          <Pencil className="w-4 h-4" />
                                        </button>
                                        <button
                                          onClick={() => handleDeleteRecord(r.recordId!, viewingEmployee.employee_id)}
                                          className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition cursor-pointer"
                                          title="Eliminar este registro"
                                        >
                                          <Trash2 className="w-4 h-4" />
                                        </button>
                                      </div>
                                    ) : (
                                      <span className="text-slate-600">-</span>
                                    )}
                                  </td>
                                </tr>
                              );
                            })
                          )}
                          </tbody>
                          <tfoot>
                            <tr className="bg-slate-900/90 font-bold border-t-2 border-white/20 text-white">
                              <td colSpan={4} className="p-3 pl-4 text-right uppercase tracking-wider text-slate-300 text-[11px]">
                                Totales y Saldo Final:
                              </td>
                              <td className="p-3 text-right font-mono font-bold text-slate-200">
                                +{fmtDias(kardexData.hasSaldoAnterior ? kardexData.totalComputablePeriodo : kardexData.totGanados)} d
                              </td>
                              <td className="p-3 text-right font-mono font-black text-slate-300">
                                -{fmtDias(kardexData.hasSaldoAnterior ? kardexData.tomadosPeriodo : kardexData.totTomados)} d
                              </td>
                              <td className="p-3 text-right font-mono font-black text-white text-sm">
                                {fmtDias(kardexData.hasSaldoAnterior ? kardexData.saldoFinalPeriodo : kardexData.saldoFinal)} d
                              </td>
                              <td colSpan={2} className="p-3 text-teal-400 font-bold text-[11px]">
                                Saldo disponible
                              </td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    </div>
                  )}
                </div>

              </div>

              {/* Botonera Ficha */}
              <div className="p-6 border-t border-white/10 bg-slate-900/80 flex justify-end">
                <button
                  onClick={() => setViewingEmployee(null)}
                  className="px-6 py-2 rounded-xl bg-slate-800 text-white font-bold hover:bg-slate-700 transition text-sm"
                >
                  Cerrar
                </button>
              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================= */}
      {/* MODAL 3: RECIBOS Y COMPROBANTES DE VACACIONES             */}
      {/* ========================================================= */}
      <AnimatePresence>
        {showReceiptsModal && receiptEmployee && (
          <div className="fixed inset-0 z-[80] flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-md overflow-y-auto">
            <style dangerouslySetInnerHTML={{ __html: `
              @media print {
                @page {
                  size: letter portrait;
                  margin: 6mm 10mm;
                }
                body {
                  background: white !important;
                  color: black !important;
                }
                body * {
                  visibility: hidden;
                }
                #printable-vacation-document, #printable-vacation-document * {
                  visibility: visible;
                }
                #printable-vacation-document {
                  position: absolute;
                  left: 0;
                  top: 0;
                  width: 100% !important;
                  max-width: 100% !important;
                  height: 100% !important;
                  margin: 0 !important;
                  padding: 0 !important;
                  box-shadow: none !important;
                  border: none !important;
                  background: white !important;
                  display: flex !important;
                  flex-direction: column !important;
                  justify-content: space-between !important;
                }
                .no-print {
                  display: none !important;
                }
              }
            `}} />

            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-5xl overflow-hidden shadow-2xl flex flex-col max-h-[94vh] my-auto"
            >
              {/* Modal Header */}
              <div className="p-4 sm:p-6 border-b border-white/10 bg-slate-900/90 relative">
                {/* Botón X de Cierre SIEMPRE en la esquina superior derecha del modal */}
                <button
                  type="button"
                  onClick={() => setShowReceiptsModal(false)}
                  className="absolute top-4 right-4 sm:top-5 sm:right-6 p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-xl transition cursor-pointer z-10"
                  title="Cerrar ventana"
                >
                  <X className="w-6 h-6" />
                </button>

                {/* Fila 1: Título e Información del Trabajador */}
                <div className="flex items-center gap-3 pr-14 mb-4">
                  <div className="p-2.5 bg-indigo-500/20 text-indigo-400 rounded-xl shrink-0">
                    <Receipt className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
                      <span>Comprobantes y Recibos de Vacación</span>
                    </h2>
                    <p className="text-xs text-slate-400">
                      Trabajador: <span className="text-white font-semibold">{receiptEmployee.employee_name}</span> | C.I.: <span className="font-mono text-slate-300">{receiptEmployee.employee_ci}</span>
                    </p>
                  </div>
                </div>

                {/* Fila 2: Pestañas de Tipo de Documento y Botones de Acción */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-white/5">
                  {/* Document Type Switcher Tabs */}
                  <div className="flex items-center bg-slate-800/90 p-1 rounded-2xl border border-slate-700/80">
                    <button
                      type="button"
                      onClick={() => setReceiptDocType("pago")}
                      className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition ${
                        receiptDocType === "pago"
                          ? "bg-teal-500 text-slate-950 shadow-md"
                          : "text-slate-400 hover:text-white"
                      }`}
                    >
                      <Banknote className="w-4 h-4" />
                      <span>Recibo de Pago</span>
                      {(receiptEmployee.dias_pagados ?? 0) > 0 && (
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-black ${
                          receiptDocType === "pago" ? "bg-slate-950/20 text-slate-950" : "bg-teal-500/20 text-teal-300"
                        }`}>
                          {receiptEmployee.dias_pagados}d
                        </span>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => setReceiptDocType("solicitadas")}
                      className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition ${
                        receiptDocType === "solicitadas"
                          ? "bg-indigo-500 text-white shadow-md"
                          : "text-slate-400 hover:text-white"
                      }`}
                    >
                      <CalendarRange className="w-4 h-4" />
                      <span>Ficha Solicitadas / Colectivas</span>
                      {((receiptEmployee.dias_solicitadas ?? 0) + (receiptEmployee.dias_colectivas ?? 0)) > 0 && (
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-black ${
                          receiptDocType === "solicitadas" ? "bg-white/20 text-white" : "bg-indigo-500/20 text-indigo-300"
                        }`}>
                          {(receiptEmployee.dias_solicitadas + receiptEmployee.dias_colectivas).toFixed(1)}d
                        </span>
                      )}
                    </button>
                  </div>

                  {/* Action Buttons Top */}
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setShowReceiptSettings(prev => !prev)}
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition border ${
                        showReceiptSettings
                          ? "bg-slate-700 text-teal-300 border-teal-500/50"
                          : "bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700 hover:text-white"
                      }`}
                      title="Ajustar datos o valores del documento"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                      <span>{showReceiptSettings ? "Ocultar Ajustes" : "Editar Datos"}</span>
                    </button>

                    <button
                      type="button"
                      onClick={handlePrintDocument}
                      className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-slate-950 font-black text-xs transition shadow-md cursor-pointer"
                      title="Imprimir documento directamente"
                    >
                      <Printer className="w-4 h-4" />
                      <span>Imprimir</span>
                    </button>

                    <button
                      type="button"
                      disabled={exportingReceiptPdf}
                      onClick={() => {
                        if (receiptDocType === "pago") handleExportReceiptBackend("pdf");
                        else handleExportFichaBackend("pdf");
                      }}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-600/90 hover:bg-rose-500 text-white font-bold text-xs transition shadow-md disabled:opacity-50 cursor-pointer"
                      title="Descargar versión PDF generada en backend"
                    >
                      {exportingReceiptPdf ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                      <span>PDF</span>
                    </button>

                    <button
                      type="button"
                      disabled={exportingReceiptExcel}
                      onClick={() => {
                        if (receiptDocType === "pago") handleExportReceiptBackend("excel");
                        else handleExportFichaBackend("excel");
                      }}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600/90 hover:bg-emerald-500 text-white font-bold text-xs transition shadow-md disabled:opacity-50 cursor-pointer"
                      title="Descargar versión Excel generada en backend"
                    >
                      {exportingReceiptExcel ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileSpreadsheet className="w-3.5 h-3.5" />}
                      <span>Excel</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Main Content Area */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
                {/* Collapsible Settings Panel */}
                <AnimatePresence>
                  {showReceiptSettings && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="bg-slate-800/80 border border-slate-700 rounded-2xl p-4 sm:p-5 text-xs overflow-hidden"
                    >
                      <div className="flex items-center justify-between mb-3 border-b border-slate-700 pb-2">
                        <span className="font-bold text-white uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                          <Pencil className="w-3.5 h-3.5 text-teal-400" />
                          Ajustes de Datos para: {receiptDocType === "pago" ? "Recibo de Pago de Vacaciones" : "Ficha de Vacaciones Solicitadas"}
                        </span>
                        <span className="text-[11px] text-slate-400">
                          Los cambios se reflejan inmediatamente en la plantilla
                        </span>
                      </div>

                      {receiptDocType === "pago" ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                          <div>
                            <label className="block text-slate-400 text-[11px] font-semibold mb-1">Registro de Pago:</label>
                            <select
                              value={String(reciboPaidRecordId)}
                              onChange={(e) => handleSelectPaidRecord(e.target.value)}
                              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white text-xs"
                            >
                              <option value="all">Todos acumulados ({fmtDias(receiptEmployee.dias_pagados ?? 0)} d)</option>
                              {(receiptEmployee.records || [])
                                .filter(r => r.tipo === "dias_pagados" || r.tipo === "a_cuenta")
                                .map(r => (
                                  <option key={r.id} value={r.id}>
                                    Reg #{r.id}: {fmtDias(r.dias)} d ({formatDMY(r.fecha_solicitud || r.fecha_inicio)}){r.es_cierre_conciliado ? " • Cierre" : ""}
                                  </option>
                                ))
                              }
                              <option value="manual">Personalizado / Manual</option>
                            </select>
                          </div>

                          <div>
                            <label className="block text-slate-400 text-[11px] font-semibold mb-1">N.º de Recibo:</label>
                            <input
                              type="text"
                              value={reciboNro}
                              onChange={(e) => setReciboNro(e.target.value)}
                              placeholder="001"
                              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white text-xs font-mono"
                            />
                          </div>

                          <div>
                            <label className="block text-slate-400 text-[11px] font-semibold mb-1">Total Ganado Mensual (Bs):</label>
                            <input
                              type="number"
                              step="0.01"
                              value={reciboTotalGanado}
                              onChange={(e) => handleTotalGanadoChange(parseFloat(e.target.value) || 0)}
                              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white text-xs font-mono font-bold"
                            />
                          </div>

                          <div>
                            <label className="block text-slate-400 text-[11px] font-semibold mb-1">Días de Vacación Pagados:</label>
                            <input
                              type="number"
                              step="0.01"
                              min="0.01"
                              value={reciboDiasPagados}
                              onChange={(e) => handleDiasPagadosChange(parseFloat(e.target.value) || 0)}
                              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white text-xs font-mono font-bold"
                            />
                          </div>

                          <div>
                            <label className="block text-slate-400 text-[11px] font-semibold mb-1">Lugar y Fecha:</label>
                            <input
                              type="text"
                              value={reciboLugarFecha}
                              onChange={(e) => setReciboLugarFecha(e.target.value)}
                              placeholder="La Paz, 10 de octubre de 2026"
                              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white text-xs"
                            />
                          </div>

                          <div>
                            <label className="block text-slate-400 text-[11px] font-semibold mb-1">Nombre Empleador:</label>
                            <input
                              type="text"
                              value={reciboEmpleadorNombre}
                              onChange={(e) => setReciboEmpleadorNombre(e.target.value)}
                              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white text-xs"
                            />
                          </div>

                          <div>
                            <label className="block text-slate-400 text-[11px] font-semibold mb-1">Cargo / Rol Empleador:</label>
                            <input
                              type="text"
                              value={reciboEmpleadorRol}
                              onChange={(e) => setReciboEmpleadorRol(e.target.value)}
                              placeholder="propietario"
                              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white text-xs"
                            />
                          </div>

                          <div>
                            <label className="block text-slate-400 text-[11px] font-semibold mb-1">C.I. Empleador:</label>
                            <input
                              type="text"
                              value={reciboEmpleadorCi}
                              onChange={(e) => setReciboEmpleadorCi(e.target.value)}
                              placeholder="6570013"
                              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white text-xs font-mono"
                            />
                          </div>

                          <div className="sm:col-span-2 md:col-span-4 pt-2 border-t border-slate-700/60 flex items-center justify-between">
                            <div>
                              <span className="text-xs font-bold text-white block">Firmas en blanco con puntos</span>
                              <span className="text-[11px] text-slate-400">Deja líneas punteadas (Nombre, C.I., Firma) para llenado manual o sello físico</span>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                              <input
                                type="checkbox"
                                checked={reciboFirmasEnBlanco}
                                onChange={(e) => setReciboFirmasEnBlanco(e.target.checked)}
                                className="sr-only peer"
                              />
                              <div className="w-9 h-5 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-teal-500"></div>
                            </label>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div>
                              <label className="block text-slate-400 text-[11px] font-semibold mb-1">Filtro de Tipo:</label>
                              <select
                                value={fichaTipoFilter}
                                onChange={(e) => setFichaTipoFilter(e.target.value as any)}
                                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white text-xs"
                              >
                                <option value="todas">Todas (Solicitadas y Colectivas)</option>
                                <option value="solicitada">Solo Solicitadas</option>
                                <option value="colectiva">Solo Colectivas</option>
                              </select>
                            </div>

                            <div>
                              <label className="block text-slate-400 text-[11px] font-semibold mb-1">Nombre del Responsable:</label>
                              <input
                                type="text"
                                value={fichaResponsableNombre}
                                onChange={(e) => setFichaResponsableNombre(e.target.value)}
                                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white text-xs"
                              />
                            </div>

                            <div>
                              <label className="block text-slate-400 text-[11px] font-semibold mb-1">Fecha de la Ficha:</label>
                              <input
                                type="text"
                                value={fichaFecha}
                                onChange={(e) => setFichaFecha(e.target.value)}
                                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white text-xs"
                              />
                            </div>
                          </div>

                          <div>
                            <label className="block text-slate-400 text-[11px] font-semibold mb-1">Observaciones:</label>
                            <input
                              type="text"
                              value={fichaObservaciones}
                              onChange={(e) => setFichaObservaciones(e.target.value)}
                              placeholder="Dejar vacío para líneas de puntos a mano, o escribir texto..."
                              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white text-xs"
                            />
                          </div>

                          {employeeFichaRecords.length > 0 && (
                            <div>
                              <label className="block text-slate-400 text-[11px] font-semibold mb-1">Seleccionar Registros a Incluir:</label>
                              <div className="flex flex-wrap gap-2">
                                {employeeFichaRecords.map(r => (
                                  <label
                                    key={r.id}
                                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs cursor-pointer transition ${
                                      fichaSelectedRecordIds.includes(r.id)
                                        ? "bg-indigo-600/30 border-indigo-500 text-indigo-200"
                                        : "bg-slate-900 border-slate-700 text-slate-400"
                                    }`}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={fichaSelectedRecordIds.includes(r.id)}
                                      onChange={() => handleToggleFichaRecord(r.id)}
                                      className="rounded border-slate-700 text-indigo-600"
                                    />
                                    <span>
                                      {r.tipo === "solicitada" ? "Solicitada" : "Colectiva"} ({r.dias}d) - {formatDMY(r.fecha_inicio)}
                                    </span>
                                  </label>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Barra de Liquidación Exacta / Fraccionada y Cierre Conciliado (solo Recibo de Pago) */}
                {receiptDocType === "pago" && receiptEmployee && (() => {
                  const activeCorte = reciboFechaCorte || formatYMD(new Date());
                  const calcRec = calcularLiquidacionEmpleado(receiptEmployee, activeCorte);
                  return (
                    <div className="no-print mb-4 bg-slate-900/90 border border-slate-700/80 rounded-2xl p-3.5 shadow-lg space-y-2.5">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex flex-wrap items-center gap-2.5">
                          <button
                            type="button"
                            onClick={() => handleToggleReciboFraccionado(!reciboModoFraccionado)}
                            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-bold transition cursor-pointer ${
                              reciboModoFraccionado
                                ? "bg-teal-600 text-white border-teal-400 shadow-sm"
                                : "bg-slate-800 text-slate-300 border-slate-700 hover:text-white"
                            }`}
                            title="Activar/Desactivar liquidación exacta proporcional por años, meses (÷12) y días (÷30)"
                          >
                            <span className={`w-2 h-2 rounded-full ${reciboModoFraccionado ? "bg-white animate-pulse" : "bg-slate-500"}`} />
                            <span>Exacto / Fraccionado: {reciboModoFraccionado ? "ACTIVADO" : "DESACTIVADO"}</span>
                          </button>

                          <div className="flex items-center gap-1.5 bg-slate-950/70 border border-slate-700/80 rounded-xl px-2.5 py-1">
                            <span className="text-[11px] font-semibold text-slate-400">Fecha de Conciliación:</span>
                            <input
                              type="date"
                              value={activeCorte}
                              onChange={(e) => handleReciboFechaCorteChange(e.target.value)}
                              className="bg-transparent text-white text-xs font-bold focus:outline-none [color-scheme:dark]"
                              title="Fecha de conciliación (hoy por defecto o fecha histórica)"
                            />
                          </div>

                          {receiptEmployee.tiene_cierre_conciliado && receiptEmployee.fecha_ultimo_cierre && (
                            <span className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                              ✓ Últ. cierre: {formatDMY(receiptEmployee.fecha_ultimo_cierre)}
                            </span>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={handleSaveCierreFromReceipt}
                          disabled={savingCierreRecibo || reciboDiasPagados <= 0}
                          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold transition shadow-sm cursor-pointer"
                          title="Registra este recibo como Cierre Conciliado, salda todas las deudas de vacaciones a la fecha de corte y reinicia el saldo en 0.0"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>
                            {savingCierreRecibo
                              ? "Guardando cierre..."
                              : "Guardar como Cierre Conciliado (Saldo a 0)"}
                          </span>
                        </button>
                      </div>

                      {reciboModoFraccionado && calcRec && (
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-2 border-t border-slate-800 text-[11px] text-slate-300 font-mono">
                          <span>
                            Antigüedad: <strong className="text-white">{calcRec.anios}a {calcRec.meses}m {calcRec.dias}d</strong> ({calcRec.escala} d/año)
                          </span>
                          <span>• Años: <strong className="text-white">{fmtDias(calcRec.diasPorAnios)} d</strong></span>
                          <span>• Meses (÷12): <strong className="text-teal-300">+{fmtDias(calcRec.diasPorMeses)} d</strong></span>
                          <span>• Días (÷30): <strong className="text-teal-300">+{fmtDias(calcRec.diasPorDias)} d</strong></span>
                          <span>• Rebajas (Sol/Col/Pag): <strong className="text-amber-300">-{fmtDias(calcRec.totalRebaja)} d</strong></span>
                          <span className="text-emerald-300 font-bold">
                            ⇒ Saldo Exacto: {fmtDias(calcRec.saldoFraccionado)} d
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* Printable Document Preview Canvas */}
                <div className="flex justify-center">
                  {(() => {
                    // Helper para renderizar 1 copia del Recibo de Pago (mitad de hoja)
                    const renderSinglePaymentReceipt = () => (
                      <div className="p-6 sm:p-8 bg-white text-slate-900 font-sans text-xs leading-relaxed h-full flex flex-col justify-between">
                        {/* Cabecera: Únicamente N° de Recibo a la derecha (sin etiquetas de Original/Copia) */}
                        <div className="flex justify-end items-center mb-3">
                          <div className="border border-slate-700 px-3.5 py-1 font-bold text-xs tracking-wide text-slate-900 bg-slate-50 shadow-sm">
                            RECIBO N.º {reciboNro}
                          </div>
                        </div>

                        {/* Título Principal */}
                        <h1 className="text-sm sm:text-base font-black text-center text-slate-900 tracking-wider mb-4 uppercase">
                          RECIBO DE PAGO DE VACACIONES
                        </h1>

                        {/* Declaración con C.I. explícito y sin cortes */}
                        <p className="text-[12px] sm:text-xs text-slate-800 leading-relaxed mb-3.5 text-justify">
                          Yo, <span className="font-bold uppercase underline decoration-slate-400">{receiptEmployee.employee_name}</span> con C.I. <span className="font-bold font-mono">{receiptEmployee.employee_ci}</span>, declaro haber recibido de <span className="font-bold">{reciboEmpleadorNombre}</span>, <span className="italic">{reciboEmpleadorRol}</span>, la suma de <span className="font-bold">Bs {reciboImporteCancelado.toLocaleString("es-BO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ({formatearMontoLiteral(reciboImporteCancelado)} Bolivianos)</span> por concepto de pago de <span className="font-bold">{formatearDiasLiteral(reciboDiasPagados)}</span> días de vacaciones devengadas.
                        </p>

                        {/* Detalle */}
                        <div className="mb-4 pl-1">
                          <h3 className="font-bold text-xs text-slate-900 mb-1.5">Detalle:</h3>
                          <ul className="space-y-1 text-[11px] sm:text-xs text-slate-800">
                            <li className="flex items-center gap-2">
                              <span className="font-bold text-slate-400">•</span>
                              <span className="w-56">Total ganado mensual:</span>
                              <span className="font-bold font-mono">Bs {reciboTotalGanado.toLocaleString("es-BO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                            </li>
                            <li className="flex items-center gap-2">
                              <span className="font-bold text-slate-400">•</span>
                              <span className="w-56">Salario diario:</span>
                              <span className="font-bold font-mono">Bs {reciboTotalGanado.toLocaleString("es-BO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ÷ 30 = Bs {reciboSalarioDiario.toLocaleString("es-BO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                            </li>
                            <li className="flex items-center gap-2">
                              <span className="font-bold text-slate-400">•</span>
                              <span className="w-56">Días de vacaciones pagados:</span>
                              <span className="font-bold font-mono">{fmtDias(reciboDiasPagados)} días</span>
                            </li>
                            <li className="flex items-center gap-2">
                              <span className="font-bold text-slate-400">•</span>
                              <span className="w-56 font-bold">Importe cancelado:</span>
                              <span className="font-bold font-mono text-xs sm:text-sm text-slate-900">Bs {reciboImporteCancelado.toLocaleString("es-BO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                            </li>
                          </ul>
                        </div>

                        {/* Conformidad */}
                        <p className="text-[11px] sm:text-xs text-slate-800 mb-2.5">
                          En constancia de conformidad con el pago recibido, firmo el presente documento.
                        </p>

                        {/* Lugar y fecha */}
                        <div className="text-[11px] sm:text-xs text-slate-800 mb-5">
                          <span>Lugar y fecha: </span>
                          <span className="font-medium underline decoration-slate-400">{reciboLugarFecha}</span>
                        </div>

                        {/* Firmas: RECIBÍ CONFORME y ENTREGUÉ CONFORME (Firma arriba, Nombre y C.I. abajo completados) */}
                        {reciboFirmasEnBlanco ? (
                          <div className="grid grid-cols-2 gap-8 text-center pt-3 border-t border-slate-200">
                            <div className="space-y-1.5 text-left text-[11px] text-slate-800 px-2">
                              <div className="font-bold text-xs text-slate-900 uppercase text-center mb-1">RECIBÍ CONFORME</div>
                              {/* Espacio vertical libre amplio para la firma física y sello */}
                              <div className="h-20 sm:h-24"></div>
                              <div className="flex items-center"><span className="font-semibold text-slate-600 shrink-0 mr-1.5">Firma:</span><span className="text-slate-400 font-mono tracking-wider select-none overflow-hidden whitespace-nowrap w-full">................................................................................................................................</span></div>
                              <div className="flex items-center"><span className="font-semibold text-slate-600 shrink-0 mr-1.5">Nombre:</span><span className="text-slate-400 font-mono tracking-wider select-none overflow-hidden whitespace-nowrap w-full">................................................................................................................................</span></div>
                              <div className="flex items-center"><span className="font-semibold text-slate-600 shrink-0 mr-1.5">C.I.:</span><span className="text-slate-400 font-mono tracking-wider select-none overflow-hidden whitespace-nowrap w-full">................................................................................................................................</span></div>
                            </div>

                            <div className="space-y-1.5 text-left text-[11px] text-slate-800 px-2">
                              <div className="font-bold text-xs text-slate-900 uppercase text-center mb-1">ENTREGUÉ CONFORME</div>
                              {/* Espacio vertical libre amplio para la firma física y sello */}
                              <div className="h-20 sm:h-24"></div>
                              <div className="flex items-center"><span className="font-semibold text-slate-600 shrink-0 mr-1.5">Firma:</span><span className="text-slate-400 font-mono tracking-wider select-none overflow-hidden whitespace-nowrap w-full">................................................................................................................................</span></div>
                              <div className="flex items-center"><span className="font-semibold text-slate-600 shrink-0 mr-1.5">Nombre:</span><span className="text-slate-800 font-semibold truncate">{reciboEmpleadorNombre || "................................................................................................................................"}</span></div>
                              <div className="flex items-center"><span className="font-semibold text-slate-600 shrink-0 mr-1.5">C.I.:</span><span className="text-slate-800 font-semibold font-mono truncate">{reciboEmpleadorCi || "................................................................................................................................"}</span></div>
                            </div>
                          </div>
                        ) : (
                          <div className="grid grid-cols-2 gap-8 text-center pt-3 border-t border-slate-200">
                            <div className="flex flex-col items-center">
                              <div className="font-bold text-xs text-slate-900 uppercase mb-1">RECIBÍ CONFORME</div>
                              {/* Espacio vertical libre amplio para la firma física y sello */}
                              <div className="h-20 sm:h-24"></div>
                              <div className="w-44 border-b border-slate-500 mb-1.5"></div>
                              <div className="text-[11px] text-slate-700 font-semibold">Nombre: {receiptEmployee.employee_name}</div>
                              <div className="text-[11px] text-slate-600 font-mono">C.I.: {receiptEmployee.employee_ci}</div>
                            </div>

                            <div className="flex flex-col items-center">
                              <div className="font-bold text-xs text-slate-900 uppercase mb-1">ENTREGUÉ CONFORME</div>
                              {/* Espacio vertical libre amplio para la firma física y sello */}
                              <div className="h-20 sm:h-24"></div>
                              <div className="w-44 border-b border-slate-500 mb-1.5"></div>
                              <div className="text-[11px] text-slate-700 font-semibold">Nombre: {reciboEmpleadorNombre}</div>
                              <div className="text-[11px] text-slate-600 font-mono">C.I.: {reciboEmpleadorCi}</div>
                            </div>
                          </div>
                        )}
                      </div>
                    );

                    // Helper para renderizar Ficha de Vacaciones Solicitadas
                    const renderSingleFicha = () => (
                      <div className="bg-white text-slate-900 font-sans leading-relaxed p-4 sm:p-5 text-xs">
                        {/* Cabecera sin etiquetas original/copia */}
                        <div className="flex justify-end items-center mb-1">
                          <span className="text-[10px] font-mono text-slate-600">
                            Fecha: {fichaFecha}
                          </span>
                        </div>

                        <h1 className="text-xs sm:text-sm font-black text-center text-slate-900 tracking-wider uppercase border-b-2 border-slate-800 pb-1 mb-2.5">
                          FICHA DE VACACIONES {fichaTipoFilter === "todas" ? "SOLICITADAS - COLECTIVAS" : fichaTipoFilter === "solicitada" ? "SOLICITADAS" : "COLECTIVAS"}
                        </h1>

                        {/* DATOS DEL TRABAJADOR */}
                        <div className="mb-2.5 border border-slate-300 rounded overflow-hidden">
                          <div className="bg-slate-100 px-2.5 py-0.5 font-bold text-[9px] uppercase tracking-wider text-slate-700 border-b border-slate-300">
                            DATOS DEL TRABAJADOR / INFORMACIÓN
                          </div>
                          <div className="p-2 grid grid-cols-2 gap-1.5 text-[10px] sm:text-[10.5px]">
                            <div>
                              <span className="font-semibold text-slate-600">Nombre del trabajador: </span>
                              <span className="font-bold text-slate-900 uppercase">{receiptEmployee.employee_name}</span>
                            </div>
                            <div>
                              <span className="font-semibold text-slate-600">Cargo: </span>
                              <span className="font-bold text-slate-900 uppercase">{receiptEmployee.employee_cargo}</span>
                            </div>
                            <div>
                              <span className="font-semibold text-slate-600">C.I.: </span>
                              <span className="font-bold font-mono text-slate-900">{receiptEmployee.employee_ci}</span>
                            </div>
                            <div>
                              <span className="font-semibold text-slate-600">Fecha de Ingreso: </span>
                              <span className="font-bold font-mono text-slate-900">{formatDMY(receiptEmployee.fecha_ingreso)}</span>
                            </div>
                          </div>
                        </div>

                        {/* TABLA DE VACACIONES */}
                        <div className="mb-2">
                          <div className="font-bold text-[9px] uppercase tracking-wider text-slate-800 mb-0.5">
                            DETALLE DE VACACIONES
                          </div>
                          <div className="border border-slate-300 rounded overflow-hidden">
                            <table className="w-full text-left text-[9.5px] sm:text-[10px] border-collapse">
                              <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-300">
                                <tr>
                                  <th className="py-0.5 px-1.5 text-center w-7">N°</th>
                                  <th className="py-0.5 px-1.5 text-center">Fecha Inicio</th>
                                  <th className="py-0.5 px-1.5 text-center">Fecha Fin</th>
                                  <th className="py-0.5 px-1.5 text-right">Días</th>
                                  <th className="py-0.5 px-1.5 text-center">Tipo</th>
                                  <th className="py-0.5 px-2">Motivo / Detalle</th>
                                  <th className="py-0.5 px-1.5 text-center">Solicitud</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-200">
                                {activeFichaRecords.length === 0 ? (
                                  <tr>
                                    <td colSpan={7} className="py-2 text-center text-slate-400 italic">
                                      No se registran vacaciones para este filtro o periodo.
                                    </td>
                                  </tr>
                                ) : (
                                  activeFichaRecords.map((r, idx) => (
                                    <tr key={r.id} className="hover:bg-slate-50">
                                      <td className="py-0.5 px-1.5 text-center font-mono font-bold text-slate-600">{idx + 1}</td>
                                      <td className="py-0.5 px-1.5 text-center font-mono">{formatDMY(r.fecha_inicio)}</td>
                                      <td className="py-0.5 px-1.5 text-center font-mono">{formatDMY(r.fecha_fin)}</td>
                                      <td className="py-0.5 px-1.5 text-right font-mono font-bold text-slate-900">{Number(r.dias).toFixed(1)}</td>
                                      <td className="py-0.5 px-1.5 text-center">
                                        <span className={`px-1.5 py-0.2 rounded text-[8.5px] font-bold ${
                                          r.tipo === "solicitada" ? "bg-indigo-50 text-indigo-700 border border-indigo-200" : "bg-purple-50 text-purple-700 border border-purple-200"
                                        }`}>
                                          {r.tipo === "solicitada" ? "Solicitada" : "Colectiva"}
                                        </span>
                                      </td>
                                      <td className="py-0.5 px-2 text-slate-700 truncate max-w-[150px]">{r.motivo || "-"}</td>
                                      <td className="py-0.5 px-1.5 text-center font-mono text-slate-500">{r.fecha_solicitud ? formatDMY(r.fecha_solicitud) : "-"}</td>
                                    </tr>
                                  ))
                                )}
                              </tbody>
                              <tfoot className="bg-slate-100 font-bold border-t border-slate-300">
                                <tr>
                                  <td colSpan={3} className="py-0.5 px-2 text-right text-slate-700 uppercase text-[9px]">
                                    Total Días:
                                  </td>
                                  <td className="py-0.5 px-1.5 text-right font-mono font-black text-slate-900">
                                    {totalDiasFicha.toFixed(1)}
                                  </td>
                                  <td colSpan={3} className="py-0.5 px-1.5 text-slate-500 font-normal text-[9px]">
                                    días de vacación computados
                                  </td>
                                </tr>
                              </tfoot>
                            </table>
                          </div>
                        </div>

                        {/* Observaciones */}
                        <div className="mb-2 text-[10px] text-slate-800">
                          {fichaObservaciones ? (
                            <div>
                              <span className="font-bold">Observaciones: </span>
                              <span>{fichaObservaciones}</span>
                            </div>
                          ) : (
                            <div className="space-y-1">
                              <div className="flex items-center">
                                <span className="font-bold shrink-0 mr-1.5">Observaciones:</span>
                                <span className="text-slate-400 font-mono tracking-wider select-none overflow-hidden whitespace-nowrap w-full">
                                  ........................................................................................................................................................................................................................................
                                </span>
                              </div>
                              <div className="text-slate-400 font-mono tracking-wider select-none overflow-hidden whitespace-nowrap w-full">
                                ........................................................................................................................................................................................................................................................
                              </div>
                            </div>
                          )}
                        </div>

                        {/* CONFORMIDAD */}
                        <div className="mb-2.5 p-2 bg-slate-50 border border-slate-200 rounded text-[9.5px]">
                          <div className="font-bold uppercase tracking-wider text-slate-800 mb-0.5 text-[9px]">
                            CONFORMIDAD
                          </div>
                          <p className="text-slate-800 leading-tight text-justify">
                            Declaro mi conformidad con el registro de <span className="font-bold font-mono underline decoration-slate-400">{totalDiasFicha.toFixed(1)}</span> días de vacación consignados en la presente ficha, firmando al pie para constancia y fines administrativos correspondientes.
                          </p>
                        </div>

                        {/* Tablas de Firma */}
                        {reciboFirmasEnBlanco ? (
                          <div className="grid grid-cols-2 gap-3 border border-slate-300 rounded overflow-hidden text-[9.5px]">
                            <div className="border-r border-slate-300 p-2 space-y-1">
                              <div className="bg-slate-100 -mx-2 -mt-2 mb-1.5 py-0.5 px-2 font-bold text-slate-800 text-center border-b border-slate-300 text-[9px] uppercase tracking-wider">
                                Firma del trabajador
                              </div>
                              <div className="flex items-center"><span className="text-slate-500 font-medium shrink-0 mr-1">Nombre:</span><span className="text-slate-400 font-mono tracking-wider select-none overflow-hidden whitespace-nowrap w-full">....................................................................................................</span></div>
                              <div className="flex items-center"><span className="text-slate-500 font-medium shrink-0 mr-1">Fecha:</span><span className="text-slate-400 font-mono tracking-wider select-none overflow-hidden whitespace-nowrap w-full">....................................................................................................</span></div>
                              <div className="flex items-center pt-1"><span className="text-slate-500 font-medium shrink-0 mr-1">Firma:</span><span className="text-slate-400 font-mono tracking-wider select-none overflow-hidden whitespace-nowrap w-full">....................................................................................................</span></div>
                            </div>

                            <div className="p-2 space-y-1">
                              <div className="bg-slate-100 -mx-2 -mt-2 mb-1.5 py-0.5 px-2 font-bold text-slate-800 text-center border-b border-slate-300 text-[9px] uppercase tracking-wider">
                                Firma del responsable
                              </div>
                              <div className="flex items-center"><span className="text-slate-500 font-medium shrink-0 mr-1">Nombre:</span><span className="text-slate-400 font-mono tracking-wider select-none overflow-hidden whitespace-nowrap w-full">....................................................................................................</span></div>
                              <div className="flex items-center"><span className="text-slate-500 font-medium shrink-0 mr-1">Fecha:</span><span className="text-slate-400 font-mono tracking-wider select-none overflow-hidden whitespace-nowrap w-full">....................................................................................................</span></div>
                              <div className="flex items-center pt-1"><span className="text-slate-500 font-medium shrink-0 mr-1">Firma:</span><span className="text-slate-400 font-mono tracking-wider select-none overflow-hidden whitespace-nowrap w-full">....................................................................................................</span></div>
                            </div>
                          </div>
                        ) : (
                          <div className="grid grid-cols-2 gap-3 border border-slate-300 rounded overflow-hidden text-[9.5px]">
                            <div className="border-r border-slate-300 flex flex-col justify-between">
                              <div className="bg-slate-100 py-0.5 px-2 font-bold text-slate-800 text-center border-b border-slate-300 text-[9px] uppercase tracking-wider">
                                Firma del trabajador
                              </div>
                              <div className="p-2 space-y-1">
                                <div>
                                  <span className="text-slate-500">Nombre: </span>
                                  <span className="font-bold text-slate-900 uppercase">{receiptEmployee.employee_name}</span>
                                </div>
                                <div>
                                  <span className="text-slate-500">Fecha: </span>
                                  <span className="font-mono">{fichaFecha}</span>
                                </div>
                                <div className="pt-4">
                                  <div className="border-b border-slate-400 mb-0.5"></div>
                                  <div className="text-[8.5px] text-slate-400 text-center">Firma del trabajador</div>
                                </div>
                              </div>
                            </div>

                            <div className="flex flex-col justify-between">
                              <div className="bg-slate-100 py-0.5 px-2 font-bold text-slate-800 text-center border-b border-slate-300 text-[9px] uppercase tracking-wider">
                                Firma del responsable
                              </div>
                              <div className="p-2 space-y-1">
                                <div>
                                  <span className="text-slate-500">Nombre: </span>
                                  <span className="font-bold text-slate-900 uppercase">{fichaResponsableNombre}</span>
                                </div>
                                <div>
                                  <span className="text-slate-500">Fecha: </span>
                                  <span className="font-mono">{fichaFecha}</span>
                                </div>
                                <div className="pt-4">
                                  <div className="border-b border-slate-400 mb-0.5"></div>
                                  <div className="text-[8.5px] text-slate-400 text-center">Firma del responsable</div>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );

                    if (receiptDocType === "pago") {
                      return (
                        <div
                          id="printable-vacation-document"
                          className="bg-white text-slate-900 rounded-2xl shadow-2xl border border-slate-300 max-w-2xl sm:max-w-3xl w-full font-sans overflow-hidden flex flex-col justify-between"
                        >
                          {/* Mitad Superior */}
                          <div className="flex-1 flex flex-col justify-between">
                            {renderSinglePaymentReceipt()}
                          </div>

                          {/* Línea Central de Corte (exactamente al medio de la hoja) */}
                          <div className="relative py-2 flex items-center justify-center bg-white border-y border-dashed border-slate-300 select-none">
                            <span className="text-[10px] sm:text-[11px] font-mono font-bold text-slate-500 tracking-wider">
                              - - - - - - - - - - - - - - - - - - - - - - - - ✂ CORTAR AQUÍ ✂ - - - - - - - - - - - - - - - - - - - - - - - -
                            </span>
                          </div>

                          {/* Mitad Inferior */}
                          <div className="flex-1 flex flex-col justify-between">
                            {renderSinglePaymentReceipt()}
                          </div>
                        </div>
                      );
                    } else {
                      return (
                        <div
                          id="printable-vacation-document"
                          className="bg-white text-slate-900 rounded-2xl shadow-2xl border border-slate-300 max-w-2xl sm:max-w-3xl w-full font-sans overflow-hidden"
                        >
                          {/* Mitad Superior */}
                          {renderSingleFicha()}

                          {/* Línea Central de Corte */}
                          <div className="relative my-1 py-1.5 flex items-center justify-center bg-white border-y border-dashed border-slate-300">
                            <span className="text-[10px] sm:text-[11px] font-mono font-bold text-slate-500 tracking-wider">
                              - - - - - - - - - - - - - - - - - - - - - - - - ✂ CORTAR AQUÍ ✂ - - - - - - - - - - - - - - - - - - - - - - - -
                            </span>
                          </div>

                          {/* Mitad Inferior */}
                          {renderSingleFicha()}
                        </div>
                      );
                    }
                  })()}
                </div>
              </div>

              {/* Modal Footer */}
              <div className="p-4 sm:p-5 border-t border-white/10 bg-slate-900/90 flex flex-wrap items-center justify-between gap-3">
                <div className="text-xs text-slate-400">
                  {receiptDocType === "pago"
                    ? "Comprobante de pago económico por vacaciones devengadas / compensadas."
                    : "Constancia de goce y conformidad de vacaciones solicitadas o colectivas."}
                </div>
                <button
                  type="button"
                  onClick={() => setShowReceiptsModal(false)}
                  className="px-6 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs transition cursor-pointer"
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

export default function VacacionesPage() {
  return (
    <Suspense fallback={
      <div className="flex h-full items-center justify-center min-h-[60vh]">
        <Loader2 className="w-12 h-12 text-teal-500 animate-spin" />
      </div>
    }>
      <VacacionesContent />
    </Suspense>
  );
}
