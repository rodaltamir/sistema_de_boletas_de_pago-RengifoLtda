import os
import shutil
import uuid
import openpyxl
from openpyxl.utils import get_column_letter
from openpyxl.styles import Font, Alignment, Border, Side, PatternFill
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
    def format_date_dmy(val) -> str:
        """Convierte fechas a formato dia-mes-año (DD-MM-YYYY)"""
        if not val:
            return ""
        val_str = str(val).strip()
        m = re.match(r'^(\d{4})[-/](\d{1,2})[-/](\d{1,2})', val_str)
        if m:
            y, mo, d = m.groups()
            return f"{int(d):02d}-{int(mo):02d}-{y}"
        m2 = re.match(r'^(\d{1,2})[-/](\d{1,2})[-/](\d{4})', val_str)
        if m2:
            d, mo, y = m2.groups()
            return f"{int(d):02d}-{int(mo):02d}-{y}"
        return val_str

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
    def _convert_pdf_to_docx(pdf_path: str, docx_path: str):
        """
        Convierte un archivo PDF a DOCX utilizando LibreOffice Writer con writer_pdf_import.
        Esto mantiene exactamente la disposición visual, tablas y logos de la plantilla.
        """
        import subprocess
        outdir = os.path.dirname(os.path.abspath(docx_path))
        subprocess.run([
            'libreoffice', '--headless', '--infilter=writer_pdf_import',
            '--convert-to', 'docx',
            '--outdir', outdir, os.path.abspath(pdf_path)
        ], check=True)
        
        base_name = os.path.splitext(os.path.basename(pdf_path))[0]
        generated_docx = os.path.join(outdir, f"{base_name}.docx")
        
        if generated_docx != os.path.abspath(docx_path):
            if os.path.exists(docx_path):
                os.remove(docx_path)
            if os.path.exists(generated_docx):
                os.rename(generated_docx, docx_path)

    @staticmethod
    def generate_payslip(boleta_data: dict, output_format: str = "xlsx") -> str:
        """
        Genera la Boleta de Pago en Excel con dos boletas idénticas enmarcadas (recuadro grande)
        en una sola página Carta Vertical (Superior e Inferior) y opcionalmente la convierte a PDF.
        """
        unique_id = uuid.uuid4().hex[:8]
        exports_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "exports", "boletas"))
        os.makedirs(exports_dir, exist_ok=True)
        
        output_xlsx = os.path.join(exports_dir, f"boleta_{unique_id}.xlsx")
        output_pdf = os.path.join(exports_dir, f"boleta_{unique_id}.pdf")
        
        wb = openpyxl.Workbook()
        ws = wb.active
        ws.title = "Boleta"
        
        # Configuración de página: Portrait Letter, exactamente 1 página vertical, centrada
        ws.sheet_properties.pageSetUpPr.fitToPage = True
        ws.page_setup.fitToWidth = 1
        ws.page_setup.fitToHeight = 1
        ws.page_setup.orientation = ws.ORIENTATION_PORTRAIT
        ws.page_setup.paperSize = ws.PAPERSIZE_LETTER
        ws.print_options.horizontalCentered = True
        ws.page_margins = openpyxl.worksheet.page.PageMargins(
            left=0.35, right=0.35, top=0.35, bottom=0.35, header=0.1, footer=0.1
        )
        
        # Anchos de columna amplios para llenar armónicamente el ancho de la hoja
        ws.column_dimensions['A'].width = 1.5
        ws.column_dimensions['B'].width = 33.0
        ws.column_dimensions['C'].width = 18.0
        ws.column_dimensions['D'].width = 33.0
        ws.column_dimensions['E'].width = 18.0
        ws.column_dimensions['F'].width = 1.5
        
        # Estilos de borde y rellenos
        border_frame_thick = Side(border_style='medium', color='000000')
        border_thin = Side(border_style='thin', color='444444')
        border_all_thin = Border(top=border_thin, bottom=border_thin, left=border_thin, right=border_thin)

        fill_period = PatternFill(start_color="F2F4F8", end_color="F2F4F8", fill_type="solid")
        fill_subhdr = PatternFill(start_color="E4E8EE", end_color="E4E8EE", fill_type="solid")
        fill_total = PatternFill(start_color="EBEFF4", end_color="EBEFF4", fill_type="solid")
        fill_liquido = PatternFill(start_color="DEE5ED", end_color="DEE5ED", fill_type="solid")

        font_company = Font(name="Arial", size=11, bold=True)
        font_title = Font(name="Arial", size=13, bold=True, color="002060")
        font_bol_num = Font(name="Arial", size=11, bold=True, color="002060")
        font_bold = Font(name="Arial", size=9, bold=True)
        font_bold_lg = Font(name="Arial", size=10, bold=True)
        font_regular = Font(name="Arial", size=8.5)

        # Datos del empleado y empresa
        empresa = str(boleta_data.get('empresa_nombre', '') or '').upper()
        patronal = str(boleta_data.get('numero_patronal', '') or '')
        nit = str(boleta_data.get('nit', '') or '')
        internal_code = str(boleta_data.get('internal_code', '') or '').replace('"', '').replace("'", "")
        
        mes_int = int(boleta_data.get('mes', 0))
        MESES = {1:"ENERO", 2:"FEBRERO", 3:"MARZO", 4:"ABRIL", 5:"MAYO", 6:"JUNIO", 7:"JULIO", 8:"AGOSTO", 9:"SEPTIEMBRE", 10:"OCTUBRE", 11:"NOVIEMBRE", 12:"DICIEMBRE"}
        mes_nombre = MESES.get(mes_int, str(mes_int))
        anio = boleta_data.get('anio', '')
        
        # Fecha fin de mes en formato DD-MM-YYYY
        dias_mes = 28 if mes_int == 2 else (30 if mes_int in [4, 6, 9, 11] else 31)
        fecha_fin = f"{dias_mes:02d}-{mes_int:02d}-{anio}"

        emp_nombres = boleta_data.get('nombres') or ''
        emp_pat = boleta_data.get('apellido_paterno') or ''
        emp_mat = boleta_data.get('apellido_materno') or ''
        full_emp_name = f"{emp_pat} {emp_mat} {emp_nombres}".strip().replace("  ", " ").upper()
        if not full_emp_name:
            full_emp_name = str(boleta_data.get('employee_name', '') or '').upper()
            
        ci_raw = str(boleta_data.get('ci', '') or '').strip()
        ext_ci = str(boleta_data.get('ext_ci', '') or '').strip()
        if ext_ci and ext_ci.upper() not in ci_raw.upper():
            ci_ext = f"{ci_raw} - {ext_ci}"
        else:
            ci_ext = ci_raw

        cargo = str(boleta_data.get('cargo', '') or '').upper()
        fecha_ing_dmy = DocumentService.format_date_dmy(boleta_data.get('fecha_ingreso', '') or '')
        dias_pagados = boleta_data.get('dias_pagados', 30)

        # Montos
        hb = float(boleta_data.get('haber_basico', 0) or 0)
        ba = float(boleta_data.get('bono_antiguedad', 0) or 0)
        bp = float(boleta_data.get('bono_produccion', 0) or 0)
        sub_nat = float(boleta_data.get('subsidio_natalidad', 0) or 0)
        otros_ing = float(boleta_data.get('otros_bonos', 0) or 0) + float(boleta_data.get('trabajo_extraordinario', 0) or 0) + float(boleta_data.get('pago_dominical', 0) or 0) + float(boleta_data.get('subsidio_frontera', 0) or 0)
        if otros_ing == 0:
            otros_ing = float(boleta_data.get('otros_ingresos', 0) or 0) - bp - sub_nat
            if otros_ing < 0: otros_ing = 0.0

        total_ganado = float(boleta_data.get('total_ganado', 0) or 0)

        gestora = float(boleta_data.get('aporte_gestora', 0) or 0)
        rc_iva = float(boleta_data.get('rc_iva', 0) or 0)
        anticipos = float(boleta_data.get('anticipos', 0) or 0)
        otros_des = float(boleta_data.get('otros_descuentos', 0) or 0)
        total_descuentos = float(boleta_data.get('total_descuentos', 0) or 0)
        liquido = float(boleta_data.get('liquido_pagable', total_ganado - total_descuentos) or 0)

        entero = int(liquido)
        decimal = int(round((liquido - entero) * 100))
        literal = DocumentService._numero_a_letras(entero)

        items_detalle = [
            ("Sueldo Básico", hb, "Aporte Gestora (10.5%)", gestora),
            ("Bono de Antigüedad", ba, "R.C. - I.V.A.", rc_iva),
            ("Subsidio de Natalidad", sub_nat, "Anticipos", anticipos),
            ("Bono de Producción", bp, "Otros Descuentos", otros_des),
            ("Otros Ingresos / Bonos", otros_ing, "", None),
        ]

        def _render_boleta(start_r: int):
            end_r = start_r + 18  # 19 filas por boleta

            # 1. Fila 1: Empresa y N° de Boleta
            ws.row_dimensions[start_r].height = 19
            ws.merge_cells(start_row=start_r, start_column=2, end_row=start_r, end_column=4)
            c_emp = ws.cell(row=start_r, column=2, value=empresa)
            c_emp.font = font_company
            c_emp.alignment = Alignment(horizontal='left', vertical='center', indent=1)

            c_num = ws.cell(row=start_r, column=5, value=f"N°: {internal_code}")
            c_num.font = font_bol_num
            c_num.alignment = Alignment(horizontal='right', vertical='center')

            # 2. Fila 2: Patronal y NIT
            ws.row_dimensions[start_r+1].height = 17
            ws.merge_cells(start_row=start_r+1, start_column=2, end_row=start_r+1, end_column=5)
            c_pat = ws.cell(row=start_r+1, column=2, value=f"N° Patronal: {patronal}   |   NIT: {nit}")
            c_pat.font = font_regular
            c_pat.alignment = Alignment(horizontal='left', vertical='center', indent=1)

            # 3. Fila 3: Título Central PAPELETA DE PAGO
            ws.row_dimensions[start_r+2].height = 24
            ws.merge_cells(start_row=start_r+2, start_column=2, end_row=start_r+2, end_column=5)
            c_tit = ws.cell(row=start_r+2, column=2, value="PAPELETA DE PAGO")
            c_tit.font = font_title
            c_tit.alignment = Alignment(horizontal='center', vertical='center')

            # 4. Fila 4: Barra de Período y Fecha
            ws.row_dimensions[start_r+3].height = 19
            ws.cell(row=start_r+3, column=2, value=f"  MES: {mes_nombre}").font = font_bold
            ws.cell(row=start_r+3, column=2).alignment = Alignment(horizontal='left', vertical='center')
            ws.cell(row=start_r+3, column=3, value=f"AÑO: {anio}").font = font_bold
            ws.cell(row=start_r+3, column=3).alignment = Alignment(horizontal='left', vertical='center')

            ws.merge_cells(start_row=start_r+3, start_column=4, end_row=start_r+3, end_column=5)
            c_fec = ws.cell(row=start_r+3, column=4, value=f"FECHA: {fecha_fin}  ")
            c_fec.font = font_bold
            c_fec.alignment = Alignment(horizontal='right', vertical='center')

            for c in range(2, 6):
                ws.cell(row=start_r+3, column=c).fill = fill_period
                ws.cell(row=start_r+3, column=c).border = Border(top=border_thin, bottom=border_thin)

            # 5. Fila 5: Código y Nombre
            ws.row_dimensions[start_r+4].height = 18
            ws.cell(row=start_r+4, column=2, value=f"  CÓDIGO:  {internal_code}").font = font_bold
            ws.cell(row=start_r+4, column=2).alignment = Alignment(horizontal='left', vertical='center')
            
            ws.merge_cells(start_row=start_r+4, start_column=3, end_row=start_r+4, end_column=5)
            c_name = ws.cell(row=start_r+4, column=3, value=f"NOMBRE:  {full_emp_name}")
            c_name.font = font_bold_lg
            c_name.alignment = Alignment(horizontal='left', vertical='center')

            # 6. Fila 6: Cargo y C.I.
            ws.row_dimensions[start_r+5].height = 18
            ws.merge_cells(start_row=start_r+5, start_column=2, end_row=start_r+5, end_column=3)
            c_crg = ws.cell(row=start_r+5, column=2, value=f"  CARGO:  {cargo}")
            c_crg.font = font_regular
            c_crg.alignment = Alignment(horizontal='left', vertical='center')

            ws.merge_cells(start_row=start_r+5, start_column=4, end_row=start_r+5, end_column=5)
            c_ci = ws.cell(row=start_r+5, column=4, value=f"C.I.:  {ci_ext}")
            c_ci.font = font_regular
            c_ci.alignment = Alignment(horizontal='left', vertical='center')

            # 7. Fila 7: Fecha de Ingreso y Días Pagados / Saldo IVA
            ws.row_dimensions[start_r+6].height = 18
            ws.merge_cells(start_row=start_r+6, start_column=2, end_row=start_r+6, end_column=3)
            c_fi = ws.cell(row=start_r+6, column=2, value=f"  FECHA INGRESO:  {fecha_ing_dmy}")
            c_fi.font = font_regular
            c_fi.alignment = Alignment(horizontal='left', vertical='center')

            ws.merge_cells(start_row=start_r+6, start_column=4, end_row=start_r+6, end_column=5)
            c_dp = ws.cell(row=start_r+6, column=4, value=f"DÍAS PAGADOS: {dias_pagados}   |   SALDO I.V.A.: 0.00")
            c_dp.font = font_regular
            c_dp.alignment = Alignment(horizontal='left', vertical='center')

            for c in range(2, 6):
                ws.cell(row=start_r+6, column=c).border = Border(bottom=border_thin)

            # 8. Fila 8: Cabecera Tabla Ingresos / Descuentos
            ws.row_dimensions[start_r+7].height = 20
            ws.cell(row=start_r+7, column=2, value="INGRESOS").font = font_bold
            ws.cell(row=start_r+7, column=2).alignment = Alignment(horizontal='center', vertical='center')
            ws.cell(row=start_r+7, column=3, value="MONTO BS").font = font_bold
            ws.cell(row=start_r+7, column=3).alignment = Alignment(horizontal='center', vertical='center')

            ws.cell(row=start_r+7, column=4, value="DESCUENTOS").font = font_bold
            ws.cell(row=start_r+7, column=4).alignment = Alignment(horizontal='center', vertical='center')
            ws.cell(row=start_r+7, column=5, value="MONTO BS").font = font_bold
            ws.cell(row=start_r+7, column=5).alignment = Alignment(horizontal='center', vertical='center')

            for c in range(2, 6):
                ws.cell(row=start_r+7, column=c).fill = fill_subhdr
                ws.cell(row=start_r+7, column=c).border = border_all_thin

            # 9-13. Filas de Detalle
            for idx, (ing_nom, ing_val, desc_nom, desc_val) in enumerate(items_detalle):
                r = start_r + 8 + idx
                ws.row_dimensions[r].height = 17

                c_in = ws.cell(row=r, column=2, value=f"  {ing_nom}")
                c_in.font = font_regular
                c_in.alignment = Alignment(horizontal='left', vertical='center')

                c_v1 = ws.cell(row=r, column=3, value=ing_val)
                c_v1.font = font_regular
                c_v1.number_format = '#,##0.00'
                c_v1.alignment = Alignment(horizontal='right', vertical='center')

                c_dn = ws.cell(row=r, column=4, value=f"  {desc_nom}" if desc_nom else "")
                c_dn.font = font_regular
                c_dn.alignment = Alignment(horizontal='left', vertical='center')

                c_v2 = ws.cell(row=r, column=5, value=desc_val if desc_val is not None else "")
                c_v2.font = font_regular
                if desc_val is not None:
                    c_v2.number_format = '#,##0.00'
                c_v2.alignment = Alignment(horizontal='right', vertical='center')

                for c in range(2, 6):
                    ws.cell(row=r, column=c).border = border_all_thin

            # 14. Fila TOTALES
            r_tot = start_r + 13
            ws.row_dimensions[r_tot].height = 20
            ws.cell(row=r_tot, column=2, value="  TOTAL GANADO").font = font_bold
            ws.cell(row=r_tot, column=2).alignment = Alignment(horizontal='left', vertical='center')

            c_tg = ws.cell(row=r_tot, column=3, value=total_ganado)
            c_tg.font = font_bold_lg
            c_tg.number_format = '#,##0.00'
            c_tg.alignment = Alignment(horizontal='right', vertical='center')

            ws.cell(row=r_tot, column=4, value="  TOTAL DESCUENTOS").font = font_bold
            ws.cell(row=r_tot, column=4).alignment = Alignment(horizontal='left', vertical='center')

            c_td = ws.cell(row=r_tot, column=5, value=total_descuentos)
            c_td.font = font_bold_lg
            c_td.number_format = '#,##0.00'
            c_td.alignment = Alignment(horizontal='right', vertical='center')

            for c in range(2, 6):
                ws.cell(row=r_tot, column=c).fill = fill_total
                ws.cell(row=r_tot, column=c).border = border_all_thin

            # 15. Fila LÍQUIDO PAGABLE
            r_liq = start_r + 14
            ws.row_dimensions[r_liq].height = 26
            c_lpt = ws.cell(row=r_liq, column=2, value="  LÍQUIDO PAGABLE:")
            c_lpt.font = Font(name="Arial", size=10.5, bold=True)
            c_lpt.alignment = Alignment(horizontal='left', vertical='center')

            c_lp = ws.cell(row=r_liq, column=3, value=liquido)
            c_lp.font = Font(name="Arial", size=12, bold=True)
            c_lp.number_format = '#,##0.00'
            c_lp.alignment = Alignment(horizontal='right', vertical='center')

            ws.merge_cells(start_row=r_liq, start_column=4, end_row=r_liq, end_column=5)
            c_lit = ws.cell(row=r_liq, column=4, value=f"  (Son: {literal} con {decimal}/100 Bolivianos)")
            c_lit.font = Font(name="Arial", size=8.5, italic=True)
            c_lit.alignment = Alignment(horizontal='left', vertical='center', shrink_to_fit=True)

            for c in range(2, 6):
                ws.cell(row=r_liq, column=c).fill = fill_liquido
                ws.cell(row=r_liq, column=c).border = border_all_thin

            # 16. Espacio antes de firmas (dentro del recuadro)
            ws.row_dimensions[start_r + 15].height = 24

            # 17. Líneas de puntos de firmas (dentro del recuadro)
            r_sig1 = start_r + 16
            ws.row_dimensions[r_sig1].height = 18
            ws.merge_cells(start_row=r_sig1, start_column=2, end_row=r_sig1, end_column=3)
            c_s1 = ws.cell(row=r_sig1, column=2, value="........................................................................")
            c_s1.font = Font(name="Arial", size=9)
            c_s1.alignment = Alignment(horizontal='center', vertical='bottom')

            ws.merge_cells(start_row=r_sig1, start_column=4, end_row=r_sig1, end_column=5)
            c_s2 = ws.cell(row=r_sig1, column=4, value="........................................................................")
            c_s2.font = Font(name="Arial", size=9)
            c_s2.alignment = Alignment(horizontal='center', vertical='bottom')

            # 18. Nombres y Cargos de Firmas (dentro del recuadro)
            r_sig2 = start_r + 17
            ws.row_dimensions[r_sig2].height = 18
            ws.merge_cells(start_row=r_sig2, start_column=2, end_row=r_sig2, end_column=3)
            c_t1 = ws.cell(row=r_sig2, column=2, value="Vo. Bo. Contabilidad / Gerencia")
            c_t1.font = font_bold
            c_t1.alignment = Alignment(horizontal='center', vertical='center')

            ws.merge_cells(start_row=r_sig2, start_column=4, end_row=r_sig2, end_column=5)
            c_t2 = ws.cell(row=r_sig2, column=4, value=full_emp_name)
            c_t2.font = font_bold
            c_t2.alignment = Alignment(horizontal='center', vertical='center')

            # 19. Espaciador inferior dentro del recuadro
            ws.row_dimensions[end_r].height = 10

            # APLICAR EL GRAN RECUADRO EXTERIOR (BORDER MEDIUM) A TODO EL BLOQUE (filas start_r hasta end_r, columnas 2 a 5)
            for r in range(start_r, end_r + 1):
                for c in range(2, 6):
                    cell = ws.cell(row=r, column=c)
                    top_b = border_frame_thick if r == start_r else cell.border.top
                    bot_b = border_frame_thick if r == end_r else cell.border.bottom
                    left_b = border_frame_thick if c == 2 else cell.border.left
                    right_b = border_frame_thick if c == 5 else cell.border.right
                    cell.border = Border(top=top_b, bottom=bot_b, left=left_b, right=right_b)

        # 1. Renderizar Boleta Superior
        _render_boleta(start_r=1)

        # 2. Separador de Corte
        ws.row_dimensions[20].height = 10
        ws.row_dimensions[21].height = 16
        ws.merge_cells('B21:E21')
        c_cut = ws['B21']
        c_cut.value = "- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - ✂ CORTAR AQUÍ ✂ - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -"
        c_cut.font = Font(name="Arial", size=8.5, italic=True, color="666666")
        c_cut.alignment = Alignment(horizontal='center', vertical='center')
        ws.row_dimensions[22].height = 10

        # 3. Renderizar Boleta Inferior (Copia Idéntica)
        _render_boleta(start_r=23)

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
            DocumentService._set_cell_value(ws, 'U6', f"{base_text} {MESES.get(mes_int, str(mes_int))} DE {anio}")
            try:
                ws['U6'].font = openpyxl.styles.Font(name="Arial", size=9.5, bold=True)
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
        font_bold = openpyxl.styles.Font(name='Arial', size=9.5, bold=True)

        # Rellenos gris claro para destacar columnas clave
        fill_highlight = openpyxl.styles.PatternFill(start_color="EDEDED", end_color="EDEDED", fill_type="solid")
        fill_totales = openpyxl.styles.PatternFill(start_color="DFDFDF", end_color="DFDFDF", fill_type="solid")

        start_row = 11
        num_employees = len(payroll_data)

        for i, emp in enumerate(payroll_data):
            row = start_row + i
            ws.row_dimensions[row].height = 29

            doc_id = str(emp.get('documento_identidad', '') or '')
            ap_pat = str(emp.get('apellido_paterno', '') or '')
            ap_mat = str(emp.get('apellido_materno', '') or '')
            nombres = str(emp.get('nombres', '') or '')
            full_name = f"{ap_pat} {ap_mat} {nombres}".strip().replace("  ", " ").upper()
            nacionalidad = str(emp.get('nacionalidad', 'Boliviana') or 'Boliviana')
            fecha_nac = DocumentService.format_date_dmy(emp.get('fecha_nacimiento', '') or '')
            sexo = str(emp.get('sexo', '') or '')
            ocupacion = str(emp.get('ocupacion', '') or '')
            fecha_ing = DocumentService.format_date_dmy(emp.get('fecha_ingreso', '') or '')
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
                c.alignment = openpyxl.styles.Alignment(horizontal=align_h, vertical='center', wrap_text=True)
                if num_fmt:
                    c.number_format = num_fmt
                if col_idx in (18, 22, 23):
                    c.fill = fill_highlight

        # Fila TOTALES (Combinada de A hasta J)
        tot_row = start_row + max(num_employees, 1)
        ws.row_dimensions[tot_row].height = 26
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
            if col_idx in (18, 22, 23):
                c.fill = fill_totales

        ws.cell(row=tot_row, column=24).border = border_all

        # Espaciadores antes de las firmas
        ws.row_dimensions[tot_row + 1].height = 16
        ws.row_dimensions[tot_row + 2].height = 16

        # Líneas de puntos de firma (D a I, L a O, R a U)
        sig_line = tot_row + 3
        ws.row_dimensions[sig_line].height = 26
        dot1 = '…..................................................................................................................................'
        dot2 = '…................................................................................................'
        dot3 = '…................................................................................................'

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

        # Reemplazar directamente los títulos por los datos del empleador (Nombre y CI con extensión) y FIRMA
        sig_lbl = tot_row + 4
        ws.row_dimensions[sig_lbl].height = 24

        emp_nombres = payroll_data[0].get('empleador_nombres') or '' if payroll_data else ''
        emp_pat = payroll_data[0].get('empleador_apellido_paterno') or '' if payroll_data else ''
        emp_mat = payroll_data[0].get('empleador_apellido_materno') or '' if payroll_data else ''
        emp_ci = str(payroll_data[0].get('empleador_ci') or '' if payroll_data else '').strip()
        emp_ext = str(payroll_data[0].get('empleador_ext_ci') or '' if payroll_data else '').strip()

        full_emp_name = f"{emp_pat} {emp_mat} {emp_nombres}".strip().replace("  ", " ").upper()
        if not full_emp_name:
            full_emp_name = "NOMBRE DEL EMPLEADOR O REPRESENTANTE LEGAL"

        if emp_ci:
            if emp_ext and emp_ext.upper() not in emp_ci.upper():
                ci_display = f"{emp_ci} - {emp_ext.upper()}"
            else:
                ci_display = emp_ci
            if not ci_display.upper().startswith("CI"):
                ci_display = f"CI: {ci_display}"
        else:
            ci_display = "N° DE DOCUMENTO DE IDENTIDAD"

        ws.merge_cells(start_row=sig_lbl, start_column=4, end_row=sig_lbl, end_column=9)
        c = ws.cell(row=sig_lbl, column=4, value=full_emp_name)
        c.font = font_bold
        c.alignment = openpyxl.styles.Alignment(horizontal='center', vertical='center')

        ws.merge_cells(start_row=sig_lbl, start_column=12, end_row=sig_lbl, end_column=15)
        c = ws.cell(row=sig_lbl, column=12, value=ci_display)
        c.font = font_bold
        c.alignment = openpyxl.styles.Alignment(horizontal='center', vertical='center')

        ws.merge_cells(start_row=sig_lbl, start_column=18, end_row=sig_lbl, end_column=21)
        c = ws.cell(row=sig_lbl, column=18, value='FIRMA')
        c.font = font_bold
        c.alignment = openpyxl.styles.Alignment(horizontal='center', vertical='center')

        # Anchos de columna balanceados y armoniosos
        col_widths = {
            'A': 5.0,   # N°
            'B': 14.5,  # Documento de identidad
            'C': 33.0,  # Apellidos y Nombres (amplio para nombres largos)
            'D': 10.0,  # Pais
            'E': 12.0,  # Fecha nacimiento
            'F': 6.5,   # Sexo
            'G': 17.5,  # Cargo
            'H': 12.0,  # Fecha ingreso
            'I': 7.5,   # Horas
            'J': 7.0,   # Dias
            'K': 12.5,  # Haber basico
            'L': 11.5,  # Bono antiguedad
            'M': 10.5,  # Bono produccion
            'N': 10.5,  # Subsidio frontera
            'O': 10.5,  # Horas extras
            'P': 10.5,  # Pago dominical
            'Q': 10.5,  # Otros bonos
            'R': 13.5,  # TOTAL GANADO (destacado)
            'S': 11.5,  # Gestora
            'T': 8.5,   # RC-IVA
            'U': 11.0,  # Otros descuentos
            'V': 13.5,  # TOTAL DESCUENTOS (destacado)
            'W': 13.5,  # LIQUIDO PAGABLE (destacado)
            'X': 15.0   # Firma
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
            left=0.25, right=0.25, top=0.35, bottom=0.35, header=0.1, footer=0.1
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
        output_docx = os.path.join(exports_dir, f"prefiniquito_{unique_id}.docx")
        
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
        
        # Otros Pagos (Pago Único vs En Cuotas)
        tipo_otros = data.get('tipo_otros_pagos', 'directo')
        otros_monto = float(data.get('otros_pagos', 0) or 0)
        
        if tipo_otros == 'cuotas' and otros_monto > 0:
            historial = data.get('cuotas_historial', []) or []
            pagos_realizados = [p for p in historial if p.get('estado') == 'pagado' or p.get('monto')]
            total_pagado = sum(float(p.get('monto', 0) or 0) for p in pagos_realizados)
            saldo = max(0.0, otros_monto - total_pagado)
            
            ws['D27'] = "OTROS PAGOS (EN CUOTAS)"
            set_val('F27', format_bs(otros_monto))
            
            try:
                ws.unmerge_cells('D28:E28')
            except Exception:
                pass
            ws.merge_cells('D28:F28')
            if saldo <= 0:
                ws['D28'] = f"ABONADO: {format_bs(total_pagado)} ({len(pagos_realizados)} aportes)  |  TOTALMENTE LIQUIDADO (100%)"
            else:
                ws['D28'] = f"ABONADO: {format_bs(total_pagado)} ({len(pagos_realizados)} aportes)  |  SALDO PENDIENTE (DEBE): {format_bs(saldo)}"
            ws['D28'].font = openpyxl.styles.Font(name="Arial", size=8, italic=True)
            
            # Detalle en el recuadro interior (filas 35-37 sin romper la página)
            if pagos_realizados:
                try: ws.merge_cells('C35:F35')
                except Exception: pass
                ws['C35'] = "HISTORIAL DE ABONOS / APORTES REALIZADOS:"
                ws['C35'].font = openpyxl.styles.Font(name="Arial", size=8, bold=True)
                cuotas_line1 = []
                cuotas_line2 = []
                for p_idx, item in enumerate(pagos_realizados[:6]):
                    num = item.get('numero', p_idx + 1)
                    m = format_bs(item.get('monto', 0))
                    dt = item.get('fecha_pago') or ""
                    comp = f" - Doc: {item.get('comprobante')}" if item.get('comprobante') else ""
                    tag = f"Abono {num}: {m} ({dt}{comp})"
                    if len(cuotas_line1) < 3:
                        cuotas_line1.append(tag)
                    else:
                        cuotas_line2.append(tag)
                if cuotas_line1:
                    try: ws.merge_cells('C36:F36')
                    except Exception: pass
                    ws['C36'] = " | ".join(cuotas_line1)
                    ws['C36'].font = openpyxl.styles.Font(name="Arial", size=7)
                if cuotas_line2:
                    try: ws.merge_cells('C37:F37')
                    except Exception: pass
                    ws['C37'] = " | ".join(cuotas_line2)
                    ws['C37'].font = openpyxl.styles.Font(name="Arial", size=7)
            else:
                try: ws.merge_cells('C35:F35')
                except Exception: pass
                ws['C35'] = f"MODALIDAD EN CUOTAS: Saldo pendiente total de {format_bs(saldo)} (Sin abonos registrados)"
                ws['C35'].font = openpyxl.styles.Font(name="Arial", size=8, italic=True)
        else:
            ws['D27'] = "OTROS PAGOS (PAGO ÚNICO)" if otros_monto > 0 else "OTROS PAGOS"
            set_val('F27', format_bs(otros_monto))
            ws['D28'] = ""
            set_val('F28', "")
        
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
            if os.path.exists(output_xlsx):
                try: os.remove(output_xlsx)
                except Exception: pass
            return output_pdf
        elif output_format in ["word", "docx"]:
            if os.path.exists(output_xlsx):
                try: os.remove(output_xlsx)
                except Exception: pass
            return DocumentService.generate_prefiniquito_word(data, output_docx)
            
        return output_xlsx

    @staticmethod
    def generate_prefiniquito_word(data: dict, output_path: str = None) -> str:
        """
        Genera el Prefiniquito nativo en formato Microsoft Word (.docx)
        con recuadros oficiales, bordes nítidos, tipografía Arial y logos oficiales en 1 página Carta Vertical.
        """
        import docx
        from docx.shared import Inches, Pt, RGBColor
        from docx.enum.text import WD_ALIGN_PARAGRAPH
        from docx.enum.table import WD_TABLE_ALIGNMENT, WD_ALIGN_VERTICAL
        from docx.oxml import parse_xml
        from docx.oxml.ns import nsdecls

        if not output_path:
            unique_id = uuid.uuid4().hex[:8]
            exports_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "exports", "prefiniquitos"))
            os.makedirs(exports_dir, exist_ok=True)
            output_path = os.path.join(exports_dir, f"prefiniquito_{unique_id}.docx")

        doc = docx.Document()
        section = doc.sections[0]
        section.page_width = Inches(8.5)
        section.page_height = Inches(11.0)
        section.top_margin = Inches(0.35)
        section.bottom_margin = Inches(0.35)
        section.left_margin = Inches(0.5)
        section.right_margin = Inches(0.5)

        def set_cell_borders(cell, top='none', bottom='none', left='none', right='none', color='000000', sz='6'):
            tcPr = cell._tc.get_or_add_tcPr()
            tcBorders = parse_xml(f'''
                <w:tcBorders {nsdecls("w")}>
                    <w:top w:val="{top}" w:sz="{sz}" w:space="0" w:color="{color}"/>
                    <w:left w:val="{left}" w:sz="{sz}" w:space="0" w:color="{color}"/>
                    <w:bottom w:val="{bottom}" w:sz="{sz}" w:space="0" w:color="{color}"/>
                    <w:right w:val="{right}" w:sz="{sz}" w:space="0" w:color="{color}"/>
                </w:tcBorders>
            ''')
            tcPr.append(tcBorders)

        def set_cell_margins(cell, top=40, bottom=40, left=80, right=80):
            tcPr = cell._tc.get_or_add_tcPr()
            tcMar = parse_xml(f'''
                <w:tcMar {nsdecls("w")}>
                    <w:top w:w="{top}" w:type="dxa"/>
                    <w:bottom w:w="{bottom}" w:type="dxa"/>
                    <w:left w:w="{left}" w:type="dxa"/>
                    <w:right w:w="{right}" w:type="dxa"/>
                </w:tcMar>
            ''')
            tcPr.append(tcMar)

        def set_cell_shading(cell, color_hex):
            tcPr = cell._tc.get_or_add_tcPr()
            shd = parse_xml(f'<w:shd {nsdecls("w")} w:fill="{color_hex}"/>')
            tcPr.append(shd)

        # 1. RECUADRO 1: ENCABEZADO Y LOGOS OFICIALES
        tbl_hdr = doc.add_table(rows=1, cols=3)
        tbl_hdr.alignment = WD_TABLE_ALIGNMENT.CENTER
        row_hdr = tbl_hdr.rows[0]
        row_hdr.cells[0].width = Inches(1.3)
        row_hdr.cells[1].width = Inches(4.9)
        row_hdr.cells[2].width = Inches(1.3)

        set_cell_borders(row_hdr.cells[0], top='single', bottom='single', left='single', right='none', sz='8')
        set_cell_borders(row_hdr.cells[1], top='single', bottom='single', left='none', right='none', sz='8')
        set_cell_borders(row_hdr.cells[2], top='single', bottom='single', left='none', right='single', sz='8')

        for c in row_hdr.cells:
            set_cell_margins(c, top=60, bottom=60, left=60, right=60)
            c.vertical_alignment = WD_ALIGN_VERTICAL.CENTER

        base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        logo_left = os.path.join(base_dir, "templates", "logos", "logo.png.png")
        if not os.path.exists(logo_left):
            logo_left = "/app/app/templates/logos/logo.png.png"
        logo_right = os.path.join(base_dir, "templates", "logos", "logo-mteps.png")
        if not os.path.exists(logo_right):
            logo_right = "/app/app/templates/logos/logo-mteps.png"

        p0 = row_hdr.cells[0].paragraphs[0]
        p0.alignment = WD_ALIGN_PARAGRAPH.CENTER
        p0.paragraph_format.space_before = Pt(0)
        p0.paragraph_format.space_after = Pt(0)
        if os.path.exists(logo_left):
            p0.add_run().add_picture(logo_left, height=Inches(0.72))

        p1 = row_hdr.cells[1].paragraphs[0]
        p1.alignment = WD_ALIGN_PARAGRAPH.CENTER
        p1.paragraph_format.space_before = Pt(0)
        p1.paragraph_format.space_after = Pt(0)
        r_title = p1.add_run('PRELIQUIDACIÓN O PREFINIQUITO\n')
        r_title.font.name = 'Arial'
        r_title.font.size = Pt(13)
        r_title.font.bold = True
        r_sub = p1.add_run('ESTADO PLURINACIONAL DE BOLIVIA')
        r_sub.font.name = 'Arial'
        r_sub.font.size = Pt(8.5)
        r_sub.font.bold = True
        r_sub.font.color.rgb = RGBColor(90, 90, 90)

        p2 = row_hdr.cells[2].paragraphs[0]
        p2.alignment = WD_ALIGN_PARAGRAPH.CENTER
        p2.paragraph_format.space_before = Pt(0)
        p2.paragraph_format.space_after = Pt(0)
        if os.path.exists(logo_right):
            p2.add_run().add_picture(logo_right, height=Inches(0.72))

        p_sp1 = doc.add_paragraph()
        p_sp1.paragraph_format.space_before = Pt(0)
        p_sp1.paragraph_format.space_after = Pt(3)

        # 2. RECUADRO 2: DATOS DEL TRABAJADOR Y EMPLEADOR
        info_rows = [
            ('NOMBRE DEL TRABAJADOR:', data.get('nombre_trabajador', '').upper(), True),
            ('RAZÓN SOCIAL DEL EMPLEADOR:', data.get('razon_social', '').upper(), True),
            ('FECHA DE INGRESO:', str(data.get('fecha_ingreso', '')), False),
            ('FECHA DE RETIRO:', str(data.get('fecha_retiro', '')), False),
            ('TIEMPO DE TRABAJO:', f"Años: {data.get('anios_trabajados', 0)}       Meses: {data.get('meses_trabajados', 0)}      Días: {data.get('dias_trabajados', 0)}", False),
            ('BONO DE ANTIGÜEDAD:', '0,00 Bs', False),
            ('SUELDO PROMEDIO (Bs.):', f"{float(data.get('sueldo_promedio', 0)):,.2f}".replace(',', 'X').replace('.', ',').replace('X', '.'), False)
        ]

        tbl_info = doc.add_table(rows=len(info_rows), cols=2)
        tbl_info.alignment = WD_TABLE_ALIGNMENT.CENTER
        for idx, (label, val, bold_val) in enumerate(info_rows):
            row = tbl_info.rows[idx]
            row.cells[0].width = Inches(2.3)
            row.cells[1].width = Inches(5.2)

            top_b = 'single' if idx == 0 else 'none'
            bot_b = 'single' if idx == len(info_rows) - 1 else 'none'
            set_cell_borders(row.cells[0], top=top_b, bottom=bot_b, left='single', right='none', sz='8')
            set_cell_borders(row.cells[1], top=top_b, bottom=bot_b, left='none', right='single', sz='8')

            set_cell_margins(row.cells[0], top=25, bottom=25, left=80, right=60)
            set_cell_margins(row.cells[1], top=25, bottom=25, left=60, right=80)

            p_lbl = row.cells[0].paragraphs[0]
            p_lbl.paragraph_format.space_before = Pt(0)
            p_lbl.paragraph_format.space_after = Pt(0)
            r_l = p_lbl.add_run(label)
            r_l.font.name = 'Arial'
            r_l.font.size = Pt(8.5)
            r_l.font.bold = True

            p_val = row.cells[1].paragraphs[0]
            p_val.paragraph_format.space_before = Pt(0)
            p_val.paragraph_format.space_after = Pt(0)
            r_v = p_val.add_run(val)
            r_v.font.name = 'Arial'
            r_v.font.size = Pt(8.5)
            if bold_val:
                r_v.font.bold = True

        p_sp2 = doc.add_paragraph()
        p_sp2.paragraph_format.space_before = Pt(0)
        p_sp2.paragraph_format.space_after = Pt(3)

        # 3. RECUADRO 3: TABLA DE BENEFICIOS SOCIALES Y LIQUIDACIÓN
        format_bs = lambda x: f"{float(x):,.2f} Bs".replace(",", "X").replace(".", ",").replace("X", ".") if x is not None else "0,00 Bs"

        calc_lines = []
        # Desahucio
        calc_lines.append(('DESAHUCIO:', '', format_bs(data.get('desahucio', 0)), False, False))

        # Indemnizacion
        anios = data.get('anios_trabajados', 0)
        meses = data.get('meses_trabajados', 0)
        dias = data.get('dias_trabajados', 0)
        calc_lines.append(('INDEMNIZACIÓN:', f"{anios} Años" if anios > 0 else "", format_bs(data.get('indemnizacion_anios', 0)) if anios > 0 else "", False, False))
        if meses > 0:
            calc_lines.append(('', f"{meses} Meses", format_bs(data.get('indemnizacion_meses', 0)), False, False))
        if dias > 0:
            calc_lines.append(('', f"{dias} Días", format_bs(data.get('indemnizacion_dias', 0)), False, False))

        # Aguinaldo
        ag_m = data.get('aguinaldo_meses_count', 0)
        ag_d = data.get('aguinaldo_dias_count', 0)
        calc_lines.append(('AGUINALDO:', f"{ag_m} Meses" if ag_m > 0 else "", format_bs(data.get('aguinaldo_meses', 0)) if ag_m > 0 else "", False, False))
        if ag_d > 0:
            calc_lines.append(('', f"{ag_d} Días", format_bs(data.get('aguinaldo_dias', 0)), False, False))

        # Vacaciones
        vac_d = data.get('dias_vacacion_pendientes', 0)
        calc_lines.append(('VACACIONES:', f"{vac_d} Días", format_bs(data.get('vacaciones', 0)), False, False))

        # Otros Pagos (Flexible)
        tipo_otros = data.get('tipo_otros_pagos', 'directo')
        otros_m = float(data.get('otros_pagos', 0) or 0)
        historial = data.get('cuotas_historial', []) or []
        
        if tipo_otros == 'cuotas' and otros_m > 0:
            pagos_realizados = [p for p in historial if p.get('estado') == 'pagado' or p.get('monto')]
            total_pagado = sum(float(p.get('monto', 0) or 0) for p in pagos_realizados)
            saldo = max(0.0, otros_m - total_pagado)
            calc_lines.append(('OTROS PAGOS:', "Modalidad en Cuotas", format_bs(otros_m), False, False))
            if saldo <= 0:
                calc_lines.append(('', f"Abonado: {format_bs(total_pagado)} ({len(pagos_realizados)} aportes)  |  Totalmente Liquidado (100%)", "", False, False))
            else:
                calc_lines.append(('', f"Abonado: {format_bs(total_pagado)} ({len(pagos_realizados)} aportes)  |  Saldo Pendiente (Debe): {format_bs(saldo)}", "", False, False))
            if pagos_realizados:
                for p_idx, p_item in enumerate(pagos_realizados[:6]):
                    num = p_item.get('numero', p_idx + 1)
                    f_pago = p_item.get('fecha_pago', '')
                    doc_comp = f" - Doc: {p_item.get('comprobante')}" if p_item.get('comprobante') else ""
                    det = f" - {p_item.get('observacion')}" if p_item.get('observacion') else ""
                    calc_lines.append(('', f"  • Abono #{num}: {format_bs(p_item.get('monto', 0))} ({f_pago}{doc_comp}{det})", "", False, False))
                if len(pagos_realizados) > 6:
                    calc_lines.append(('', f"  • y {len(pagos_realizados) - 6} abono(s) adicional(es) registrado(s)", "", False, False))
            else:
                calc_lines.append(('', "  • Sin abonos registrados a la fecha.", "", False, False))
        else:
            calc_lines.append(('OTROS PAGOS:', 'OTROS' if otros_m == 0 else 'Pago Único', format_bs(otros_m), False, False))

        # Descuentos
        calc_lines.append(('DESCUENTOS:', '', format_bs(data.get('descuentos', 0)), False, False))

        # Totales
        calc_lines.append(('TOTAL CÁLCULO:', '', format_bs(data.get('total_calculo', 0)), True, False))
        if float(data.get('multa_30', 0) or 0) > 0:
            calc_lines.append(('MULTA 30%:', '', format_bs(data.get('multa_30', 0)), True, False))
        calc_lines.append(('TOTAL FINAL:', '', format_bs(data.get('total_final', 0)), True, True))

        num_calc_rows = len(calc_lines) + 2
        tbl_calc = doc.add_table(rows=num_calc_rows, cols=3)
        tbl_calc.alignment = WD_TABLE_ALIGNMENT.CENTER

        col_widths = [Inches(1.8), Inches(3.9), Inches(1.8)]

        for idx, (lbl, det, mnt, is_bold, is_highlight) in enumerate(calc_lines):
            row = tbl_calc.rows[idx]
            for c_i, c in enumerate(row.cells):
                c.width = col_widths[c_i]
                top_b = 'single' if idx == 0 else 'none'
                set_cell_borders(c, top=top_b, bottom='none', left='single' if c_i == 0 else 'none', right='single' if c_i == 2 else 'none', sz='8')
                set_cell_margins(c, top=18, bottom=18, left=60, right=60)
                if is_highlight:
                    set_cell_shading(c, 'F0F4F8')

            # Cell 0: Concepto
            p_l = row.cells[0].paragraphs[0]
            p_l.paragraph_format.space_before = Pt(0)
            p_l.paragraph_format.space_after = Pt(0)
            r0 = p_l.add_run(lbl)
            r0.font.name = 'Arial'
            r0.font.size = Pt(8.5)
            if is_bold: r0.font.bold = True

            # Cell 1: Detalle
            p_d = row.cells[1].paragraphs[0]
            p_d.paragraph_format.space_before = Pt(0)
            p_d.paragraph_format.space_after = Pt(0)
            r1 = p_d.add_run(det)
            r1.font.name = 'Arial'
            r1.font.size = Pt(8.0)
            if is_bold: r1.font.bold = True

            # Cell 2: Importe (Alineado a la derecha)
            p_m = row.cells[2].paragraphs[0]
            p_m.alignment = WD_ALIGN_PARAGRAPH.RIGHT
            p_m.paragraph_format.space_before = Pt(0)
            p_m.paragraph_format.space_after = Pt(0)
            r2 = p_m.add_run(mnt)
            r2.font.name = 'Arial'
            r2.font.size = Pt(8.5)
            if is_bold: r2.font.bold = True

        # Líneas de Firma en la base del Recuadro 3
        sig_row_1 = tbl_calc.rows[num_calc_rows - 2]
        for c_i, c in enumerate(sig_row_1.cells):
            c.width = col_widths[c_i]
            set_cell_borders(c, top='none', bottom='none', left='single' if c_i == 0 else 'none', right='single' if c_i == 2 else 'none', sz='8')
            set_cell_margins(c, top=25, bottom=4, left=60, right=60)

        p_sig_line = sig_row_1.cells[2].paragraphs[0]
        p_sig_line.alignment = WD_ALIGN_PARAGRAPH.CENTER
        p_sig_line.paragraph_format.space_before = Pt(10)
        p_sig_line.paragraph_format.space_after = Pt(0)
        r_sline = p_sig_line.add_run("_______________________")
        r_sline.font.name = 'Arial'
        r_sline.font.size = Pt(8.5)
        r_sline.font.bold = True

        sig_row_2 = tbl_calc.rows[num_calc_rows - 1]
        for c_i, c in enumerate(sig_row_2.cells):
            c.width = col_widths[c_i]
            set_cell_borders(c, top='none', bottom='single', left='single' if c_i == 0 else 'none', right='single' if c_i == 2 else 'none', sz='8')
            set_cell_margins(c, top=2, bottom=25, left=60, right=60)

        p_nota = sig_row_2.cells[0].paragraphs[0]
        p_nota.paragraph_format.space_before = Pt(0)
        p_nota.paragraph_format.space_after = Pt(0)
        r_n = p_nota.add_run("Nota: Este cálculo no causa estado")
        r_n.font.name = 'Arial'
        r_n.font.size = Pt(7.5)
        r_n.font.italic = True

        p_sig_txt = sig_row_2.cells[2].paragraphs[0]
        p_sig_txt.alignment = WD_ALIGN_PARAGRAPH.CENTER
        p_sig_txt.paragraph_format.space_before = Pt(0)
        p_sig_txt.paragraph_format.space_after = Pt(0)
        r_st = p_sig_txt.add_run("SELLO Y FIRMA")
        r_st.font.name = 'Arial'
        r_st.font.size = Pt(8.0)
        r_st.font.bold = True

        p_sp3 = doc.add_paragraph()
        p_sp3.paragraph_format.space_before = Pt(0)
        p_sp3.paragraph_format.space_after = Pt(3)

        # 4. RECUADRO 4: NOTA LEGAL Y FIRMA DEL TRABAJADOR
        tbl_legal = doc.add_table(rows=2, cols=2)
        tbl_legal.alignment = WD_TABLE_ALIGNMENT.CENTER
        row_leg_1 = tbl_legal.rows[0]
        row_leg_1.cells[0].width = Inches(5.3)
        row_leg_1.cells[1].width = Inches(2.2)
        set_cell_borders(row_leg_1.cells[0], top='single', bottom='none', left='single', right='none', sz='8')
        set_cell_borders(row_leg_1.cells[1], top='single', bottom='none', left='none', right='single', sz='8')
        set_cell_margins(row_leg_1.cells[0], top=35, bottom=10, left=80, right=60)
        set_cell_margins(row_leg_1.cells[1], top=35, bottom=10, left=60, right=80)

        p_leg = row_leg_1.cells[0].paragraphs[0]
        p_leg.paragraph_format.space_before = Pt(0)
        p_leg.paragraph_format.space_after = Pt(1)
        r_t1 = p_leg.add_run("EL PRESENTE CALCULO SEGÚN LOS DATOS PROPORCIONADOS POR EL/LA TRABAJADOR (A)\n")
        r_t1.font.name = 'Arial'
        r_t1.font.size = Pt(7.5)
        r_t1.font.bold = True

        r_t2 = p_leg.add_run("Decreto Supremo Nº 28699 de 1-May-2006\nPlazo para pago de beneficios sociales: 15 días\n")
        r_t2.font.name = 'Arial'
        r_t2.font.size = Pt(7.5)

        r_t3 = p_leg.add_run("Articulo 9.- En caso de que el empleador incumpla su obligación en el plazo establecido en el presente articulo, pagará una multa en beneficio del trabajador consistente en el 30% del monto total a cancelarse, incluyendo mantenimiento de valor (UFVs)")
        r_t3.font.name = 'Arial'
        r_t3.font.size = Pt(7.0)

        p_emp_line = row_leg_1.cells[1].paragraphs[0]
        p_emp_line.alignment = WD_ALIGN_PARAGRAPH.CENTER
        p_emp_line.paragraph_format.space_before = Pt(25)
        p_emp_line.paragraph_format.space_after = Pt(0)
        r_eline = p_emp_line.add_run("_______________________")
        r_eline.font.name = 'Arial'
        r_eline.font.size = Pt(8.5)
        r_eline.font.bold = True

        row_leg_2 = tbl_legal.rows[1]
        row_leg_2.cells[0].width = Inches(5.3)
        row_leg_2.cells[1].width = Inches(2.2)
        set_cell_borders(row_leg_2.cells[0], top='none', bottom='single', left='single', right='none', sz='8')
        set_cell_borders(row_leg_2.cells[1], top='none', bottom='single', left='none', right='single', sz='8')
        set_cell_margins(row_leg_2.cells[0], top=0, bottom=20, left=80, right=60)
        set_cell_margins(row_leg_2.cells[1], top=0, bottom=20, left=60, right=80)

        p_emp_txt = row_leg_2.cells[1].paragraphs[0]
        p_emp_txt.alignment = WD_ALIGN_PARAGRAPH.CENTER
        p_emp_txt.paragraph_format.space_before = Pt(0)
        p_emp_txt.paragraph_format.space_after = Pt(0)
        r_etxt = p_emp_txt.add_run("EMPLEADO")
        r_etxt.font.name = 'Arial'
        r_etxt.font.size = Pt(8.0)
        r_etxt.font.bold = True

        doc.save(output_path)
        return output_path

    @staticmethod
    def generate_settlement_word(template_path: str, context: dict, output_path: str):
        from docxtpl import DocxTemplate
        if not os.path.exists(template_path):
            raise FileNotFoundError(f"No se encontró la plantilla en {template_path}")
            
        doc = DocxTemplate(template_path)
        doc.render(context)
        doc.save(output_path)
        return output_path
