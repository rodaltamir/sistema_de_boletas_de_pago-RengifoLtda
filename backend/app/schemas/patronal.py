from pydantic import BaseModel, ConfigDict
from decimal import Decimal
from typing import List, Optional

class PatronalDetailBase(BaseModel):
    total_ganado: Decimal
    cns: Decimal
    afp: Decimal
    fonvi: Decimal
    aps: Decimal
    total_aportes: Decimal
    provision_aguinaldo: Decimal
    provision_indemnizacion: Decimal
    total_provisiones: Decimal
    total_carga_patronal: Decimal

class PatronalDetailUpdate(BaseModel):
    provision_aguinaldo: Optional[Decimal] = None
    provision_indemnizacion: Optional[Decimal] = None
    cns: Optional[Decimal] = None
    afp: Optional[Decimal] = None
    fonvi: Optional[Decimal] = None
    aps: Optional[Decimal] = None
    total_ganado: Optional[Decimal] = None

class PatronalDetailResponse(PatronalDetailBase):
    id: int
    employee_id: int
    employee_code: Optional[str] = None
    employee_name: str
    employee_ci: Optional[str] = None
    employee_cargo: Optional[str] = None
    is_customized: bool = False

    model_config = ConfigDict(from_attributes=True)

class PatronalTotals(BaseModel):
    total_ganado: Decimal = Decimal("0.00")
    cns: Decimal = Decimal("0.00")
    afp: Decimal = Decimal("0.00")
    fonvi: Decimal = Decimal("0.00")
    aps: Decimal = Decimal("0.00")
    total_aportes: Decimal = Decimal("0.00")
    provision_aguinaldo: Decimal = Decimal("0.00")
    provision_indemnizacion: Decimal = Decimal("0.00")
    total_provisiones: Decimal = Decimal("0.00")
    total_carga_patronal: Decimal = Decimal("0.00")

class PatronalPayrollResponse(BaseModel):
    month: int
    year: int
    tenant_name: str
    tenant_nro_patronal: str
    tenant_nit: str
    tenant_ciudad: str = "La Paz - Bolivia"
    details: List[PatronalDetailResponse]
    totals: PatronalTotals
