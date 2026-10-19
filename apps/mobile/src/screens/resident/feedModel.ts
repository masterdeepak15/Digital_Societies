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

/** Two letters for the round avatar: "A-807" gives "A8", "Govind Rao" gives "GR". */
export function initialsOf(text: string | null | undefined): string {
  const parts = (text ?? '').split(/[\s\-_/]+/).filter(Boolean);
  if (parts.length === 0) return '?';
  const letters = parts.length === 1 ? parts[0].slice(0, 2) : parts[0][0] + parts[1][0];
  return letters.toUpperCase();
}

/** "just now", "5 min ago", "3 h ago", "2 d ago", then a short date. */
export function timeAgo(iso: string, now: Date = new Date()): string {
  const then = new Date(iso);
  const secs = Math.floor((now.getTime() - then.getTime()) / 1000);
  if (!Number.isFinite(secs) || secs < 60) return 'just now';
  if (secs < 3600) return `${Math.floor(secs / 60)} min ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)} h ago`;
  if (secs < 7 * 86400) return `${Math.floor(secs / 86400)} d ago`;
  return then.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
}
