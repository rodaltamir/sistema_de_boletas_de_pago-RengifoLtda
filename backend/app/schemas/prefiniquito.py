from pydantic import BaseModel
from typing import Optional
from datetime import date

class PrefiniquitoBase(BaseModel):
    employee_id: int
    fecha_retiro: date
    motivo: str
    anios_trabajados: int
    meses_trabajados: int
    dias_trabajados: int
    sueldo_promedio: float
    
    # Cálculos desglose
    desahucio: float = 0.0
    indemnizacion_anios: float = 0.0
    indemnizacion_meses: float = 0.0
    indemnizacion_dias: float = 0.0
    aguinaldo_meses: float = 0.0
    aguinaldo_dias: float = 0.0
    
    dias_vacacion_pendientes: int = 0
    vacaciones: float = 0.0
    
    otros_pagos: float = 0.0
    descuentos: float = 0.0
    
    total_calculo: float = 0.0
    multa_30: float = 0.0
    total_final: float = 0.0

class PrefiniquitoCreate(BaseModel):
    employee_id: int
    fecha_retiro: date
    motivo: str
    sueldo_promedio: Optional[float] = None # Si es None, lo calculamos en backend
    dias_vacacion_pendientes: Optional[int] = 0
    otros_pagos: Optional[float] = 0.0
    descuentos: Optional[float] = 0.0
    aplicar_multa: Optional[bool] = False

class PrefiniquitoResponse(PrefiniquitoBase):
    id: int
    
    class Config:
        from_attributes = True