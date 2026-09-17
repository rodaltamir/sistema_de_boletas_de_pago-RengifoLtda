from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List

from app.db.session import get_tenant_session
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
def list_departments(schema_name: str):
    session = get_tenant_session(schema_name)
    try:
        depts = session.query(Department).order_by(Department.id.asc()).all()
        result = []
        for d in depts:
            emp_count = session.query(func.count(Employee.id)).filter(
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
    finally:
        session.close()

@router.post("/", response_model=DepartmentResponse)
@router.post("", response_model=DepartmentResponse, include_in_schema=False)
def create_department(schema_name: str, dept_in: DepartmentCreate):
    session = get_tenant_session(schema_name)
    try:
        # Check if department with same name already exists
        existing = session.query(Department).filter(
            func.lower(Department.name) == dept_in.name.strip().lower()
        ).first()
        if existing:
            raise HTTPException(status_code=400, detail="Ya existe un departamento con ese nombre")

        new_dept = Department(
            name=dept_in.name.strip(),
            account_type=dept_in.account_type or dept_in.name.strip(),
            description=dept_in.description
        )
        session.add(new_dept)
        session.commit()
        session.refresh(new_dept)
        
        return DepartmentResponse(
            id=new_dept.id,
            name=new_dept.name,
            account_type=new_dept.account_type,
            description=new_dept.description,
            created_at=new_dept.created_at,
            employee_count=0
        )
    finally:
        session.close()

@router.put("/{dept_id}", response_model=DepartmentResponse)
def update_department(schema_name: str, dept_id: int, dept_in: DepartmentUpdate):
    session = get_tenant_session(schema_name)
    try:
        dept = session.query(Department).filter(Department.id == dept_id).first()
        if not dept:
            raise HTTPException(status_code=404, detail="Departamento no encontrado")
            
        if dept_in.name is not None:
            dept.name = dept_in.name.strip()
        if dept_in.account_type is not None:
            dept.account_type = dept_in.account_type
        if dept_in.description is not None:
            dept.description = dept_in.description
            
        session.commit()
        session.refresh(dept)
        
        # Sincronizar el nombre del departamento en los empleados asignados
        session.query(Employee).filter(Employee.department_id == dept.id).update(
            {Employee.departamento: dept.name}
        )
        session.commit()
        
        emp_count = session.query(func.count(Employee.id)).filter(
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
    finally:
        session.close()

@router.delete("/{dept_id}")
def delete_department(schema_name: str, dept_id: int):
    session = get_tenant_session(schema_name)
    try:
        dept = session.query(Department).filter(Department.id == dept_id).first()
        if not dept:
            raise HTTPException(status_code=404, detail="Departamento no encontrado")
            
        # Desvincular empleados de este departamento
        session.query(Employee).filter(Employee.department_id == dept_id).update(
            {Employee.department_id: None, Employee.departamento: None}
        )
        
        session.delete(dept)
        session.commit()
        return {"message": "Departamento eliminado exitosamente"}
    finally:
        session.close()

@router.post("/{dept_id}/assign")
def assign_employees(schema_name: str, dept_id: int, assign_in: DepartmentAssign):
    session = get_tenant_session(schema_name)
    try:
        dept = session.query(Department).filter(Department.id == dept_id).first()
        if not dept:
            raise HTTPException(status_code=404, detail="Departamento no encontrado")
            
        # Asignar empleados seleccionados a este departamento
        session.query(Employee).filter(Employee.id.in_(assign_in.employee_ids)).update(
            {Employee.department_id: dept.id, Employee.departamento: dept.name},
            synchronize_session=False
        )
        session.commit()
        
        return {"message": f"{len(assign_in.employee_ids)} colaboradores asignados a {dept.name}"}
    finally:
        session.close()
