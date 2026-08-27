from sqlalchemy import Column, Integer, String, Date, Numeric, Boolean, ForeignKey
from sqlalchemy.orm import relationship
from app.db.base_class import Base

class Payroll(Base):
    """
    Planilla mensual por empresa (Tenant).
    """
    __tablename__ = "payrolls"
    __table_args__ = {"schema": "tenant"}

    id = Column(Integer, primary_key=True, index=True)
    month = Column(Integer, nullable=False)
    year = Column(Integer, nullable=False)
    is_closed = Column(Boolean, default=False)
    
    payslips = relationship("Payslip", back_populates="payroll", cascade="all, delete-orphan")


class Payslip(Base):
    """
    Boleta individual / Detalle de planilla por empleado.
    """
    __tablename__ = "payslips"
    __table_args__ = {"schema": "tenant"}

    id = Column(Integer, primary_key=True, index=True)
    payroll_id = Column(Integer, ForeignKey("tenant.payrolls.id"), nullable=False)
    employee_id = Column(Integer, ForeignKey("tenant.employees.id"), nullable=False)
    
    dias_pagados = Column(Integer, default=30)
    horas_pagadas = Column(Numeric(5, 2), default=240) # 8h * 30d
    
    # INGRESOS
    haber_basico = Column(Numeric(12, 2), nullable=False)
    bono_antiguedad = Column(Numeric(12, 2), default=0)
    bono_produccion = Column(Numeric(12, 2), default=0)
    subsidio_frontera = Column(Numeric(12, 2), default=0)
    trabajo_extraordinario = Column(Numeric(12, 2), default=0)
    pago_dominical = Column(Numeric(12, 2), default=0)
    otros_bonos = Column(Numeric(12, 2), default=0)
    subsidio_natalidad = Column(Numeric(12, 2), default=0)
    
    total_ganado = Column(Numeric(12, 2), nullable=False)
    
    # DESCUENTOS
    aporte_gestora = Column(Numeric(12, 2), nullable=False) # 12.71%
    rc_iva = Column(Numeric(12, 2), default=0)
    anticipos = Column(Numeric(12, 2), default=0)
    otros_descuentos = Column(Numeric(12, 2), default=0)
    
    total_descuentos = Column(Numeric(12, 2), nullable=False)
    
    liquido_pagable = Column(Numeric(12, 2), nullable=False)

    payroll = relationship("Payroll", back_populates="payslips")
    # employee relation can be added if needed
