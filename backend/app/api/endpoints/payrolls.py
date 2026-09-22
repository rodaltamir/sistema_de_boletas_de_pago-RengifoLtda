from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from sqlalchemy import text
from decimal import Decimal
from datetime import date
import calendar
import os
import re

from app.db.session import engine
from sqlalchemy.orm import sessionmaker
from app.models.payroll import Payroll, Payslip
from app.models.employee import Employee
from app.models.prefiniquito import Prefiniquito
from app.models.global_params import SalarioMinimoNacional
from app.schemas.payroll import PayrollResponse, PayslipResponse, PayslipUpdate
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

def calculate_years_diff(start_date: date, target_date: date) -> int:
    return target_date.year - start_date.year - ((target_date.month, target_date.day) < (start_date.month, start_date.day))

import re

def sort_code_key(code_val, fallback_id=0):
    if not code_val:
        return (1, fallback_id, "")
    code_str = str(code_val).strip()
    digits = re.findall(r'\d+', code_str)
    if digits:
        return (0, int(digits[0]), code_str)
    return (0, 999999, code_str)

from app.models.tenant import Tenant

@router.get("/{month}/{year}", response_model=PayrollResponse)
@router.get("/{month}/{year}/", response_model=PayrollResponse, include_in_schema=False)
def get_or_generate_payroll(schema_name: str, month: int, year: int, db: Session = Depends(get_tenant_db)):
    payroll = db.query(Payroll).filter(Payroll.month == month, Payroll.year == year).first()
    smn_actual = get_smn(db, year)
    
    # Obtener info del tenant
    with engine.connect() as conn:
        result = conn.execute(text(f"SELECT name, numero_patronal, nit, empleador_nombres, empleador_apellido_paterno, empleador_apellido_materno, empleador_ci FROM public.tenants WHERE schema_name = '{schema_name}'")).fetchone()
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
        payroll = Payroll(month=month, year=year, is_closed=False)
        db.add(payroll)
        db.commit()
        db.refresh(payroll)
        
    if not payroll.is_closed:
        # Sincronizar empleados con validaciones estrictas de fecha de ingreso y retiro:
        # 1. Purgar de planillas abiertas cualquier boleta de empleados que ingresaron en meses posteriores
        # o que ya se encontraban retirados antes del inicio de este mes.
        slips_to_remove = []
        for p in list(payroll.payslips):
            emp = db.query(Employee).filter(Employee.id == p.employee_id).first()
            if not emp:
                slips_to_remove.append(p)
                continue
            # Si su fecha de ingreso es posterior al fin de este mes, no debe figurar en esta planilla
            if emp.fecha_ingreso > period_end:
                slips_to_remove.append(p)
                continue
            # Si el empleado no está activo, verificar si su retiro fue antes de este mes
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

        # 2. Sincronizar empleados faltantes que sí corresponden a este periodo:
        existing_emp_ids = {p.employee_id for p in payroll.payslips}
        all_employees = db.query(Employee).all()
        missing_employees = []
        for emp in all_employees:
            if emp.id in existing_emp_ids:
                continue
            # El empleado debe haber ingresado a más tardar en este mes
            if emp.fecha_ingreso > period_end:
                continue
            # Si no está activo, solo incluir si su retiro ocurrió durante o después de este mes
            if not emp.is_active:
                pref = db.query(Prefiniquito).filter(Prefiniquito.employee_id == emp.id).order_by(Prefiniquito.id.desc()).first()
                if not pref or pref.fecha_retiro < period_start:
                    continue
            missing_employees.append(emp)
        
        if missing_employees:
            for emp in missing_employees:
                anios_ant = calculate_seniority_years(emp.fecha_ingreso, year, month)
                calc = calcular_boleta_empleado(
                    haber_basico=Decimal(str(emp.haber_basico)),
                    anios_antiguedad=max(0, anios_ant),
                    smn=smn_actual
                )
                
                # Calcular días pagados si ingresó en el transcurso del mes
                dias_pagados = 30
                if emp.fecha_ingreso.year == year and emp.fecha_ingreso.month == month:
                    if emp.fecha_ingreso.day > 1:
                        dias_pagados = max(1, 30 - emp.fecha_ingreso.day + 1)

                payslip = Payslip(
                    payroll_id=payroll.id,
                    employee_id=emp.id,
                    dias_pagados=dias_pagados,
                    horas_pagadas=8,
                    **calc
                )
                db.add(payslip)
            db.commit()
            db.refresh(payroll)

        # 3. Sincronizar automáticamente el bono de antigüedad en boletas existentes si la planilla está abierta
        needs_update = False
        for p in payroll.payslips:
            emp = db.query(Employee).filter(Employee.id == p.employee_id).first()
            if not emp:
                continue
            anios_ant = calculate_seniority_years(emp.fecha_ingreso, year, month)
            expected_bono = calcular_bono_antiguedad(anios_ant, smn_actual)
            if Decimal(str(p.bono_antiguedad or 0)) != expected_bono:
                h_basico = Decimal(str(p.haber_basico or emp.haber_basico))
                calc = calcular_boleta_empleado(
                    haber_basico=h_basico,
                    anios_antiguedad=anios_ant,
                    bono_produccion=Decimal(str(p.bono_produccion or 0)),
                    subsidio_frontera=Decimal(str(p.subsidio_frontera or 0)),
                    trabajo_extraordinario=Decimal(str(p.trabajo_extraordinario or 0)),
                    pago_dominical=Decimal(str(p.pago_dominical or 0)),
                    otros_bonos=Decimal(str(p.otros_bonos or 0)),
                    subsidio_natalidad=Decimal(str(p.subsidio_natalidad or 0)),
                    anticipos=Decimal(str(p.anticipos or 0)),
                    otros_descuentos=Decimal(str(p.otros_descuentos or 0)),
                    smn=smn_actual
                )
                for k, v in calc.items():
                    setattr(p, k, v)
                needs_update = True

        if needs_update:
            db.commit()
            db.refresh(payroll)
            try:
                sync_payroll_documents_on_disk(schema_name=schema_name, month=month, year=year, db=db)
            except Exception as e:
                print(f"[SenioritySync] Error sincronizando documentos: {e}")
    response_data = PayrollResponse.model_validate(payroll)
    response_data.tenant_name = t_name
    response_data.tenant_nro_patronal = t_patronal
    response_data.tenant_nit = t_nit
    response_data.tenant_empleador_nombres = t_emp_nombres
    response_data.tenant_empleador_apellido_paterno = t_emp_paterno
    response_data.tenant_empleador_apellido_materno = t_emp_materno
    response_data.tenant_empleador_ci = t_emp_ci
    
    valid_slips = []
    for slip in response_data.payslips:
        emp = db.query(Employee).filter(Employee.id == slip.employee_id).first()
        if emp:
            if emp.fecha_ingreso > period_end:
                continue
            slip.employee_code = emp.internal_code or str(emp.id)
            slip.employee_name = f"{emp.apellido_paterno} {emp.apellido_materno or ''} {emp.nombres}".strip().replace("  ", " ").upper()
            ext = f" {emp.ext_ci.strip()}" if emp.ext_ci else ""
            slip.employee_ci = f"{emp.documento_identidad.strip()}{ext}".strip()
            slip.employee_cargo = emp.ocupacion
            slip.employee_fecha_ingreso = str(emp.fecha_ingreso)
            slip.employee_nacionalidad = emp.nacionalidad or 'BOLIVIANO'
            slip.employee_fecha_nacimiento = str(emp.fecha_nacimiento)
            slip.employee_sexo = getattr(emp, 'sexo', None) or getattr(emp, 'genero', None) or 'M'
            slip.employee_is_active = emp.is_active
            valid_slips.append(slip)
            
    response_data.payslips = valid_slips

    # Ordenar por número de código de menor a mayor (el menor número primero y el más alto al final)
    response_data.payslips.sort(
        key=lambda s: sort_code_key(s.employee_code, s.employee_id)
    )
    
    return response_data

@router.put("/slip/{payslip_id}", response_model=PayslipResponse)
@router.put("/slip/{payslip_id}/", response_model=PayslipResponse, include_in_schema=False)
def update_payslip_direct(schema_name: str, payslip_id: int, updates: PayslipUpdate, db: Session = Depends(get_tenant_db)):
    payslip = db.query(Payslip).filter(Payslip.id == payslip_id).first()
    if not payslip:
        raise HTTPException(status_code=404, detail="Boleta no encontrada")
    payroll = payslip.payroll
    return update_payslip(schema_name=schema_name, month=payroll.month, year=payroll.year, payslip_id=payslip_id, updates=updates, db=db)

def sync_payroll_documents_on_disk(schema_name: str, month: int, year: int, db: Session, payslip_id: int = None):
    payroll = db.query(Payroll).filter(Payroll.month == month, Payroll.year == year).first()
    if not payroll:
        return
    
    with engine.connect() as conn:
        result = conn.execute(text(f"SELECT name, numero_patronal, nit, empleador_nombres, empleador_apellido_paterno, empleador_apellido_materno, empleador_ci FROM public.tenants WHERE schema_name = '{schema_name}'")).fetchone()
        t_name = result[0] if result else "Empresa"
        t_patronal = result[1] if result and result[1] else "No asignado"
        t_nit = result[2] if result and result[2] else ""
        t_emp_nombres = result[3] if result and result[3] else ""
        t_emp_paterno = result[4] if result and result[4] else ""
        t_emp_materno = result[5] if result and result[5] else ""
        t_emp_ci = result[6] if result and result[6] else ""
    
    t_emp_ext = ""
    if t_emp_ci:
        digits_only = re.sub(r'\D', '', str(t_emp_ci))
        emp_match = db.query(Employee).filter(
            (Employee.documento_identidad == str(t_emp_ci).strip()) | 
            (Employee.documento_identidad == digits_only)
        ).first()
        if emp_match and emp_match.ext_ci:
            t_emp_ext = emp_match.ext_ci

    payslips_dicts = []
    target_boleta_data = None

    for slip in payroll.payslips:
        emp = db.query(Employee).filter(Employee.id == slip.employee_id).first()
        ap_paterno = emp.apellido_paterno if emp else getattr(slip, 'employee_name', '')
        ap_materno = (emp.apellido_materno or '') if emp else ''
        nombres = emp.nombres if emp else ''
        emp_code = (emp.internal_code if emp and emp.internal_code else getattr(slip, 'employee_code', None)) or str(slip.employee_id)
        
        doc_slip = re.sub(r'\s*-\s*', ' ', str(getattr(slip, 'employee_ci', None) or (emp.documento_identidad if emp else ''))).strip()
        h_slip = (round(float(slip.horas_pagadas) / (float(slip.dias_pagados) or 30)) if slip.horas_pagadas and float(slip.horas_pagadas) > 24 else (float(slip.horas_pagadas) if slip.horas_pagadas is not None else 8))

        p_dict = {
            'internal_code': emp_code,
            'documento_identidad': doc_slip,
            'apellido_paterno': ap_paterno,
            'apellido_materno': ap_materno,
            'nombres': nombres,
            'nacionalidad': slip.employee_nacionalidad if hasattr(slip, 'employee_nacionalidad') and slip.employee_nacionalidad else (emp.nacionalidad if emp else 'BOLIVIANO'),
            'fecha_nacimiento': str(emp.fecha_nacimiento) if emp else '',
            'sexo': getattr(emp, 'sexo', None) or getattr(emp, 'genero', None) or 'M' if emp else 'M',
            'ocupacion': emp.ocupacion if emp else getattr(slip, 'employee_cargo', ''),
            'fecha_ingreso': str(emp.fecha_ingreso) if emp else '',
            'horas_pagadas': h_slip,
            'dias_pagados': slip.dias_pagados,
            'haber_basico': slip.haber_basico,
            'bono_antiguedad': slip.bono_antiguedad,
            'bono_produccion': getattr(slip, "bono_produccion", 0),
            'subsidio_frontera': getattr(slip, "subsidio_frontera", 0),
            'trabajo_extraordinario': getattr(slip, "trabajo_extraordinario", 0),
            'pago_dominical': getattr(slip, "pago_dominical", 0),
            'otros_bonos': getattr(slip, "otros_bonos", 0),
            'total_ganado': slip.total_ganado,
            'aporte_gestora': slip.aporte_gestora,
            'rc_iva': slip.rc_iva,
            'otros_descuentos': getattr(slip, "otros_descuentos", 0),
            'anticipos': getattr(slip, "anticipos", 0),
            'total_descuentos': slip.total_descuentos,
            'liquido_pagable': slip.liquido_pagable,
            'empresa_nombre': t_name,
            'nit': t_nit,
            'numero_patronal': t_patronal,
            'empleador_nombres': t_emp_nombres,
            'empleador_apellido_paterno': t_emp_paterno,
            'empleador_apellido_materno': t_emp_materno,
            'empleador_ci': t_emp_ci,
            'empleador_ext_ci': t_emp_ext,
            'mes': month,
            'anio': year
        }
        payslips_dicts.append(p_dict)

        if slip.id == payslip_id:
            target_boleta_data = {
                'internal_code': emp_code,
                'empresa_nombre': t_name,
                'nit': t_nit,
                'numero_patronal': t_patronal,
                'mes': month,
                'anio': year,
                'ci': doc_slip,
                'ext_ci': emp.ext_ci if emp else getattr(slip, "employee_ext_ci", None),
                'nombres': nombres,
                'apellido_paterno': ap_paterno,
                'apellido_materno': ap_materno,
                'fecha_ingreso': str(emp.fecha_ingreso) if emp else '',
                'fecha_nacimiento': str(emp.fecha_nacimiento) if emp else '',
                'cargo': emp.ocupacion if emp else getattr(slip, 'employee_cargo', ''),
                'haber_basico': slip.haber_basico,
                'bono_antiguedad': slip.bono_antiguedad,
                'subsidio_natalidad': getattr(slip, "subsidio_natalidad", 0),
                'aporte_gestora': slip.aporte_gestora,
                'rc_iva': slip.rc_iva,
                'otros_ingresos': float(getattr(slip, "bono_produccion", 0)) + float(getattr(slip, "subsidio_frontera", 0)) + float(getattr(slip, "trabajo_extraordinario", 0)) + float(getattr(slip, "pago_dominical", 0)) + float(getattr(slip, "otros_bonos", 0)),
                'anticipos': getattr(slip, "anticipos", 0),
                'otros_descuentos': getattr(slip, "otros_descuentos", 0),
                'total_ganado': slip.total_ganado,
                'total_descuentos': slip.total_descuentos,
                'liquido_pagable': slip.liquido_pagable,
                'dias_pagados': getattr(slip, "dias_pagados", 30),
                'horas_pagadas': h_slip,
                'bono_produccion': getattr(slip, "bono_produccion", 0),
                'subsidio_frontera': getattr(slip, "subsidio_frontera", 0),
                'trabajo_extraordinario': getattr(slip, "trabajo_extraordinario", 0),
                'pago_dominical': getattr(slip, "pago_dominical", 0),
                'otros_bonos': getattr(slip, "otros_bonos", 0)
            }

    payslips_dicts.sort(key=lambda x: sort_code_key(x.get('internal_code', '')))
    DocumentService.generate_payroll_excel(payslips_dicts, "xlsx", schema_name=schema_name)
    if target_boleta_data:
        DocumentService.generate_payslip(target_boleta_data, "xlsx", schema_name=schema_name)

@router.put("/{month}/{year}/payslips/{payslip_id}", response_model=PayslipResponse)
@router.put("/{month}/{year}/payslips/{payslip_id}/", response_model=PayslipResponse, include_in_schema=False)
def update_payslip(schema_name: str, month: int, year: int, payslip_id: int, updates: PayslipUpdate, db: Session = Depends(get_tenant_db)):
    payslip = db.query(Payslip).filter(Payslip.id == payslip_id).first()
    if not payslip:
        raise HTTPException(status_code=404, detail="Boleta no encontrada")
        
    payroll = payslip.payroll
    if payroll.is_closed:
        raise HTTPException(status_code=400, detail="La planilla de este mes está confirmada y cerrada. No se pueden editar sus boletas.")

    
    # Actualizar valores
    update_data = updates.dict(exclude_unset=True)
    for k, v in update_data.items():
        setattr(payslip, k, v)
        
    # Recalcular todo
    emp = db.query(Employee).filter(Employee.id == payslip.employee_id).first()
    smn_actual = get_smn(db, year)
    anios_ant = calculate_seniority_years(emp.fecha_ingreso, year, month)
    
    calc = calcular_boleta_empleado(
        haber_basico=Decimal(str(payslip.haber_basico)),
        anios_antiguedad=max(0, anios_ant),
        bono_produccion=Decimal(str(payslip.bono_produccion)),
        subsidio_frontera=Decimal(str(payslip.subsidio_frontera)),
        trabajo_extraordinario=Decimal(str(payslip.trabajo_extraordinario)),
        pago_dominical=Decimal(str(payslip.pago_dominical)),
        otros_bonos=Decimal(str(payslip.otros_bonos)),
        subsidio_natalidad=Decimal(str(payslip.subsidio_natalidad)),
        anticipos=Decimal(str(payslip.anticipos)),
        otros_descuentos=Decimal(str(payslip.otros_descuentos)),
        smn=smn_actual
    )
    
    for k, v in calc.items():
        setattr(payslip, k, v)
        
    db.commit()
    db.refresh(payslip)
    
    try:
        sync_payroll_documents_on_disk(schema_name=schema_name, month=month, year=year, db=db, payslip_id=payslip_id)
    except Exception as e:
        print(f"[DocumentSync] Error actualizando planillas en disco: {e}")
    
    response_slip = PayslipResponse.model_validate(payslip)
    response_slip.employee_name = f"{emp.apellido_paterno} {emp.apellido_materno or ''} {emp.nombres}".strip().replace("  ", " ").upper()
    ext = f" - {emp.ext_ci}" if emp.ext_ci else ""
    response_slip.employee_ci = f"{emp.documento_identidad}{ext}"
    response_slip.employee_cargo = emp.ocupacion
    response_slip.employee_fecha_ingreso = str(emp.fecha_ingreso)
    response_slip.employee_nacionalidad = emp.nacionalidad or 'BOLIVIANO'
    response_slip.employee_fecha_nacimiento = str(emp.fecha_nacimiento)
    response_slip.employee_sexo = getattr(emp, 'sexo', None) or getattr(emp, 'genero', None) or 'M'
    
    return response_slip

@router.post("/{month}/{year}/close", response_model=PayrollResponse)
@router.post("/{month}/{year}/close/", response_model=PayrollResponse, include_in_schema=False)
def close_payroll(schema_name: str, month: int, year: int, db: Session = Depends(get_tenant_db)):
    payroll = db.query(Payroll).filter(Payroll.month == month, Payroll.year == year).first()
    if not payroll:
        raise HTTPException(status_code=404, detail="Planilla no encontrada")
    
    if payroll.is_closed:
        raise HTTPException(status_code=400, detail="La planilla ya se encuentra confirmada.")
        
    payroll.is_closed = True
    db.commit()
    db.refresh(payroll)
    
    # Obtener el modelo completo para la respuesta (reutilizando lógica si es necesario, o solo devolviendo el payroll con payslips)
    return get_or_generate_payroll(schema_name, month, year, db)

@router.post("/{month}/{year}/reopen", response_model=PayrollResponse)
@router.post("/{month}/{year}/reopen/", response_model=PayrollResponse, include_in_schema=False)
def reopen_payroll(schema_name: str, month: int, year: int, db: Session = Depends(get_tenant_db)):
    payroll = db.query(Payroll).filter(Payroll.month == month, Payroll.year == year).first()
    if not payroll:
        raise HTTPException(status_code=404, detail="Planilla no encontrada")
    
    if not payroll.is_closed:
        raise HTTPException(status_code=400, detail="La planilla ya se encuentra abierta.")
        
    payroll.is_closed = False
    db.commit()
    db.refresh(payroll)
    
    return get_or_generate_payroll(schema_name, month, year, db)

@router.get("/{month}/{year}/export/excel")
@router.get("/{month}/{year}/export/excel/", include_in_schema=False)
def export_payroll_excel(schema_name: str, month: int, year: int, db: Session = Depends(get_tenant_db)):
    payroll = get_or_generate_payroll(schema_name, month, year, db)
    payroll_dict = payroll.model_dump()
    payslips_dicts = []
    
    t_emp_ci = payroll_dict.get('tenant_empleador_ci', '')
    t_emp_ext = ""
    if t_emp_ci:
        digits_only = re.sub(r'\D', '', str(t_emp_ci))
        emp_match = db.query(Employee).filter(
            (Employee.documento_identidad == str(t_emp_ci).strip()) | 
            (Employee.documento_identidad == digits_only)
        ).first()
        if emp_match and emp_match.ext_ci:
            t_emp_ext = emp_match.ext_ci

    for slip in payroll.payslips:
        emp = db.query(Employee).filter(Employee.id == slip.employee_id).first()
        ap_paterno = emp.apellido_paterno if emp else (slip.employee_name.split(' ')[0] if ' ' in slip.employee_name else slip.employee_name)
        ap_materno = (emp.apellido_materno or '') if emp else (slip.employee_name.split(' ')[1] if len(slip.employee_name.split(' ')) > 1 else '')
        nombres = emp.nombres if emp else (' '.join(slip.employee_name.split(' ')[2:]) if len(slip.employee_name.split(' ')) > 2 else '')
        emp_code = (emp.internal_code if emp and emp.internal_code else slip.employee_code) or str(slip.employee_id)

        payslips_dicts.append({
            'internal_code': emp_code,
            'documento_identidad': re.sub(r'\s*-\s*', ' ', str(slip.employee_ci or '')).strip(),
            'apellido_paterno': ap_paterno,
            'apellido_materno': ap_materno,
            'nombres': nombres,
            'nacionalidad': slip.employee_nacionalidad,
            'fecha_nacimiento': slip.employee_fecha_nacimiento,
            'sexo': slip.employee_sexo,
            'ocupacion': slip.employee_cargo,
            'fecha_ingreso': slip.employee_fecha_ingreso,
            'horas_pagadas': (round(float(slip.horas_pagadas) / (float(slip.dias_pagados) or 30)) if slip.horas_pagadas and float(slip.horas_pagadas) > 24 else (float(slip.horas_pagadas) if slip.horas_pagadas is not None else 8)),
            'dias_pagados': slip.dias_pagados,
            'haber_basico': slip.haber_basico,
            'bono_antiguedad': slip.bono_antiguedad,
            'bono_produccion': getattr(slip, "bono_produccion", 0),
            'subsidio_frontera': getattr(slip, "subsidio_frontera", 0),
            'trabajo_extraordinario': getattr(slip, "trabajo_extraordinario", 0),
            'pago_dominical': getattr(slip, "pago_dominical", 0),
            'otros_bonos': getattr(slip, "otros_bonos", 0),
            'total_ganado': slip.total_ganado,
            'aporte_gestora': slip.aporte_gestora,
            'rc_iva': slip.rc_iva,
            'otros_descuentos': getattr(slip, "otros_descuentos", 0),
            'anticipos': getattr(slip, "anticipos", 0),
            'total_descuentos': slip.total_descuentos,
            'liquido_pagable': slip.liquido_pagable,
            'empresa_nombre': payroll_dict.get('tenant_name', ''),
            'nit': payroll_dict.get('tenant_nit', ''),  
            'numero_patronal': payroll_dict.get('tenant_nro_patronal', ''),
            'empleador_nombres': payroll_dict.get('tenant_empleador_nombres', ''),
            'empleador_apellido_paterno': payroll_dict.get('tenant_empleador_apellido_paterno', ''),
            'empleador_apellido_materno': payroll_dict.get('tenant_empleador_apellido_materno', ''),
            'empleador_ci': t_emp_ci,
            'empleador_ext_ci': t_emp_ext,
            'mes': month,
            'anio': year
        })
    
    # Asegurar orden ascendente por código de menor a mayor
    payslips_dicts.sort(key=lambda x: sort_code_key(x.get('internal_code', '')))
    
    file_path = DocumentService.generate_payroll_excel(payslips_dicts, "xlsx", schema_name=schema_name)
    empresa_slug = DocumentService._slugify(schema_name if schema_name else (payroll_dict.get('tenant_name') or 'empresa'))
    master_path = DocumentService.get_payroll_master_path(empresa_slug, year)
    fecha_act = DocumentService.get_file_last_update_date(master_path)
    return FileResponse(path=file_path, filename=f"planilla_sueldos_{empresa_slug}_{year}_{fecha_act}.xlsx", media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')

@router.get("/{month}/{year}/export/pdf")
@router.get("/{month}/{year}/export/pdf/", include_in_schema=False)
def export_payroll_pdf(schema_name: str, month: int, year: int, db: Session = Depends(get_tenant_db)):
    payroll = get_or_generate_payroll(schema_name, month, year, db)
    payroll_dict = payroll.model_dump()
    payslips_dicts = []
    
    t_emp_ci = payroll_dict.get('tenant_empleador_ci', '')
    t_emp_ext = ""
    if t_emp_ci:
        digits_only = re.sub(r'\D', '', str(t_emp_ci))
        emp_match = db.query(Employee).filter(
            (Employee.documento_identidad == str(t_emp_ci).strip()) | 
            (Employee.documento_identidad == digits_only)
        ).first()
        if emp_match and emp_match.ext_ci:
            t_emp_ext = emp_match.ext_ci

    for slip in payroll.payslips:
        emp = db.query(Employee).filter(Employee.id == slip.employee_id).first()
        ap_paterno = emp.apellido_paterno if emp else (slip.employee_name.split(' ')[0] if ' ' in slip.employee_name else slip.employee_name)
        ap_materno = (emp.apellido_materno or '') if emp else (slip.employee_name.split(' ')[1] if len(slip.employee_name.split(' ')) > 1 else '')
        nombres = emp.nombres if emp else (' '.join(slip.employee_name.split(' ')[2:]) if len(slip.employee_name.split(' ')) > 2 else '')
        emp_code = (emp.internal_code if emp and emp.internal_code else slip.employee_code) or str(slip.employee_id)

        payslips_dicts.append({
            'internal_code': emp_code,
            'documento_identidad': re.sub(r'\s*-\s*', ' ', str(slip.employee_ci or '')).strip(),
            'apellido_paterno': ap_paterno,
            'apellido_materno': ap_materno,
            'nombres': nombres,
            'nacionalidad': slip.employee_nacionalidad,
            'fecha_nacimiento': slip.employee_fecha_nacimiento,
            'sexo': slip.employee_sexo,
            'ocupacion': slip.employee_cargo,
            'fecha_ingreso': slip.employee_fecha_ingreso,
            'horas_pagadas': (round(float(slip.horas_pagadas) / (float(slip.dias_pagados) or 30)) if slip.horas_pagadas and float(slip.horas_pagadas) > 24 else (float(slip.horas_pagadas) if slip.horas_pagadas is not None else 8)),
            'dias_pagados': slip.dias_pagados,
            'haber_basico': slip.haber_basico,
            'bono_antiguedad': slip.bono_antiguedad,
            'bono_produccion': getattr(slip, "bono_produccion", 0),
            'subsidio_frontera': getattr(slip, "subsidio_frontera", 0),
            'trabajo_extraordinario': getattr(slip, "trabajo_extraordinario", 0),
            'pago_dominical': getattr(slip, "pago_dominical", 0),
            'otros_bonos': getattr(slip, "otros_bonos", 0),
            'total_ganado': slip.total_ganado,
            'aporte_gestora': slip.aporte_gestora,
            'rc_iva': slip.rc_iva,
            'otros_descuentos': getattr(slip, "otros_descuentos", 0),
            'anticipos': getattr(slip, "anticipos", 0),
            'total_descuentos': slip.total_descuentos,
            'liquido_pagable': slip.liquido_pagable,
            'empresa_nombre': payroll_dict.get('tenant_name', ''),
            'nit': payroll_dict.get('tenant_nit', ''),
            'numero_patronal': payroll_dict.get('tenant_nro_patronal', ''),
            'empleador_nombres': payroll_dict.get('tenant_empleador_nombres', ''),
            'empleador_apellido_paterno': payroll_dict.get('tenant_empleador_apellido_paterno', ''),
            'empleador_apellido_materno': payroll_dict.get('tenant_empleador_apellido_materno', ''),
            'empleador_ci': t_emp_ci,
            'empleador_ext_ci': t_emp_ext,
            'mes': month,
            'anio': year
        })
    
    # Asegurar orden ascendente por código de menor a mayor
    payslips_dicts.sort(key=lambda x: sort_code_key(x.get('internal_code', '')))
    
    file_path = DocumentService.generate_payroll_excel(payslips_dicts, "pdf", schema_name=schema_name)
    empresa_slug = DocumentService._slugify(schema_name if schema_name else (payroll_dict.get('tenant_name') or 'empresa'))
    master_path = DocumentService.get_payroll_master_path(empresa_slug, year)
    fecha_act = DocumentService.get_file_last_update_date(master_path)
    MESES = {1:"enero", 2:"febrero", 3:"marzo", 4:"abril", 5:"mayo", 6:"junio", 7:"julio", 8:"agosto", 9:"septiembre", 10:"octubre", 11:"noviembre", 12:"diciembre"}
    mes_nombre = MESES.get(month, str(month))
    return FileResponse(path=file_path, filename=f"planilla_sueldos_{empresa_slug}_{mes_nombre}_{year}_{fecha_act}.pdf", media_type='application/pdf')

@router.get("/{month}/{year}/payslips/{payslip_id}/export/{format}")
@router.get("/{month}/{year}/payslips/{payslip_id}/export/{format}/", include_in_schema=False)
def export_payslip(schema_name: str, month: int, year: int, payslip_id: int, format: str, db: Session = Depends(get_tenant_db)):
    payroll = get_or_generate_payroll(schema_name, month, year, db)
    payroll_dict = payroll.model_dump()
    
    target_slip = next((s for s in payroll.payslips if s.id == payslip_id), None)
    if not target_slip:
        raise HTTPException(status_code=404, detail="Boleta no encontrada")
        
    emp = db.query(Employee).filter(Employee.id == target_slip.employee_id).first()
    
    h_slip = getattr(target_slip, "horas_pagadas", 8)
    try:
        if h_slip and float(h_slip) > 24:
            d_val = float(getattr(target_slip, "dias_pagados", 30) or 30)
            h_slip = round(float(h_slip) / d_val) if d_val > 0 else 8
        else:
            h_slip = int(float(h_slip)) if float(h_slip).is_integer() else float(h_slip)
    except:
        h_slip = 8

    doc_slip = re.sub(r'\s*-\s*', ' ', str(target_slip.employee_ci or '')).strip()

    real_internal_code = emp.internal_code if emp and emp.internal_code else str(target_slip.employee_id)
        
    ap_paterno = emp.apellido_paterno if emp else (target_slip.employee_name.split(' ')[0] if ' ' in target_slip.employee_name else target_slip.employee_name)
    ap_materno = (emp.apellido_materno or '') if emp else (target_slip.employee_name.split(' ')[1] if len(target_slip.employee_name.split(' ')) > 1 else '')
    nombres = emp.nombres if emp else (' '.join(target_slip.employee_name.split(' ')[2:]) if len(target_slip.employee_name.split(' ')) > 2 else '')

    boleta_data = {
        'internal_code': real_internal_code,
        'empresa_nombre': payroll_dict.get('tenant_name', ''),
        'nit': payroll_dict.get('tenant_nit', ''),
        'numero_patronal': payroll_dict.get('tenant_nro_patronal', ''),
        'mes': month,
        'anio': year,
        'ci': doc_slip,
        'ext_ci': emp.ext_ci if emp else getattr(target_slip, "employee_ext_ci", None),
        'nombres': nombres,
        'apellido_paterno': ap_paterno,
        'apellido_materno': ap_materno,
        'fecha_ingreso': target_slip.employee_fecha_ingreso,
        'fecha_nacimiento': target_slip.employee_fecha_nacimiento,
        'cargo': target_slip.employee_cargo,
        'haber_basico': target_slip.haber_basico,
        'bono_antiguedad': target_slip.bono_antiguedad,
        'subsidio_natalidad': getattr(target_slip, "subsidio_natalidad", 0),
        'aporte_gestora': target_slip.aporte_gestora,
        'rc_iva': target_slip.rc_iva,
        'otros_ingresos': float(getattr(target_slip, "bono_produccion", 0)) + float(getattr(target_slip, "subsidio_frontera", 0)) + float(getattr(target_slip, "trabajo_extraordinario", 0)) + float(getattr(target_slip, "pago_dominical", 0)) + float(getattr(target_slip, "otros_bonos", 0)),
        'anticipos': getattr(target_slip, "anticipos", 0),
        'otros_descuentos': getattr(target_slip, "otros_descuentos", 0),
        'total_ganado': target_slip.total_ganado,
        'total_descuentos': target_slip.total_descuentos,
        'liquido_pagable': target_slip.liquido_pagable,
        'dias_pagados': getattr(target_slip, "dias_pagados", 30),
        'horas_pagadas': h_slip,
        'bono_produccion': getattr(target_slip, "bono_produccion", 0),
        'subsidio_frontera': getattr(target_slip, "subsidio_frontera", 0),
        'trabajo_extraordinario': getattr(target_slip, "trabajo_extraordinario", 0),
        'pago_dominical': getattr(target_slip, "pago_dominical", 0),
        'otros_bonos': getattr(target_slip, "otros_bonos", 0)
    }
    
    file_path = DocumentService.generate_payslip(boleta_data, format, schema_name=schema_name)
    
    emp_slug = DocumentService._slugify(f"{ap_paterno} {ap_materno} {nombres}".strip()) if (ap_paterno or nombres) else DocumentService._slugify(target_slip.employee_ci)
    empresa_slug = DocumentService._slugify(schema_name if schema_name else boleta_data.get('empresa_nombre', ''))
    _, last_day = calendar.monthrange(year, month)
    fecha_cierre = f"{last_day:02d}-{month:02d}-{year}"
    MESES = {1:"enero", 2:"febrero", 3:"marzo", 4:"abril", 5:"mayo", 6:"junio", 7:"julio", 8:"agosto", 9:"septiembre", 10:"octubre", 11:"noviembre", 12:"diciembre"}
    mes_nombre = MESES.get(month, str(month))

    media_type = 'application/pdf' if format == "pdf" else 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    filename = f"boleta_pago_{emp_slug}_{empresa_slug}_{mes_nombre}_{year}_{fecha_cierre}.pdf" if format == "pdf" else f"boleta_pago_{emp_slug}_{empresa_slug}_{year}_{fecha_cierre}.xlsx"
    return FileResponse(path=file_path, filename=filename, media_type=media_type)
