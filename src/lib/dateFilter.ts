export type DateFilterPeriod = 'TODAY' | 'WEEK' | 'MONTH' | 'CUSTOM' | 'ALL';

export interface DateFilterOption {
  key: DateFilterPeriod;
  label: string;
}

export const DATE_FILTER_OPTIONS: DateFilterOption[] = [
  { key: 'TODAY', label: 'Hoy' },
  { key: 'WEEK', label: 'Esta Semana' },
  { key: 'MONTH', label: 'Este Mes' },
  { key: 'CUSTOM', label: 'Fecha Específica' },
  { key: 'ALL', label: 'Histórico' }
];

export function getDateFilterPeriodLabel(period: DateFilterPeriod): string {
  switch (period) {
    case 'TODAY':
      return 'Hoy';
    case 'WEEK':
      return 'Esta Semana';
    case 'MONTH':
      return 'Este Mes';
    case 'CUSTOM':
      return 'Fecha Específica';
    case 'ALL':
      return 'Histórico';
    default:
      return 'Hoy';
  }
}

/**
 * Checks if a given ISO date string or Date object falls within the selected period filter.
 */
export function matchesDateFilter(
  dateValue: string | Date | undefined | null,
  period: DateFilterPeriod,
  customDateStr?: string
): boolean {
  if (period === 'ALL') {
    return true;
  }

  if (!dateValue) {
    return false;
  }

  const targetDate = typeof dateValue === 'string' ? new Date(dateValue) : dateValue;
  if (isNaN(targetDate.getTime())) {
    return false;
  }

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

  if (period === 'TODAY') {
    return targetDate >= startOfToday && targetDate <= endOfToday;
  }

  if (period === 'WEEK') {
    const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6, 0, 0, 0, 0);
    return targetDate >= startOfWeek && targetDate <= endOfToday;
  }

  if (period === 'MONTH') {
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    return targetDate >= startOfMonth && targetDate <= endOfMonth;
  }

  if (period === 'CUSTOM') {
    if (!customDateStr) {
      return targetDate >= startOfToday && targetDate <= endOfToday;
    }
    // customDateStr is expected in 'YYYY-MM-DD'
    const parts = customDateStr.split('-').map(Number);
    if (parts.length !== 3 || parts.some(isNaN)) {
      return false;
    }
    const [cYear, cMonth, cDay] = parts;
    const startOfCustom = new Date(cYear, cMonth - 1, cDay, 0, 0, 0, 0);
    const endOfCustom = new Date(cYear, cMonth - 1, cDay, 23, 59, 59, 999);
    return targetDate >= startOfCustom && targetDate <= endOfCustom;
  }

  return true;
}
