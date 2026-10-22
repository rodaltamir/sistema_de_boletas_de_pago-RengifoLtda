from pydantic import BaseModel
from typing import Optional, List
from decimal import Decimal

class EventualPayslipBase(BaseModel):
    dias_pagados: int = 30
    horas_pagadas: Decimal = Decimal("8.00")
    haber_basico: Decimal
    bono_antiguedad: Decimal = Decimal("0.00")
    bono_produccion: Decimal = Decimal("0.00")
    subsidio_frontera: Decimal = Decimal("0.00")
    trabajo_extraordinario: Decimal = Decimal("0.00")
    pago_dominical: Decimal = Decimal("0.00")
    otros_bonos: Decimal = Decimal("0.00")
    subsidio_natalidad: Decimal = Decimal("0.00")
    total_ganado: Decimal
    aporte_gestora: Decimal
    rc_iva: Decimal = Decimal("0.00")
    anticipos: Decimal = Decimal("0.00")
    faltas: Decimal = Decimal("0.00")
    otros_descuentos: Decimal = Decimal("0.00")
    total_descuentos: Decimal
    liquido_pagable: Decimal

class EventualPayslipUpdate(BaseModel):
    haber_basico: Optional[Decimal] = None
    dias_pagados: Optional[int] = None
    horas_pagadas: Optional[Decimal] = None
    bono_produccion: Optional[Decimal] = None
    subsidio_frontera: Optional[Decimal] = None
    trabajo_extraordinario: Optional[Decimal] = None
    pago_dominical: Optional[Decimal] = None
    otros_bonos: Optional[Decimal] = None
    subsidio_natalidad: Optional[Decimal] = None
    rc_iva: Optional[Decimal] = None
    anticipos: Optional[Decimal] = None
    faltas: Optional[Decimal] = None
    otros_descuentos: Optional[Decimal] = None

class EventualPayslipResponse(EventualPayslipBase):
    id: int
    eventual_payroll_id: int
    employee_id: int
    is_customized: Optional[bool] = False
    
    employee_code: Optional[str] = None
    employee_name: Optional[str] = None
    employee_ci: Optional[str] = None
    employee_cargo: Optional[str] = None
    employee_fecha_ingreso: Optional[str] = None
    employee_nacionalidad: Optional[str] = None
    employee_fecha_nacimiento: Optional[str] = None
    employee_sexo: Optional[str] = None
    employee_tipo_contrato: Optional[str] = "permanente"
    employee_is_active: Optional[bool] = True

    class Config:
        from_attributes = True

class EventualPayrollBase(BaseModel):
    month: int
    year: int
    is_closed: bool = False

class EventualPayrollResponse(EventualPayrollBase):
    id: int
    tenant_name: Optional[str] = None
    tenant_nro_patronal: Optional[str] = None
    tenant_nit: Optional[str] = None
    tenant_empleador_nombres: Optional[str] = None
    tenant_empleador_apellido_paterno: Optional[str] = None
    tenant_empleador_apellido_materno: Optional[str] = None
    tenant_empleador_ci: Optional[str] = None
    payslips: List[EventualPayslipResponse] = []

    class Config:
        from_attributes = True
