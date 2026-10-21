from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy import text
from decimal import Decimal
from datetime import date
import calendar
import re

from app.db.session import engine
from app.models.eventual_payroll import EventualPayroll, EventualPayslip
from app.models.payroll import Payroll, Payslip
from app.models.employee import Employee
from app.models.prefiniquito import Prefiniquito
from app.models.global_params import SalarioMinimoNacional
from app.schemas.eventual_payroll import (
    EventualPayrollResponse,
    EventualPayslipResponse,
    EventualPayslipUpdate
)
from app.services.payroll_service import (
    calcular_boleta_empleado,
    calcular_bono_antiguedad,
    calculate_seniority_years
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

def get_smn(db: Session, year: int) -> Decimal:
    smn = db.query(SalarioMinimoNacional).filter(SalarioMinimoNacional.year == year).first()
    return Decimal(str(smn.amount)) if smn else Decimal("3300.00")

def sort_code_key(code_val, fallback_id=0):
    if not code_val:
        return (1, fallback_id, "")
    code_str = str(code_val).strip()
    digits = re.findall(r'\d+', code_str)
    if digits:
        return (0, int(digits[0]), code_str)
    return (0, 999999, code_str)

@router.get("/{month}/{year}", response_model=EventualPayrollResponse)
@router.get("/{month}/{year}/", response_model=EventualPayrollResponse, include_in_schema=False)
def get_or_generate_eventual_payroll(schema_name: str, month: int, year: int, db: Session = Depends(get_tenant_db)):
    payroll = db.query(EventualPayroll).filter(EventualPayroll.month == month, EventualPayroll.year == year).first()
    smn_actual = get_smn(db, year)
    
    # Obtener info del tenant
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
    
    _, last_day = calendar.monthrange(year, month)
    period_start = date(year, month, 1)
    period_end = date(year, month, last_day)

    if not payroll:
        payroll = EventualPayroll(month=month, year=year, is_closed=False)
        db.add(payroll)
        db.commit()
        db.refresh(payroll)
        
    if not payroll.is_closed:
        # 1. Purgar registros de empleados que no corresponden a este periodo
        slips_to_remove = []
        for p in list(payroll.eventual_payslips):
            emp = db.query(Employee).filter(Employee.id == p.employee_id).first()
            if not emp:
                slips_to_remove.append(p)
                continue
            if emp.fecha_ingreso > period_end:
                slips_to_remove.append(p)
                continue
            if not emp.is_active:
                pref = db.query(Prefiniquito).filter(Prefiniquito.employee_id == emp.id).order_by(Prefiniquito.id.desc()).first()
                if pref and pref.fecha_retiro < period_start:
                    slips_to_remove.append(p)
                    continue

        if slips_to_remove:
            for p in slips_to_remove:
                db.delete(p)
            db.commit()
            db.refresh(payroll)

        # 2. Obtener planilla regular de sueldos (para copiar todos los datos del mes)
        regular_payroll = db.query(Payroll).filter(Payroll.month == month, Payroll.year == year).first()
        regular_slips_map = {}
        if regular_payroll:
            for r_slip in regular_payroll.payslips:
                regular_slips_map[r_slip.employee_id] = r_slip

        # 3. Incluir a TODOS los empleados (Eventuales Y Permanentes)
        existing_emp_ids = {p.employee_id for p in payroll.eventual_payslips}
        all_employees = db.query(Employee).all()
        
        for emp in all_employees:
            if emp.fecha_ingreso > period_end:
                continue
            if not emp.is_active:
                pref = db.query(Prefiniquito).filter(Prefiniquito.employee_id == emp.id).order_by(Prefiniquito.id.desc()).first()
                if not pref or pref.fecha_retiro < period_start:
                    continue
            
            # Si el slip ya existe, sincronizar datos de sueldos si no ha sido customizado
            if emp.id in existing_emp_ids:
                curr_slip = next((p for p in payroll.eventual_payslips if p.employee_id == emp.id), None)
                if curr_slip and not curr_slip.is_customized and emp.id in regular_slips_map:
                    r_slip = regular_slips_map[emp.id]
                    curr_slip.dias_pagados = r_slip.dias_pagados
                    curr_slip.horas_pagadas = r_slip.horas_pagadas
                    curr_slip.bono_antiguedad = r_slip.bono_antiguedad
                    curr_slip.bono_produccion = r_slip.bono_produccion
                    curr_slip.subsidio_frontera = r_slip.subsidio_frontera
                    curr_slip.trabajo_extraordinario = r_slip.trabajo_extraordinario
                    curr_slip.pago_dominical = r_slip.pago_dominical
                    curr_slip.otros_bonos = r_slip.otros_bonos
                    curr_slip.subsidio_natalidad = r_slip.subsidio_natalidad
                    curr_slip.rc_iva = r_slip.rc_iva
                    curr_slip.anticipos = r_slip.anticipos
                    curr_slip.otros_descuentos = r_slip.otros_descuentos
                    
                    # Recalcular totales con el haber básico actual de eventuales
                    h_basico = Decimal(str(curr_slip.haber_basico))
                    tot_ganado = (
                        h_basico +
                        Decimal(str(curr_slip.bono_antiguedad or 0)) +
                        Decimal(str(curr_slip.bono_produccion or 0)) +
                        Decimal(str(curr_slip.subsidio_frontera or 0)) +
                        Decimal(str(curr_slip.trabajo_extraordinario or 0)) +
                        Decimal(str(curr_slip.pago_dominical or 0)) +
                        Decimal(str(curr_slip.otros_bonos or 0)) +
                        Decimal(str(curr_slip.subsidio_natalidad or 0))
                    )
                    curr_slip.total_ganado = tot_ganado
                    curr_slip.aporte_gestora = round(tot_ganado * Decimal("0.1271"), 2)
                    curr_slip.total_descuentos = (
                        curr_slip.aporte_gestora +
                        Decimal(str(curr_slip.rc_iva or 0)) +
                        Decimal(str(curr_slip.anticipos or 0)) +
                        Decimal(str(curr_slip.otros_descuentos or 0))
                    )
                    curr_slip.liquido_pagable = tot_ganado - curr_slip.total_descuentos
                continue

            # Crear nuevo EventualPayslip
            if emp.id in regular_slips_map:
                r_slip = regular_slips_map[emp.id]
                h_basico = Decimal(str(r_slip.haber_basico))
                bono_ant = Decimal(str(r_slip.bono_antiguedad or 0))
                bono_prod = Decimal(str(r_slip.bono_produccion or 0))
                sub_fron = Decimal(str(r_slip.subsidio_frontera or 0))
                trab_ext = Decimal(str(r_slip.trabajo_extraordinario or 0))
                pago_dom = Decimal(str(r_slip.pago_dominical or 0))
                otros_b = Decimal(str(r_slip.otros_bonos or 0))
                sub_nat = Decimal(str(r_slip.subsidio_natalidad or 0))
                rc_iva = Decimal(str(r_slip.rc_iva or 0))
                anticipos = Decimal(str(r_slip.anticipos or 0))
                otros_desc = Decimal(str(r_slip.otros_descuentos or 0))
                dias_pag = r_slip.dias_pagados
                horas_pag = r_slip.horas_pagadas
            else:
                anios_ant = calculate_seniority_years(emp.fecha_ingreso, year, month)
                calc = calcular_boleta_empleado(
                    haber_basico=Decimal(str(emp.haber_basico)),
                    anios_antiguedad=max(0, anios_ant),
                    smn=smn_actual
                )
                h_basico = Decimal(str(emp.haber_basico))
                bono_ant = calc.get("bono_antiguedad", Decimal(0))
                bono_prod = Decimal(0)
                sub_fron = Decimal(0)
                trab_ext = Decimal(0)
                pago_dom = Decimal(0)
                otros_b = Decimal(0)
                sub_nat = Decimal(0)
                rc_iva = Decimal(0)
                anticipos = Decimal(0)
                otros_desc = Decimal(0)
                dias_pag = 30
                if emp.fecha_ingreso.year == year and emp.fecha_ingreso.month == month and emp.fecha_ingreso.day > 1:
                    dias_pag = max(1, 30 - emp.fecha_ingreso.day + 1)
                horas_pag = Decimal("8.00")

            tot_ganado = h_basico + bono_ant + bono_prod + sub_fron + trab_ext + pago_dom + otros_b + sub_nat
            gestora = round(tot_ganado * Decimal("0.1271"), 2)
            tot_desc = gestora + rc_iva + anticipos + otros_desc
            liq_pagable = tot_ganado - tot_desc

            eventual_slip = EventualPayslip(
                eventual_payroll_id=payroll.id,
                employee_id=emp.id,
                dias_pagados=dias_pag,
                horas_pagadas=horas_pag,
                haber_basico=h_basico,
                bono_antiguedad=bono_ant,
                bono_produccion=bono_prod,
                subsidio_frontera=sub_fron,
                trabajo_extraordinario=trab_ext,
                pago_dominical=pago_dom,
                otros_bonos=otros_b,
                subsidio_natalidad=sub_nat,
                total_ganado=tot_ganado,
                aporte_gestora=gestora,
                rc_iva=rc_iva,
                anticipos=anticipos,
                otros_descuentos=otros_desc,
                total_descuentos=tot_desc,
                liquido_pagable=liq_pagable,
                is_customized=False
            )
            db.add(eventual_slip)
        
        db.commit()
        db.refresh(payroll)

    response_data = EventualPayrollResponse.model_validate(payroll)
    response_data.tenant_name = t_name
    response_data.tenant_nro_patronal = t_patronal
    response_data.tenant_nit = t_nit
    response_data.tenant_empleador_nombres = t_emp_nombres
    response_data.tenant_empleador_apellido_paterno = t_emp_paterno
    response_data.tenant_empleador_apellido_materno = t_emp_materno
    response_data.tenant_empleador_ci = t_emp_ci
    
    valid_slips = []
    for p in payroll.eventual_payslips:
        emp = db.query(Employee).filter(Employee.id == p.employee_id).first()
        if emp:
            if emp.fecha_ingreso > period_end:
                continue
            slip = EventualPayslipResponse.model_validate(p)
            slip.employee_code = emp.internal_code or str(emp.id)
            slip.employee_name = f"{emp.apellido_paterno} {emp.apellido_materno or ''} {emp.nombres}".strip().replace("  ", " ").upper()
            ext = f" {emp.ext_ci.strip()}" if emp.ext_ci else ""
            slip.employee_ci = f"{emp.documento_identidad.strip()}{ext}".strip()
            slip.employee_cargo = emp.ocupacion
            slip.employee_fecha_ingreso = str(emp.fecha_ingreso)
            slip.employee_nacionalidad = emp.nacionalidad or 'BOLIVIANO'
            slip.employee_fecha_nacimiento = str(emp.fecha_nacimiento)
            slip.employee_sexo = getattr(emp, 'sexo', None) or 'M'
            slip.employee_tipo_contrato = getattr(emp, 'tipo_contrato', 'permanente') or 'permanente'
            slip.employee_is_active = emp.is_active
            valid_slips.append(slip)
            
    response_data.payslips = valid_slips
    response_data.payslips.sort(
        key=lambda s: sort_code_key(s.employee_code, s.employee_id)
    )
    
    return response_data

@router.put("/slip/{payslip_id}", response_model=EventualPayslipResponse)
@router.put("/slip/{payslip_id}/", response_model=EventualPayslipResponse, include_in_schema=False)
def update_eventual_payslip(schema_name: str, payslip_id: int, updates: EventualPayslipUpdate, db: Session = Depends(get_tenant_db)):
    slip = db.query(EventualPayslip).filter(EventualPayslip.id == payslip_id).first()
    if not slip:
        raise HTTPException(status_code=404, detail="Boleta de eventuales no encontrada")
    
    payroll = slip.eventual_payroll
    if payroll.is_closed:
        raise HTTPException(status_code=400, detail="La planilla de eventuales está cerrada y no permite modificaciones.")
    
    if updates.haber_basico is not None:
        slip.haber_basico = updates.haber_basico
        slip.is_customized = True
        
    if updates.dias_pagados is not None:
        slip.dias_pagados = updates.dias_pagados
    if updates.horas_pagadas is not None:
        slip.horas_pagadas = updates.horas_pagadas
    if updates.bono_produccion is not None:
        slip.bono_produccion = updates.bono_produccion
    if updates.subsidio_frontera is not None:
        slip.subsidio_frontera = updates.subsidio_frontera
    if updates.trabajo_extraordinario is not None:
        slip.trabajo_extraordinario = updates.trabajo_extraordinario
    if updates.pago_dominical is not None:
        slip.pago_dominical = updates.pago_dominical
    if updates.otros_bonos is not None:
        slip.otros_bonos = updates.otros_bonos
    if updates.subsidio_natalidad is not None:
        slip.subsidio_natalidad = updates.subsidio_natalidad
    if updates.rc_iva is not None:
        slip.rc_iva = updates.rc_iva
    if updates.anticipos is not None:
        slip.anticipos = updates.anticipos
    if updates.otros_descuentos is not None:
        slip.otros_descuentos = updates.otros_descuentos

    # Recálculo exacto
    h_basico = Decimal(str(slip.haber_basico))
    tot_ganado = (
        h_basico +
        Decimal(str(slip.bono_antiguedad or 0)) +
        Decimal(str(slip.bono_produccion or 0)) +
        Decimal(str(slip.subsidio_frontera or 0)) +
        Decimal(str(slip.trabajo_extraordinario or 0)) +
        Decimal(str(slip.pago_dominical or 0)) +
        Decimal(str(slip.otros_bonos or 0)) +
        Decimal(str(slip.subsidio_natalidad or 0))
    )
    slip.total_ganado = tot_ganado
    slip.aporte_gestora = round(tot_ganado * Decimal("0.1271"), 2)
    slip.total_descuentos = (
        slip.aporte_gestora +
        Decimal(str(slip.rc_iva or 0)) +
        Decimal(str(slip.anticipos or 0)) +
        Decimal(str(slip.otros_descuentos or 0))
    )
    slip.liquido_pagable = tot_ganado - slip.total_descuentos

    db.commit()
    db.refresh(slip)

    emp = db.query(Employee).filter(Employee.id == slip.employee_id).first()
    res = EventualPayslipResponse.model_validate(slip)
    if emp:
        res.employee_code = emp.internal_code or str(emp.id)
        res.employee_name = f"{emp.apellido_paterno} {emp.apellido_materno or ''} {emp.nombres}".strip().replace("  ", " ").upper()
        ext = f" {emp.ext_ci.strip()}" if emp.ext_ci else ""
        res.employee_ci = f"{emp.documento_identidad.strip()}{ext}".strip()
        res.employee_cargo = emp.ocupacion
        res.employee_fecha_ingreso = str(emp.fecha_ingreso)
        res.employee_nacionalidad = emp.nacionalidad or 'BOLIVIANO'
        res.employee_fecha_nacimiento = str(emp.fecha_nacimiento)
        res.employee_sexo = getattr(emp, 'sexo', None) or 'M'
        res.employee_tipo_contrato = getattr(emp, 'tipo_contrato', 'permanente') or 'permanente'
        res.employee_is_active = emp.is_active

    return res

@router.post("/{month}/{year}/close")
@router.post("/{month}/{year}/close/", include_in_schema=False)
def close_eventual_payroll(schema_name: str, month: int, year: int, db: Session = Depends(get_tenant_db)):
    payroll = db.query(EventualPayroll).filter(EventualPayroll.month == month, EventualPayroll.year == year).first()
    if not payroll:
        raise HTTPException(status_code=404, detail="Planilla de eventuales no encontrada")
    payroll.is_closed = True
    db.commit()
    return {"message": "Planilla de eventuales cerrada correctamente", "is_closed": True}

@router.post("/{month}/{year}/reopen")
@router.post("/{month}/{year}/reopen/", include_in_schema=False)
def reopen_eventual_payroll(schema_name: str, month: int, year: int, db: Session = Depends(get_tenant_db)):
    payroll = db.query(EventualPayroll).filter(EventualPayroll.month == month, EventualPayroll.year == year).first()
    if not payroll:
        raise HTTPException(status_code=404, detail="Planilla de eventuales no encontrada")
    payroll.is_closed = False
    db.commit()
    return {"message": "Planilla de eventuales reabierta correctamente", "is_closed": False}

@router.get("/{month}/{year}/export/excel")
@router.get("/{month}/{year}/export/excel/", include_in_schema=False)
def export_eventual_payroll_excel(schema_name: str, month: int, year: int, db: Session = Depends(get_tenant_db)):
    payroll_data = get_or_generate_eventual_payroll(schema_name=schema_name, month=month, year=year, db=db)
    
    rows = []
    for s in payroll_data.payslips:
        rows.append({
            "mes": month,
            "anio": year,
            "empresa_nombre": payroll_data.tenant_name,
            "empresa_nit": payroll_data.tenant_nit,
            "numero_patronal": payroll_data.tenant_nro_patronal,
            "representante_legal": f"{payroll_data.tenant_empleador_apellido_paterno or ''} {payroll_data.tenant_empleador_apellido_materno or ''} {payroll_data.tenant_empleador_nombres or ''}".strip() or payroll_data.tenant_name,
            "ci_representante": payroll_data.tenant_empleador_ci,
            "internal_code": s.employee_code,
            "ci": s.employee_ci,
            "apellidos_nombres": s.employee_name,
            "nacionalidad": s.employee_nacionalidad,
            "fecha_nacimiento": s.employee_fecha_nacimiento,
            "sexo": s.employee_sexo,
            "cargo": s.employee_cargo,
            "fecha_ingreso": s.employee_fecha_ingreso,
            "dias_pagados": s.dias_pagados,
            "horas_pagadas": float(s.horas_pagadas),
            "haber_basico": float(s.haber_basico),
            "bono_antiguedad": float(s.bono_antiguedad),
            "bono_produccion": float(s.bono_produccion),
            "subsidio_frontera": float(s.subsidio_frontera),
            "trabajo_extraordinario": float(s.trabajo_extraordinario),
            "pago_dominical": float(s.pago_dominical),
            "otros_bonos": float(s.otros_bonos),
            "subsidio_natalidad": float(s.subsidio_natalidad),
            "total_ganado": float(s.total_ganado),
            "aporte_gestora": float(s.aporte_gestora),
            "rc_iva": float(s.rc_iva),
            "anticipos": float(s.anticipos),
            "otros_descuentos": float(s.otros_descuentos),
            "total_descuentos": float(s.total_descuentos),
            "liquido_pagable": float(s.liquido_pagable)
        })

    file_path = DocumentService.generate_eventual_payroll_excel(rows, output_format="xlsx", schema_name=schema_name)
    empresa_slug = DocumentService._slugify(schema_name)
    filename = f"planilla_eventuales_{empresa_slug}_{month}_{year}.xlsx"
    return FileResponse(path=file_path, filename=filename, media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")

@router.get("/{month}/{year}/export/pdf")
@router.get("/{month}/{year}/export/pdf/", include_in_schema=False)
def export_eventual_payroll_pdf(schema_name: str, month: int, year: int, db: Session = Depends(get_tenant_db)):
    payroll_data = get_or_generate_eventual_payroll(schema_name=schema_name, month=month, year=year, db=db)
    
    rows = []
    for s in payroll_data.payslips:
        rows.append({
            "mes": month,
            "anio": year,
            "empresa_nombre": payroll_data.tenant_name,
            "empresa_nit": payroll_data.tenant_nit,
            "numero_patronal": payroll_data.tenant_nro_patronal,
            "representante_legal": f"{payroll_data.tenant_empleador_apellido_paterno or ''} {payroll_data.tenant_empleador_apellido_materno or ''} {payroll_data.tenant_empleador_nombres or ''}".strip() or payroll_data.tenant_name,
            "ci_representante": payroll_data.tenant_empleador_ci,
            "internal_code": s.employee_code,
            "ci": s.employee_ci,
            "apellidos_nombres": s.employee_name,
            "nacionalidad": s.employee_nacionalidad,
            "fecha_nacimiento": s.employee_fecha_nacimiento,
            "sexo": s.employee_sexo,
            "cargo": s.employee_cargo,
            "fecha_ingreso": s.employee_fecha_ingreso,
            "dias_pagados": s.dias_pagados,
            "horas_pagadas": float(s.horas_pagadas),
            "haber_basico": float(s.haber_basico),
            "bono_antiguedad": float(s.bono_antiguedad),
            "bono_produccion": float(s.bono_produccion),
            "subsidio_frontera": float(s.subsidio_frontera),
            "trabajo_extraordinario": float(s.trabajo_extraordinario),
            "pago_dominical": float(s.pago_dominical),
            "otros_bonos": float(s.otros_bonos),
            "subsidio_natalidad": float(s.subsidio_natalidad),
            "total_ganado": float(s.total_ganado),
            "aporte_gestora": float(s.aporte_gestora),
            "rc_iva": float(s.rc_iva),
            "anticipos": float(s.anticipos),
            "otros_descuentos": float(s.otros_descuentos),
            "total_descuentos": float(s.total_descuentos),
            "liquido_pagable": float(s.liquido_pagable)
        })

    file_path = DocumentService.generate_eventual_payroll_excel(rows, output_format="pdf", schema_name=schema_name)
    empresa_slug = DocumentService._slugify(schema_name)
    filename = f"planilla_eventuales_{empresa_slug}_{month}_{year}.pdf"
    return FileResponse(path=file_path, filename=filename, media_type="application/pdf")
