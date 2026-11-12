from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List

from app.db.session import get_tenant_db
from app.models.department import Department
from app.models.employee import Employee
from app.schemas.department import (
    DepartmentCreate,
    DepartmentUpdate,
    DepartmentResponse,
    DepartmentAssign
)

router = APIRouter()

@router.get("/", response_model=List[DepartmentResponse])
@router.get("", response_model=List[DepartmentResponse], include_in_schema=False)
def list_departments(schema_name: str, db: Session = Depends(get_tenant_db)):
    depts = db.query(Department).order_by(Department.id.asc()).all()
    result = []
    for d in depts:
        emp_count = db.query(func.count(Employee.id)).filter(
            Employee.department_id == d.id,
            Employee.is_active == True
        ).scalar() or 0
        
        result.append(DepartmentResponse(
            id=d.id,
            name=d.name,
            account_type=d.account_type,
            description=d.description,
            created_at=d.created_at,
            employee_count=emp_count
        ))
    return result

@router.post("/", response_model=DepartmentResponse)
@router.post("", response_model=DepartmentResponse, include_in_schema=False)
def create_department(schema_name: str, dept_in: DepartmentCreate, db: Session = Depends(get_tenant_db)):
    existing = db.query(Department).filter(
        func.lower(Department.name) == dept_in.name.strip().lower()
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Ya existe un departamento con ese nombre")

    new_dept = Department(
        name=dept_in.name.strip(),
        account_type=dept_in.account_type or dept_in.name.strip(),
        description=dept_in.description
    )
    db.add(new_dept)
    db.commit()
    db.refresh(new_dept)
    
    return DepartmentResponse(
        id=new_dept.id,
        name=new_dept.name,
        account_type=new_dept.account_type,
        description=new_dept.description,
        created_at=new_dept.created_at,
        employee_count=0
    )

@router.put("/{dept_id}", response_model=DepartmentResponse)
def update_department(schema_name: str, dept_id: int, dept_in: DepartmentUpdate, db: Session = Depends(get_tenant_db)):
    dept = db.query(Department).filter(Department.id == dept_id).first()
    if not dept:
        raise HTTPException(status_code=404, detail="Departamento no encontrado")
        
    if dept_in.name is not None:
        dept.name = dept_in.name.strip()
    if dept_in.account_type is not None:
        dept.account_type = dept_in.account_type
    if dept_in.description is not None:
        dept.description = dept_in.description
        
    db.commit()
    db.refresh(dept)
    
    # Sincronizar el nombre del departamento en los empleados asignados
    db.query(Employee).filter(Employee.department_id == dept.id).update(
        {Employee.departamento: dept.name}
    )
    db.commit()
    
    emp_count = db.query(func.count(Employee.id)).filter(
        Employee.department_id == dept.id,
        Employee.is_active == True
    ).scalar() or 0
    
    return DepartmentResponse(
        id=dept.id,
        name=dept.name,
        account_type=dept.account_type,
        description=dept.description,
        created_at=dept.created_at,
        employee_count=emp_count
    )

@router.delete("/{dept_id}")
def delete_department(schema_name: str, dept_id: int, db: Session = Depends(get_tenant_db)):
    dept = db.query(Department).filter(Department.id == dept_id).first()
    if not dept:
        raise HTTPException(status_code=404, detail="Departamento no encontrado")
        
    # Desvincular empleados de este departamento
    db.query(Employee).filter(Employee.department_id == dept_id).update(
        {Employee.department_id: None, Employee.departamento: None}
    )
    
    db.delete(dept)
    db.commit()
    return {"message": "Departamento eliminado exitosamente"}

@router.post("/{dept_id}/assign")
def assign_employees(schema_name: str, dept_id: int, assign_in: DepartmentAssign, db: Session = Depends(get_tenant_db)):
    dept = db.query(Department).filter(Department.id == dept_id).first()
    if not dept:
        raise HTTPException(status_code=404, detail="Departamento no encontrado")
        
    # Asignar empleados seleccionados a este departamento
    db.query(Employee).filter(Employee.id.in_(assign_in.employee_ids)).update(
        {Employee.department_id: dept.id, Employee.departamento: dept.name},
        synchronize_session=False
    )
    db.commit()
    
    return {"message": f"{len(assign_in.employee_ids)} colaboradores asignados a {dept.name}"}
