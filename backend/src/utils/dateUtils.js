/**
 * Centralized Date Utilities
 *
 * Business day: 6:00 AM local → 5:59:59 AM the next calendar day.
 */

class DateUtils {
  getStartHour() {
    return 6;
  }

  _toDate(dateInput = new Date()) {
    if (dateInput instanceof Date) return new Date(dateInput.getTime());
    if (typeof dateInput === 'number') return new Date(dateInput);
    const raw = String(dateInput || '').trim();
    if (!raw) return new Date();
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
      const [y, m, d] = raw.split('-').map(Number);
      return new Date(y, m - 1, d, 12, 0, 0, 0);
    }
    const parsed = new Date(raw);
    return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
  }

  formatLocalDate(date) {
    const d = this._toDate(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /**
   * Business date for a timestamp. Before 6:00 AM local → previous calendar day.
   */
  getBusinessDate(dateInput = new Date(), startHour = this.getStartHour()) {
    const d = this._toDate(dateInput);
    if (d.getHours() < startHour) {
      d.setDate(d.getDate() - 1);
    }
    return this.formatLocalDate(d);
  }

  getYesterdayBusinessDate() {
    const today = this.getBusinessDate();
    return this.addBusinessDays(today, -1);
  }

  addBusinessDays(businessDateStr, deltaDays) {
    const [y, m, d] = String(businessDateStr).split('-').map(Number);
    const dt = new Date(y, m - 1, d, 12, 0, 0, 0);
    dt.setDate(dt.getDate() + Number(deltaDays || 0));
    return this.formatLocalDate(dt);
  }

  getBusinessMonthStart(dateInput = new Date()) {
    const today = this.getBusinessDate(dateInput);
    return `${today.slice(0, 8)}01`;
  }

  /**
   * Sunday of the current business week, as a business date.
   */
  getBusinessWeekStart(dateInput = new Date()) {
    const today = this.getBusinessDate(dateInput);
    const [y, m, d] = today.split('-').map(Number);
    const dt = new Date(y, m - 1, d, 12, 0, 0, 0);
    dt.setDate(dt.getDate() - dt.getDay());
    return this.formatLocalDate(dt);
  }

  getBusinessDayBounds(dateInput = new Date(), startHour = this.getStartHour()) {
    const now = this._toDate(dateInput);
    const start = new Date(now);
    start.setHours(startHour, 0, 0, 0);
    if (now < start) start.setDate(start.getDate() - 1);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    return { start, end };
  }

  getBusinessDayLabel(dateInput = new Date()) {
    const { start, end } = this.getBusinessDayBounds(dateInput);
    const endDisplay = new Date(end.getTime() - 1000);
    const fmt = (d) => d.toLocaleString(undefined, {
      day: 'numeric', month: 'short', year: 'numeric',
      hour: 'numeric', minute: '2-digit'
    });
    return `${fmt(start)} → ${fmt(endDisplay)}`;
  }

  /**
   * Resolve Reports / History date filters onto business_date strings.
   */
  resolveReportRange(filters = {}) {
    const today = this.getBusinessDate();
    const dateFilter = String(filters.dateFilter || filters.date_preset || '').trim();
    const customFrom = filters.startDate || filters.date_from || '';
    const customTo = filters.endDate || filters.date_to || '';

    if (dateFilter === 'Yesterday') {
      const y = this.getYesterdayBusinessDate();
      return { startDate: y, endDate: y };
    }
    if (dateFilter === 'This Week') {
      return { startDate: this.getBusinessWeekStart(), endDate: today };
    }
    if (dateFilter === 'This Month' || dateFilter === 'Monthly') {
      return { startDate: this.getBusinessMonthStart(), endDate: today };
    }
    if (dateFilter === 'All Time') {
      return { startDate: '1970-01-01', endDate: '2099-12-31' };
    }
    if ((dateFilter === 'Custom Date' || dateFilter === 'Custom Range' || dateFilter === 'CUSTOM_DATE') && customFrom) {
      return { startDate: customFrom, endDate: customTo || customFrom };
    }
    if (!dateFilter || dateFilter === 'Today' || dateFilter === 'TODAY') {
      return { startDate: today, endDate: today };
    }
    if (customFrom) {
      return { startDate: customFrom, endDate: customTo || customFrom };
    }
    return { startDate: today, endDate: today };
  }
}

export const dateUtils = new DateUtils();
