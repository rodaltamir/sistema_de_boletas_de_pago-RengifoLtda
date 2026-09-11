import docx
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT, WD_ALIGN_VERTICAL
from docx.oxml import parse_xml
from docx.oxml.ns import nsdecls
import os
import subprocess

def create_prefiniquito_docx(data: dict, output_path: str):
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

    # 1. HEADER TABLE (Box 1)
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

    logo_left = '/app/app/templates/logos/logo.png.png'
    logo_right = '/app/app/templates/logos/logo-mteps.png'

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

    # 2. WORKER & EMPLOYER INFO TABLE (Box 2)
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

    # 3. MAIN CALCULATION TABLE (Box 3)
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

    # Otros pagos
    tipo_otros = data.get('tipo_otros_pagos', 'directo')
    otros_m = float(data.get('otros_pagos', 0) or 0)
    historial = data.get('cuotas_historial', [])
    
    if tipo_otros == 'cuotas' and otros_m > 0:
        c_tot = data.get('cuotas_total', 1) or 1
        total_pagado = sum(float(p.get('monto', 0) or 0) for p in historial)
        saldo = max(0.0, otros_m - total_pagado)
        calc_lines.append(('OTROS PAGOS:', f"Pactado en {c_tot} cuotas", format_bs(otros_m), False, False))
        calc_lines.append(('', f"Amortizado: {format_bs(total_pagado)} ({len(historial)} pagos)  |  Saldo Pendiente: {format_bs(saldo)}", "", False, False))
        for p_idx, p_item in enumerate(historial):
            f_pago = p_item.get('fecha_pago', '')
            doc_comp = f" - Doc: {p_item.get('comprobante')}" if p_item.get('comprobante') else ""
            calc_lines.append(('', f"  • Abono #{p_idx+1}: {format_bs(p_item.get('monto', 0))} ({f_pago}{doc_comp})", "", False, False))
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

        # Cell 0: Label
        p_l = row.cells[0].paragraphs[0]
        p_l.paragraph_format.space_before = Pt(0)
        p_l.paragraph_format.space_after = Pt(0)
        r0 = p_l.add_run(lbl)
        r0.font.name = 'Arial'
        r0.font.size = Pt(8.5)
        if is_bold: r0.font.bold = True

        # Cell 1: Detail
        p_d = row.cells[1].paragraphs[0]
        p_d.paragraph_format.space_before = Pt(0)
        p_d.paragraph_format.space_after = Pt(0)
        r1 = p_d.add_run(det)
        r1.font.name = 'Arial'
        r1.font.size = Pt(8.0)
        if is_bold: r1.font.bold = True

        # Cell 2: Amount (Right aligned)
        p_m = row.cells[2].paragraphs[0]
        p_m.alignment = WD_ALIGN_PARAGRAPH.RIGHT
        p_m.paragraph_format.space_before = Pt(0)
        p_m.paragraph_format.space_after = Pt(0)
        r2 = p_m.add_run(mnt)
        r2.font.name = 'Arial'
        r2.font.size = Pt(8.5)
        if is_bold: r2.font.bold = True

    # Signature lines inside Box 3
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

    # 4. LEGAL NOTICE & EMPLOYEE SIGNATURE TABLE (Box 4)
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
    print(f"Generated docx at {output_path}")

test_data = {
    'nombre_trabajador': 'MANRRIQUE SANTI HIPOLITO',
    'razon_social': 'MANRRIQUE SANTI HIPOLITO',
    'fecha_ingreso': '15 de abril de 2015',
    'fecha_retiro': '11 de septiembre de 2026',
    'anios_trabajados': 11,
    'meses_trabajados': 4,
    'dias_trabajados': 27,
    'sueldo_promedio': 5197.35,
    'desahucio': 0.0,
    'indemnizacion_anios': 57170.85,
    'indemnizacion_meses': 1732.45,
    'indemnizacion_dias': 389.80,
    'aguinaldo_meses': 3464.90,
    'aguinaldo_dias': 144.37,
    'aguinaldo_meses_count': 8,
    'aguinaldo_dias_count': 10,
    'dias_vacacion_pendientes': 37,
    'vacaciones': 6410.07,
    'otros_pagos': 1800.0,
    'tipo_otros_pagos': 'cuotas',
    'cuotas_total': 3,
    'cuotas_historial': [
        {'monto': 600.0, 'fecha_pago': '11/09/2026', 'comprobante': 'REC-001'},
        {'monto': 600.0, 'fecha_pago': '25/09/2026', 'comprobante': 'TRANSF-902'}
    ],
    'descuentos': 0.0,
    'total_calculo': 69312.44,
    'multa_30': 20793.73,
    'total_final': 90106.17
}

out_docx = '/app/exports/test_prefiniquito_native.docx'
create_prefiniquito_docx(test_data, out_docx)

# Convert to PDF and PNG to inspect visually
out_pdf = '/app/exports/test_prefiniquito_native.pdf'
subprocess.run(['libreoffice', '--headless', '--convert-to', 'pdf', '--outdir', '/app/exports', out_docx], check=True)
subprocess.run(['pdftoppm', '-png', '-r', '150', out_pdf, '/app/exports/test_docx_native_render'], check=True)
print('Converted to PDF and PNG for visual inspection!')
