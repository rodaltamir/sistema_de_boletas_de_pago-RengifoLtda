from sqlalchemy import Column, Integer, Numeric, Boolean, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.base_class import Base

class EventualPayroll(Base):
    """
    Planilla mensual de eventuales por empresa (Tenant).
    Incluye empleados eventuales y permanentes, permitiendo un haber básico independiente.
    """
    __tablename__ = "eventual_payrolls"
    __table_args__ = {"schema": "tenant"}

    id = Column(Integer, primary_key=True, index=True)
    month = Column(Integer, nullable=False)
    year = Column(Integer, nullable=False)
    is_closed = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    eventual_payslips = relationship("EventualPayslip", back_populates="eventual_payroll", cascade="all, delete-orphan")

    @property
    def payslips(self):
        return self.eventual_payslips


class EventualPayslip(Base):
    """
    Boleta / detalle de la planilla de eventuales por empleado.
    """
    __tablename__ = "eventual_payslips"
    __table_args__ = {"schema": "tenant"}

    id = Column(Integer, primary_key=True, index=True)
    eventual_payroll_id = Column(Integer, ForeignKey("tenant.eventual_payrolls.id"), nullable=False)
    employee_id = Column(Integer, ForeignKey("tenant.employees.id"), nullable=False)
    
    dias_pagados = Column(Integer, default=30)
    horas_pagadas = Column(Numeric(5, 2), default=8)
    
    # INGRESOS
    haber_basico = Column(Numeric(12, 2), nullable=False) # Editable e independiente
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
    is_customized = Column(Boolean, default=False)

    eventual_payroll = relationship("EventualPayroll", back_populates="eventual_payslips")
