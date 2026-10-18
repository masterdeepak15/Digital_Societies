import { Alert } from 'react-native';
import { apiFetch } from '../../utils/api';
import { errorMessage } from '../../utils/errorMessage';
import { postActions, type PostAction, type PostActionId } from './feedModel';

type Post = { id: string; isLocked: boolean; isHidden?: boolean; isPinned: boolean };

const call = (action: PostActionId, id: string): Promise<unknown> => {
  switch (action) {
    case 'pin':    return apiFetch(`/social/posts/${id}/pin`,  { method: 'PUT', body: JSON.stringify({ isPinned: true }) });
    case 'unpin':  return apiFetch(`/social/posts/${id}/pin`,  { method: 'PUT', body: JSON.stringify({ isPinned: false }) });
    case 'hide':   return apiFetch(`/social/posts/${id}/hide`, { method: 'PUT', body: JSON.stringify({ hidden: true }) });
    case 'unhide': return apiFetch(`/social/posts/${id}/hide`, { method: 'PUT', body: JSON.stringify({ hidden: false }) });
    case 'lock':   return apiFetch(`/social/posts/${id}/lock`, { method: 'PUT', body: JSON.stringify({ isLocked: true }) });
    case 'unlock': return apiFetch(`/social/posts/${id}/lock`, { method: 'PUT', body: JSON.stringify({ isLocked: false }) });
    case 'delete': return apiFetch(`/social/posts/${id}`, { method: 'DELETE' });
  }
};

/** Shows the actions this person may take on the post, runs the chosen one, then calls `done`. */
export function showPostMenu(post: Post, who: { isAdmin: boolean; isAuthor: boolean }, done: (deleted: boolean) => void) {
  const actions = postActions(post, who);
  if (actions.length === 0) return;

  const run = async (a: PostAction) => {
    try {
      await call(a.id, post.id);
      done(a.id === 'delete');
    } catch (e: any) {
      Alert.alert('Could not do that', errorMessage(e));
    }
  };

  Alert.alert('Post options', undefined, [
    ...actions.map((a) => ({
      text: a.label,
      style: a.destructive ? ('destructive' as const) : ('default' as const),
      onPress: () => (a.confirm
        ? Alert.alert(a.label, a.confirm, [{ text: 'Cancel', style: 'cancel' }, { text: a.label, style: a.destructive ? 'destructive' : 'default', onPress: () => run(a) }])
        : run(a)),
    })),
    { text: 'Cancel', style: 'cancel' as const },
  ]);
}
