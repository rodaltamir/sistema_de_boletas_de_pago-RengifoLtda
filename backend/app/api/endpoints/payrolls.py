from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text
from decimal import Decimal
from datetime import date

from app.db.session import engine
from sqlalchemy.orm import sessionmaker
from app.models.payroll import Payroll, Payslip
from app.models.employee import Employee
from app.models.global_params import SalarioMinimoNacional
from app.schemas.payroll import PayrollResponse, PayslipResponse, PayslipUpdate
from app.services.payroll_service import calcular_boleta_empleado

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
    
    if not payroll:
        payroll = Payroll(month=month, year=year, is_closed=False)
        db.add(payroll)
        db.commit()
        db.refresh(payroll)
        
    if not payroll.is_closed:
        # Sincronizar empleados: asegurar que todos los activos tengan boleta
        existing_emp_ids = {p.employee_id for p in payroll.payslips}
        empleados = db.query(Employee).filter(Employee.is_active == True).all()
        missing_employees = [emp for emp in empleados if emp.id not in existing_emp_ids]
        
        if missing_employees:
            target_date = date(year, month, 1)
            for emp in missing_employees:
                anios_ant = calculate_years_diff(emp.fecha_ingreso, target_date)
                calc = calcular_boleta_empleado(
                    haber_basico=Decimal(str(emp.haber_basico)),
                    anios_antiguedad=max(0, anios_ant),
                    smn=smn_actual
                )
                
                payslip = Payslip(
                    payroll_id=payroll.id,
                    employee_id=emp.id,
                    dias_pagados=30,
                    horas_pagadas=240,
                    **calc
                )
                db.add(payslip)
            db.commit()
            db.refresh(payroll)
            
    response_data = PayrollResponse.model_validate(payroll)
    response_data.tenant_name = t_name
    response_data.tenant_nro_patronal = t_patronal
    response_data.tenant_nit = t_nit
    response_data.tenant_empleador_nombres = t_emp_nombres
    response_data.tenant_empleador_apellido_paterno = t_emp_paterno
    response_data.tenant_empleador_apellido_materno = t_emp_materno
    response_data.tenant_empleador_ci = t_emp_ci
    
    for slip in response_data.payslips:
        emp = db.query(Employee).filter(Employee.id == slip.employee_id).first()
        if emp:
            slip.employee_code = emp.internal_code or str(emp.id)
            slip.employee_name = f"{emp.apellido_paterno} {emp.apellido_materno or ''} {emp.nombres}".strip().replace("  ", " ").upper()
            ext = f" - {emp.ext_ci}" if emp.ext_ci else ""
            slip.employee_ci = f"{emp.documento_identidad}{ext}"
            slip.employee_cargo = emp.ocupacion
            slip.employee_fecha_ingreso = str(emp.fecha_ingreso)
            slip.employee_nacionalidad = emp.nacionalidad or 'BOLIVIANO'
            slip.employee_fecha_nacimiento = str(emp.fecha_nacimiento)
            slip.employee_sexo = getattr(emp, 'sexo', None) or getattr(emp, 'genero', None) or 'M'
            slip.employee_is_active = emp.is_active
            
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
    anios_ant = calculate_years_diff(emp.fecha_ingreso, date(year, month, 1))
    
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


from fastapi.responses import FileResponse
from app.services.document_service import DocumentService
import os

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
            'documento_identidad': slip.employee_ci,
            'apellido_paterno': ap_paterno,
            'apellido_materno': ap_materno,
            'nombres': nombres,
            'nacionalidad': slip.employee_nacionalidad,
            'fecha_nacimiento': slip.employee_fecha_nacimiento,
            'sexo': slip.employee_sexo,
            'ocupacion': slip.employee_cargo,
            'fecha_ingreso': slip.employee_fecha_ingreso,
            'horas_pagadas': slip.horas_pagadas,
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
    
    file_path = DocumentService.generate_payroll_excel(payslips_dicts, "xlsx")
    return FileResponse(path=file_path, filename=f"Planilla_Sueldos_{month}_{year}.xlsx", media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')

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
            'documento_identidad': slip.employee_ci,
            'apellido_paterno': ap_paterno,
            'apellido_materno': ap_materno,
            'nombres': nombres,
            'nacionalidad': slip.employee_nacionalidad,
            'fecha_nacimiento': slip.employee_fecha_nacimiento,
            'sexo': slip.employee_sexo,
            'ocupacion': slip.employee_cargo,
            'fecha_ingreso': slip.employee_fecha_ingreso,
            'horas_pagadas': slip.horas_pagadas,
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
    
    file_path = DocumentService.generate_payroll_excel(payslips_dicts, "pdf")
    return FileResponse(path=file_path, filename=f"Planilla_Sueldos_{month}_{year}.pdf", media_type='application/pdf')

@router.get("/{month}/{year}/payslips/{payslip_id}/export/{format}")
@router.get("/{month}/{year}/payslips/{payslip_id}/export/{format}/", include_in_schema=False)
def export_payslip(schema_name: str, month: int, year: int, payslip_id: int, format: str, db: Session = Depends(get_tenant_db)):
    payroll = get_or_generate_payroll(schema_name, month, year, db)
    payroll_dict = payroll.model_dump()
    
    target_slip = next((s for s in payroll.payslips if s.id == payslip_id), None)
    if not target_slip:
        raise HTTPException(status_code=404, detail="Boleta no encontrada")
        
    emp = db.query(Employee).filter(Employee.id == target_slip.employee_id).first()
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
        'ci': target_slip.employee_ci,
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
        'horas_pagadas': getattr(target_slip, "horas_pagadas", 240),
        'bono_produccion': getattr(target_slip, "bono_produccion", 0),
        'subsidio_frontera': getattr(target_slip, "subsidio_frontera", 0),
        'trabajo_extraordinario': getattr(target_slip, "trabajo_extraordinario", 0),
        'pago_dominical': getattr(target_slip, "pago_dominical", 0),
        'otros_bonos': getattr(target_slip, "otros_bonos", 0)
    }
    
    file_path = DocumentService.generate_payslip(boleta_data, format)
    
    media_type = 'application/pdf' if format == "pdf" else 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    filename = f"Boleta_Pago_{target_slip.employee_ci}.pdf" if format == "pdf" else f"Boleta_Pago_{target_slip.employee_ci}.xlsx"
    return FileResponse(path=file_path, filename=filename, media_type=media_type)
