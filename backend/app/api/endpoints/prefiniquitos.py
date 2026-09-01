from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy import text
from app.db.session import SessionLocal, engine
from app.models.employee import Employee
from app.models.prefiniquito import Prefiniquito
from app.schemas.prefiniquito import PrefiniquitoCreate, PrefiniquitoResponse, PrefiniquitoBase
from app.services.prefiniquito_service import calculate_prefiniquito
from app.services.document_service import DocumentService
from app.models.tenant import Tenant
import os

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

@router.post("/export/{format}")
def export_prefiniquito(
    schema_name: str,
    format: str,
    data: PrefiniquitoCreate,
    db: Session = Depends(get_tenant_db)
):
    if format not in ["excel", "pdf", "word"]:
        raise HTTPException(status_code=400, detail="Formato no soportado, use excel, pdf o word")
        
    preview = preview_prefiniquito(schema_name, data, db)
    
    # Get employee details
    emp = db.query(Employee).filter(Employee.id == data.employee_id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Empleado no encontrado")
        
    # Get tenant details using public schema
    engine_public = engine.execution_options(schema_translate_map={'tenant': 'public'})
    SessionPublic = sessionmaker(autocommit=False, autoflush=False, bind=engine_public)
    db_public = SessionPublic()
    tenant = db_public.query(Tenant).filter(Tenant.schema_name == schema_name).first()
    db_public.close()
    
    razon_social = tenant.name if tenant else "EMPRESA"
    
    # Add count parameters from preview or calculate again
    from app.services.prefiniquito_service import calculate_time_worked
    from datetime import date
    import uuid
    inicio_gestion = date(data.fecha_retiro.year, 1, 1)
    inicio_aguinaldo = max(inicio_gestion, emp.fecha_ingreso)
    tiempo_ag = calculate_time_worked(inicio_aguinaldo, data.fecha_retiro)
    
    export_data = {
        "nombre_trabajador": f"{emp.apellido_paterno} {emp.apellido_materno or ''} {emp.nombres}".strip().replace("  ", " "),
        "razon_social": razon_social,
        "fecha_ingreso": emp.fecha_ingreso.strftime("%d de %B de %Y") if hasattr(emp.fecha_ingreso, 'strftime') else str(emp.fecha_ingreso),
        "fecha_retiro": data.fecha_retiro.strftime("%d de %B de %Y") if hasattr(data.fecha_retiro, 'strftime') else str(data.fecha_retiro),
        "anios_trabajados": preview["anios_trabajados"],
        "meses_trabajados": preview["meses_trabajados"],
        "dias_trabajados": preview["dias_trabajados"],
        "sueldo_promedio": preview["sueldo_promedio"],
        "desahucio": preview["desahucio"],
        "indemnizacion_anios": preview["indemnizacion_anios"],
        "indemnizacion_meses": preview["indemnizacion_meses"],
        "indemnizacion_dias": preview["indemnizacion_dias"],
        "aguinaldo_meses": preview["aguinaldo_meses"],
        "aguinaldo_dias": preview["aguinaldo_dias"],
        "aguinaldo_meses_count": tiempo_ag['meses'],
        "aguinaldo_dias_count": tiempo_ag['dias'],
        "dias_vacacion_pendientes": preview["dias_vacacion_pendientes"],
        "vacaciones": preview["vacaciones"],
        "otros_pagos": preview["otros_pagos"],
        "descuentos": preview["descuentos"],
        "total_calculo": preview["total_calculo"],
        "multa_30": preview["multa_30"],
        "total_final": preview["total_final"]
    }
    
    # We use babel for month names if possible, but fallback to naive string replace
    meses_es = {"January": "enero", "February": "febrero", "March": "marzo", "April": "abril", "May": "mayo", "June": "junio", "July": "julio", "August": "agosto", "September": "septiembre", "October": "octubre", "November": "noviembre", "December": "diciembre"}
    for eng, esp in meses_es.items():
        export_data["fecha_ingreso"] = export_data["fecha_ingreso"].replace(eng, esp)
        export_data["fecha_retiro"] = export_data["fecha_retiro"].replace(eng, esp)
        
    if format == "word":
        out_format = "docx"
        filepath = f"prefiniquito_{uuid.uuid4().hex[:8]}.docx"
        template_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "templates", "prefiniquito_template.docx"))
        
        # docxtpl uses jinja2, so we can format currencies here
        format_bs = lambda x: f"{float(x):,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
        export_data["desahucio_bs"] = format_bs(export_data["desahucio"])
        export_data["indemnizacion_anios_bs"] = format_bs(export_data["indemnizacion_anios"])
        export_data["indemnizacion_meses_bs"] = format_bs(export_data["indemnizacion_meses"])
        export_data["indemnizacion_dias_bs"] = format_bs(export_data["indemnizacion_dias"])
        export_data["aguinaldo_meses_bs"] = format_bs(export_data["aguinaldo_meses"])
        export_data["aguinaldo_dias_bs"] = format_bs(export_data["aguinaldo_dias"])
        export_data["vacaciones_bs"] = format_bs(export_data["vacaciones"])
        export_data["otros_pagos_bs"] = format_bs(export_data["otros_pagos"])
        export_data["descuentos_bs"] = format_bs(export_data["descuentos"])
        export_data["total_calculo_bs"] = format_bs(export_data["total_calculo"])
        export_data["multa_30_bs"] = format_bs(export_data["multa_30"])
        export_data["total_final_bs"] = format_bs(export_data["total_final"])
        
        filepath = DocumentService.generate_settlement_word(template_path, export_data, filepath)
    else:
        out_format = "pdf" if format == "pdf" else "xlsx"
        filepath = DocumentService.generate_prefiniquito_excel(export_data, out_format)
    
    filename = f"Prefiniquito_{export_data['nombre_trabajador'].replace(' ', '_')}.{out_format}"
    
    # Use BackgroundTasks to delete the file? FileResponse doesn't delete automatically in old fastapi without background task
    # I'll just return it directly
    if format == "word":
        media_type = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    elif format == "pdf":
        media_type = "application/pdf"
    else:
        media_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        
    return FileResponse(path=filepath, filename=filename, media_type=media_type)