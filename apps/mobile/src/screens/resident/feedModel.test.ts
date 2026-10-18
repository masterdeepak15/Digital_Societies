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
