import os
import shutil
import uuid
import openpyxl
from openpyxl.utils import get_column_letter
from datetime import datetime
import re

class DocumentService:

    @staticmethod
    def _set_cell_value(ws, coord, value):
        for merged_range in ws.merged_cells.ranges:
            if coord in merged_range:
                ws.cell(row=merged_range.min_row, column=merged_range.min_col).value = value
                return
        ws[coord] = value

    @staticmethod
    def _numero_a_letras(numero: int) -> str:
        unidades = ["", "UN", "DOS", "TRES", "CUATRO", "CINCO", "SEIS", "SIETE", "OCHO", "NUEVE", "DIEZ", "ONCE", "DOCE", "TRECE", "CATORCE", "QUINCE", "DIECISEIS", "DIECISIETE", "DIECIOCHO", "DIECINUEVE", "VEINTE", "VEINTIUN", "VEINTIDOS", "VEINTITRES", "VEINTICUATRO", "VEINTICINCO", "VEINTISEIS", "VEINTISIETE", "VEINTIOCHO", "VEINTINUEVE"]
        decenas = ["", "DIEZ", "VEINTE", "TREINTA", "CUARENTA", "CINCUENTA", "SESENTA", "SETENTA", "OCHENTA", "NOVENTA"]
        centenas = ["", "CIENTO", "DOSCIENTOS", "TRESCIENTOS", "CUATROCIENTOS", "QUINIENTOS", "SEISCIENTOS", "SETECIENTOS", "OCHOCIENTOS", "NOVECIENTOS"]
        
        if numero == 0: return "CERO"
        if numero <= 29: return unidades[numero]
        if numero <= 99:
            return decenas[numero // 10] if numero % 10 == 0 else decenas[numero // 10] + " Y " + unidades[numero % 10]
        if numero == 100: return "CIEN"
        if numero <= 999:
            return centenas[numero // 100] if numero % 100 == 0 else centenas[numero // 100] + " " + DocumentService._numero_a_letras(numero % 100)
        if numero == 1000: return "MIL"
        if numero <= 999999:
            miles = numero // 1000
            resto = numero % 1000
            str_miles = "MIL" if miles == 1 else DocumentService._numero_a_letras(miles) + " MIL"
            return str_miles if resto == 0 else str_miles + " " + DocumentService._numero_a_letras(resto)
        if numero == 1000000: return "UN MILLON"
        if numero <= 999999999:
            millones = numero // 1000000
            resto = numero % 1000000
            str_millones = "UN MILLON" if millones == 1 else DocumentService._numero_a_letras(millones) + " MILLONES"
            return str_millones if resto == 0 else str_millones + " " + DocumentService._numero_a_letras(resto)
        
        return str(numero)

    @staticmethod
    def _convert_excel_to_pdf(excel_path: str, pdf_path: str):
        """
        Convierte un archivo Excel a PDF. En Windows usa win32com, en Linux usa LibreOffice.
        """
        if os.name == 'nt':
            import win32com.client
            import pythoncom
            pythoncom.CoInitialize()
            excel = win32com.client.Dispatch("Excel.Application")
            excel.Visible = False
            excel.DisplayAlerts = False
            try:
                wb = excel.Workbooks.Open(os.path.abspath(excel_path))
                wb.ExportAsFixedFormat(0, os.path.abspath(pdf_path))
                wb.Close(False)
            finally:
                excel.Quit()
                pythoncom.CoUninitialize()
        else:
            import subprocess
            # LibreOffice headless mode
            outdir = os.path.dirname(os.path.abspath(pdf_path))
            subprocess.run([
                'libreoffice', '--headless', '--convert-to', 'pdf',
                '--outdir', outdir, os.path.abspath(excel_path)
            ], check=True)
            
            # LibreOffice generates the file with the same base name but .pdf extension
            base_name = os.path.splitext(os.path.basename(excel_path))[0]
            generated_pdf = os.path.join(outdir, f"{base_name}.pdf")
            
            # Rename it to the target pdf_path if it differs
            if generated_pdf != os.path.abspath(pdf_path):
                if os.path.exists(pdf_path):
                    os.remove(pdf_path)
                os.rename(generated_pdf, pdf_path)

    @staticmethod
    def generate_payslip(boleta_data: dict, output_format: str = "xlsx") -> str:
        """
        Genera la Boleta de Pago en Excel (usando plantilla) y opcionalmente la convierte a PDF.
        """
        template_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "templates", "excel", "plantilla_boletas_de_pago.xlsx"))
        if not os.path.exists(template_path):
            raise FileNotFoundError(f"Plantilla no encontrada en {template_path}")
            
        # Generar nombre temporal en la carpeta exports/boletas
        unique_id = uuid.uuid4().hex[:8]
        exports_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "exports", "boletas"))
        os.makedirs(exports_dir, exist_ok=True)
        
        output_xlsx = os.path.join(exports_dir, f"boleta_{unique_id}.xlsx")
        output_pdf = os.path.join(exports_dir, f"boleta_{unique_id}.pdf")
        
        # Cargar excel
        wb = openpyxl.load_workbook(template_path)
        ws = wb.active
        
        internal_code = boleta_data.get('internal_code', '')
        if isinstance(internal_code, str):
            internal_code = internal_code.replace('"', '').replace("'", "")

        # B2: Empresa Name
        DocumentService._set_cell_value(ws, 'B2', boleta_data.get('empresa_nombre', '').upper())
        DocumentService._set_cell_value(ws, 'D2', "Nº:")
        DocumentService._set_cell_value(ws, 'E2', internal_code)
        
        DocumentService._set_cell_value(ws, 'B3', f"Nro. Patronal: {boleta_data.get('numero_patronal', '')}")
        
        mes_int = int(boleta_data.get('mes', 0))
        MESES = {1:"Enero", 2:"Febrero", 3:"Marzo", 4:"Abril", 5:"Mayo", 6:"Junio", 7:"Julio", 8:"Agosto", 9:"Septiembre", 10:"Octubre", 11:"Noviembre", 12:"Diciembre"}
        mes_nombre = MESES.get(mes_int, str(mes_int))
        anio = boleta_data.get('anio', '')
        DocumentService._set_cell_value(ws, 'B7', f"MES {mes_nombre}")
        DocumentService._set_cell_value(ws, 'C7', f"AÑO {anio}")
        
        # Fecha fin de mes (asumiendo 30 o 31)
        fecha_fin = f"30/{mes_int:02d}/{anio}" if mes_int in [4,6,9,11] else f"31/{mes_int:02d}/{anio}"
        if mes_int == 2: fecha_fin = f"28/02/{anio}"
        DocumentService._set_cell_value(ws, 'D7', f"FECHA {fecha_fin}")
        
        DocumentService._set_cell_value(ws, 'B9', f"CODIGO :      {internal_code}")
        
        emp_nombres = boleta_data.get('nombres') or ''
        emp_pat = boleta_data.get('apellido_paterno') or ''
        emp_mat = boleta_data.get('apellido_materno') or ''
        full_emp_name = f"{emp_pat} {emp_mat} {emp_nombres}".strip().replace("  ", " ").upper()
        DocumentService._set_cell_value(ws, 'C9', f"NOMBRE : {full_emp_name}")
        
        DocumentService._set_cell_value(ws, 'B10', f"CARGO : {boleta_data.get('cargo', '').upper()}")
        DocumentService._set_cell_value(ws, 'B11', f"FECHA INGRESO : {boleta_data.get('fecha_ingreso', '')}")
        DocumentService._set_cell_value(ws, 'D11', "SALDO I.V.A. :     0.00")
        
        # Ingresos y Descuentos
        hb = float(boleta_data.get('haber_basico', 0) or 0)
        ba = float(boleta_data.get('bono_antiguedad', 0) or 0)
        sub_nat = float(boleta_data.get('subsidio_natalidad', 0) or 0)
        otros_ing = float(boleta_data.get('otros_ingresos', 0) or 0)
        total_ganado = float(boleta_data.get('total_ganado', 0) or 0)
        
        gestora = float(boleta_data.get('aporte_gestora', 0) or 0)
        rc_iva = float(boleta_data.get('rc_iva', 0) or 0)
        anticipos = float(boleta_data.get('anticipos', 0) or 0)
        otros_des = float(boleta_data.get('otros_descuentos', 0) or 0)
        total_descuentos = float(boleta_data.get('total_descuentos', gestora + rc_iva + anticipos + otros_des) or 0)
        liquido = float(boleta_data.get('liquido_pagable', total_ganado - total_descuentos) or 0)

        # Ingresos left side
        DocumentService._set_cell_value(ws, 'B13', "Sueldo Básico")
        DocumentService._set_cell_value(ws, 'C13', hb)
        DocumentService._set_cell_value(ws, 'B14', "Bono de Antigüedad")
        DocumentService._set_cell_value(ws, 'C14', ba)
        DocumentService._set_cell_value(ws, 'B15', "Subsidio de Natalidad")
        DocumentService._set_cell_value(ws, 'C15', sub_nat)
        DocumentService._set_cell_value(ws, 'B16', "Otros Ingresos")
        DocumentService._set_cell_value(ws, 'C16', otros_ing)
        
        # Descuentos right side
        DocumentService._set_cell_value(ws, 'D13', "Aporte Gestora")
        DocumentService._set_cell_value(ws, 'E13', gestora)
        DocumentService._set_cell_value(ws, 'D14', "R.C. - I.V.A.")
        DocumentService._set_cell_value(ws, 'E14', rc_iva)
        DocumentService._set_cell_value(ws, 'D15', "Anticipos")
        DocumentService._set_cell_value(ws, 'E15', anticipos)
        DocumentService._set_cell_value(ws, 'D16', "Otros Descuentos")
        DocumentService._set_cell_value(ws, 'E16', otros_des)

        # Totals
        DocumentService._set_cell_value(ws, 'C18', total_ganado)
        DocumentService._set_cell_value(ws, 'E18', total_descuentos)
        
        # Liquido Pagable
        # Descombinamos B21:C21 si están combinados para evitar sobreescribir el texto
        try:
            ws.unmerge_cells('B21:C21')
        except:
            pass
            
        ws['B21'] = "LIQUIDO PAGABLE:"
        ws['B21'].font = openpyxl.styles.Font(name="Times New Roman", size=11, bold=True)
        ws['C21'] = liquido
        ws['C21'].font = openpyxl.styles.Font(name="Times New Roman", size=13, bold=True)
        ws['C21'].number_format = '#,##0.00'
        ws['C21'].alignment = openpyxl.styles.Alignment(horizontal='right')
        
        entero = int(liquido)
        decimal = int(round((liquido - entero) * 100))
        literal_entero = DocumentService._numero_a_letras(entero)
        
        try:
            ws.merge_cells('D21:E21')
        except:
            pass
        ws['D21'] = f"(Son: {literal_entero} con {decimal}/100 Bolivianos)"
        ws['D21'].font = openpyxl.styles.Font(name="Times New Roman", size=9, italic=True)
        ws['D21'].alignment = openpyxl.styles.Alignment(shrink_to_fit=True, vertical='center', horizontal='left')
        
        # Signatures
        DocumentService._set_cell_value(ws, 'B25', "...........................................................")
        DocumentService._set_cell_value(ws, 'B26', "Verificado Contabilidad/Gerencia")
        
        DocumentService._set_cell_value(ws, 'D25', "...........................................................")
        DocumentService._set_cell_value(ws, 'D26', full_emp_name)
        
        wb.save(output_xlsx)
        wb.close()
        
        if output_format == "pdf":
            DocumentService._convert_excel_to_pdf(output_xlsx, output_pdf)
            os.remove(output_xlsx)
            return output_pdf
            
        return output_xlsx

    @staticmethod
    def generate_payroll_excel(payroll_data: list[dict], output_format: str = "xlsx") -> str:
        """
        Genera un archivo Excel con la Planilla de Sueldos y opcionalmente a PDF.
        """
        template_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "templates", "excel", "plantilla_de_sueldos_y_salarios.xlsx"))
        if not os.path.exists(template_path):
            raise FileNotFoundError(f"Plantilla no encontrada en {template_path}")
            
        unique_id = uuid.uuid4().hex[:8]
        exports_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "exports", "planillas"))
        os.makedirs(exports_dir, exist_ok=True)
        
        output_xlsx = os.path.join(exports_dir, f"planilla_{unique_id}.xlsx")
        output_pdf = os.path.join(exports_dir, f"planilla_{unique_id}.pdf")
        
        wb = openpyxl.load_workbook(template_path)
        ws = wb.active
        
        # Ordenar datos por código de menor a mayor (1, 2, 3... N)
        def _sort_code_key(item):
            code_val = item.get('internal_code', '')
            if not code_val:
                return (1, 0, '')
            code_str = str(code_val).strip()
            digits = re.findall(r'\d+', code_str)
            if digits:
                return (0, int(digits[0]), code_str)
            return (0, 999999, code_str)

        payroll_data = sorted(payroll_data, key=_sort_code_key)

        if payroll_data:
            empresa = payroll_data[0].get('empresa_nombre', '')
            nit = payroll_data[0].get('nit', '')
            patronal = payroll_data[0].get('numero_patronal', '')
            mes_int = int(payroll_data[0].get('mes', 0))
            MESES = {1:"ENERO", 2:"FEBRERO", 3:"MARZO", 4:"ABRIL", 5:"MAYO", 6:"JUNIO", 7:"JULIO", 8:"AGOSTO", 9:"SEPTIEMBRE", 10:"OCTUBRE", 11:"NOVIEMBRE", 12:"DICIEMBRE"}
            anio = payroll_data[0].get('anio', '')
            
            DocumentService._set_cell_value(ws, 'D2', str(empresa).upper())
            try:
                ws['D2'].font = openpyxl.styles.Font(name="Arial", size=10, bold=True)
                ws['D2'].alignment = openpyxl.styles.Alignment(horizontal='left', vertical='center')
            except: pass

            DocumentService._set_cell_value(ws, 'G3', str(nit))
            try:
                ws['G3'].font = openpyxl.styles.Font(name="Arial", size=10, bold=True)
                ws['G3'].alignment = openpyxl.styles.Alignment(horizontal='center', vertical='center')
            except: pass

            DocumentService._set_cell_value(ws, 'P2', str(nit))
            try:
                ws['P2'].font = openpyxl.styles.Font(name="Arial", size=10, bold=True)
                ws['P2'].alignment = openpyxl.styles.Alignment(horizontal='center', vertical='center')
            except: pass

            DocumentService._set_cell_value(ws, 'P3', str(patronal))
            try:
                ws['P3'].font = openpyxl.styles.Font(name="Arial", size=10, bold=True)
                ws['P3'].alignment = openpyxl.styles.Alignment(horizontal='center', vertical='center')
            except: pass
            
            # Recuperar texto original si existe o poner default
            base_text = "CORRESPONDIENTE AL MES DE"
            DocumentService._set_cell_value(ws, 'U6', f" {base_text} {MESES.get(mes_int, str(mes_int))} DE {anio}")
            try:
                ws['U6'].font = openpyxl.styles.Font(name="Arial", size=10, bold=True)
                ws['U6'].alignment = openpyxl.styles.Alignment(horizontal='center', vertical='center')
            except: pass
            
            # Paginacion
            DocumentService._set_cell_value(ws, 'V2', 1)
            DocumentService._set_cell_value(ws, 'X2', 1)

        # 1. Limpiar rangos combinados residuales en filas >= 11 para evitar corrupción de openpyxl
        for m in list(ws.merged_cells.ranges):
            if m.min_row >= 11:
                ws.merged_cells.remove(m)

        # 2. Eliminar filas previas del template a partir de la fila 11
        ws.delete_rows(11, amount=30)

        thin_border = openpyxl.styles.Side(border_style='thin', color='000000')
        border_all = openpyxl.styles.Border(top=thin_border, bottom=thin_border, left=thin_border, right=thin_border)
        font_data = openpyxl.styles.Font(name='Arial', size=9)
        font_bold = openpyxl.styles.Font(name='Arial', size=10, bold=True)

        start_row = 11
        num_employees = len(payroll_data)

        for i, emp in enumerate(payroll_data):
            row = start_row + i
            ws.row_dimensions[row].height = 22

            doc_id = str(emp.get('documento_identidad', '') or '')
            ap_pat = str(emp.get('apellido_paterno', '') or '')
            ap_mat = str(emp.get('apellido_materno', '') or '')
            nombres = str(emp.get('nombres', '') or '')
            full_name = f"{ap_pat} {ap_mat} {nombres}".strip().replace("  ", " ").upper()
            nacionalidad = str(emp.get('nacionalidad', 'Boliviana') or 'Boliviana')
            fecha_nac = str(emp.get('fecha_nacimiento', '') or '')
            sexo = str(emp.get('sexo', '') or '')
            ocupacion = str(emp.get('ocupacion', '') or '')
            fecha_ing = str(emp.get('fecha_ingreso', '') or '')
            horas = emp.get('horas_pagadas', 240)
            dias = emp.get('dias_pagados', 30)

            hb = float(emp.get('haber_basico', 0) or 0)
            ba = float(emp.get('bono_antiguedad', 0) or 0)
            bp = float(emp.get('bono_produccion', 0) or 0)
            sf = float(emp.get('subsidio_frontera', 0) or 0)
            te = float(emp.get('trabajo_extraordinario', 0) or 0)
            pd = float(emp.get('pago_dominical', 0) or 0)
            ob = float(emp.get('otros_bonos', 0) or 0)
            tg = float(emp.get('total_ganado', 0) or 0)
            ag = float(emp.get('aporte_gestora', 0) or 0)
            rc = float(emp.get('rc_iva', 0) or 0)
            otros_desc = float(emp.get('otros_descuentos', 0) or 0) + float(emp.get('anticipos', 0) or 0)
            td = float(emp.get('total_descuentos', 0) or 0)
            lp = float(emp.get('liquido_pagable', 0) or 0)

            row_values = {
                1: (i + 1, 'center', None),
                2: (doc_id, 'center', None),
                3: (full_name, 'left', None),
                4: (nacionalidad, 'center', None),
                5: (fecha_nac, 'center', None),
                6: (sexo, 'center', None),
                7: (ocupacion, 'left', None),
                8: (fecha_ing, 'center', None),
                9: (horas, 'right', None),
                10: (dias, 'right', None),
                11: (hb, 'right', '#,##0.00'),
                12: (ba, 'right', '#,##0.00'),
                13: (bp, 'right', '#,##0.00'),
                14: (sf, 'right', '#,##0.00'),
                15: (te, 'right', '#,##0.00'),
                16: (pd, 'right', '#,##0.00'),
                17: (ob, 'right', '#,##0.00'),
                18: (tg, 'right', '#,##0.00'),
                19: (ag, 'right', '#,##0.00'),
                20: (rc, 'right', '#,##0.00'),
                21: (otros_desc, 'right', '#,##0.00'),
                22: (td, 'right', '#,##0.00'),
                23: (lp, 'right', '#,##0.00'),
                24: ('', 'center', None)
            }

            for col_idx in range(1, 25):
                c = ws.cell(row=row, column=col_idx)
                val, align_h, num_fmt = row_values.get(col_idx, ('', 'center', None))
                c.value = val
                c.font = font_data
                c.border = border_all
                c.alignment = openpyxl.styles.Alignment(horizontal=align_h, vertical='center')
                if num_fmt:
                    c.number_format = num_fmt

        # Fila TOTALES (Combinada de A hasta J)
        tot_row = start_row + max(num_employees, 1)
        ws.row_dimensions[tot_row].height = 24
        ws.merge_cells(start_row=tot_row, start_column=1, end_row=tot_row, end_column=10)
        c_tot = ws.cell(row=tot_row, column=1)
        c_tot.value = 'TOTALES'
        c_tot.font = font_bold
        c_tot.alignment = openpyxl.styles.Alignment(horizontal='center', vertical='center')

        for col_idx in range(1, 11):
            ws.cell(row=tot_row, column=col_idx).border = openpyxl.styles.Border(
                top=thin_border, bottom=thin_border,
                left=thin_border if col_idx == 1 else None,
                right=thin_border if col_idx == 10 else None
            )

        for col_idx in range(11, 24):
            col_letter = get_column_letter(col_idx)
            c = ws.cell(row=tot_row, column=col_idx)
            c.value = f'=SUM({col_letter}11:{col_letter}{tot_row-1})' if num_employees > 0 else 0.00
            c.font = font_bold
            c.number_format = '#,##0.00'
            c.alignment = openpyxl.styles.Alignment(horizontal='right', vertical='center')
            c.border = border_all

        ws.cell(row=tot_row, column=24).border = border_all

        # Espaciadores antes de las firmas
        ws.row_dimensions[tot_row + 1].height = 12
        ws.row_dimensions[tot_row + 2].height = 12

        # Líneas de puntos de firma (D a I, L a O, R a U)
        sig_line = tot_row + 3
        ws.row_dimensions[sig_line].height = 28
        dot1 = '…............................................................................................................................................................'
        dot2 = '…..........................................................................................................'
        dot3 = '….................................................................................................'

        ws.merge_cells(start_row=sig_line, start_column=4, end_row=sig_line, end_column=9)
        c = ws.cell(row=sig_line, column=4, value=dot1)
        c.font = openpyxl.styles.Font(name='Arial', size=10)
        c.alignment = openpyxl.styles.Alignment(horizontal='center', vertical='bottom')

        ws.merge_cells(start_row=sig_line, start_column=12, end_row=sig_line, end_column=15)
        c = ws.cell(row=sig_line, column=12, value=dot2)
        c.font = openpyxl.styles.Font(name='Arial', size=10)
        c.alignment = openpyxl.styles.Alignment(horizontal='center', vertical='bottom')

        ws.merge_cells(start_row=sig_line, start_column=18, end_row=sig_line, end_column=21)
        c = ws.cell(row=sig_line, column=18, value=dot3)
        c.font = openpyxl.styles.Font(name='Arial', size=10)
        c.alignment = openpyxl.styles.Alignment(horizontal='center', vertical='bottom')

        # Etiquetas de firma
        sig_lbl = tot_row + 4
        ws.row_dimensions[sig_lbl].height = 24

        ws.merge_cells(start_row=sig_lbl, start_column=4, end_row=sig_lbl, end_column=9)
        c = ws.cell(row=sig_lbl, column=4, value='NOMBRE DEL EMPLEADOR O REPRESENTANTE LEGAL')
        c.font = font_bold
        c.alignment = openpyxl.styles.Alignment(horizontal='center', vertical='center')

        ws.merge_cells(start_row=sig_lbl, start_column=12, end_row=sig_lbl, end_column=15)
        c = ws.cell(row=sig_lbl, column=12, value='N° DE DOCUMENTO DE IDENTIDAD')
        c.font = font_bold
        c.alignment = openpyxl.styles.Alignment(horizontal='center', vertical='center')

        ws.merge_cells(start_row=sig_lbl, start_column=18, end_row=sig_lbl, end_column=21)
        c = ws.cell(row=sig_lbl, column=18, value='FIRMA')
        c.font = font_bold
        c.alignment = openpyxl.styles.Alignment(horizontal='center', vertical='center')

        # Datos impresos de empleador (Nombre y C.I.) bajo las etiquetas
        if payroll_data:
            emp_nombres = payroll_data[0].get('empleador_nombres') or ''
            emp_pat = payroll_data[0].get('empleador_apellido_paterno') or ''
            emp_mat = payroll_data[0].get('empleador_apellido_materno') or ''
            emp_ci = payroll_data[0].get('empleador_ci') or ''
            full_emp_name = f"{emp_pat} {emp_mat} {emp_nombres}".strip().replace("  ", " ").upper()

            sig_name = tot_row + 5
            ws.row_dimensions[sig_name].height = 20

            if full_emp_name:
                ws.merge_cells(start_row=sig_name, start_column=4, end_row=sig_name, end_column=9)
                c = ws.cell(row=sig_name, column=4, value=full_emp_name)
                c.font = font_bold
                c.alignment = openpyxl.styles.Alignment(horizontal='center', vertical='center')

            if emp_ci:
                ws.merge_cells(start_row=sig_name, start_column=12, end_row=sig_name, end_column=15)
                c = ws.cell(row=sig_name, column=12, value=f"CI: {emp_ci}")
                c.font = font_bold
                c.alignment = openpyxl.styles.Alignment(horizontal='center', vertical='center')

        # Anchos de columna optimizados para evitar truncamiento numérico (######)
        col_widths = {
            'A': 6.5,   # N°
            'B': 16.0,  # Documento de identidad
            'C': 26.0,  # Apellidos y Nombres
            'D': 12.0,  # Pais
            'E': 13.0,  # Fecha nacimiento
            'F': 8.0,   # Sexo
            'G': 18.0,  # Cargo
            'H': 13.0,  # Fecha ingreso
            'I': 9.0,   # Horas
            'J': 9.0,   # Dias
            'K': 14.0,  # Haber basico
            'L': 13.5,  # Bono antiguedad
            'M': 13.5,  # Bono produccion
            'N': 13.5,  # Subsidio frontera
            'O': 13.5,  # Horas extras
            'P': 13.5,  # Pago dominical
            'Q': 13.5,  # Otros bonos
            'R': 15.0,  # TOTAL GANADO
            'S': 13.5,  # Gestora
            'T': 10.0,  # RC-IVA
            'U': 13.5,  # Otros descuentos
            'V': 15.0,  # TOTAL DESCUENTOS
            'W': 15.0,  # LIQUIDO PAGABLE
            'X': 18.0   # Firma
        }
        for col_let, w in col_widths.items():
            ws.column_dimensions[col_let].width = w

        # Configuración de página para ajustar a 1 página horizontal
        ws.sheet_properties.pageSetUpPr.fitToPage = True
        ws.page_setup.fitToWidth = 1
        ws.page_setup.fitToHeight = 0
        ws.page_setup.orientation = ws.ORIENTATION_LANDSCAPE
        ws.page_setup.paperSize = ws.PAPERSIZE_LETTER
        ws.page_margins = openpyxl.worksheet.page.PageMargins(
            left=0.2, right=0.2, top=0.3, bottom=0.3, header=0.1, footer=0.1
        )

        wb.save(output_xlsx)
        wb.close()
        
        if output_format == "pdf":
            DocumentService._convert_excel_to_pdf(output_xlsx, output_pdf)
            os.remove(output_xlsx)
            return output_pdf
            
        return output_xlsx

    @staticmethod
    def generate_prefiniquito_excel(data: dict, output_format: str = "xlsx") -> str:
        """
        Genera un archivo Excel con la preliquidación basado en la plantilla y opcionalmente lo exporta a PDF.
        """
        template_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "templates", "excel", "plantilla_prefiniquitos.xlsx"))
        if not os.path.exists(template_path):
            raise FileNotFoundError(f"Plantilla no encontrada en {template_path}")
            
        unique_id = uuid.uuid4().hex[:8]
        exports_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "exports", "prefiniquitos"))
        os.makedirs(exports_dir, exist_ok=True)
        
        output_xlsx = os.path.join(exports_dir, f"prefiniquito_{unique_id}.xlsx")
        output_pdf = os.path.join(exports_dir, f"prefiniquito_{unique_id}.pdf")
        
        wb = openpyxl.load_workbook(template_path)
        ws = wb.active
        
        format_bs = lambda x: f"{float(x):,.2f} Bs".replace(",", "X").replace(".", ",").replace("X", ".") if x is not None else "0,00 Bs"
        
        # Helper para rellenar
        def set_val(cell, val):
            if val is not None:
                ws[cell] = val
                try: ws[cell].alignment = openpyxl.styles.Alignment(horizontal='right')
                except: pass
                
        # Llenar datos principales
        ws['B7'] = f"NOMBRE DEL TRABAJADOR:     {data.get('nombre_trabajador', '').upper()}"
        ws['B8'] = f"RAZÓN SOCIAL DEL EMPLEADOR:  {data.get('razon_social', '').upper()}"
        ws['B9'] = f"FECHA DE INGRESO:          {data.get('fecha_ingreso', '')}"
        ws['B10'] = f"FECHA DE RETIRO:           {data.get('fecha_retiro', '')}"
        
        anios = data.get('anios_trabajados', 0)
        meses = data.get('meses_trabajados', 0)
        dias = data.get('dias_trabajados', 0)
        ws['B11'] = f"TIEMPO DE TRABAJO:         Años: {anios}       Meses: {meses}      Días: {dias}"
        
        ws['B12'] = f"BONO DE ANTIGUEDAD:        0,00 Bs"
        
        # Sueldo promedio formateado
        sp = data.get('sueldo_promedio', 0)
        sp_str = f"{float(sp):,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
        ws['B13'] = f"SUELDO PROMEDIO (Bs.):     {sp_str}"
        
        # Desahucio
        set_val('F16', format_bs(data.get('desahucio', 0)))
        
        # Indemnizacion
        if anios > 0:
            ws['D18'] = f"{anios} Años"
            set_val('F18', format_bs(data.get('indemnizacion_anios', 0)))
            ws.row_dimensions[18].hidden = False
        else:
            ws['D18'] = ""
            set_val('F18', "")
            ws.row_dimensions[18].hidden = True
            
        if meses > 0:
            ws['D19'] = f"{meses} Meses"
            set_val('F19', format_bs(data.get('indemnizacion_meses', 0)))
            ws.row_dimensions[19].hidden = False
        else:
            ws['D19'] = ""
            set_val('F19', "")
            ws.row_dimensions[19].hidden = True
            
        if dias > 0:
            ws['D20'] = f"{dias} Días"
            set_val('F20', format_bs(data.get('indemnizacion_dias', 0)))
            ws.row_dimensions[20].hidden = False
        else:
            ws['D20'] = ""
            set_val('F20', "")
            ws.row_dimensions[20].hidden = True
        
        # Aguinaldo (Calcular tiempo en meses y días si no vienen dados explícitamente, o simplemente usar los counts)
        ag_meses_count = data.get('aguinaldo_meses_count', 0)
        ag_dias_count = data.get('aguinaldo_dias_count', 0)
        
        if ag_meses_count > 0:
            ws['D22'] = f"{ag_meses_count} Meses"
            set_val('F22', format_bs(data.get('aguinaldo_meses', 0)))
            ws.row_dimensions[22].hidden = False
        else:
            ws['D22'] = ""
            set_val('F22', "")
            ws.row_dimensions[22].hidden = True
            
        if ag_dias_count > 0:
            ws['D23'] = f"{ag_dias_count} Días"
            set_val('F23', format_bs(data.get('aguinaldo_dias', 0)))
            ws.row_dimensions[23].hidden = False
        else:
            ws['D23'] = ""
            set_val('F23', "")
            ws.row_dimensions[23].hidden = True
        
        # Vacaciones
        vac_dias = data.get('dias_vacacion_pendientes', 0)
        ws['D25'] = f"{vac_dias} Días"
        set_val('F25', format_bs(data.get('vacaciones', 0)))
        
        # Otros
        ws['D27'] = "OTROS PAGOS"
        set_val('F27', format_bs(data.get('otros_pagos', 0)))
        set_val('F28', "0,00 Bs") # Línea extra en otros
        
        # Descuentos
        set_val('F30', format_bs(data.get('descuentos', 0)))
        
        # Totales
        set_val('F31', format_bs(data.get('total_calculo', 0)))
        set_val('F32', format_bs(data.get('multa_30', 0)))
        set_val('F33', format_bs(data.get('total_final', 0)))

        # Ensure print scaling is exact
        ws.sheet_properties.pageSetUpPr.fitToPage = True
        ws.page_setup.fitToWidth = 1
        ws.page_setup.fitToHeight = 1
        ws.page_setup.orientation = ws.ORIENTATION_PORTRAIT

        wb.save(output_xlsx)
        wb.close()
        
        if output_format == "pdf":
            DocumentService._convert_excel_to_pdf(output_xlsx, output_pdf)
            os.remove(output_xlsx)
            return output_pdf
            
        return output_xlsx

    @staticmethod
    def generate_settlement_word(template_path: str, context: dict, output_path: str):
        from docxtpl import DocxTemplate
        if not os.path.exists(template_path):
            raise FileNotFoundError(f"No se encontró la plantilla en {template_path}")
            
        doc = DocxTemplate(template_path)
        doc.render(context)
        doc.save(output_path)
        return output_path
