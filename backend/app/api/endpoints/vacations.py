from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy import text
from datetime import date, datetime
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
def get_company_vacation_summary(schema_name: str, db: Session = Depends(get_tenant_db)):
    with engine.connect() as conn:
        result = conn.execute(
            text(f"SELECT name, numero_patronal, nit, empleador_nombres, empleador_apellido_paterno, empleador_apellido_materno, empleador_ci FROM public.tenants WHERE schema_name = '{schema_name}'")
        ).fetchone()
        t_name = result[0] if result else "Empresa"
        t_patronal = result[1] if result and result[1] else "No asignado"
        t_nit = result[2] if result and result[2] else ""
        t_emp_nombres = result[3] if result and result[3] else ""
        t_emp_paterno = result[4] if result and result[4] else ""
        t_emp_materno = result[5] if result and result[5] else ""
        t_emp_ci = result[6] if result and result[6] else ""
        rep_legal = f"{t_emp_paterno} {t_emp_materno} {t_emp_nombres}".strip() or t_name

    employees = db.query(Employee).filter(Employee.is_active == True).all()
    employees = sorted(employees, key=lambda e: sort_code_key(e.internal_code, e.id))

    all_records = db.query(VacationRecord).order_by(VacationRecord.fecha_inicio.desc()).all()
    records_by_emp = {}
    for r in all_records:
        records_by_emp.setdefault(r.employee_id, []).append(r)

    emp_summaries = []
    tot_acumulados = 0.0
    tot_a_cuenta = 0.0
    tot_solicitadas = 0.0
    tot_colectivas = 0.0
    tot_tomados = 0.0
    tot_saldo = 0.0

    for emp in employees:
        calc = VacationService.calculate_accumulated_vacation_days(emp.fecha_ingreso)
        recs = records_by_emp.get(emp.id, [])
        
        a_cuenta = sum(float(r.dias) for r in recs if r.tipo == "a_cuenta")
        solicitadas = sum(float(r.dias) for r in recs if r.tipo == "solicitada")
        colectivas = sum(float(r.dias) for r in recs if r.tipo == "colectiva")
        tomados = a_cuenta + solicitadas + colectivas
        saldo = calc["dias_acumulados"] - tomados

        tot_acumulados += calc["dias_acumulados"]
        tot_a_cuenta += a_cuenta
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
            antiguedad_anios=calc["anios"],
            antiguedad_meses=calc["meses"],
            antiguedad_dias=calc["dias"],
            antiguedad_formato=calc["antiguedad_formato"],
            escala_dias=calc["escala_dias"],
            dias_acumulados=calc["dias_acumulados"],
            dias_a_cuenta=round(a_cuenta, 1),
            dias_solicitadas=round(solicitadas, 1),
            dias_colectivas=round(colectivas, 1),
            total_dias_tomados=round(tomados, 1),
            saldo_dias_pendientes=round(saldo, 1),
            records=serialized_records
        ))

    return CompanyVacationSummary(
        tenant_name=t_name,
        tenant_nit=t_nit,
        tenant_nro_patronal=t_patronal,
        tenant_empleador=rep_legal,
        tenant_empleador_ci=t_emp_ci,
        total_empleados=len(employees),
        total_dias_acumulados=round(tot_acumulados, 1),
        total_dias_a_cuenta=round(tot_a_cuenta, 1),
        total_dias_solicitadas=round(tot_solicitadas, 1),
        total_dias_colectivas=round(tot_colectivas, 1),
        total_dias_tomados=round(tot_tomados, 1),
        total_saldo_pendiente=round(tot_saldo, 1),
        employees=emp_summaries
    )

@router.get("/employee/{employee_id}", response_model=EmployeeVacationSummary)
@router.get("/employee/{employee_id}/", response_model=EmployeeVacationSummary, include_in_schema=False)
def get_employee_vacation_summary(schema_name: str, employee_id: int, db: Session = Depends(get_tenant_db)):
    emp = db.query(Employee).filter(Employee.id == employee_id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Empleado no encontrado")
        
    calc = VacationService.calculate_accumulated_vacation_days(emp.fecha_ingreso)
    recs = db.query(VacationRecord).filter(VacationRecord.employee_id == employee_id).order_by(VacationRecord.fecha_inicio.desc()).all()
    
    a_cuenta = sum(float(r.dias) for r in recs if r.tipo == "a_cuenta")
    solicitadas = sum(float(r.dias) for r in recs if r.tipo == "solicitada")
    colectivas = sum(float(r.dias) for r in recs if r.tipo == "colectiva")
    tomados = a_cuenta + solicitadas + colectivas
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
        antiguedad_anios=calc["anios"],
        antiguedad_meses=calc["meses"],
        antiguedad_dias=calc["dias"],
        antiguedad_formato=calc["antiguedad_formato"],
        escala_dias=calc["escala_dias"],
        dias_acumulados=calc["dias_acumulados"],
        dias_a_cuenta=round(a_cuenta, 1),
        dias_solicitadas=round(solicitadas, 1),
        dias_colectivas=round(colectivas, 1),
        total_dias_tomados=round(tomados, 1),
        saldo_dias_pendientes=round(saldo, 1),
        records=serialized_records
    )

@router.post("/record", response_model=VacationRecordResponse)
@router.post("/record/", response_model=VacationRecordResponse, include_in_schema=False)
def create_vacation_record(schema_name: str, payload: VacationRecordCreate, db: Session = Depends(get_tenant_db)):
    emp = db.query(Employee).filter(Employee.id == payload.employee_id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Empleado no encontrado")

    gestion = payload.gestion or payload.fecha_inicio.year
    fechas_json = json.dumps(payload.fechas_detalle or [])

    new_record = VacationRecord(
        employee_id=payload.employee_id,
        tipo=payload.tipo,
        fecha_inicio=payload.fecha_inicio,
        fecha_fin=payload.fecha_fin,
        dias=payload.dias,
        fechas_detalle=fechas_json,
        motivo=payload.motivo or "Vacaciones de personal",
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
        gestion=new_record.gestion,
        aprobado_por=new_record.aprobado_por,
        created_at=str(new_record.created_at) if new_record.created_at else None
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
def export_company_vacation_excel(schema_name: str, db: Session = Depends(get_tenant_db)):
    summary = get_company_vacation_summary(schema_name=schema_name, db=db)
    file_path = DocumentService.generate_company_vacations_excel(summary.model_dump(), output_format="xlsx", schema_name=schema_name)
    empresa_slug = DocumentService._slugify(schema_name)
    now_str = datetime.now().strftime("%d-%m-%Y")
    filename = f"control_vacaciones_{empresa_slug}_{now_str}.xlsx"
    return FileResponse(path=file_path, filename=filename, media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")

@router.get("/export/company/pdf")
@router.get("/export/company/pdf/", include_in_schema=False)
def export_company_vacation_pdf(schema_name: str, db: Session = Depends(get_tenant_db)):
    summary = get_company_vacation_summary(schema_name=schema_name, db=db)
    file_path = DocumentService.generate_company_vacations_excel(summary.model_dump(), output_format="pdf", schema_name=schema_name)
    empresa_slug = DocumentService._slugify(schema_name)
    now_str = datetime.now().strftime("%d-%m-%Y")
    filename = f"control_vacaciones_{empresa_slug}_{now_str}.pdf"
    return FileResponse(path=file_path, filename=filename, media_type="application/pdf")

@router.get("/export/employee/{employee_id}/excel")
@router.get("/export/employee/{employee_id}/excel/", include_in_schema=False)
def export_employee_vacation_excel(schema_name: str, employee_id: int, db: Session = Depends(get_tenant_db)):
    emp_summary = get_employee_vacation_summary(schema_name=schema_name, employee_id=employee_id, db=db)
    with engine.connect() as conn:
        result = conn.execute(
            text(f"SELECT name, numero_patronal, nit, empleador_nombres, empleador_apellido_paterno, empleador_apellido_materno, empleador_ci FROM public.tenants WHERE schema_name = '{schema_name}'")
        ).fetchone()
        t_name = result[0] if result else "Empresa"
        t_patronal = result[1] if result and result[1] else "No asignado"
        t_nit = result[2] if result and result[2] else ""
        t_emp_nombres = result[3] if result and result[3] else ""
        t_emp_paterno = result[4] if result and result[4] else ""
        t_emp_materno = result[5] if result and result[5] else ""
        t_emp_ci = result[6] if result and result[6] else ""
        rep_legal = f"{t_emp_paterno} {t_emp_materno} {t_emp_nombres}".strip() or t_name

    payload = {
        "empresa_nombre": t_name,
        "empresa_nit": t_nit,
        "numero_patronal": t_patronal,
        "representante_legal": rep_legal,
        "ci_representante": t_emp_ci,
        "employee": emp_summary.model_dump()
    }

    file_path = DocumentService.generate_employee_vacation_excel(payload, output_format="xlsx", schema_name=schema_name)
    empresa_slug = DocumentService._slugify(schema_name)
    emp_slug = DocumentService._slugify(emp_summary.employee_name)
    now_str = datetime.now().strftime("%d-%m-%Y")
    filename = f"ficha_vacaciones_{emp_slug}_{empresa_slug}_{now_str}.xlsx"
    return FileResponse(path=file_path, filename=filename, media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")

@router.get("/export/employee/{employee_id}/pdf")
@router.get("/export/employee/{employee_id}/pdf/", include_in_schema=False)
def export_employee_vacation_pdf(schema_name: str, employee_id: int, db: Session = Depends(get_tenant_db)):
    emp_summary = get_employee_vacation_summary(schema_name=schema_name, employee_id=employee_id, db=db)
    with engine.connect() as conn:
        result = conn.execute(
            text(f"SELECT name, numero_patronal, nit, empleador_nombres, empleador_apellido_paterno, empleador_apellido_materno, empleador_ci FROM public.tenants WHERE schema_name = '{schema_name}'")
        ).fetchone()
        t_name = result[0] if result else "Empresa"
        t_patronal = result[1] if result and result[1] else "No asignado"
        t_nit = result[2] if result and result[2] else ""
        t_emp_nombres = result[3] if result and result[3] else ""
        t_emp_paterno = result[4] if result and result[4] else ""
        t_emp_materno = result[5] if result and result[5] else ""
        t_emp_ci = result[6] if result and result[6] else ""
        rep_legal = f"{t_emp_paterno} {t_emp_materno} {t_emp_nombres}".strip() or t_name

    payload = {
        "empresa_nombre": t_name,
        "empresa_nit": t_nit,
        "numero_patronal": t_patronal,
        "representante_legal": rep_legal,
        "ci_representante": t_emp_ci,
        "employee": emp_summary.model_dump()
    }

    file_path = DocumentService.generate_employee_vacation_excel(payload, output_format="pdf", schema_name=schema_name)
    empresa_slug = DocumentService._slugify(schema_name)
    emp_slug = DocumentService._slugify(emp_summary.employee_name)
    now_str = datetime.now().strftime("%d-%m-%Y")
    filename = f"ficha_vacaciones_{emp_slug}_{empresa_slug}_{now_str}.pdf"
    return FileResponse(path=file_path, filename=filename, media_type="application/pdf")
