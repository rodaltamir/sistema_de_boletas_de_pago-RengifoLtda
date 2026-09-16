from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, sessionmaker
from app.db.session import engine
from app.models.employee import Employee
from app.models.department import Department
from app.models.payroll import Payslip, Payroll
from app.models.prefiniquito import Prefiniquito
from app.schemas.employee import EmployeeCreate, EmployeeUpdate, EmployeeResponse
from app.services.payroll_service import calcular_boleta_empleado
from decimal import Decimal
from datetime import date
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

@router.post('', response_model=EmployeeResponse)
@router.post('/', response_model=EmployeeResponse, include_in_schema=False)
def create_employee(schema_name: str, employee: EmployeeCreate, db: Session = Depends(get_tenant_db)):
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
            smn_actual = get_smn(db, payroll.year)
            anios_ant = calculate_years_diff(db_emp.fecha_ingreso, date(payroll.year, payroll.month, 1))
            
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
