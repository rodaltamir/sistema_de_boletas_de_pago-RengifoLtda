from pydantic import BaseModel, ConfigDict
from decimal import Decimal
from typing import List, Optional

class AguinaldoSlipBase(BaseModel):
    haber_basico: Decimal
    bono_antiguedad: Decimal
    bono_produccion: Decimal
    subsidio_frontera: Decimal
    trabajo_extraordinario: Decimal
    pago_dominical: Decimal
    otros_bonos: Decimal
    promedio_total_ganado: Decimal
    meses_trabajados: Decimal
    total_aguinaldo: Decimal

class AguinaldoSlipUpdate(BaseModel):
    haber_basico: Optional[Decimal] = None
    bono_antiguedad: Optional[Decimal] = None
    bono_produccion: Optional[Decimal] = None
    subsidio_frontera: Optional[Decimal] = None
    trabajo_extraordinario: Optional[Decimal] = None
    pago_dominical: Optional[Decimal] = None
    otros_bonos: Optional[Decimal] = None
    meses_trabajados: Optional[Decimal] = None
    total_aguinaldo: Optional[Decimal] = None

class AguinaldoSlipResponse(AguinaldoSlipBase):
    id: int
    aguinaldo_payroll_id: int
    employee_id: int
    employee_code: Optional[str] = None
    employee_ci: Optional[str] = None
    employee_name: str
    employee_nacionalidad: Optional[str] = "BOLIVIANO"
    employee_fecha_nacimiento: Optional[str] = None
    employee_sexo: Optional[str] = "M"
    employee_cargo: Optional[str] = None
    employee_fecha_ingreso: Optional[str] = None
    total_aguinaldo_literal: Optional[str] = None
    is_customized: bool = False

    model_config = ConfigDict(from_attributes=True)

class AguinaldoTotals(BaseModel):
    haber_basico: Decimal = Decimal("0.00")
    bono_antiguedad: Decimal = Decimal("0.00")
    bono_produccion: Decimal = Decimal("0.00")
    subsidio_frontera: Decimal = Decimal("0.00")
    trabajo_extraordinario: Decimal = Decimal("0.00")
    pago_dominical: Decimal = Decimal("0.00")
    otros_bonos: Decimal = Decimal("0.00")
    promedio_total_ganado: Decimal = Decimal("0.00")
    meses_trabajados: Decimal = Decimal("0.00")
    total_aguinaldo: Decimal = Decimal("0.00")

class AguinaldoPayrollResponse(BaseModel):
    id: int
    year: int
    is_closed: bool = False
    tenant_name: str
    tenant_nro_patronal: str
    tenant_nit: str
    tenant_empleador_nombres: Optional[str] = ""
    tenant_empleador_apellido_paterno: Optional[str] = ""
    tenant_empleador_apellido_materno: Optional[str] = ""
    tenant_empleador_ci: Optional[str] = ""
    slips: List[AguinaldoSlipResponse]
    totals: AguinaldoTotals
