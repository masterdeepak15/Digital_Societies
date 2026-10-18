import { toBillRow, sortBills } from './billsModel';

const api = { id: 'b1', period: '2027-02', amount: 3000, lateFee: 0, totalDue: 3000, status: 'pending', dueDate: '2026-11-07' };

describe('toBillRow', () => {
  it('formats the period and due date for display', () => {
    expect(toBillRow(api)).toMatchObject({ id: 'b1', period: 'Feb 2027', due: '7 Nov 2026', amount: 3000, status: 'pending' });
  });
  it('shows the total due when a late fee applies', () => {
    expect(toBillRow({ ...api, lateFee: 200, totalDue: 3200 }).amount).toBe(3200);
  });
  it('lower-cases the status and defaults an unknown one to pending', () => {
    expect(toBillRow({ ...api, status: 'Paid' }).status).toBe('paid');
    expect(toBillRow({ ...api, status: undefined as any }).status).toBe('pending');
  });
  it('keeps a malformed period readable instead of throwing', () => {
    expect(toBillRow({ ...api, period: 'bad' }).period).toBe('bad');
  });
});

describe('sortBills', () => {
  it('puts unpaid bills first, then newest period first', () => {
    const rows = [
      toBillRow({ ...api, id: 'a', period: '2026-09', status: 'paid' }),
      toBillRow({ ...api, id: 'b', period: '2026-10', status: 'pending' }),
      toBillRow({ ...api, id: 'c', period: '2026-11', status: 'paid' }),
      toBillRow({ ...api, id: 'd', period: '2026-08', status: 'overdue' }),
    ];
    expect(sortBills(rows).map(r => r.id)).toEqual(['b', 'd', 'c', 'a']);
  });
});
