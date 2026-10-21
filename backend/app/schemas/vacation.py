from pydantic import BaseModel
from typing import Optional, List
from datetime import date
from decimal import Decimal

class VacationRecordCreate(BaseModel):
    employee_id: int
    tipo: str # 'a_cuenta' | 'solicitada' | 'colectiva'
    fecha_inicio: date
    fecha_fin: date
    dias: Decimal
    fechas_detalle: Optional[List[str]] = []
    motivo: Optional[str] = None
    gestion: Optional[int] = None
    aprobado_por: Optional[str] = None

class VacationRecordResponse(BaseModel):
    id: int
    employee_id: int
    employee_name: Optional[str] = None
    tipo: str
    fecha_inicio: date
    fecha_fin: date
    dias: float
    fechas_detalle: Optional[List[str]] = []
    motivo: Optional[str] = None
    gestion: int
    aprobado_por: Optional[str] = None
    created_at: Optional[str] = None

    class Config:
        from_attributes = True

class EmployeeVacationSummary(BaseModel):
    employee_id: int
    employee_code: Optional[str] = None
    employee_name: str
    employee_ci: str
    employee_cargo: str
    fecha_ingreso: str
    antiguedad_anios: int
    antiguedad_meses: int
    antiguedad_dias: int
    antiguedad_formato: str
    escala_dias: int
    dias_acumulados: float
    dias_a_cuenta: float
    dias_solicitadas: float
    dias_colectivas: float
    total_dias_tomados: float
    saldo_dias_pendientes: float
    records: List[VacationRecordResponse] = []

    class Config:
        from_attributes = True

class CompanyVacationSummary(BaseModel):
    tenant_name: str
    tenant_nit: Optional[str] = None
    tenant_nro_patronal: Optional[str] = None
    tenant_empleador: Optional[str] = None
    tenant_empleador_ci: Optional[str] = None
    total_empleados: int
    total_dias_acumulados: float
    total_dias_a_cuenta: float
    total_dias_solicitadas: float
    total_dias_colectivas: float
    total_dias_tomados: float
    total_saldo_pendiente: float
    employees: List[EmployeeVacationSummary] = []
