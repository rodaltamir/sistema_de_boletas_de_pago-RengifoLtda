import os
import sys
from datetime import date, datetime
import openpyxl

# Add app to path
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

from app.services.vacation_service import VacationService
from app.services.document_service import DocumentService

def test_vacation_tenure_calculation():
    print("\n--- TEST 1: Cómputo de Escala de Vacaciones (Art. 44 LGT) ---")
    today = date(2026, 10, 23)

    # 1. Menos de 1 año (Ingreso: 2026-03-01)
    res_0 = VacationService.calculate_accumulated_vacation_days(date(2026, 3, 1), reference_date=today)
    assert res_0["anios"] == 0, f"Expected 0 anios, got {res_0['anios']}"
    assert res_0["dias_acumulados"] == 0.0, f"Expected 0.0 dias, got {res_0['dias_acumulados']}"
    print("  [OK] Menos de 1 año: 0 días de vacación acumulados")

    # 2. De 1 a 5 años (Ingreso: 2023-01-01 -> ~3 años)
    res_3 = VacationService.calculate_accumulated_vacation_days(date(2023, 1, 1), reference_date=today)
    assert res_3["anios"] == 3, f"Expected 3 anios, got {res_3['anios']}"
    assert res_3["escala_dias"] == 15, f"Expected 15 escala, got {res_3['escala_dias']}"
    assert res_3["dias_acumulados"] == 45.0, f"Expected 45.0 dias (3 * 15), got {res_3['dias_acumulados']}"
    print(f"  [OK] 3 años de antigüedad: escala 15 días/año, acumulado: {res_3['dias_acumulados']} días")

    # 3. De 5 a 10 años (Ingreso: 2019-01-01 -> ~7 años)
    res_7 = VacationService.calculate_accumulated_vacation_days(date(2019, 1, 1), reference_date=today)
    assert res_7["anios"] == 7, f"Expected 7 anios, got {res_7['anios']}"
    assert res_7["escala_dias"] == 20, f"Expected 20 escala, got {res_7['escala_dias']}"
    # 5 años * 15 = 75, + 2 años * 20 = 40 -> 115
    assert res_7["dias_acumulados"] == 115.0, f"Expected 115.0 dias, got {res_7['dias_acumulados']}"
    print(f"  [OK] 7 años de antigüedad: escala 20 días/año, acumulado: {res_7['dias_acumulados']} días")

    # 4. Más de 10 años (Ingreso: 2013-01-01 -> ~13 años)
    res_13 = VacationService.calculate_accumulated_vacation_days(date(2013, 1, 1), reference_date=today)
    assert res_13["anios"] == 13, f"Expected 13 anios, got {res_13['anios']}"
    assert res_13["escala_dias"] == 30, f"Expected 30 escala, got {res_13['escala_dias']}"
    # 5*15 = 75, 5*20 = 100, 3*30 = 90 -> 265
    assert res_13["dias_acumulados"] == 265.0, f"Expected 265.0 dias, got {res_13['dias_acumulados']}"
    print(f"  [OK] 13 años de antigüedad: escala 30 días/año, acumulado: {res_13['dias_acumulados']} días")


def test_company_vacation_excel():
    print("\n--- TEST 2: Exportación Planilla General de Vacaciones (Excel) ---")
    mock_company_data = {
        "tenant_name": "EMPRESA DE PRUEBA S.R.L.",
        "tenant_nit": "1020304050",
        "tenant_nro_patronal": "999-88-777",
        "tenant_empleador": "JUAN PEREZ",
        "tenant_empleador_ci": "4567890",
        "fecha_desde": "2026-01-01",
        "fecha_hasta": "2026-12-31",
        "employees": [
            {
                "employee_code": "EMP-001",
                "employee_ci": "1234567 LP",
                "employee_name": "ALVAREZ PEDRO",
                "employee_cargo": "CONTADOR GENERAL",
                "fecha_ingreso": "2022-01-15",
                "antiguedad_formato": "4 años, 9 meses",
                "escala_dias": 15,
                "dias_acumulados": 60.0,
                "dias_pagados": 10.0,
                "dias_a_cuenta": 10.0,
                "dias_solicitadas": 15.0,
                "dias_colectivas": 5.0,
                "total_dias_tomados": 30.0,
                "saldo_dias_pendientes": 30.0
            }
        ],
        "total_dias_acumulados": 60.0,
        "total_dias_pagados": 10.0,
        "total_dias_a_cuenta": 10.0,
        "total_dias_solicitadas": 15.0,
        "total_dias_colectivas": 5.0,
        "total_dias_tomados": 30.0,
        "total_saldo_pendiente": 30.0
    }

    excel_path = DocumentService.generate_company_vacations_excel(
        mock_company_data,
        output_format="xlsx",
        schema_name="prueba_schema",
        desde="2026-01-01",
        hasta="2026-12-31"
    )

    assert os.path.exists(excel_path), f"File was not created at {excel_path}"
    print(f"  [OK] Archivo generado: {os.path.basename(excel_path)}")

    wb = openpyxl.load_workbook(excel_path)
    ws = wb.active

    # Verificar que NO existe N° PATRONAL
    all_text = " ".join([str(cell.value or "") for row in ws.rows for cell in row])
    assert "PATRONAL" not in all_text, "ERROR: 'PATRONAL' still found in company vacation excel!"
    print("  [OK] 'N° PATRONAL' fue removido correctamente de la cabecera")

    # Verificar subtitulo DEL ... AL ...
    sub_val = str(ws["B6"].value)
    assert "DEL 01/01/2026 AL 31/12/2026" in sub_val, f"Expected range in B6, got '{sub_val}'"
    print(f"  [OK] Subtítulo verificado en B6: '{sub_val}'")

    # Verificar totales
    tot_label = str(ws[f"B{9 + len(mock_company_data['employees'])}"].value)
    assert "TOTALES GENERALES:" in tot_label, f"Expected totals row, got {tot_label}"
    print("  [OK] Fila de totales generales presente y formateada")


def test_anniversary_exact_date_accrual():
    print("\n--- TEST 1B: Acreditación Estricta por Fecha Aniversario (No al 1 de Enero) ---")
    # Ejemplo del usuario: Ingreso el 17 de octubre de 2020
    hire_date = date(2020, 10, 17)

    # Al 01 de enero de 2026: Solo han pasado 5 años completos (hasta 17/10/2025).
    # Años 1 a 5 = 5 * 15 = 75 días. NO debe tener los 20 días del año 6 todavía.
    calc_jan1 = VacationService.calculate_accumulated_vacation_days(hire_date, reference_date=date(2026, 1, 1))
    assert calc_jan1["anios"] == 5, f"Esperado 5 años al 01/01/2026, obtenido: {calc_jan1['anios']}"
    assert calc_jan1["dias_acumulados"] == 75.0, f"Esperado 75 días al 01/01/2026, obtenido: {calc_jan1['dias_acumulados']}"
    print(f"  [OK] Al 01/01/2026: {calc_jan1['anios']} años cumplidos, {calc_jan1['dias_acumulados']} días acumulados (no se adelantan los 20 días)")

    # Al 16 de octubre de 2026 (un día antes de su aniversario): Sigue con 75 días
    calc_oct16 = VacationService.calculate_accumulated_vacation_days(hire_date, reference_date=date(2026, 10, 16))
    assert calc_oct16["anios"] == 5
    assert calc_oct16["dias_acumulados"] == 75.0
    print("  [OK] Al 16/10/2026 (día antes del aniversario): Sigue en 75 días acumulados")

    # Al 17 de octubre de 2026 (día exacto de su aniversario): Cumple 6 años y gana +20 días -> 95 días acumulados
    calc_oct17 = VacationService.calculate_accumulated_vacation_days(hire_date, reference_date=date(2026, 10, 17))
    assert calc_oct17["anios"] == 6, f"Esperado 6 años al 17/10/2026, obtenido: {calc_oct17['anios']}"
    assert calc_oct17["dias_acumulados"] == 95.0, f"Esperado 95 días al 17/10/2026 (75 + 20), obtenido: {calc_oct17['dias_acumulados']}"
    print(f"  [OK] Al 17/10/2026 (fecha de ingreso cumplida): Se agregan los 20 días del 6° año -> Total: {calc_oct17['dias_acumulados']} días")


def test_kardex_ordering_with_and_without_fecha_solicitud():
    print("\n--- TEST 4: Orden del Kárdex (Con Fecha Solicitud arriba, Sin Fecha abajo, y Agregación Aniversario) ---")
    hire_date = date(2020, 10, 22)

    # Creamos registros de prueba mezclados:
    # - 2 registros CON fecha_solicitud (uno reciente de agosto 2026 y otro antiguo de marzo 2026)
    # - 2 registros SIN fecha_solicitud (uno agregado primero id=10 y otro después id=20)
    records = [
        {
            "id": 10,
            "tipo": "colectiva",
            "fecha_inicio": "2026-01-05",
            "fecha_fin": "2026-01-10",
            "dias": 5.0,
            "motivo": "Vacación colectiva institucional",
            "fecha_solicitud": None
        },
        {
            "id": 15,
            "tipo": "solicitada",
            "fecha_inicio": "2026-09-01",
            "fecha_fin": "2026-09-05",
            "dias": 5.0,
            "motivo": "Vacaciones de primavera",
            "fecha_solicitud": "2026-08-20" # Solicitud más reciente
        },
        {
            "id": 20,
            "tipo": "dias_pagados",
            "fecha_inicio": "2026-02-01",
            "fecha_fin": "2026-02-01",
            "dias": 10.0,
            "motivo": "Compensación de días",
            "fecha_solicitud": None
        },
        {
            "id": 25,
            "tipo": "solicitada",
            "fecha_inicio": "2026-03-15",
            "fecha_fin": "2026-03-20",
            "dias": 5.0,
            "motivo": "Vacaciones familiares",
            "fecha_solicitud": "2026-03-01" # Solicitud más antigua
        }
    ]

    desde = date(2026, 1, 1)
    hasta = date(2026, 12, 31)

    kardex = VacationService.build_kardex_timeline(hire_date, records, desde, hasta)

    # 1. Apertura previa al 01/01/2026 (Años 1-5 = 75 días acumulados)
    apertura = kardex["apertura"]
    assert apertura["saldo_restante"] == 75.0, f"Esperado saldo anterior 75.0, obtenido {apertura['saldo_restante']}"
    print(f"  [OK] Fila de apertura Saldo Anterior: {apertura['saldo_restante']} días")

    timeline = kardex["timeline"]
    # Total de eventos esperados en el rango:
    # - 2 eventos sin fecha de solicitud (id 10 en enero, id 20 en febrero)
    # - 2 eventos con fecha de solicitud (id 25 en marzo, id 15 en septiembre)
    # - 1 evento de Aniversario cumplido (22/10/2026: 6° año +20 días)
    # Total = 5 eventos en orden cronológico natural por fecha
    assert len(timeline) == 5, f"Esperado 5 eventos, obtenido {len(timeline)}"

    # Fila 1: 05/01/2026 - Colectiva id=10 (-5.0 días) -> Saldo: 70.0
    assert timeline[0]["id"] == 10
    assert timeline[0]["dias_tomados"] == 5.0
    assert timeline[0]["saldo_restante"] == 70.0

    # Fila 2: 01/02/2026 - Días pagados id=20 (-10.0 días) -> Saldo: 60.0
    assert timeline[1]["id"] == 20
    assert timeline[1]["dias_tomados"] == 10.0
    assert timeline[1]["saldo_restante"] == 60.0

    # Fila 3: 15/03/2026 - Solicitada id=25 (-5.0 días, Sol: 01/03/2026) -> Saldo: 55.0
    assert timeline[2]["id"] == 25
    assert timeline[2]["dias_tomados"] == 5.0
    assert timeline[2]["saldo_restante"] == 55.0

    # Fila 4: 01/09/2026 - Solicitada id=15 (-5.0 días, Sol: 20/08/2026) -> Saldo: 50.0
    assert timeline[3]["id"] == 15
    assert timeline[3]["dias_tomados"] == 5.0
    assert timeline[3]["saldo_restante"] == 50.0

    # Fila 5: 22/10/2026 - Aniversario 6° año (+20.0 días ganados) -> Saldo: 70.0
    assert timeline[4]["tipo"] == "derecho_anual"
    assert timeline[4]["fecha"] == date(2026, 10, 22)
    assert timeline[4]["dias_ganados"] == 20.0
    assert timeline[4]["saldo_restante"] == 70.0
    print("  [OK] Timeline cronológico perfecto por fecha de evento: Enero (70) -> Feb (60) -> Mar (55) -> Sep (50) -> Oct (+20 = 70)")

    # Verificar totales
    assert kardex["total_dias_acumulados"] == 95.0
    assert kardex["total_dias_tomados"] == 25.0
    assert kardex["saldo_dias_pendientes"] == 70.0
    print("  [OK] Totales finales correctos: Ganados 95.0, Tomados 25.0, Saldo 70.0 días")

    # 3. Exportar Excel y verificar que la tabla en el archivo respeta este orden exacto
    mock_payload = {
        "empresa_nombre": "RENGIFO & ASOCIADOS S.R.L.",
        "empresa_nit": "9080706050",
        "representante_legal": "CARLOS RENGIFO",
        "ci_representante": "5544332",
        "employee": {
            "employee_id": 1,
            "employee_name": "RENGIFO RENATO",
            "employee_ci": "8888888",
            "employee_cargo": "DESARROLLADOR",
            "fecha_ingreso": "2020-10-22",
            "antiguedad_formato": "6 años",
            "escala_dias": 20,
            "dias_acumulados": 95.0,
            "total_dias_tomados": 25.0,
            "saldo_dias_pendientes": 70.0,
            "records": records
        }
    }

    excel_path = DocumentService.generate_employee_vacation_excel(
        mock_payload,
        schema_name="rengifo_schema",
        desde="2026-01-01",
        hasta="2026-12-31"
    )
    assert os.path.exists(excel_path)
    wb = openpyxl.load_workbook(excel_path)
    ws = wb.active

    # Buscar fila de apertura dinámicamente
    r_ini = None
    for r in range(15, 30):
        if ws[f"B{r}"].value == "Inicio":
            r_ini = r
            break
    assert r_ini is not None, "Fila de inicio no encontrada"

    # Apertura
    assert ws[f"D{r_ini}"].value == "Saldo Anterior"
    assert ws[f"G{r_ini}"].value == "75.0"

    # 1. 05/01/2026: Colectiva id=10
    assert ws[f"D{r_ini+1}"].value == "Colectiva"
    assert ws[f"G{r_ini+1}"].value == "70.0"

    # 2. 01/02/2026: Días Pagados id=20
    assert ws[f"D{r_ini+2}"].value == "Días Pagados"
    assert ws[f"G{r_ini+2}"].value == "60.0"

    # 3. 15/03/2026: Solicitada id=25 (Sol: 01/03/2026)
    assert "Sol: 01/03/2026" in str(ws[f"H{r_ini+3}"].value)
    assert ws[f"G{r_ini+3}"].value == "55.0"

    # 4. 01/09/2026: Solicitada id=15 (Sol: 20/08/2026)
    assert "Sol: 20/08/2026" in str(ws[f"H{r_ini+4}"].value)
    assert ws[f"G{r_ini+4}"].value == "50.0"

    # 5. 22/10/2026: Acreditación Aniversario 22/10/2026
    assert ws[f"D{r_ini+5}"].value == "Derecho Anual"
    assert ws[f"E{r_ini+5}"].value == "+20.0"
    assert ws[f"G{r_ini+5}"].value == "70.0"
    assert "22/10/2026" in str(ws[f"C{r_ini+5}"].value)

    print("  [OK] Excel generado respeta orden cronológico natural por fecha")


def test_employee_kardex_excel():
    print("\n--- TEST 3: Ficha Individual y Kárdex Progresivo (Excel) ---")
    mock_emp_payload = {
        "empresa_nombre": "RENGIFO & ASOCIADOS S.R.L.",
        "empresa_nit": "9080706050",
        "numero_patronal": "111-22-333",
        "representante_legal": "CARLOS RENGIFO",
        "ci_representante": "5544332",
        "employee": {
            "employee_id": 10,
            "employee_code": "DEV-01",
            "employee_name": "RENGIFO RENATO",
            "employee_ci": "8888888",
            "employee_cargo": "DESARROLLADOR SENIOR",
            "fecha_ingreso": "2023-01-01",
            "antiguedad_formato": "3 años, 9 meses",
            "escala_dias": 15,
            "dias_acumulados": 45.0,
            "dias_pagados": 10.0,
            "dias_a_cuenta": 10.0,
            "dias_solicitadas": 10.0,
            "dias_colectivas": 5.0,
            "total_dias_tomados": 25.0,
            "saldo_dias_pendientes": 20.0,
            "records": [
                {
                    "id": 1,
                    "tipo": "solicitada",
                    "fecha_inicio": "2024-05-10",
                    "fecha_fin": "2024-05-15",
                    "dias": 5.0,
                    "motivo": "Vacaciones familiares",
                    "gestion": 2024,
                    "aprobado_por": "RRHH"
                },
                {
                    "id": 2,
                    "tipo": "dias_pagados",
                    "fecha_inicio": "2024-12-20",
                    "fecha_fin": "2024-12-20",
                    "dias": 10.0,
                    "motivo": "Compensación de días pagados",
                    "gestion": 2024,
                    "aprobado_por": "Gerencia"
                },
                {
                    "id": 3,
                    "tipo": "colectiva",
                    "fecha_inicio": "2025-01-02",
                    "fecha_fin": "2025-01-07",
                    "dias": 5.0,
                    "motivo": "Cierre colectivo anual",
                    "gestion": 2025,
                    "aprobado_por": "RRHH"
                },
                {
                    "id": 4,
                    "tipo": "solicitada",
                    "fecha_inicio": "2025-07-10",
                    "fecha_fin": "2025-07-15",
                    "dias": 5.0,
                    "motivo": "Permiso de descanso",
                    "gestion": 2025,
                    "aprobado_por": "RRHH"
                }
            ]
        }
    }

    excel_path = DocumentService.generate_employee_vacation_excel(
        mock_emp_payload,
        output_format="xlsx",
        schema_name="rengifo_schema",
        desde="2023-01-01",
        hasta="2025-12-31"
    )

    assert os.path.exists(excel_path), f"File was not created at {excel_path}"
    print(f"  [OK] Ficha Individual generada: {os.path.basename(excel_path)}")

    wb = openpyxl.load_workbook(excel_path)
    ws = wb.active

    # 1. Verificar que NO hay N° PATRONAL
    all_text = " ".join([str(cell.value or "") for row in ws.rows for cell in row])
    assert "PATRONAL" not in all_text, "ERROR: 'PATRONAL' still found in employee vacation excel!"
    print("  [OK] 'N° PATRONAL' no figura en la Ficha Individual")

    # 2. Verificar que NO hay columna 'APROBADO POR'
    assert "APROBADO POR" not in all_text, "ERROR: 'APROBADO POR' still found in employee vacation excel!"
    print("  [OK] 'APROBADO POR' fue removido de la tabla de movimientos")

    # 3. Verificar subtítulo DEL ... AL ...
    sub_val = str(ws["B6"].value)
    assert "DEL 01/01/2023 AL 31/12/2025" in sub_val, f"Expected range in B6, got '{sub_val}'"
    print(f"  [OK] Subtítulo verificado en B6: '{sub_val}'")

    # 4. Verificar etiquetas de datos del trabajador (sin cortes)
    assert ws["B9"].value == "TRABAJADOR:", f"Expected 'TRABAJADOR:', got {ws['B9'].value}"
    assert ws["B10"].value == "CARGO / PUESTO:", f"Expected 'CARGO / PUESTO:', got {ws['B10'].value}"
    assert ws["B11"].value == "ANTIGÜEDAD:", f"Expected 'ANTIGÜEDAD:', got {ws['B11'].value}"
    print("  [OK] Rótulos de datos del trabajador no cortados (espacio amplio B:C)")

    # 5. Verificar Resumen Simplificado de 3 Cajas
    assert ws["B14"].value == "DÍAS GANADOS (+)"
    assert ws["D14"].value == "DÍAS TOMADOS (-)"
    assert ws["G14"].value == "SALDO DISPONIBLE (=)"
    print("  [OK] Resumen simplificado e intuitivo en 3 tarjetas (Ganados, Tomados, Saldo)")

    # 6. Verificar Kárdex dinámicamente
    r_ini = None
    for r in range(15, 30):
        if ws[f"B{r}"].value == "Inicio":
            r_ini = r
            break
    assert r_ini is not None, "Fila de inicio no encontrada"

    # Fila de apertura: "Inicio" e "Ingreso Empresa" (porque desde coincide con fecha de ingreso)
    assert ws[f"B{r_ini}"].value == "Inicio"
    assert ws[f"D{r_ini}"].value == "Ingreso Empresa"
    assert ws[f"G{r_ini}"].value == "0.0"
    print("  [OK] Fila 0 de Apertura de Kárdex: Ingreso Empresa el 01/01/2023, saldo 0.0")

    # Fila 1 (r_ini+1): Acreditación 1° año (01/01/2024) -> +15.0 ganados, saldo 15.0
    assert ws[f"D{r_ini+1}"].value == "Derecho Anual"
    assert ws[f"E{r_ini+1}"].value == "+15.0"
    assert ws[f"G{r_ini+1}"].value == "15.0"

    # Fila 2 (r_ini+2): 5 días solicitada id=1 (10/05/2024) -> saldo 10.0
    assert ws[f"F{r_ini+2}"].value == "-5.0"
    assert ws[f"G{r_ini+2}"].value == "10.0"

    # Fila 3 (r_ini+3): 10 días pagados id=2 (20/12/2024) -> saldo 0.0
    assert ws[f"F{r_ini+3}"].value == "-10.0"
    assert ws[f"G{r_ini+3}"].value == "0.0"

    # Fila 4 (r_ini+4): Acreditación 2° año (01/01/2025) -> +15.0 ganados, saldo 15.0
    assert ws[f"D{r_ini+4}"].value == "Derecho Anual"
    assert ws[f"E{r_ini+4}"].value == "+15.0"
    assert ws[f"G{r_ini+4}"].value == "15.0"

    # Fila 5 (r_ini+5): 5 días colectiva id=3 (02/01/2025) -> saldo 10.0
    assert ws[f"F{r_ini+5}"].value == "-5.0"
    assert ws[f"G{r_ini+5}"].value == "10.0"

    # Fila 6 (r_ini+6): 5 días solicitada id=4 (10/07/2025) -> saldo 5.0
    assert ws[f"F{r_ini+6}"].value == "-5.0"
    assert ws[f"G{r_ini+6}"].value == "5.0"
    print("  [OK] Cómputo progresivo de Kárdex estrictamente cronológico: 0.0 -> +15 (15) -> -5 (10) -> -10 (0) -> +15 (15) -> -5 (10) -> -5 (5.0)")

    # Totales finales en r_ini+7
    r_tot = r_ini + 7
    assert ws[f"B{r_tot}"].value == "TOTALES Y SALDO FINAL:"
    assert ws[f"E{r_tot}"].value == "+30.0"
    assert ws[f"F{r_tot}"].value == "-25.0"
    assert ws[f"G{r_tot}"].value == "5.0"
    print("  [OK] Fila de totales de Kárdex: +30.0 ganados (2 años cumplidos al 2025), -25.0 tomados, saldo disponible: 5.0 días")

    # 7. Verificar Separación de Líneas de Firmas (NO se tocan)
    f_row = r_tot + 4
    # Trabajador (B:D) tiene borde inferior
    for c_let in ['B', 'C', 'D']:
        assert ws[f"{c_let}{f_row}"].border.bottom is not None and ws[f"{c_let}{f_row}"].border.bottom.style == 'thin', f"Expected bottom border on worker signature {c_let}"
    # Espacio central (E) NO tiene borde (está vacío para evitar que se toquen las líneas)
    assert ws[f"E{f_row}"].border.bottom is None or ws[f"E{f_row}"].border.bottom.style is None, "ERROR: Central gap E has border, lines would touch!"
    # Empleador (F:H) tiene borde inferior
    for c_let in ['F', 'G', 'H']:
        assert ws[f"{c_let}{f_row}"].border.bottom is not None and ws[f"{c_let}{f_row}"].border.bottom.style == 'thin', f"Expected bottom border on employer signature {c_let}"
    print("  [OK] Líneas de firma completamente separadas: Trabajador (B:D), Espacio vacío (E), Empleador (F:H)")


def test_kardex_detailed_by_month():
    print("\n--- TEST 5: Kárdex Detallado por Mes y Días en Específico (Justificación Laboral) ---")
    hire_date = date(2020, 10, 22)
    desde = date(2026, 1, 1)
    hasta = date(2026, 12, 31)

    # 1. Vacación que cruza meses: 2 días en enero y 2 días en febrero
    # 2. Vacación en marzo: 5 días
    # 3. Días pagados en julio: 5 días
    # 4. Aniversario el 22/10/2026: +20 días ganados
    records = [
        {
            "id": 101,
            "tipo": "solicitada",
            "fecha_inicio": "2026-01-29",
            "fecha_fin": "2026-02-03",
            "dias": 4.0,
            "fechas_detalle": ["2026-01-29", "2026-01-30", "2026-02-02", "2026-02-03"],
            "motivo": "Vacaciones intermensuales",
            "fecha_solicitud": "2026-01-15"
        },
        {
            "id": 102,
            "tipo": "solicitada",
            "fecha_inicio": "2026-03-02",
            "fecha_fin": "2026-03-06",
            "dias": 5.0,
            "fechas_detalle": ["2026-03-02", "2026-03-03", "2026-03-04", "2026-03-05", "2026-03-06"],
            "motivo": "Descanso programado marzo",
            "fecha_solicitud": "2026-02-20"
        },
        {
            "id": 103,
            "tipo": "dias_pagados",
            "fecha_inicio": "2026-07-15",
            "fecha_fin": "2026-07-15",
            "dias": 5.0,
            "motivo": "Compensación semestral",
            "fecha_solicitud": None
        }
    ]

    kardex_gen = VacationService.build_kardex_timeline(hire_date, records, desde, hasta)
    kardex_det = VacationService.build_kardex_detailed_by_month(hire_date, records, desde, hasta)

    # A. Verificación de concordancia matemática absoluta
    assert kardex_det["total_dias_acumulados"] == kardex_gen["total_dias_acumulados"], "Error: Días acumulados no coinciden"
    assert kardex_det["total_dias_tomados"] == kardex_gen["total_dias_tomados"], "Error: Días tomados no coinciden"
    assert kardex_det["saldo_dias_pendientes"] == kardex_gen["saldo_dias_pendientes"], "Error: Saldo pendiente no coincide"
    print(f"  [OK] Concordancia 100% entre Kárdex General y Detallado: Ganados={kardex_det['total_dias_acumulados']}, Tomados={kardex_det['total_dias_tomados']}, Saldo={kardex_det['saldo_dias_pendientes']}")

    # B. Verificación de desglose de vacación intermensual (Enero y Febrero)
    det_timeline = kardex_det["timeline"]
    # Buscamos eventos de enero y febrero provenientes de id 101
    ene_ev = next(e for e in det_timeline if e.get("record_id") == 101 and e["mes_key"] == "2026-01")
    feb_ev = next(e for e in det_timeline if e.get("record_id") == 101 and e["mes_key"] == "2026-02")

    assert ene_ev["dias_tomados"] == 2.0
    assert "29/01" in ene_ev["dias_especificos_formato"] and "30/01" in ene_ev["dias_especificos_formato"]
    assert feb_ev["dias_tomados"] == 2.0
    assert "02/02" in feb_ev["dias_especificos_formato"] and "03/02" in feb_ev["dias_especificos_formato"]
    print("  [OK] Desglose intermensual exitoso: Enero 2 días específicos y Febrero 2 días específicos")

    # C. Verificación de acreditación aniversario en su mes y día exacto
    oct_anniv = next(e for e in det_timeline if e.get("is_anniversary") and e["mes_key"] == "2026-10")
    assert oct_anniv["dias_ganados"] == 20.0
    assert oct_anniv["mes_label"] == "Octubre 2026"
    assert "22/10/2026" in oct_anniv["dias_especificos_formato"]
    print("  [OK] Acreditación anual detallada: Octubre 2026 con fecha exacta 22/10/2026 (+20 d)")

    # D. Verificación de resumen mensual consolidado
    res_mensual = kardex_det["resumen_mensual"]
    assert len(res_mensual) >= 4, f"Esperado al menos 4 meses con actividad, obtenido {len(res_mensual)}"
    meses_presentes = [m["mes_key"] for m in res_mensual]
    assert "2026-01" in meses_presentes and "2026-02" in meses_presentes and "2026-03" in meses_presentes and "2026-10" in meses_presentes
    print("  [OK] Resumen mensual consolidado generado correctamente para justificación de RRHH")

    # E. Verificación en exportación Excel (Hoja 1 y Hoja 2 presentes y concordantes)
    mock_payload = {
        "empresa_nombre": "RENGIFO & ASOCIADOS S.R.L.",
        "empresa_nit": "9080706050",
        "representante_legal": "CARLOS RENGIFO",
        "employee": {
            "employee_id": 99,
            "employee_name": "RENGIFO RENATO",
            "employee_ci": "8888888",
            "employee_cargo": "GERENTE GENERAL",
            "fecha_ingreso": "2020-10-22",
            "antiguedad_formato": "6 años",
            "escala_dias": 20,
            "dias_acumulados": 95.0,
            "total_dias_tomados": 14.0,
            "saldo_dias_pendientes": 81.0,
            "records": records
        }
    }

    excel_path = DocumentService.generate_employee_vacation_excel(
        mock_payload,
        output_format="xlsx",
        schema_name="rengifo_schema",
        desde="2026-01-01",
        hasta="2026-12-31"
    )
    assert os.path.exists(excel_path)
    wb = openpyxl.load_workbook(excel_path)
    assert "Ficha de Vacaciones" in wb.sheetnames, "Falta Hoja 1 Ficha de Vacaciones"
    assert "Kárdex Detallado por Mes" in wb.sheetnames, "Falta Hoja 2 Kárdex Detallado por Mes"

    ws_det = wb["Kárdex Detallado por Mes"]
    assert "KÁRDEX DETALLADO DE VACACIONES" in str(ws_det["B5"].value)
    assert "DATOS DEL TRABAJADOR" in str(ws_det["B8"].value)
    assert "RESUMEN DE DÍAS COMPUTADOS" in str(ws_det["B13"].value) or "RESUMEN DE CÓMPUTO EN EL PERIODO" in str(ws_det["B13"].value)

    # Verificar que las dos hojas tienen el mismo saldo final
    ws_gen = wb["Ficha de Vacaciones"]
    # En hoja general, el saldo final está en G de la fila de totales
    # En hoja detallada, el saldo final está en H de la fila de totales
    all_det_text = " ".join([str(cell.value or "") for row in ws_det.rows for cell in row])
    assert "81.0" in all_det_text, "Error: Saldo concordante 81.0 no encontrado en Hoja 2"
    assert "Saldo disponible" in all_det_text
    print("  [OK] Excel generado con dos hojas: 'Ficha de Vacaciones' (General) y 'Kárdex Detallado por Mes' (Detallado)")


def test_mathematical_reconciliation_kardex():
    print("\n--- TEST 7: Verificación Matemática Exacta de Saldos (Caso Yujra Sergio) ---")
    hire_date = date(2022, 11, 17)
    desde_dt = date(2026, 1, 1)
    hasta_dt = date(2026, 12, 31)

    records = [
        # Registros previos (31 días tomados entre 2023 y 2025)
        {"id": 1, "tipo": "colectiva", "fecha_inicio": "2023-05-10", "fecha_fin": "2023-05-20", "dias": 10.0, "motivo": "Colectivas 2023"},
        {"id": 2, "tipo": "solicitada", "fecha_inicio": "2024-06-15", "fecha_fin": "2024-06-25", "dias": 11.0, "motivo": "Solicitadas 2024", "fecha_solicitud": "2024-06-01"},
        {"id": 3, "tipo": "colectiva", "fecha_inicio": "2025-07-10", "fecha_fin": "2025-07-20", "dias": 10.0, "motivo": "Colectivas 2025"},
        # Registros en periodo 2026 (14 días tomados en 2026)
        {"id": 4, "tipo": "solicitada", "fecha_inicio": "2026-03-02", "fecha_fin": "2026-03-02", "dias": 1.0, "motivo": "Solicitada 1 día", "fecha_solicitud": "2026-02-20"},
        {"id": 5, "tipo": "dias_pagados", "fecha_inicio": "2026-05-10", "fecha_fin": "2026-05-10", "dias": 3.0, "motivo": "Liquidación 3 días"},
        {"id": 6, "tipo": "dias_pagados", "fecha_inicio": "2026-08-15", "fecha_fin": "2026-08-15", "dias": 10.0, "motivo": "Compensación 10 días"}
    ]

    kardex_gen = VacationService.build_kardex_timeline(hire_date, records, desde_dt, hasta_dt)
    kardex_det = VacationService.build_kardex_detailed_by_month(hire_date, records, desde_dt, hasta_dt)

    assert kardex_gen["has_saldo_anterior"] is True, "Debe tener saldo anterior"
    assert kardex_gen["ganados_pre"] == 45.0, f"Esperado 45.0 ganados previos, obtuvo {kardex_gen['ganados_pre']}"
    assert kardex_gen["tomados_pre"] == 31.0, f"Esperado 31.0 tomados previos, obtuvo {kardex_gen['tomados_pre']}"
    assert kardex_gen["saldo_pre"] == 14.0, f"Esperado 14.0 saldo anterior, obtuvo {kardex_gen['saldo_pre']}"
    assert kardex_gen["ganados_periodo"] == 15.0, f"Esperado 15.0 ganados periodo, obtuvo {kardex_gen['ganados_periodo']}"
    assert kardex_gen["tomados_periodo"] == 14.0, f"Esperado 14.0 tomados periodo, obtuvo {kardex_gen['tomados_periodo']}"
    assert kardex_gen["total_computable_periodo"] == 29.0, f"Esperado 29.0 total computable, obtuvo {kardex_gen['total_computable_periodo']}"
    assert kardex_gen["saldo_final_periodo"] == 15.0, f"Esperado 15.0 saldo final periodo, obtuvo {kardex_gen['saldo_final_periodo']}"
    print("  [OK] Cómputo del Kárdex General: 14.0 Saldo Ant + 15.0 Ganados = 29.0 Computable; 29.0 - 14.0 Tomados = 15.0 Saldo Final")

    # Verificar que el motivo de apertura sea limpio y sin fórmulas redundantes en gris
    assert "Saldo acumulado al inicio del periodo (01/01/2026)" in kardex_gen["apertura"]["motivo"]
    print("  [OK] Motivo de apertura limpio y profesional: Saldo acumulado al inicio del periodo")

    # Generar Excel y verificar que las celdas de totales cuadren matemáticamente
    mock_payload = {
        "empresa_nombre": "RENGIFO & ASOCIADOS S.R.L.",
        "empresa_nit": "9080706050",
        "representante_legal": "CARLOS RENGIFO",
        "employee": {
            "employee_id": 101,
            "employee_name": "YUJRA SERGIO",
            "employee_ci": "7654321",
            "employee_cargo": "AUXILIAR DE PLANTA",
            "fecha_ingreso": "2022-11-17",
            "antiguedad_formato": "3 años, 11 meses",
            "escala_dias": 15,
            "dias_acumulados": 60.0,
            "total_dias_tomados": 45.0,
            "saldo_dias_pendientes": 15.0,
            "records": records
        }
    }

    excel_path = DocumentService.generate_employee_vacation_excel(
        mock_payload,
        output_format="xlsx",
        schema_name="rengifo_schema",
        desde="2026-01-01",
        hasta="2026-12-31"
    )
    assert os.path.exists(excel_path)
    wb = openpyxl.load_workbook(excel_path)
    ws_1 = wb["Ficha de Vacaciones"]
    ws_2 = wb["Kárdex Detallado por Mes"]

    # En Hoja 1: Buscar fila de totales del periodo
    found_tot_h1 = False
    for row in ws_1.iter_rows(values_only=True):
        if row[1] and "TOTALES Y SALDO FINAL" in str(row[1]):
            # row[4] es Col E (+29.0), row[5] es Col F (-14.0), row[6] es Col G (15.0)
            assert str(row[4]).strip() == "+29.0", f"Col E debe ser +29.0, fue {row[4]}"
            assert str(row[5]).strip() == "-14.0", f"Col F debe ser -14.0, fue {row[5]}"
            assert str(row[6]).strip() == "15.0", f"Col G debe ser 15.0, fue {row[6]}"
            found_tot_h1 = True
            break
    assert found_tot_h1, "No se encontró fila de TOTALES Y SALDO FINAL en Hoja 1"
    print("  [OK] Hoja 1 Fila de Totales: Col E = +29.0, Col F = -14.0, Col G = 15.0 (Cuadra 100% con las filas)")

    # En Hoja 2: Buscar fila de totales del periodo y Desglose Mensual
    found_tot_h2 = False
    for row in ws_2.iter_rows(values_only=True):
        if row[1] and "TOTALES Y SALDO FINAL" in str(row[1]):
            # row[5] es Col F (+29.0), row[6] es Col G (-14.0), row[7] es Col H (15.0)
            assert str(row[5]).strip() == "+29.0", f"Col F debe ser +29.0, fue {row[5]}"
            assert str(row[6]).strip() == "-14.0", f"Col G debe ser -14.0, fue {row[6]}"
            assert str(row[7]).strip() == "15.0", f"Col H debe ser 15.0, fue {row[7]}"
            found_tot_h2 = True
            break
    assert found_tot_h2, "No se encontró fila de TOTALES Y SALDO FINAL en Hoja 2"
    print("  [OK] Hoja 2 Fila de Totales: Col F = +29.0, Col G = -14.0, Col H = 15.0 (Cuadra 100%)")

    # Verificar que existe la tabla de DESGLOSE MENSUAL CONSOLIDADO en Hoja 2
    all_h2_text = " ".join([str(cell.value or "") for row in ws_2.rows for cell in row])
    assert "DESGLOSE MENSUAL CONSOLIDADO (JUSTIFICACIÓN LABORAL MES A MES)" in all_h2_text
    print("  [OK] Hoja 2 contiene la tabla de DESGLOSE MENSUAL CONSOLIDADO (JUSTIFICACIÓN LABORAL MES A MES)")


if __name__ == "__main__":
    test_vacation_tenure_calculation()
    test_anniversary_exact_date_accrual()
    test_company_vacation_excel()
    test_kardex_ordering_with_and_without_fecha_solicitud()
    test_employee_kardex_excel()
    test_kardex_detailed_by_month()
    test_mathematical_reconciliation_kardex()
    print("\n=============================================")
    print("  ¡TODAS LAS PRUEBAS PASARON EXITOSAMENTE!  ")
    print("=============================================\n")
