import json
import calendar
from datetime import datetime, date
from decimal import Decimal
from typing import Dict, Any, List, Optional, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.models.tenant import Tenant
from app.models.payroll import Payroll, Payslip
from app.models.employee import Employee
from app.models.department import Department
from app.models.accounting import AccountingRecord
from app.schemas.accounting import (
    PaymentInfoSummary,
    AccountingMonthHistoryItem,
    AnnualHistoryResponse,
    AccountingSheetData,
    AccountingSection,
    AccountingEntryItem,
    DepartmentPayrollItem,
    DevengamientoData,
    GestoraPaymentData,
    CajaPaymentData,
    MinTrabajoPaymentData,
    PaymentExtraItem,
    PendingSettlementPayment,
    TramiteMinTrabajoItem
)

MONTH_NAMES = [
    "ENERO", "FEBRERO", "MARZO", "ABRIL", "MAYO", "JUNIO",
    "JULIO", "AGOSTO", "SEPTIEMBRE", "OCTUBRE", "NOVIEMBRE", "DICIEMBRE"
]

class AccountingService:

    @staticmethod
    def _get_pending_balances_for_month(
        session: Session,
        current_month: int,
        current_year: int
    ) -> tuple[List[PendingSettlementPayment], List[PendingSettlementPayment]]:
        """
        Busca todos los importes restantes (pagos parciales / diferidos) de meses anteriores
        que aún no han sido liquidados/pagados en meses intermedios.
        """
        records = session.query(AccountingRecord).filter(
            (AccountingRecord.year < current_year) |
            ((AccountingRecord.year == current_year) & (AccountingRecord.month <= current_month))
        ).order_by(AccountingRecord.year.asc(), AccountingRecord.month.asc()).all()

        settled_gestora = set()
        settled_caja = set()
        orig_gestora = {}
        orig_caja = {}
        curr_saved_gestora_map = {}
        curr_saved_caja_map = {}

        for rec in records:
            if not rec.data_json:
                continue
            try:
                data = json.loads(rec.data_json)
                rec_m = rec.month
                rec_y = rec.year

                g_pay = data.get("gestora_payment") or {}
                imp_items_g = g_pay.get("importes_restantes") or []
                has_items_g = False
                if imp_items_g:
                    for idx, it in enumerate(imp_items_g):
                        is_act = it.get("activo", True) if isinstance(it, dict) else getattr(it, "activo", True)
                        m_val = float(it.get("monto", 0.0) if isinstance(it, dict) else getattr(it, "monto", 0.0) or 0.0)
                        if is_act and m_val > 0 and (rec_y < current_year or (rec_y == current_year and rec_m < current_month)):
                            has_items_g = True
                            it_id = str(it.get("id") if isinstance(it, dict) else getattr(it, "id", None) or f"it_{idx}")
                            m_name_es = MONTH_NAMES[rec_m - 1] if 1 <= rec_m <= 12 else str(rec_m)
                            c_desc = str(it.get("concepto") if isinstance(it, dict) else getattr(it, "concepto", "") or "").strip()
                            if not c_desc:
                                c_desc = f"Importes restantes del mes de {m_name_es}"
                            d_ret = float(it.get("descuento_retenciones", 0.0) if isinstance(it, dict) else getattr(it, "descuento_retenciones", 0.0) or 0.0)
                            d_pat = float(it.get("descuento_patronal", 0.0) if isinstance(it, dict) else getattr(it, "descuento_patronal", 0.0) or 0.0)
                            if d_ret == 0.0 and d_pat == 0.0 and m_val > 0:
                                d_ret = round(m_val * 0.1271, 2)
                                d_pat = round(m_val * 0.0721, 2)
                            it_int = float(it.get("interes", 0.0) if isinstance(it, dict) else getattr(it, "interes", 0.0) or 0.0)
                            key = f"g_{rec_m}_{rec_y}_{it_id}"
                            orig_gestora[key] = PendingSettlementPayment(
                                id=key,
                                month_origen=rec_m,
                                year_origen=rec_y,
                                entidad="gestora",
                                concepto=c_desc,
                                monto_restante=round(d_ret + d_pat, 2),
                                monto_retenciones=round(d_ret, 2),
                                monto_patronal=round(d_pat, 2),
                                interes_mora=round(it_int, 2),
                                pagar_en_este_mes=False
                            )

                if not has_items_g:
                    imp_g = float(g_pay.get("importe_restante") or 0.0)
                    if imp_g > 0 and (rec_y < current_year or (rec_y == current_year and rec_m < current_month)):
                        m_name_es = MONTH_NAMES[rec_m - 1] if 1 <= rec_m <= 12 else str(rec_m)
                        desc_ret = float(g_pay.get("descuento_retenciones") or 0.0)
                        desc_pat = float(g_pay.get("descuento_patronal") or 0.0)
                        if desc_ret == 0.0 and desc_pat == 0.0:
                            desc_ret = round(imp_g * 0.1271, 2)
                            desc_pat = round(imp_g * 0.0721, 2)
                        key = f"g_{rec_m}_{rec_y}"
                        orig_gestora[key] = PendingSettlementPayment(
                            id=key,
                            month_origen=rec_m,
                            year_origen=rec_y,
                            entidad="gestora",
                            concepto=f"Importes restantes del mes de {m_name_es}",
                            monto_restante=round(desc_ret + desc_pat, 2),
                            monto_retenciones=round(desc_ret, 2),
                            monto_patronal=round(desc_pat, 2),
                            interes_mora=0.0,
                            pagar_en_este_mes=False
                        )

                # Items de caja de salud
                c_pay = data.get("caja_payment") or {}
                imp_items_c = c_pay.get("importes_restantes") or []
                has_items_c = False
                if imp_items_c:
                    for idx, it in enumerate(imp_items_c):
                        is_act = it.get("activo", True) if isinstance(it, dict) else getattr(it, "activo", True)
                        m_val = float(it.get("monto", 0.0) if isinstance(it, dict) else getattr(it, "monto", 0.0) or 0.0)
                        if is_act and m_val > 0 and (rec_y < current_year or (rec_y == current_year and rec_m < current_month)):
                            has_items_c = True
                            it_id = str(it.get("id") if isinstance(it, dict) else getattr(it, "id", None) or f"it_{idx}")
                            m_name_es = MONTH_NAMES[rec_m - 1] if 1 <= rec_m <= 12 else str(rec_m)
                            c_desc = str(it.get("concepto") if isinstance(it, dict) else getattr(it, "concepto", "") or "").strip()
                            if not c_desc:
                                c_desc = f"Importes restantes del mes de {m_name_es}"
                            d_salud = float(it.get("descuento_salud", 0.0) if isinstance(it, dict) else getattr(it, "descuento_salud", 0.0) or 0.0)
                            if d_salud == 0.0 and m_val > 0:
                                d_salud = round(m_val * 0.10, 2)
                            it_int = float(it.get("interes", 0.0) if isinstance(it, dict) else getattr(it, "interes", 0.0) or 0.0)
                            key = f"c_{rec_m}_{rec_y}_{it_id}"
                            orig_caja[key] = PendingSettlementPayment(
                                id=key,
                                month_origen=rec_m,
                                year_origen=rec_y,
                                entidad="caja",
                                concepto=c_desc,
                                monto_restante=round(d_salud, 2),
                                monto_retenciones=0.0,
                                monto_patronal=round(d_salud, 2),
                                interes_mora=round(it_int, 2),
                                pagar_en_este_mes=False
                            )

                if not has_items_c:
                    imp_c = float(c_pay.get("importe_restante") or 0.0)
                    if imp_c > 0 and (rec_y < current_year or (rec_y == current_year and rec_m < current_month)):
                        m_name_es = MONTH_NAMES[rec_m - 1] if 1 <= rec_m <= 12 else str(rec_m)
                        d_salud = round(imp_c * 0.10, 2)
                        key = f"c_{rec_m}_{rec_y}"
                        orig_caja[key] = PendingSettlementPayment(
                            id=key,
                            month_origen=rec_m,
                            year_origen=rec_y,
                            entidad="caja",
                            concepto=f"Importes restantes del mes de {m_name_es}",
                            monto_restante=round(d_salud, 2),
                            monto_retenciones=0.0,
                            monto_patronal=round(d_salud, 2),
                            interes_mora=0.0,
                            pagar_en_este_mes=False
                        )

                # Revisar si se liquidó en meses anteriores
                if rec_y < current_year or (rec_y == current_year and rec_m < current_month):
                    for ant in g_pay.get("pagos_restantes_anteriores", []) or []:
                        is_pag = ant.get("pagar_en_este_mes") if isinstance(ant, dict) else getattr(ant, "pagar_en_este_mes", False)
                        if is_pag:
                            mo = ant.get("month_origen") if isinstance(ant, dict) else getattr(ant, "month_origen", None)
                            yo = ant.get("year_origen") if isinstance(ant, dict) else getattr(ant, "year_origen", None)
                            ant_id = ant.get("id") if isinstance(ant, dict) else getattr(ant, "id", None)
                            if ant_id:
                                settled_gestora.add(str(ant_id))
                                if str(ant_id) == f"g_{mo}_{yo}":
                                    settled_gestora.add(f"g_{mo}_{yo}")
                            elif mo and yo:
                                settled_gestora.add(f"g_{mo}_{yo}")
                    for ant in c_pay.get("pagos_restantes_anteriores", []) or []:
                        is_pag = ant.get("pagar_en_este_mes") if isinstance(ant, dict) else getattr(ant, "pagar_en_este_mes", False)
                        if is_pag:
                            mo = ant.get("month_origen") if isinstance(ant, dict) else getattr(ant, "month_origen", None)
                            yo = ant.get("year_origen") if isinstance(ant, dict) else getattr(ant, "year_origen", None)
                            ant_id = ant.get("id") if isinstance(ant, dict) else getattr(ant, "id", None)
                            if ant_id:
                                settled_caja.add(str(ant_id))
                                if str(ant_id) == f"c_{mo}_{yo}":
                                    settled_caja.add(f"c_{mo}_{yo}")
                            elif mo and yo:
                                settled_caja.add(f"c_{mo}_{yo}")
                elif rec_m == current_month and rec_y == current_year:
                    for ant in g_pay.get("pagos_restantes_anteriores", []) or []:
                        mo = ant.get("month_origen") if isinstance(ant, dict) else getattr(ant, "month_origen", None)
                        yo = ant.get("year_origen") if isinstance(ant, dict) else getattr(ant, "year_origen", None)
                        ant_id = ant.get("id") if isinstance(ant, dict) else getattr(ant, "id", None)
                        if ant_id:
                            curr_saved_gestora_map[str(ant_id)] = ant
                        if mo and yo:
                            curr_saved_gestora_map[f"g_{mo}_{yo}"] = ant
                    for ant in c_pay.get("pagos_restantes_anteriores", []) or []:
                        mo = ant.get("month_origen") if isinstance(ant, dict) else getattr(ant, "month_origen", None)
                        yo = ant.get("year_origen") if isinstance(ant, dict) else getattr(ant, "year_origen", None)
                        ant_id = ant.get("id") if isinstance(ant, dict) else getattr(ant, "id", None)
                        if ant_id:
                            curr_saved_caja_map[str(ant_id)] = ant
                        if mo and yo:
                            curr_saved_caja_map[f"c_{mo}_{yo}"] = ant
            except Exception:
                pass

        pending_gestora = []
        for key, p in orig_gestora.items():
            base_legacy_key = f"g_{p.month_origen}_{p.year_origen}"
            is_settled = (p.id in settled_gestora) or (p.id == base_legacy_key and base_legacy_key in settled_gestora)
            if not is_settled:
                saved = curr_saved_gestora_map.get(p.id) or curr_saved_gestora_map.get(base_legacy_key)
                if saved:
                    p.pagar_en_este_mes = bool(saved.get("pagar_en_este_mes") if isinstance(saved, dict) else getattr(saved, "pagar_en_este_mes", False))
                    p.interes_mora = float(saved.get("interes_mora") if isinstance(saved, dict) else getattr(saved, "interes_mora", 0.0) or 0.0)
                pending_gestora.append(p)

        pending_caja = []
        for key, p in orig_caja.items():
            base_legacy_key = f"c_{p.month_origen}_{p.year_origen}"
            is_settled = (p.id in settled_caja) or (p.id == base_legacy_key and base_legacy_key in settled_caja)
            if not is_settled:
                saved = curr_saved_caja_map.get(p.id) or curr_saved_caja_map.get(base_legacy_key)
                if saved:
                    p.pagar_en_este_mes = bool(saved.get("pagar_en_este_mes") if isinstance(saved, dict) else getattr(saved, "pagar_en_este_mes", False))
                    p.interes_mora = float(saved.get("interes_mora") if isinstance(saved, dict) else getattr(saved, "interes_mora", 0.0) or 0.0)
                pending_caja.append(p)

        return pending_gestora, pending_caja

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
        default_caja = (tenant.caja_salud if (tenant and tenant.caja_salud) else 
                        ("Caja Petrolera de Salud" if "petrolera" in (tenant.numero_patronal or "").lower() else "Caja Nacional de Salud"))

        # Verificar bloqueo por fecha (primer dia del mes siguiente)
        today = datetime.now().date()
        last_day = calendar.monthrange(year, month)[1]
        end_of_month = date(year, month, last_day)
        is_locked_by_date = today > end_of_month

        # Obtener saldos pendientes de meses anteriores no liquidados
        pending_g, pending_c = AccountingService._get_pending_balances_for_month(tenant_session, month, year)

        # 1. Si no forzamos recalcular, verificar si ya existe registro guardado en accounting_records
        if not force_recalculate:
            existing = tenant_session.query(AccountingRecord).filter(
                AccountingRecord.month == month,
                AccountingRecord.year == year
            ).first()
            
            if existing and existing.data_json:
                try:
                    data = json.loads(existing.data_json)
                    sheet = AccountingSheetData(**data)
                    sheet.is_locked_by_date = is_locked_by_date

                    current_depts = tenant_session.query(Department).order_by(Department.id.asc()).all()
                    if not current_depts:
                        d_adm = Department(name="Administración", account_type="Administración", description="Área administrativa")
                        d_mo = Department(name="Mano de Obra / Producción", account_type="Mano de Obra / Producción", description="Área de operaciones y producción")
                        tenant_session.add_all([d_adm, d_mo])
                        tenant_session.commit()
                        current_depts = tenant_session.query(Department).order_by(Department.id.asc()).all()

                    today_str = today.strftime("%Y-%m-%d")

                    # Si el registro existente no tiene devengamiento o departamentos, reconstruir con la planilla
                    if not sheet.devengamiento or not sheet.devengamiento.departamentos:
                        payroll = tenant_session.query(Payroll).filter(
                            Payroll.month == month,
                            Payroll.year == year
                        ).first()
                        if payroll and payroll.payslips:
                            calc_sheet = AccountingService._calculate_from_payroll(
                                tenant_session, payroll, month, year, tenant_name, default_caja, is_locked_by_date, today_str
                            )
                        else:
                            calc_sheet = AccountingService._build_empty_sheet(
                                tenant_session, month, year, tenant_name, default_caja, is_locked_by_date, today_str
                            )
                        sheet.devengamiento = calc_sheet.devengamiento
                        sheet = AccountingService.build_full_sheet(
                            month=month,
                            year=year,
                            tenant_name=tenant_name,
                            caja_banco_name=sheet.caja_banco_name or "Caja Moneda Nacional",
                            devengamiento=sheet.devengamiento,
                            gestora_payment=sheet.gestora_payment or GestoraPaymentData(),
                            caja_payment=sheet.caja_payment or CajaPaymentData(),
                            min_trabajo_payment=sheet.min_trabajo_payment or MinTrabajoPaymentData(),
                            payroll_id=sheet.payroll_id,
                            is_locked_by_date=is_locked_by_date,
                            is_manually_unlocked=sheet.is_manually_unlocked,
                            is_customized=sheet.is_customized,
                            saldos_pendientes_gestora=pending_g,
                            saldos_pendientes_caja=pending_c
                        )
                    else:
                        # Sincronizar departamentos si se agregaron nuevos en la base de datos
                        existing_dept_ids = {d.id for d in sheet.devengamiento.departamentos if d.id}
                        existing_dept_names = {d.nombre.lower().strip() for d in sheet.devengamiento.departamentos}
                        added = False
                        for cd in current_depts:
                            if cd.id not in existing_dept_ids and cd.name.lower().strip() not in existing_dept_names:
                                sheet.devengamiento.departamentos.append(
                                    DepartmentPayrollItem(id=cd.id, nombre=cd.name, sueldos=0.0, bono_antiguedad=0.0, total_depto=0.0)
                                )
                                added = True
                        if added:
                            pass
                    
                    # Reconstruir siempre las secciones y glosas con build_full_sheet según las reglas vigentes
                    sheet = AccountingService.build_full_sheet(
                        month=month,
                        year=year,
                        tenant_name=tenant_name,
                        caja_banco_name=sheet.caja_banco_name or "Caja Moneda Nacional",
                        devengamiento=sheet.devengamiento,
                        gestora_payment=sheet.gestora_payment or GestoraPaymentData(),
                        caja_payment=sheet.caja_payment or CajaPaymentData(),
                        min_trabajo_payment=sheet.min_trabajo_payment or MinTrabajoPaymentData(),
                        payroll_id=sheet.payroll_id,
                        is_locked_by_date=is_locked_by_date,
                        is_manually_unlocked=sheet.is_manually_unlocked,
                        is_customized=sheet.is_customized,
                        saldos_pendientes_gestora=pending_g,
                        saldos_pendientes_caja=pending_c
                    )
                    return sheet
                except Exception as e:
                    print(f"Error parseando JSON existente: {e}")

        # 2. Calcular de forma automática a partir de la planilla
        payroll = tenant_session.query(Payroll).filter(
            Payroll.month == month,
            Payroll.year == year
        ).first()

        if year == today.year and month == today.month:
            payment_default_date_str = today.strftime("%Y-%m-%d")
        else:
            max_days = calendar.monthrange(year, month)[1]
            default_day = min(21, max_days)
            payment_default_date_str = f"{year:04d}-{month:02d}-{default_day:02d}"

        if not payroll or not payroll.payslips:
            return AccountingService._build_empty_sheet(tenant_session, month, year, tenant_name, default_caja, is_locked_by_date, payment_default_date_str)

        return AccountingService._calculate_from_payroll(
            tenant_session, payroll, month, year, tenant_name, default_caja, is_locked_by_date, payment_default_date_str
        )

    @staticmethod
    def _calculate_from_payroll(
        session: Session,
        payroll: Payroll,
        month: int,
        year: int,
        tenant_name: str,
        caja_name: str,
        is_locked_by_date: bool,
        today_str: str
    ) -> AccountingSheetData:
        employees = {e.id: e for e in session.query(Employee).all()}
        departments = session.query(Department).order_by(Department.id.asc()).all()

        if not departments:
            d_adm = Department(name="Administración", account_type="Administración", description="Área administrativa")
            d_mo = Department(name="Mano de Obra", account_type="Mano de Obra", description="Área de operaciones y producción")
            session.add_all([d_adm, d_mo])
            session.commit()
            departments = session.query(Department).order_by(Department.id.asc()).all()

        dept_totals = {d.id: {"sueldos": Decimal("0.00"), "bonos": Decimal("0.00")} for d in departments}
        total_retenciones = Decimal("0.00")
        total_liquido = Decimal("0.00")

        for ps in payroll.payslips:
            emp = employees.get(ps.employee_id)
            d_id = emp.department_id if emp and emp.department_id in dept_totals else None
            
            if not d_id and emp and emp.departamento:
                match_dept = next((d for d in departments if d.name.lower() == emp.departamento.lower()), None)
                if match_dept:
                    d_id = match_dept.id

            if not d_id and departments:
                d_id = departments[0].id

            h_basico = Decimal(str(ps.haber_basico or 0))
            b_antiguedad = Decimal(str(ps.bono_antiguedad or 0))
            ret_gestora = Decimal(str(ps.aporte_gestora or 0))
            liq = Decimal(str(ps.liquido_pagable or 0))

            if d_id and d_id in dept_totals:
                dept_totals[d_id]["sueldos"] += h_basico
                dept_totals[d_id]["bonos"] += b_antiguedad

            total_retenciones += ret_gestora
            total_liquido += liq

        dept_items = []
        total_ganado_calc = Decimal("0.00")
        for d in departments:
            s_val = float(round(dept_totals[d.id]["sueldos"], 2))
            b_val = float(round(dept_totals[d.id]["bonos"], 2))
            tot_d = round(s_val + b_val, 2)
            total_ganado_calc += Decimal(str(tot_d))
            dept_items.append(DepartmentPayrollItem(
                id=d.id,
                nombre=d.name,
                sueldos=s_val,
                bono_antiguedad=b_val,
                total_depto=tot_d
            ))

        total_ganado = total_ganado_calc
        subtotal_asiento_1_debe = float(round(total_ganado, 2))
        subtotal_asiento_1_haber = float(round(total_retenciones + total_liquido, 2))
        if abs(subtotal_asiento_1_debe - subtotal_asiento_1_haber) > 0.001:
            total_liquido = total_ganado - total_retenciones

        patronal_gestora_default = float(round(total_ganado * Decimal("0.0721"), 2))
        patronal_caja_default = float(round(total_ganado * Decimal("0.10"), 2))
        aguinaldo_default = float(round(total_ganado * Decimal("1") / Decimal("12"), 2))
        indemnizacion_default = float(round(total_ganado * Decimal("1") / Decimal("12"), 2))

        s_adm = next((d.sueldos for d in dept_items if "admin" in d.nombre.lower()), 0.0)
        b_adm = next((d.bono_antiguedad for d in dept_items if "admin" in d.nombre.lower()), 0.0)
        s_mo = next((d.sueldos for d in dept_items if "mano" in d.nombre.lower() or "prod" in d.nombre.lower()), 0.0)
        b_mo = next((d.bono_antiguedad for d in dept_items if "mano" in d.nombre.lower() or "prod" in d.nombre.lower()), 0.0)

        devengamiento = DevengamientoData(
            departamentos=dept_items,
            sueldos_adm=s_adm,
            bono_antiguedad_adm=b_adm,
            sueldos_mo=s_mo,
            bono_antiguedad_mo=b_mo,
            retenciones_ley=float(round(total_retenciones, 2)),
            sueldos_por_pagar=float(round(total_liquido, 2)),
            arancel_min_trabajo=27.00,
            caja_salud_choice=caja_name,
            patronal_gestora=patronal_gestora_default,
            patronal_caja=patronal_caja_default,
            aguinaldo=aguinaldo_default,
            indemnizacion=indemnizacion_default
        )

        gestora_payment = GestoraPaymentData(
            fecha=today_str,
            nro_transaccion="",
            intereses=[]
        )

        caja_payment = CajaPaymentData(
            caja_tipo=caja_name,
            fecha=today_str,
            nro_transaccion="",
            ajustes=[]
        )

        min_trabajo_payment = MinTrabajoPaymentData(
            fecha=today_str,
            nro_transaccion="",
            ajustes=[]
        )

        pending_g, pending_c = AccountingService._get_pending_balances_for_month(session, month, year)
        return AccountingService.build_full_sheet(
            month=month,
            year=year,
            tenant_name=tenant_name,
            caja_banco_name="Caja Moneda Nacional",
            devengamiento=devengamiento,
            gestora_payment=gestora_payment,
            caja_payment=caja_payment,
            min_trabajo_payment=min_trabajo_payment,
            payroll_id=payroll.id,
            is_locked_by_date=is_locked_by_date,
            is_manually_unlocked=False,
            is_customized=False,
            saldos_pendientes_gestora=pending_g,
            saldos_pendientes_caja=pending_c
        )

    @staticmethod
    def build_full_sheet(
        month: int,
        year: int,
        tenant_name: str,
        caja_banco_name: str,
        devengamiento: DevengamientoData,
        gestora_payment: GestoraPaymentData,
        caja_payment: CajaPaymentData,
        min_trabajo_payment: MinTrabajoPaymentData,
        payroll_id: Optional[int] = None,
        is_locked_by_date: bool = False,
        is_manually_unlocked: bool = False,
        is_customized: bool = False,
        saldos_pendientes_gestora: Optional[List[PendingSettlementPayment]] = None,
        saldos_pendientes_caja: Optional[List[PendingSettlementPayment]] = None
    ) -> AccountingSheetData:
        saldos_pendientes_gestora = saldos_pendientes_gestora or []
        saldos_pendientes_caja = saldos_pendientes_caja or []

        # Si no hay pagos anteriores definidos pero sí saldos pendientes descubiertos, inicializarlos
        if not getattr(gestora_payment, 'pagos_restantes_anteriores', None) and saldos_pendientes_gestora:
            gestora_payment.pagos_restantes_anteriores = [
                p if isinstance(p, PendingSettlementPayment) else PendingSettlementPayment(**p)
                for p in saldos_pendientes_gestora
            ]

        if not getattr(caja_payment, 'pagos_restantes_anteriores', None) and saldos_pendientes_caja:
            caja_payment.pagos_restantes_anteriores = [
                p if isinstance(p, PendingSettlementPayment) else PendingSettlementPayment(**p)
                for p in saldos_pendientes_caja
            ]

        # Total ganado devengado del cuadrante 1
        if devengamiento.departamentos:
            tot_ganado = round(sum(d.sueldos + d.bono_antiguedad for d in devengamiento.departamentos), 2)
        else:
            tot_ganado = round(
                devengamiento.sueldos_adm +
                devengamiento.bono_antiguedad_adm +
                devengamiento.sueldos_mo +
                devengamiento.bono_antiguedad_mo,
                2
            )

        # Retenciones y líquido
        ret_laboral = round(devengamiento.retenciones_ley, 2)
        liq_pagable = round(devengamiento.sueldos_por_pagar, 2)
        if round(ret_laboral + liq_pagable, 2) != tot_ganado:
            liq_pagable = round(tot_ganado - ret_laboral, 2)

        # Cuadrante 2: Aportes Patronales (editables o calculados)
        if devengamiento.patronal_gestora is not None and devengamiento.patronal_gestora > 0:
            patronal_gestora = round(devengamiento.patronal_gestora, 2)
        else:
            patronal_gestora = round(tot_ganado * 0.0721, 2)
            devengamiento.patronal_gestora = patronal_gestora

        if devengamiento.patronal_caja is not None and devengamiento.patronal_caja > 0:
            patronal_caja = round(devengamiento.patronal_caja, 2)
        else:
            patronal_caja = round(tot_ganado * 0.10, 2)
            devengamiento.patronal_caja = patronal_caja

        subtotal_patronal = round(patronal_gestora + patronal_caja, 2)
        caja_activa = caja_payment.caja_tipo or devengamiento.caja_salud_choice or "Caja Petrolera de Salud"

        # Cuadrante 3: Beneficios Sociales (editables o calculados)
        if devengamiento.aguinaldo is not None and devengamiento.aguinaldo > 0:
            aguinaldo = round(devengamiento.aguinaldo, 2)
        else:
            aguinaldo = round(tot_ganado * (1 / 12), 2)
            devengamiento.aguinaldo = aguinaldo

        if devengamiento.indemnizacion is not None and devengamiento.indemnizacion > 0:
            indemnizacion = round(devengamiento.indemnizacion, 2)
        else:
            indemnizacion = round(tot_ganado * (1 / 12), 2)
            devengamiento.indemnizacion = indemnizacion

        subtotal_beneficios = round(aguinaldo + indemnizacion, 2)

        # Cuadrante 4: Ministerio de Trabajo (Arancel Mensual y Trámites)
        arancel_min_trabajo = round(devengamiento.arancel_min_trabajo if devengamiento.arancel_min_trabajo is not None else 27.00, 2)
        tramites_mt = getattr(devengamiento, 'tramites_min_trabajo', []) or []
        sum_tramites_mt = 0.0
        tramites_desc_list = []
        for t in tramites_mt:
            m_t = float(t.monto if hasattr(t, 'monto') else (t.get('monto', 0.0) if isinstance(t, dict) else 0.0) or 0.0)
            desc_t = str(t.descripcion if hasattr(t, 'descripcion') else (t.get('descripcion', '') if isinstance(t, dict) else '') or '').strip()
            if m_t > 0:
                sum_tramites_mt += m_t
                tramites_desc_list.append(f"{desc_t}: Bs. {m_t:,.2f}" if desc_t else f"Trámite: Bs. {m_t:,.2f}")
        sum_tramites_mt = round(sum_tramites_mt, 2)
        total_min_trabajo = round(arancel_min_trabajo + sum_tramites_mt, 2)

        # Cuadrante 5: Asiento de Pago Gestora con cálculo de importes restantes y saldos anteriores
        tot_base_gestora = round(ret_laboral + patronal_gestora, 2)
        imp_items_g = getattr(gestora_payment, 'importes_restantes', []) or []
        total_desc_ret = 0.0
        total_desc_pat = 0.0
        if imp_items_g:
            for it in imp_items_g:
                is_act = it.activo if hasattr(it, 'activo') else it.get('activo', True)
                m_it = float(it.monto if hasattr(it, 'monto') else it.get('monto', 0.0) or 0.0)
                if is_act and m_it > 0:
                    d_r = round(m_it * 0.1271, 2)
                    d_p = round(m_it * 0.0721, 2)
                    total_desc_ret += d_r
                    total_desc_pat += d_p
                    if hasattr(it, 'descuento_retenciones'):
                        it.descuento_retenciones = d_r
                        it.descuento_patronal = d_p
                    elif isinstance(it, dict):
                        it['descuento_retenciones'] = d_r
                        it['descuento_patronal'] = d_p
            total_desc_ret = min(round(total_desc_ret, 2), ret_laboral)
            total_desc_pat = min(round(total_desc_pat, 2), patronal_gestora)
            gestora_payment.descuento_retenciones = total_desc_ret
            gestora_payment.descuento_patronal = total_desc_pat
            gestora_payment.importe_restante = round(total_desc_ret + total_desc_pat, 2)
            ret_a_pagar = max(0.0, round(ret_laboral - total_desc_ret, 2))
            pat_a_pagar = max(0.0, round(patronal_gestora - total_desc_pat, 2))
            imp_restante_g = gestora_payment.importe_restante
        else:
            imp_restante_g = float(getattr(gestora_payment, 'importe_restante', 0.0) or 0.0)
            if imp_restante_g > 0:
                d_r = min(round(imp_restante_g * 0.1271, 2), ret_laboral)
                d_p = min(round(imp_restante_g * 0.0721, 2), patronal_gestora)
                gestora_payment.descuento_retenciones = d_r
                gestora_payment.descuento_patronal = d_p
                gestora_payment.importe_restante = round(d_r + d_p, 2)
                ret_a_pagar = max(0.0, round(ret_laboral - d_r, 2))
                pat_a_pagar = max(0.0, round(patronal_gestora - d_p, 2))
                imp_restante_g = gestora_payment.importe_restante
            else:
                gestora_payment.descuento_retenciones = 0.0
                gestora_payment.descuento_patronal = 0.0
                ret_a_pagar = ret_laboral
                pat_a_pagar = patronal_gestora
                imp_restante_g = 0.0

        items_gestora = []
        if ret_a_pagar > 0:
            items_gestora.append(
                AccountingEntryItem(cuenta="Retenciones Laborales por Pagar", debe=ret_a_pagar, haber=0.0)
            )
        if pat_a_pagar > 0:
            items_gestora.append(
                AccountingEntryItem(cuenta="Ap. Patronal Gestora Publica por Pagar", debe=pat_a_pagar, haber=0.0)
            )

        sum_intereses_gestora = 0.0
        extras_g_conceptos = []
        for extra in (gestora_payment.intereses or []):
            m_val = round(extra.monto, 2)
            if m_val > 0:
                sum_intereses_gestora += m_val
                tipo_desc = "Multa" if extra.tipo == "multa" else ("Actualización" if extra.tipo == "actualizacion" else "Interés")
                nombre_cuenta = extra.concepto.strip() if extra.concepto and extra.concepto.strip() else f"{tipo_desc} Gestora Pública"
                items_gestora.append(
                    AccountingEntryItem(
                        cuenta=nombre_cuenta,
                        debe=m_val,
                        haber=0.0,
                        tag="Gasto Financiero"
                    )
                )
                extras_g_conceptos.append(extra.concepto.strip() if extra.concepto and extra.concepto.strip() else f"{tipo_desc} Bs. {m_val:,.2f}")

        # Saldos pendientes de meses anteriores liquidados en este mes
        sum_anteriores_gestora = 0.0
        for ant in (getattr(gestora_payment, 'pagos_restantes_anteriores', []) or []):
            is_pagar = getattr(ant, 'pagar_en_este_mes', False) if isinstance(ant, dict) is False else ant.get('pagar_en_este_mes', False)
            if is_pagar:
                m_orig = getattr(ant, 'month_origen', 1) if isinstance(ant, dict) is False else ant.get('month_origen', 1)
                y_orig = getattr(ant, 'year_origen', year) if isinstance(ant, dict) is False else ant.get('year_origen', year)
                m_nom = MONTH_NAMES[m_orig - 1].capitalize()
                c_desc = (getattr(ant, 'concepto', '') if isinstance(ant, dict) is False else ant.get('concepto', '')) or ''
                sub_label_g = f"Saldo diferido {m_nom} {y_orig}"
                if c_desc.strip():
                    sub_label_g += f" ({c_desc.strip()})"
                m_ret = getattr(ant, 'monto_retenciones', 0.0) if isinstance(ant, dict) is False else ant.get('monto_retenciones', 0.0)
                m_pat = getattr(ant, 'monto_patronal', 0.0) if isinstance(ant, dict) is False else ant.get('monto_patronal', 0.0)
                int_mora = getattr(ant, 'interes_mora', 0.0) if isinstance(ant, dict) is False else ant.get('interes_mora', 0.0)

                if m_ret > 0:
                    items_gestora.append(
                        AccountingEntryItem(
                            cuenta="Retenciones Laborales por Pagar",
                            debe=round(m_ret, 2),
                            haber=0.0,
                            subcuentas=[sub_label_g]
                        )
                    )
                    sum_anteriores_gestora += round(m_ret, 2)
                if m_pat > 0:
                    items_gestora.append(
                        AccountingEntryItem(
                            cuenta="Ap. Patronal Gestora Publica por Pagar",
                            debe=round(m_pat, 2),
                            haber=0.0,
                            subcuentas=[sub_label_g]
                        )
                    )
                    sum_anteriores_gestora += round(m_pat, 2)
                if int_mora > 0:
                    items_gestora.append(
                        AccountingEntryItem(
                            cuenta="Interés por Mora Gestora Pública",
                            debe=round(int_mora, 2),
                            haber=0.0,
                            tag="Gasto Financiero",
                            subcuentas=[f"Mora saldo {m_nom} {y_orig}"]
                        )
                    )
                    sum_anteriores_gestora += round(int_mora, 2)
                    extras_g_conceptos.append(f"Mora saldo diferido {m_nom} {y_orig} Bs. {int_mora:,.2f}")

        total_pago_gestora = round(ret_a_pagar + pat_a_pagar + sum_intereses_gestora + sum_anteriores_gestora, 2)
        items_gestora.append(
            AccountingEntryItem(cuenta=caja_banco_name, debe=0.0, haber=total_pago_gestora)
        )

        label_gestora = "FECHA DE PAGO GESTORA"
        if gestora_payment.fecha:
            label_gestora += f" ({gestora_payment.fecha})"
        if gestora_payment.nro_transaccion:
            label_gestora += f" - N° {gestora_payment.nro_transaccion}"

        # Cuadrante 6: Asiento de Pago Caja de Salud con cálculo de importes restantes y saldos anteriores
        imp_items_c = getattr(caja_payment, 'importes_restantes', []) or []
        total_desc_caja = 0.0
        if imp_items_c:
            for it in imp_items_c:
                is_act = it.activo if hasattr(it, 'activo') else it.get('activo', True)
                m_it = float(it.monto if hasattr(it, 'monto') else it.get('monto', 0.0) or 0.0)
                if is_act and m_it > 0:
                    d_c = round(m_it * 0.10, 2)
                    total_desc_caja += d_c
                    if hasattr(it, 'descuento_salud'):
                        it.descuento_salud = d_c
                    elif isinstance(it, dict):
                        it['descuento_salud'] = d_c
            total_desc_caja = min(round(total_desc_caja, 2), patronal_caja)
            caja_payment.importe_restante = total_desc_caja
            caja_a_pagar = max(0.0, round(patronal_caja - total_desc_caja, 2))
            imp_restante_c = caja_payment.importe_restante
        else:
            imp_restante_c = float(getattr(caja_payment, 'importe_restante', 0.0) or 0.0)
            if imp_restante_c > 0:
                d_c = min(round(imp_restante_c * 0.10, 2), patronal_caja)
                caja_payment.importe_restante = d_c
                caja_a_pagar = max(0.0, round(patronal_caja - d_c, 2))
                imp_restante_c = caja_payment.importe_restante
            else:
                caja_a_pagar = patronal_caja
                imp_restante_c = 0.0

        items_caja = []
        if caja_a_pagar > 0:
            items_caja.append(
                AccountingEntryItem(cuenta=f"{caja_activa} por Pagar", debe=caja_a_pagar, haber=0.0)
            )

        sum_ajustes_caja = 0.0
        extras_c_conceptos = []
        for extra in (caja_payment.ajustes or []):
            m_val = round(extra.monto, 2)
            if m_val > 0:
                sum_ajustes_caja += m_val
                tipo_label = "Actualización UFV" if extra.tipo == "actualizacion" else "Interés"
                nombre_cuenta = extra.concepto.strip() if extra.concepto and extra.concepto.strip() else f"{tipo_label} {caja_activa}"
                items_caja.append(
                    AccountingEntryItem(
                        cuenta=nombre_cuenta,
                        debe=m_val,
                        haber=0.0,
                        tag="Gasto Operativo"
                    )
                )
                extras_c_conceptos.append(extra.concepto.strip() if extra.concepto and extra.concepto.strip() else f"{tipo_label} Bs. {m_val:,.2f}")

        # Saldos pendientes de meses anteriores liquidados en este mes
        sum_anteriores_caja = 0.0
        for ant in (getattr(caja_payment, 'pagos_restantes_anteriores', []) or []):
            is_pagar = getattr(ant, 'pagar_en_este_mes', False) if isinstance(ant, dict) is False else ant.get('pagar_en_este_mes', False)
            if is_pagar:
                m_orig = getattr(ant, 'month_origen', 1) if isinstance(ant, dict) is False else ant.get('month_origen', 1)
                y_orig = getattr(ant, 'year_origen', year) if isinstance(ant, dict) is False else ant.get('year_origen', year)
                m_nom = MONTH_NAMES[m_orig - 1].capitalize()
                c_desc = (getattr(ant, 'concepto', '') if isinstance(ant, dict) is False else ant.get('concepto', '')) or ''
                sub_label_c = f"Saldo diferido {m_nom} {y_orig}"
                if c_desc.strip():
                    sub_label_c += f" ({c_desc.strip()})"
                m_rest = getattr(ant, 'monto_restante', 0.0) if isinstance(ant, dict) is False else ant.get('monto_restante', 0.0)
                int_mora = getattr(ant, 'interes_mora', 0.0) if isinstance(ant, dict) is False else ant.get('interes_mora', 0.0)

                if m_rest > 0:
                    items_caja.append(
                        AccountingEntryItem(
                            cuenta=f"{caja_activa} por Pagar",
                            debe=round(m_rest, 2),
                            haber=0.0,
                            subcuentas=[sub_label_c]
                        )
                    )
                    sum_anteriores_caja += round(m_rest, 2)
                if int_mora > 0:
                    items_caja.append(
                        AccountingEntryItem(
                            cuenta=f"Interés y Actualización {caja_activa}",
                            debe=round(int_mora, 2),
                            haber=0.0,
                            tag="Gasto Financiero",
                            subcuentas=[f"Mora saldo {m_nom} {y_orig}"]
                        )
                    )
                    sum_anteriores_caja += round(int_mora, 2)
                    extras_c_conceptos.append(f"Mora saldo diferido {m_nom} {y_orig} Bs. {int_mora:,.2f}")

        total_pago_caja = round(caja_a_pagar + sum_ajustes_caja + sum_anteriores_caja, 2)
        items_caja.append(
            AccountingEntryItem(cuenta=caja_banco_name, debe=0.0, haber=total_pago_caja)
        )

        label_caja = caja_activa.upper()
        if caja_payment.fecha:
            label_caja += f" ({caja_payment.fecha})"
        if caja_payment.nro_transaccion:
            label_caja += f" - N° {caja_payment.nro_transaccion}"

        # Cuadrante 7: Asiento de Pago Ministerio de Trabajo
        items_min_trabajo = [
            AccountingEntryItem(cuenta="Ministerio de Trabajo por Pagar", debe=total_min_trabajo, haber=0.0)
        ]
        sum_ajustes_mt = 0.0
        extras_mt_conceptos = []
        for extra in min_trabajo_payment.ajustes:
            m = round(extra.monto, 2)
            if m > 0:
                sum_ajustes_mt += m
                tipo_label = "Multa" if extra.tipo == "multa" else "Interés"
                nombre_cuenta = extra.concepto.strip() if extra.concepto and extra.concepto.strip() else f"{tipo_label} Ministerio de Trabajo"
                items_min_trabajo.append(
                    AccountingEntryItem(
                        cuenta=nombre_cuenta,
                        debe=m,
                        haber=0.0,
                        tag="Gasto Operativo"
                    )
                )
                extras_mt_conceptos.append(extra.concepto.strip() if extra.concepto and extra.concepto.strip() else f"{tipo_label} Bs. {m:,.2f}")
        total_pago_mt = round(total_min_trabajo + sum_ajustes_mt, 2)
        items_min_trabajo.append(
            AccountingEntryItem(cuenta=caja_banco_name, debe=0.0, haber=total_pago_mt)
        )

        label_mt = "FECHA DE PAGO MINISTERIO DE TRABAJO"
        if min_trabajo_payment.fecha:
            label_mt += f" ({min_trabajo_payment.fecha})"
        if min_trabajo_payment.nro_transaccion:
            label_mt += f" - N° {min_trabajo_payment.nro_transaccion}"

        last_day = calendar.monthrange(year, month)[1]
        closing_date_str = f"{last_day:02d}/{month:02d}/{year}"

        def _format_date(d_str: Optional[str], fallback: str = "") -> str:
            if not d_str:
                return fallback
            s = str(d_str).strip()
            if "/" in s:
                return s
            if "-" in s:
                parts = s.split("-")
                if len(parts) == 3 and len(parts[0]) == 4:
                    return f"{parts[2]}/{parts[1]}/{parts[0]}"
            return s

        fecha_gestora = _format_date(gestora_payment.fecha, closing_date_str)
        fecha_caja = _format_date(caja_payment.fecha, closing_date_str)
        fecha_mt = _format_date(min_trabajo_payment.fecha, closing_date_str)

        month_str = MONTH_NAMES[month - 1].upper()

        has_gestora_data = bool(gestora_payment.fecha or gestora_payment.nro_transaccion or extras_g_conceptos or imp_restante_g > 0 or sum_anteriores_gestora > 0)
        if has_gestora_data:
            doc_gestora = f", según Documento/Transacción N° {gestora_payment.nro_transaccion}" if gestora_payment.nro_transaccion else ""
            desc_gestora = f", incluyendo {', '.join(extras_g_conceptos)}" if extras_g_conceptos else ""
            fec_gestora = f", de fecha {fecha_gestora}" if fecha_gestora else ""
            rest_gestora = f" (quedando un saldo pendiente diferido de Bs. {imp_restante_g:,.2f})" if imp_restante_g > 0 else ""
            glosa_gestora = f"Glosa: Por el pago de retenciones laborales y aportes a la Gestora Pública correspondiente al mes de {month_str} de {year}{doc_gestora}{desc_gestora}{rest_gestora}{fec_gestora}."
        else:
            glosa_gestora = None

        has_caja_data = bool(caja_payment.fecha or caja_payment.nro_transaccion or extras_c_conceptos or imp_restante_c > 0 or sum_anteriores_caja > 0)
        if has_caja_data:
            doc_caja = f", según Documento/Transacción N° {caja_payment.nro_transaccion}" if caja_payment.nro_transaccion else ""
            desc_caja = f", incluyendo {', '.join(extras_c_conceptos)}" if extras_c_conceptos else ""
            fec_caja = f", de fecha {fecha_caja}" if fecha_caja else ""
            rest_caja = f" (quedando un saldo pendiente diferido de Bs. {imp_restante_c:,.2f})" if imp_restante_c > 0 else ""
            glosa_caja = f"Glosa: Por el pago de aporte patronal de salud ({caja_activa}) correspondiente al mes de {month_str} de {year}{doc_caja}{desc_caja}{rest_caja}{fec_caja}."
        else:
            glosa_caja = None

        has_mt_data = bool(min_trabajo_payment.fecha or min_trabajo_payment.nro_transaccion or extras_mt_conceptos)
        if has_mt_data:
            doc_mt = f", según Documento/Transacción N° {min_trabajo_payment.nro_transaccion}" if min_trabajo_payment.nro_transaccion else ""
            desc_mt = f", incluyendo {', '.join(extras_mt_conceptos)}" if extras_mt_conceptos else ""
            fec_mt = f", de fecha {fecha_mt}" if fecha_mt else ""
            glosa_mt = f"Glosa: Por el pago de obligaciones y arancel OVT ante el Ministerio de Trabajo correspondiente al mes de {month_str} de {year}{doc_mt}{desc_mt}{fec_mt}."
        else:
            glosa_mt = None

        subcuentas_mt = [f"Arancel Mensual OVT: Bs. {arancel_min_trabajo:,.2f}"] + tramites_desc_list

        sections = [
            # Seccion 1: Devengamiento
            AccountingSection(
                id="seccion_1_planilla",
                title="Devengamiento de Sueldos y Salarios (Nómina)",
                voucher_type="Comprobante de Traspaso",
                fecha=closing_date_str,
                is_payment=False,
                glosa=None,
                items=(
                    [
                        item
                        for d in devengamiento.departamentos
                        for item in (
                            [
                                AccountingEntryItem(
                                    cuenta="Mano de Obra" if ("mano de obra" in d.nombre.lower() or "produccion" in d.nombre.lower() or "producción" in d.nombre.lower()) else ("Sueldos y Salarios" if "admin" in d.nombre.lower() else f"Sueldos y Salarios {d.nombre}"),
                                    debe=d.sueldos,
                                    haber=0.0,
                                    tag=d.nombre
                                ),
                                AccountingEntryItem(
                                    cuenta=f"Bono de Antiguedad {d.nombre}" if ("mano de obra" in d.nombre.lower() or "admin" not in d.nombre.lower()) else "Bono de Antiguedad",
                                    debe=d.bono_antiguedad,
                                    haber=0.0,
                                    tag=d.nombre
                                )
                            ]
                        )
                    ] if devengamiento.departamentos else [
                        AccountingEntryItem(cuenta="Sueldos y Salarios", debe=devengamiento.sueldos_adm, haber=0.0, tag="Gasto Administrativo"),
                        AccountingEntryItem(cuenta="Bono de Antiguedad", debe=devengamiento.bono_antiguedad_adm, haber=0.0, tag="Gasto Administrativo"),
                        AccountingEntryItem(cuenta="Mano de Obra", debe=devengamiento.sueldos_mo, haber=0.0, tag="Costo de Producción"),
                        AccountingEntryItem(cuenta="Bono de Antiguedad Mano de Obra", debe=devengamiento.bono_antiguedad_mo, haber=0.0, tag="Costo de Producción"),
                    ]
                ) + [
                    AccountingEntryItem(cuenta="Retenciones Laborales por Pagar", debe=0.0, haber=ret_laboral, subcuentas=["Aporte Laboral Gestora 12.71%"], tag="Pasivo Laboral"),
                    AccountingEntryItem(cuenta="Sueldos y Salarios por pagar", debe=0.0, haber=liq_pagable, tag="Pasivo Laboral")
                ],
                subtotal_debe=tot_ganado,
                subtotal_haber=round(ret_laboral + liq_pagable, 2)
            ),
            # Seccion 2: Patronal
            AccountingSection(
                id="seccion_2_patronal",
                title="Aportes Patronales (Cargas Sociales)",
                voucher_type="Comprobante de Traspaso",
                fecha=closing_date_str,
                is_payment=False,
                glosa=None,
                items=[
                    AccountingEntryItem(cuenta="Aportes Patronales - Gestora publica", debe=patronal_gestora, haber=0.0, subcuentas=["Prima AFP 1.71%", "Viviena 2%", "Solidario 3%"]),
                    AccountingEntryItem(cuenta="Aporte Patronal-Seguro de Salud", debe=patronal_caja, haber=0.0, subcuentas=[f"{caja_activa} 10%"]),
                    AccountingEntryItem(cuenta="Ap. Patronal Gestora Publica por Pagar", debe=0.0, haber=patronal_gestora),
                    AccountingEntryItem(cuenta=f"{caja_activa} por Pagar", debe=0.0, haber=patronal_caja)
                ],
                subtotal_debe=subtotal_patronal,
                subtotal_haber=subtotal_patronal
            ),
            # Seccion 3: Beneficios
            AccountingSection(
                id="seccion_3_beneficios",
                title="Beneficios Sociales (Previsiones y Provisiones)",
                voucher_type="Comprobante de Traspaso",
                fecha=closing_date_str,
                is_payment=False,
                glosa=None,
                items=[
                    AccountingEntryItem(cuenta="Aguinaldos", debe=aguinaldo, haber=0.0, subcuentas=["Un doceavo 8.33%"]),
                    AccountingEntryItem(cuenta="Indemnizaciones", debe=indemnizacion, haber=0.0, subcuentas=["Un doceavo 8.33%"]),
                    AccountingEntryItem(cuenta="Provision Aguinaldos", debe=0.0, haber=aguinaldo),
                    AccountingEntryItem(cuenta="Provision Beneficios Sociales", debe=0.0, haber=indemnizacion)
                ],
                subtotal_debe=subtotal_beneficios,
                subtotal_haber=subtotal_beneficios
            ),
            # Seccion 4: Min Trabajo
            AccountingSection(
                id="seccion_4_min_trabajo",
                title="Ministerio de Trabajo (Arancel OVT y Trámites)",
                voucher_type="Comprobante de Traspaso",
                fecha=closing_date_str,
                is_payment=False,
                glosa=None,
                items=[
                    AccountingEntryItem(cuenta="Ministerio de Trabajo", debe=total_min_trabajo, haber=0.0, subcuentas=subcuentas_mt if sum_tramites_mt > 0 else None),
                    AccountingEntryItem(cuenta="Ministerio de Trabajo por Pagar", debe=0.0, haber=total_min_trabajo)
                ],
                subtotal_debe=total_min_trabajo,
                subtotal_haber=total_min_trabajo
            ),
            # Seccion 5: Pago Gestora
            AccountingSection(
                id="seccion_5_pago_gestora",
                title="Cancelación Aportes Gestora",
                voucher_type="Comprobante de Egreso",
                fecha=fecha_gestora,
                is_payment=True,
                payment_label=label_gestora,
                glosa=glosa_gestora,
                items=items_gestora,
                subtotal_debe=total_pago_gestora,
                subtotal_haber=total_pago_gestora
            ),
            # Seccion 6: Pago Caja
            AccountingSection(
                id="seccion_6_pago_caja",
                title="Cancelación Aporte Caja de Salud",
                voucher_type="Comprobante de Egreso",
                fecha=fecha_caja,
                is_payment=True,
                payment_label=label_caja,
                glosa=glosa_caja,
                items=items_caja,
                subtotal_debe=total_pago_caja,
                subtotal_haber=total_pago_caja
            ),
            # Seccion 7: Pago Min Trabajo
            AccountingSection(
                id="seccion_7_pago_min_trabajo",
                title="Cancelación Ministerio de Trabajo",
                voucher_type="Comprobante de Egreso",
                fecha=fecha_mt,
                is_payment=True,
                payment_label=label_mt,
                glosa=glosa_mt,
                items=items_min_trabajo,
                subtotal_debe=total_pago_mt,
                subtotal_haber=total_pago_mt
            )
        ]
        tot_debe = round(sum(s.subtotal_debe for s in sections), 2)
        tot_haber = round(sum(s.subtotal_haber for s in sections), 2)
        diferencia = round(abs(tot_debe - tot_haber), 2)

        return AccountingSheetData(
            month=month,
            year=year,
            month_name=MONTH_NAMES[month - 1],
            tenant_name=tenant_name,
            caja_banco_name=caja_banco_name,
            caja_salud_name=caja_activa,
            arancel_min_trabajo=arancel_min_trabajo,
            devengamiento=devengamiento,
            gestora_payment=gestora_payment,
            caja_payment=caja_payment,
            min_trabajo_payment=min_trabajo_payment,
            sections=sections,
            total_debe=tot_debe,
            total_haber=tot_haber,
            is_cuadrado=(diferencia == 0.0),
            diferencia=diferencia,
            has_payroll=(payroll_id is not None),
            payroll_id=payroll_id,
            is_customized=is_customized,
            is_locked_by_date=is_locked_by_date,
            is_manually_unlocked=is_manually_unlocked,
            saldos_pendientes_gestora=saldos_pendientes_gestora,
            saldos_pendientes_caja=saldos_pendientes_caja
        )

    @staticmethod
    def _build_empty_sheet(
        session: Session,
        month: int,
        year: int,
        tenant_name: str,
        caja_name: str,
        is_locked_by_date: bool,
        today_str: str
    ) -> AccountingSheetData:
        departments = session.query(Department).order_by(Department.id.asc()).all()
        dept_items = [
            DepartmentPayrollItem(
                id=d.id,
                nombre=d.name,
                sueldos=0.0,
                bono_antiguedad=0.0,
                total_depto=0.0
            )
            for d in departments
        ]
        dev = DevengamientoData(
            departamentos=dept_items,
            caja_salud_choice=caja_name,
            arancel_min_trabajo=27.00
        )
        gest = GestoraPaymentData(fecha=today_str)
        caj = CajaPaymentData(caja_tipo=caja_name, fecha=today_str)
        mt = MinTrabajoPaymentData(fecha=today_str)

        pending_g, pending_c = AccountingService._get_pending_balances_for_month(session, month, year)
        return AccountingService.build_full_sheet(
            month=month,
            year=year,
            tenant_name=tenant_name,
            caja_banco_name="Caja Moneda Nacional",
            devengamiento=dev,
            gestora_payment=gest,
            caja_payment=caj,
            min_trabajo_payment=mt,
            payroll_id=None,
            is_locked_by_date=is_locked_by_date,
            is_manually_unlocked=False,
            is_customized=False,
            saldos_pendientes_gestora=pending_g,
            saldos_pendientes_caja=pending_c
        )

    @staticmethod
    def save_custom_sheet(
        session: Session,
        month: int,
        year: int,
        sheet_data: AccountingSheetData
    ) -> Tuple[AccountingRecord, AccountingSheetData]:
        pending_g, pending_c = AccountingService._get_pending_balances_for_month(session, month, year)
        sheet_data = AccountingService.build_full_sheet(
            month=month,
            year=year,
            tenant_name=sheet_data.tenant_name,
            caja_banco_name=sheet_data.caja_banco_name or "Caja Moneda Nacional",
            devengamiento=sheet_data.devengamiento,
            gestora_payment=sheet_data.gestora_payment or GestoraPaymentData(),
            caja_payment=sheet_data.caja_payment or CajaPaymentData(),
            min_trabajo_payment=sheet_data.min_trabajo_payment or MinTrabajoPaymentData(),
            payroll_id=sheet_data.payroll_id,
            is_locked_by_date=sheet_data.is_locked_by_date,
            is_manually_unlocked=sheet_data.is_manually_unlocked,
            is_customized=True,
            saldos_pendientes_gestora=pending_g,
            saldos_pendientes_caja=pending_c
        )

        json_str = sheet_data.model_dump_json()

        record = session.query(AccountingRecord).filter(
            AccountingRecord.month == month,
            AccountingRecord.year == year
        ).first()

        if not record:
            record = AccountingRecord(
                month=month,
                year=year,
                payroll_id=sheet_data.payroll_id,
                caja_banco_name=sheet_data.caja_banco_name,
                fecha_pago_gestora=sheet_data.gestora_payment.fecha if sheet_data.gestora_payment else "",
                fecha_pago_caja=sheet_data.caja_payment.fecha if sheet_data.caja_payment else "",
                fecha_pago_min_trabajo=sheet_data.min_trabajo_payment.fecha if sheet_data.min_trabajo_payment else "",
                data_json=json_str,
                is_customized=True
            )
            session.add(record)
        else:
            record.payroll_id = sheet_data.payroll_id
            record.caja_banco_name = sheet_data.caja_banco_name
            record.fecha_pago_gestora = sheet_data.gestora_payment.fecha if sheet_data.gestora_payment else ""
            record.fecha_pago_caja = sheet_data.caja_payment.fecha if sheet_data.caja_payment else ""
            record.fecha_pago_min_trabajo = sheet_data.min_trabajo_payment.fecha if sheet_data.min_trabajo_payment else ""
            record.data_json = json_str
            record.is_customized = True

        session.commit()
        session.refresh(record)
        return record, sheet_data

    @staticmethod
    def reflect_previous_month(
        tenant_session: Session,
        public_session: Session,
        schema_name: str,
        month: int,
        year: int
    ) -> AccountingSheetData:
        from fastapi import HTTPException

        if month == 1:
            prev_month = 12
            prev_year = year - 1
        else:
            prev_month = month - 1
            prev_year = year

        # Verificar si hay registro o planilla en el mes anterior
        prev_record = tenant_session.query(AccountingRecord).filter(
            AccountingRecord.month == prev_month,
            AccountingRecord.year == prev_year
        ).first()
        prev_payroll = tenant_session.query(Payroll).filter(
            Payroll.month == prev_month,
            Payroll.year == prev_year
        ).first()

        if not prev_record and (not prev_payroll or not prev_payroll.payslips):
            prev_month_name = MONTH_NAMES[prev_month - 1]
            raise HTTPException(
                status_code=404,
                detail=f"No se encontraron datos registrados ni planillas en el mes anterior ({prev_month_name} {prev_year}) para reflejar."
            )

        # Obtener el sheet del mes anterior
        prev_sheet = AccountingService.get_or_calculate_sheet(
            tenant_session=tenant_session,
            public_session=public_session,
            schema_name=schema_name,
            month=prev_month,
            year=prev_year,
            force_recalculate=False
        )

        tenant = public_session.query(Tenant).filter(Tenant.schema_name == schema_name).first()
        tenant_name = tenant.name if tenant else "EMPRESA"
        default_caja = (tenant.caja_salud if (tenant and tenant.caja_salud) else 
                        ("Caja Petrolera de Salud" if "petrolera" in (tenant.numero_patronal or "").lower() else "Caja Nacional de Salud"))

        today = datetime.now().date()
        last_day = calendar.monthrange(year, month)[1]
        end_of_month = date(year, month, last_day)
        is_locked_by_date = today > end_of_month
        today_str = today.strftime("%Y-%m-%d")

        # Verificar si el mes actual tiene planilla
        current_payroll = tenant_session.query(Payroll).filter(
            Payroll.month == month,
            Payroll.year == year
        ).first()

        caja_banco_name = prev_sheet.caja_banco_name or "Caja Moneda Nacional"
        caja_salud_choice = (
            (prev_sheet.caja_payment.caja_tipo if prev_sheet.caja_payment else None) or
            (prev_sheet.devengamiento.caja_salud_choice if prev_sheet.devengamiento else None) or
            default_caja
        )

        if current_payroll and current_payroll.payslips:
            # Si el mes actual tiene planilla generada, usar sus valores reales de haberes y sueldos
            base_sheet = AccountingService._calculate_from_payroll(
                tenant_session, current_payroll, month, year, tenant_name, caja_salud_choice, is_locked_by_date, today_str
            )
            devengamiento = base_sheet.devengamiento
            devengamiento.caja_salud_choice = caja_salud_choice
            if prev_sheet.devengamiento:
                if prev_sheet.devengamiento.arancel_min_trabajo is not None:
                    devengamiento.arancel_min_trabajo = prev_sheet.devengamiento.arancel_min_trabajo
                if getattr(prev_sheet.devengamiento, 'tramites_min_trabajo', None):
                    devengamiento.tramites_min_trabajo = [
                        TramiteMinTrabajoItem(**(t.model_dump() if hasattr(t, 'model_dump') else t))
                        for t in prev_sheet.devengamiento.tramites_min_trabajo
                    ]
            payroll_id = current_payroll.id
        else:
            # Si el mes actual no tiene planilla todavía, reflejar la estructura y montos del mes anterior
            payroll_id = None
            if prev_sheet.devengamiento:
                devengamiento = DevengamientoData(**prev_sheet.devengamiento.model_dump())
                devengamiento.caja_salud_choice = caja_salud_choice
            else:
                devengamiento = DevengamientoData(
                    caja_salud_choice=caja_salud_choice,
                    arancel_min_trabajo=27.00
                )

        # Adaptar fechas al mes objetivo (o día del mes objetivo equivalente)
        def _adapt_date(old_date: Optional[str]) -> str:
            default_fallback = f"{year:04d}-{month:02d}-{min(21, last_day):02d}"
            if not old_date:
                return default_fallback
            try:
                parts = old_date.split("-")
                if len(parts) == 3:
                    d_int = int(parts[2])
                    d_clamped = min(d_int, last_day)
                    return f"{year:04d}-{month:02d}-{d_clamped:02d}"
            except Exception:
                pass
            return default_fallback

        # Reflejar pago Gestora
        prev_gest = prev_sheet.gestora_payment or GestoraPaymentData()
        gestora_payment = GestoraPaymentData(
            fecha=_adapt_date(prev_gest.fecha),
            nro_transaccion=prev_gest.nro_transaccion or "",
            intereses=[PaymentExtraItem(**it.model_dump()) for it in (prev_gest.intereses or [])]
        )

        # Reflejar pago Caja de Salud
        prev_caj = prev_sheet.caja_payment or CajaPaymentData()
        caja_payment = CajaPaymentData(
            caja_tipo=caja_salud_choice,
            fecha=_adapt_date(prev_caj.fecha),
            nro_transaccion=prev_caj.nro_transaccion or "",
            ajustes=[PaymentExtraItem(**it.model_dump()) for it in (prev_caj.ajustes or [])]
        )

        # Reflejar pago Ministerio de Trabajo
        prev_mt = prev_sheet.min_trabajo_payment or MinTrabajoPaymentData()
        min_trabajo_payment = MinTrabajoPaymentData(
            fecha=_adapt_date(prev_mt.fecha),
            nro_transaccion=prev_mt.nro_transaccion or "",
            ajustes=[PaymentExtraItem(**it.model_dump()) for it in (prev_mt.ajustes or [])]
        )

        # Construir y balancear el asiento completo para el mes actual
        reflected_sheet = AccountingService.build_full_sheet(
            month=month,
            year=year,
            tenant_name=tenant_name,
            caja_banco_name=caja_banco_name,
            devengamiento=devengamiento,
            gestora_payment=gestora_payment,
            caja_payment=caja_payment,
            min_trabajo_payment=min_trabajo_payment,
            payroll_id=payroll_id,
            is_locked_by_date=is_locked_by_date,
            is_manually_unlocked=False,
            is_customized=True
        )

        return reflected_sheet

    @staticmethod
    def get_annual_history(
        tenant_session: Session,
        public_session: Session,
        schema_name: str,
        year: int
    ) -> AnnualHistoryResponse:
        from app.models.tenant import Tenant
        tenant = public_session.query(Tenant).filter(Tenant.schema_name == schema_name).first()
        tenant_name = tenant.name if tenant else "EMPRESA"

        months_list = []
        tot_anual_debe = 0.0
        tot_anual_haber = 0.0
        meses_registrados = 0

        # Mapear registros guardados en la BD para este año
        saved_records = {
            r.month: r
            for r in tenant_session.query(AccountingRecord).filter(AccountingRecord.year == year).all()
        }

        # Mapear planillas de sueldos existentes para este año
        payrolls = {
            p.month: p
            for p in tenant_session.query(Payroll).filter(Payroll.year == year).all()
        }

        for m in range(1, 13):
            m_name = MONTH_NAMES[m - 1]
            # Si hay registro guardado o planilla, cargar la información del asiento
            if m in saved_records or m in payrolls:
                sheet = AccountingService.get_or_calculate_sheet(
                    tenant_session=tenant_session,
                    public_session=public_session,
                    schema_name=schema_name,
                    month=m,
                    year=year,
                    force_recalculate=False
                )
                
                sec_g = next((s for s in sheet.sections if s.id == "seccion_5_pago_gestora"), None)
                sec_c = next((s for s in sheet.sections if s.id == "seccion_6_pago_caja"), None)
                sec_m = next((s for s in sheet.sections if s.id == "seccion_7_pago_min_trabajo"), None)

                pago_g = PaymentInfoSummary(
                    fecha=sheet.gestora_payment.fecha or "",
                    nro_transaccion=sheet.gestora_payment.nro_transaccion or "",
                    monto_total=sec_g.subtotal_debe if sec_g else 0.0,
                    glosa=sec_g.glosa if sec_g else None,
                    tipo_entidad="Gestora Pública"
                )
                pago_c = PaymentInfoSummary(
                    fecha=sheet.caja_payment.fecha or "",
                    nro_transaccion=sheet.caja_payment.nro_transaccion or "",
                    monto_total=sec_c.subtotal_debe if sec_c else 0.0,
                    glosa=sec_c.glosa if sec_c else None,
                    tipo_entidad=sheet.caja_payment.caja_tipo or "Caja de Salud"
                )
                pago_mt = PaymentInfoSummary(
                    fecha=sheet.min_trabajo_payment.fecha or "",
                    nro_transaccion=sheet.min_trabajo_payment.nro_transaccion or "",
                    monto_total=sec_m.subtotal_debe if sec_m else 0.0,
                    glosa=sec_m.glosa if sec_m else None,
                    tipo_entidad="Ministerio de Trabajo"
                )

                dev = sheet.devengamiento
                tot_ganado = sum((d.sueldos + d.bono_antiguedad) for d in (dev.departamentos if dev else [])) if dev and dev.departamentos else 0.0
                pat_tot = (dev.patronal_gestora or 0.0) + (dev.patronal_caja or 0.0) if dev else 0.0
                ben_tot = (dev.aguinaldo or 0.0) + (dev.indemnizacion or 0.0) if dev else 0.0
                liq = dev.sueldos_por_pagar if dev else 0.0
                ret = dev.retenciones_ley if dev else 0.0
                depts_cnt = len(dev.departamentos) if dev and dev.departamentos else 0

                rec = saved_records.get(m)
                upd_at = rec.updated_at.strftime("%Y-%m-%d %H:%M") if rec and rec.updated_at else (rec.created_at.strftime("%Y-%m-%d %H:%M") if rec and rec.created_at else None)

                months_list.append(AccountingMonthHistoryItem(
                    month=m,
                    year=year,
                    month_name=m_name,
                    has_data=True,
                    is_customized=sheet.is_customized,
                    is_cuadrado=sheet.is_cuadrado,
                    diferencia=sheet.diferencia,
                    total_debe=sheet.total_debe,
                    total_haber=sheet.total_haber,
                    total_ganado=round(tot_ganado, 2),
                    patronal_total=round(pat_tot, 2),
                    beneficios_total=round(ben_tot, 2),
                    liquido_pagable=round(liq, 2),
                    retenciones_ley=round(ret, 2),
                    departamentos_count=depts_cnt,
                    pago_gestora=pago_g,
                    pago_caja=pago_c,
                    pago_min_trabajo=pago_mt,
                    updated_at=upd_at
                ))
                tot_anual_debe += sheet.total_debe
                tot_anual_haber += sheet.total_haber
                meses_registrados += 1
            else:
                months_list.append(AccountingMonthHistoryItem(
                    month=m,
                    year=year,
                    month_name=m_name,
                    has_data=False,
                    is_customized=False,
                    is_cuadrado=True,
                    diferencia=0.0,
                    total_debe=0.0,
                    total_haber=0.0,
                    total_ganado=0.0,
                    patronal_total=0.0,
                    beneficios_total=0.0,
                    liquido_pagable=0.0,
                    retenciones_ley=0.0,
                    departamentos_count=0,
                    pago_gestora=None,
                    pago_caja=None,
                    pago_min_trabajo=None,
                    updated_at=None
                ))

        return AnnualHistoryResponse(
            year=year,
            tenant_name=tenant_name,
            months=months_list,
            total_anual_debe=round(tot_anual_debe, 2),
            total_anual_haber=round(tot_anual_haber, 2),
            meses_registrados=meses_registrados
        )
