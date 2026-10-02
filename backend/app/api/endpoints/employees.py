from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy import text
from app.db.session import engine
from app.models.employee import Employee
from app.models.department import Department
from app.models.payroll import Payslip, Payroll
from app.models.prefiniquito import Prefiniquito
from app.schemas.employee import EmployeeCreate, EmployeeUpdate, EmployeeResponse
from app.services.payroll_service import calcular_boleta_empleado, calculate_seniority_years
from app.services.document_service import DocumentService
from decimal import Decimal
from datetime import date, datetime
import calendar
from app.models.global_params import SalarioMinimoNacional

router = APIRouter()

def get_tenant_db(schema_name: str):
    engine_with_schema = engine.execution_options(schema_translate_map={'tenant': schema_name})
    SessionTenant = sessionmaker(autocommit=False, autoflush=False, bind=engine_with_schema)
    db = SessionTenant()
    try:
        yield db
    finally:
        db.close()

def get_smn(db: Session, year: int) -> Decimal:
    smn = db.query(SalarioMinimoNacional).filter(SalarioMinimoNacional.year == year).first()
    return Decimal(str(smn.amount)) if smn else Decimal('3300.00')

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

@router.get('', response_model=list[EmployeeResponse])
@router.get('/', response_model=list[EmployeeResponse], include_in_schema=False)
def get_employees(schema_name: str, db: Session = Depends(get_tenant_db)):
    try:
        employees = db.query(Employee).all()
        return sorted(employees, key=lambda e: sort_code_key(e.internal_code, e.id))
    except Exception as e:
        raise HTTPException(status_code=500, detail='Error de base de datos. Verifica si el entorno existe.')

@router.get('/export/excel')
@router.get('/export/excel/', include_in_schema=False)
def export_employees_excel(
    schema_name: str,
    status: str = "todos",
    db: Session = Depends(get_tenant_db)
):
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

    query = db.query(Employee)
    if status.lower() == "activos":
        query = query.filter(Employee.is_active == True)
    elif status.lower() == "desvinculados":
        query = query.filter(Employee.is_active == False)
    
    employees = query.all()
    employees = sorted(employees, key=lambda e: sort_code_key(e.internal_code, e.id))

    prefiniquitos = db.query(Prefiniquito).order_by(Prefiniquito.id.desc()).all()
    pref_map = {}
    for p in prefiniquitos:
        if p.employee_id not in pref_map:
            pref_map[p.employee_id] = p.fecha_retiro

    emps_data = []
    for emp in employees:
        f_retiro = pref_map.get(emp.id) if not emp.is_active else None
        emps_data.append({
            'id': emp.id,
            'internal_code': emp.internal_code or '',
            'documento_identidad': emp.documento_identidad,
            'ext_ci': emp.ext_ci or '',
            'nombres': emp.nombres,
            'apellido_paterno': emp.apellido_paterno,
            'apellido_materno': emp.apellido_materno or '',
            'sexo': emp.sexo,
            'fecha_nacimiento': emp.fecha_nacimiento,
            'nacionalidad': emp.nacionalidad,
            'ocupacion': emp.ocupacion,
            'departamento': emp.departamento or 'Sin departamento',
            'fecha_ingreso': emp.fecha_ingreso,
            'fecha_retiro': f_retiro,
            'haber_basico': float(emp.haber_basico or 0.0),
            'is_active': emp.is_active
        })

    payload = {
        'empresa_nombre': t_name,
        'nit': t_nit,
        'numero_patronal': t_patronal,
        'representante_legal': rep_legal,
        'ci_representante': t_emp_ci,
        'filter_status': status,
        'employees': emps_data
    }

    file_path = DocumentService.generate_employees_excel(payload, output_format="xlsx", schema_name=schema_name)
    empresa_slug = DocumentService._slugify(schema_name if schema_name else t_name)
    now_str = datetime.now().strftime("%d-%m-%Y")
    filename = f"nomina_empleados_{empresa_slug}_{now_str}.xlsx"
    return FileResponse(path=file_path, filename=filename, media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")

@router.get('/export/pdf')
@router.get('/export/pdf/', include_in_schema=False)
def export_employees_pdf(
    schema_name: str,
    status: str = "todos",
    db: Session = Depends(get_tenant_db)
):
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

    query = db.query(Employee)
    if status.lower() == "activos":
        query = query.filter(Employee.is_active == True)
    elif status.lower() == "desvinculados":
        query = query.filter(Employee.is_active == False)
    
    employees = query.all()
    employees = sorted(employees, key=lambda e: sort_code_key(e.internal_code, e.id))

    prefiniquitos = db.query(Prefiniquito).order_by(Prefiniquito.id.desc()).all()
    pref_map = {}
    for p in prefiniquitos:
        if p.employee_id not in pref_map:
            pref_map[p.employee_id] = p.fecha_retiro

    emps_data = []
    for emp in employees:
        f_retiro = pref_map.get(emp.id) if not emp.is_active else None
        emps_data.append({
            'id': emp.id,
            'internal_code': emp.internal_code or '',
            'documento_identidad': emp.documento_identidad,
            'ext_ci': emp.ext_ci or '',
            'nombres': emp.nombres,
            'apellido_paterno': emp.apellido_paterno,
            'apellido_materno': emp.apellido_materno or '',
            'sexo': emp.sexo,
            'fecha_nacimiento': emp.fecha_nacimiento,
            'nacionalidad': emp.nacionalidad,
            'ocupacion': emp.ocupacion,
            'departamento': emp.departamento or 'Sin departamento',
            'fecha_ingreso': emp.fecha_ingreso,
            'fecha_retiro': f_retiro,
            'haber_basico': float(emp.haber_basico or 0.0),
            'is_active': emp.is_active
        })

    payload = {
        'empresa_nombre': t_name,
        'nit': t_nit,
        'numero_patronal': t_patronal,
        'representante_legal': rep_legal,
        'ci_representante': t_emp_ci,
        'filter_status': status,
        'employees': emps_data
    }

    file_path = DocumentService.generate_employees_excel(payload, output_format="pdf", schema_name=schema_name)
    empresa_slug = DocumentService._slugify(schema_name if schema_name else t_name)
    now_str = datetime.now().strftime("%d-%m-%Y")
    filename = f"nomina_empleados_{empresa_slug}_{now_str}.pdf"
    return FileResponse(path=file_path, filename=filename, media_type="application/pdf")

@router.post('', response_model=EmployeeResponse)
@router.post('/', response_model=EmployeeResponse, include_in_schema=False)
def create_employee(schema_name: str, employee: EmployeeCreate, db: Session = Depends(get_tenant_db)):
    # Validación legal de fechas
    if employee.fecha_ingreso and employee.fecha_nacimiento:
        if employee.fecha_ingreso <= employee.fecha_nacimiento:
            raise HTTPException(
                status_code=400,
                detail="La fecha de ingreso no puede ser anterior o igual a la fecha de nacimiento del empleado."
            )
        edad_ingreso = calculate_years_diff(employee.fecha_nacimiento, employee.fecha_ingreso)
        if edad_ingreso < 14:
            raise HTTPException(
                status_code=400,
                detail=f"Fecha de ingreso inválida: el empleado tendría {edad_ingreso} años al ingresar (edad mínima legal de trabajo en Bolivia: 14 años)."
            )

    db_employee = db.query(Employee).filter(Employee.documento_identidad == employee.documento_identidad).first()
    if db_employee:
        if not db_employee.is_active:
            # Reactivar y actualizar datos
            update_data = employee.dict(exclude_unset=True)
            for key, value in update_data.items():
                setattr(db_employee, key, value)
            db_employee.is_active = True
            db.commit()
            db.refresh(db_employee)
            return db_employee
        else:
            raise HTTPException(status_code=400, detail='El documento de identidad ya está registrado y se encuentra activo.')
    
    emp_data = employee.dict()
    if emp_data.get("department_id"):
        dept = db.query(Department).filter(Department.id == emp_data["department_id"]).first()
        if dept:
            emp_data["departamento"] = dept.name
    new_emp = Employee(**emp_data)
    db.add(new_emp)
    db.commit()
    db.refresh(new_emp)
    return new_emp

@router.put('/{emp_id}', response_model=EmployeeResponse)
@router.put('/{emp_id}/', response_model=EmployeeResponse, include_in_schema=False)
def update_employee(schema_name: str, emp_id: int, employee: EmployeeUpdate, db: Session = Depends(get_tenant_db)):
    db_emp = db.query(Employee).filter(Employee.id == emp_id).first()
    if not db_emp:
        raise HTTPException(status_code=404, detail='Empleado no encontrado')
    
    update_data = employee.dict(exclude_unset=True)
    f_nac = update_data.get("fecha_nacimiento") or db_emp.fecha_nacimiento
    f_ing = update_data.get("fecha_ingreso") or db_emp.fecha_ingreso
    if f_nac and f_ing:
        if f_ing <= f_nac:
            raise HTTPException(
                status_code=400,
                detail="La fecha de ingreso no puede ser anterior o igual a la fecha de nacimiento del empleado."
            )
        edad_ingreso = calculate_years_diff(f_nac, f_ing)
        if edad_ingreso < 14:
            raise HTTPException(
                status_code=400,
                detail=f"Fecha de ingreso inválida: el empleado tendría {edad_ingreso} años al ingresar (edad mínima legal de trabajo en Bolivia: 14 años)."
            )

    if "department_id" in update_data:
        if update_data["department_id"]:
            dept = db.query(Department).filter(Department.id == update_data["department_id"]).first()
            if dept:
                update_data["departamento"] = dept.name
        else:
            update_data["departamento"] = None

    for key, value in update_data.items():
        setattr(db_emp, key, value)
        
    db.commit()
    db.refresh(db_emp)
    
    # --- FIX: Recalculate open payslips in real-time ---
    # Find open payrolls
    open_payrolls = db.query(Payroll).filter(Payroll.is_closed == False).all()
    open_payroll_ids = [p.id for p in open_payrolls]
    
    if open_payroll_ids:
        payslips = db.query(Payslip).filter(Payslip.employee_id == emp_id, Payslip.payroll_id.in_(open_payroll_ids)).all()
        for p in payslips:
            payroll = next(pr for pr in open_payrolls if pr.id == p.payroll_id)
            _, last_day = calendar.monthrange(payroll.year, payroll.month)
            period_end = date(payroll.year, payroll.month, last_day)
            if db_emp.fecha_ingreso > period_end:
                db.delete(p)
                continue
            smn_actual = get_smn(db, payroll.year)
            anios_ant = calculate_seniority_years(db_emp.fecha_ingreso, payroll.year, payroll.month)
            
            calc = calcular_boleta_empleado(
                haber_basico=Decimal(str(db_emp.haber_basico)),
                anios_antiguedad=max(0, anios_ant),
                bono_produccion=Decimal(str(p.bono_produccion)),
                subsidio_frontera=Decimal(str(p.subsidio_frontera)),
                trabajo_extraordinario=Decimal(str(p.trabajo_extraordinario)),
                pago_dominical=Decimal(str(p.pago_dominical)),
                otros_bonos=Decimal(str(p.otros_bonos)),
                subsidio_natalidad=Decimal(str(p.subsidio_natalidad)),
                anticipos=Decimal(str(p.anticipos)),
                otros_descuentos=Decimal(str(p.otros_descuentos)),
                smn=smn_actual
            )
            for k, v in calc.items():
                setattr(p, k, v)
        db.commit()
    # --------------------------------------------------

    return db_emp

@router.post('/{emp_id}/reactivate', response_model=EmployeeResponse)
@router.post('/{emp_id}/reactivate/', response_model=EmployeeResponse, include_in_schema=False)
def reactivate_employee(schema_name: str, emp_id: int, db: Session = Depends(get_tenant_db)):
    db_emp = db.query(Employee).filter(Employee.id == emp_id).first()
    if not db_emp:
        raise HTTPException(status_code=404, detail='Empleado no encontrado')
    
    db_emp.is_active = True
    db.commit()
    db.refresh(db_emp)
    return db_emp

@router.delete('/{emp_id}')
@router.delete('/{emp_id}/', include_in_schema=False)
def delete_employee(schema_name: str, emp_id: int, db: Session = Depends(get_tenant_db)):
    db_emp = db.query(Employee).filter(Employee.id == emp_id).first()
    if not db_emp:
        raise HTTPException(status_code=404, detail='Empleado no encontrado')
    
    # Delete associated payslips and prefiniquitos first to avoid FK constraint violations
    db.query(Payslip).filter(Payslip.employee_id == emp_id).delete(synchronize_session=False)
    db.query(Prefiniquito).filter(Prefiniquito.employee_id == emp_id).delete(synchronize_session=False)
    
    db.delete(db_emp)
    db.commit()
    return {'detail': 'Empleado eliminado exitosamente'}
