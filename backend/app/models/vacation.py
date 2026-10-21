from sqlalchemy import Column, Integer, String, Date, Numeric, Text, ForeignKey, DateTime
from sqlalchemy.sql import func
from app.db.base_class import Base

class VacationRecord(Base):
    """
    Registro individual de vacaciones tomadas por un empleado (A cuenta, Solicitadas, Colectivas).
    """
    __tablename__ = "vacation_records"
    __table_args__ = {"schema": "tenant"}

    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(Integer, ForeignKey("tenant.employees.id"), nullable=False, index=True)
    
    tipo = Column(String(50), nullable=False) # 'a_cuenta' | 'solicitada' | 'colectiva'
    fecha_inicio = Column(Date, nullable=False)
    fecha_fin = Column(Date, nullable=False)
    dias = Column(Numeric(5, 1), nullable=False) # Cantidad de días hábiles computados
    fechas_detalle = Column(Text, nullable=True) # Lista serializada JSON con fechas exactas: '["2026-10-15", ...]'
    
    motivo = Column(String(255), nullable=True) # Motivo o justificación de las vacaciones
    gestion = Column(Integer, nullable=False) # Año de gestión (ej. 2026)
    aprobado_por = Column(String(100), nullable=True) # Responsable o Representante Legal
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
