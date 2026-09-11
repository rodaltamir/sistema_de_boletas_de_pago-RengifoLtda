from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.orm.attributes import flag_modified
from sqlalchemy import text
from app.db.session import SessionLocal, engine
from app.models.employee import Employee
from app.models.prefiniquito import Prefiniquito
from app.schemas.prefiniquito import PrefiniquitoCreate, PrefiniquitoResponse, PrefiniquitoBase, CuotaPagarRequest, PagoRegistrarRequest
from app.services.prefiniquito_service import calculate_prefiniquito, calculate_time_worked
from app.services.document_service import DocumentService
from app.models.tenant import Tenant
from datetime import date
import os
import uuid

router = APIRouter()

_migrated_schemas = set()

def ensure_tenant_schema_migrated(schema_name: str):
    if schema_name in _migrated_schemas:
        return
    try:
        with engine.begin() as conn:
            conn.execute(text(f"""
                ALTER TABLE IF EXISTS "{schema_name}".prefiniquitos 
                ADD COLUMN IF NOT EXISTS tipo_otros_pagos VARCHAR(20) DEFAULT 'directo',
                ADD COLUMN IF NOT EXISTS otros_pagos_detalle VARCHAR(255),
                ADD COLUMN IF NOT EXISTS cuotas_total INTEGER DEFAULT 1,
                ADD COLUMN IF NOT EXISTS cuotas_pagadas INTEGER DEFAULT 0,
                ADD COLUMN IF NOT EXISTS monto_cuota NUMERIC(12, 2) DEFAULT 0,
                ADD COLUMN IF NOT EXISTS cuotas_historial JSONB DEFAULT '[]'::jsonb;
            """))
        _migrated_schemas.add(schema_name)
    except Exception as e:
        print(f"Error ensuring schema {schema_name}: {e}")

def get_tenant_db(schema_name: str):
    ensure_tenant_schema_migrated(schema_name)
    engine_with_schema = engine.execution_options(schema_translate_map={'tenant': schema_name})
    SessionTenant = sessionmaker(autocommit=False, autoflush=False, bind=engine_with_schema)
    db = SessionTenant()
    try:
        yield db
    finally:
        db.close()

@router.post("/preview")
@router.post("/preview/", include_in_schema=False)
def preview_prefiniquito(
    schema_name: str,
    data: PrefiniquitoCreate,
    db: Session = Depends(get_tenant_db)
):
    emp = db.query(Employee).filter(Employee.id == data.employee_id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Empleado no encontrado")
        
    sueldo_prom = data.sueldo_promedio
    if not sueldo_prom:
        sueldo_prom = float(emp.haber_basico)

    otros_monto = float(data.otros_pagos or 0.0)
    tipo_otros = data.tipo_otros_pagos or "directo"
    cuotas_total = max(1, int(data.cuotas_total or 1))

    calc = calculate_prefiniquito(
        fecha_ingreso=emp.fecha_ingreso,
        fecha_retiro=data.fecha_retiro,
        motivo=data.motivo,
        sueldo_promedio=sueldo_prom,
        dias_vacacion_pendientes=data.dias_vacacion_pendientes or 0,
        otros_pagos=otros_monto,
        descuentos=data.descuentos or 0.0,
        aplicar_multa=data.aplicar_multa or False
    )

    cuotas_proyectadas = []
    cuotas_pagadas_count = 0
    monto_cuota = 0.0
    if tipo_otros == "cuotas" and otros_monto > 0:
        abono_ini = min(float(data.abono_inicial or 0.0), otros_monto)
        fecha_base = data.fecha_retiro
        f_base_str = fecha_base.strftime("%d/%m/%Y") if hasattr(fecha_base, 'strftime') else str(fecha_base)
        
        if abono_ini > 0:
            cuotas_proyectadas.append({
                "numero": 1,
                "monto": round(abono_ini, 2),
                "fecha_pago": f_base_str,
                "estado": "pagado",
                "comprobante": data.comprobante_abono_inicial or "Abono Inicial",
                "observacion": "Abono inicial al momento de la desvinculación"
            })
            cuotas_pagadas_count = 1
    else:
        tipo_otros = "directo"
    
    return {
        "employee_id": emp.id,
        "fecha_retiro": data.fecha_retiro,
        "motivo": data.motivo,
        "dias_vacacion_pendientes": data.dias_vacacion_pendientes or 0,
        "otros_pagos": otros_monto,
        "tipo_otros_pagos": tipo_otros,
        "otros_pagos_detalle": data.otros_pagos_detalle,
        "cuotas_total": cuotas_total,
        "cuotas_pagadas": cuotas_pagadas_count,
        "monto_cuota": monto_cuota,
        "cuotas_historial": cuotas_proyectadas,
        "descuentos": data.descuentos or 0.0,
        **calc
    }

@router.post("", response_model=PrefiniquitoResponse)
@router.post("/", response_model=PrefiniquitoResponse, include_in_schema=False)
def create_prefiniquito(
    schema_name: str,
    data: PrefiniquitoCreate,
    db: Session = Depends(get_tenant_db)
):
    preview = preview_prefiniquito(schema_name, data, db)
    
    pref = Prefiniquito(
        employee_id=preview["employee_id"],
        fecha_retiro=preview["fecha_retiro"],
        motivo=preview["motivo"],
        anios_trabajados=preview["anios_trabajados"],
        meses_trabajados=preview["meses_trabajados"],
        dias_trabajados=preview["dias_trabajados"],
        sueldo_promedio=preview["sueldo_promedio"],
        desahucio=preview["desahucio"],
        indemnizacion_anios=preview["indemnizacion_anios"],
        indemnizacion_meses=preview["indemnizacion_meses"],
        indemnizacion_dias=preview["indemnizacion_dias"],
        aguinaldo_meses=preview["aguinaldo_meses"],
        aguinaldo_dias=preview["aguinaldo_dias"],
        dias_vacacion_pendientes=preview["dias_vacacion_pendientes"],
        vacaciones=preview["vacaciones"],
        otros_pagos=preview["otros_pagos"],
        tipo_otros_pagos=preview.get("tipo_otros_pagos", "directo"),
        otros_pagos_detalle=preview.get("otros_pagos_detalle"),
        cuotas_total=preview.get("cuotas_total", 1),
        cuotas_pagadas=preview.get("cuotas_pagadas", 0),
        monto_cuota=preview.get("monto_cuota", 0.0),
        cuotas_historial=preview.get("cuotas_historial", []),
        descuentos=preview["descuentos"],
        total_calculo=preview["total_calculo"],
        multa_30=preview["multa_30"],
        total_final=preview["total_final"],
    )
    
    emp = db.query(Employee).filter(Employee.id == data.employee_id).first()
    if emp:
        emp.is_active = False
        db.add(emp)
        
    db.add(pref)
    db.commit()
    db.refresh(pref)
    
    return pref

@router.get("", response_model=list[PrefiniquitoResponse])
@router.get("/", response_model=list[PrefiniquitoResponse], include_in_schema=False)
def get_prefiniquitos(
    schema_name: str,
    db: Session = Depends(get_tenant_db)
):
    return db.query(Prefiniquito).order_by(Prefiniquito.id.desc()).all()

@router.get("/{id}", response_model=PrefiniquitoResponse)
def get_prefiniquito_by_id(
    schema_name: str,
    id: int,
    db: Session = Depends(get_tenant_db)
):
    pref = db.query(Prefiniquito).filter(Prefiniquito.id == id).first()
    if not pref:
        raise HTTPException(status_code=404, detail="Prefiniquito no encontrado")
    return pref

@router.post("/{id}/cuotas/{cuota_num}/pagar", response_model=PrefiniquitoResponse)
def pagar_cuota(
    schema_name: str,
    id: int,
    cuota_num: int,
    data: CuotaPagarRequest,
    db: Session = Depends(get_tenant_db)
):
    pref = db.query(Prefiniquito).filter(Prefiniquito.id == id).first()
    if not pref:
        raise HTTPException(status_code=404, detail="Prefiniquito no encontrado")
        
    historial = list(pref.cuotas_historial or [])
    updated = False
    for item in historial:
        if item.get("numero") == cuota_num:
            item["estado"] = "pagado"
            item["fecha_pago"] = data.fecha_pago or date.today().strftime("%d/%m/%Y")
            if data.comprobante:
                item["comprobante"] = data.comprobante
            if data.observacion:
                item["observacion"] = data.observacion
            updated = True
            break
            
    if not updated:
        raise HTTPException(status_code=404, detail=f"Cuota #{cuota_num} no encontrada en este prefiniquito")
        
    pref.cuotas_pagadas = sum(1 for c in historial if c.get("estado") == "pagado")
    pref.cuotas_historial = historial
    flag_modified(pref, "cuotas_historial")
    db.add(pref)
    db.commit()
    db.refresh(pref)
    return pref

@router.post("/{id}/cuotas/{cuota_num}/revertir", response_model=PrefiniquitoResponse)
def revertir_cuota(
    schema_name: str,
    id: int,
    cuota_num: int,
    db: Session = Depends(get_tenant_db)
):
    pref = db.query(Prefiniquito).filter(Prefiniquito.id == id).first()
    if not pref:
        raise HTTPException(status_code=404, detail="Prefiniquito no encontrado")
        
    historial = list(pref.cuotas_historial or [])
    updated = False
    for item in historial:
        if item.get("numero") == cuota_num:
            item["estado"] = "pendiente"
            item["fecha_pago"] = None
            item["comprobante"] = None
            item["observacion"] = None
            updated = True
            break
            
    if not updated:
        raise HTTPException(status_code=404, detail=f"Cuota #{cuota_num} no encontrada en este prefiniquito")
        
    pref.cuotas_pagadas = sum(1 for c in historial if c.get("estado") == "pagado")
    pref.cuotas_historial = historial
    flag_modified(pref, "cuotas_historial")
    db.add(pref)
    db.commit()
    db.refresh(pref)
    return pref

@router.post("/{id}/pagos", response_model=PrefiniquitoResponse)
def registrar_pago(
    schema_name: str,
    id: int,
    data: PagoRegistrarRequest,
    db: Session = Depends(get_tenant_db)
):
    pref = db.query(Prefiniquito).filter(Prefiniquito.id == id).first()
    if not pref:
        raise HTTPException(status_code=404, detail="Prefiniquito no encontrado")
        
    historial = list(pref.cuotas_historial or [])
    
    f_pago = data.fecha_pago
    if f_pago and "-" in f_pago:
        parts = f_pago.split("-")
        if len(parts) == 3 and len(parts[0]) == 4:
            f_pago = f"{parts[2]}/{parts[1]}/{parts[0]}"
    elif not f_pago:
        f_pago = date.today().strftime("%d/%m/%Y")
        
    nuevo_num = len(historial) + 1
    nuevo_pago = {
        "numero": nuevo_num,
        "monto": float(data.monto),
        "fecha_pago": f_pago,
        "metodo_pago": data.metodo_pago or "Efectivo",
        "comprobante": data.comprobante or "",
        "observacion": data.observacion or f"Abono #{nuevo_num}",
        "estado": "pagado"
    }
    historial.append(nuevo_pago)
    
    pref.cuotas_pagadas = len(historial)
    pref.cuotas_historial = historial
    flag_modified(pref, "cuotas_historial")
    db.add(pref)
    db.commit()
    db.refresh(pref)
    return pref

@router.delete("/{id}/pagos/{pago_num}", response_model=PrefiniquitoResponse)
def eliminar_pago(
    schema_name: str,
    id: int,
    pago_num: int,
    db: Session = Depends(get_tenant_db)
):
    pref = db.query(Prefiniquito).filter(Prefiniquito.id == id).first()
    if not pref:
        raise HTTPException(status_code=404, detail="Prefiniquito no encontrado")
        
    historial = list(pref.cuotas_historial or [])
    target = next((p for p in historial if p.get("numero") == pago_num), None)
    if not target:
        raise HTTPException(status_code=404, detail=f"Abono #{pago_num} no encontrado")
        
    historial = [p for p in historial if p.get("numero") != pago_num]
    for idx, p in enumerate(historial):
        p["numero"] = idx + 1
        
    pref.cuotas_pagadas = len(historial)
    pref.cuotas_historial = historial
    flag_modified(pref, "cuotas_historial")
    db.add(pref)
    db.commit()
    db.refresh(pref)
    return pref
    pref.cuotas_historial = historial
    flag_modified(pref, "cuotas_historial")
    db.add(pref)
    db.commit()
    db.refresh(pref)
    return pref

def _build_export_data(schema_name: str, emp: Employee, preview_or_pref: dict):
    # Get tenant details using public schema
    engine_public = engine.execution_options(schema_translate_map={'tenant': 'public'})
    SessionPublic = sessionmaker(autocommit=False, autoflush=False, bind=engine_public)
    db_public = SessionPublic()
    tenant = db_public.query(Tenant).filter(Tenant.schema_name == schema_name).first()
    db_public.close()
    
    razon_social = tenant.name if tenant else "EMPRESA"
    
    fecha_retiro = preview_or_pref["fecha_retiro"]
    if isinstance(fecha_retiro, str):
        from datetime import datetime
        fecha_retiro_obj = datetime.strptime(fecha_retiro, "%Y-%m-%d").date()
    else:
        fecha_retiro_obj = fecha_retiro

    inicio_gestion = date(fecha_retiro_obj.year, 1, 1)
    inicio_aguinaldo = max(inicio_gestion, emp.fecha_ingreso)
    tiempo_ag = calculate_time_worked(inicio_aguinaldo, fecha_retiro_obj)
    
    historial = preview_or_pref.get("cuotas_historial", []) or []
    pagos_realizados = [p for p in historial if (p.get("estado") == "pagado" or p.get("monto"))]
    total_pagado = sum(float(p.get("monto", 0) or 0) for p in pagos_realizados)
    saldo = max(0.0, float(preview_or_pref.get("otros_pagos", 0) or 0) - total_pagado)
    
    export_data = {
        "nombre_trabajador": f"{emp.apellido_paterno} {emp.apellido_materno or ''} {emp.nombres}".strip().replace("  ", " "),
        "razon_social": razon_social,
        "fecha_ingreso": emp.fecha_ingreso.strftime("%d de %B de %Y") if hasattr(emp.fecha_ingreso, 'strftime') else str(emp.fecha_ingreso),
        "fecha_retiro": fecha_retiro_obj.strftime("%d de %B de %Y") if hasattr(fecha_retiro_obj, 'strftime') else str(fecha_retiro_obj),
        "anios_trabajados": preview_or_pref["anios_trabajados"],
        "meses_trabajados": preview_or_pref["meses_trabajados"],
        "dias_trabajados": preview_or_pref["dias_trabajados"],
        "sueldo_promedio": float(preview_or_pref["sueldo_promedio"]),
        "desahucio": float(preview_or_pref["desahucio"]),
        "indemnizacion_anios": float(preview_or_pref["indemnizacion_anios"]),
        "indemnizacion_meses": float(preview_or_pref["indemnizacion_meses"]),
        "indemnizacion_dias": float(preview_or_pref["indemnizacion_dias"]),
        "aguinaldo_meses": float(preview_or_pref["aguinaldo_meses"]),
        "aguinaldo_dias": float(preview_or_pref["aguinaldo_dias"]),
        "aguinaldo_meses_count": tiempo_ag['meses'],
        "aguinaldo_dias_count": tiempo_ag['dias'],
        "dias_vacacion_pendientes": preview_or_pref["dias_vacacion_pendientes"],
        "vacaciones": float(preview_or_pref["vacaciones"]),
        "otros_pagos": float(preview_or_pref["otros_pagos"]),
        "tipo_otros_pagos": preview_or_pref.get("tipo_otros_pagos", "directo"),
        "otros_pagos_detalle": preview_or_pref.get("otros_pagos_detalle"),
        "cuotas_total": int(preview_or_pref.get("cuotas_total", 1) or 1),
        "cuotas_pagadas": len(pagos_realizados),
        "monto_cuota": float(preview_or_pref.get("monto_cuota", 0.0) or 0.0),
        "cuotas_historial": historial,
        "total_pagado": total_pagado,
        "saldo_pendiente": saldo,
        "descuentos": float(preview_or_pref["descuentos"]),
        "total_calculo": float(preview_or_pref["total_calculo"]),
        "multa_30": float(preview_or_pref["multa_30"]),
        "total_final": float(preview_or_pref["total_final"])
    }
    
    meses_es = {"January": "enero", "February": "febrero", "March": "marzo", "April": "abril", "May": "mayo", "June": "junio", "July": "julio", "August": "agosto", "September": "septiembre", "October": "octubre", "November": "noviembre", "December": "diciembre"}
    for eng, esp in meses_es.items():
        export_data["fecha_ingreso"] = export_data["fecha_ingreso"].replace(eng, esp)
        export_data["fecha_retiro"] = export_data["fecha_retiro"].replace(eng, esp)
        
    return export_data

@router.post("/export/{format}")
@router.post("/export/{format}/", include_in_schema=False)
def export_prefiniquito(
    schema_name: str,
    format: str,
    data: PrefiniquitoCreate,
    db: Session = Depends(get_tenant_db)
):
    if format not in ["excel", "pdf", "word"]:
        raise HTTPException(status_code=400, detail="Formato no soportado, use excel, pdf o word")
        
    preview = preview_prefiniquito(schema_name, data, db)
    
    emp = db.query(Employee).filter(Employee.id == data.employee_id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Empleado no encontrado")
        
    export_data = _build_export_data(schema_name, emp, preview)
    
    out_format = "docx" if format == "word" else ("pdf" if format == "pdf" else "xlsx")
    filepath = DocumentService.generate_prefiniquito_excel(export_data, out_format)
    
    filename = f"Prefiniquito_{export_data['nombre_trabajador'].replace(' ', '_')}.{out_format}"
    
    if format == "word":
        media_type = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    elif format == "pdf":
        media_type = "application/pdf"
    else:
        media_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        
    return FileResponse(path=filepath, filename=filename, media_type=media_type)

@router.get("/{id}/export/{format}")
def export_saved_prefiniquito(
    schema_name: str,
    id: int,
    format: str,
    db: Session = Depends(get_tenant_db)
):
    if format not in ["excel", "pdf", "word"]:
        raise HTTPException(status_code=400, detail="Formato no soportado, use excel, pdf o word")
        
    pref = db.query(Prefiniquito).filter(Prefiniquito.id == id).first()
    if not pref:
        raise HTTPException(status_code=404, detail="Prefiniquito no encontrado")
        
    emp = db.query(Employee).filter(Employee.id == pref.employee_id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Empleado no encontrado")
        
    pref_dict = {
        "fecha_retiro": pref.fecha_retiro,
        "motivo": pref.motivo,
        "anios_trabajados": pref.anios_trabajados,
        "meses_trabajados": pref.meses_trabajados,
        "dias_trabajados": pref.dias_trabajados,
        "sueldo_promedio": pref.sueldo_promedio,
        "desahucio": pref.desahucio,
        "indemnizacion_anios": pref.indemnizacion_anios,
        "indemnizacion_meses": pref.indemnizacion_meses,
        "indemnizacion_dias": pref.indemnizacion_dias,
        "aguinaldo_meses": pref.aguinaldo_meses,
        "aguinaldo_dias": pref.aguinaldo_dias,
        "dias_vacacion_pendientes": pref.dias_vacacion_pendientes,
        "vacaciones": pref.vacaciones,
        "otros_pagos": pref.otros_pagos,
        "tipo_otros_pagos": pref.tipo_otros_pagos,
        "otros_pagos_detalle": pref.otros_pagos_detalle,
        "cuotas_total": pref.cuotas_total,
        "cuotas_pagadas": pref.cuotas_pagadas,
        "monto_cuota": pref.monto_cuota,
        "cuotas_historial": pref.cuotas_historial,
        "descuentos": pref.descuentos,
        "total_calculo": pref.total_calculo,
        "multa_30": pref.multa_30,
        "total_final": pref.total_final,
    }
    
    export_data = _build_export_data(schema_name, emp, pref_dict)
    
    out_format = "docx" if format == "word" else ("pdf" if format == "pdf" else "xlsx")
    filepath = DocumentService.generate_prefiniquito_excel(export_data, out_format)
    
    filename = f"Prefiniquito_{export_data['nombre_trabajador'].replace(' ', '_')}.{out_format}"
    
    if format == "word":
        media_type = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    elif format == "pdf":
        media_type = "application/pdf"
    else:
        media_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        
    return FileResponse(path=filepath, filename=filename, media_type=media_type)