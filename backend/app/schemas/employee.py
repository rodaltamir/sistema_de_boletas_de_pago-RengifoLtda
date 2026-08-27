from pydantic import BaseModel
from typing import Optional
from datetime import date
from decimal import Decimal

class EmployeeBase(BaseModel):
    internal_code: Optional[str] = None
    documento_identidad: str
    ext_ci: Optional[str] = None
    nombres: str
    apellido_paterno: str
    apellido_materno: Optional[str] = None
    nacionalidad: str = "Boliviana"
    fecha_nacimiento: date
    sexo: str
    ocupacion: str
    fecha_ingreso: date
    haber_basico: Decimal
    is_active: bool = True

class EmployeeCreate(EmployeeBase):
    pass

class EmployeeUpdate(BaseModel):
    internal_code: Optional[str] = None
    documento_identidad: Optional[str] = None
    ext_ci: Optional[str] = None
    nombres: Optional[str] = None
    apellido_paterno: Optional[str] = None
    apellido_materno: Optional[str] = None
    nacionalidad: Optional[str] = None
    fecha_nacimiento: Optional[date] = None
    sexo: Optional[str] = None
    ocupacion: Optional[str] = None
    fecha_ingreso: Optional[date] = None
    haber_basico: Optional[Decimal] = None
    is_active: Optional[bool] = None

class EmployeeResponse(EmployeeBase):
    id: int

    class Config:
        from_attributes = True
