from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text
from sqlalchemy.sql import func
from app.db.base_class import Base

class AccountingRecord(Base):
    """
    Registro y personalización de los Asientos Contables de Nómina por periodo (Mes y Año).
    Almacena tanto los asientos estándar como los ajustes introducidos por el usuario en formato JSON.
    """
    __tablename__ = "accounting_records"
    __table_args__ = {"schema": "tenant"}

    id = Column(Integer, primary_key=True, index=True)
    month = Column(Integer, nullable=False)
    year = Column(Integer, nullable=False)
    payroll_id = Column(Integer, nullable=True)
    caja_banco_name = Column(String(100), default="Caja Moneda Nacional")
    fecha_pago_gestora = Column(String(50), nullable=True)
    fecha_pago_caja = Column(String(50), nullable=True)
    fecha_pago_min_trabajo = Column(String(50), nullable=True)
    data_json = Column(Text, nullable=False)
    is_customized = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), server_default=func.now())
