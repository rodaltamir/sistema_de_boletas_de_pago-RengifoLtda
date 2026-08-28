from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.db.session import SessionLocal, engine
from app.models.tenant import Tenant
from app.schemas.tenant import TenantCreate, TenantResponse, TenantDashboardResponse, TenantUpdateRequest
from app.db.base_class import Base

router = APIRouter()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@router.post("/", response_model=TenantResponse)
def create_tenant(tenant: TenantCreate, db: Session = Depends(get_db)):
    import re
    # Normalizar el nombre para usarlo como esquema de BD segur0 (solo letras y num minúsculas)
    schema_name = re.sub(r'[^a-z0-9]', '', tenant.name.lower())
    if not schema_name:
        raise HTTPException(status_code=400, detail="El nombre de la empresa no es válido.")
    
    # Verificar si el esquema ya existe para no chocar
    existing = db.query(Tenant).filter(Tenant.schema_name == schema_name).first()
    if existing:
        schema_name = f"{schema_name}_{len(schema_name)}"

    # 1. Crear el registro en la BD Pública
    new_tenant = Tenant(
        name=tenant.name,
        schema_name=schema_name,
        nit=tenant.nit,
        numero_patronal=tenant.numero_patronal,
        min_trabajo_id=tenant.min_trabajo_id,
        empleador_nombres=tenant.empleador_nombres,
        empleador_apellido_paterno=tenant.empleador_apellido_paterno,
        empleador_apellido_materno=tenant.empleador_apellido_materno,
        empleador_ci=tenant.empleador_ci,
        empleador_nit=tenant.empleador_nit,
        icon=tenant.icon,
        logo_base64=tenant.logo_base64
    )
    db.add(new_tenant)
    db.commit()
    db.refresh(new_tenant)

    # 2. Crear el esquema físico en PostgreSQL y generar las tablas
    try:
        with engine.begin() as conn:
            # Crear el esquema
            conn.execute(text(f'CREATE SCHEMA IF NOT EXISTS "{schema_name}"'))
            
            # Aplicar schema_translate_map a la conexión
            conn_with_schema = conn.execution_options(schema_translate_map={"tenant": schema_name})
            
            # Generar las tablas mapeadas al esquema "tenant" dinámicamente
            Base.metadata.create_all(conn_with_schema)
    except Exception as e:
        # Rollback en caso de error
        db.delete(new_tenant)
        db.commit()
        raise HTTPException(status_code=500, detail=f"Error creando entorno de la empresa: {str(e)}")

    return new_tenant

@router.get("/", response_model=list[TenantResponse])
def get_tenants(db: Session = Depends(get_db)):
    return db.query(Tenant).filter(Tenant.is_active == True).all()

from datetime import date
from app.models.global_params import SalarioMinimoNacional
from app.models.employee import Employee

@router.get("/{schema_name}/dashboard", response_model=TenantDashboardResponse)
def get_tenant_dashboard(schema_name: str, db: Session = Depends(get_db)):
    tenant = db.query(Tenant).filter(Tenant.schema_name == schema_name).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Empresa no encontrada")
    
    current_year = date.today().year
    smn_record = db.query(SalarioMinimoNacional).filter(SalarioMinimoNacional.year == current_year).first()
    current_smn = float(smn_record.amount) if smn_record else 3300.0 # Default fallback
    
    # Contar estadisticas en el esquema de esta empresa
    try:
        with engine.connect() as conn:
            res_emp = conn.execute(text(f'SELECT COUNT(*) FROM "{schema_name}".employees WHERE is_active = true'))
            total_employees = res_emp.scalar() or 0
            
            res_payrolls = conn.execute(text(f'SELECT COUNT(*) FROM "{schema_name}".payrolls'))
            total_payrolls = res_payrolls.scalar() or 0
            
            res_depts = conn.execute(text(f'SELECT COUNT(DISTINCT ocupacion) FROM "{schema_name}".employees WHERE is_active = true'))
            total_departments = res_depts.scalar() or 0
    except Exception as e:
        print(f"Error contando estadisticas: {e}")
        total_employees = 0
        total_payrolls = 0
        total_departments = 0

    return {
        "tenant": tenant,
        "total_employees": total_employees,
        "total_payrolls": total_payrolls,
        "total_departments": total_departments,
        "current_smn": current_smn,
        "current_year": current_year
    }

@router.put("/{schema_name}/dashboard", response_model=TenantDashboardResponse)
def update_tenant_dashboard(schema_name: str, data: TenantUpdateRequest, db: Session = Depends(get_db)):
    print("RECEIVED DATA:", data.model_dump())
    tenant = db.query(Tenant).filter(Tenant.schema_name == schema_name).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Empresa no encontrada")
    
    # Actualizar datos de la empresa
    if data.name is not None: tenant.name = data.name
    if data.nit is not None: tenant.nit = data.nit
    if data.numero_patronal is not None: tenant.numero_patronal = data.numero_patronal
    if data.min_trabajo_id is not None: tenant.min_trabajo_id = data.min_trabajo_id
    if data.empleador_nombres is not None: tenant.empleador_nombres = data.empleador_nombres
    if data.empleador_apellido_paterno is not None: tenant.empleador_apellido_paterno = data.empleador_apellido_paterno
    if data.empleador_apellido_materno is not None: tenant.empleador_apellido_materno = data.empleador_apellido_materno
    if data.empleador_ci is not None: tenant.empleador_ci = data.empleador_ci
    if data.empleador_nit is not None: tenant.empleador_nit = data.empleador_nit
    
    # Actualizar SMN global (simulado por ahora para el admin global)
    current_year = date.today().year
    if data.current_smn is not None:
        smn_record = db.query(SalarioMinimoNacional).filter(SalarioMinimoNacional.year == current_year).first()
        if smn_record:
            smn_record.amount = data.current_smn
        else:
            new_smn = SalarioMinimoNacional(year=current_year, amount=data.current_smn, effective_date=date(current_year, 1, 1))
            db.add(new_smn)
            
    db.commit()
    
    return get_tenant_dashboard(schema_name, db)

@router.delete("/{schema_name}")
def delete_tenant(schema_name: str, db: Session = Depends(get_db)):
    tenant = db.query(Tenant).filter(Tenant.schema_name == schema_name).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Empresa no encontrada")
    
    tenant.is_active = False
    db.commit()
    return {"message": "Empresa eliminada logicamente"}

@router.put("/{schema_name}")
def update_tenant(schema_name: str, data: TenantCreate, db: Session = Depends(get_db)):
    tenant = db.query(Tenant).filter(Tenant.schema_name == schema_name).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Empresa no encontrada")
    
    tenant.name = data.name
    tenant.nit = data.nit
    tenant.numero_patronal = data.numero_patronal
    tenant.min_trabajo_id = data.min_trabajo_id
    tenant.empleador_nombres = data.empleador_nombres
    tenant.empleador_apellido_paterno = data.empleador_apellido_paterno
    tenant.empleador_apellido_materno = data.empleador_apellido_materno
    tenant.empleador_ci = data.empleador_ci
    tenant.empleador_nit = data.empleador_nit
    tenant.icon = data.icon
    if data.logo_base64:
        tenant.logo_base64 = data.logo_base64
        
    db.commit()
    db.refresh(tenant)
    return tenant
