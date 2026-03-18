export function fmtDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function fmtMoney(amount: number): string {
  return `฿${amount.toLocaleString()}`
}

export function calcNights(checkin: string, checkout: string): number {
  const a = new Date(checkin + 'T00:00:00')
  const b = new Date(checkout + 'T00:00:00')
  return Math.max(0, Math.round((b.getTime() - a.getTime()) / 86400000))
}

export function isStayingOn(booking: { checkin: string; checkout: string; status: string }, date: string): boolean {
  const d = new Date(date + 'T00:00:00')
  const ci = new Date(booking.checkin + 'T00:00:00')
  const co = new Date(booking.checkout + 'T00:00:00')
  const activeStatuses = ['Occupied', 'Check-in', 'Checkout']
  return ci <= d && co > d && activeStatuses.includes(booking.status)
}

export function today(): string {
  return new Date().toISOString().slice(0, 10)
}
