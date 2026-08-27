from sqlalchemy import Column, Integer, String, Date, Numeric, Boolean
from app.db.base_class import Base

class Employee(Base):
    """
    Tabla privada por tenant (empresa). 
    Guarda los datos de los empleados.
    """
    __tablename__ = "employees"
    __table_args__ = {"schema": "tenant"}

    id = Column(Integer, primary_key=True, index=True)
    internal_code = Column(String(50), nullable=True) # Código asignado por la empresa
    documento_identidad = Column(String(50), unique=True, index=True, nullable=False)
    ext_ci = Column(String(20), nullable=True)
    nombres = Column(String(100), nullable=False)
    apellido_paterno = Column(String(100), nullable=False)
    apellido_materno = Column(String(100), nullable=True)
    
    nacionalidad = Column(String(50), default="Boliviana")
    fecha_nacimiento = Column(Date, nullable=False)
    sexo = Column(String(1), nullable=False) # M o V (Mujer/Varón)
    
    ocupacion = Column(String(100), nullable=False) # Cargo
    fecha_ingreso = Column(Date, nullable=False)
    
    haber_basico = Column(Numeric(12, 2), nullable=False) # Sueldo base contratado
    is_active = Column(Boolean, default=True)
