import os
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.db.session import get_tenant_session, get_db
from app.schemas.accounting import (
    AccountingSheetData,
    AccountingSheetSaveRequest
)
from app.services.accounting_service import AccountingService
from app.services.document_service import DocumentService

router = APIRouter()

@router.get("/", response_model=AccountingSheetData)
@router.get("", response_model=AccountingSheetData, include_in_schema=False)
def get_accounting_sheet(
    schema_name: str,
    month: int = Query(..., ge=1, le=12),
    year: int = Query(..., ge=2000, le=2100),
    db: Session = Depends(get_db)
):
    tenant_session = get_tenant_session(schema_name)
    try:
        sheet = AccountingService.get_or_calculate_sheet(
            tenant_session=tenant_session,
            public_session=db,
            schema_name=schema_name,
            month=month,
            year=year,
            force_recalculate=False
        )
        return sheet
    finally:
        tenant_session.close()

@router.post("/", response_model=AccountingSheetData)
@router.post("", response_model=AccountingSheetData, include_in_schema=False)
def save_accounting_sheet(
    schema_name: str,
    payload: AccountingSheetSaveRequest,
    db: Session = Depends(get_db)
):
    tenant_session = get_tenant_session(schema_name)
    try:
        # Calcular los subtotales y totales para el payload
        sections = []
        for s in payload.sections:
            sub_d = round(sum(it.debe for it in s.items), 2)
            sub_h = round(sum(it.haber for it in s.items), 2)
            s.subtotal_debe = sub_d
            s.subtotal_haber = sub_h
            sections.append(s)

        tot_d = round(sum(s.subtotal_debe for s in sections), 2)
        tot_h = round(sum(s.subtotal_haber for s in sections), 2)
        dif = round(abs(tot_d - tot_h), 2)

        sheet_data = AccountingSheetData(
            month=payload.month,
            year=payload.year,
            month_name=AccountingService.get_or_calculate_sheet(tenant_session, db, schema_name, payload.month, payload.year).month_name,
            tenant_name=AccountingService.get_or_calculate_sheet(tenant_session, db, schema_name, payload.month, payload.year).tenant_name,
            caja_banco_name=payload.caja_banco_name or "Caja Moneda Nacional",
            caja_salud_name=payload.caja_salud_name or "Caja de Salud",
            fecha_pago_gestora=payload.fecha_pago_gestora or "",
            fecha_pago_caja=payload.fecha_pago_caja or "",
            fecha_pago_min_trabajo=payload.fecha_pago_min_trabajo or "",
            arancel_min_trabajo=27.00,
            sections=sections,
            total_debe=tot_d,
            total_haber=tot_h,
            is_cuadrado=(dif == 0.0),
            diferencia=dif,
            has_payroll=True,
            is_customized=True
        )

        AccountingService.save_custom_sheet(
            session=tenant_session,
            month=payload.month,
            year=payload.year,
            sheet_data=sheet_data
        )

        return sheet_data
    finally:
        tenant_session.close()

@router.post("/reset", response_model=AccountingSheetData)
def reset_accounting_sheet(
    schema_name: str,
    month: int = Query(..., ge=1, le=12),
    year: int = Query(..., ge=2000, le=2100),
    db: Session = Depends(get_db)
):
    tenant_session = get_tenant_session(schema_name)
    try:
        from app.models.accounting import AccountingRecord
        # Eliminar el registro personalizado para forzar recalculo
        tenant_session.query(AccountingRecord).filter(
            AccountingRecord.month == month,
            AccountingRecord.year == year
        ).delete()
        tenant_session.commit()

        sheet = AccountingService.get_or_calculate_sheet(
            tenant_session=tenant_session,
            public_session=db,
            schema_name=schema_name,
            month=month,
            year=year,
            force_recalculate=True
        )
        return sheet
    finally:
        tenant_session.close()

@router.get("/export/excel")
def export_excel(
    schema_name: str,
    month: int = Query(..., ge=1, le=12),
    year: int = Query(..., ge=2000, le=2100),
    db: Session = Depends(get_db)
):
    tenant_session = get_tenant_session(schema_name)
    try:
        sheet = AccountingService.get_or_calculate_sheet(
            tenant_session=tenant_session,
            public_session=db,
            schema_name=schema_name,
            month=month,
            year=year
        )
        file_path = DocumentService.generate_asientos_excel(sheet)
        filename = os.path.basename(file_path)
        return FileResponse(
            path=file_path,
            filename=filename,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        )
    finally:
        tenant_session.close()

@router.get("/export/pdf")
def export_pdf(
    schema_name: str,
    month: int = Query(..., ge=1, le=12),
    year: int = Query(..., ge=2000, le=2100),
    db: Session = Depends(get_db)
):
    tenant_session = get_tenant_session(schema_name)
    try:
        sheet = AccountingService.get_or_calculate_sheet(
            tenant_session=tenant_session,
            public_session=db,
            schema_name=schema_name,
            month=month,
            year=year
        )
        file_path = DocumentService.generate_asientos_pdf(sheet)
        filename = os.path.basename(file_path)
        return FileResponse(
            path=file_path,
            filename=filename,
            media_type="application/pdf"
        )
    finally:
        tenant_session.close()
