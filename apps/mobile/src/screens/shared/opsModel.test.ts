import { toVisitorRow, toComplaintRow, nextComplaintActions, shortDateTime } from './opsModel';

describe('shortDateTime', () => {
  it('formats an ISO time for the gate log', () => {
    expect(shortDateTime('2026-10-17T16:08:46+00:00', 'Asia/Kolkata')).toBe('17 Oct, 9:38 pm');
  });
  it('returns an empty string for a missing or invalid time', () => {
    expect(shortDateTime(undefined)).toBe('');
    expect(shortDateTime('nope')).toBe('');
  });
});

describe('toVisitorRow', () => {
  it('shows the host flat label and purpose', () => {
    const r = toVisitorRow({ id: 'v1', visitorName: 'Ravi', visitorPhone: '+9198', purpose: 'Delivery', status: 'Entered', hostFlatDisplay: 'A-101', entryTime: '2026-10-17T16:08:46+00:00' });
    expect(r).toMatchObject({ id: 'v1', name: 'Ravi', flat: 'A-101', purpose: 'Delivery', status: 'Entered' });
  });
  it('carries the picture id, vehicle and people count', () => {
    const r = toVisitorRow({ id: 'v3', visitorName: 'A', purpose: 'Guest', status: 'Pending', photoMediaId: 'abc', vehicleNumber: 'MH12AB1234', vehicleType: 'Car', companions: [{ name: 'B' }, { name: 'C' }] });
    expect(r).toMatchObject({ photoMediaId: 'abc', vehicle: 'MH12AB1234 (Car)', people: 3 });
  });
  it('counts a lone visitor as one person and omits the vehicle', () => {
    expect(toVisitorRow({ id: 'v4', visitorName: 'A', purpose: 'Guest', status: 'Pending' })).toMatchObject({ people: 1, vehicle: '', photoMediaId: null });
  });
  it('falls back to a dash when the flat is unknown', () => {
    expect(toVisitorRow({ id: 'v2', visitorName: 'X', purpose: 'Guest', status: 'Pending' }).flat).toBe('—');
  });
});

describe('toComplaintRow', () => {
  it('uses the flat label when present', () => {
    const r = toComplaintRow({ id: 'c1', ticketNumber: 'C-2026-AB12', title: 'Leak', category: 'Plumbing', priority: 'High', status: 'Open', flatId: 'f1' }, { f1: 'B-203' });
    expect(r).toMatchObject({ id: 'c1', ticket: 'C-2026-AB12', title: 'Leak', flat: 'B-203', status: 'Open' });
  });
});

describe('nextComplaintActions', () => {
  it('offers the next step for each status', () => {
    expect(nextComplaintActions('Open').map(a => a.status)).toEqual(['InProgress']);
    expect(nextComplaintActions('Assigned').map(a => a.status)).toEqual(['InProgress']);
    expect(nextComplaintActions('InProgress').map(a => a.status)).toEqual(['Resolved']);
    expect(nextComplaintActions('Resolved').map(a => a.status)).toEqual(['Closed']);
  });
  it('offers nothing once a complaint is closed or the status is unknown', () => {
    expect(nextComplaintActions('Closed')).toEqual([]);
    expect(nextComplaintActions('Whatever')).toEqual([]);
  });
});
