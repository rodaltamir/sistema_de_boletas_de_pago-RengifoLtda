"use client";

import React, { useState, useEffect, Suspense, useMemo } from "react";
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
  Banknote
} from "lucide-react";
import Swal from "sweetalert2";
import { getApiUrl } from "@/utils/api";

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
  gestion: number;
  aprobado_por?: string;
  created_at?: string;
}

interface EmployeeVacationSummary {
  employee_id: number;
  employee_code?: string;
  employee_name: string;
  employee_ci: string;
  employee_cargo: string;
  fecha_ingreso: string;
  antiguedad_anios: number;
  antiguedad_meses: number;
  antiguedad_dias: number;
  antiguedad_formato: string;
  escala_dias: number;
  dias_acumulados: number;
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

function VacacionesContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const tenantSchema = searchParams.get("tenant");

  const [summary, setSummary] = useState<CompanyVacationSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [scaleFilter, setScaleFilter] = useState<string>("todos");
  const [exportingExcel, setExportingExcel] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);

  // Rango de fechas para el periodo ("DEL ... AL ...")
  const currentYear = new Date().getFullYear();
  const [fechaDesde, setFechaDesde] = useState<string>(() => `${currentYear}-01-01`);
  const [fechaHasta, setFechaHasta] = useState<string>(() => `${currentYear}-12-31`);

  // Modal Registro de Vacaciones
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [selectedEmpId, setSelectedEmpId] = useState<number | null>(null);
  const [vacationType, setVacationType] = useState<"dias_pagados" | "solicitada" | "colectiva">("solicitada");
  const [motivo, setMotivo] = useState("");
  const [onlyBusinessDays, setOnlyBusinessDays] = useState(true);

  // Días Pagados (solo número de días)
  const [diasPagadosInput, setDiasPagadosInput] = useState<string>("");

  // Notificación de último registro guardado para permanecer en la ventana
  const [lastSavedAlert, setLastSavedAlert] = useState<{ empName: string; dias: number; tipo: string } | null>(null);

  // Calendario Interactivo
  const [calMonth, setCalMonth] = useState<number>(new Date().getMonth());
  const [calYear, setCalYear] = useState<number>(new Date().getFullYear());
  const [selectedDates, setSelectedDates] = useState<string[]>([]);
  const [rangeStart, setRangeStart] = useState<string | null>(null);
  const [selectionMode, setSelectionMode] = useState<"individual" | "rango">("individual");

  // Modal Ficha Individual
  const [viewingEmployee, setViewingEmployee] = useState<EmployeeVacationSummary | null>(null);
  const [exportingEmpExcel, setExportingEmpExcel] = useState(false);
  const [exportingEmpPdf, setExportingEmpPdf] = useState(false);

  // Kárdex con saldo progresivo (cronológico)
  const kardexRecords = useMemo(() => {
    if (!viewingEmployee) return [];
    const recs = [...viewingEmployee.records].sort((a, b) => 
      a.fecha_inicio.localeCompare(b.fecha_inicio)
    );
    let cur = viewingEmployee.dias_acumulados;
    return recs.map((r, idx) => {
      cur = Math.round((cur - r.dias) * 10) / 10;
      return {
        ...r,
        kardexIndex: idx + 1,
        saldoRestante: cur
      };
    });
  }, [viewingEmployee]);

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

  const cleanMotivo = (motivo?: string, tipo?: string) => {
    if (!motivo || motivo.trim() === "") {
      if (tipo === "dias_pagados" || tipo === "a_cuenta") return "Compensación de días pagados";
      if (tipo === "colectiva") return "Vacación colectiva institucional";
      return "Descanso vacacional solicitado";
    }
    return motivo
      .replace(/Vacaciones a_cuenta/gi, "Compensación de días pagados")
      .replace(/a_cuenta/gi, "días pagados")
      .replace(/solicitada/gi, "solicitada")
      .replace(/colectiva/gi, "colectiva");
  };

  useEffect(() => {
    if (!tenantSchema) {
      router.push("/seleccionar-empresa");
    } else {
      fetchSummary();
    }
  }, [tenantSchema]);

  const fetchSummary = async () => {
    if (!tenantSchema) return;
    try {
      setLoading(true);
      const res = await fetch(`${getApiUrl()}/api/tenants/${tenantSchema}/vacaciones/summary/`);
      if (res.ok) {
        const data = await res.json();
        setSummary(data);
      } else {
        console.error("Error al obtener resumen de vacaciones", await res.text());
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleExportCompany = async (format: "excel" | "pdf") => {
    if (!tenantSchema) return;
    try {
      if (format === "excel") setExportingExcel(true);
      else setExportingPdf(true);

      const qParams = new URLSearchParams();
      if (fechaDesde) qParams.set("desde", fechaDesde);
      if (fechaHasta) qParams.set("hasta", fechaHasta);
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

  const handleExportEmployee = async (empId: number, format: "excel" | "pdf") => {
    if (!tenantSchema) return;
    try {
      if (format === "excel") setExportingEmpExcel(true);
      else setExportingEmpPdf(true);

      const qParams = new URLSearchParams();
      if (fechaDesde) qParams.set("desde", fechaDesde);
      if (fechaHasta) qParams.set("hasta", fechaHasta);
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
        await fetchSummary();
        // Actualizar ficha si está abierta
        const updatedRes = await fetch(`${getApiUrl()}/api/tenants/${tenantSchema}/vacaciones/employee/${empId}/`);
        if (updatedRes.ok) {
          const empData = await updatedRes.json();
          setViewingEmployee(empData);
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
    if (empId) {
      setSelectedEmpId(empId);
    } else if (summary && summary.employees.length > 0) {
      setSelectedEmpId(summary.employees[0].employee_id);
    }
    setVacationType("solicitada");
    setSelectionMode("individual");
    setMotivo("");
    setSelectedDates([]);
    setRangeStart(null);
    setDiasPagadosInput("");
    setLastSavedAlert(null);
    setCalMonth(new Date().getMonth());
    setCalYear(new Date().getFullYear());
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
      const todayStr = formatYMD(new Date());
      startDate = todayStr;
      endDate = todayStr;
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
      const payload = {
        employee_id: selectedEmpId,
        tipo: vacationType,
        fecha_inicio: startDate,
        fecha_fin: endDate,
        dias: computedDays,
        fechas_detalle: fechasDetalle,
        motivo: motivo.trim() || (vacationType === "dias_pagados" ? "Días de vacación pagados en liquidación / compensación" : `Vacaciones ${vacationType}`),
        gestion: parseInt(startDate.split("-")[0]) || new Date().getFullYear(),
        aprobado_por: ""
      };

      const res = await fetch(`${getApiUrl()}/api/tenants/${tenantSchema}/vacaciones/record/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({ detail: "Error registrando vacación" }));
        throw new Error(errData.detail || "Error al registrar");
      }

      // Actualizar resumen en segundo plano para que el saldo se actualice en la pantalla
      await fetchSummary();

      // Guardar información del último registro y NO cerrar la ventana
      const empName = selectedEmp?.employee_name || "Trabajador";
      const tipoLabel = vacationType === "dias_pagados" ? "Días Pagados" : vacationType === "colectiva" ? "Colectiva" : "Solicitada";
      setLastSavedAlert({ empName, dias: computedDays, tipo: tipoLabel });

      // Limpiar campos para el siguiente registro manteniendo al empleado seleccionado
      setSelectedDates([]);
      setRangeStart(null);
      setDiasPagadosInput("");
      setMotivo("");

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
      {/* Cabecera Principal */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-2">
        <div>
          <h1 className="text-3xl font-black text-slate-900 flex items-center gap-2.5 tracking-tight">
            <CalendarIcon className="text-teal-600 w-8 h-8" />
            Control y Cómputo de Vacaciones
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Gestión y control de días hábiles de vacaciones según la antigüedad laboral efectiva del personal.
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

          <button
            onClick={() => handleOpenRegisterModal()}
            className="flex items-center gap-2 px-4 py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl text-sm transition shadow-md hover:shadow-lg transform hover:-translate-y-0.5"
          >
            <Plus className="w-4 h-4" />
            <span>Registrar Vacación</span>
          </button>
        </div>
      </div>

      {/* Rango de Fechas para Planilla y Exportación ("DEL ... AL ...") */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-teal-50 text-teal-700 rounded-xl">
            <CalendarCheck className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs font-black text-slate-800 uppercase tracking-wider block">
              Periodo de Reporte y Control de Vacaciones
            </span>
            <span className="text-xs text-slate-500">
              Rango de fechas para el cómputo y encabezado oficial de exportación (&quot;DEL ... AL ...&quot;)
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
            <span className="text-[11px] font-black text-slate-700 tracking-wide">DEL:</span>
            <input
              type="date"
              value={fechaDesde}
              onChange={(e) => setFechaDesde(e.target.value)}
              className="px-2 py-0.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
            <span className="text-[11px] font-black text-slate-700 tracking-wide ml-1">AL:</span>
            <input
              type="date"
              value={fechaHasta}
              onChange={(e) => setFechaHasta(e.target.value)}
              className="px-2 py-0.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => {
                setFechaDesde(`${currentYear}-01-01`);
                setFechaHasta(`${currentYear}-12-31`);
              }}
              className="px-2.5 py-1 text-[11px] font-bold rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 transition"
              title="Ajustar al año en curso"
            >
              Gestión {currentYear}
            </button>
            <button
              type="button"
              onClick={() => {
                setFechaDesde("2000-01-01");
                setFechaHasta(formatYMD(new Date()));
              }}
              className="px-2.5 py-1 text-[11px] font-bold rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 transition"
              title="Ajustar al historial total"
            >
              Histórico
            </button>
          </div>
        </div>
      </div>

      {/* Tarjetas KPI de Resumen Global */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Derecho Acumulado</span>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-2xl font-black text-slate-900">{summary?.total_dias_acumulados.toFixed(1)}</span>
            <span className="text-xs font-semibold text-slate-400">días</span>
          </div>
          <span className="text-[11px] text-teal-600 font-medium mt-1">Total por ley laboral</span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Días Pagados</span>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-2xl font-black text-emerald-600">
              {(summary?.total_dias_pagados ?? summary?.total_dias_a_cuenta ?? 0).toFixed(1)}
            </span>
            <span className="text-xs font-semibold text-slate-400">días</span>
          </div>
          <span className="text-[11px] text-emerald-600 font-medium mt-1">Compensados en dinero</span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Solicitadas</span>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-2xl font-black text-indigo-600">{summary?.total_dias_solicitadas.toFixed(1)}</span>
            <span className="text-xs font-semibold text-slate-400">días</span>
          </div>
          <span className="text-[11px] text-indigo-600 font-medium mt-1">Permisos regulares</span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Colectivas</span>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-2xl font-black text-purple-600">{summary?.total_dias_colectivas.toFixed(1)}</span>
            <span className="text-xs font-semibold text-slate-400">días</span>
          </div>
          <span className="text-[11px] text-purple-600 font-medium mt-1">Cierres de fin de año</span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Gozadas</span>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-2xl font-black text-amber-600">{summary?.total_dias_tomados.toFixed(1)}</span>
            <span className="text-xs font-semibold text-slate-400">días</span>
          </div>
          <span className="text-[11px] text-amber-600 font-medium mt-1">Consumidas a la fecha</span>
        </div>

        <div className="bg-teal-50/70 p-5 rounded-2xl border border-teal-200 shadow-xs flex flex-col justify-between">
          <span className="text-xs font-bold text-teal-800 uppercase tracking-wider">Saldo Pendiente</span>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-2xl font-black text-teal-700">{summary?.total_saldo_pendiente.toFixed(1)}</span>
            <span className="text-xs font-semibold text-teal-600">días</span>
          </div>
          <span className="text-[11px] text-teal-700 font-bold mt-1">Disponible para goce</span>
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
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-700 font-semibold text-xs uppercase tracking-wider border-b border-slate-200">
                <th className="p-4 pl-6">C.I. / Código</th>
                <th className="p-4">Trabajador</th>
                <th className="p-4">Cargo</th>
                <th className="p-4">Antigüedad</th>
                <th className="p-4 text-center">Escala</th>
                <th className="p-4 text-right">Derecho</th>
                <th className="p-4 text-right">Días Pagados</th>
                <th className="p-4 text-right">Solicitadas</th>
                <th className="p-4 text-right">Colectivas</th>
                <th className="p-4 text-right">Total Gozadas</th>
                <th className="p-4 text-right pr-6">Saldo Pendiente</th>
                <th className="p-4 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {filteredEmployees.length === 0 ? (
                <tr>
                  <td colSpan={12} className="p-8 text-center text-slate-400 font-medium">
                    No se encontraron empleados con los criterios seleccionados.
                  </td>
                </tr>
              ) : (
                filteredEmployees.map((emp) => (
                  <tr key={emp.employee_id} className="hover:bg-slate-50/70 transition">
                    <td className="p-4 pl-6 font-mono text-xs font-bold text-slate-700">
                      <div>{emp.employee_ci}</div>
                      {emp.employee_code && (
                        <div className="text-[10px] text-teal-600 font-bold">Cód: {emp.employee_code}</div>
                      )}
                    </td>

                    <td className="p-4 font-bold text-slate-900">
                      {emp.employee_name}
                    </td>

                    <td className="p-4 text-xs font-semibold text-slate-600">
                      {emp.employee_cargo}
                    </td>

                    <td className="p-4 text-xs text-slate-600 font-mono">
                      <div>{emp.antiguedad_formato}</div>
                      <div className="text-[10px] text-slate-400">Desde: {formatDMY(emp.fecha_ingreso)}</div>
                    </td>

                    <td className="p-4 text-center">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${
                        emp.escala_dias === 30 
                          ? "bg-purple-50 text-purple-700 border border-purple-200"
                          : emp.escala_dias === 20
                          ? "bg-blue-50 text-blue-700 border border-blue-200"
                          : "bg-teal-50 text-teal-700 border border-teal-200"
                      }`}>
                        {emp.escala_dias} d/año
                      </span>
                    </td>

                    <td className="p-4 text-right font-mono font-bold text-slate-900">
                      {emp.dias_acumulados.toFixed(1)}
                    </td>

                    <td className="p-4 text-right font-mono text-emerald-700 font-semibold">
                      {(emp.dias_pagados ?? emp.dias_a_cuenta ?? 0).toFixed(1)}
                    </td>

                    <td className="p-4 text-right font-mono text-indigo-700">
                      {emp.dias_solicitadas.toFixed(1)}
                    </td>

                    <td className="p-4 text-right font-mono text-purple-700">
                      {emp.dias_colectivas.toFixed(1)}
                    </td>

                    <td className="p-4 text-right font-mono font-bold text-amber-700">
                      {emp.total_dias_tomados.toFixed(1)}
                    </td>

                    <td className="p-4 text-right pr-6 font-mono font-black text-base">
                      <span className={emp.saldo_dias_pendientes > 0 ? "text-teal-600" : emp.saldo_dias_pendientes === 0 ? "text-slate-400" : "text-rose-600"}>
                        {emp.saldo_dias_pendientes.toFixed(1)} d
                      </span>
                    </td>

                    <td className="p-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => setViewingEmployee(emp)}
                          className="p-1.5 text-slate-400 hover:text-teal-600 rounded-lg hover:bg-slate-100 transition"
                          title="Ver Ficha e Historial"
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
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
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
                    <h2 className="text-xl font-bold text-white">Registrar Vacaciones de Personal</h2>
                    <p className="text-xs text-slate-400">Regulariza periodos, registra solicitudes o computa días pagados.</p>
                  </div>
                </div>
                <button 
                  onClick={() => {
                    if (!submitting) {
                      setShowRegisterModal(false);
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
                        onChange={(e) => setSelectedEmpId(Number(e.target.value))}
                        className="w-full bg-slate-950/80 border border-slate-700 text-white rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-teal-400 text-sm font-semibold shadow-inner"
                      >
                        {summary?.employees.map(emp => (
                          <option key={emp.employee_id} value={emp.employee_id} className="bg-slate-900 text-white">
                            {emp.employee_name} — Saldo: {emp.saldo_dias_pendientes.toFixed(1)} d
                          </option>
                        ))}
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
                  {selectedEmp && (
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
                          <span className="text-[10px] text-slate-400 block font-semibold">Saldo Disponible</span>
                          <span className="text-sm font-black text-amber-400">{selectedEmp.saldo_dias_pendientes.toFixed(1)} d</span>
                        </div>
                        <div className="bg-slate-900 border border-slate-700/80 px-3 py-1.5 rounded-xl text-center">
                          <span className="text-[10px] text-slate-400 block font-semibold">A Descontar</span>
                          <span className="text-sm font-black text-teal-400">
                            -{vacationType === "dias_pagados" ? (parseFloat(diasPagadosInput) || 0) : selectedDates.length} d
                          </span>
                        </div>
                        <div className={`border px-3 py-1.5 rounded-xl text-center ${
                          selectedEmp.saldo_dias_pendientes - (vacationType === "dias_pagados" ? (parseFloat(diasPagadosInput) || 0) : selectedDates.length) < 0
                            ? "bg-rose-500/10 border-rose-500/30 text-rose-400"
                            : "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                        }`}>
                          <span className="text-[10px] opacity-80 block font-semibold">Saldo Restante</span>
                          <span className="text-sm font-black">
                            {(selectedEmp.saldo_dias_pendientes - (vacationType === "dias_pagados" ? (parseFloat(diasPagadosInput) || 0) : selectedDates.length)).toFixed(1)} d
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ======================================================== */}
                  {/* CASO A: TIPO DÍAS PAGADOS (Solo número de días)            */}
                  {/* ======================================================== */}
                  {vacationType === "dias_pagados" ? (
                    <div className="bg-slate-950/80 p-5 rounded-2xl border border-emerald-500/30 shadow-xl space-y-3">
                      <label className="block text-xs font-bold text-slate-300 uppercase tracking-wide">
                        Número de Días Pagados *
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          step="0.5"
                          min="0.5"
                          placeholder="Ingresa los días pagados (ej. 15)"
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

                      {/* Accesos rápidos numéricos */}
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
                        {selectedEmp && selectedEmp.saldo_dias_pendientes > 0 && (
                          <button
                            type="button"
                            onClick={() => setDiasPagadosInput(String(selectedEmp.saldo_dias_pendientes))}
                            className="px-2.5 py-1 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 text-xs font-bold rounded-lg border border-emerald-500/30 transition"
                          >
                            Todo el Saldo ({selectedEmp.saldo_dias_pendientes.toFixed(1)} d)
                          </button>
                        )}
                      </div>
                    </div>
                  ) : (
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

                  {/* Motivo / Justificación */}
                  <div>
                    <label className="block text-xs font-bold text-slate-300 uppercase tracking-wide mb-1">
                      Motivo / Justificación
                    </label>
                    <input
                      type="text"
                      placeholder="Ej. Vacaciones anuales correspondientes a la gestión..."
                      value={motivo}
                      onChange={(e) => setMotivo(e.target.value)}
                      className="w-full bg-slate-950/80 border border-slate-700 text-white rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-teal-400 text-sm font-medium"
                    />
                  </div>

                </form>
              </div>

              {/* Botonera Modal */}
              <div className="p-6 border-t border-white/10 bg-slate-900/90 flex flex-col sm:flex-row justify-between items-center gap-3">
                <div className="text-xs text-slate-400 text-center sm:text-left">
                  {lastSavedAlert ? (
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
                    Confirmar y Guardar Vacación
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
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-slate-900 border border-slate-700 rounded-[2rem] w-full max-w-4xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh]"
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
                  <button
                    onClick={() => handleExportEmployee(viewingEmployee.employee_id, "excel")}
                    disabled={exportingEmpExcel}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 rounded-xl text-xs font-bold transition disabled:opacity-50"
                  >
                    {exportingEmpExcel ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileSpreadsheet className="w-3.5 h-3.5" />}
                    <span>Descargar Excel</span>
                  </button>

                  <button
                    onClick={() => handleExportEmployee(viewingEmployee.employee_id, "pdf")}
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
              <div className="p-6 overflow-y-auto space-y-6 custom-scrollbar">
                
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

                {/* 3 Tarjetas de Resumen Claras y Sencillas */}
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
                          {viewingEmployee.dias_acumulados.toFixed(1)}
                        </span>
                        <span className="text-xs font-semibold text-slate-400">días</span>
                      </div>
                    </div>
                    <span className="text-[11px] text-slate-400 mt-2">
                      Total derecho por antigüedad laboral
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
                          {viewingEmployee.total_dias_tomados.toFixed(1)}
                        </span>
                        <span className="text-xs font-semibold text-slate-400">días</span>
                      </div>
                    </div>
                    <span className="text-[11px] text-slate-400 mt-2 truncate" title={`Pagados: ${(viewingEmployee.dias_pagados ?? viewingEmployee.dias_a_cuenta ?? 0).toFixed(1)} d • Solicitadas: ${viewingEmployee.dias_solicitadas.toFixed(1)} d • Colectivas: ${viewingEmployee.dias_colectivas.toFixed(1)} d`}>
                      Pagados: {(viewingEmployee.dias_pagados ?? viewingEmployee.dias_a_cuenta ?? 0).toFixed(1)} d • Solicitadas: {viewingEmployee.dias_solicitadas.toFixed(1)} d • Colectivas: {viewingEmployee.dias_colectivas.toFixed(1)} d
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
                          {viewingEmployee.saldo_dias_pendientes.toFixed(1)}
                        </span>
                        <span className="text-xs font-bold text-teal-200">días hábiles</span>
                      </div>
                    </div>
                    <span className="text-[11px] text-teal-300/80 font-medium mt-2">
                      Días libres restantes para goce o compensación
                    </span>
                  </div>
                </div>

                {/* Historial de Registros - Formato Kárdex */}
                <div className="bg-slate-800/80 rounded-2xl border border-white/10 overflow-hidden">
                  <div className="p-4 border-b border-white/10 flex justify-between items-center">
                    <div>
                      <h4 className="text-sm font-bold text-white flex items-center gap-2">
                        <Clock className="w-4 h-4 text-teal-400" />
                        Historial de Movimientos y Kárdex de Vacaciones ({kardexRecords.length})
                      </h4>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Cómputo progresivo de días acumulados ganados y días tomados o pagados.
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        handleOpenRegisterModal(viewingEmployee.employee_id);
                        setViewingEmployee(null);
                      }}
                      className="px-3 py-1.5 bg-teal-600 hover:bg-teal-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-1 shadow-sm"
                    >
                      <Plus className="w-3.5 h-3.5" /> Agregar Nuevo
                    </button>
                  </div>

                  <div className="overflow-x-auto">
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
                          <th className="p-3 pr-4 text-center w-16">Acción</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5 text-slate-300">
                        {/* Fila 0 de Apertura de Kárdex: Derecho acumulado */}
                        <tr className="bg-teal-950/20 font-medium border-b border-teal-500/20">
                          <td className="p-3 pl-4 text-center text-slate-400 font-mono">-</td>
                          <td className="p-3 font-mono text-slate-300">
                            {formatDMY(viewingEmployee.fecha_ingreso)} (Ingreso)
                          </td>
                          <td className="p-3">
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-teal-500/20 text-teal-300 border border-teal-500/30">
                              Derecho Acumulado
                            </span>
                          </td>
                          <td className="p-3 text-right font-mono font-bold text-emerald-400">
                            +{viewingEmployee.dias_acumulados.toFixed(1)} d
                          </td>
                          <td className="p-3 text-right font-mono text-slate-500">
                            -
                          </td>
                          <td className="p-3 text-right font-mono font-black text-teal-300 text-sm">
                            {viewingEmployee.dias_acumulados.toFixed(1)} d
                          </td>
                          <td className="p-3 text-slate-400 italic">
                            Saldo inicial ganado por ley ({viewingEmployee.antiguedad_formato})
                          </td>
                          <td className="p-3 pr-4 text-center text-slate-500">-</td>
                        </tr>

                        {kardexRecords.length === 0 ? (
                          <tr>
                            <td colSpan={8} className="p-6 text-center text-slate-500 italic">
                              No registra días tomados ni pagados a la fecha. El saldo disponible es total.
                            </td>
                          </tr>
                        ) : (
                          kardexRecords.map((r) => (
                            <tr key={r.id} className="hover:bg-white/5 transition">
                              <td className="p-3 pl-4 text-center font-mono font-bold text-slate-400">
                                {r.kardexIndex}
                              </td>
                              <td className="p-3 font-mono text-slate-200">
                                {r.tipo === "dias_pagados" || r.tipo === "a_cuenta" 
                                  ? `Compensación de días (${formatDMY(r.fecha_inicio)})` 
                                  : `${formatDMY(r.fecha_inicio)} al ${formatDMY(r.fecha_fin)}`}
                              </td>
                              <td className="p-3">
                                <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold ${
                                  r.tipo === "dias_pagados" || r.tipo === "a_cuenta"
                                    ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                                    : r.tipo === "colectiva"
                                    ? "bg-purple-500/20 text-purple-300 border border-purple-500/30"
                                    : "bg-indigo-500/20 text-indigo-300 border border-indigo-500/30"
                                }`}>
                                  {r.tipo === "dias_pagados" || r.tipo === "a_cuenta" ? "Días Pagados" : r.tipo === "colectiva" ? "Colectiva" : "Solicitada"}
                                </span>
                              </td>
                              <td className="p-3 text-right font-mono text-slate-500">
                                -
                              </td>
                              <td className="p-3 text-right font-mono font-bold text-rose-400">
                                - {r.dias.toFixed(1)} d
                              </td>
                              <td className="p-3 text-right font-mono font-black text-teal-300">
                                {r.saldoRestante.toFixed(1)} d
                              </td>
                              <td className="p-3 text-slate-300">
                                {cleanMotivo(r.motivo, r.tipo)}
                              </td>
                              <td className="p-3 pr-4 text-center">
                                <button
                                  onClick={() => handleDeleteRecord(r.id, viewingEmployee.employee_id)}
                                  className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition"
                                  title="Eliminar este registro"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                      <tfoot>
                        <tr className="bg-slate-900/90 font-bold border-t-2 border-white/20 text-white">
                          <td colSpan={3} className="p-3 pl-4 text-right uppercase tracking-wider text-slate-300 text-[11px]">
                            Totales / Saldo Disponible Final:
                          </td>
                          <td className="p-3 text-right font-mono font-bold text-emerald-400">
                            +{viewingEmployee.dias_acumulados.toFixed(1)} d
                          </td>
                          <td className="p-3 text-right font-mono font-black text-rose-400">
                            - {viewingEmployee.total_dias_tomados.toFixed(1)} d
                          </td>
                          <td className="p-3 text-right font-mono font-black text-emerald-400 text-sm">
                            {viewingEmployee.saldo_dias_pendientes.toFixed(1)} d
                          </td>
                          <td colSpan={2} className="p-3 text-slate-400 text-[11px] italic">
                            Días hábiles disponibles a la fecha
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
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
