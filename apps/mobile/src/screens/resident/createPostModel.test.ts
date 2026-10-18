import { validatePost } from './createPostModel';

const base = { category: 'general', body: '', question: '', options: ['', ''] };

describe('validatePost', () => {
  it('needs a message for an ordinary post', () => {
    expect(validatePost({ ...base, body: '  ' })).toMatchObject({ ok: false });
    expect(validatePost({ ...base, body: 'Hello' })).toEqual({ ok: true });
  });
  it('needs a question for a poll', () => {
    expect(validatePost({ ...base, category: 'poll', options: ['A', 'B'] })).toMatchObject({ ok: false, message: expect.stringMatching(/question/i) });
  });
  it('needs two filled-in choices for a poll', () => {
    expect(validatePost({ ...base, category: 'poll', question: 'Q?', options: ['A', ' '] })).toMatchObject({ ok: false, message: expect.stringMatching(/two choices/i) });
    expect(validatePost({ ...base, category: 'poll', question: 'Q?', options: ['A', 'B'] })).toEqual({ ok: true });
  });
  it('rejects repeated choices, ignoring case', () => {
    expect(validatePost({ ...base, category: 'poll', question: 'Q?', options: ['Sat', 'sat'] })).toMatchObject({ ok: false });
  });
});
