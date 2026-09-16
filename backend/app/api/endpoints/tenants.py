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

@router.post("", response_model=TenantResponse)
@router.post("/", response_model=TenantResponse, include_in_schema=False)
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

@router.get("", response_model=list[TenantResponse])
@router.get("/", response_model=list[TenantResponse], include_in_schema=False)
def get_tenants(db: Session = Depends(get_db)):
    return db.query(Tenant).filter(Tenant.is_active == True).all()

from datetime import date
from app.models.global_params import SalarioMinimoNacional
from app.models.employee import Employee

@router.get("/{schema_name}/dashboard", response_model=TenantDashboardResponse)
@router.get("/{schema_name}/dashboard/", response_model=TenantDashboardResponse, include_in_schema=False)
def get_tenant_dashboard(schema_name: str, db: Session = Depends(get_db)):
    tenant = db.query(Tenant).filter(Tenant.schema_name == schema_name).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Empresa no encontrada")
    
    current_year = date.today().year
    smn_record = db.query(SalarioMinimoNacional).filter(SalarioMinimoNacional.year == current_year).first()
    current_smn = float(smn_record.amount) if smn_record else 3300.0 # Default fallback
    
    # Contar estadisticas en el esquema de esta empresa
    total_employees = 0
    total_desvinculados = 0
    total_payrolls = 0
    total_departments = 0
    total_payroll_base = 0.0
    avg_salary = 0.0
    gender_distribution = {"V": 0, "M": 0}
    top_departments = []
    recent_employees = []
    latest_payroll = None
    total_prefiniquitos = 0

    try:
        with engine.connect() as conn:
            res_emp = conn.execute(text(f'SELECT COUNT(*) FROM "{schema_name}".employees WHERE is_active = true'))
            total_employees = res_emp.scalar() or 0
            
            res_desv = conn.execute(text(f'SELECT COUNT(*) FROM "{schema_name}".employees WHERE is_active = false'))
            total_desvinculados = res_desv.scalar() or 0
            
            res_payrolls = conn.execute(text(f'SELECT COUNT(*) FROM "{schema_name}".payrolls'))
            total_payrolls = res_payrolls.scalar() or 0
            
            res_depts = conn.execute(text(f'SELECT COUNT(DISTINCT ocupacion) FROM "{schema_name}".employees WHERE is_active = true'))
            total_departments = res_depts.scalar() or 0

            # Masa salarial activa
            res_sum = conn.execute(text(f'SELECT COALESCE(SUM(haber_basico), 0), COALESCE(AVG(haber_basico), 0) FROM "{schema_name}".employees WHERE is_active = true')).fetchone()
            if res_sum:
                total_payroll_base = float(res_sum[0] or 0)
                avg_salary = round(float(res_sum[1] or 0), 2)

            # Distribución de género (V: Varón, M: Mujer)
            gender_res = conn.execute(text(f'SELECT UPPER(TRIM(sexo)), COUNT(*) FROM "{schema_name}".employees WHERE is_active = true GROUP BY UPPER(TRIM(sexo))'))
            for g_row in gender_res:
                g_key = g_row[0]
                if g_key in ["V", "M"]:
                    gender_distribution[g_key] = g_row[1]

            # Top cargos
            dept_res = conn.execute(text(f'SELECT ocupacion, COUNT(*) FROM "{schema_name}".employees WHERE is_active = true GROUP BY ocupacion ORDER BY 2 DESC LIMIT 5'))
            top_departments = [{"name": d_row[0] or "Sin Cargo", "count": d_row[1]} for d_row in dept_res]

            # Empleados recientes activos
            emp_recent = conn.execute(text(f'SELECT id, nombres, apellido_paterno, apellido_materno, ocupacion, fecha_ingreso, haber_basico FROM "{schema_name}".employees WHERE is_active = true ORDER BY fecha_ingreso DESC, id DESC LIMIT 4'))
            for r_row in emp_recent:
                full_name = f"{r_row[2] or ''} {r_row[3] or ''} {r_row[1] or ''}".strip().replace("  ", " ").title()
                recent_employees.append({
                    "id": r_row[0],
                    "full_name": full_name,
                    "cargo": (r_row[4] or "Sin cargo").title(),
                    "fecha_ingreso": str(r_row[5]) if r_row[5] else None,
                    "haber_basico": float(r_row[6] or 0)
                })

            # Última planilla generada
            latest_pay_res = conn.execute(text(f'SELECT id, month, year, is_closed FROM "{schema_name}".payrolls ORDER BY year DESC, month DESC LIMIT 1')).fetchone()
            if latest_pay_res:
                p_id = latest_pay_res[0]
                count_slips = conn.execute(text(f'SELECT COUNT(*) FROM "{schema_name}".payslips WHERE payroll_id = {p_id}')).scalar() or 0
                latest_payroll = {
                    "id": latest_pay_res[0],
                    "month": latest_pay_res[1],
                    "year": latest_pay_res[2],
                    "is_closed": bool(latest_pay_res[3]),
                    "payslips_count": count_slips
                }

            # Prefiniquitos
            try:
                res_pref = conn.execute(text(f'SELECT COUNT(*) FROM "{schema_name}".prefiniquitos'))
                total_prefiniquitos = res_pref.scalar() or 0
            except Exception:
                total_prefiniquitos = 0

    except Exception as e:
        print(f"Error contando estadisticas: {e}")

    return {
        "tenant": tenant,
        "total_employees": total_employees,
        "total_desvinculados": total_desvinculados,
        "total_payrolls": total_payrolls,
        "total_departments": total_departments,
        "total_payroll_base": total_payroll_base,
        "avg_salary": avg_salary,
        "gender_distribution": gender_distribution,
        "top_departments": top_departments,
        "recent_employees": recent_employees,
        "latest_payroll": latest_payroll,
        "total_prefiniquitos": total_prefiniquitos,
        "current_smn": current_smn,
        "current_year": current_year
    }

@router.put("/{schema_name}/dashboard", response_model=TenantDashboardResponse)
@router.put("/{schema_name}/dashboard/", response_model=TenantDashboardResponse, include_in_schema=False)
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
    if data.icon is not None: tenant.icon = data.icon
    if data.logo_base64 is not None: tenant.logo_base64 = data.logo_base64
    
    # Actualizar SMN global
    current_year = date.today().year
    if data.current_smn is not None:
        smn_record = db.query(SalarioMinimoNacional).filter(SalarioMinimoNacional.year == current_year).first()
        if smn_record:
            smn_record.amount = data.current_smn
        else:
            new_smn = SalarioMinimoNacional(year=current_year, amount=data.current_smn, effective_date=date(current_year, 1, 1))
            db.add(new_smn)
            
    db.commit()
    db.refresh(tenant)
    
    return get_tenant_dashboard(schema_name, db)

@router.delete("/{schema_name}")
@router.delete("/{schema_name}/", include_in_schema=False)
def delete_tenant(schema_name: str, db: Session = Depends(get_db)):
    tenant = db.query(Tenant).filter(Tenant.schema_name == schema_name).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Empresa no encontrada")
    
    tenant.is_active = False
    db.commit()
    return {"message": "Empresa eliminada logicamente"}

@router.put("/{schema_name}")
@router.put("/{schema_name}/", include_in_schema=False)
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
