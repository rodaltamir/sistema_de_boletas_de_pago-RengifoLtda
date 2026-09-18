import os
import calendar
from datetime import datetime, date
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.db.session import get_tenant_session, get_db
from app.models.tenant import Tenant
from app.models.payroll import Payroll
from app.schemas.accounting import (
    AnnualHistoryResponse,
    AccountingSheetData,
    AccountingSheetSaveRequest,
    GestoraPaymentData,
    CajaPaymentData,
    MinTrabajoPaymentData
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
        tenant = db.query(Tenant).filter(Tenant.schema_name == schema_name).first()
        tenant_name = tenant.name if tenant else "EMPRESA"
        if tenant and payload.caja_salud_name and tenant.caja_salud != payload.caja_salud_name:
            tenant.caja_salud = payload.caja_salud_name
            db.commit()

        existing_payroll = tenant_session.query(Payroll).filter(
            Payroll.month == payload.month,
            Payroll.year == payload.year
        ).first()
        payroll_id = existing_payroll.id if existing_payroll else None

        today = datetime.now().date()
        last_day = calendar.monthrange(payload.year, payload.month)[1]
        end_of_month = date(payload.year, payload.month, last_day)
        is_locked_by_date = today > end_of_month

        if payload.devengamiento:
            sheet_data = AccountingService.build_full_sheet(
                month=payload.month,
                year=payload.year,
                tenant_name=tenant_name,
                caja_banco_name=payload.caja_banco_name or "Caja Moneda Nacional",
                devengamiento=payload.devengamiento,
                gestora_payment=payload.gestora_payment or GestoraPaymentData(),
                caja_payment=payload.caja_payment or CajaPaymentData(),
                min_trabajo_payment=payload.min_trabajo_payment or MinTrabajoPaymentData(),
                payroll_id=payroll_id,
                is_locked_by_date=is_locked_by_date,
                is_manually_unlocked=bool(payload.is_manually_unlocked),
                is_customized=True
            )
        else:
            sections = []
            for s in (payload.sections or []):
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
                tenant_name=tenant_name,
                caja_banco_name=payload.caja_banco_name or "Caja Moneda Nacional",
                caja_salud_name=payload.caja_salud_name or "Caja Petrolera de Salud",
                arancel_min_trabajo=payload.arancel_min_trabajo or 27.00,
                devengamiento=payload.devengamiento,
                gestora_payment=payload.gestora_payment or GestoraPaymentData(),
                caja_payment=payload.caja_payment or CajaPaymentData(),
                min_trabajo_payment=payload.min_trabajo_payment or MinTrabajoPaymentData(),
                sections=sections,
                total_debe=tot_d,
                total_haber=tot_h,
                is_cuadrado=(dif == 0.0),
                diferencia=dif,
                has_payroll=(payroll_id is not None),
                payroll_id=payroll_id,
                is_customized=True,
                is_locked_by_date=is_locked_by_date,
                is_manually_unlocked=bool(payload.is_manually_unlocked)
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

@router.get("/history", response_model=AnnualHistoryResponse)
@router.get("/history/", response_model=AnnualHistoryResponse, include_in_schema=False)
def get_annual_history(
    schema_name: str,
    year: int = Query(..., ge=2000, le=2100),
    db: Session = Depends(get_db)
):
    tenant_session = get_tenant_session(schema_name)
    try:
        history = AccountingService.get_annual_history(
            tenant_session=tenant_session,
            public_session=db,
            schema_name=schema_name,
            year=year
        )
        return history
    finally:
        tenant_session.close()

@router.get("/export/master-excel")
@router.get("/export/master-excel/", include_in_schema=False)
def export_master_excel(
    schema_name: str,
    year: int = Query(..., ge=2000, le=2100),
    db: Session = Depends(get_db)
):
    tenant_session = get_tenant_session(schema_name)
    try:
        master_file = DocumentService.generate_asientos_master_excel(
            tenant_session=tenant_session,
            public_session=db,
            schema_name=schema_name,
            year=year
        )
        tenant = db.query(Tenant).filter(Tenant.schema_name == schema_name).first()
        empresa_slug = DocumentService._slugify(tenant.name if tenant else schema_name)
        filename = f"asientos_contables_{empresa_slug}_{year}.xlsx"
        return FileResponse(
            path=master_file,
            filename=filename,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        )
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
        file_path = DocumentService.generate_asientos_excel(sheet, schema_name=schema_name)
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
        file_path = DocumentService.generate_asientos_pdf(sheet, schema_name=schema_name)
        filename = os.path.basename(file_path)
        return FileResponse(
            path=file_path,
            filename=filename,
            media_type="application/pdf"
        )
    finally:
        tenant_session.close()
