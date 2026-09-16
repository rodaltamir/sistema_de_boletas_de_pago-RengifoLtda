from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.endpoints import payrolls, tenants, employees, prefiniquitos, auth, departments, accounting
from app.db.migrate_tenants import migrate_tenants

app = FastAPI(
    title="SaaS Planillas de Pago",
    description="Backend para la gestión multi-tenant de Recursos Humanos",
    version="1.0.0",
)

@app.on_event("startup")
def on_startup():
    try:
        migrate_tenants()
    except Exception as e:
        print(f"Error en migración inicial de tenants: {e}")

# Configuración CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Modificar en producción
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition"],
)

app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(payrolls.router, prefix="/api/tenants/{schema_name}/payrolls", tags=["payrolls"])
app.include_router(tenants.router, prefix="/api/tenants", tags=["tenants"])
app.include_router(employees.router, prefix="/api/tenants/{schema_name}/employees", tags=["employees"])
app.include_router(departments.router, prefix="/api/tenants/{schema_name}/departments", tags=["departments"])
app.include_router(accounting.router, prefix="/api/tenants/{schema_name}/asientos", tags=["accounting"])
app.include_router(prefiniquitos.router, prefix="/api/tenants/{schema_name}/prefiniquitos", tags=["prefiniquitos"])

@app.get("/")
def read_root():
    return {"message": "SaaS Planillas de Pago - Rengifo API"}

@app.get("/health")
def health_check():
    return {"status": "ok"}
