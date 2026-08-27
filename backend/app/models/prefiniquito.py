from sqlalchemy import Column, Integer, String, Date, Numeric, Boolean, ForeignKey
from sqlalchemy.orm import relationship
from app.db.base_class import Base
from app.models.employee import Employee

class Prefiniquito(Base):
    """
    Tabla privada por tenant (empresa). 
    Guarda el registro y cálculo del prefiniquito de un empleado.
    """
    __tablename__ = "prefiniquitos"
    __table_args__ = {"schema": "tenant"}

    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(Integer, ForeignKey("tenant.employees.id", ondelete="CASCADE"), nullable=False)
    
    fecha_retiro = Column(Date, nullable=False)
    motivo = Column(String(100), nullable=False) # e.g., 'Despido', 'Renuncia Voluntaria'
    
    # Tiempo de trabajo
    anios_trabajados = Column(Integer, default=0)
    meses_trabajados = Column(Integer, default=0)
    dias_trabajados = Column(Integer, default=0)
    
    # Sueldo
    sueldo_promedio = Column(Numeric(12, 2), nullable=False)
    
    # Desglose de Cálculo
    desahucio = Column(Numeric(12, 2), default=0)
    
    # Indemnizacion
    indemnizacion_anios = Column(Numeric(12, 2), default=0)
    indemnizacion_meses = Column(Numeric(12, 2), default=0)
    indemnizacion_dias = Column(Numeric(12, 2), default=0)
    
    # Aguinaldo
    aguinaldo_meses = Column(Numeric(12, 2), default=0)
    aguinaldo_dias = Column(Numeric(12, 2), default=0)
    
    # Vacaciones
    dias_vacacion_pendientes = Column(Integer, default=0)
    vacaciones = Column(Numeric(12, 2), default=0)
    
    # Otros
    otros_pagos = Column(Numeric(12, 2), default=0)
    descuentos = Column(Numeric(12, 2), default=0)
    
    # Multa y Totales
    total_calculo = Column(Numeric(12, 2), default=0)
    multa_30 = Column(Numeric(12, 2), default=0)
    total_final = Column(Numeric(12, 2), default=0)

    # Relación
    employee = relationship("Employee")