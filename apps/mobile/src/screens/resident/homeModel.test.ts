import { greetingFor, summariseBills, visitorLabel } from './homeModel';

const at = (h: number, m = 0) => new Date(2026, 9, 17, h, m);

describe('greetingFor', () => {
  it.each([
    [at(6),      'Good morning'],
    [at(11, 59), 'Good morning'],
    [at(12),     'Good afternoon'],
    [at(16, 59), 'Good afternoon'],
    [at(17),     'Good evening'],
    [at(23, 30), 'Good evening'],
    [at(0),      'Good morning'],
  ] as const)('%p -> %p', (date, text) => {
    expect(greetingFor(date)).toBe(text);
  });
});

describe('summariseBills', () => {
  const now = new Date(2026, 9, 17, 10, 0);

  it('returns null when there are no bills', () => {
    expect(summariseBills([], now)).toEqual({ due: null });
  });

  it('returns null when every bill is paid or waived', () => {
    expect(summariseBills([
      { status: 'Paid', totalDue: 3500, dueDate: '2026-10-10' },
      { status: 'waived', totalDue: 3500, dueDate: '2026-09-10' },
    ], now)).toEqual({ due: null });
  });

  it('picks the earliest-due unpaid bill and counts the overdue days', () => {
    const r = summariseBills([
      { status: 'Pending', totalDue: 3600, dueDate: '2026-10-25' },
      { status: 'Overdue', totalDue: 3500, amount: 3000, dueDate: '2026-10-10' },
      { status: 'Paid',    totalDue: 3500, dueDate: '2026-09-10' },
    ], now);
    expect(r.due).toEqual({ amount: 3500, dueDate: '2026-10-10', overdueDays: 7 });
  });

  it('reports zero overdue days for a bill that is not yet due or due today', () => {
    expect(summariseBills([{ status: 'Pending', totalDue: 100, dueDate: '2026-10-20' }], now).due?.overdueDays).toBe(0);
    expect(summariseBills([{ status: 'Pending', totalDue: 100, dueDate: '2026-10-17' }], now).due?.overdueDays).toBe(0);
  });

  it('falls back to amount when totalDue is missing', () => {
    expect(summariseBills([{ status: 'Pending', amount: 2500, dueDate: '2026-10-25' }], now).due?.amount).toBe(2500);
  });

  it('prefers bills with a due date but still reports one without when it is the only unpaid bill', () => {
    const withDate = summariseBills([
      { status: 'Pending', totalDue: 1, },
      { status: 'Pending', totalDue: 2, dueDate: '2026-10-30' },
    ], now);
    expect(withDate.due?.amount).toBe(2);
    const noDate = summariseBills([{ status: 'Pending', totalDue: 5 }], now);
    expect(noDate.due).toEqual({ amount: 5, dueDate: '', overdueDays: 0 });
  });
});

describe('visitorLabel', () => {
  it('reads name and purpose from the documented shape', () => {
    expect(visitorLabel({ name: 'Ravi Kumar', purpose: 'Delivery' })).toBe('Ravi Kumar · Delivery');
  });
  it('accepts the older visitorName field and a missing purpose', () => {
    expect(visitorLabel({ visitorName: 'Ravi Kumar' })).toBe('Ravi Kumar');
  });
  it('has a safe fallback', () => {
    expect(visitorLabel({})).toBe('A visitor');
  });
});
