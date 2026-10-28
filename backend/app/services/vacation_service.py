from datetime import date
import calendar
import json
from decimal import Decimal

class VacationService:

    @staticmethod
    def get_days_for_year(year_number: int) -> int:
        """
        Días de vacación correspondientes al año cumplido de servicio (Art. 44 Ley General del Trabajo):
        - Años 1 a 5: 15 días hábiles
        - Años 6 a 10: 20 días hábiles
        - Años 11 en adelante: 30 días hábiles
        """
        if year_number <= 5:
            return 15
        elif year_number <= 10:
            return 20
        else:
            return 30

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
    def get_anniversary_date(fecha_ingreso: date, target_year: int) -> date:
        """
        Retorna la fecha exacta de aniversario para un año dado, manejando el 29 de febrero en años no bisiestos.
        """
        try:
            return date(target_year, fecha_ingreso.month, fecha_ingreso.day)
        except ValueError:
            return date(target_year, fecha_ingreso.month, 28)

    @staticmethod
    def calculate_accumulated_vacation_days(fecha_ingreso: date, reference_date: date = None) -> dict:
        """
        Calcula la antigüedad exacta y los días acumulados de vacación según los años de servicio cumplidos
        a la fecha de corte exacta (reference_date). Los días se acreditan ESTRICTAMENTE en la fecha de
        aniversario de ingreso, nunca al 1 de enero.
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

        # Cómputo legal O(1) de días acumulados por años cumplidos a la fecha de corte
        # Años 1 a 5: 15 d/año | Años 6 a 10: 20 d/año | Años 11 en adelante: 30 d/año
        y1_5 = min(completed_years, 5)
        y6_10 = max(0, min(completed_years - 5, 5))
        y11_plus = max(0, completed_years - 10)
        total_dias = float(y1_5 * 15 + y6_10 * 20 + y11_plus * 30)

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

    @staticmethod
    def build_kardex_timeline(
        fecha_ingreso: date,
        records: list,
        desde: date = None,
        hasta: date = None
    ) -> dict:
        """
        Construye la línea cronológica unificada del Kárdex de Vacaciones:
        - Cada aniversario cumplido agrega los días ganados en su FECHA EXACTA de aniversario.
        - Cada registro de vacación descuenta los días en su fecha de goce o liquidación.
        - Filtra según el rango [desde, hasta]. Si hay eventos previos a 'desde',
          se consolidan en una Fila 0 de Apertura con el saldo acumulado anterior.
        """
        today = date.today()
        cutoff_date = hasta if hasta else today
        start_date = desde if desde else fecha_ingreso

        # 1. Generar eventos de acreditación anual (aniversarios cumplidos) hasta cutoff_date
        anniv_events = []
        max_years = max(0, cutoff_date.year - fecha_ingreso.year + 1)
        for y in range(1, max_years + 1):
            anniv_date = VacationService.get_anniversary_date(fecha_ingreso, fecha_ingreso.year + y)
            if anniv_date <= cutoff_date:
                scale_days = VacationService.get_days_for_year(y)
                anniv_events.append({
                    "id": f"anniv-{y}",
                    "fecha": anniv_date,
                    "fecha_fin": anniv_date,
                    "periodo_formato": anniv_date.strftime("%d/%m/%Y"),
                    "tipo": "derecho_anual",
                    "tipo_label": "Derecho Anual",
                    "dias_ganados": float(scale_days),
                    "dias_tomados": 0.0,
                    "motivo": f"{y}° Año de antigüedad cumplido (+{scale_days} d/año)",
                    "fecha_solicitud": None,
                    "priority": 0,
                    "is_record": False,
                    "is_anniversary": True
                })

        # 2. Agregar registros de vacaciones tomadas / pagadas
        rec_events = []
        for r in records:
            if isinstance(r, dict):
                r_id = r.get("id")
                r_tipo = r.get("tipo", "")
                r_ini = r.get("fecha_inicio")
                r_fin = r.get("fecha_fin")
                r_dias = float(r.get("dias", 0.0))
                r_motivo = r.get("motivo", "")
                r_sol = r.get("fecha_solicitud")
                r_created = r.get("created_at")
            else:
                r_id = getattr(r, "id", None)
                r_tipo = getattr(r, "tipo", "")
                r_ini = getattr(r, "fecha_inicio", None)
                r_fin = getattr(r, "fecha_fin", None)
                r_dias = float(getattr(r, "dias", 0.0))
                r_motivo = getattr(r, "motivo", "")
                r_sol = getattr(r, "fecha_solicitud", None)
                r_created = getattr(r, "created_at", None)

            if isinstance(r_ini, str):
                r_ini = date.fromisoformat(r_ini[:10])
            if isinstance(r_fin, str):
                r_fin = date.fromisoformat(r_fin[:10])
            if isinstance(r_sol, str) and r_sol:
                try:
                    r_sol = date.fromisoformat(r_sol[:10])
                except Exception:
                    r_sol = None

            tipo_label = {
                "dias_pagados": "Días Pagados",
                "a_cuenta": "Días Pagados",
                "colectiva": "Colectiva",
                "solicitada": "Solicitada"
            }.get(r_tipo, r_tipo)

            if isinstance(r, dict):
                r_fechas = r.get("fechas_detalle")
            else:
                r_fechas = getattr(r, "fechas_detalle", None)
            if isinstance(r_fechas, str):
                try:
                    r_fechas = json.loads(r_fechas)
                except Exception:
                    r_fechas = []
            elif not isinstance(r_fechas, list):
                r_fechas = []

            if r_ini and r_fin:
                if r_ini == r_fin:
                    p_fmt = r_ini.strftime("%d/%m/%Y")
                elif r_ini.year == r_fin.year and r_ini.month == r_fin.month:
                    p_fmt = f"{VacationService.MESES_ES[r_ini.month]} {r_ini.year}"
                elif r_ini.year == r_fin.year:
                    p_fmt = f"{VacationService.MESES_ES[r_ini.month]} a {VacationService.MESES_ES[r_fin.month]} {r_ini.year}"
                else:
                    p_fmt = f"{VacationService.MESES_ES[r_ini.month]} {r_ini.year} a {VacationService.MESES_ES[r_fin.month]} {r_fin.year}"
            elif r_ini:
                p_fmt = r_ini.strftime("%d/%m/%Y")
            else:
                p_fmt = "-"

            rec_events.append({
                "id": r_id,
                "fecha": r_ini,
                "fecha_fin": r_fin,
                "periodo_formato": p_fmt,
                "tipo": r_tipo,
                "tipo_label": tipo_label,
                "dias_ganados": 0.0,
                "dias_tomados": r_dias,
                "motivo": r_motivo,
                "fecha_solicitud": r_sol,
                "fechas_detalle": r_fechas,
                "created_at": r_created,
                "priority": 1,
                "is_record": True,
                "is_anniversary": False
            })

        # 3. Separar eventos previos a start_date (para consolidación en apertura / saldo anterior)
        anniv_pre = [e for e in anniv_events if e["fecha"] < start_date]
        anniv_in_range = [e for e in anniv_events if start_date <= e["fecha"] <= cutoff_date]

        recs_pre = [e for e in rec_events if e["fecha"] < start_date]
        recs_in_range = [e for e in rec_events if start_date <= e["fecha"] <= cutoff_date]

        ganados_pre = sum(e["dias_ganados"] for e in anniv_pre)
        tomados_pre = sum(e["dias_tomados"] for e in recs_pre)
        saldo_pre = round(ganados_pre - tomados_pre, 1)

        apertura = None
        if anniv_pre or recs_pre:
            apertura = {
                "fecha": start_date,
                "periodo_formato": f"Previo al {start_date.strftime('%d/%m/%Y')}",
                "tipo": "saldo_anterior",
                "tipo_label": "Saldo Anterior",
                "dias_ganados": ganados_pre,
                "dias_tomados": tomados_pre,
                "saldo_restante": saldo_pre,
                "motivo": f"Saldo acumulado al inicio del periodo ({start_date.strftime('%d/%m/%Y')})",
                "fecha_solicitud": None,
                "is_apertura": True
            }
        else:
            apertura = {
                "fecha": fecha_ingreso,
                "periodo_formato": fecha_ingreso.strftime("%d/%m/%Y"),
                "tipo": "ingreso",
                "tipo_label": "Ingreso a la Empresa",
                "dias_ganados": 0.0,
                "dias_tomados": 0.0,
                "saldo_restante": 0.0,
                "motivo": "Inicio de relación laboral",
                "fecha_solicitud": None,
                "is_apertura": True
            }

        # 4. ORDEN CRONOLÓGICO Y NATURAL SEGÚN LOS DATOS:
        # Los movimientos del periodo se ordenan cronológicamente por su fecha real de ocurrencia.
        # Si coinciden en la misma fecha: primero se acreditan derechos anuales ganados (prioridad 0),
        # luego vacaciones solicitadas (prioridad 1), luego compensaciones/liquidaciones.
        all_period_events = []
        all_period_events.extend(anniv_in_range)
        all_period_events.extend(recs_in_range)

        def _sort_kardex_event(x):
            f = x["fecha"]
            is_anniv = 0 if (x.get("tipo") == "derecho_anual" or x.get("is_anniversary")) else 1
            sol_f = str(x.get("fecha_solicitud") or "")
            rec_id = x.get("id") or 0
            return (f, is_anniv, sol_f, rec_id)

        ordered_timeline = sorted(all_period_events, key=_sort_kardex_event)

        # 5. Cómputo del saldo progresivo paso a paso
        running_balance = apertura["saldo_restante"]
        for ev in ordered_timeline:
            if ev.get("is_anniversary") or ev.get("tipo") == "derecho_anual":
                running_balance = round(running_balance + ev["dias_ganados"], 1)
            else:
                running_balance = round(running_balance - ev["dias_tomados"], 1)
            ev["saldo_restante"] = running_balance

        # Totales del periodo evaluado [start_date, cutoff_date]
        ganados_periodo = round(sum(e["dias_ganados"] for e in anniv_in_range), 1)
        tomados_periodo = round(sum(e["dias_tomados"] for e in recs_in_range), 1)
        total_computable_periodo = round(saldo_pre + ganados_periodo, 1)
        saldo_final_periodo = round(total_computable_periodo - tomados_periodo, 1)

        # Totales acumulados históricos hasta cutoff_date
        tot_ganados = sum(e["dias_ganados"] for e in anniv_events if e["fecha"] <= cutoff_date)
        tot_tomados = sum(e["dias_tomados"] for e in rec_events if e["fecha"] <= cutoff_date)
        saldo_final = round(tot_ganados - tot_tomados, 1)

        return {
            "apertura": apertura,
            "timeline": ordered_timeline,
            "has_saldo_anterior": bool(anniv_pre or recs_pre),
            "ganados_pre": ganados_pre,
            "tomados_pre": tomados_pre,
            "saldo_pre": saldo_pre,
            "ganados_periodo": ganados_periodo,
            "tomados_periodo": tomados_periodo,
            "total_computable_periodo": total_computable_periodo,
            "saldo_final_periodo": saldo_final_periodo,
            "total_dias_acumulados": tot_ganados,
            "total_dias_tomados": tot_tomados,
            "saldo_dias_pendientes": saldo_final
        }

    MESES_ES = [
        "", "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
        "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
    ]

    DIAS_SEMANA_ES = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"]

    @staticmethod
    def expand_record_dates(fecha_inicio: date, fecha_fin: date, dias: float, fechas_detalle: list = None) -> list:
        """
        Devuelve la lista ordenada de fechas exactas (objetos date) que componen la vacación.
        Si fechas_detalle ya contiene fechas, las utiliza directamente.
        De lo contrario, genera las fechas hábiles entre fecha_inicio y fecha_fin hasta completar 'dias'.
        """
        if fechas_detalle and isinstance(fechas_detalle, list) and len(fechas_detalle) > 0:
            parsed = []
            for f in fechas_detalle:
                if isinstance(f, str):
                    try:
                        parsed.append(date.fromisoformat(f[:10]))
                    except Exception:
                        pass
                elif isinstance(f, date):
                    parsed.append(f)
            if parsed:
                return sorted(parsed)

        if not fecha_inicio:
            return []
        if not fecha_fin or fecha_fin < fecha_inicio:
            fecha_fin = fecha_inicio

        from datetime import timedelta
        cur = fecha_inicio
        result = []
        needed = int(round(dias)) if dias > 0 else 1

        while cur <= fecha_fin and len(result) < needed:
            if cur.weekday() < 5:  # Lunes a Viernes
                result.append(cur)
            cur += timedelta(days=1)

        if len(result) < needed:
            cur = fecha_inicio
            while cur <= fecha_fin and len(result) < needed:
                if cur.weekday() == 5 and cur not in result:  # Sábado
                    result.append(cur)
                cur += timedelta(days=1)
            result.sort()

        if not result and fecha_inicio:
            result = [fecha_inicio]

        return result

    @staticmethod
    def build_kardex_detailed_by_month(
        fecha_ingreso: date,
        records: list,
        desde: date = None,
        hasta: date = None
    ) -> dict:
        """
        Construye el Kárdex Detallado de Vacaciones desglosado por mes y días en específico:
        - Mantiene total concordancia con el saldo acumulado y la apertura del Kárdex general.
        - Detalla explícitamente el mes ('el mes tanto') y los días exactos computados ('con estos días en específico').
        - Si un movimiento abarca más de un mes calendario, se desglosa en filas por mes con sus días exactos.
        - Las acreditaciones de aniversario se detallan en su fecha exacta con su ganancia de días.
        - Los días pagados (compensaciones económicas) se detallan con su mes y número de días.
        """
        kardex_gen = VacationService.build_kardex_timeline(fecha_ingreso, records, desde, hasta)
        apertura = kardex_gen["apertura"]
        start_date = desde if desde else fecha_ingreso
        cutoff_date = hasta if hasta else date.today()

        gen_timeline = kardex_gen["timeline"]
        detailed_events = []

        for ev in gen_timeline:
            is_anniv = ev.get("is_anniversary") or ev.get("tipo") == "derecho_anual"
            tipo_raw = ev.get("tipo", "")

            if is_anniv:
                f_ev = ev["fecha"]
                m_key = f"{f_ev.year:04d}-{f_ev.month:02d}"
                m_label = f"{VacationService.MESES_ES[f_ev.month]} {f_ev.year}"
                f_str = f_ev.strftime("%d/%m/%Y")
                dia_sem = VacationService.DIAS_SEMANA_ES[f_ev.weekday()]
                esp_str = f"• {dia_sem} {f_ev.strftime('%d/%m/%Y')} (Vacación Devengada)"

                detailed_events.append({
                    "id": ev["id"],
                    "record_id": None,
                    "mes_key": m_key,
                    "mes_label": m_label,
                    "fecha": f_ev,
                    "fecha_fin": f_ev,
                    "tipo": "derecho_anual",
                    "tipo_label": "Derecho Anual",
                    "dias_ganados": ev["dias_ganados"],
                    "dias_tomados": 0.0,
                    "motivo": ev["motivo"],
                    "fecha_solicitud": None,
                    "dias_especificos": [f_str],
                    "dias_especificos_formato": esp_str,
                    "priority": 0,
                    "is_anniversary": True,
                    "is_record": False
                })

            elif tipo_raw in ("dias_pagados", "a_cuenta"):
                f_ev = ev.get("fecha") or start_date
                m_key = f"{f_ev.year:04d}-{f_ev.month:02d}"
                m_label = f"{VacationService.MESES_ES[f_ev.month]} {f_ev.year}"
                esp_str = "No aplica (Días pagados / compensación económica en dinero)"

                detailed_events.append({
                    "id": ev["id"],
                    "record_id": ev.get("id"),
                    "mes_key": m_key,
                    "mes_label": m_label,
                    "fecha": f_ev,
                    "fecha_fin": f_ev,
                    "tipo": "dias_pagados",
                    "tipo_label": "Días Pagados",
                    "dias_ganados": 0.0,
                    "dias_tomados": ev["dias_tomados"],
                    "motivo": ev["motivo"],
                    "fecha_solicitud": ev.get("fecha_solicitud"),
                    "dias_especificos": [],
                    "dias_especificos_formato": esp_str,
                    "priority": 1,
                    "is_anniversary": False,
                    "is_record": True
                })

            else:
                # Vacación con días calendario (solicitada o colectiva)
                f_ini = ev.get("fecha")
                f_fin = ev.get("fecha_fin") or f_ini
                dias_tot = ev.get("dias_tomados", 0.0)
                f_det = ev.get("fechas_detalle", [])

                all_dates = VacationService.expand_record_dates(f_ini, f_fin, dias_tot, f_det)
                # Filtrar al rango [start_date, cutoff_date]
                range_dates = [d for d in all_dates if start_date <= d <= cutoff_date]
                if not range_dates:
                    range_dates = all_dates

                # Agrupar por mes (año, mes)
                by_m = {}
                for d in range_dates:
                    k = (d.year, d.month)
                    by_m.setdefault(k, []).append(d)

                for (y, m), m_dates in sorted(by_m.items()):
                    m_key = f"{y:04d}-{m:02d}"
                    m_label = f"{VacationService.MESES_ES[m]} {y}"
                    dias_count = float(len(m_dates))
                    dias_strs = [d.strftime("%d/%m/%Y") for d in m_dates]

                    # Formateo detallado explícito con viñetas de cada día específico del mes (sin total redundante)
                    chips_preview = [f"• {VacationService.DIAS_SEMANA_ES[d.weekday()]} {d.strftime('%d/%m/%Y')}" for d in m_dates]
                    if chips_preview:
                        esp_str = "\n".join(chips_preview)
                    else:
                        esp_str = "Sin desglose de fechas específicas"

                    detailed_events.append({
                        "id": f"{ev['id']}-{m_key}",
                        "record_id": ev.get("id"),
                        "mes_key": m_key,
                        "mes_label": m_label,
                        "fecha": m_dates[0],
                        "fecha_fin": m_dates[-1],
                        "tipo": tipo_raw,
                        "tipo_label": ev.get("tipo_label", tipo_raw.capitalize()),
                        "dias_ganados": 0.0,
                        "dias_tomados": dias_count,
                        "motivo": ev["motivo"],
                        "fecha_solicitud": ev.get("fecha_solicitud"),
                        "dias_especificos": dias_strs,
                        "dias_especificos_formato": esp_str,
                        "priority": 1,
                        "is_anniversary": False,
                        "is_record": True
                    })

        # Cómputo del saldo progresivo paso a paso
        running_bal = apertura["saldo_restante"]
        for dev in detailed_events:
            running_bal = round(running_bal + dev["dias_ganados"] - dev["dias_tomados"], 1)
            dev["saldo_restante"] = running_bal

        # Resumen consolidado mes a mes
        monthly_map = {}
        for dev in detailed_events:
            mk = dev["mes_key"]
            if mk not in monthly_map:
                monthly_map[mk] = {
                    "mes_key": mk,
                    "mes_label": dev["mes_label"],
                    "dias_ganados": 0.0,
                    "dias_tomados": 0.0,
                    "dias_especificos": [],
                    "movimientos": [],
                    "saldo_cierre": 0.0
                }
            monthly_map[mk]["dias_ganados"] = round(monthly_map[mk]["dias_ganados"] + dev["dias_ganados"], 1)
            monthly_map[mk]["dias_tomados"] = round(monthly_map[mk]["dias_tomados"] + dev["dias_tomados"], 1)
            monthly_map[mk]["dias_especificos"].extend(dev["dias_especificos"])
            monthly_map[mk]["saldo_cierre"] = dev["saldo_restante"]
            monthly_map[mk]["movimientos"].append(dev)

        resumen_mensual = list(monthly_map.values())

        return {
            "apertura": apertura,
            "timeline": detailed_events,
            "resumen_mensual": resumen_mensual,
            "has_saldo_anterior": kardex_gen["has_saldo_anterior"],
            "ganados_pre": kardex_gen["ganados_pre"],
            "tomados_pre": kardex_gen["tomados_pre"],
            "saldo_pre": kardex_gen["saldo_pre"],
            "ganados_periodo": kardex_gen["ganados_periodo"],
            "tomados_periodo": kardex_gen["tomados_periodo"],
            "total_computable_periodo": kardex_gen["total_computable_periodo"],
            "saldo_final_periodo": kardex_gen["saldo_final_periodo"],
            "total_dias_acumulados": kardex_gen["total_dias_acumulados"],
            "total_dias_tomados": kardex_gen["total_dias_tomados"],
            "saldo_dias_pendientes": kardex_gen["saldo_dias_pendientes"]
        }
