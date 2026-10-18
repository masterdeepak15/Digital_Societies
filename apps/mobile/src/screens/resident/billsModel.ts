export type BillStatus = 'pending' | 'paid' | 'overdue' | 'waived' | 'cancelled';

export interface ApiBill {
  id: string;
  period: string;      // "YYYY-MM"
  amount: number;
  lateFee?: number;
  totalDue?: number;
  status?: string;
  dueDate: string;     // "YYYY-MM-DD"
}

export interface BillRow {
  id: string;
  period: string;      // "Feb 2027"
  due: string;         // "7 Nov 2026"
  amount: number;
  status: BillStatus;
  sortKey: string;     // the raw "YYYY-MM"
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const STATUSES: BillStatus[] = ['pending', 'paid', 'overdue', 'waived', 'cancelled'];

function formatPeriod(p: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(p);
  return m && Number(m[2]) >= 1 && Number(m[2]) <= 12 ? `${MONTHS[Number(m[2]) - 1]} ${m[1]}` : p;
}

function formatDate(d: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d);
  return m ? `${Number(m[3])} ${MONTHS[Number(m[2]) - 1]} ${m[1]}` : d;
}

export function toBillRow(b: ApiBill): BillRow {
  const status = (b.status ?? '').toLowerCase() as BillStatus;
  return {
    id: b.id,
    period: formatPeriod(b.period),
    due: formatDate(b.dueDate),
    amount: b.totalDue ?? b.amount,
    status: STATUSES.includes(status) ? status : 'pending',
    sortKey: b.period,
  };
}

/** Unpaid bills first (they need action), each group newest period first. */
export function sortBills(rows: BillRow[]): BillRow[] {
  const unpaid = (r: BillRow) => r.status === 'pending' || r.status === 'overdue';
  return [...rows].sort((a, b) => Number(unpaid(b)) - Number(unpaid(a)) || b.sortKey.localeCompare(a.sortKey));
}
