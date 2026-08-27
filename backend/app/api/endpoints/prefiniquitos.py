from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy import text
from app.db.session import SessionLocal, engine
from app.models.employee import Employee
from app.models.prefiniquito import Prefiniquito
from app.schemas.prefiniquito import PrefiniquitoCreate, PrefiniquitoResponse, PrefiniquitoBase
from app.services.prefiniquito_service import calculate_prefiniquito

router = APIRouter()

def get_tenant_db(schema_name: str):
    engine_with_schema = engine.execution_options(schema_translate_map={'tenant': schema_name})
    SessionTenant = sessionmaker(autocommit=False, autoflush=False, bind=engine_with_schema)
    db = SessionTenant()
    try:
        yield db
    finally:
        db.close()

@router.post("/preview")
def preview_prefiniquito(
    schema_name: str,
    data: PrefiniquitoCreate,
    db: Session = Depends(get_tenant_db)
):
    emp = db.query(Employee).filter(Employee.id == data.employee_id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Empleado no encontrado")
        
    sueldo_prom = data.sueldo_promedio
    if not sueldo_prom:
        sueldo_prom = float(emp.haber_basico)

    calc = calculate_prefiniquito(
        fecha_ingreso=emp.fecha_ingreso,
        fecha_retiro=data.fecha_retiro,
        motivo=data.motivo,
        sueldo_promedio=sueldo_prom,
        dias_vacacion_pendientes=data.dias_vacacion_pendientes or 0,
        otros_pagos=data.otros_pagos or 0.0,
        descuentos=data.descuentos or 0.0,
        aplicar_multa=data.aplicar_multa or False
    )
    
    return {
        "employee_id": emp.id,
        "fecha_retiro": data.fecha_retiro,
        "motivo": data.motivo,
        "dias_vacacion_pendientes": data.dias_vacacion_pendientes or 0,
        "otros_pagos": data.otros_pagos or 0.0,
        "descuentos": data.descuentos or 0.0,
        **calc
    }

@router.post("/", response_model=PrefiniquitoResponse)
def create_prefiniquito(
    schema_name: str,
    data: PrefiniquitoCreate,
    db: Session = Depends(get_tenant_db)
):
    preview = preview_prefiniquito(schema_name, data, db)
    
    pref = Prefiniquito(
        employee_id=preview["employee_id"],
        fecha_retiro=preview["fecha_retiro"],
        motivo=preview["motivo"],
        anios_trabajados=preview["anios_trabajados"],
        meses_trabajados=preview["meses_trabajados"],
        dias_trabajados=preview["dias_trabajados"],
        sueldo_promedio=preview["sueldo_promedio"],
        desahucio=preview["desahucio"],
        indemnizacion_anios=preview["indemnizacion_anios"],
        indemnizacion_meses=preview["indemnizacion_meses"],
        indemnizacion_dias=preview["indemnizacion_dias"],
        aguinaldo_meses=preview["aguinaldo_meses"],
        aguinaldo_dias=preview["aguinaldo_dias"],
        dias_vacacion_pendientes=preview["dias_vacacion_pendientes"],
        vacaciones=preview["vacaciones"],
        otros_pagos=preview["otros_pagos"],
        descuentos=preview["descuentos"],
        total_calculo=preview["total_calculo"],
        multa_30=preview["multa_30"],
        total_final=preview["total_final"],
    )
    
    emp = db.query(Employee).filter(Employee.id == data.employee_id).first()
    if emp:
        emp.is_active = False
        db.add(emp)
        
    db.add(pref)
    db.commit()
    db.refresh(pref)
    
    return pref

@router.get("/", response_model=list[PrefiniquitoResponse])
def get_prefiniquitos(
    schema_name: str,
    db: Session = Depends(get_tenant_db)
):
    return db.query(Prefiniquito).all()