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
        desde="2025-01-01",
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
    assert "DEL 01/01/2025 AL 31/12/2025" in sub_val, f"Expected range in B6, got '{sub_val}'"
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

    # 6. Verificar Kárdex
    # Fila de encabezados en 19
    assert ws["B19"].value == "N°"
    assert ws["C19"].value == "FECHA / PERIODO"
    assert ws["D19"].value == "TIPO DE VACACIÓN"
    assert ws["E19"].value == "DÍAS GANADOS (+)"
    assert ws["F19"].value == "DÍAS TOMADOS (-)"
    assert ws["G19"].value == "SALDO RESTANTE (=)"
    assert ws["H19"].value == "MOTIVO / DETALLE"
    print("  [OK] Encabezados de tabla de Kárdex verificados (Días Ganados +, Tomados -, Saldo =)")

    # Fila de apertura en 20: "Inicio" y D20: "Derecho Acumulado"
    # E20: "+45.0", F20: "-", G20: "45.0"
    assert ws["D20"].value == "Derecho Acumulado", f"Expected aperture in D20, got {ws['D20'].value}"
    assert ws["E20"].value == "+45.0", f"Expected initial earned +45.0, got {ws['E20'].value}"
    assert ws["F20"].value == "-", f"Expected '-' in F20, got {ws['F20'].value}"
    assert ws["G20"].value == "45.0", f"Expected initial balance 45.0, got {ws['G20'].value}"
    print("  [OK] Fila 0 de Apertura de Kárdex: +45.0 días ganados, saldo 45.0")

    # Fila 1 (Row 21): 5 días descontados -> saldo 40.0
    assert ws["F21"].value == "-5.0"
    assert ws["G21"].value == "40.0"

    # Fila 2 (Row 22): 10 días pagados -> saldo 30.0
    assert ws["F22"].value == "-10.0"
    assert ws["G22"].value == "30.0"

    # Fila 3 (Row 23): 5 días colectiva -> saldo 25.0
    assert ws["F23"].value == "-5.0"
    assert ws["G23"].value == "25.0"

    # Fila 4 (Row 24): 5 días solicitada -> saldo 20.0
    assert ws["F24"].value == "-5.0"
    assert ws["G24"].value == "20.0"
    print("  [OK] Cómputo progresivo de Kárdex (45.0 -> 40.0 -> 30.0 -> 25.0 -> 20.0)")

    # Totales finales en fila 25
    assert ws["B25"].value == "TOTALES / SALDO DISPONIBLE FINAL:"
    assert ws["E25"].value == "+45.0"
    assert ws["F25"].value == "-25.0"
    assert ws["G25"].value == "20.0"
    print("  [OK] Fila de totales de Kárdex: +45.0 ganados, -25.0 tomados, saldo disponible: 20.0 días")

    # 7. Verificar Separación de Líneas de Firmas (NO se tocan)
    f_row = 29
    # Trabajador (B:D) tiene borde inferior
    for c_let in ['B', 'C', 'D']:
        assert ws[f"{c_let}{f_row}"].border.bottom is not None and ws[f"{c_let}{f_row}"].border.bottom.style == 'thin', f"Expected bottom border on worker signature {c_let}"
    # Espacio central (E) NO tiene borde (está vacío para evitar que se toquen las líneas)
    assert ws[f"E{f_row}"].border.bottom is None or ws[f"E{f_row}"].border.bottom.style is None, "ERROR: Central gap E has border, lines would touch!"
    # Empleador (F:H) tiene borde inferior
    for c_let in ['F', 'G', 'H']:
        assert ws[f"{c_let}{f_row}"].border.bottom is not None and ws[f"{c_let}{f_row}"].border.bottom.style == 'thin', f"Expected bottom border on employer signature {c_let}"
    print("  [OK] Líneas de firma completamente separadas: Trabajador (B:D), Espacio vacío (E), Empleador (F:H)")


if __name__ == "__main__":
    test_vacation_tenure_calculation()
    test_company_vacation_excel()
    test_employee_kardex_excel()
    print("\n=============================================")
    print("  ¡TODAS LAS PRUEBAS PASARON EXITOSAMENTE!  ")
    print("=============================================\n")
