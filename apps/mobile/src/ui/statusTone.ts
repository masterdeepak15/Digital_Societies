export type Tone = 'good' | 'warn' | 'bad' | 'neutral';

const GOOD = new Set(['paid', 'approved', 'resolved', 'entered', 'inside', 'connected']);
const WARN = new Set(['pending', 'waiting', 'due', 'inprogress', 'open']);
const BAD  = new Set(['overdue', 'rejected', 'denied', 'failed', 'sos']);

/** Maps a status label (any case, spaces/underscores ignored) to a semantic tone. */
export function statusTone(status: string): Tone {
  const key = status.toLowerCase().replace(/[\s_]+/g, '');
  if (GOOD.has(key)) return 'good';
  if (WARN.has(key)) return 'warn';
  if (BAD.has(key)) return 'bad';
  return 'neutral';
}
