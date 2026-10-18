/** Who can do what to a feed post (the server enforces the same rules; this only decides what to offer). */

export type PostActionId = 'pin' | 'unpin' | 'hide' | 'unhide' | 'lock' | 'unlock' | 'delete';

export interface PostAction { id: PostActionId; label: string; destructive?: boolean; confirm?: string }

export function postActions(
  post: { isLocked: boolean; isHidden?: boolean; isPinned: boolean },
  who: { isAdmin: boolean; isAuthor: boolean },
): PostAction[] {
  const out: PostAction[] = [];
  if (who.isAdmin) {
    out.push(post.isPinned ? { id: 'unpin', label: 'Unpin' } : { id: 'pin', label: 'Pin to top' });
    out.push(post.isHidden
      ? { id: 'unhide', label: 'Show again' }
      : { id: 'hide', label: 'Hide from residents', confirm: 'Residents will no longer see this post. You can show it again later.' });
  }
  if (who.isAdmin || who.isAuthor) {
    out.push(post.isLocked ? { id: 'unlock', label: 'Open comments' } : { id: 'lock', label: 'Close comments' });
    out.push({ id: 'delete', label: 'Delete post', destructive: true, confirm: 'Delete this post? This cannot be undone.' });
  }
  return out;
}
