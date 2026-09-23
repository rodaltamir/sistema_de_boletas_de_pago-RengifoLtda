from sqlalchemy import Column, Integer, String, Numeric, Boolean, ForeignKey, DateTime
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.db.base_class import Base

class AguinaldoPayroll(Base):
    """
    Planilla Anual de Aguinaldo de Navidad por empresa (Tenant).
    """
    __tablename__ = "aguinaldo_payrolls"
    __table_args__ = {"schema": "tenant"}

    id = Column(Integer, primary_key=True, index=True)
    year = Column(Integer, nullable=False, index=True)
    is_closed = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    slips = relationship("AguinaldoSlip", back_populates="payroll", cascade="all, delete-orphan")


class AguinaldoSlip(Base):
    """
    Detalle de cálculo del Aguinaldo de Navidad por empleado.
    Corresponde a las 19 columnas de la Planilla Oficial del Ministerio de Trabajo.
    """
    __tablename__ = "aguinaldo_slips"
    __table_args__ = {"schema": "tenant"}

    id = Column(Integer, primary_key=True, index=True)
    aguinaldo_payroll_id = Column(Integer, ForeignKey("tenant.aguinaldo_payrolls.id", ondelete="CASCADE"), nullable=False)
    employee_id = Column(Integer, nullable=False)

    # Promedios de los últimos 3 meses (o haberes vigentes)
    haber_basico = Column(Numeric(12, 2), default=0)              # (A) Promedio haber básico
    bono_antiguedad = Column(Numeric(12, 2), default=0)           # (B) Promedio bono de antigüedad
    bono_produccion = Column(Numeric(12, 2), default=0)           # (C) Promedio bono de producción
    subsidio_frontera = Column(Numeric(12, 2), default=0)         # (D) Promedio subsidio de frontera
    trabajo_extraordinario = Column(Numeric(12, 2), default=0)    # (E) Promedio trabajo extraordinario y nocturno
    pago_dominical = Column(Numeric(12, 2), default=0)            # (F) Promedio pago dominical y domingos trabajados
    otros_bonos = Column(Numeric(12, 2), default=0)               # (G) Promedio otros bonos

    # Total ganado promedio (H = A + B + C + D + E + F + G)
    promedio_total_ganado = Column(Numeric(12, 2), default=0)

    # Meses trabajados durante el año (I) (hasta 12 meses)
    meses_trabajados = Column(Numeric(5, 2), default=12)

    # Total ganado después de duodécimas (J = H * I / 12) -> Monto líquido del Aguinaldo
    total_aguinaldo = Column(Numeric(12, 2), default=0)

    is_customized = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    payroll = relationship("AguinaldoPayroll", back_populates="slips")
