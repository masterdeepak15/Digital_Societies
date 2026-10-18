import { RESIDENT_TABS, RESIDENT_DETAIL, GUARD_TABS } from './routes';

describe('navigation routes', () => {
  it('gives residents exactly four tabs', () => {
    expect([...RESIDENT_TABS]).toEqual(['Home', 'Bills', 'Community', 'Me']);
  });

  it('gives guards exactly four tabs', () => {
    expect([...GUARD_TABS]).toEqual(['Gate', 'Log', 'Sos', 'Me']);
  });

  it('never lists a screen as both a tab and a detail route', () => {
    const tabs = new Set<string>(RESIDENT_TABS);
    expect(RESIDENT_DETAIL.filter((d) => tabs.has(d))).toEqual([]);
  });

  it('keeps every screen the old resident tab bar offered reachable', () => {
    const reachable = new Set<string>([...RESIDENT_TABS, ...RESIDENT_DETAIL]);
    for (const old of ['Visitors', 'Complaints', 'Notices', 'Parking', 'Marketplace', 'Wallet', 'VideoCall', 'Sos', 'Facilities']) {
      expect(reachable.has(old)).toBe(true);
    }
    // Feed became Community, Profile became Me
    expect(reachable.has('Community')).toBe(true);
    expect(reachable.has('Me')).toBe(true);
  });

  it('has no duplicate route names', () => {
    const all = [...RESIDENT_TABS, ...RESIDENT_DETAIL];
    expect(new Set(all).size).toBe(all.length);
  });
});
