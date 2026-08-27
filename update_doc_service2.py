import os

filepath = r"backend\app\services\document_service.py"
with open(filepath, "r", encoding="utf-8") as f:
    content = f.read()

# Replace the entire generate_payslip method
import re
new_payslip = '''
    @staticmethod
    def generate_payslip(boleta_data: dict, output_format: str = "xlsx") -> str:
        \"\"\"
        Genera la Boleta de Pago en Excel (usando plantilla) y opcionalmente la convierte a PDF.
        \"\"\"
        template_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "templates", "excel", "plantilla_boletas_de_pago.xlsx"))
        if not os.path.exists(template_path):
            raise FileNotFoundError(f"Plantilla no encontrada en {template_path}")
            
        unique_id = uuid.uuid4().hex[:8]
        output_xlsx = f"boleta_{unique_id}.xlsx"
        output_pdf = f"boleta_{unique_id}.pdf"
        
        wb = openpyxl.load_workbook(template_path)
        ws = wb.active
        
        # B2: Codigo entre comillas
        internal_code = str(boleta_data.get('internal_code', ''))
        # Asegurar que no tenga ceros a la izquierda si no es necesario, pero como ya viene del sistema lo usamos tal cual
        DocumentService._set_cell_value(ws, 'B2', f'"{internal_code}"')
        
        DocumentService._set_cell_value(ws, 'D3', boleta_data.get('empresa_nombre', '')) # Denominacion
        DocumentService._set_cell_value(ws, 'D4', boleta_data.get('empresa_nombre', '')) # Nombre Empleador
        DocumentService._set_cell_value(ws, 'D5', boleta_data.get('nit', ''))
        DocumentService._set_cell_value(ws, 'D6', boleta_data.get('numero_patronal', ''))
        
        mes_int = int(boleta_data.get('mes', 0))
        MESES = {1:"ENERO", 2:"FEBRERO", 3:"MARZO", 4:"ABRIL", 5:"MAYO", 6:"JUNIO", 7:"JULIO", 8:"AGOSTO", 9:"SEPTIEMBRE", 10:"OCTUBRE", 11:"NOVIEMBRE", 12:"DICIEMBRE"}
        DocumentService._set_cell_value(ws, 'D7', f"{MESES.get(mes_int, str(mes_int))} / {boleta_data.get('anio', '')}")
        
        DocumentService._set_cell_value(ws, 'D8', boleta_data.get('ci', ''))
        DocumentService._set_cell_value(ws, 'D9', boleta_data.get('nombres', ''))
        DocumentService._set_cell_value(ws, 'D10', boleta_data.get('apellido_paterno', ''))
        DocumentService._set_cell_value(ws, 'D11', boleta_data.get('apellido_materno', ''))
        DocumentService._set_cell_value(ws, 'D12', boleta_data.get('fecha_ingreso', ''))
        DocumentService._set_cell_value(ws, 'D13', boleta_data.get('fecha_nacimiento', ''))
        DocumentService._set_cell_value(ws, 'D14', boleta_data.get('cargo', ''))
        
        # Valores numericos
        DocumentService._set_cell_value(ws, 'D15', boleta_data.get('haber_basico', 0))
        DocumentService._set_cell_value(ws, 'D16', boleta_data.get('bono_antiguedad', 0))
        DocumentService._set_cell_value(ws, 'D17', 0) # Incremento
        DocumentService._set_cell_value(ws, 'D18', boleta_data.get('haber_basico', 0) + boleta_data.get('bono_antiguedad', 0)) # Subtotal
        DocumentService._set_cell_value(ws, 'D19', boleta_data.get('subsidio_natalidad', 0))
        DocumentService._set_cell_value(ws, 'D20', boleta_data.get('aporte_gestora', 0))
        DocumentService._set_cell_value(ws, 'D21', 0) # Haber basico 2?
        DocumentService._set_cell_value(ws, 'D22', 0) # Otros incentivos
        DocumentService._set_cell_value(ws, 'D23', boleta_data.get('haber_basico', 0)) # Por dias trabajados
        DocumentService._set_cell_value(ws, 'D25', boleta_data.get('anticipos', 0)) # Anticipos
        DocumentService._set_cell_value(ws, 'D26', 0) # Desc Corporativas
        DocumentService._set_cell_value(ws, 'D27', boleta_data.get('otros_descuentos', 0)) # Descuentos por Mermas
        DocumentService._set_cell_value(ws, 'E28', boleta_data.get('total_ganado', 0)) # Total Ganado
        
        tmp_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "tmp"))
        os.makedirs(tmp_dir, exist_ok=True)
        out_xlsx_path = os.path.join(tmp_dir, output_xlsx)
        
        wb.save(out_xlsx_path)
        
        if output_format == "pdf":
            out_pdf_path = os.path.join(tmp_dir, output_pdf)
            DocumentService._convert_excel_to_pdf(out_xlsx_path, out_pdf_path)
            return out_pdf_path
            
        return out_xlsx_path
'''

content = re.sub(r"    @staticmethod\n    def generate_payslip\(.*?return out_xlsx_path", new_payslip, content, flags=re.DOTALL)

# Replace the generate_payroll_excel method
new_payroll = '''
    @staticmethod
    def generate_payroll_excel(payroll_data: list, output_format: str = "xlsx") -> str:
        template_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "templates", "excel", "plantilla_de_sueldos_y_salarios.xlsx"))
        if not os.path.exists(template_path):
            raise FileNotFoundError(f"Plantilla no encontrada en {template_path}")
            
        unique_id = uuid.uuid4().hex[:8]
        output_xlsx = f"planilla_{unique_id}.xlsx"
        output_pdf = f"planilla_{unique_id}.pdf"
        
        wb = openpyxl.load_workbook(template_path)
        ws = wb.active
        
        if payroll_data:
            empresa = payroll_data[0].get('empresa_nombre', '')
            nit = payroll_data[0].get('nit', '')
            patronal = payroll_data[0].get('numero_patronal', '')
            mes_int = int(payroll_data[0].get('mes', 0))
            MESES = {1:"ENERO", 2:"FEBRERO", 3:"MARZO", 4:"ABRIL", 5:"MAYO", 6:"JUNIO", 7:"JULIO", 8:"AGOSTO", 9:"SEPTIEMBRE", 10:"OCTUBRE", 11:"NOVIEMBRE", 12:"DICIEMBRE"}
            anio = payroll_data[0].get('anio', '')
            
            DocumentService._set_cell_value(ws, 'C2', empresa)
            DocumentService._set_cell_value(ws, 'O2', nit) # Cerca de N DE NIT
            DocumentService._set_cell_value(ws, 'V2', 1)   # Pagina 1
            DocumentService._set_cell_value(ws, 'X2', 1)   # de 1
            DocumentService._set_cell_value(ws, 'C3', '')  # N Identificador del Empleado
            DocumentService._set_cell_value(ws, 'O3', patronal)
            DocumentService._set_cell_value(ws, 'W6', f"{MESES.get(mes_int, str(mes_int))} DE {anio}")
        
        start_row = 11
        if len(payroll_data) > 1:
            ws.insert_rows(start_row + 1, amount=len(payroll_data) - 1)
            
        for i, slip in enumerate(payroll_data):
            row = start_row + i
            # Format: paterno materno nombres
            ap_pat = slip.get('apellido_paterno', '') or ''
            ap_mat = slip.get('apellido_materno', '') or ''
            nombres = slip.get('nombres', '') or ''
            full_name = f"{ap_pat} {ap_mat} {nombres}".strip()
            
            DocumentService._set_cell_value(ws, f'A{row}', i + 1)
            DocumentService._set_cell_value(ws, f'B{row}', slip.get('ci', ''))
            DocumentService._set_cell_value(ws, f'C{row}', full_name)
            DocumentService._set_cell_value(ws, f'D{row}', 'Boliviana')
            DocumentService._set_cell_value(ws, f'E{row}', slip.get('fecha_nacimiento', ''))
            DocumentService._set_cell_value(ws, f'F{row}', slip.get('sexo', 'M'))
            DocumentService._set_cell_value(ws, f'G{row}', slip.get('cargo', ''))
            DocumentService._set_cell_value(ws, f'H{row}', slip.get('fecha_ingreso', ''))
            DocumentService._set_cell_value(ws, f'I{row}', 240)
            DocumentService._set_cell_value(ws, f'J{row}', 30)
            
            DocumentService._set_cell_value(ws, f'K{row}', slip.get('haber_basico', 0))
            DocumentService._set_cell_value(ws, f'L{row}', slip.get('bono_antiguedad', 0))
            DocumentService._set_cell_value(ws, f'M{row}', slip.get('bono_produccion', 0))
            DocumentService._set_cell_value(ws, f'N{row}', slip.get('subsidio_frontera', 0))
            DocumentService._set_cell_value(ws, f'O{row}', slip.get('trabajo_extraordinario', 0))
            DocumentService._set_cell_value(ws, f'P{row}', slip.get('pago_dominical', 0))
            DocumentService._set_cell_value(ws, f'Q{row}', slip.get('otros_bonos', 0))
            DocumentService._set_cell_value(ws, f'R{row}', slip.get('total_ganado', 0))
            DocumentService._set_cell_value(ws, f'S{row}', slip.get('aporte_gestora', 0))
            DocumentService._set_cell_value(ws, f'T{row}', slip.get('rc_iva', 0))
            DocumentService._set_cell_value(ws, f'U{row}', slip.get('otros_descuentos', 0))
            DocumentService._set_cell_value(ws, f'V{row}', slip.get('total_descuentos', 0))
            DocumentService._set_cell_value(ws, f'W{row}', slip.get('liquido_pagable', 0))
            
        # Totales
        totales_row = start_row + len(payroll_data)
        DocumentService._set_cell_value(ws, f'A{totales_row}', "TOTALES")
        columns_to_sum = ['K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W']
        for col in columns_to_sum:
            formula = f"=SUM({col}{start_row}:{col}{totales_row-1})"
            DocumentService._set_cell_value(ws, f'{col}{totales_row}', formula)

        tmp_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "tmp"))
        os.makedirs(tmp_dir, exist_ok=True)
        out_xlsx_path = os.path.join(tmp_dir, output_xlsx)
        
        wb.save(out_xlsx_path)
        
        if output_format == "pdf":
            out_pdf_path = os.path.join(tmp_dir, output_pdf)
            DocumentService._convert_excel_to_pdf(out_xlsx_path, out_pdf_path)
            return out_pdf_path
            
        return out_xlsx_path
'''

content = re.sub(r"    @staticmethod\n    def generate_payroll_excel\(.*?return out_xlsx_path", new_payroll, content, flags=re.DOTALL)

with open(filepath, "w", encoding="utf-8") as f:
    f.write(content)
print("Updated successfully")