from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, sessionmaker
from app.db.session import engine
from app.models.employee import Employee
from app.models.payroll import Payslip, Payroll
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

@router.get('/', response_model=list[EmployeeResponse])
def get_employees(schema_name: str, db: Session = Depends(get_tenant_db)):
    try:
        return db.query(Employee).order_by(Employee.id.desc()).all()
    except Exception as e:
        raise HTTPException(status_code=500, detail='Error de base de datos. Verifica si el entorno existe.')

@router.post('/', response_model=EmployeeResponse)
def create_employee(schema_name: str, employee: EmployeeCreate, db: Session = Depends(get_tenant_db)):
    db_employee = db.query(Employee).filter(Employee.documento_identidad == employee.documento_identidad).first()
    if db_employee:
        raise HTTPException(status_code=400, detail='El documento de identidad ya está registrado.')
    
    new_emp = Employee(**employee.dict())
    db.add(new_emp)
    db.commit()
    db.refresh(new_emp)
    return new_emp

@router.put('/{emp_id}', response_model=EmployeeResponse)
def update_employee(schema_name: str, emp_id: int, employee: EmployeeUpdate, db: Session = Depends(get_tenant_db)):
    db_emp = db.query(Employee).filter(Employee.id == emp_id).first()
    if not db_emp:
        raise HTTPException(status_code=404, detail='Empleado no encontrado')
    
    update_data = employee.dict(exclude_unset=True)
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

@router.delete('/{emp_id}')
def delete_employee(schema_name: str, emp_id: int, db: Session = Depends(get_tenant_db)):
    db_emp = db.query(Employee).filter(Employee.id == emp_id).first()
    if not db_emp:
        raise HTTPException(status_code=404, detail='Empleado no encontrado')
    
    # --- FIX: Delete associated payslips first to avoid FK constraint violation ---
    db.query(Payslip).filter(Payslip.employee_id == emp_id).delete(synchronize_session=False)
    
    db.delete(db_emp)
    db.commit()
    return {'detail': 'Empleado eliminado exitosamente'}
