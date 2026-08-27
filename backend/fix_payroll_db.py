from app.db.session import engine; from app.db.base_class import Base; from app.models.payroll import Payroll, Payslip; from app.models.employee import Employee;
with engine.connect() as conn:
    conn_with_schema = conn.execution_options(schema_translate_map={'tenant': 'rengifoltda'})
    Base.metadata.create_all(conn_with_schema)
    conn.commit()
