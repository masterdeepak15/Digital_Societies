/** The society market: what people sell, want to buy or want to borrow. Plain rules, no screens. */

export type MarketKind = 'Sell' | 'Wanted' | 'Borrow';
export type MarketStatus = 'Open' | 'Closed';

export const KINDS: { value: MarketKind; label: string; icon: string; hint: string }[] = [
  { value: 'Sell',   label: 'For sale', icon: '🏷️', hint: 'Something you want to sell' },
  { value: 'Wanted', label: 'Wanted',   icon: '🔎', hint: 'Something you want to buy' },
  { value: 'Borrow', label: 'Borrow',   icon: '🤝', hint: 'Something you want to borrow' },
];

export const CONDITIONS: { value: string; label: string }[] = [
  { value: 'new', label: 'New' },
  { value: 'like_new', label: 'Like new' },
  { value: 'good', label: 'Good' },
  { value: 'fair', label: 'Fair' },
];

export const kindLabel = (k: string): string => KINDS.find((x) => x.value === k)?.label ?? k;
export const kindIcon = (k: string): string => KINDS.find((x) => x.value === k)?.icon ?? '🛒';
export const conditionLabel = (c?: string | null): string => CONDITIONS.find((x) => x.value === c)?.label ?? '';

/** "₹2,500", "Free" for zero, "Open to offers" when there is no price. */
export function priceText(kind: string, rupees: number | null | undefined): string {
  if (kind === 'Borrow') return '';
  if (rupees == null) return kind === 'Wanted' ? 'Any price' : 'Open to offers';
  if (rupees === 0) return 'Free';
  const text = `₹${rupees.toLocaleString('en-IN')}`;
  return kind === 'Wanted' ? `Up to ${text}` : text;
}

/** What the author taps when the deal is done. */
export function closeLabel(kind: string): string {
  return kind === 'Sell' ? 'Mark as sold' : kind === 'Wanted' ? 'I found it' : 'Mark as done';
}

/** What a closed post says in its badge. */
export function closedLabel(kind: string): string {
  return kind === 'Sell' ? 'Sold' : kind === 'Wanted' ? 'Found' : 'Done';
}

export interface MarketFormValues {
  kind: MarketKind;
  title: string;
  description: string;
  price: string;
  condition: string;
  photos: string[];
}

export const EMPTY_MARKET_FORM: MarketFormValues = { kind: 'Sell', title: '', description: '', price: '', condition: 'good', photos: [] };

/** First problem in plain words, or null when it can be posted. */
export function marketFormError(v: MarketFormValues): string | null {
  if (v.title.trim().length < 3) return 'Say what it is in a few words.';
  if (v.price.trim() !== '') {
    const n = Number(v.price);
    if (!Number.isFinite(n) || n < 0) return 'Enter the price in rupees, or leave it empty.';
  }
  return null;
}

/** The body the server expects. `imageIds` are the ids the pictures got when they were uploaded. */
export function toMarketPayload(v: MarketFormValues, imageIds: string[]) {
  return {
    kind: v.kind,
    title: v.title.trim(),
    description: v.description.trim(),
    priceRupees: v.kind === 'Borrow' || v.price.trim() === '' ? null : Number(v.price),
    condition: v.kind === 'Sell' ? v.condition : null,
    imageIds,
  };
}

export interface MarketPostLike { kind: string; status: string; replyCount: number }

/** Posts that still take replies come first (the server sorts the same way; this keeps a local list in order). */
export const isOpen = (p: { status: string }): boolean => p.status === 'Open';

/** Who the deal can be closed with: neighbours who replied, once each, never the author. */
export function repliers(replies: { authorUserId: string; authorFlatDisplay: string }[], authorUserId: string) {
  const seen = new Set<string>();
  const out: { userId: string; flat: string }[] = [];
  for (const r of replies) {
    if (r.authorUserId === authorUserId || seen.has(r.authorUserId)) continue;
    seen.add(r.authorUserId);
    out.push({ userId: r.authorUserId, flat: r.authorFlatDisplay });
  }
  return out;
}

/** Who may remove a reply: its writer, the poster, or an admin. */
export function canRemoveReply(who: { isAdmin: boolean; userId?: string | null }, reply: { authorUserId: string }, postAuthorUserId: string): boolean {
  return who.isAdmin || (!!who.userId && (who.userId === reply.authorUserId || who.userId === postAuthorUserId));
}
