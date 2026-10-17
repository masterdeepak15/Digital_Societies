export function greetingFor(date: Date): 'Good morning' | 'Good afternoon' | 'Good evening' {
  const h = date.getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export interface BillLike { totalDue?: number; amount?: number; status: string; dueDate?: string }
export interface DueSummary { amount: number; dueDate: string; overdueDays: number }

const SETTLED = new Set(['paid', 'waived']);
const DAY_MS = 24 * 60 * 60 * 1000;

function dayNumber(isoDate: string): number {
  const [y, m, d] = isoDate.slice(0, 10).split('-').map(Number);
  return Date.UTC(y, m - 1, d) / DAY_MS;
}

/** The bill the resident should pay next: the earliest-due unpaid one. */
export function summariseBills(items: BillLike[], now: Date): { due: DueSummary | null } {
  const unpaid = items.filter((b) => !SETTLED.has(b.status.toLowerCase()));
  if (unpaid.length === 0) return { due: null };

  const dated = unpaid.filter((b) => !!b.dueDate).sort((a, b) => dayNumber(a.dueDate!) - dayNumber(b.dueDate!));
  const pick = dated[0] ?? unpaid[0];
  const dueDate = pick.dueDate ?? '';
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / DAY_MS;
  const overdueDays = dueDate ? Math.max(0, Math.floor(today - dayNumber(dueDate))) : 0;
  return { due: { amount: pick.totalDue ?? pick.amount ?? 0, dueDate, overdueDays } };
}

export interface VisitorLike { name?: string; visitorName?: string; purpose?: string }

export function visitorLabel(v: VisitorLike): string {
  const name = v.name ?? v.visitorName;
  if (!name) return 'A visitor';
  return v.purpose ? `${name} · ${v.purpose}` : name;
}
