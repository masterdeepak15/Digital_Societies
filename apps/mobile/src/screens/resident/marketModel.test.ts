import {
  EMPTY_MARKET_FORM, canRemoveReply, closeLabel, closedLabel, conditionLabel, kindLabel, marketFormError, priceText, repliers, toMarketPayload,
} from './marketModel';

const ok = { ...EMPTY_MARKET_FORM, title: 'Kids bicycle', price: '2500' };

describe('priceText', () => {
  it('writes a price for people', () => {
    expect(priceText('Sell', 2500)).toBe('₹2,500');
    expect(priceText('Sell', 0)).toBe('Free');
    expect(priceText('Sell', null)).toBe('Open to offers');
  });
  it('treats a wanted price as a budget and borrowing as priceless', () => {
    expect(priceText('Wanted', 1500)).toBe('Up to ₹1,500');
    expect(priceText('Wanted', null)).toBe('Any price');
    expect(priceText('Borrow', 900)).toBe('');
  });
});

describe('words for each kind', () => {
  it('names the kinds, conditions and the closing step', () => {
    expect(kindLabel('Sell')).toBe('For sale');
    expect(conditionLabel('like_new')).toBe('Like new');
    expect(conditionLabel(null)).toBe('');
    expect(closeLabel('Sell')).toBe('Mark as sold');
    expect(closeLabel('Wanted')).toBe('I found it');
    expect(closedLabel('Borrow')).toBe('Done');
  });
});

describe('marketFormError', () => {
  it('accepts a good post, with or without a price', () => {
    expect(marketFormError(ok)).toBeNull();
    expect(marketFormError({ ...ok, price: '' })).toBeNull();
  });
  it('asks for a title and a sensible price', () => {
    expect(marketFormError({ ...ok, title: 'ab' })).toMatch(/few words/i);
    expect(marketFormError({ ...ok, price: '-5' })).toMatch(/price/i);
    expect(marketFormError({ ...ok, price: 'abc' })).toMatch(/price/i);
  });
});

describe('toMarketPayload', () => {
  it('sends the price and condition only where they belong', () => {
    expect(toMarketPayload(ok, ['a'])).toMatchObject({ kind: 'Sell', priceRupees: 2500, condition: 'good', imageIds: ['a'] });
    expect(toMarketPayload({ ...ok, kind: 'Wanted' }, [])).toMatchObject({ priceRupees: 2500, condition: null });
    expect(toMarketPayload({ ...ok, kind: 'Borrow' }, [])).toMatchObject({ priceRupees: null, condition: null });
    expect(toMarketPayload({ ...ok, price: '' }, []).priceRupees).toBeNull();
  });
});

describe('repliers', () => {
  it('lists each neighbour once, never the author', () => {
    const replies = [
      { authorUserId: 'b', authorFlatDisplay: 'A-101' },
      { authorUserId: 'a', authorFlatDisplay: 'A-807' },
      { authorUserId: 'b', authorFlatDisplay: 'A-101' },
      { authorUserId: 'c', authorFlatDisplay: 'B-202' },
    ];
    expect(repliers(replies, 'a')).toEqual([{ userId: 'b', flat: 'A-101' }, { userId: 'c', flat: 'B-202' }]);
  });
});

describe('canRemoveReply', () => {
  const reply = { authorUserId: 'b' };
  it('allows the writer, the poster and an admin only', () => {
    expect(canRemoveReply({ isAdmin: false, userId: 'b' }, reply, 'a')).toBe(true);
    expect(canRemoveReply({ isAdmin: false, userId: 'a' }, reply, 'a')).toBe(true);
    expect(canRemoveReply({ isAdmin: true, userId: 'x' }, reply, 'a')).toBe(true);
    expect(canRemoveReply({ isAdmin: false, userId: 'c' }, reply, 'a')).toBe(false);
    expect(canRemoveReply({ isAdmin: false, userId: null }, reply, 'a')).toBe(false);
  });
});
