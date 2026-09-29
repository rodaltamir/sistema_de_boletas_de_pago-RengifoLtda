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
