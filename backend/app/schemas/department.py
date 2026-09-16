from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

class DepartmentBase(BaseModel):
    name: str
    account_type: str = "MANO_DE_OBRA"  # "ADMINISTRACION" o "MANO_DE_OBRA"
    description: Optional[str] = None

class DepartmentCreate(DepartmentBase):
    pass

class DepartmentUpdate(BaseModel):
    name: Optional[str] = None
    account_type: Optional[str] = None
    description: Optional[str] = None

class DepartmentResponse(DepartmentBase):
    id: int
    created_at: Optional[datetime] = None
    employee_count: Optional[int] = 0

    class Config:
        from_attributes = True

class DepartmentAssign(BaseModel):
    employee_ids: List[int]
