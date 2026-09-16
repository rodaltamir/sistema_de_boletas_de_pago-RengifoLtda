from pydantic import BaseModel
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
    items: List[AccountingEntryItem]
    subtotal_debe: float = 0.0
    subtotal_haber: float = 0.0

class AccountingSheetData(BaseModel):
    month: int
    year: int
    month_name: str
    tenant_name: str
    caja_banco_name: str = "Caja Moneda Nacional"
    caja_salud_name: str = "Caja Petrolera de Salud"
    fecha_pago_gestora: Optional[str] = ""
    fecha_pago_caja: Optional[str] = ""
    fecha_pago_min_trabajo: Optional[str] = ""
    arancel_min_trabajo: float = 27.00
    sections: List[AccountingSection]
    total_debe: float = 0.0
    total_haber: float = 0.0
    is_cuadrado: bool = True
    diferencia: float = 0.0
    has_payroll: bool = False
    payroll_id: Optional[int] = None
    is_customized: bool = False

class AccountingSheetSaveRequest(BaseModel):
    month: int
    year: int
    caja_banco_name: Optional[str] = "Caja Moneda Nacional"
    caja_salud_name: Optional[str] = "Caja Petrolera de Salud"
    fecha_pago_gestora: Optional[str] = ""
    fecha_pago_caja: Optional[str] = ""
    fecha_pago_min_trabajo: Optional[str] = ""
    sections: List[AccountingSection]
