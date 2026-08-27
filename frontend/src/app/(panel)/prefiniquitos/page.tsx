
"use client";

import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Loader2, UserX, FileText, Calculator, Download, CheckCircle } from "lucide-react";

interface Employee {
  id: number;
  nombres: string;
  apellido_paterno: string;
  apellido_materno: string;
  documento_identidad: string;
  fecha_ingreso: string;
  ocupacion: string;
  haber_basico: number;
  is_active: boolean;
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
  descuentos: number;
  total_calculo: number;
  multa_30: number;
  total_final: number;
}

const MOTIVOS = [
  "Despido Intempestivo",
  "Retiro Forzoso",
  "Renuncia Voluntaria",
  "Terminación de Contrato",
  "Acuerdo Mutuo"
];

export default function PrefiniquitosPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const tenantSchema = searchParams.get("tenant");

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Selection and Form
  const [selectedEmpId, setSelectedEmpId] = useState<number | "">("");
  const [fechaRetiro, setFechaRetiro] = useState(new Date().toISOString().split('T')[0]);
  const [motivo, setMotivo] = useState("Renuncia Voluntaria");
  const [sueldoPromedio, setSueldoPromedio] = useState<number | "">("");
  const [diasVacacion, setDiasVacacion] = useState<number>(0);
  const [otrosPagos, setOtrosPagos] = useState<number>(0);
  const [descuentos, setDescuentos] = useState<number>(0);
  const [aplicarMulta, setAplicarMulta] = useState(false);
  
  // Calculation State
  const [calcLoading, setCalcLoading] = useState(false);
  const [calcResult, setCalcResult] = useState<PrefiniquitoCalc | null>(null);
  
  // Process State
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!tenantSchema) return;
    fetch(`http://localhost:8000/api/tenants/${tenantSchema}/employees`)
      .then(r => r.json())
      .then(data => {
        // Solo podemos desvincular empleados activos
        setEmployees(data.filter((e: Employee) => e.is_active));
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [tenantSchema]);

  const selectedEmp = employees.find(e => e.id === Number(selectedEmpId));

  // Sync default sueldo promedio
  useEffect(() => {
    if (selectedEmp) {
      setSueldoPromedio(selectedEmp.haber_basico);
    } else {
      setSueldoPromedio("");
    }
  }, [selectedEmp]);

  const formatBs = (num: number) => {
    return new Intl.NumberFormat('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(num) + ' Bs';
  };

  const handleCalculate = async () => {
    if (!selectedEmpId || !fechaRetiro || sueldoPromedio === "") return;
    setCalcLoading(true);
    setSuccess(false);
    try {
      const res = await fetch(`http://localhost:8000/api/tenants/${tenantSchema}/prefiniquitos/preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employee_id: Number(selectedEmpId),
          fecha_retiro: fechaRetiro,
          motivo,
          sueldo_promedio: Number(sueldoPromedio),
          dias_vacacion_pendientes: diasVacacion,
          otros_pagos: otrosPagos,
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

  const handleFinalize = async () => {
    if (!calcResult || !selectedEmpId) return;
    if (!confirm(`¿Está seguro de generar el Prefiniquito para ${selectedEmp?.nombres}? El empleado pasará a estado INACTIVO.`)) return;
    
    setSaving(true);
    try {
      const res = await fetch(`http://localhost:8000/api/tenants/${tenantSchema}/prefiniquitos/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employee_id: Number(selectedEmpId),
          fecha_retiro: fechaRetiro,
          motivo,
          sueldo_promedio: Number(sueldoPromedio),
          dias_vacacion_pendientes: diasVacacion,
          otros_pagos: otrosPagos,
          descuentos,
          aplicar_multa: aplicarMulta
        })
      });
      
      if (res.ok) {
        setSuccess(true);
        // Remover de la lista
        setEmployees(employees.filter(e => e.id !== Number(selectedEmpId)));
        setSelectedEmpId("");
        setCalcResult(null);
      }
    } catch(e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="flex justify-center p-12"><Loader2 className="w-12 h-12 animate-spin text-teal-600" /></div>;
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 flex items-center gap-2">
            <UserX className="text-rose-600 w-8 h-8" />
            Prefiniquitos y Desvinculaciones
          </h1>
          <p className="text-slate-500 mt-1">Cálculo de beneficios sociales según la Ley General del Trabajo de Bolivia.</p>
        </div>
      </div>

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
                    <option key={emp.id} value={emp.id}>{`${emp.apellido_paterno} ${emp.apellido_materno || ""} ${emp.nombres}`.trim().replace(/  +/g, " ")}</option>
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
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1">Días Vacación</label>
                      <input 
                        type="number" 
                        value={diasVacacion}
                        onChange={e => setDiasVacacion(Number(e.target.value))}
                        className="w-full text-slate-900 border border-slate-300 rounded-xl px-4 py-2.5"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1">Otros Pagos</label>
                      <input 
                        type="number" 
                        value={otrosPagos}
                        onChange={e => setOtrosPagos(Number(e.target.value))}
                        className="w-full text-slate-900 border border-slate-300 rounded-xl px-4 py-2.5"
                      />
                    </div>
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
                    className="w-full mt-4 bg-slate-900 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-slate-800 transition"
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
                <CheckCircle className="w-6 h-6" />
                <div>
                  <h4 className="font-bold">¡Desvinculación Exitosa!</h4>
                  <p className="text-sm">El prefiniquito ha sido guardado y el empleado pasó a estado inactivo.</p>
                </div>
              </motion.div>
            )}

            {calcResult && (
              <motion.div key="calcResult" initial={{opacity:0, scale:0.95}} animate={{opacity:1, scale:1}} exit={{opacity:0}} className="bg-white border border-slate-300 rounded-none shadow-lg max-w-3xl mx-auto overflow-hidden">
                <div className="p-12 text-slate-800 text-sm font-mono space-y-6">
                  {/* HEADER FAKE */}
                  <div className="text-center border-b-2 border-slate-800 pb-4 mb-4">
                    <h2 className="text-xl font-bold tracking-widest">PRELIQUIDACIÓN O PREFINIQUITO</h2>
                    <p className="text-xs text-slate-500 mt-2">BOLIVIA</p>
                  </div>
                  
                  <div className="space-y-1 pb-4 border-b border-slate-300">
                    <div><span className="font-bold">NOMBRE DEL TRABAJADOR:</span> {`${selectedEmp?.apellido_paterno || ""} ${selectedEmp?.apellido_materno || ""} ${selectedEmp?.nombres || ""}`.trim().replace(/  +/g, " ")}</div>
                    <div><span className="font-bold">MOTIVO DE RETIRO:</span> {motivo.toUpperCase()}</div>
                    <div><span className="font-bold">FECHA DE INGRESO:</span> {selectedEmp?.fecha_ingreso}</div>
                    <div><span className="font-bold">FECHA DE RETIRO:</span> {fechaRetiro}</div>
                    <div className="flex gap-4">
                      <span className="font-bold">TIEMPO DE TRABAJO:</span> 
                      <span>Años: {calcResult.anios_trabajados}</span>
                      <span>Meses: {calcResult.meses_trabajados}</span>
                      <span>Días: {calcResult.dias_trabajados}</span>
                    </div>
                    <div><span className="font-bold">SUELDO PROMEDIO (Bs):</span> {formatBs(calcResult.sueldo_promedio)}</div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex justify-between font-bold">
                      <span>DESAHUCIO:</span>
                      <span>{formatBs(calcResult.desahucio)}</span>
                    </div>

                    <div className="flex justify-between font-bold">
                      <span>INDEMNIZACIÓN:</span>
                      <span> </span>
                    </div>
                    <div className="pl-12 flex justify-between">
                      <span>{calcResult.anios_trabajados} Años</span>
                      <span>{formatBs(calcResult.indemnizacion_anios)}</span>
                    </div>
                    <div className="pl-12 flex justify-between">
                      <span>{calcResult.meses_trabajados} Meses</span>
                      <span>{formatBs(calcResult.indemnizacion_meses)}</span>
                    </div>
                    <div className="pl-12 flex justify-between">
                      <span>{calcResult.dias_trabajados} Días</span>
                      <span>{formatBs(calcResult.indemnizacion_dias)}</span>
                    </div>

                    <div className="flex justify-between font-bold mt-4">
                      <span>AGUINALDO (Proporcional):</span>
                      <span> </span>
                    </div>
                    <div className="pl-12 flex justify-between">
                      <span>Meses</span>
                      <span>{formatBs(calcResult.aguinaldo_meses)}</span>
                    </div>
                    <div className="pl-12 flex justify-between">
                      <span>Días</span>
                      <span>{formatBs(calcResult.aguinaldo_dias)}</span>
                    </div>

                    <div className="flex justify-between font-bold mt-4">
                      <span>VACACIONES ({calcResult.dias_vacacion_pendientes} Días):</span>
                      <span>{formatBs(calcResult.vacaciones)}</span>
                    </div>
                    
                    <div className="flex justify-between font-bold mt-4">
                      <span>OTROS PAGOS:</span>
                      <span>{formatBs(calcResult.otros_pagos)}</span>
                    </div>
                    
                    <div className="flex justify-between font-bold mt-4 text-rose-700">
                      <span>DESCUENTOS:</span>
                      <span>{formatBs(calcResult.descuentos)}</span>
                    </div>

                    <div className="border-t border-slate-300 pt-4 mt-4 space-y-2">
                      <div className="flex justify-between font-bold text-base">
                        <span>TOTAL CÁLCULO:</span>
                        <span>{formatBs(calcResult.total_calculo)}</span>
                      </div>
                      {calcResult.multa_30 > 0 && (
                        <div className="flex justify-between font-bold text-rose-700">
                          <span>MULTA 30%:</span>
                          <span>{formatBs(calcResult.multa_30)}</span>
                        </div>
                      )}
                      <div className="flex justify-between font-bold text-xl border-t-2 border-slate-800 pt-2 mt-2">
                        <span>TOTAL FINAL:</span>
                        <span>{formatBs(calcResult.total_final)}</span>
                      </div>
                    </div>

                  </div>
                  
                  <div className="pt-24 flex justify-between items-end border-b border-slate-800 pb-2">
                    <span className="text-xs text-slate-500">Nota: Este cálculo no causa estado.</span>
                    <div className="text-center w-48 border-t border-slate-800 pt-2 font-bold">
                      SELLO Y FIRMA
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
            
            {calcResult && (
              <div className="mt-6 flex justify-end gap-4">
                <button className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700">
                  <Download className="w-4 h-4" /> Excel
                </button>
                <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                  <FileText className="w-4 h-4" /> Word
                </button>
                <button 
                  onClick={handleFinalize}
                  disabled={saving}
                  className="flex items-center gap-2 px-6 py-2 bg-rose-600 text-white font-bold rounded-lg hover:bg-rose-700 ml-4 shadow-lg"
                >
                  {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : "Finalizar y Desvincular"}
                </button>
              </div>
            )}
            
          </AnimatePresence>
          
          {!calcResult && !success && (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 border-2 border-dashed border-slate-200 rounded-2xl p-12">
              <FileText className="w-16 h-16 mb-4 text-slate-300" />
              <p>Selecciona un empleado y haz clic en "Generar Vista Previa"</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
