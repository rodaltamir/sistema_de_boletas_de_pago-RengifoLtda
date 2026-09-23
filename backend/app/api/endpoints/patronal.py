from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from sqlalchemy import text
from decimal import Decimal
from datetime import date
import re
import calendar

from app.db.session import engine
from sqlalchemy.orm import sessionmaker
from app.models.payroll import Payroll, Payslip
from app.models.employee import Employee
from app.models.patronal import PatronalDetail
from app.schemas.patronal import (
    PatronalPayrollResponse,
    PatronalDetailResponse,
    PatronalDetailUpdate,
    PatronalTotals
)
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

@router.get("/{month}/{year}", response_model=PatronalPayrollResponse)
@router.get("/{month}/{year}/", response_model=PatronalPayrollResponse, include_in_schema=False)
def get_patronal_payroll(schema_name: str, month: int, year: int, db: Session = Depends(get_tenant_db)):
    # 1. Info del Tenant
    with engine.connect() as conn:
        result = conn.execute(text(
            f"SELECT name, numero_patronal, nit FROM public.tenants WHERE schema_name = '{schema_name}'"
        )).fetchone()
        t_name = result[0] if result else "Empresa"
        t_patronal = result[1] if result and result[1] else "350-1-2177"
        t_nit = result[2] if result and result[2] else "6570013013"

    # 2. Planilla mensual de sueldos
    payroll = db.query(Payroll).filter(Payroll.month == month, Payroll.year == year).first()
    
    # Si aún no existe planilla de sueldos para el mes, intentar obtenerla o generar
    from app.api.endpoints.payrolls import get_or_generate_payroll
    if not payroll:
        try:
            get_or_generate_payroll(schema_name, month, year, db)
            payroll = db.query(Payroll).filter(Payroll.month == month, Payroll.year == year).first()
        except Exception:
            pass

    payslips = payroll.payslips if payroll else []
    existing_details = db.query(PatronalDetail).filter(
        PatronalDetail.month == month,
        PatronalDetail.year == year
    ).all()
    details_by_emp = {d.employee_id: d for d in existing_details}

    # Sincronizar o crear registros patronales para cada empleado en payslips
    for p in payslips:
        emp = db.query(Employee).filter(Employee.id == p.employee_id).first()
        if not emp:
            continue

        tot_ganado = Decimal(str(p.total_ganado or 0.0))
        d_record = details_by_emp.get(p.employee_id)

        if not d_record:
            # Cálculo legal boliviano:
            cns_val = round(tot_ganado * Decimal("0.10"), 2)
            afp_val = round(tot_ganado * Decimal("0.0171"), 2)
            fonvi_val = round(tot_ganado * Decimal("0.02"), 2)
            aps_val = round(tot_ganado * Decimal("0.035"), 2)
            tot_aportes = cns_val + afp_val + fonvi_val + aps_val

            prov_ag = round(tot_ganado / Decimal("12"), 2)
            prov_ind = round(tot_ganado / Decimal("12"), 2)
            tot_prov = prov_ag + prov_ind
            tot_carga = tot_aportes + tot_prov

            d_record = PatronalDetail(
                payroll_id=payroll.id if payroll else None,
                employee_id=emp.id,
                month=month,
                year=year,
                total_ganado=tot_ganado,
                cns=cns_val,
                afp=afp_val,
                fonvi=fonvi_val,
                aps=aps_val,
                total_aportes=tot_aportes,
                provision_aguinaldo=prov_ag,
                provision_indemnizacion=prov_ind,
                total_provisiones=tot_prov,
                total_carga_patronal=tot_carga,
                is_customized=False
            )
            db.add(d_record)
            db.commit()
            db.refresh(d_record)
            details_by_emp[emp.id] = d_record
        elif not d_record.is_customized and d_record.total_ganado != tot_ganado:
            # Si no fue modificado manualmente y el total ganado del mes cambió, recalcular
            d_record.total_ganado = tot_ganado
            d_record.cns = round(tot_ganado * Decimal("0.10"), 2)
            d_record.afp = round(tot_ganado * Decimal("0.0171"), 2)
            d_record.fonvi = round(tot_ganado * Decimal("0.02"), 2)
            d_record.aps = round(tot_ganado * Decimal("0.035"), 2)
            d_record.total_aportes = d_record.cns + d_record.afp + d_record.fonvi + d_record.aps
            d_record.provision_aguinaldo = round(tot_ganado / Decimal("12"), 2)
            d_record.provision_indemnizacion = round(tot_ganado / Decimal("12"), 2)
            d_record.total_provisiones = d_record.provision_aguinaldo + d_record.provision_indemnizacion
            d_record.total_carga_patronal = d_record.total_aportes + d_record.total_provisiones
            db.commit()
            db.refresh(d_record)

    # Construir lista de respuesta
    resp_details = []
    tot = PatronalTotals()

    all_details = db.query(PatronalDetail).filter(
        PatronalDetail.month == month,
        PatronalDetail.year == year
    ).all()

    for d in all_details:
        emp = db.query(Employee).filter(Employee.id == d.employee_id).first()
        if not emp:
            continue

        emp_code = emp.internal_code or str(emp.id)
        emp_name = f"{emp.apellido_paterno} {emp.apellido_materno or ''} {emp.nombres}".strip().replace("  ", " ").upper()
        emp_ci = f"{emp.documento_identidad} {emp.ext_ci or ''}".strip()
        emp_cargo = emp.ocupacion or ""

        detail_resp = PatronalDetailResponse(
            id=d.id,
            employee_id=d.employee_id,
            employee_code=emp_code,
            employee_name=emp_name,
            employee_ci=emp_ci,
            employee_cargo=emp_cargo,
            total_ganado=d.total_ganado,
            cns=d.cns,
            afp=d.afp,
            fonvi=d.fonvi,
            aps=d.aps,
            total_aportes=d.total_aportes,
            provision_aguinaldo=d.provision_aguinaldo,
            provision_indemnizacion=d.provision_indemnizacion,
            total_provisiones=d.total_provisiones,
            total_carga_patronal=d.total_carga_patronal,
            is_customized=bool(d.is_customized)
        )
        resp_details.append(detail_resp)

        # Acumular totales
        tot.total_ganado += Decimal(str(d.total_ganado))
        tot.cns += Decimal(str(d.cns))
        tot.afp += Decimal(str(d.afp))
        tot.fonvi += Decimal(str(d.fonvi))
        tot.aps += Decimal(str(d.aps))
        tot.total_aportes += Decimal(str(d.total_aportes))
        tot.provision_aguinaldo += Decimal(str(d.provision_aguinaldo))
        tot.provision_indemnizacion += Decimal(str(d.provision_indemnizacion))
        tot.total_provisiones += Decimal(str(d.total_provisiones))
        tot.total_carga_patronal += Decimal(str(d.total_carga_patronal))

    # Ordenar por código ascendente
    resp_details.sort(key=lambda s: sort_code_key(s.employee_code, s.employee_id))

    return PatronalPayrollResponse(
        month=month,
        year=year,
        tenant_name=t_name,
        tenant_nro_patronal=t_patronal,
        tenant_nit=t_nit,
        tenant_ciudad="La Paz - Bolivia",
        details=resp_details,
        totals=tot
    )

@router.put("/{month}/{year}/slips/{slip_id}", response_model=PatronalDetailResponse)
@router.put("/{month}/{year}/slips/{slip_id}/", response_model=PatronalDetailResponse, include_in_schema=False)
def update_patronal_slip(
    schema_name: str,
    month: int,
    year: int,
    slip_id: int,
    updates: PatronalDetailUpdate,
    db: Session = Depends(get_tenant_db)
):
    slip = db.query(PatronalDetail).filter(PatronalDetail.id == slip_id).first()
    if not slip:
        raise HTTPException(status_code=404, detail="Registro patronal no encontrado")

    update_dict = updates.dict(exclude_unset=True)
    for k, v in update_dict.items():
        if v is not None:
            setattr(slip, k, Decimal(str(v)))

    # Si se actualizó total_ganado pero no aportes, recalcular aportes
    if 'total_ganado' in update_dict:
        tg = slip.total_ganado
        if 'cns' not in update_dict:
            slip.cns = round(tg * Decimal("0.10"), 2)
        if 'afp' not in update_dict:
            slip.afp = round(tg * Decimal("0.0171"), 2)
        if 'fonvi' not in update_dict:
            slip.fonvi = round(tg * Decimal("0.02"), 2)
        if 'aps' not in update_dict:
            slip.aps = round(tg * Decimal("0.035"), 2)

    # Recalcular totales
    slip.total_aportes = slip.cns + slip.afp + slip.fonvi + slip.aps
    slip.total_provisiones = slip.provision_aguinaldo + slip.provision_indemnizacion
    slip.total_carga_patronal = slip.total_aportes + slip.total_provisiones
    slip.is_customized = True

    db.commit()
    db.refresh(slip)

    emp = db.query(Employee).filter(Employee.id == slip.employee_id).first()
    emp_code = emp.internal_code if emp else str(slip.employee_id)
    emp_name = f"{emp.apellido_paterno} {emp.apellido_materno or ''} {emp.nombres}".strip().replace("  ", " ").upper() if emp else "EMPLEADO"
    emp_ci = f"{emp.documento_identidad} {emp.ext_ci or ''}".strip() if emp else ""
    emp_cargo = emp.ocupacion if emp else ""

    return PatronalDetailResponse(
        id=slip.id,
        employee_id=slip.employee_id,
        employee_code=emp_code,
        employee_name=emp_name,
        employee_ci=emp_ci,
        employee_cargo=emp_cargo,
        total_ganado=slip.total_ganado,
        cns=slip.cns,
        afp=slip.afp,
        fonvi=slip.fonvi,
        aps=slip.aps,
        total_aportes=slip.total_aportes,
        provision_aguinaldo=slip.provision_aguinaldo,
        provision_indemnizacion=slip.provision_indemnizacion,
        total_provisiones=slip.total_provisiones,
        total_carga_patronal=slip.total_carga_patronal,
        is_customized=True
    )

@router.get("/{month}/{year}/export/{format}")
@router.get("/{month}/{year}/export/{format}/", include_in_schema=False)
def export_patronal_payroll(
    schema_name: str,
    month: int,
    year: int,
    format: str,
    db: Session = Depends(get_tenant_db)
):
    if format.lower() not in ["excel", "xlsx", "pdf"]:
        raise HTTPException(status_code=400, detail="Formato no soportado. Use 'excel' o 'pdf'.")

    payroll_data = get_patronal_payroll(schema_name, month, year, db)
    
    details_dict = []
    for d in payroll_data.details:
        details_dict.append({
            'employee_name': d.employee_name,
            'employee_cargo': d.employee_cargo,
            'total_ganado': float(d.total_ganado),
            'cns': float(d.cns),
            'afp': float(d.afp),
            'fonvi': float(d.fonvi),
            'aps': float(d.aps),
            'total_aportes': float(d.total_aportes),
            'provision_aguinaldo': float(d.provision_aguinaldo),
            'provision_indemnizacion': float(d.provision_indemnizacion),
            'total_provisiones': float(d.total_provisiones),
            'total_carga_patronal': float(d.total_carga_patronal)
        })

    data_payload = {
        'empresa_nombre': payroll_data.tenant_name,
        'ciudad': payroll_data.tenant_ciudad,
        'numero_patronal': payroll_data.tenant_nro_patronal,
        'nit': payroll_data.tenant_nit,
        'mes': month,
        'anio': year,
        'details': details_dict
    }

    out_fmt = "pdf" if format.lower() == "pdf" else "xlsx"
    file_path = DocumentService.generate_patronal_excel(data_payload, output_format=out_fmt, schema_name=schema_name)

    empresa_slug = DocumentService._slugify(schema_name if schema_name else payroll_data.tenant_name)
    MESES = {1:"enero", 2:"febrero", 3:"marzo", 4:"abril", 5:"mayo", 6:"junio", 7:"julio", 8:"agosto", 9:"septiembre", 10:"octubre", 11:"noviembre", 12:"diciembre"}
    mes_nombre = MESES.get(month, str(month))

    media_type = 'application/pdf' if out_fmt == "pdf" else 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    filename = f"planilla_patronal_{empresa_slug}_{mes_nombre}_{year}.{out_fmt}"
    return FileResponse(path=file_path, filename=filename, media_type=media_type)
