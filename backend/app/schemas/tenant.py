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
    nit: Optional[str]
    numero_patronal: Optional[str]
    min_trabajo_id: Optional[str]
    empleador_nombres: Optional[str]
    empleador_apellido_paterno: Optional[str]
    empleador_apellido_materno: Optional[str]
    empleador_ci: Optional[str]
    empleador_nit: Optional[str]
    icon: Optional[str]
    is_active: bool

    class Config:
        from_attributes = True

class TenantDashboardResponse(BaseModel):
    tenant: TenantResponse
    total_employees: int
    total_payrolls: int
    total_departments: int
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
    current_smn: Optional[float] = None
