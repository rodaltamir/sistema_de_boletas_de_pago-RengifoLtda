import os
import sys
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy import text
from app.db.session import engine
from app.db.base_class import Base
from app.models.tenant import Tenant
from app.db.session import SessionLocal

# Import models so they are in Base.metadata
from app.models.employee import Employee
from app.models.payroll import Payroll, Payslip
from app.models.prefiniquito import Prefiniquito
from app.models.global_params import SalarioMinimoNacional

def fix_existing_tenants():
    db = SessionLocal()
    tenants = db.query(Tenant).all()
    for tenant in tenants:
        schema_name = tenant.schema_name
        print(f"Creating tables for schema: {schema_name}")
        with engine.begin() as conn:
            conn_with_schema = conn.execution_options(schema_translate_map={"tenant": schema_name})
            Base.metadata.create_all(conn_with_schema)
    db.close()
    print("Done")

if __name__ == "__main__":
    fix_existing_tenants()