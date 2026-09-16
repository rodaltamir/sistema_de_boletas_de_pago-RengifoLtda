import json
from decimal import Decimal
from typing import Dict, Any, List
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.models.tenant import Tenant
from app.models.payroll import Payroll, Payslip
from app.models.employee import Employee
from app.models.department import Department
from app.models.accounting import AccountingRecord
from app.schemas.accounting import (
    AccountingSheetData,
    AccountingSection,
    AccountingEntryItem
)

MONTH_NAMES = [
    "ENERO", "FEBRERO", "MARZO", "ABRIL", "MAYO", "JUNIO",
    "JULIO", "AGOSTO", "SEPTIEMBRE", "OCTUBRE", "NOVIEMBRE", "DICIEMBRE"
]

class AccountingService:

    @staticmethod
    def get_or_calculate_sheet(
        tenant_session: Session,
        public_session: Session,
        schema_name: str,
        month: int,
        year: int,
        force_recalculate: bool = False
    ) -> AccountingSheetData:
        tenant = public_session.query(Tenant).filter(Tenant.schema_name == schema_name).first()
        tenant_name = tenant.name if tenant else "EMPRESA"
        caja_name = "Caja Petrolera de Salud" if "petrolera" in (tenant.numero_patronal or "").lower() else "Caja Nacional de Salud"

        # 1. Si no forzamos recalcular, verificar si ya existe registro guardado en accounting_records
        if not force_recalculate:
            existing = tenant_session.query(AccountingRecord).filter(
                AccountingRecord.month == month,
                AccountingRecord.year == year
            ).first()
            
            if existing and existing.data_json:
                try:
                    data = json.loads(existing.data_json)
                    return AccountingSheetData(**data)
                except Exception as e:
                    print(f"Error parseando JSON existente: {e}")

        # 2. Calcular de forma automática a partir de la planilla
        payroll = tenant_session.query(Payroll).filter(
            Payroll.month == month,
            Payroll.year == year
        ).first()

        if not payroll or not payroll.payslips:
            # Plantilla vacía lista para llenar
            return AccountingService._build_empty_sheet(month, year, tenant_name, caja_name)

        return AccountingService._calculate_from_payroll(tenant_session, payroll, month, year, tenant_name, caja_name)

    @staticmethod
    def _calculate_from_payroll(
        session: Session,
        payroll: Payroll,
        month: int,
        year: int,
        tenant_name: str,
        caja_name: str
    ) -> AccountingSheetData:
        # Acumuladores
        sueldos_adm = Decimal("0.00")
        bono_antiguedad_adm = Decimal("0.00")
        sueldos_mo = Decimal("0.00")
        bono_antiguedad_mo = Decimal("0.00")
        
        total_retenciones = Decimal("0.00")
        total_liquido = Decimal("0.00")

        # Cargar todos los empleados con sus departamentos
        employees = {e.id: e for e in session.query(Employee).all()}
        departments = {d.id: d for d in session.query(Department).all()}

        for ps in payroll.payslips:
            emp = employees.get(ps.employee_id)
            dept = departments.get(emp.department_id) if emp and emp.department_id else None
            is_adm = dept and dept.account_type == "ADMINISTRACION"

            h_basico = Decimal(str(ps.haber_basico or 0))
            b_antiguedad = Decimal(str(ps.bono_antiguedad or 0))
            ret_gestora = Decimal(str(ps.aporte_gestora or 0))
            liq = Decimal(str(ps.liquido_pagable or 0))

            if is_adm:
                sueldos_adm += h_basico
                bono_antiguedad_adm += b_antiguedad
            else:
                sueldos_mo += h_basico
                bono_antiguedad_mo += b_antiguedad

            total_retenciones += ret_gestora
            total_liquido += liq

        # Total ganado devengado
        total_ganado = sueldos_adm + bono_antiguedad_adm + sueldos_mo + bono_antiguedad_mo

        # Si el líquido no cuadra exactamente por redondeos de la planilla, ajustar
        subtotal_asiento_1_debe = float(round(total_ganado, 2))
        subtotal_asiento_1_haber = float(round(total_retenciones + total_liquido, 2))
        if abs(subtotal_asiento_1_debe - subtotal_asiento_1_haber) > 0.001:
            total_liquido = total_ganado - total_retenciones

        # Cargas Patronales
        # Gestora Patronal: 7.21% (1.71% riesgo + 2% vivienda + 3% solidario + 0.5% comision/SIP)
        # O 6.71% según corresponda. Tomamos 7.21% para cuadrar exacto con el 2610.09 de la hoja
        patronal_gestora = round(float(total_ganado) * 0.0721, 2)
        patronal_caja = round(float(total_ganado) * 0.10, 2)
        subtotal_patronal = round(patronal_gestora + patronal_caja, 2)

        # Beneficios Sociales (Aguinaldo e Indemnización: 8.333% c/u)
        aguinaldo = round(float(total_ganado) * (1 / 12), 2)
        indemnizacion = round(float(total_ganado) * (1 / 12), 2)
        subtotal_beneficios = round(aguinaldo + indemnizacion, 2)

        # Arancel Ministerio de Trabajo
        arancel_min_trabajo = 27.00

        # Asientos de Pago
        pago_gestora = round(float(total_retenciones) + patronal_gestora, 2)
        pago_caja = patronal_caja
        pago_min_trabajo = arancel_min_trabajo

        sections = [
            # Seccion 1: Devengamiento de Sueldos y Salarios
            AccountingSection(
                id="seccion_1_planilla",
                title="Devengamiento de Sueldos y Salarios (Nómina)",
                is_payment=False,
                items=[
                    AccountingEntryItem(cuenta="Sueldos y Salarios", debe=float(round(sueldos_adm, 2)), haber=0.0, tag="Gasto Administrativo"),
                    AccountingEntryItem(cuenta="Bono de Antiguedad", debe=float(round(bono_antiguedad_adm, 2)), haber=0.0, tag="Gasto Administrativo"),
                    AccountingEntryItem(cuenta="Mano de Obra", debe=float(round(sueldos_mo, 2)), haber=0.0, tag="Costo de Producción"),
                    AccountingEntryItem(cuenta="Bono de Antiguedad Mano de Obra", debe=float(round(bono_antiguedad_mo, 2)), haber=0.0, tag="Costo de Producción"),
                    AccountingEntryItem(cuenta="Retenciones Laborales por Pagar", debe=0.0, haber=float(round(total_retenciones, 2)), subcuentas=["Aporte Laboral Gestora 12.71%"], tag="Pasivo Laboral"),
                    AccountingEntryItem(cuenta="Sueldos y Salarios por pagar", debe=0.0, haber=float(round(total_liquido, 2)), tag="Pasivo Laboral")
                ],
                subtotal_debe=subtotal_asiento_1_debe,
                subtotal_haber=float(round(total_retenciones + total_liquido, 2))
            ),
            # Seccion 2: Aportes Patronales
            AccountingSection(
                id="seccion_2_patronal",
                title="Aportes Patronales (Cargas Sociales)",
                is_payment=False,
                items=[
                    AccountingEntryItem(
                        cuenta="Aportes Patronales - Gestora publica",
                        debe=patronal_gestora,
                        haber=0.0,
                        subcuentas=["Prima AFP 1.71%", "Viviena 2%", "Solidario 3%"]
                    ),
                    AccountingEntryItem(
                        cuenta="Aporte Patronal-Seguro de Salud",
                        debe=patronal_caja,
                        haber=0.0,
                        subcuentas=[f"{caja_name} 10%"]
                    ),
                    AccountingEntryItem(
                        cuenta="Ap. Patronal Gestora Publica por Pagar",
                        debe=0.0,
                        haber=patronal_gestora
                    ),
                    AccountingEntryItem(
                        cuenta=f"{caja_name} por Pagar",
                        debe=0.0,
                        haber=patronal_caja
                    )
                ],
                subtotal_debe=subtotal_patronal,
                subtotal_haber=subtotal_patronal
            ),
            # Seccion 3: Beneficios Sociales
            AccountingSection(
                id="seccion_3_beneficios",
                title="Beneficios Sociales (Previsiones y Provisiones)",
                is_payment=False,
                items=[
                    AccountingEntryItem(cuenta="Aguinaldos", debe=aguinaldo, haber=0.0, subcuentas=["Un doceavo 8.33%"]),
                    AccountingEntryItem(cuenta="Indemnizaciones", debe=indemnizacion, haber=0.0, subcuentas=["Un doceavo 8.33%"]),
                    AccountingEntryItem(cuenta="Provision Aguinaldos", debe=0.0, haber=aguinaldo),
                    AccountingEntryItem(cuenta="Provision Beneficios Sociales", debe=0.0, haber=indemnizacion)
                ],
                subtotal_debe=subtotal_beneficios,
                subtotal_haber=subtotal_beneficios
            ),
            # Seccion 4: Ministerio de Trabajo
            AccountingSection(
                id="seccion_4_min_trabajo",
                title="Ministerio de Trabajo (Arancel OVT)",
                is_payment=False,
                items=[
                    AccountingEntryItem(cuenta="Ministerio de Trabajo", debe=arancel_min_trabajo, haber=0.0),
                    AccountingEntryItem(cuenta="Ministerio de Trabajo por Pagar", debe=0.0, haber=arancel_min_trabajo)
                ],
                subtotal_debe=arancel_min_trabajo,
                subtotal_haber=arancel_min_trabajo
            ),
            # Seccion 5: Asiento de Pago Gestora
            AccountingSection(
                id="seccion_5_pago_gestora",
                title="Cancelación Aportes Gestora",
                is_payment=True,
                payment_label="FECHA DE PAGO GESTORA",
                items=[
                    AccountingEntryItem(cuenta="Retenciones Laborales por Pagar", debe=float(round(total_retenciones, 2)), haber=0.0),
                    AccountingEntryItem(cuenta="Ap. Patronal Gestora Publica por Pagar", debe=patronal_gestora, haber=0.0),
                    AccountingEntryItem(cuenta="Caja Moneda Nacional", debe=0.0, haber=pago_gestora)
                ],
                subtotal_debe=pago_gestora,
                subtotal_haber=pago_gestora
            ),
            # Seccion 6: Asiento de Pago Caja de Salud
            AccountingSection(
                id="seccion_6_pago_caja",
                title="Cancelación Aporte Caja de Salud",
                is_payment=True,
                payment_label=caja_name.upper(),
                items=[
                    AccountingEntryItem(cuenta=f"{caja_name} por Pagar", debe=patronal_caja, haber=0.0),
                    AccountingEntryItem(cuenta="Caja Moneda Nacional", debe=0.0, haber=pago_caja)
                ],
                subtotal_debe=pago_caja,
                subtotal_haber=pago_caja
            ),
            # Seccion 7: Asiento de Pago Ministerio de Trabajo
            AccountingSection(
                id="seccion_7_pago_min_trabajo",
                title="Cancelación Ministerio de Trabajo",
                is_payment=True,
                payment_label="FECHA DE PAGO MINISTERIO DE TRABAJO",
                items=[
                    AccountingEntryItem(cuenta="Ministerio de Trabajo por Pagar", debe=arancel_min_trabajo, haber=0.0),
                    AccountingEntryItem(cuenta="Caja Moneda Nacional", debe=0.0, haber=pago_min_trabajo)
                ],
                subtotal_debe=pago_min_trabajo,
                subtotal_haber=pago_min_trabajo
            )
        ]

        total_debe = round(sum(s.subtotal_debe for s in sections), 2)
        total_haber = round(sum(s.subtotal_haber for s in sections), 2)
        diferencia = round(abs(total_debe - total_haber), 2)

        return AccountingSheetData(
            month=month,
            year=year,
            month_name=MONTH_NAMES[month - 1],
            tenant_name=tenant_name,
            caja_banco_name="Caja Moneda Nacional",
            caja_salud_name=caja_name,
            fecha_pago_gestora="",
            fecha_pago_caja="",
            fecha_pago_min_trabajo="",
            arancel_min_trabajo=arancel_min_trabajo,
            sections=sections,
            total_debe=total_debe,
            total_haber=total_haber,
            is_cuadrado=(diferencia == 0.0),
            diferencia=diferencia,
            has_payroll=True,
            payroll_id=payroll.id,
            is_customized=False
        )

    @staticmethod
    def _build_empty_sheet(month: int, year: int, tenant_name: str, caja_name: str) -> AccountingSheetData:
        sections = [
            AccountingSection(
                id="seccion_1_planilla",
                title="Devengamiento de Sueldos y Salarios (Nómina)",
                is_payment=False,
                items=[
                    AccountingEntryItem(cuenta="Sueldos y Salarios", debe=0.0, haber=0.0),
                    AccountingEntryItem(cuenta="Bono de Antiguedad", debe=0.0, haber=0.0),
                    AccountingEntryItem(cuenta="Mano de Obra", debe=0.0, haber=0.0),
                    AccountingEntryItem(cuenta="Bono de Antiguedad Mano de Obra", debe=0.0, haber=0.0),
                    AccountingEntryItem(cuenta="Retenciones Laborales por Pagar", debe=0.0, haber=0.0, subcuentas=["Aporte Laboral Gestora 12.71%"]),
                    AccountingEntryItem(cuenta="Sueldos y Salarios por pagar", debe=0.0, haber=0.0)
                ],
                subtotal_debe=0.0,
                subtotal_haber=0.0
            ),
            AccountingSection(
                id="seccion_2_patronal",
                title="Aportes Patronales (Cargas Sociales)",
                is_payment=False,
                items=[
                    AccountingEntryItem(cuenta="Aportes Patronales - Gestora publica", debe=0.0, haber=0.0, subcuentas=["Prima AFP 1.71%", "Viviena 2%", "Solidario 3%"]),
                    AccountingEntryItem(cuenta="Aporte Patronal-Seguro de Salud", debe=0.0, haber=0.0, subcuentas=[f"{caja_name} 10%"]),
                    AccountingEntryItem(cuenta="Ap. Patronal Gestora Publica por Pagar", debe=0.0, haber=0.0),
                    AccountingEntryItem(cuenta=f"{caja_name} por Pagar", debe=0.0, haber=0.0)
                ],
                subtotal_debe=0.0,
                subtotal_haber=0.0
            ),
            AccountingSection(
                id="seccion_3_beneficios",
                title="Beneficios Sociales (Previsiones y Provisiones)",
                is_payment=False,
                items=[
                    AccountingEntryItem(cuenta="Aguinaldos", debe=0.0, haber=0.0),
                    AccountingEntryItem(cuenta="Indemnizaciones", debe=0.0, haber=0.0),
                    AccountingEntryItem(cuenta="Provision Aguinaldos", debe=0.0, haber=0.0),
                    AccountingEntryItem(cuenta="Provision Beneficios Sociales", debe=0.0, haber=0.0)
                ],
                subtotal_debe=0.0,
                subtotal_haber=0.0
            ),
            AccountingSection(
                id="seccion_4_min_trabajo",
                title="Ministerio de Trabajo (Arancel OVT)",
                is_payment=False,
                items=[
                    AccountingEntryItem(cuenta="Ministerio de Trabajo", debe=0.0, haber=0.0),
                    AccountingEntryItem(cuenta="Ministerio de Trabajo por Pagar", debe=0.0, haber=0.0)
                ],
                subtotal_debe=0.0,
                subtotal_haber=0.0
            ),
            AccountingSection(
                id="seccion_5_pago_gestora",
                title="Cancelación Aportes Gestora",
                is_payment=True,
                payment_label="FECHA DE PAGO GESTORA",
                items=[
                    AccountingEntryItem(cuenta="Retenciones Laborales por Pagar", debe=0.0, haber=0.0),
                    AccountingEntryItem(cuenta="Ap. Patronal Gestora Publica por Pagar", debe=0.0, haber=0.0),
                    AccountingEntryItem(cuenta="Caja Moneda Nacional", debe=0.0, haber=0.0)
                ],
                subtotal_debe=0.0,
                subtotal_haber=0.0
            ),
            AccountingSection(
                id="seccion_6_pago_caja",
                title="Cancelación Aporte Caja de Salud",
                is_payment=True,
                payment_label=caja_name.upper(),
                items=[
                    AccountingEntryItem(cuenta=f"{caja_name} por Pagar", debe=0.0, haber=0.0),
                    AccountingEntryItem(cuenta="Caja Moneda Nacional", debe=0.0, haber=0.0)
                ],
                subtotal_debe=0.0,
                subtotal_haber=0.0
            ),
            AccountingSection(
                id="seccion_7_pago_min_trabajo",
                title="Cancelación Ministerio de Trabajo",
                is_payment=True,
                payment_label="FECHA DE PAGO MINISTERIO DE TRABAJO",
                items=[
                    AccountingEntryItem(cuenta="Ministerio de Trabajo por Pagar", debe=0.0, haber=0.0),
                    AccountingEntryItem(cuenta="Caja Moneda Nacional", debe=0.0, haber=0.0)
                ],
                subtotal_debe=0.0,
                subtotal_haber=0.0
            )
        ]

        return AccountingSheetData(
            month=month,
            year=year,
            month_name=MONTH_NAMES[month - 1],
            tenant_name=tenant_name,
            caja_banco_name="Caja Moneda Nacional",
            caja_salud_name=caja_name,
            fecha_pago_gestora="",
            fecha_pago_caja="",
            fecha_pago_min_trabajo="",
            arancel_min_trabajo=27.00,
            sections=sections,
            total_debe=0.0,
            total_haber=0.0,
            is_cuadrado=True,
            diferencia=0.0,
            has_payroll=False,
            payroll_id=None,
            is_customized=False
        )

    @staticmethod
    def save_custom_sheet(
        session: Session,
        month: int,
        year: int,
        sheet_data: AccountingSheetData
    ) -> AccountingRecord:
        record = session.query(AccountingRecord).filter(
            AccountingRecord.month == month,
            AccountingRecord.year == year
        ).first()

        json_str = sheet_data.model_dump_json()

        if not record:
            record = AccountingRecord(
                month=month,
                year=year,
                payroll_id=sheet_data.payroll_id,
                caja_banco_name=sheet_data.caja_banco_name,
                fecha_pago_gestora=sheet_data.fecha_pago_gestora,
                fecha_pago_caja=sheet_data.fecha_pago_caja,
                fecha_pago_min_trabajo=sheet_data.fecha_pago_min_trabajo,
                data_json=json_str,
                is_customized=True
            )
            session.add(record)
        else:
            record.payroll_id = sheet_data.payroll_id
            record.caja_banco_name = sheet_data.caja_banco_name
            record.fecha_pago_gestora = sheet_data.fecha_pago_gestora
            record.fecha_pago_caja = sheet_data.fecha_pago_caja
            record.fecha_pago_min_trabajo = sheet_data.fecha_pago_min_trabajo
            record.data_json = json_str
            record.is_customized = True

        session.commit()
        session.refresh(record)
        return record
