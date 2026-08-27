from sqlalchemy import Column, Integer, Numeric, String, Date
from app.db.base_class import Base

class SalarioMinimoNacional(Base):
    """
    Tabla pública que guarda el histórico del Salario Mínimo Nacional (SMN) en Bolivia.
    """
    __tablename__ = "smn_history"
    __table_args__ = {"schema": "public"}

    id = Column(Integer, primary_key=True, index=True)
    year = Column(Integer, unique=True, index=True, nullable=False)
    amount = Column(Numeric(10, 2), nullable=False)
    resolution = Column(String(255), nullable=True) # E.g. "Decreto Supremo N° 4928"
    effective_date = Column(Date, nullable=False)
