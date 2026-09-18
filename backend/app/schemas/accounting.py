from pydantic import BaseModel, Field
from typing import Optional, List, Any

class AccountingEntryItem(BaseModel):
    cuenta: str
    debe: float = 0.0
    haber: float = 0.0
    subcuentas: Optional[List[str]] = None
    tag: Optional[str] = None

class AccountingSection(BaseModel):
    id: str
    title: str
    is_payment: bool = False
    payment_label: Optional[str] = None
    glosa: Optional[str] = None
    items: List[AccountingEntryItem]
    subtotal_debe: float = 0.0
    subtotal_haber: float = 0.0
    voucher_type: str = "Comprobante de Traspaso"
    fecha: Optional[str] = None

class PaymentExtraItem(BaseModel):
    id: Optional[str] = None
    tipo: str = "interes"  # "interes", "actualizacion", "multa"
    concepto: str = ""
    monto: float = 0.0

class GestoraPaymentData(BaseModel):
    fecha: Optional[str] = ""
    nro_transaccion: Optional[str] = ""
    intereses: List[PaymentExtraItem] = Field(default_factory=list)

class CajaPaymentData(BaseModel):
    caja_tipo: str = "Caja Petrolera de Salud"  # "Caja Petrolera de Salud" | "Caja Nacional de Salud"
    fecha: Optional[str] = ""
    nro_transaccion: Optional[str] = ""
    ajustes: List[PaymentExtraItem] = Field(default_factory=list)  # intereses y actualizaciones

class MinTrabajoPaymentData(BaseModel):
    fecha: Optional[str] = ""
    nro_transaccion: Optional[str] = ""
    ajustes: List[PaymentExtraItem] = Field(default_factory=list)  # multas e intereses

class DepartmentPayrollItem(BaseModel):
    id: Optional[int] = None
    nombre: str
    sueldos: float = 0.0
    bono_antiguedad: float = 0.0
    total_depto: float = 0.0

class DevengamientoData(BaseModel):
    departamentos: List[DepartmentPayrollItem] = Field(default_factory=list)
    sueldos_adm: float = 0.0
    bono_antiguedad_adm: float = 0.0
    sueldos_mo: float = 0.0
    bono_antiguedad_mo: float = 0.0
    retenciones_ley: float = 0.0
    sueldos_por_pagar: float = 0.0
    arancel_min_trabajo: float = 27.00
    caja_salud_choice: str = "Caja Petrolera de Salud"
    patronal_gestora: Optional[float] = None
    patronal_caja: Optional[float] = None
    aguinaldo: Optional[float] = None
    indemnizacion: Optional[float] = None

class AccountingSheetData(BaseModel):
    month: int
    year: int
    month_name: str
    tenant_name: str
    caja_banco_name: str = "Caja Moneda Nacional"
    caja_salud_name: str = "Caja Petrolera de Salud"
    arancel_min_trabajo: float = 27.00
    devengamiento: Optional[DevengamientoData] = None
    gestora_payment: GestoraPaymentData = Field(default_factory=GestoraPaymentData)
    caja_payment: CajaPaymentData = Field(default_factory=CajaPaymentData)
    min_trabajo_payment: MinTrabajoPaymentData = Field(default_factory=MinTrabajoPaymentData)
    sections: List[AccountingSection] = Field(default_factory=list)
    total_debe: float = 0.0
    total_haber: float = 0.0
    is_cuadrado: bool = True
    diferencia: float = 0.0
    has_payroll: bool = False
    payroll_id: Optional[int] = None
    is_customized: bool = False
    is_locked_by_date: bool = False
    is_manually_unlocked: bool = False

class AccountingSheetSaveRequest(BaseModel):
    month: int
    year: int
    caja_banco_name: Optional[str] = "Caja Moneda Nacional"
    caja_salud_name: Optional[str] = "Caja Petrolera de Salud"
    arancel_min_trabajo: Optional[float] = 27.00
    devengamiento: Optional[DevengamientoData] = None
    gestora_payment: Optional[GestoraPaymentData] = None
    caja_payment: Optional[CajaPaymentData] = None
    min_trabajo_payment: Optional[MinTrabajoPaymentData] = None
    sections: Optional[List[AccountingSection]] = None
    is_manually_unlocked: Optional[bool] = False

class PaymentInfoSummary(BaseModel):
    fecha: Optional[str] = None
    nro_transaccion: Optional[str] = None
    monto_total: float = 0.0
    glosa: Optional[str] = None
    tipo_entidad: Optional[str] = None

class AccountingMonthHistoryItem(BaseModel):
    month: int
    year: int
    month_name: str
    has_data: bool = False
    is_customized: bool = False
    is_cuadrado: bool = True
    diferencia: float = 0.0
    total_debe: float = 0.0
    total_haber: float = 0.0
    total_ganado: float = 0.0
    patronal_total: float = 0.0
    beneficios_total: float = 0.0
    liquido_pagable: float = 0.0
    retenciones_ley: float = 0.0
    departamentos_count: int = 0
    pago_gestora: Optional[PaymentInfoSummary] = None
    pago_caja: Optional[PaymentInfoSummary] = None
    pago_min_trabajo: Optional[PaymentInfoSummary] = None
    updated_at: Optional[str] = None

class AnnualHistoryResponse(BaseModel):
    year: int
    tenant_name: str
    months: List[AccountingMonthHistoryItem] = Field(default_factory=list)
    total_anual_debe: float = 0.0
    total_anual_haber: float = 0.0
    meses_registrados: int = 0
