from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from sqlalchemy import text
from decimal import Decimal
from datetime import date
import calendar
import re

from app.db.session import engine
from sqlalchemy.orm import sessionmaker
from app.models.aguinaldo import AguinaldoPayroll, AguinaldoSlip
from app.models.employee import Employee
from app.models.payroll import Payroll, Payslip
from app.models.prefiniquito import Prefiniquito
from app.models.global_params import SalarioMinimoNacional
from app.schemas.aguinaldo import (
    AguinaldoPayrollResponse,
    AguinaldoSlipResponse,
    AguinaldoSlipUpdate,
    AguinaldoTotals
)
from app.services.payroll_service import calculate_seniority_years, calcular_bono_antiguedad
from app.services.document_service import DocumentService

router = APIRouter()

def get_tenant_db(schema_name: str):
    engine_with_schema = engine.execution_options(schema_translate_map={"tenant": schema_name})
    SessionTenant = sessionmaker(autocommit=False, autoflush=False, bind=engine_with_schema)
    db = SessionTenant()
    try:
        yield db
    finally:
        db.close()

def sort_code_key(code_val, fallback_id=0):
    if not code_val:
        return (1, fallback_id, "")
    code_str = str(code_val).strip()
    digits = re.findall(r'\d+', code_str)
    if digits:
        return (0, int(digits[0]), code_str)
    return (0, 999999, code_str)

def get_smn(db: Session, year: int) -> Decimal:
    smn = db.query(SalarioMinimoNacional).filter(SalarioMinimoNacional.year == year).first()
    return Decimal(str(smn.amount)) if smn else Decimal("3300.00")

@router.get("/{year}", response_model=AguinaldoPayrollResponse)
@router.get("/{year}/", response_model=AguinaldoPayrollResponse, include_in_schema=False)
def get_or_generate_aguinaldo_payroll(schema_name: str, year: int, db: Session = Depends(get_tenant_db)):
    # 1. Info del Tenant
    with engine.connect() as conn:
        result = conn.execute(text(
            f"SELECT name, numero_patronal, nit, empleador_nombres, empleador_apellido_paterno, empleador_apellido_materno, empleador_ci FROM public.tenants WHERE schema_name = '{schema_name}'"
        )).fetchone()
        t_name = result[0] if result else "Empresa"
        t_patronal = result[1] if result and result[1] else "350-1-2177"
        t_nit = result[2] if result and result[2] else "6570013013"
        t_emp_nombres = result[3] if result and result[3] else ""
        t_emp_paterno = result[4] if result and result[4] else ""
        t_emp_materno = result[5] if result and result[5] else ""
        t_emp_ci = result[6] if result and result[6] else ""

    payroll = db.query(AguinaldoPayroll).filter(AguinaldoPayroll.year == year).first()
    if not payroll:
        payroll = AguinaldoPayroll(year=year, is_closed=False)
        db.add(payroll)
        db.commit()
        db.refresh(payroll)

    end_of_year = date(year, 12, 31)
    start_of_year = date(year, 1, 1)
    smn_actual = get_smn(db, year)

    # Si la planilla no está cerrada, sincronizar empleados
    if not payroll.is_closed:
        existing_emp_ids = {s.employee_id for s in payroll.slips}
        all_employees = db.query(Employee).all()

        for emp in all_employees:
            if emp.id in existing_emp_ids:
                continue

            # Debe haber ingresado a más tardar en el año
            if emp.fecha_ingreso > end_of_year:
                continue

            # Si ya está inactivo, verificar si su retiro ocurrió en el año
            if not emp.is_active:
                pref = db.query(Prefiniquito).filter(Prefiniquito.employee_id == emp.id).order_by(Prefiniquito.id.desc()).first()
                if pref and pref.fecha_retiro < start_of_year:
                    continue

            # Calcular meses trabajados en el año
            if emp.fecha_ingreso < start_of_year:
                meses = Decimal("12.00")
            else:
                m_ingreso = emp.fecha_ingreso.month
                d_ingreso = emp.fecha_ingreso.day
                # Si ingresó el primer día del mes cuenta mes completo, sino duodécimas proporcionales
                meses_completos = 12 - m_ingreso + (1 if d_ingreso <= 1 else 0)
                if d_ingreso > 1:
                    fraccion = Decimal(str(max(0, 30 - d_ingreso + 1))) / Decimal("30")
                    meses = Decimal(str(12 - m_ingreso)) + fraccion
                else:
                    meses = Decimal(str(meses_completos))
                meses = round(max(Decimal("0.5"), min(Decimal("12.0"), meses)), 2)

            # Buscar boletas previas del año (preferentemente sep, oct, nov, o las disponibles)
            monthly_slips = (
                db.query(Payslip)
                .join(Payroll, Payslip.payroll_id == Payroll.id)
                .filter(
                    Payslip.employee_id == emp.id,
                    Payroll.year == year
                )
                .all()
            )

            # Filtrar meses 9, 10, 11 si existen, o todos los existentes
            last_3 = [s for s in monthly_slips if s.payroll.month in [9, 10, 11]]
            target_slips = last_3 if len(last_3) >= 1 else monthly_slips

            if target_slips:
                count = len(target_slips)
                h_basico = round(sum(Decimal(str(s.haber_basico)) for s in target_slips) / count, 2)
                b_ant = round(sum(Decimal(str(s.bono_antiguedad)) for s in target_slips) / count, 2)
                b_prod = round(sum(Decimal(str(getattr(s, 'bono_produccion', 0) or 0)) for s in target_slips) / count, 2)
                sub_front = round(sum(Decimal(str(getattr(s, 'subsidio_frontera', 0) or 0)) for s in target_slips) / count, 2)
                trab_ext = round(sum(Decimal(str(getattr(s, 'trabajo_extraordinario', 0) or 0)) for s in target_slips) / count, 2)
                p_dom = round(sum(Decimal(str(getattr(s, 'pago_dominical', 0) or 0)) for s in target_slips) / count, 2)
                ot_bonos = round(sum(Decimal(str(getattr(s, 'otros_bonos', 0) or 0)) for s in target_slips) / count, 2)
            else:
                h_basico = Decimal(str(emp.haber_basico or 0.0))
                anios_ant = calculate_seniority_years(emp.fecha_ingreso, year, 12)
                b_ant = calcular_bono_antiguedad(anios_ant, smn_actual)
                b_prod = Decimal("0.00")
                sub_front = Decimal("0.00")
                trab_ext = Decimal("0.00")
                p_dom = Decimal("0.00")
                ot_bonos = Decimal("0.00")

            prom_total = h_basico + b_ant + b_prod + sub_front + trab_ext + p_dom + ot_bonos
            tot_ag = round(prom_total * (meses / Decimal("12")), 2)

            new_slip = AguinaldoSlip(
                aguinaldo_payroll_id=payroll.id,
                employee_id=emp.id,
                haber_basico=h_basico,
                bono_antiguedad=b_ant,
                bono_produccion=b_prod,
                subsidio_frontera=sub_front,
                trabajo_extraordinario=trab_ext,
                pago_dominical=p_dom,
                otros_bonos=ot_bonos,
                promedio_total_ganado=prom_total,
                meses_trabajados=meses,
                total_aguinaldo=tot_ag,
                is_customized=False
            )
            db.add(new_slip)

        db.commit()
        db.refresh(payroll)

    # Construir lista de respuesta
    resp_slips = []
    tot = AguinaldoTotals()

    for s in payroll.slips:
        emp = db.query(Employee).filter(Employee.id == s.employee_id).first()
        if not emp:
            continue

        emp_code = emp.internal_code or str(emp.id)
        emp_name = f"{emp.apellido_paterno} {emp.apellido_materno or ''} {emp.nombres}".strip().replace("  ", " ").upper()
        emp_ci = f"{emp.documento_identidad} {emp.ext_ci or ''}".strip()
        emp_cargo = emp.ocupacion or ""
        emp_nac = emp.nacionalidad or "BOLIVIANO"
        emp_fnac = str(emp.fecha_nacimiento) if emp.fecha_nacimiento else ""
        emp_sexo = getattr(emp, 'sexo', None) or getattr(emp, 'genero', None) or 'M'
        emp_fingreso = str(emp.fecha_ingreso) if emp.fecha_ingreso else ""

        # Literal en bolivianos
        monto_num = float(s.total_aguinaldo)
        entero = int(monto_num)
        centavos = int(round((monto_num - entero) * 100))
        monto_literal = f"{DocumentService._numero_a_letras(entero).title()} {centavos:02d}/100 Bolivianos"

        slip_resp = AguinaldoSlipResponse(
            id=s.id,
            aguinaldo_payroll_id=s.aguinaldo_payroll_id,
            employee_id=s.employee_id,
            employee_code=emp_code,
            employee_ci=emp_ci,
            employee_name=emp_name,
            employee_nacionalidad=emp_nac,
            employee_fecha_nacimiento=emp_fnac,
            employee_sexo=emp_sexo,
            employee_cargo=emp_cargo,
            employee_fecha_ingreso=emp_fingreso,
            haber_basico=s.haber_basico,
            bono_antiguedad=s.bono_antiguedad,
            bono_produccion=s.bono_produccion,
            subsidio_frontera=s.subsidio_frontera,
            trabajo_extraordinario=s.trabajo_extraordinario,
            pago_dominical=s.pago_dominical,
            otros_bonos=s.otros_bonos,
            promedio_total_ganado=s.promedio_total_ganado,
            meses_trabajados=s.meses_trabajados,
            total_aguinaldo=s.total_aguinaldo,
            total_aguinaldo_literal=monto_literal,
            is_customized=bool(s.is_customized)
        )
        resp_slips.append(slip_resp)

        # Sumar totales
        tot.haber_basico += Decimal(str(s.haber_basico))
        tot.bono_antiguedad += Decimal(str(s.bono_antiguedad))
        tot.bono_produccion += Decimal(str(s.bono_produccion))
        tot.subsidio_frontera += Decimal(str(s.subsidio_frontera))
        tot.trabajo_extraordinario += Decimal(str(s.trabajo_extraordinario))
        tot.pago_dominical += Decimal(str(s.pago_dominical))
        tot.otros_bonos += Decimal(str(s.otros_bonos))
        tot.promedio_total_ganado += Decimal(str(s.promedio_total_ganado))
        tot.meses_trabajados += Decimal(str(s.meses_trabajados))
        tot.total_aguinaldo += Decimal(str(s.total_aguinaldo))

    # Ordenar por código de menor a mayor
    resp_slips.sort(key=lambda x: sort_code_key(x.employee_code, x.employee_id))

    return AguinaldoPayrollResponse(
        id=payroll.id,
        year=payroll.year,
        is_closed=bool(payroll.is_closed),
        tenant_name=t_name,
        tenant_nro_patronal=t_patronal,
        tenant_nit=t_nit,
        tenant_empleador_nombres=t_emp_nombres,
        tenant_empleador_apellido_paterno=t_emp_paterno,
        tenant_empleador_apellido_materno=t_emp_materno,
        tenant_empleador_ci=t_emp_ci,
        slips=resp_slips,
        totals=tot
    )

@router.put("/{year}/slips/{slip_id}", response_model=AguinaldoSlipResponse)
@router.put("/{year}/slips/{slip_id}/", response_model=AguinaldoSlipResponse, include_in_schema=False)
def update_aguinaldo_slip(
    schema_name: str,
    year: int,
    slip_id: int,
    updates: AguinaldoSlipUpdate,
    db: Session = Depends(get_tenant_db)
):
    slip = db.query(AguinaldoSlip).filter(AguinaldoSlip.id == slip_id).first()
    if not slip:
        raise HTTPException(status_code=404, detail="Boleta de aguinaldo no encontrada")

    update_dict = updates.dict(exclude_unset=True)
    for k, v in update_dict.items():
        if v is not None:
            setattr(slip, k, Decimal(str(v)))

    # Recalcular promedio_total_ganado y total_aguinaldo
    slip.promedio_total_ganado = (
        slip.haber_basico +
        slip.bono_antiguedad +
        slip.bono_produccion +
        slip.subsidio_frontera +
        slip.trabajo_extraordinario +
        slip.pago_dominical +
        slip.otros_bonos
    )

    if 'total_aguinaldo' not in update_dict:
        slip.total_aguinaldo = round(slip.promedio_total_ganado * (slip.meses_trabajados / Decimal("12")), 2)

    slip.is_customized = True
    db.commit()
    db.refresh(slip)

    emp = db.query(Employee).filter(Employee.id == slip.employee_id).first()
    emp_code = emp.internal_code if emp else str(slip.employee_id)
    emp_name = f"{emp.apellido_paterno} {emp.apellido_materno or ''} {emp.nombres}".strip().replace("  ", " ").upper() if emp else "EMPLEADO"
    emp_ci = f"{emp.documento_identidad} {emp.ext_ci or ''}".strip() if emp else ""
    emp_cargo = emp.ocupacion if emp else ""

    monto_num = float(slip.total_aguinaldo)
    entero = int(monto_num)
    centavos = int(round((monto_num - entero) * 100))
    monto_literal = f"{DocumentService._numero_a_letras(entero).title()} {centavos:02d}/100 Bolivianos"

    return AguinaldoSlipResponse(
        id=slip.id,
        aguinaldo_payroll_id=slip.aguinaldo_payroll_id,
        employee_id=slip.employee_id,
        employee_code=emp_code,
        employee_ci=emp_ci,
        employee_name=emp_name,
        employee_nacionalidad=emp.nacionalidad if emp else "BOLIVIANO",
        employee_fecha_nacimiento=str(emp.fecha_nacimiento) if emp and emp.fecha_nacimiento else "",
        employee_sexo=getattr(emp, 'sexo', None) or getattr(emp, 'genero', None) or 'M' if emp else 'M',
        employee_cargo=emp_cargo,
        employee_fecha_ingreso=str(emp.fecha_ingreso) if emp and emp.fecha_ingreso else "",
        haber_basico=slip.haber_basico,
        bono_antiguedad=slip.bono_antiguedad,
        bono_produccion=slip.bono_produccion,
        subsidio_frontera=slip.subsidio_frontera,
        trabajo_extraordinario=slip.trabajo_extraordinario,
        pago_dominical=slip.pago_dominical,
        otros_bonos=slip.otros_bonos,
        promedio_total_ganado=slip.promedio_total_ganado,
        meses_trabajados=slip.meses_trabajados,
        total_aguinaldo=slip.total_aguinaldo,
        total_aguinaldo_literal=monto_literal,
        is_customized=True
    )

@router.get("/{year}/export/{format}")
@router.get("/{year}/export/{format}/", include_in_schema=False)
def export_aguinaldo_payroll(
    schema_name: str,
    year: int,
    format: str,
    db: Session = Depends(get_tenant_db)
):
    if format.lower() not in ["excel", "xlsx", "pdf"]:
        raise HTTPException(status_code=400, detail="Formato no soportado. Use 'excel' o 'pdf'.")

    payroll_data = get_or_generate_aguinaldo_payroll(schema_name, year, db)
    
    slips_list = []
    for s in payroll_data.slips:
        slips_list.append({
            'employee_ci': s.employee_ci,
            'employee_name': s.employee_name,
            'employee_nacionalidad': s.employee_nacionalidad,
            'employee_fecha_nacimiento': s.employee_fecha_nacimiento,
            'employee_sexo': s.employee_sexo,
            'employee_cargo': s.employee_cargo,
            'employee_fecha_ingreso': s.employee_fecha_ingreso,
            'haber_basico': float(s.haber_basico),
            'bono_antiguedad': float(s.bono_antiguedad),
            'bono_produccion': float(s.bono_produccion),
            'subsidio_frontera': float(s.subsidio_frontera),
            'trabajo_extraordinario': float(s.trabajo_extraordinario),
            'pago_dominical': float(s.pago_dominical),
            'otros_bonos': float(s.otros_bonos),
            'promedio_total_ganado': float(s.promedio_total_ganado),
            'meses_trabajados': float(s.meses_trabajados),
            'total_aguinaldo': float(s.total_aguinaldo)
        })

    rep_nombre = f"{payroll_data.tenant_empleador_nombres or ''} {payroll_data.tenant_empleador_apellido_paterno or ''} {payroll_data.tenant_empleador_apellido_materno or ''}".strip()
    if not rep_nombre:
        rep_nombre = payroll_data.tenant_name

    data_payload = {
        'empresa_nombre': payroll_data.tenant_name,
        'year': year,
        'nit': payroll_data.tenant_nit,
        'numero_patronal': payroll_data.tenant_nro_patronal,
        'representante_legal': rep_nombre,
        'ci_representante': payroll_data.tenant_empleador_ci or payroll_data.tenant_nit,
        'slips': slips_list
    }

    out_fmt = "pdf" if format.lower() == "pdf" else "xlsx"
    file_path = DocumentService.generate_aguinaldo_payroll_excel(data_payload, output_format=out_fmt, schema_name=schema_name)

    empresa_slug = DocumentService._slugify(schema_name if schema_name else payroll_data.tenant_name)
    media_type = 'application/pdf' if out_fmt == "pdf" else 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    filename = f"planilla_aguinaldos_{empresa_slug}_{year}.{out_fmt}"
    return FileResponse(path=file_path, filename=filename, media_type=media_type)

@router.get("/{year}/papeletas/{slip_id}/export/{format}")
@router.get("/{year}/papeletas/{slip_id}/export/{format}/", include_in_schema=False)
def export_single_aguinaldo_papeleta(
    schema_name: str,
    year: int,
    slip_id: int,
    format: str,
    db: Session = Depends(get_tenant_db)
):
    if format.lower() not in ["excel", "xlsx", "pdf"]:
        raise HTTPException(status_code=400, detail="Formato no soportado. Use 'excel' o 'pdf'.")

    payroll_data = get_or_generate_aguinaldo_payroll(schema_name, year, db)
    target_slip = next((s for s in payroll_data.slips if s.id == slip_id), None)
    if not target_slip:
        raise HTTPException(status_code=404, detail="Boleta de aguinaldo no encontrada")

    boleta_payload = {
        'empresa_nombre': payroll_data.tenant_name,
        'anio': year,
        'internal_code': target_slip.employee_code,
        'nombre_completo': target_slip.employee_name,
        'cargo': target_slip.employee_cargo,
        'meses_trabajados': float(target_slip.meses_trabajados),
        'fecha_ingreso': target_slip.employee_fecha_ingreso,
        'total_aguinaldo': float(target_slip.total_aguinaldo)
    }

    out_fmt = "pdf" if format.lower() == "pdf" else "xlsx"
    file_path = DocumentService.generate_aguinaldo_payslip(boleta_payload, output_format=out_fmt, schema_name=schema_name)

    emp_slug = DocumentService._slugify(target_slip.employee_name)
    empresa_slug = DocumentService._slugify(schema_name if schema_name else payroll_data.tenant_name)
    media_type = 'application/pdf' if out_fmt == "pdf" else 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    filename = f"papeleta_aguinaldo_{emp_slug}_{empresa_slug}_{year}.{out_fmt}"
    return FileResponse(path=file_path, filename=filename, media_type=media_type)

@router.get("/{year}/papeletas/export/{format}")
@router.get("/{year}/papeletas/export/{format}/", include_in_schema=False)
def export_batch_aguinaldo_papeletas(
    schema_name: str,
    year: int,
    format: str,
    db: Session = Depends(get_tenant_db)
):
    if format.lower() not in ["excel", "xlsx", "pdf"]:
        raise HTTPException(status_code=400, detail="Formato no soportado. Use 'excel' o 'pdf'.")

    payroll_data = get_or_generate_aguinaldo_payroll(schema_name, year, db)
    
    boletas_list = []
    for s in payroll_data.slips:
        boletas_list.append({
            'empresa_nombre': payroll_data.tenant_name,
            'anio': year,
            'internal_code': s.employee_code,
            'nombre_completo': s.employee_name,
            'cargo': s.employee_cargo,
            'meses_trabajados': float(s.meses_trabajados),
            'fecha_ingreso': s.employee_fecha_ingreso,
            'total_aguinaldo': float(s.total_aguinaldo)
        })

    out_fmt = "pdf" if format.lower() == "pdf" else "xlsx"
    file_path = DocumentService.generate_aguinaldo_payslips_batch(boletas_list, output_format=out_fmt, schema_name=schema_name)

    empresa_slug = DocumentService._slugify(schema_name if schema_name else payroll_data.tenant_name)
    media_type = 'application/pdf' if out_fmt == "pdf" else 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    filename = f"talonario_aguinaldos_{empresa_slug}_{year}.{out_fmt}"
    return FileResponse(path=file_path, filename=filename, media_type=media_type)
