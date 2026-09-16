from pydantic import BaseModel
from typing import Optional

class TenantCreate(BaseModel):
    name: str
    nit: str
    numero_patronal: str
    min_trabajo_id: str
    empleador_nombres: Optional[str] = None
    empleador_apellido_paterno: Optional[str] = None
    empleador_apellido_materno: Optional[str] = None
    empleador_ci: Optional[str] = None
    empleador_nit: Optional[str] = None
    icon: Optional[str] = "Building2"
    logo_base64: Optional[str] = None

class TenantResponse(BaseModel):
    id: int
    name: str
    schema_name: str
    nit: Optional[str] = None
    numero_patronal: Optional[str] = None
    min_trabajo_id: Optional[str] = None
    empleador_nombres: Optional[str] = None
    empleador_apellido_paterno: Optional[str] = None
    empleador_apellido_materno: Optional[str] = None
    empleador_ci: Optional[str] = None
    empleador_nit: Optional[str] = None
    icon: Optional[str] = "Building2"
    logo_base64: Optional[str] = None
    is_active: bool

    class Config:
        from_attributes = True

class DepartmentStat(BaseModel):
    name: str
    count: int

class RecentEmployeeStat(BaseModel):
    id: int
    full_name: str
    cargo: str
    fecha_ingreso: Optional[str] = None
    haber_basico: float

class LatestPayrollStat(BaseModel):
    id: int
    month: int
    year: int
    is_closed: bool
    payslips_count: int = 0

class TenantDashboardResponse(BaseModel):
    tenant: TenantResponse
    total_employees: int
    total_desvinculados: Optional[int] = 0
    total_payrolls: int
    total_departments: int
    total_payroll_base: Optional[float] = 0.0
    avg_salary: Optional[float] = 0.0
    gender_distribution: Optional[dict[str, int]] = None
    top_departments: Optional[list[DepartmentStat]] = []
    recent_employees: Optional[list[RecentEmployeeStat]] = []
    latest_payroll: Optional[LatestPayrollStat] = None
    total_prefiniquitos: Optional[int] = 0
    current_smn: float
    current_year: int

class TenantUpdateRequest(BaseModel):
    name: Optional[str] = None
    nit: Optional[str] = None
    numero_patronal: Optional[str] = None
    min_trabajo_id: Optional[str] = None
    empleador_nombres: Optional[str] = None
    empleador_apellido_paterno: Optional[str] = None
    empleador_apellido_materno: Optional[str] = None
    empleador_ci: Optional[str] = None
    empleador_nit: Optional[str] = None
    icon: Optional[str] = None
    logo_base64: Optional[str] = None
    current_smn: Optional[float] = None
