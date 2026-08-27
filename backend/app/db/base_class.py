from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy import MetaData

# Para el Schema-per-tenant en SQLAlchemy, usamos 'tenant_schema' como comodín
# que será reemplazado en tiempo de ejecución.
POSTGRES_INDEXES_NAMING_CONVENTION = {
    "ix": "%(column_0_label)s_idx",
    "uq": "%(table_name)s_%(column_0_name)s_key",
    "ck": "%(table_name)s_%(constraint_name)s_check",
    "fk": "%(table_name)s_%(column_0_name)s_fkey",
    "pk": "%(table_name)s_pkey",
}

metadata = MetaData(naming_convention=POSTGRES_INDEXES_NAMING_CONVENTION)

Base = declarative_base(metadata=metadata)
