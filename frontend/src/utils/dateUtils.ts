/**
 * Frontend Date Utilities — matches backend 6:00 AM → 5:59 AM business day.
 */

export class DateUtils {
  static getStartHour(): number {
    return 6
  }

  private static toDate(dateInput: Date | string | number = new Date()): Date {
    if (dateInput instanceof Date) return new Date(dateInput.getTime())
    if (typeof dateInput === 'number') return new Date(dateInput)
    const raw = String(dateInput || '').trim()
    if (!raw) return new Date()
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
      const [y, m, d] = raw.split('-').map(Number)
      return new Date(y, m - 1, d, 12, 0, 0, 0)
    }
    const parsed = new Date(raw)
    return Number.isNaN(parsed.getTime()) ? new Date() : parsed
  }

  static formatLocalDate(date: Date): string {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  static getBusinessDate(dateInput: Date | string | number = new Date(), startHour: number = DateUtils.getStartHour()): string {
    const d = DateUtils.toDate(dateInput)
    if (d.getHours() < startHour) {
      d.setDate(d.getDate() - 1)
    }
    return DateUtils.formatLocalDate(d)
  }

  static addBusinessDays(businessDateStr: string, deltaDays: number): string {
    const [y, m, d] = String(businessDateStr).split('-').map(Number)
    const dt = new Date(y, m - 1, d, 12, 0, 0, 0)
    dt.setDate(dt.getDate() + Number(deltaDays || 0))
    return DateUtils.formatLocalDate(dt)
  }

  static getYesterdayBusinessDate(): string {
    return DateUtils.addBusinessDays(DateUtils.getBusinessDate(), -1)
  }

  static getBusinessMonthStart(dateInput: Date | string | number = new Date()): string {
    const today = DateUtils.getBusinessDate(dateInput)
    return `${today.slice(0, 8)}01`
  }

  static getBusinessWeekStart(dateInput: Date | string | number = new Date()): string {
    const today = DateUtils.getBusinessDate(dateInput)
    const [y, m, d] = today.split('-').map(Number)
    const dt = new Date(y, m - 1, d, 12, 0, 0, 0)
    dt.setDate(dt.getDate() - dt.getDay())
    return DateUtils.formatLocalDate(dt)
  }

  static getBusinessDayBounds(dateInput: Date | string | number = new Date()) {
    const now = DateUtils.toDate(dateInput)
    const start = new Date(now)
    start.setHours(DateUtils.getStartHour(), 0, 0, 0)
    if (now < start) start.setDate(start.getDate() - 1)
    const end = new Date(start)
    end.setDate(end.getDate() + 1)
    return { start, end }
  }

  static getBusinessDayLabel(dateInput: Date | string | number = new Date()): string {
    const { start, end } = DateUtils.getBusinessDayBounds(dateInput)
    const endDisplay = new Date(end.getTime() - 1000)
    const fmt = (d: Date) => d.toLocaleString(undefined, {
      day: 'numeric', month: 'short', year: 'numeric',
      hour: 'numeric', minute: '2-digit'
    })
    return `${fmt(start)} → ${fmt(endDisplay)}`
  }

  static resolveReportRange(opts: {
    timeRange?: string
    customDateFrom?: string
    customDateTo?: string
  }): { startDate: string; endDate: string } {
    const today = DateUtils.getBusinessDate()
    const timeRange = String(opts.timeRange || 'Today')
    if (timeRange === 'Yesterday') {
      const y = DateUtils.getYesterdayBusinessDate()
      return { startDate: y, endDate: y }
    }
    if (timeRange === 'This Week') {
      return { startDate: DateUtils.getBusinessWeekStart(), endDate: today }
    }
    if (timeRange === 'This Month' || timeRange === 'Monthly') {
      return { startDate: DateUtils.getBusinessMonthStart(), endDate: today }
    }
    if (timeRange === 'All Time') {
      return { startDate: '1970-01-01', endDate: '2099-12-31' }
    }
    if (timeRange === 'Custom Date') {
      const d = opts.customDateFrom || today
      return { startDate: d, endDate: d }
    }
    if (timeRange === 'Custom Range') {
      return { startDate: opts.customDateFrom || today, endDate: opts.customDateTo || opts.customDateFrom || today }
    }
    return { startDate: today, endDate: today }
  }
}
