from decimal import Decimal, ROUND_HALF_UP

# Constantes de Ley (Podrían venir de base de datos en el futuro)
SMN_ACTUAL = Decimal("3300.00")  # Salario Mínimo Nacional referencial 2026

# Gestora Pública (12.71%)
PORCENTAJE_GESTORA = Decimal("0.1271")

# RC-IVA (13%)
PORCENTAJE_RC_IVA = Decimal("0.13")
CANTIDAD_SMN_NO_IMPONIBLE = 2

def calcular_bono_antiguedad(anios_antiguedad: int, smn: Decimal = SMN_ACTUAL) -> Decimal:
    """
    Calcula el bono de antigüedad según la escala de la Ley General del Trabajo.
    Base de cálculo: 3 Salarios Mínimos Nacionales.
    """
    porcentaje = Decimal("0.00")
    if 2 <= anios_antiguedad <= 4:
        porcentaje = Decimal("0.05")
    elif 5 <= anios_antiguedad <= 7:
        porcentaje = Decimal("0.11")
    elif 8 <= anios_antiguedad <= 10:
        porcentaje = Decimal("0.18")
    elif 11 <= anios_antiguedad <= 14:
        porcentaje = Decimal("0.26")
    elif 15 <= anios_antiguedad <= 19:
        porcentaje = Decimal("0.34")
    elif 20 <= anios_antiguedad <= 24:
        porcentaje = Decimal("0.42")
    elif anios_antiguedad >= 25:
        porcentaje = Decimal("0.50")
        
    base_calculo = smn * 3
    bono = base_calculo * porcentaje
    return bono.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def calcular_rc_iva(sueldo_neto: Decimal, smn: Decimal = SMN_ACTUAL) -> Decimal:
    """
    Cálculo simplificado del RC-IVA.
    sueldo_neto = Total Ganado - Gestora (12.71%)
    Si el sueldo neto es mayor a 4 SMN, es sujeto a RC-IVA.
    Fórmula base MVP: (Sueldo Neto - 2 SMN (Mínimo no imponible)) * 13% 
    """
    monto_no_imponible = smn * CANTIDAD_SMN_NO_IMPONIBLE
    sujeto_a_impuesto = sueldo_neto - monto_no_imponible
    
    if sujeto_a_impuesto > 0:
        # Se descuenta adicionalmente el 13% de 2 SMN (facturas presumidas por ley)
        # Nota: La lógica real permite descargar facturas (F-110). Para el MVP, 
        # asumiremos cero presentación de facturas externas y solo las deducciones por defecto.
        descuento_ley = monto_no_imponible * PORCENTAJE_RC_IVA
        impuesto_previo = sujeto_a_impuesto * PORCENTAJE_RC_IVA
        rc_iva = impuesto_previo - descuento_ley
        if rc_iva > 0:
            return rc_iva.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    
    return Decimal("0.00")

def calcular_boleta_empleado(
    haber_basico: Decimal,
    anios_antiguedad: int,
    bono_produccion: Decimal = Decimal("0.00"),
    subsidio_frontera: Decimal = Decimal("0.00"),
    trabajo_extraordinario: Decimal = Decimal("0.00"),
    pago_dominical: Decimal = Decimal("0.00"),
    otros_bonos: Decimal = Decimal("0.00"),
    subsidio_natalidad: Decimal = Decimal("0.00"),
    anticipos: Decimal = Decimal("0.00"),
    otros_descuentos: Decimal = Decimal("0.00"),
    smn: Decimal = SMN_ACTUAL
) -> dict:
    """
    Calcula todos los montos de la boleta de pago (Payslip).
    """
    bono_ant = calcular_bono_antiguedad(anios_antiguedad, smn)
    total_ganado = haber_basico + bono_ant + bono_produccion + subsidio_frontera + trabajo_extraordinario + pago_dominical + otros_bonos
    
    aporte_gestora = (total_ganado * PORCENTAJE_GESTORA).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    sueldo_neto = total_ganado - aporte_gestora
    
    rc_iva = calcular_rc_iva(sueldo_neto, smn)
    
    total_descuentos = aporte_gestora + rc_iva + anticipos + otros_descuentos
    liquido_pagable = total_ganado - total_descuentos + subsidio_natalidad
    
    return {
        "haber_basico": haber_basico,
        "bono_antiguedad": bono_ant,
        "bono_produccion": bono_produccion,
        "subsidio_frontera": subsidio_frontera,
        "trabajo_extraordinario": trabajo_extraordinario,
        "pago_dominical": pago_dominical,
        "otros_bonos": otros_bonos,
        "subsidio_natalidad": subsidio_natalidad,
        "total_ganado": total_ganado,
        "aporte_gestora": aporte_gestora,
        "rc_iva": rc_iva,
        "anticipos": anticipos,
        "otros_descuentos": otros_descuentos,
        "total_descuentos": total_descuentos,
        "liquido_pagable": liquido_pagable
    }
