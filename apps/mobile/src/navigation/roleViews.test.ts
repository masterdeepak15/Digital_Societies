import { availableViews, defaultView, membershipForView, validView, viewOf } from './roleViews';
import type { MembershipInfo } from '../services/api/authService';

const m = (role: string, societyId = 's1', flatId?: string): MembershipInfo => ({ societyId, societyName: 'Govindbaug', role, flatId, flatDisplay: flatId ? 'A-807' : undefined });

describe('viewOf', () => {
  it('groups roles into the screens they use', () => {
    expect(viewOf('admin')).toBe('admin');
    expect(viewOf('accountant')).toBe('admin');
    expect(viewOf('guard')).toBe('guard');
    expect(viewOf('staff')).toBe('staff');
    for (const r of ['resident', 'family', 'tenant', 'owner', '']) expect(viewOf(r)).toBe('resident');
    expect(viewOf(null)).toBe('resident');
  });
});

describe('availableViews', () => {
  it('offers a view for every role the person holds in this society', () => {
    const list = [m('admin'), m('accountant'), m('resident', 's1', 'f1'), m('guard')];
    expect(availableViews(list, 's1')).toEqual(['resident', 'admin', 'guard']);
  });
  it('offers one view to someone with one role', () => {
    expect(availableViews([m('resident', 's1', 'f1')], 's1')).toEqual(['resident']);
  });
  it('ignores roles held in another society', () => {
    expect(availableViews([m('admin', 's2'), m('resident', 's1', 'f1')], 's1')).toEqual(['resident']);
  });
});

describe('defaultView', () => {
  it('starts on the first role the person was given', () => {
    expect(defaultView([m('admin'), m('resident', 's1', 'f1')], 's1')).toBe('admin');
    expect(defaultView([m('resident', 's1', 'f1'), m('guard')], 's1')).toBe('resident');
    expect(defaultView([], 's1')).toBe('resident');
  });
});

describe('membershipForView', () => {
  const list = [m('accountant'), m('admin'), m('resident', 's1', 'f1')];
  it('picks admin over accountant for management', () => expect(membershipForView(list, 's1', 'admin')?.role).toBe('admin'));
  it('picks the membership with a flat for the home view', () => expect(membershipForView(list, 's1', 'resident')?.flatId).toBe('f1'));
  it('returns nothing for a view the person does not hold', () => expect(membershipForView(list, 's1', 'guard')).toBeUndefined());
});

describe('validView', () => {
  const list = [m('admin'), m('resident', 's1', 'f1')];
  it('keeps a saved choice while the role is still held', () => expect(validView('resident', list, 's1')).toBe('resident'));
  it('drops a saved choice for a role that was taken away', () => {
    expect(validView('guard', list, 's1')).toBeNull();
    expect(validView('nonsense', list, 's1')).toBeNull();
    expect(validView(null, list, 's1')).toBeNull();
  });
});
