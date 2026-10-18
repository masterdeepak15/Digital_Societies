/** Row models for the guard, admin and staff list screens (the API field names stay out of the views). */

export interface VisitorRow {
  id: string; name: string; flat: string; purpose: string; status: string; time: string;
  photoMediaId: string | null; vehicle: string; people: number;
}
export interface ComplaintRow { id: string; ticket: string; title: string; flat: string; category: string; priority: string; status: string; time: string }

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "17 Oct, 9:38 pm" in the given zone (the device zone by default). */
export function shortDateTime(iso?: string | null, timeZone?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone, day: 'numeric', month: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true,
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  const time = `${get('hour')}:${get('minute')} ${get('dayPeriod').toLowerCase()}`;
  return `${get('day')} ${MONTHS[Number(get('month')) - 1]}, ${time}`;
}

export function toVisitorRow(v: any): VisitorRow {
  return {
    id: v.id,
    name: v.visitorName ?? v.name ?? 'Visitor',
    flat: v.hostFlatDisplay ?? '—',
    purpose: v.purpose ?? '',
    status: v.status ?? '',
    time: shortDateTime(v.entryTime ?? v.createdAt),
    photoMediaId: v.photoMediaId ?? null,
    vehicle: v.vehicleNumber ? `${v.vehicleNumber}${v.vehicleType ? ` (${v.vehicleType})` : ''}` : '',
    people: 1 + (Array.isArray(v.companions) ? v.companions.length : 0),
  };
}

export function toComplaintRow(c: any, labels: Record<string, string> = {}): ComplaintRow {
  return {
    id: c.id,
    ticket: c.ticketNumber ?? '',
    title: c.title ?? '',
    flat: labels[c.flatId] ?? c.flatDisplay ?? '—',
    category: c.category ?? '',
    priority: c.priority ?? '',
    status: c.status ?? '',
    time: shortDateTime(c.createdAt),
  };
}

/** The one sensible next step for a complaint, used by the admin and staff buttons. */
export function nextComplaintActions(status: string): { label: string; status: string }[] {
  switch (status) {
    case 'Open':
    case 'Assigned':
    case 'Reopened': return [{ label: 'Start work', status: 'InProgress' }];
    case 'InProgress': return [{ label: 'Mark resolved', status: 'Resolved' }];
    case 'Resolved': return [{ label: 'Close', status: 'Closed' }];
    default: return [];
  }
}
