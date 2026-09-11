from pydantic import BaseModel
from typing import Optional, List, Any
from datetime import date

class CuotaItem(BaseModel):
    numero: int
    monto: float
    fecha_programada: Optional[str] = None
    fecha_pago: Optional[str] = None
    estado: str = "pendiente" # 'pendiente' | 'pagado'
    comprobante: Optional[str] = None
    observacion: Optional[str] = None

class CuotaPagarRequest(BaseModel):
    fecha_pago: Optional[str] = None
    comprobante: Optional[str] = None
    observacion: Optional[str] = None

class PagoRegistrarRequest(BaseModel):
    monto: float
    fecha_pago: Optional[str] = None
    metodo_pago: Optional[str] = None
    comprobante: Optional[str] = None
    observacion: Optional[str] = None

class EmployeeSimple(BaseModel):
    id: int
    nombres: str
    apellido_paterno: str
    apellido_materno: Optional[str] = None
    documento_identidad: str
    ocupacion: Optional[str] = None
    
    class Config:
        from_attributes = True

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
    tipo_otros_pagos: Optional[str] = "directo"
    otros_pagos_detalle: Optional[str] = None
    cuotas_total: Optional[int] = 1
    cuotas_pagadas: Optional[int] = 0
    monto_cuota: Optional[float] = 0.0
    cuotas_historial: Optional[List[Any]] = []
    
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
    tipo_otros_pagos: Optional[str] = "directo"
    otros_pagos_detalle: Optional[str] = None
    cuotas_total: Optional[int] = 1
    abono_inicial: Optional[float] = 0.0
    comprobante_abono_inicial: Optional[str] = None
    metodo_abono_inicial: Optional[str] = "Efectivo"
    descuentos: Optional[float] = 0.0
    aplicar_multa: Optional[bool] = False

class PrefiniquitoResponse(PrefiniquitoBase):
    id: int
    employee: Optional[EmployeeSimple] = None
    
    class Config:
        from_attributes = True