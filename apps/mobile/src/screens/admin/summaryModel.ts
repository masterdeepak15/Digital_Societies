/** The billing summary as the admin dashboard reads it (paise, flat labels). */
export interface BillSummary {
  paidCount: number;
  pendingCount: number;
  overdueCount: number;
  totalFlats: number;
  totalDuePaise: number;
  collectedPaise: number;
  collectionPercentage: number;
  defaulters: Array<{ flatId: string; flatDisplay: string; ownerName: string; amountDuePaise: number }>;
}

const n = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

/** The API reports rupees and a bare flat id; the screen wants paise and a label like "A-101". */
export function toBillSummary(raw: any, labels: Record<string, string>): BillSummary {
  const defaulters = Array.isArray(raw?.defaulters) ? raw.defaulters : [];
  return {
    paidCount: n(raw?.paidCount),
    pendingCount: n(raw?.pendingCount),
    overdueCount: n(raw?.overdueCount),
    totalFlats: n(raw?.totalBills),
    totalDuePaise: Math.round(n(raw?.totalAmountDue) * 100),
    collectedPaise: Math.round(n(raw?.totalCollected) * 100),
    collectionPercentage: n(raw?.collectionPercentage),
    defaulters: defaulters.map((d: any) => ({
      flatId: d.flatId,
      flatDisplay: labels[d.flatId] || d.flatNumber || '—',
      ownerName: d.ownerName ?? '',
      amountDuePaise: Math.round(n(d.amountDue) * 100),
    })),
  };
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** The request body POST /billing/generate expects. The due date is 15 days after `today`. */
export function toGenerateBody(year: number, month: number, amountPaise: number, today: Date = new Date()) {
  const due = new Date(today.getTime() + 15 * 24 * 60 * 60 * 1000);
  return {
    period: `${year}-${String(month).padStart(2, '0')}`,
    amountPerFlat: amountPaise / 100,
    description: `Maintenance for ${MONTHS[month - 1]} ${year}`,
    dueDate: due.toISOString().slice(0, 10),
  };
}
