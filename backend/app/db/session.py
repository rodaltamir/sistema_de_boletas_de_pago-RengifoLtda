from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.core.config import settings

# Engine para esquemas públicos (usuarios globales, listado de empresas)
engine = create_engine(settings.SQLALCHEMY_DATABASE_URI, pool_pre_ping=True)

# Session local estándar
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def get_tenant_session(schema_name: str):
    """
    Crea una sesión apuntando específicamente al esquema de un tenant (empresa).
    Usa schema_translate_map para traducir el esquema comodín al esquema real del cliente.
    """
    # Se recomienda que los modelos tenant-specific tengan __table_args__ = {"schema": "tenant"}
    connectable = engine.execution_options(
        schema_translate_map={"tenant": schema_name}
    )
    TenantSession = sessionmaker(autocommit=False, autoflush=False, bind=connectable)
    return TenantSession()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
