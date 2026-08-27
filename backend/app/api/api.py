from fastapi import APIRouter
from app.api.endpoints import payrolls

api_router = APIRouter()
api_router.include_router(payrolls.router, prefix="/payrolls", tags=["Planillas"])
