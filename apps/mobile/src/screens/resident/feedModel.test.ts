import { postActions } from './feedModel';

const post = { isLocked: false, isHidden: false, isPinned: false };

describe('postActions', () => {
  it('lets the author delete their post and close its comments, nothing more', () => {
    expect(postActions(post, { isAdmin: false, isAuthor: true }).map(a => a.id)).toEqual(['lock', 'delete']);
  });
  it('offers nothing on somebody else’s post to an ordinary resident', () => {
    expect(postActions(post, { isAdmin: false, isAuthor: false })).toEqual([]);
  });
  it('gives an admin pin, hide, close comments and delete on any post', () => {
    expect(postActions(post, { isAdmin: true, isAuthor: false }).map(a => a.id)).toEqual(['pin', 'hide', 'lock', 'delete']);
  });
  it('flips the wording when comments are closed, the post is hidden or pinned', () => {
    const ids = postActions({ isLocked: true, isHidden: true, isPinned: true }, { isAdmin: true, isAuthor: false }).map(a => a.id);
    expect(ids).toEqual(['unpin', 'unhide', 'unlock', 'delete']);
  });
  it('marks delete as destructive and asks for confirmation', () => {
    const del = postActions(post, { isAdmin: true, isAuthor: true }).find(a => a.id === 'delete')!;
    expect(del.destructive).toBe(true);
    expect(del.confirm).toMatch(/delete/i);
  });
});

import { initialsOf, timeAgo } from './feedModel';

describe('initialsOf', () => {
  it('uses two letters for the avatar', () => {
    expect(initialsOf('A-807')).toBe('A8');
    expect(initialsOf('Govind Rao')).toBe('GR');
    expect(initialsOf('admin')).toBe('AD');
  });
  it('copes with nothing', () => {
    expect(initialsOf('')).toBe('?');
    expect(initialsOf(undefined)).toBe('?');
  });
});

describe('timeAgo', () => {
  const now = new Date('2026-10-19T12:00:00Z');
  it('counts minutes, hours and days', () => {
    expect(timeAgo('2026-10-19T11:59:40Z', now)).toBe('just now');
    expect(timeAgo('2026-10-19T11:55:00Z', now)).toBe('5 min ago');
    expect(timeAgo('2026-10-19T09:00:00Z', now)).toBe('3 h ago');
    expect(timeAgo('2026-10-17T12:00:00Z', now)).toBe('2 d ago');
  });
  it('falls back to a date after a week, and to "just now" for nonsense', () => {
    expect(timeAgo('2026-09-01T12:00:00Z', now)).toMatch(/Sep/);
    expect(timeAgo('not a date', now)).toBe('just now');
  });
});
