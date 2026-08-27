from sqlalchemy import Column, Integer, String, Boolean, DateTime
from sqlalchemy.sql import func
from app.db.base_class import Base

class Tenant(Base):
    """
    Tabla pública que registra todas las empresas (Tenants) suscritas al sistema SaaS.
    """
    __tablename__ = "tenants"
    __table_args__ = {"schema": "public"}

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False) # Razón social
    schema_name = Column(String(100), unique=True, index=True, nullable=False) # Nombre del esquema en PostgreSQL
    
    # Datos legales de la empresa
    nit = Column(String(50), nullable=True)
    min_trabajo_id = Column(String(100), nullable=True) # Nº identificador Ministerio de Trabajo
    numero_patronal = Column(String(100), nullable=True) # Nº Caja de Salud
    
    # Datos del Empleador / Representante Legal
    empleador_nombres = Column(String(255), nullable=True)
    empleador_apellido_paterno = Column(String(100), nullable=True)
    empleador_apellido_materno = Column(String(100), nullable=True)
    empleador_ci = Column(String(50), nullable=True)
    empleador_nit = Column(String(50), nullable=True)
    
    # Identidad visual
    icon = Column(String(50), nullable=True)
    logo_base64 = Column(String, nullable=True)
    
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
