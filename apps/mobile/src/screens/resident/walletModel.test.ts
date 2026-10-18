import { toWalletBalance, toWalletTransaction } from './walletModel';

describe('toWalletBalance', () => {
  it('reads the API balance in rupees', () => {
    expect(toWalletBalance({ walletId: 'w1', balanceRupees: 2250, totalTransactions: 3 }))
      .toEqual({ walletId: 'w1', balanceInr: 2250, balancePaise: 225000 });
  });
  it('rounds paise to a whole number', () => {
    expect(toWalletBalance({ walletId: 'w', balanceRupees: 10.005 }).balancePaise).toBe(1001);
  });
  it('treats a missing balance as zero', () => {
    expect(toWalletBalance({ walletId: 'w' })).toEqual({ walletId: 'w', balanceInr: 0, balancePaise: 0 });
  });
});

describe('toWalletTransaction', () => {
  it('uses the credit/debit direction as the type and converts paise to rupees', () => {
    expect(toWalletTransaction({
      id: 't1', amountPaise: 25000, direction: 'Credit', type: 'Cashback',
      description: 'Early payment cashback', referenceId: null, createdAt: '2026-10-01T00:00:00Z',
    })).toEqual({
      id: 't1', type: 'Credit', amountInr: 250, description: 'Early payment cashback',
      referenceId: undefined, createdAt: '2026-10-01T00:00:00Z',
    });
  });
  it('maps a debit', () => {
    expect(toWalletTransaction({ id: 't2', amountPaise: 40000, direction: 'Debit', type: 'Booking', description: 'Plumber', createdAt: 'x' }).type).toBe('Debit');
  });
  it('falls back to Debit for an unknown direction', () => {
    expect(toWalletTransaction({ id: 't3', amountPaise: 100, description: 'd', createdAt: 'x' }).type).toBe('Debit');
  });
});
