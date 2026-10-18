import { toBillSummary, toGenerateBody } from './summaryModel';

const api = {
  period: '2026-10', totalBills: 10, paidCount: 2, pendingCount: 6, overdueCount: 2,
  totalAmountDue: 30000, totalCollected: 6000, collectionPercentage: 20,
  defaulters: [{ flatId: 'f1', flatNumber: '', period: '2026-10', amountDue: 3000, daysOverdue: 4 }],
};

describe('toBillSummary', () => {
  it('converts rupees to paise and renames the counters the screen reads', () => {
    expect(toBillSummary(api, {})).toMatchObject({
      paidCount: 2, pendingCount: 6, overdueCount: 2, totalFlats: 10,
      totalDuePaise: 3_000_000, collectedPaise: 600_000, collectionPercentage: 20,
    });
  });
  it('names defaulter flats from the label map', () => {
    expect(toBillSummary(api, { f1: 'A-101' }).defaulters[0]).toMatchObject({ flatId: 'f1', flatDisplay: 'A-101', amountDuePaise: 300_000 });
  });
  it('falls back to the server flat number, then a dash', () => {
    expect(toBillSummary({ ...api, defaulters: [{ ...api.defaulters[0], flatNumber: 'B-7' }] }, {}).defaulters[0].flatDisplay).toBe('B-7');
    expect(toBillSummary(api, {}).defaulters[0].flatDisplay).toBe('—');
  });
  it('never produces NaN for a sparse response', () => {
    const s = toBillSummary({}, {});
    expect(s).toMatchObject({ paidCount: 0, pendingCount: 0, overdueCount: 0, totalFlats: 0, totalDuePaise: 0, collectedPaise: 0, collectionPercentage: 0 });
    expect(s.defaulters).toEqual([]);
  });
});

describe('toGenerateBody', () => {
  it('builds the API request: YYYY-MM period, rupees per flat, a description and a due date 15 days out', () => {
    expect(toGenerateBody(2026, 11, 350000, new Date('2026-10-18T10:00:00Z'))).toEqual({
      period: '2026-11', amountPerFlat: 3500, description: 'Maintenance for Nov 2026', dueDate: '2026-11-02',
    });
  });
  it('zero-pads the month', () => {
    expect(toGenerateBody(2027, 3, 100000, new Date('2027-03-01T00:00:00Z')).period).toBe('2027-03');
  });
});
