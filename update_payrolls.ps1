import os

with open('backend/app/api/endpoints/payrolls.py', 'r', encoding='utf-8') as f:
    content = f.read()

new_endpoints = '''
from fastapi.responses import FileResponse
from app.services.document_service import DocumentService
import os

@router.get("/{month}/{year}/export/excel")
def export_payroll_excel(schema_name: str, month: int, year: int, db: Session = Depends(get_tenant_db)):
    payroll = get_or_generate_payroll(schema_name, month, year, db)
    payroll_dict = payroll.model_dump()
    payslips_dicts = []
    
    # We need to map payslips to dicts matching the document service expectations
    for slip in payroll.payslips:
        payslips_dicts.append({
            'documento_identidad': slip.employee_ci,
            'apellido_paterno': slip.employee_name.split(' ')[0] if ' ' in slip.employee_name else slip.employee_name,
            'apellido_materno': slip.employee_name.split(' ')[1] if len(slip.employee_name.split(' ')) > 1 else '',
            'nombres': ' '.join(slip.employee_name.split(' ')[2:]) if len(slip.employee_name.split(' ')) > 2 else '',
            'nacionalidad': slip.employee_nacionalidad,
            'fecha_nacimiento': slip.employee_fecha_nacimiento,
            'sexo': slip.employee_sexo,
            'ocupacion': slip.employee_cargo,
            'fecha_ingreso': slip.employee_fecha_ingreso,
            'horas_pagadas': slip.horas_pagadas,
            'dias_pagados': slip.dias_pagados,
            'haber_basico': slip.haber_basico,
            'bono_antiguedad': slip.bono_antiguedad,
            'bono_produccion': slip.bono_produccion,
            'subsidio_frontera': slip.subsidio_frontera,
            'trabajo_extraordinario': slip.trabajo_extraordinario,
            'pago_dominical': slip.pago_dominical,
            'otros_bonos': slip.otros_bonos,
            'total_ganado': slip.total_ganado,
            'aporte_gestora': slip.aporte_gestora,
            'rc_iva': slip.rc_iva,
            'otros_descuentos': slip.otros_descuentos,
            'anticipos': slip.anticipos,
            'total_descuentos': slip.total_descuentos,
            'liquido_pagable': slip.liquido_pagable,
            'empresa_nombre': payroll_dict.get('tenant_name'),
            'nit': '',  # Need to get nit if possible
            'numero_patronal': payroll_dict.get('tenant_nro_patronal'),
            'mes': month,
            'anio': year
        })
    
    file_path = DocumentService.generate_payroll_excel(payslips_dicts, "xlsx")
    return FileResponse(path=file_path, filename=f"Planilla_Sueldos_{month}_{year}.xlsx", media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')

@router.get("/{month}/{year}/export/pdf")
def export_payroll_pdf(schema_name: str, month: int, year: int, db: Session = Depends(get_tenant_db)):
    payroll = get_or_generate_payroll(schema_name, month, year, db)
    payroll_dict = payroll.model_dump()
    payslips_dicts = []
    for slip in payroll.payslips:
        payslips_dicts.append({
            'documento_identidad': slip.employee_ci,
            'apellido_paterno': slip.employee_name.split(' ')[0] if ' ' in slip.employee_name else slip.employee_name,
            'apellido_materno': slip.employee_name.split(' ')[1] if len(slip.employee_name.split(' ')) > 1 else '',
            'nombres': ' '.join(slip.employee_name.split(' ')[2:]) if len(slip.employee_name.split(' ')) > 2 else '',
            'nacionalidad': slip.employee_nacionalidad,
            'fecha_nacimiento': slip.employee_fecha_nacimiento,
            'sexo': slip.employee_sexo,
            'ocupacion': slip.employee_cargo,
            'fecha_ingreso': slip.employee_fecha_ingreso,
            'horas_pagadas': slip.horas_pagadas,
            'dias_pagados': slip.dias_pagados,
            'haber_basico': slip.haber_basico,
            'bono_antiguedad': slip.bono_antiguedad,
            'bono_produccion': slip.bono_produccion,
            'subsidio_frontera': slip.subsidio_frontera,
            'trabajo_extraordinario': slip.trabajo_extraordinario,
            'pago_dominical': slip.pago_dominical,
            'otros_bonos': slip.otros_bonos,
            'total_ganado': slip.total_ganado,
            'aporte_gestora': slip.aporte_gestora,
            'rc_iva': slip.rc_iva,
            'otros_descuentos': slip.otros_descuentos,
            'anticipos': slip.anticipos,
            'total_descuentos': slip.total_descuentos,
            'liquido_pagable': slip.liquido_pagable,
            'empresa_nombre': payroll_dict.get('tenant_name'),
            'nit': '',
            'numero_patronal': payroll_dict.get('tenant_nro_patronal'),
            'mes': month,
            'anio': year
        })
    file_path = DocumentService.generate_payroll_excel(payslips_dicts, "pdf")
    return FileResponse(path=file_path, filename=f"Planilla_Sueldos_{month}_{year}.pdf", media_type='application/pdf')

@router.get("/{month}/{year}/payslips/{payslip_id}/export/{format}")
def export_payslip(schema_name: str, month: int, year: int, payslip_id: int, format: str, db: Session = Depends(get_tenant_db)):
    payroll = get_or_generate_payroll(schema_name, month, year, db)
    payroll_dict = payroll.model_dump()
    
    target_slip = next((s for s in payroll.payslips if s.id == payslip_id), None)
    if not target_slip:
        raise HTTPException(status_code=404, detail="Boleta no encontrada")
        
    boleta_data = {
        'internal_code': f"{target_slip.employee_id:04d}",
        'empresa_nombre': payroll_dict.get('tenant_name'),
        'nit': '',
        'numero_patronal': payroll_dict.get('tenant_nro_patronal'),
        'mes': month,
        'anio': year,
        'ci': target_slip.employee_ci,
        'nombres': ' '.join(target_slip.employee_name.split(' ')[2:]) if len(target_slip.employee_name.split(' ')) > 2 else '',
        'apellido_paterno': target_slip.employee_name.split(' ')[0] if ' ' in target_slip.employee_name else target_slip.employee_name,
        'apellido_materno': target_slip.employee_name.split(' ')[1] if len(target_slip.employee_name.split(' ')) > 1 else '',
        'fecha_ingreso': target_slip.employee_fecha_ingreso,
        'fecha_nacimiento': target_slip.employee_fecha_nacimiento,
        'cargo': target_slip.employee_cargo,
        'haber_basico': target_slip.haber_basico,
        'bono_antiguedad': target_slip.bono_antiguedad,
        'subsidio_natalidad': getattr(target_slip, "subsidio_natalidad", 0),
        'aporte_gestora': target_slip.aporte_gestora,
        'rc_iva': target_slip.rc_iva,
        'otros_ingresos': float(target_slip.bono_produccion) + float(target_slip.subsidio_frontera) + float(target_slip.trabajo_extraordinario) + float(target_slip.pago_dominical) + float(target_slip.otros_bonos),
        'anticipos': target_slip.anticipos,
        'otros_descuentos': target_slip.otros_descuentos,
        'total_ganado': target_slip.total_ganado,
        'total_descuentos': target_slip.total_descuentos,
        'liquido_pagable': target_slip.liquido_pagable
    }
    
    file_path = DocumentService.generate_payslip(boleta_data, format)
    
    media_type = 'application/pdf' if format == "pdf" else 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    filename = f"Boleta_Pago_{target_slip.employee_ci}.pdf" if format == "pdf" else f"Boleta_Pago_{target_slip.employee_ci}.xlsx"
    return FileResponse(path=file_path, filename=filename, media_type=media_type)

'''

with open('backend/app/api/endpoints/payrolls.py', 'w', encoding='utf-8') as f:
    f.write(content + new_endpoints)