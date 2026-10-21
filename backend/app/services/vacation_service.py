from datetime import date
import calendar
import json
from decimal import Decimal

class VacationService:

    @staticmethod
    def calculate_vacation_scale(anios_servicio: int) -> int:
        """
        Escala legal de vacaciones en Bolivia (Art. 44 Ley General del Trabajo):
        - De 1 a 5 años de servicio: 15 días hábiles
        - De 5 a 10 años de servicio: 20 días hábiles
        - De 10 años en adelante: 30 días hábiles
        """
        if anios_servicio < 5:
            return 15
        elif anios_servicio < 10:
            return 20
        else:
            return 30

    @staticmethod
    def calculate_accumulated_vacation_days(fecha_ingreso: date, reference_date: date = None) -> dict:
        """
        Calcula la antigüedad exacta y los días acumulados de vacación según los años de servicio cumplidos.
        """
        if reference_date is None:
            reference_date = date.today()

        anios = reference_date.year - fecha_ingreso.year
        meses = reference_date.month - fecha_ingreso.month
        dias = reference_date.day - fecha_ingreso.day

        if dias < 0:
            meses -= 1
            prev_month = reference_date.month - 1 if reference_date.month > 1 else 12
            prev_year = reference_date.year if reference_date.month > 1 else reference_date.year - 1
            _, num_days = calendar.monthrange(prev_year, prev_month)
            dias += num_days

        if meses < 0:
            anios -= 1
            meses += 12

        completed_years = max(0, anios)

        # Sumar días acumulados por cada año de servicio cumplido
        total_dias = 0
        for y in range(1, completed_years + 1):
            if y <= 5:
                total_dias += 15
            elif y <= 10:
                total_dias += 20
            else:
                total_dias += 30

        current_scale = VacationService.calculate_vacation_scale(completed_years)

        parts = []
        if completed_years > 0:
            parts.append(f"{completed_years} año{'s' if completed_years != 1 else ''}")
        if meses > 0:
            parts.append(f"{meses} mes{'es' if meses != 1 else ''}")
        if dias > 0 or len(parts) == 0:
            parts.append(f"{dias} día{'s' if dias != 1 else ''}")

        antiguedad_str = ", ".join(parts)

        return {
            "anios": completed_years,
            "meses": max(0, meses),
            "dias": max(0, dias),
            "antiguedad_formato": antiguedad_str,
            "escala_dias": current_scale,
            "dias_acumulados": float(total_dias)
        }
