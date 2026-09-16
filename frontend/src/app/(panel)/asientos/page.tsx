"use client";

import React, { useState, useEffect, Suspense } from "react";
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
  Users
} from "lucide-react";
import Swal from "sweetalert2";
import { getApiUrl } from "@/utils/api";

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

interface AccountingEntryItem {
  cuenta: string;
  debe: number;
  haber: number;
  subcuentas?: string[] | null;
  tag?: string | null;
}

interface AccountingSection {
  id: string;
  title: string;
  is_payment: boolean;
  payment_label?: string | null;
  items: AccountingEntryItem[];
  subtotal_debe: number;
  subtotal_haber: number;
}

interface AccountingSheetData {
  month: number;
  year: number;
  month_name: string;
  tenant_name: string;
  caja_banco_name: string;
  caja_salud_name: string;
  fecha_pago_gestora?: string;
  fecha_pago_caja?: string;
  fecha_pago_min_trabajo?: string;
  arancel_min_trabajo: number;
  sections: AccountingSection[];
  total_debe: number;
  total_haber: number;
  is_cuadrado: boolean;
  diferencia: number;
  has_payroll: boolean;
  payroll_id?: number | null;
  is_customized: boolean;
}

function AsientosPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const tenantSchema = searchParams.get("tenant");

  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [sheetData, setSheetData] = useState<AccountingSheetData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [exportingExcel, setExportingExcel] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (!tenantSchema) {
      router.push("/seleccionar-empresa");
      return;
    }
    setIsAdmin(localStorage.getItem("isAdmin") === "true");
    fetchSheet(selectedMonth, selectedYear);
  }, [tenantSchema, selectedMonth, selectedYear]);

  const fetchSheet = async (m: number, y: number) => {
    if (!tenantSchema) return;
    setLoading(true);
    try {
      const res = await fetch(`${getApiUrl()}/api/tenants/${tenantSchema}/asientos/?month=${m}&year=${y}`);
      if (res.ok) {
        const data: AccountingSheetData = await res.json();
        setSheetData(data);
      } else {
        const err = await res.json().catch(() => ({}));
        Swal.fire({
          title: "Aviso",
          text: err.detail || "No se pudo cargar la hoja de asientos.",
          icon: "info",
          confirmButtonColor: "#0d9488"
        });
      }
    } catch (err) {
      console.error("Error al cargar asientos:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleItemChange = (secIdx: number, itemIdx: number, field: "cuenta" | "debe" | "haber", val: any) => {
    if (!sheetData) return;
    const newSections = [...sheetData.sections];
    const sec = { ...newSections[secIdx] };
    const items = [...sec.items];
    const item = { ...items[itemIdx] };

    if (field === "cuenta") {
      item.cuenta = val;
    } else if (field === "debe") {
      item.debe = parseFloat(val) || 0;
    } else if (field === "haber") {
      item.haber = parseFloat(val) || 0;
    }

    items[itemIdx] = item;
    sec.items = items;

    // Recalcular subtotales de la sección
    sec.subtotal_debe = round2(items.reduce((sum, it) => sum + (it.debe || 0), 0));
    sec.subtotal_haber = round2(items.reduce((sum, it) => sum + (it.haber || 0), 0));
    newSections[secIdx] = sec;

    // Recalcular totales generales
    const totDebe = round2(newSections.reduce((sum, s) => sum + s.subtotal_debe, 0));
    const totHaber = round2(newSections.reduce((sum, s) => sum + s.subtotal_haber, 0));
    const dif = round2(Math.abs(totDebe - totHaber));

    setSheetData({
      ...sheetData,
      sections: newSections,
      total_debe: totDebe,
      total_haber: totHaber,
      diferencia: dif,
      is_cuadrado: dif === 0
    });
  };

  const handlePaymentLabelChange = (secIdx: number, newLabel: string) => {
    if (!sheetData) return;
    const newSections = [...sheetData.sections];
    newSections[secIdx] = { ...newSections[secIdx], payment_label: newLabel };
    setSheetData({ ...sheetData, sections: newSections });
  };

  const round2 = (num: number) => {
    return Math.round((num + Number.EPSILON) * 100) / 100;
  };

  const formatBs = (val?: number) => {
    return `Bs. ${(val || 0).toLocaleString("es-BO", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })}`;
  };

  const handleSave = async () => {
    if (!sheetData || !tenantSchema) return;
    setSaving(true);
    try {
      const payload = {
        month: sheetData.month,
        year: sheetData.year,
        caja_banco_name: sheetData.caja_banco_name,
        caja_salud_name: sheetData.caja_salud_name,
        fecha_pago_gestora: sheetData.fecha_pago_gestora,
        fecha_pago_caja: sheetData.fecha_pago_caja,
        fecha_pago_min_trabajo: sheetData.fecha_pago_min_trabajo,
        sections: sheetData.sections
      };

      const res = await fetch(`${getApiUrl()}/api/tenants/${tenantSchema}/asientos/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const updated: AccountingSheetData = await res.json();
        setSheetData(updated);
        setIsEditing(false);
        Swal.fire({
          title: "¡Asientos Guardados!",
          text: "Los comprobantes contables y modificaciones fueron guardados exitosamente.",
          icon: "success",
          timer: 2000,
          showConfirmButton: false
        });
      } else {
        const err = await res.json().catch(() => ({}));
        Swal.fire({
          title: "Error al guardar",
          text: err.detail || "No se pudo guardar la hoja de asientos.",
          icon: "error",
          confirmButtonColor: "#e11d48"
        });
      }
    } catch (err) {
      console.error(err);
      Swal.fire({
        title: "Error de conexión",
        text: "Ocurrió un error al contactar el servidor.",
        icon: "error"
      });
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    const result = await Swal.fire({
      title: "¿Restablecer a valores de planilla?",
      text: "Esto recalculará todas las cuentas automáticamente desde la planilla de sueldos de este mes y descartará ajustes manuales.",
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Sí, restablecer",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#0d9488"
    });

    if (result.isConfirmed) {
      setLoading(true);
      try {
        const res = await fetch(`${getApiUrl()}/api/tenants/${tenantSchema}/asientos/reset?month=${selectedMonth}&year=${selectedYear}`, {
          method: "POST"
        });
        if (res.ok) {
          const freshData = await res.json();
          setSheetData(freshData);
          setIsEditing(false);
          Swal.fire({
            title: "¡Restablecido!",
            text: "Los asientos fueron recalculados desde la nómina original.",
            icon: "success",
            timer: 1800,
            showConfirmButton: false
          });
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
  };

  const handleExportExcel = async () => {
    if (!tenantSchema) return;
    setExportingExcel(true);
    try {
      const url = `${getApiUrl()}/api/tenants/${tenantSchema}/asientos/export/excel?month=${selectedMonth}&year=${selectedYear}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("Error generando Excel");
      const blob = await res.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = `Asientos_${tenantSchema}_${selectedMonth}_${selectedYear}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(downloadUrl);
    } catch (err) {
      console.error(err);
      Swal.fire({
        title: "Error al exportar",
        text: "No se pudo generar el archivo Excel.",
        icon: "error"
      });
    } finally {
      setExportingExcel(false);
    }
  };

  const handleExportPdf = async () => {
    if (!tenantSchema) return;
    setExportingPdf(true);
    try {
      const url = `${getApiUrl()}/api/tenants/${tenantSchema}/asientos/export/pdf?month=${selectedMonth}&year=${selectedYear}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("Error generando PDF");
      const blob = await res.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = `Asientos_${tenantSchema}_${selectedMonth}_${selectedYear}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(downloadUrl);
    } catch (err) {
      console.error(err);
      Swal.fire({
        title: "Error al exportar",
        text: "No se pudo generar el documento PDF.",
        icon: "error"
      });
    } finally {
      setExportingPdf(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8 max-w-7xl mx-auto pb-16"
    >
      {/* 1. CABECERA PRINCIPAL */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-teal-50 text-teal-700 border border-teal-200">
              <BookOpen className="w-3.5 h-3.5 text-teal-600" /> Contabilidad de Nómina
            </span>
            {sheetData?.is_customized && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                Ajustes Personalizados
              </span>
            )}
          </div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">
            Asientos Contables de Nómina
          </h1>
          <p className="text-slate-500 text-sm mt-0.5">
            Comprobantes de devengamiento, cargas sociales patronales, provisiones de beneficios y asientos de pago en caja/bancos.
          </p>
        </div>

        {/* Selectores de Mes y Año */}
        <div className="flex flex-wrap items-center gap-3 bg-white p-2 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-slate-400 ml-2" />
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
              className="text-xs font-bold text-slate-800 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:ring-2 focus:ring-teal-500"
            >
              {MONTHS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>

          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
            className="text-xs font-bold text-slate-800 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:ring-2 focus:ring-teal-500"
          >
            {[2024, 2025, 2026, 2027, 2028].map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>

          <button
            onClick={() => fetchSheet(selectedMonth, selectedYear)}
            disabled={loading}
            className="p-2 text-slate-500 hover:text-teal-600 hover:bg-slate-100 rounded-xl transition"
            title="Actualizar hoja"
          >
            <RotateCcw className={`w-4 h-4 ${loading ? "animate-spin text-teal-600" : ""}`} />
          </button>
        </div>
      </div>

      {/* 2. BARRA DE ESTADO DE CUADRE Y BOTONES DE ACCIÓN */}
      <div className="bg-white p-5 sm:p-6 rounded-3xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-3">
          <div
            className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${
              sheetData?.is_cuadrado
                ? "bg-emerald-50 text-emerald-600 border border-emerald-200"
                : "bg-rose-50 text-rose-600 border border-rose-200"
            }`}
          >
            {sheetData?.is_cuadrado ? (
              <CheckCircle2 className="w-6 h-6" />
            ) : (
              <AlertTriangle className="w-6 h-6" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-slate-900 text-base">
                {sheetData?.is_cuadrado ? "Asientos Cuadrados y Balanceados" : "Atención: Descuadre en Asientos"}
              </h3>
              <span
                className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                  sheetData?.is_cuadrado
                    ? "bg-emerald-100 text-emerald-800"
                    : "bg-rose-100 text-rose-800"
                }`}
              >
                Diferencia: {formatBs(sheetData?.diferencia || 0)}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Total DEBE: <strong>{formatBs(sheetData?.total_debe)}</strong> | Total HABER:{" "}
              <strong>{formatBs(sheetData?.total_haber)}</strong>
            </p>
          </div>
        </div>

        {/* Acciones de Edición y Exportación */}
        <div className="flex flex-wrap items-center gap-2 self-stretch sm:self-auto justify-end">
          {isAdmin && (
            !isEditing ? (
              <button
                onClick={() => setIsEditing(true)}
                className="flex items-center gap-1.5 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-xl text-xs transition border border-slate-200"
              >
                <Edit3 className="w-3.5 h-3.5 text-teal-600" /> Editar Asientos
              </button>
            ) : (
              <>
                <button
                  onClick={() => {
                    setIsEditing(false);
                    fetchSheet(selectedMonth, selectedYear);
                  }}
                  disabled={saving}
                  className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-xl transition"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex items-center gap-1.5 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl text-xs transition shadow-xs"
                >
                  {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  Guardar Cambios
                </button>
              </>
            )
          )}

          {isAdmin && (
            <button
              onClick={handleReset}
              disabled={loading}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl transition"
              title="Recalcular desde la planilla"
            >
              <RotateCcw className="w-3.5 h-3.5 text-slate-500" /> Restablecer a Planilla
            </button>
          )}

          <div className="h-6 w-px bg-slate-200 hidden sm:block" />

          <button
            onClick={handleExportExcel}
            disabled={exportingExcel || loading}
            className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs transition shadow-xs"
          >
            {exportingExcel ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileSpreadsheet className="w-3.5 h-3.5" />}
            Exportar Excel
          </button>

          <button
            onClick={handleExportPdf}
            disabled={exportingPdf || loading}
            className="flex items-center gap-1.5 px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-xl text-xs transition shadow-xs"
          >
            {exportingPdf ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5" />}
            Exportar PDF
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center p-16 gap-3">
          <Loader2 className="w-10 h-10 text-teal-600 animate-spin" />
          <p className="text-slate-500 text-sm font-medium animate-pulse">
            Calculando comprobantes y asientos contables...
          </p>
        </div>
      ) : !sheetData ? (
        <div className="text-center py-12 bg-white rounded-3xl border border-slate-200 text-slate-400">
          No se encontró información contable para el periodo seleccionado.
        </div>
      ) : (
        /* 3. HOJA CONTABLE PRINCIPAL (DISEÑO FIEL AL DOCUMENTO FÍSICO) */
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-md overflow-hidden">
          {/* Header Superior idéntico a la hoja */}
          <div className="border-b border-slate-200 flex flex-col sm:flex-row items-stretch">
            {/* Título de Empresa en Amarillo */}
            <div className="bg-yellow-300 px-6 py-3.5 flex-1 flex items-center justify-center border-b sm:border-b-0 sm:border-r border-slate-300">
              <span className="font-black text-slate-900 text-sm sm:text-base tracking-wider uppercase">
                {sheetData.tenant_name} {sheetData.year}
              </span>
            </div>

            {/* Mes en Azul Centrado */}
            <div className="bg-slate-50 sm:w-64 px-6 py-3.5 flex items-center justify-center">
              <span className="font-black text-blue-900 text-sm sm:text-base tracking-widest uppercase">
                {sheetData.month_name}
              </span>
            </div>
          </div>

          {/* Tabla de Asientos */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-100 text-slate-700 text-xs font-black uppercase tracking-wider border-b border-slate-200">
                  <th className="p-3.5 pl-6">DETALLE DE CUENTAS</th>
                  <th className="p-3.5 w-44 text-right">DEBE</th>
                  <th className="p-3.5 pr-6 w-44 text-right">HABER</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100 text-sm">
                {sheetData.sections.map((section, secIdx) => (
                  <React.Fragment key={section.id}>
                    {/* Encabezado especial para Asientos de Pago (Melón / Peach) */}
                    {section.is_payment && section.payment_label && (
                      <tr className="bg-amber-100/70 border-t border-b border-amber-200">
                        <td colSpan={3} className="p-2.5 px-6">
                          {isEditing ? (
                            <div className="flex items-center gap-2">
                              <span className="text-[11px] font-bold text-amber-900 uppercase">Etiqueta Asiento:</span>
                              <input
                                type="text"
                                value={section.payment_label}
                                onChange={(e) => handlePaymentLabelChange(secIdx, e.target.value)}
                                className="text-xs font-black text-amber-950 bg-white border border-amber-300 rounded-lg px-2.5 py-1 focus:ring-2 focus:ring-teal-500 w-80"
                              />
                            </div>
                          ) : (
                            <span className="font-black text-amber-950 text-xs tracking-wider uppercase">
                              {section.payment_label}
                            </span>
                          )}
                        </td>
                      </tr>
                    )}

                    {/* Filas de Cuentas */}
                    {section.items.map((item, itemIdx) => (
                      <tr key={itemIdx} className="hover:bg-slate-50/70 transition">
                        {/* Columna Detalle */}
                        <td className="p-2.5 pl-6 font-semibold text-slate-800">
                          {isEditing ? (
                            <input
                              type="text"
                              value={item.cuenta}
                              onChange={(e) => handleItemChange(secIdx, itemIdx, "cuenta", e.target.value)}
                              className="w-full text-xs font-semibold text-slate-900 bg-white border border-slate-300 rounded-lg px-2.5 py-1 focus:ring-2 focus:ring-teal-500"
                            />
                          ) : (
                            <div>
                              <span>{item.cuenta}</span>
                              {item.subcuentas && item.subcuentas.length > 0 && (
                                <div className="mt-1 space-y-0.5">
                                  {item.subcuentas.map((sub, sIdx) => (
                                    <p key={sIdx} className="text-[11px] text-slate-400 italic pl-3">
                                      ↳ {sub}
                                    </p>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </td>

                        {/* Columna DEBE */}
                        <td className="p-2.5 text-right font-mono text-xs font-bold text-slate-900">
                          {isEditing ? (
                            <input
                              type="number"
                              step="0.01"
                              value={item.debe || ""}
                              onChange={(e) => handleItemChange(secIdx, itemIdx, "debe", e.target.value)}
                              placeholder="0.00"
                              className="w-full text-right text-xs font-mono font-bold text-slate-900 bg-white border border-slate-300 rounded-lg px-2 py-1 focus:ring-2 focus:ring-teal-500"
                            />
                          ) : (
                            item.debe > 0 ? formatBs(item.debe) : "-"
                          )}
                        </td>

                        {/* Columna HABER */}
                        <td className="p-2.5 pr-6 text-right font-mono text-xs font-bold text-slate-900">
                          {isEditing ? (
                            <input
                              type="number"
                              step="0.01"
                              value={item.haber || ""}
                              onChange={(e) => handleItemChange(secIdx, itemIdx, "haber", e.target.value)}
                              placeholder="0.00"
                              className="w-full text-right text-xs font-mono font-bold text-slate-900 bg-white border border-slate-300 rounded-lg px-2 py-1 focus:ring-2 focus:ring-teal-500"
                            />
                          ) : (
                            item.haber > 0 ? formatBs(item.haber) : "-"
                          )}
                        </td>
                      </tr>
                    ))}

                    {/* Fila Subtotal de la Sección */}
                    <tr className="bg-slate-50/80 font-bold border-t border-b border-slate-200">
                      <td className="p-2 pl-6 text-xs text-slate-500 uppercase tracking-wider">
                        Subtotal {section.title}
                      </td>
                      <td className="p-2 text-right font-mono text-xs font-black text-slate-900 border-t border-slate-300">
                        {formatBs(section.subtotal_debe)}
                      </td>
                      <td className="p-2 pr-6 text-right font-mono text-xs font-black text-slate-900 border-t border-slate-300">
                        {formatBs(section.subtotal_haber)}
                      </td>
                    </tr>
                  </React.Fragment>
                ))}

                {/* FILA FINAL DE TOTALES GENERALES */}
                <tr className="bg-slate-200 font-black text-slate-900 border-t-2 border-b-4 border-slate-900">
                  <td className="p-3.5 pl-6 text-sm tracking-wider uppercase">
                    TOTALES GENERALES
                  </td>
                  <td className="p-3.5 text-right font-mono text-sm tracking-tight text-slate-950 border-t-2 border-slate-900">
                    {formatBs(sheetData.total_debe)}
                  </td>
                  <td className="p-3.5 pr-6 text-right font-mono text-sm tracking-tight text-slate-950 border-t-2 border-slate-900">
                    {formatBs(sheetData.total_haber)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Floating dock when editing */}
      <AnimatePresence>
        {isAdmin && isEditing && (
          <motion.div
            initial={{ opacity: 0, y: 40, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 40, scale: 0.95 }}
            className="fixed bottom-6 inset-x-0 mx-auto max-w-xl px-4 z-50 pointer-events-none"
          >
            <div className="pointer-events-auto bg-slate-900/95 backdrop-blur-md text-white px-5 py-3.5 rounded-2xl shadow-2xl border border-slate-700/80 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-teal-500"></span>
                </span>
                <div>
                  <p className="text-xs font-bold text-white">Modo Edición de Asientos</p>
                  <p className="text-[11px] text-slate-400">
                    {sheetData?.is_cuadrado ? "DEBE y HABER cuadrados" : `Diferencia: ${formatBs(sheetData?.diferencia)}`}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsEditing(false)}
                  disabled={saving}
                  className="px-3.5 py-1.5 text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition border border-slate-700"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold text-slate-950 bg-teal-400 hover:bg-teal-300 rounded-xl transition shadow-lg shadow-teal-500/25"
                >
                  {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  Guardar Cambios
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default function AsientosPage() {
  return (
    <Suspense fallback={<div className="flex justify-center p-12"><div className="w-8 h-8 border-4 border-teal-500 border-t-transparent rounded-full animate-spin"></div></div>}>
      <AsientosPageContent />
    </Suspense>
  );
}
