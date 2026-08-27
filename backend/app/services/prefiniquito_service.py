from datetime import date
from dateutil.relativedelta import relativedelta
from math import floor

def calculate_time_worked(start_date: date, end_date: date):
    # La ley laboral boliviana suele usar años, meses y días cumplidos.
    # relativedelta es perfecto para esto.
    delta = relativedelta(end_date, start_date)
    return {
        "anios": delta.years,
        "meses": delta.months,
        "dias": delta.days
    }

def calculate_prefiniquito(
    fecha_ingreso: date,
    fecha_retiro: date,
    motivo: str,
    sueldo_promedio: float,
    dias_vacacion_pendientes: int = 0,
    otros_pagos: float = 0.0,
    descuentos: float = 0.0,
    aplicar_multa: bool = False
):
    tiempo = calculate_time_worked(fecha_ingreso, fecha_retiro)
    anios = tiempo['anios']
    meses = tiempo['meses']
    dias = tiempo['dias']
    
    # 1. Desahucio: Sólo si es 'Despido' o similar (Retiro Forzoso)
    # Por ley, equivale a 3 sueldos promedios.
    desahucio = 0.0
    if motivo.lower() in ['despido', 'retiro forzoso', 'despido intempestivo']:
        desahucio = sueldo_promedio * 3

    # 2. Indemnización por tiempo de servicio
    # Un sueldo por año, más duodécimas por meses y días
    indemnizacion_anios = sueldo_promedio * anios
    indemnizacion_meses = (sueldo_promedio / 12) * meses
    indemnizacion_dias = (sueldo_promedio / 360) * dias # En ley boliviana se asume año comercial de 360 para días
    
    # 3. Aguinaldo (duodécimas del año en curso)
    # El aguinaldo de la gestión empieza el 1 de enero.
    inicio_gestion = date(fecha_retiro.year, 1, 1)
    # Si entró este mismo año, el inicio es la fecha de ingreso
    inicio_aguinaldo = max(inicio_gestion, fecha_ingreso)
    tiempo_aguinaldo = calculate_time_worked(inicio_aguinaldo, fecha_retiro)
    
    # El aguinaldo completo es un sueldo por 12 meses.
    aguinaldo_meses = (sueldo_promedio / 12) * tiempo_aguinaldo['meses']
    aguinaldo_dias = (sueldo_promedio / 360) * tiempo_aguinaldo['dias']
    # Ojo: si hay años en tiempo_aguinaldo, fue error lógico, pero como máximo es 1 año, no debería haber.
    # En Bolivia también se incluye el aguinaldo completo si llegó a fin de año pero no se lo pagaron. 
    # Por ahora tomamos solo meses y días como en la boleta.

    # 4. Vacaciones no gozadas
    vacaciones = (sueldo_promedio / 30) * dias_vacacion_pendientes

    # Suma Total
    total_calculo = (
        desahucio +
        indemnizacion_anios + indemnizacion_meses + indemnizacion_dias +
        aguinaldo_meses + aguinaldo_dias +
        vacaciones +
        otros_pagos
    ) - descuentos
    
    # Multa 30%
    multa_30 = 0.0
    if aplicar_multa:
        multa_30 = total_calculo * 0.30
        
    total_final = total_calculo + multa_30

    return {
        "anios_trabajados": anios,
        "meses_trabajados": meses,
        "dias_trabajados": dias,
        "sueldo_promedio": round(sueldo_promedio, 2),
        "desahucio": round(desahucio, 2),
        "indemnizacion_anios": round(indemnizacion_anios, 2),
        "indemnizacion_meses": round(indemnizacion_meses, 2),
        "indemnizacion_dias": round(indemnizacion_dias, 2),
        "aguinaldo_meses": round(aguinaldo_meses, 2),
        "aguinaldo_dias": round(aguinaldo_dias, 2),
        "vacaciones": round(vacaciones, 2),
        "total_calculo": round(total_calculo, 2),
        "multa_30": round(multa_30, 2),
        "total_final": round(total_final, 2)
    }