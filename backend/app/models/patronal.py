from sqlalchemy import Column, Integer, Numeric, Boolean, ForeignKey, DateTime
from sqlalchemy.sql import func
from app.db.base_class import Base

class PatronalDetail(Base):
    """
    Registro individual de Aportes y Cargas Patronales por empleado para un mes/año.
    """
    __tablename__ = "patronal_details"
    __table_args__ = {"schema": "tenant"}

    id = Column(Integer, primary_key=True, index=True)
    payroll_id = Column(Integer, nullable=True) # ID de la planilla mensual de sueldos si existe
    employee_id = Column(Integer, nullable=False)
    month = Column(Integer, nullable=False)
    year = Column(Integer, nullable=False)

    total_ganado = Column(Numeric(12, 2), nullable=False, default=0)
    
    # APORTES PATRONALES (17.21%)
    cns = Column(Numeric(12, 2), nullable=False, default=0)      # 10%
    afp = Column(Numeric(12, 2), nullable=False, default=0)      # 1.71% Riesgo Profesional
    fonvi = Column(Numeric(12, 2), nullable=False, default=0)    # 2% Pro-Vivienda
    aps = Column(Numeric(12, 2), nullable=False, default=0)      # 3.5% Aporte Patronal Solidario
    total_aportes = Column(Numeric(12, 2), nullable=False, default=0) # 17.21%

    # PROVISIONES SOCIALES (16.67%)
    provision_aguinaldo = Column(Numeric(12, 2), nullable=False, default=0)   # 8.33% o Total Ganado / 12
    provision_indemnizacion = Column(Numeric(12, 2), nullable=False, default=0) # 8.33% o Total Ganado / 12
    total_provisiones = Column(Numeric(12, 2), nullable=False, default=0)     # 16.67%

    # TOTAL CARGA PATRONAL
    total_carga_patronal = Column(Numeric(12, 2), nullable=False, default=0)  # total_aportes + total_provisiones

    is_customized = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
