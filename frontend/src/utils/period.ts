export interface ActivePeriod {
  month: number;
  year: number;
}

/**
 * Retrieve the active month and year from localStorage.
 * Checks tenant-specific key first, then global active_month/active_year,
 * with fallback to current date.
 */
export function getStoredPeriod(tenant?: string | null): ActivePeriod {
  const now = new Date();
  const defaultMonth = now.getMonth() + 1;
  const defaultYear = now.getFullYear();

  if (typeof window === "undefined") {
    return { month: defaultMonth, year: defaultYear };
  }

  try {
    const tenantMonthKey = tenant ? `active_month_${tenant}` : null;
    const tenantYearKey = tenant ? `active_year_${tenant}` : null;

    const savedMonth = (tenantMonthKey && localStorage.getItem(tenantMonthKey)) || localStorage.getItem("active_month");
    const savedYear = (tenantYearKey && localStorage.getItem(tenantYearKey)) || localStorage.getItem("active_year");

    const m = savedMonth ? parseInt(savedMonth, 10) : defaultMonth;
    const y = savedYear ? parseInt(savedYear, 10) : defaultYear;

    return {
      month: isNaN(m) || m < 1 || m > 12 ? defaultMonth : m,
      year: isNaN(y) || y < 2000 || y > 2100 ? defaultYear : y
    };
  } catch (e) {
    return { month: defaultMonth, year: defaultYear };
  }
}

/**
 * Persist the active month and year to localStorage
 * so any navigation between pages (Planillas, Asientos, Boletas) remembers it.
 */
export function setStoredPeriod(month: number, year: number, tenant?: string | null): void {
  if (typeof window === "undefined") return;

  try {
    if (tenant) {
      localStorage.setItem(`active_month_${tenant}`, String(month));
      localStorage.setItem(`active_year_${tenant}`, String(year));
    }
    localStorage.setItem("active_month", String(month));
    localStorage.setItem("active_year", String(year));
  } catch (e) {
    console.error("Error saving active period to localStorage", e);
  }
}

export interface VacationsPeriod {
  desde: string;
  hasta: string;
}

/**
 * Retrieve the stored vacations date range from localStorage.
 * Checks tenant-specific key first, then global,
 * with fallback to current year (YYYY-01-01 to YYYY-12-31).
 */
export function getStoredVacationsPeriod(tenant?: string | null): VacationsPeriod {
  const currentYear = new Date().getFullYear();
  const defaultDesde = `${currentYear}-01-01`;
  const defaultHasta = `${currentYear}-12-31`;

  if (typeof window === "undefined") {
    return { desde: defaultDesde, hasta: defaultHasta };
  }

  try {
    const tenantDesdeKey = tenant ? `vacaciones_desde_${tenant}` : null;
    const tenantHastaKey = tenant ? `vacaciones_hasta_${tenant}` : null;

    const savedDesde = (tenantDesdeKey && localStorage.getItem(tenantDesdeKey)) || localStorage.getItem("vacaciones_desde");
    const savedHasta = (tenantHastaKey && localStorage.getItem(tenantHastaKey)) || localStorage.getItem("vacaciones_hasta");

    return {
      desde: savedDesde && savedDesde.length >= 10 ? savedDesde : defaultDesde,
      hasta: savedHasta && savedHasta.length >= 10 ? savedHasta : defaultHasta
    };
  } catch (e) {
    return { desde: defaultDesde, hasta: defaultHasta };
  }
}

/**
 * Persist the vacations date range to localStorage
 * so navigation between modules or page refreshes remembers it.
 */
export function setStoredVacationsPeriod(desde: string, hasta: string, tenant?: string | null): void {
  if (typeof window === "undefined") return;

  try {
    if (tenant) {
      localStorage.setItem(`vacaciones_desde_${tenant}`, desde);
      localStorage.setItem(`vacaciones_hasta_${tenant}`, hasta);
    }
    localStorage.setItem("vacaciones_desde", desde);
    localStorage.setItem("vacaciones_hasta", hasta);
  } catch (e) {
    console.error("Error saving vacations period to localStorage", e);
  }
}

/**
 * Retrieve the stored vacations modal date range from localStorage.
 */
export function getStoredVacationsModalPeriod(tenant?: string | null): VacationsPeriod | null {
  if (typeof window === "undefined") return null;

  try {
    const tenantDesdeKey = tenant ? `vacaciones_modal_desde_${tenant}` : null;
    const tenantHastaKey = tenant ? `vacaciones_modal_hasta_${tenant}` : null;

    const savedDesde = (tenantDesdeKey && localStorage.getItem(tenantDesdeKey)) || localStorage.getItem("vacaciones_modal_desde");
    const savedHasta = (tenantHastaKey && localStorage.getItem(tenantHastaKey)) || localStorage.getItem("vacaciones_modal_hasta");

    if (savedDesde && savedHasta && savedDesde.length >= 10 && savedHasta.length >= 10) {
      return { desde: savedDesde, hasta: savedHasta };
    }
    return null;
  } catch (e) {
    return null;
  }
}

/**
 * Persist the vacations modal date range to localStorage.
 */
export function setStoredVacationsModalPeriod(desde: string, hasta: string, tenant?: string | null): void {
  if (typeof window === "undefined") return;

  try {
    if (tenant) {
      localStorage.setItem(`vacaciones_modal_desde_${tenant}`, desde);
      localStorage.setItem(`vacaciones_modal_hasta_${tenant}`, hasta);
    }
    localStorage.setItem("vacaciones_modal_desde", desde);
    localStorage.setItem("vacaciones_modal_hasta", hasta);
  } catch (e) {
    console.error("Error saving vacations modal period to localStorage", e);
  }
}
