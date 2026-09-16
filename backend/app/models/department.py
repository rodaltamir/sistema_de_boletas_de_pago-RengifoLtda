from sqlalchemy import Column, Integer, String, DateTime
from sqlalchemy.sql import func
from app.db.base_class import Base

class Department(Base):
    """
    Departamento u Organización de la Empresa (Tenant).
    Agrupa los cargos y empleados (ej. "Administración", "Producción / Mano de Obra", "Comercial").
    """
    __tablename__ = "departments"
    __table_args__ = {"schema": "tenant"}

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    account_type = Column(String(50), default="MANO_DE_OBRA")  # "ADMINISTRACION" o "MANO_DE_OBRA"
    description = Column(String(255), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
