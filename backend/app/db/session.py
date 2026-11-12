from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from typing import Dict, Generator
from app.core.config import settings

# Engine optimizado para esquemas públicos y multi-tenant
# Incluye pool_pre_ping para reconexión automática, reciclaje de conexiones inactivas y dimensionamiento de pool
engine = create_engine(
    settings.SQLALCHEMY_DATABASE_URI,
    pool_pre_ping=True,
    pool_size=10,
    max_overflow=20,
    pool_recycle=1800,
    pool_timeout=30
)

# Session local estándar para esquemas públicos
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Cache de sessionmaker por schema para evitar instanciación redundante en cada petición HTTP
_tenant_session_factories: Dict[str, sessionmaker] = {}

def get_tenant_session_factory(schema_name: str) -> sessionmaker:
    """
    Retorna (o crea y almacena en caché) la factoría de sesiones específica para un esquema tenant,
    mapeando 'tenant' a dicho esquema mediante schema_translate_map.
    """
    if schema_name not in _tenant_session_factories:
        connectable = engine.execution_options(
            schema_translate_map={"tenant": schema_name}
        )
        _tenant_session_factories[schema_name] = sessionmaker(
            autocommit=False,
            autoflush=False,
            bind=connectable
        )
    return _tenant_session_factories[schema_name]

def get_tenant_session(schema_name: str):
    """
    Crea y retorna una sesión apuntando específicamente al esquema de un tenant.
    Usa la factoría en caché para un rendimiento óptimo.
    """
    factory = get_tenant_session_factory(schema_name)
    return factory()

def get_tenant_db(schema_name: str) -> Generator:
    """
    Generador de dependencia para FastAPI (Depends) que entrega una sesión
    configurada para el tenant y garantiza el cierre seguro al finalizar el request.
    """
    db = get_tenant_session(schema_name)
    try:
        yield db
    finally:
        db.close()

def get_db() -> Generator:
    """
    Generador de dependencia para FastAPI (Depends) que entrega una sesión pública.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
