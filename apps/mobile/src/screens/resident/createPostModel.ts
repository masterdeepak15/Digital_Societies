export interface PostDraft { category: string; body: string; question: string; options: string[] }

export type PostCheck = { ok: true } | { ok: false; message: string };

/** What a post needs before it can be sent: a message, or for a poll a question and at least two different choices. */
export function validatePost(d: PostDraft): PostCheck {
  if (d.category === 'poll') {
    if (!d.question.trim()) return { ok: false, message: 'Write the poll question.' };
    const choices = d.options.map((o) => o.trim()).filter(Boolean);
    if (choices.length < 2) return { ok: false, message: 'Give at least two choices.' };
    if (new Set(choices.map((c) => c.toLowerCase())).size !== choices.length) return { ok: false, message: 'Each choice must be different.' };
    return { ok: true };
  }
  if (!d.body.trim()) return { ok: false, message: 'Write something to share.' };
  return { ok: true };
}
