from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy import text
from datetime import date, datetime
from typing import Optional
import json
import re

from app.db.session import engine
from app.models.vacation import VacationRecord
from app.models.employee import Employee
from app.schemas.vacation import (
    VacationRecordCreate,
    VacationRecordResponse,
    EmployeeVacationSummary,
    CompanyVacationSummary
)
from app.services.vacation_service import VacationService
from app.services.document_service import DocumentService

router = APIRouter()

def get_tenant_db(schema_name: str):
    engine_with_schema = engine.execution_options(schema_translate_map={"tenant": schema_name})
    SessionTenant = sessionmaker(autocommit=False, autoflush=False, bind=engine_with_schema)
    db = SessionTenant()
    try:
        yield db
    finally:
        db.close()

def sort_code_key(code_val, fallback_id=0):
    if not code_val:
        return (1, fallback_id, "")
    code_str = str(code_val).strip()
    digits = re.findall(r'\d+', code_str)
    if digits:
        return (0, int(digits[0]), code_str)
    return (0, 999999, code_str)

@router.get("/summary", response_model=CompanyVacationSummary)
@router.get("/summary/", response_model=CompanyVacationSummary, include_in_schema=False)
def get_company_vacation_summary(
    schema_name: str, 
    desde: Optional[str] = Query(None), 
    hasta: Optional[str] = Query(None), 
    db: Session = Depends(get_tenant_db)
):
    with engine.connect() as conn:
        result = conn.execute(
            text("SELECT name, numero_patronal, nit, empleador_nombres, empleador_apellido_paterno, empleador_apellido_materno, empleador_ci FROM public.tenants WHERE schema_name = :s").bindparams(s=schema_name)
        ).fetchone()
        t_name = result[0] if result else "Empresa"
        t_patronal = result[1] if result and result[1] else "No asignado"
        t_nit = result[2] if result and result[2] else ""
        t_emp_nombres = result[3] if result and result[3] else ""
        t_emp_paterno = result[4] if result and result[4] else ""
        t_emp_materno = result[5] if result and result[5] else ""
        t_emp_ci = result[6] if result and result[6] else ""
        rep_legal = f"{t_emp_paterno} {t_emp_materno} {t_emp_nombres}".strip() or t_name

    cutoff_date = None
    if hasta and len(hasta) >= 10:
        try:
            cutoff_date = date.fromisoformat(hasta[:10])
        except Exception:
            cutoff_date = None

    employees = db.query(Employee).filter(Employee.is_active == True).all()
    employees = sorted(employees, key=lambda e: sort_code_key(e.internal_code, e.id))

    all_records = db.query(VacationRecord).order_by(VacationRecord.fecha_inicio.desc()).all()
    records_by_emp = {}
    for r in all_records:
        records_by_emp.setdefault(r.employee_id, []).append(r)

    emp_summaries = []
    tot_acumulados = 0.0
    tot_pagados = 0.0
    tot_solicitadas = 0.0
    tot_colectivas = 0.0
    tot_tomados = 0.0
    tot_saldo = 0.0

    for emp in employees:
        calc = VacationService.calculate_accumulated_vacation_days(emp.fecha_ingreso, reference_date=cutoff_date)
        recs = records_by_emp.get(emp.id, [])
        
        pagados = sum(float(r.dias) for r in recs if r.tipo in ("dias_pagados", "a_cuenta"))
        solicitadas = sum(float(r.dias) for r in recs if r.tipo == "solicitada")
        colectivas = sum(float(r.dias) for r in recs if r.tipo == "colectiva")
        tomados = pagados + solicitadas + colectivas
        saldo = calc["dias_acumulados"] - tomados

        tot_acumulados += calc["dias_acumulados"]
        tot_pagados += pagados
        tot_solicitadas += solicitadas
        tot_colectivas += colectivas
        tot_tomados += tomados
        tot_saldo += saldo

        serialized_records = []
        for r in recs:
            fechas = []
            if r.fechas_detalle:
                try:
                    fechas = json.loads(r.fechas_detalle)
                except Exception:
                    fechas = []
            serialized_records.append(VacationRecordResponse(
                id=r.id,
                employee_id=r.employee_id,
                employee_name=f"{emp.apellido_paterno} {emp.apellido_materno or ''} {emp.nombres}".strip().upper(),
                tipo=r.tipo,
                fecha_inicio=r.fecha_inicio,
                fecha_fin=r.fecha_fin,
                dias=float(r.dias),
                fechas_detalle=fechas,
                motivo=r.motivo,
                fecha_solicitud=r.fecha_solicitud,
                gestion=r.gestion,
                aprobado_por=r.aprobado_por,
                created_at=str(r.created_at) if r.created_at else None
            ))

        ext = f" {emp.ext_ci.strip()}" if emp.ext_ci else ""
        emp_summaries.append(EmployeeVacationSummary(
            employee_id=emp.id,
            employee_code=emp.internal_code or str(emp.id),
            employee_name=f"{emp.apellido_paterno} {emp.apellido_materno or ''} {emp.nombres}".strip().upper(),
            employee_ci=f"{emp.documento_identidad.strip()}{ext}".strip(),
            employee_cargo=emp.ocupacion,
            fecha_ingreso=str(emp.fecha_ingreso),
            haber_basico=float(emp.haber_basico or 0.0),
            antiguedad_anios=calc["anios"],
            antiguedad_meses=calc["meses"],
            antiguedad_dias=calc["dias"],
            antiguedad_formato=calc["antiguedad_formato"],
            escala_dias=calc["escala_dias"],
            dias_acumulados=calc["dias_acumulados"],
            dias_a_cuenta=round(pagados, 1),
            dias_pagados=round(pagados, 1),
            dias_solicitadas=round(solicitadas, 1),
            dias_colectivas=round(colectivas, 1),
            total_dias_tomados=round(tomados, 1),
            saldo_dias_pendientes=round(saldo, 1),
            fecha_desde=desde,
            fecha_hasta=hasta,
            records=serialized_records
        ))

    return CompanyVacationSummary(
        tenant_name=t_name,
        tenant_nit=t_nit,
        tenant_nro_patronal=t_patronal,
        tenant_empleador=rep_legal,
        tenant_empleador_ci=t_emp_ci,
        fecha_desde=desde,
        fecha_hasta=hasta,
        total_empleados=len(employees),
        total_dias_acumulados=round(tot_acumulados, 1),
        total_dias_a_cuenta=round(tot_pagados, 1),
        total_dias_pagados=round(tot_pagados, 1),
        total_dias_solicitadas=round(tot_solicitadas, 1),
        total_dias_colectivas=round(tot_colectivas, 1),
        total_dias_tomados=round(tot_tomados, 1),
        total_saldo_pendiente=round(tot_saldo, 1),
        employees=emp_summaries
    )

@router.get("/employee/{employee_id}", response_model=EmployeeVacationSummary)
@router.get("/employee/{employee_id}/", response_model=EmployeeVacationSummary, include_in_schema=False)
def get_employee_vacation_summary(
    schema_name: str, 
    employee_id: int, 
    desde: Optional[str] = Query(None),
    hasta: Optional[str] = Query(None),
    db: Session = Depends(get_tenant_db)
):
    emp = db.query(Employee).filter(Employee.id == employee_id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Empleado no encontrado")
        
    cutoff_date = None
    if hasta and len(hasta) >= 10:
        try:
            cutoff_date = date.fromisoformat(hasta[:10])
        except Exception:
            cutoff_date = None

    calc = VacationService.calculate_accumulated_vacation_days(emp.fecha_ingreso, reference_date=cutoff_date)
    recs = db.query(VacationRecord).filter(VacationRecord.employee_id == employee_id).order_by(VacationRecord.fecha_inicio.desc()).all()
    
    pagados = sum(float(r.dias) for r in recs if r.tipo in ("dias_pagados", "a_cuenta"))
    solicitadas = sum(float(r.dias) for r in recs if r.tipo == "solicitada")
    colectivas = sum(float(r.dias) for r in recs if r.tipo == "colectiva")
    tomados = pagados + solicitadas + colectivas
    saldo = calc["dias_acumulados"] - tomados

    serialized_records = []
    for r in recs:
        fechas = []
        if r.fechas_detalle:
            try:
                fechas = json.loads(r.fechas_detalle)
            except Exception:
                fechas = []
        serialized_records.append(VacationRecordResponse(
            id=r.id,
            employee_id=r.employee_id,
            employee_name=f"{emp.apellido_paterno} {emp.apellido_materno or ''} {emp.nombres}".strip().upper(),
            tipo=r.tipo,
            fecha_inicio=r.fecha_inicio,
            fecha_fin=r.fecha_fin,
            dias=float(r.dias),
            fechas_detalle=fechas,
            motivo=r.motivo,
            fecha_solicitud=r.fecha_solicitud,
            gestion=r.gestion,
            aprobado_por=r.aprobado_por,
            created_at=str(r.created_at) if r.created_at else None
        ))

    ext = f" {emp.ext_ci.strip()}" if emp.ext_ci else ""
    return EmployeeVacationSummary(
        employee_id=emp.id,
        employee_code=emp.internal_code or str(emp.id),
        employee_name=f"{emp.apellido_paterno} {emp.apellido_materno or ''} {emp.nombres}".strip().upper(),
        employee_ci=f"{emp.documento_identidad.strip()}{ext}".strip(),
        employee_cargo=emp.ocupacion,
        fecha_ingreso=str(emp.fecha_ingreso),
        haber_basico=float(emp.haber_basico or 0.0),
        antiguedad_anios=calc["anios"],
        antiguedad_meses=calc["meses"],
        antiguedad_dias=calc["dias"],
        antiguedad_formato=calc["antiguedad_formato"],
        escala_dias=calc["escala_dias"],
        dias_acumulados=calc["dias_acumulados"],
        dias_a_cuenta=round(pagados, 1),
        dias_pagados=round(pagados, 1),
        dias_solicitadas=round(solicitadas, 1),
        dias_colectivas=round(colectivas, 1),
        total_dias_tomados=round(tomados, 1),
        saldo_dias_pendientes=round(saldo, 1),
        fecha_desde=desde,
        fecha_hasta=hasta,
        records=serialized_records
    )

@router.get("/employee/{employee_id}/kardex-detallado")
@router.get("/employee/{employee_id}/kardex-detallado/", include_in_schema=False)
def get_employee_kardex_detallado(
    schema_name: str,
    employee_id: int,
    desde: Optional[str] = Query(None),
    hasta: Optional[str] = Query(None),
    db: Session = Depends(get_tenant_db)
):
    emp = db.query(Employee).filter(Employee.id == employee_id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Empleado no encontrado")

    recs = db.query(VacationRecord).filter(VacationRecord.employee_id == employee_id).all()

    desde_dt = None
    if desde and len(desde) >= 10:
        try:
            desde_dt = date.fromisoformat(desde[:10])
        except Exception:
            pass

    hasta_dt = None
    if hasta and len(hasta) >= 10:
        try:
            hasta_dt = date.fromisoformat(hasta[:10])
        except Exception:
            pass

    return VacationService.build_kardex_detailed_by_month(
        emp.fecha_ingreso,
        recs,
        desde=desde_dt,
        hasta=hasta_dt
    )

@router.post("/record", response_model=VacationRecordResponse)
@router.post("/record/", response_model=VacationRecordResponse, include_in_schema=False)
def create_vacation_record(schema_name: str, payload: VacationRecordCreate, db: Session = Depends(get_tenant_db)):
    emp = db.query(Employee).filter(Employee.id == payload.employee_id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Empleado no encontrado")

    tipo = "dias_pagados" if payload.tipo in ("dias_pagados", "a_cuenta") else payload.tipo
    gestion = payload.gestion or payload.fecha_inicio.year
    fechas_json = json.dumps(payload.fechas_detalle or [])

    new_record = VacationRecord(
        employee_id=payload.employee_id,
        tipo=tipo,
        fecha_inicio=payload.fecha_inicio,
        fecha_fin=payload.fecha_fin,
        dias=payload.dias,
        fechas_detalle=fechas_json,
        motivo=payload.motivo or ("Días de vacación pagados" if tipo == "dias_pagados" else "Vacaciones de personal"),
        fecha_solicitud=payload.fecha_solicitud,
        gestion=gestion,
        aprobado_por=payload.aprobado_por
    )
    db.add(new_record)
    db.commit()
    db.refresh(new_record)

    return VacationRecordResponse(
        id=new_record.id,
        employee_id=new_record.employee_id,
        employee_name=f"{emp.apellido_paterno} {emp.apellido_materno or ''} {emp.nombres}".strip().upper(),
        tipo=new_record.tipo,
        fecha_inicio=new_record.fecha_inicio,
        fecha_fin=new_record.fecha_fin,
        dias=float(new_record.dias),
        fechas_detalle=payload.fechas_detalle or [],
        motivo=new_record.motivo,
        fecha_solicitud=new_record.fecha_solicitud,
        gestion=new_record.gestion,
        aprobado_por=new_record.aprobado_por,
        created_at=str(new_record.created_at) if new_record.created_at else None
    )

@router.put("/record/{record_id}", response_model=VacationRecordResponse)
@router.put("/record/{record_id}/", response_model=VacationRecordResponse, include_in_schema=False)
def update_vacation_record(
    schema_name: str,
    record_id: int,
    payload: VacationRecordCreate,
    db: Session = Depends(get_tenant_db)
):
    record = db.query(VacationRecord).filter(VacationRecord.id == record_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Registro de vacación no encontrado")

    emp = db.query(Employee).filter(Employee.id == payload.employee_id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Empleado no encontrado")

    tipo = "dias_pagados" if payload.tipo in ("dias_pagados", "a_cuenta") else payload.tipo
    gestion = payload.gestion or payload.fecha_inicio.year
    fechas_json = json.dumps(payload.fechas_detalle or [])

    record.employee_id = payload.employee_id
    record.tipo = tipo
    record.fecha_inicio = payload.fecha_inicio
    record.fecha_fin = payload.fecha_fin
    record.dias = payload.dias
    record.fechas_detalle = fechas_json
    record.motivo = payload.motivo or ("Días de vacación pagados" if tipo == "dias_pagados" else "Vacaciones de personal")
    record.fecha_solicitud = payload.fecha_solicitud
    record.gestion = gestion
    if payload.aprobado_por is not None:
        record.aprobado_por = payload.aprobado_por

    db.commit()
    db.refresh(record)

    fechas = []
    if record.fechas_detalle:
        try:
            fechas = json.loads(record.fechas_detalle)
        except Exception:
            fechas = []

    return VacationRecordResponse(
        id=record.id,
        employee_id=record.employee_id,
        employee_name=f"{emp.apellido_paterno} {emp.apellido_materno or ''} {emp.nombres}".strip().upper(),
        tipo=record.tipo,
        fecha_inicio=record.fecha_inicio,
        fecha_fin=record.fecha_fin,
        dias=float(record.dias),
        fechas_detalle=fechas,
        motivo=record.motivo,
        fecha_solicitud=record.fecha_solicitud,
        gestion=record.gestion,
        aprobado_por=record.aprobado_por,
        created_at=str(record.created_at) if record.created_at else None
    )

@router.delete("/record/{record_id}")
@router.delete("/record/{record_id}/", include_in_schema=False)
def delete_vacation_record(schema_name: str, record_id: int, db: Session = Depends(get_tenant_db)):
    record = db.query(VacationRecord).filter(VacationRecord.id == record_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Registro de vacación no encontrado")
    
    db.delete(record)
    db.commit()
    return {"message": "Registro de vacación eliminado exitosamente"}

@router.get("/export/company/excel")
@router.get("/export/company/excel/", include_in_schema=False)
def export_company_vacation_excel(
    schema_name: str, 
    desde: Optional[str] = Query(None), 
    hasta: Optional[str] = Query(None), 
    db: Session = Depends(get_tenant_db)
):
    summary = get_company_vacation_summary(schema_name=schema_name, desde=desde, hasta=hasta, db=db)
    file_path = DocumentService.generate_company_vacations_excel(
        summary.model_dump(), 
        output_format="xlsx", 
        schema_name=schema_name,
        desde=desde,
        hasta=hasta
    )
    empresa_slug = DocumentService._slugify(schema_name)
    now_str = datetime.now().strftime("%d-%m-%Y")
    filename = f"control_vacaciones_{empresa_slug}_{now_str}.xlsx"
    return FileResponse(path=file_path, filename=filename, media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")

@router.get("/export/company/pdf")
@router.get("/export/company/pdf/", include_in_schema=False)
def export_company_vacation_pdf(
    schema_name: str, 
    desde: Optional[str] = Query(None), 
    hasta: Optional[str] = Query(None), 
    db: Session = Depends(get_tenant_db)
):
    summary = get_company_vacation_summary(schema_name=schema_name, desde=desde, hasta=hasta, db=db)
    file_path = DocumentService.generate_company_vacations_excel(
        summary.model_dump(), 
        output_format="pdf", 
        schema_name=schema_name,
        desde=desde,
        hasta=hasta
    )
    empresa_slug = DocumentService._slugify(schema_name)
    now_str = datetime.now().strftime("%d-%m-%Y")
    filename = f"control_vacaciones_{empresa_slug}_{now_str}.pdf"
    return FileResponse(path=file_path, filename=filename, media_type="application/pdf")

@router.get("/export/employee/{employee_id}/excel")
@router.get("/export/employee/{employee_id}/excel/", include_in_schema=False)
def export_employee_vacation_excel(
    schema_name: str, 
    employee_id: int, 
    desde: Optional[str] = Query(None), 
    hasta: Optional[str] = Query(None), 
    db: Session = Depends(get_tenant_db)
):
    emp_summary = get_employee_vacation_summary(schema_name=schema_name, employee_id=employee_id, desde=desde, hasta=hasta, db=db)
    with engine.connect() as conn:
        result = conn.execute(
            text("SELECT name, numero_patronal, nit, empleador_nombres, empleador_apellido_paterno, empleador_apellido_materno, empleador_ci FROM public.tenants WHERE schema_name = :s").bindparams(s=schema_name)
        ).fetchone()
        t_name = result[0] if result else "Empresa"
        t_nit = result[2] if result and result[2] else ""
        t_emp_nombres = result[3] if result and result[3] else ""
        t_emp_paterno = result[4] if result and result[4] else ""
        t_emp_materno = result[5] if result and result[5] else ""
        t_emp_ci = result[6] if result and result[6] else ""
        rep_legal = f"{t_emp_paterno} {t_emp_materno} {t_emp_nombres}".strip() or t_name

    payload = {
        "empresa_nombre": t_name,
        "empresa_nit": t_nit,
        "representante_legal": rep_legal,
        "ci_representante": t_emp_ci,
        "employee": emp_summary.model_dump()
    }

    file_path = DocumentService.generate_employee_vacation_excel(
        payload, 
        output_format="xlsx", 
        schema_name=schema_name,
        desde=desde,
        hasta=hasta
    )
    empresa_slug = DocumentService._slugify(schema_name)
    emp_slug = DocumentService._slugify(emp_summary.employee_name)
    now_str = datetime.now().strftime("%d-%m-%Y")
    filename = f"ficha_vacaciones_{emp_slug}_{empresa_slug}_{now_str}.xlsx"
    return FileResponse(path=file_path, filename=filename, media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")

@router.get("/export/employee/{employee_id}/pdf")
@router.get("/export/employee/{employee_id}/pdf/", include_in_schema=False)
def export_employee_vacation_pdf(
    schema_name: str, 
    employee_id: int, 
    desde: Optional[str] = Query(None), 
    hasta: Optional[str] = Query(None), 
    db: Session = Depends(get_tenant_db)
):
    emp_summary = get_employee_vacation_summary(schema_name=schema_name, employee_id=employee_id, desde=desde, hasta=hasta, db=db)
    with engine.connect() as conn:
        result = conn.execute(
            text("SELECT name, numero_patronal, nit, empleador_nombres, empleador_apellido_paterno, empleador_apellido_materno, empleador_ci FROM public.tenants WHERE schema_name = :s").bindparams(s=schema_name)
        ).fetchone()
        t_name = result[0] if result else "Empresa"
        t_nit = result[2] if result and result[2] else ""
        t_emp_nombres = result[3] if result and result[3] else ""
        t_emp_paterno = result[4] if result and result[4] else ""
        t_emp_materno = result[5] if result and result[5] else ""
        t_emp_ci = result[6] if result and result[6] else ""
        rep_legal = f"{t_emp_paterno} {t_emp_materno} {t_emp_nombres}".strip() or t_name

    payload = {
        "empresa_nombre": t_name,
        "empresa_nit": t_nit,
        "representante_legal": rep_legal,
        "ci_representante": t_emp_ci,
        "employee": emp_summary.model_dump()
    }

    file_path = DocumentService.generate_employee_vacation_excel(
        payload, 
        output_format="pdf", 
        schema_name=schema_name,
        desde=desde,
        hasta=hasta
    )
    empresa_slug = DocumentService._slugify(schema_name)
    emp_slug = DocumentService._slugify(emp_summary.employee_name)
    now_str = datetime.now().strftime("%d-%m-%Y")
    filename = f"ficha_vacaciones_{emp_slug}_{empresa_slug}_{now_str}.pdf"
    return FileResponse(path=file_path, filename=filename, media_type="application/pdf")

@router.get("/recibo-pago/{employee_id}/{format}")
@router.get("/recibo-pago/{employee_id}/{format}/", include_in_schema=False)
def export_recibo_pago_vacaciones(
    schema_name: str,
    employee_id: int,
    format: str,
    record_id: Optional[int] = Query(None),
    dias: Optional[float] = Query(None),
    total_ganado: Optional[float] = Query(None),
    recibo_nro: Optional[str] = Query("001"),
    lugar_fecha: Optional[str] = Query(None),
    empleador_nombre: Optional[str] = Query(None),
    empleador_rol: Optional[str] = Query("propietario"),
    empleador_ci: Optional[str] = Query(None),
    firmas_en_blanco: Optional[bool] = Query(True),
    db: Session = Depends(get_tenant_db)
):
    emp = db.query(Employee).filter(Employee.id == employee_id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Empleado no encontrado")

    with engine.connect() as conn:
        result = conn.execute(
            text("SELECT name, nit, empleador_nombres, empleador_apellido_paterno, empleador_apellido_materno, empleador_ci FROM public.tenants WHERE schema_name = :s").bindparams(s=schema_name)
        ).fetchone()
        t_name = result[0] if result else "Empresa"
        t_nit = result[1] if result and result[1] else ""
        t_emp_nombres = result[2] if result and result[2] else ""
        t_emp_paterno = result[3] if result and result[3] else ""
        t_emp_materno = result[4] if result and result[4] else ""
        t_emp_ci = result[5] if result and result[5] else ""
        rep_legal = f"{t_emp_paterno} {t_emp_materno} {t_emp_nombres}".strip() or t_name

    rec = None
    if record_id:
        rec = db.query(VacationRecord).filter(VacationRecord.id == record_id).first()

    if dias is not None:
        effective_dias = dias
    elif rec:
        effective_dias = float(rec.dias)
    else:
        recs_pagados = db.query(VacationRecord).filter(
            VacationRecord.employee_id == employee_id,
            VacationRecord.tipo.in_(["dias_pagados", "a_cuenta"])
        ).all()
        effective_dias = sum(float(r.dias) for r in recs_pagados) if recs_pagados else 0.0

    tg = total_ganado if (total_ganado is not None and total_ganado > 0) else float(emp.haber_basico or 0.0)
    sd = tg / 30.0 if tg > 0 else 0.0
    importe = sd * effective_dias

    ext = f" {emp.ext_ci.strip()}" if emp.ext_ci else ""
    trabajador_ci = f"{emp.documento_identidad.strip()}{ext}".strip()
    trabajador_nombre = f"{emp.apellido_paterno} {emp.apellido_materno or ''} {emp.nombres}".strip().upper()

    final_empleador_nombre = empleador_nombre or rep_legal
    final_empleador_ci = empleador_ci or t_emp_ci
    final_empleador_rol = empleador_rol or "propietario"

    payload = {
        "empresa_nombre": t_name,
        "empresa_nit": t_nit,
        "recibo_nro": recibo_nro or "001",
        "trabajador_nombre": trabajador_nombre,
        "trabajador_ci": trabajador_ci,
        "trabajador_cargo": emp.ocupacion,
        "empleador_nombre": final_empleador_nombre,
        "empleador_rol": final_empleador_rol,
        "empleador_ci": final_empleador_ci,
        "total_ganado": tg,
        "salario_diario": sd,
        "dias_pagados": effective_dias,
        "importe_cancelado": importe,
        "lugar_fecha": lugar_fecha or "",
        "firmas_en_blanco": firmas_en_blanco
    }

    out_fmt = "xlsx" if format.lower() == "excel" else "pdf"
    file_path = DocumentService.generate_vacation_payment_receipt_excel(
        payload,
        output_format=out_fmt,
        schema_name=schema_name
    )

    emp_slug = DocumentService._slugify(trabajador_nombre)
    empresa_slug = DocumentService._slugify(schema_name)
    now_str = datetime.now().strftime("%d-%m-%Y")
    
    if out_fmt == "xlsx":
        filename = f"recibo_vacaciones_{emp_slug}_{empresa_slug}_{now_str}.xlsx"
        return FileResponse(path=file_path, filename=filename, media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
    else:
        filename = f"recibo_vacaciones_{emp_slug}_{empresa_slug}_{now_str}.pdf"
        return FileResponse(path=file_path, filename=filename, media_type="application/pdf")

@router.get("/ficha-solicitadas/{employee_id}/{format}")
@router.get("/ficha-solicitadas/{employee_id}/{format}/", include_in_schema=False)
def export_ficha_vacaciones_solicitadas(
    schema_name: str,
    employee_id: int,
    format: str,
    tipo: Optional[str] = Query("todas"),
    record_ids: Optional[str] = Query(None),
    observaciones: Optional[str] = Query(None),
    responsable_nombre: Optional[str] = Query(None),
    fecha: Optional[str] = Query(None),
    firmas_en_blanco: Optional[bool] = Query(True),
    db: Session = Depends(get_tenant_db)
):
    emp = db.query(Employee).filter(Employee.id == employee_id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Empleado no encontrado")

    with engine.connect() as conn:
        result = conn.execute(
            text("SELECT name, nit, empleador_nombres, empleador_apellido_paterno, empleador_apellido_materno, empleador_ci FROM public.tenants WHERE schema_name = :s").bindparams(s=schema_name)
        ).fetchone()
        t_name = result[0] if result else "Empresa"
        t_nit = result[1] if result and result[1] else ""
        t_emp_nombres = result[2] if result and result[2] else ""
        t_emp_paterno = result[3] if result and result[3] else ""
        t_emp_materno = result[4] if result and result[4] else ""
        t_emp_ci = result[5] if result and result[5] else ""
        rep_legal = f"{t_emp_paterno} {t_emp_materno} {t_emp_nombres}".strip() or t_name

    query = db.query(VacationRecord).filter(VacationRecord.employee_id == employee_id)

    if record_ids:
        try:
            ids = [int(x.strip()) for x in record_ids.split(",") if x.strip()]
            query = query.filter(VacationRecord.id.in_(ids))
        except Exception:
            pass
    elif tipo and tipo != "todas":
        query = query.filter(VacationRecord.tipo == tipo)
    else:
        query = query.filter(VacationRecord.tipo.in_(["solicitada", "colectiva"]))

    recs = query.order_by(VacationRecord.fecha_inicio.asc()).all()

    ext = f" {emp.ext_ci.strip()}" if emp.ext_ci else ""
    trabajador_ci = f"{emp.documento_identidad.strip()}{ext}".strip()
    trabajador_nombre = f"{emp.apellido_paterno} {emp.apellido_materno or ''} {emp.nombres}".strip().upper()

    serialized_records = []
    for r in recs:
        serialized_records.append({
            "id": r.id,
            "tipo": r.tipo,
            "fecha_inicio": str(r.fecha_inicio),
            "fecha_fin": str(r.fecha_fin),
            "dias": float(r.dias),
            "motivo": r.motivo or ("Vacación Solicitada" if r.tipo == "solicitada" else "Vacación Colectiva"),
            "fecha_solicitud": str(r.fecha_solicitud) if r.fecha_solicitud else ""
        })

    tipo_doc_label = "SOLICITADAS - COLECTIVAS"
    if tipo == "solicitada":
        tipo_doc_label = "SOLICITADAS"
    elif tipo == "colectiva":
        tipo_doc_label = "COLECTIVAS"

    payload = {
        "empresa_nombre": t_name,
        "empresa_nit": t_nit,
        "trabajador_nombre": trabajador_nombre,
        "trabajador_cargo": emp.ocupacion,
        "trabajador_ci": trabajador_ci,
        "fecha_ingreso": str(emp.fecha_ingreso),
        "tipo_doc": tipo_doc_label,
        "records": serialized_records,
        "observaciones": observaciones or "",
        "responsable_nombre": responsable_nombre or rep_legal,
        "fecha": fecha or datetime.now().strftime("%d/%m/%Y"),
        "firmas_en_blanco": firmas_en_blanco
    }

    out_fmt = "xlsx" if format.lower() == "excel" else "pdf"
    file_path = DocumentService.generate_vacation_solicitadas_colectivas_excel(
        payload,
        output_format=out_fmt,
        schema_name=schema_name
    )

    emp_slug = DocumentService._slugify(trabajador_nombre)
    empresa_slug = DocumentService._slugify(schema_name)
    now_str = datetime.now().strftime("%d-%m-%Y")

    if out_fmt == "xlsx":
        filename = f"ficha_vacaciones_{emp_slug}_{empresa_slug}_{now_str}.xlsx"
        return FileResponse(path=file_path, filename=filename, media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
    else:
        filename = f"ficha_vacaciones_{emp_slug}_{empresa_slug}_{now_str}.pdf"
        return FileResponse(path=file_path, filename=filename, media_type="application/pdf")

@router.get("/export/lote/recibos-pago/{format}")
@router.get("/export/lote/recibos-pago/{format}/", include_in_schema=False)
def export_lote_recibos_pago_vacaciones(
    schema_name: str,
    format: str,
    lugar_fecha: Optional[str] = Query(None),
    empleador_nombre: Optional[str] = Query(None),
    empleador_rol: Optional[str] = Query("propietario"),
    empleador_ci: Optional[str] = Query(None),
    firmas_en_blanco: Optional[bool] = Query(True),
    solo_con_pagos: Optional[bool] = Query(True),
    db: Session = Depends(get_tenant_db)
):
    with engine.connect() as conn:
        result = conn.execute(
            text("SELECT name, nit, empleador_nombres, empleador_apellido_paterno, empleador_apellido_materno, empleador_ci FROM public.tenants WHERE schema_name = :s").bindparams(s=schema_name)
        ).fetchone()
        t_name = result[0] if result else "Empresa"
        t_nit = result[1] if result and result[1] else ""
        t_emp_nombres = result[2] if result and result[2] else ""
        t_emp_paterno = result[3] if result and result[3] else ""
        t_emp_materno = result[4] if result and result[4] else ""
        t_emp_ci = result[5] if result and result[5] else ""
        rep_legal = f"{t_emp_paterno} {t_emp_materno} {t_emp_nombres}".strip() or t_name

    final_empleador_nombre = empleador_nombre or rep_legal
    final_empleador_ci = empleador_ci or t_emp_ci
    final_empleador_rol = empleador_rol or "propietario"

    employees = db.query(Employee).filter(Employee.is_active == True).all()
    employees = sorted(employees, key=lambda e: sort_code_key(e.internal_code, e.id))

    all_paid_records = db.query(VacationRecord).filter(
        VacationRecord.tipo.in_(["dias_pagados", "a_cuenta"])
    ).order_by(VacationRecord.fecha_inicio.asc()).all()

    paid_by_emp = {}
    for r in all_paid_records:
        paid_by_emp.setdefault(r.employee_id, []).append(r)

    receipts_list = []
    receipt_idx = 1
    for emp in employees:
        emp_paid_recs = paid_by_emp.get(emp.id, [])
        effective_dias = sum(float(r.dias) for r in emp_paid_recs)

        if solo_con_pagos and effective_dias <= 0:
            continue

        tg = float(emp.haber_basico or 0.0)
        sd = tg / 30.0 if tg > 0 else 0.0
        importe = sd * effective_dias

        ext = f" {emp.ext_ci.strip()}" if emp.ext_ci else ""
        trabajador_ci = f"{emp.documento_identidad.strip()}{ext}".strip()
        trabajador_nombre = f"{emp.apellido_paterno} {emp.apellido_materno or ''} {emp.nombres}".strip().upper()

        recibo_nro_str = f"{receipt_idx:04d}"
        receipt_idx += 1

        receipts_list.append({
            "empresa_nombre": t_name,
            "empresa_nit": t_nit,
            "recibo_nro": recibo_nro_str,
            "trabajador_nombre": trabajador_nombre,
            "trabajador_ci": trabajador_ci,
            "trabajador_cargo": emp.ocupacion,
            "empleador_nombre": final_empleador_nombre,
            "empleador_rol": final_empleador_rol,
            "empleador_ci": final_empleador_ci,
            "total_ganado": tg,
            "salario_diario": sd,
            "dias_pagados": effective_dias,
            "importe_cancelado": importe,
            "lugar_fecha": lugar_fecha or "",
            "firmas_en_blanco": firmas_en_blanco
        })

    if not receipts_list:
        raise HTTPException(
            status_code=404, 
            detail="No se encontraron empleados con vacaciones pagadas para generar recibos en lote."
        )

    out_fmt = "xlsx" if format.lower() == "excel" else "pdf"
    file_path = DocumentService.generate_vacation_payment_receipts_batch_excel(
        receipts_list,
        output_format=out_fmt,
        schema_name=schema_name
    )

    empresa_slug = DocumentService._slugify(schema_name)
    now_str = datetime.now().strftime("%d-%m-%Y")

    if out_fmt == "xlsx":
        filename = f"recibos_vacaciones_lote_empresa_{empresa_slug}_{now_str}.xlsx"
        return FileResponse(path=file_path, filename=filename, media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
    else:
        filename = f"recibos_vacaciones_lote_empresa_{empresa_slug}_{now_str}.pdf"
        return FileResponse(path=file_path, filename=filename, media_type="application/pdf")

@router.get("/export/lote/fichas-solicitadas/{format}")
@router.get("/export/lote/fichas-solicitadas/{format}/", include_in_schema=False)
def export_lote_fichas_solicitadas(
    schema_name: str,
    format: str,
    tipo: Optional[str] = Query("todas"),
    observaciones: Optional[str] = Query(None),
    responsable_nombre: Optional[str] = Query(None),
    fecha: Optional[str] = Query(None),
    firmas_en_blanco: Optional[bool] = Query(True),
    solo_con_vacaciones: Optional[bool] = Query(True),
    db: Session = Depends(get_tenant_db)
):
    with engine.connect() as conn:
        result = conn.execute(
            text("SELECT name, nit, empleador_nombres, empleador_apellido_paterno, empleador_apellido_materno, empleador_ci FROM public.tenants WHERE schema_name = :s").bindparams(s=schema_name)
        ).fetchone()
        t_name = result[0] if result else "Empresa"
        t_nit = result[1] if result and result[1] else ""
        t_emp_nombres = result[2] if result and result[2] else ""
        t_emp_paterno = result[3] if result and result[3] else ""
        t_emp_materno = result[4] if result and result[4] else ""
        t_emp_ci = result[5] if result and result[5] else ""
        rep_legal = f"{t_emp_paterno} {t_emp_materno} {t_emp_nombres}".strip() or t_name

    final_responsable = responsable_nombre or rep_legal
    fecha_doc = fecha or datetime.now().strftime("%d/%m/%Y")

    employees = db.query(Employee).filter(Employee.is_active == True).all()
    employees = sorted(employees, key=lambda e: sort_code_key(e.internal_code, e.id))

    record_query = db.query(VacationRecord)
    if tipo == "solicitada":
        record_query = record_query.filter(VacationRecord.tipo == "solicitada")
    elif tipo == "colectiva":
        record_query = record_query.filter(VacationRecord.tipo == "colectiva")
    else:
        record_query = record_query.filter(VacationRecord.tipo.in_(["solicitada", "colectiva"]))

    all_vac_records = record_query.order_by(VacationRecord.fecha_inicio.asc()).all()

    vac_by_emp = {}
    for r in all_vac_records:
        vac_by_emp.setdefault(r.employee_id, []).append(r)

    tipo_doc_label = "SOLICITADAS - COLECTIVAS"
    if tipo == "solicitada":
        tipo_doc_label = "SOLICITADAS"
    elif tipo == "colectiva":
        tipo_doc_label = "COLECTIVAS"

    fichas_list = []
    for emp in employees:
        emp_recs = vac_by_emp.get(emp.id, [])

        if solo_con_vacaciones and not emp_recs:
            continue

        ext = f" {emp.ext_ci.strip()}" if emp.ext_ci else ""
        trabajador_ci = f"{emp.documento_identidad.strip()}{ext}".strip()
        trabajador_nombre = f"{emp.apellido_paterno} {emp.apellido_materno or ''} {emp.nombres}".strip().upper()

        serialized_records = []
        for r in emp_recs:
            serialized_records.append({
                "id": r.id,
                "tipo": r.tipo,
                "fecha_inicio": str(r.fecha_inicio),
                "fecha_fin": str(r.fecha_fin),
                "dias": float(r.dias),
                "motivo": r.motivo or ("Vacación Solicitada" if r.tipo == "solicitada" else "Vacación Colectiva"),
                "fecha_solicitud": str(r.fecha_solicitud) if r.fecha_solicitud else ""
            })

        fichas_list.append({
            "empresa_nombre": t_name,
            "empresa_nit": t_nit,
            "trabajador_nombre": trabajador_nombre,
            "trabajador_cargo": emp.ocupacion,
            "trabajador_ci": trabajador_ci,
            "fecha_ingreso": str(emp.fecha_ingreso),
            "tipo_doc": tipo_doc_label,
            "records": serialized_records,
            "observaciones": observaciones or "",
            "responsable_nombre": final_responsable,
            "fecha": fecha_doc,
            "firmas_en_blanco": firmas_en_blanco
        })

    if not fichas_list:
        raise HTTPException(
            status_code=404,
            detail="No se encontraron empleados con vacaciones solicitadas/colectivas para generar fichas en lote."
        )

    out_fmt = "xlsx" if format.lower() == "excel" else "pdf"
    file_path = DocumentService.generate_vacation_solicitadas_colectivas_batch_excel(
        fichas_list,
        output_format=out_fmt,
        schema_name=schema_name
    )

    empresa_slug = DocumentService._slugify(schema_name)
    now_str = datetime.now().strftime("%d-%m-%Y")

    if out_fmt == "xlsx":
        filename = f"fichas_vacaciones_lote_empresa_{empresa_slug}_{now_str}.xlsx"
        return FileResponse(path=file_path, filename=filename, media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
    else:
        filename = f"fichas_vacaciones_lote_empresa_{empresa_slug}_{now_str}.pdf"
        return FileResponse(path=file_path, filename=filename, media_type="application/pdf")
