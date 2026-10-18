/** The wallet API answers in rupees/paise with its own field names; the screen reads these shapes. */
export interface WalletBalance {
  walletId: string;
  balanceInr: number;
  balancePaise: number;
}

export interface WalletTransaction {
  id: string;
  type: 'Credit' | 'Debit';
  amountInr: number;
  description: string;
  referenceId?: string;
  createdAt: string;
}

type Raw = Record<string, any>;

export function toWalletBalance(raw: Raw): WalletBalance {
  const rupees = typeof raw.balanceRupees === 'number' ? raw.balanceRupees : 0;
  return { walletId: raw.walletId, balanceInr: rupees, balancePaise: Math.round(rupees * 100) };
}

export function toWalletTransaction(raw: Raw): WalletTransaction {
  return {
    id: raw.id,
    // `direction` is Credit/Debit; the API's own `type` is the category (Cashback, Booking, ...).
    type: raw.direction === 'Credit' ? 'Credit' : 'Debit',
    amountInr: (typeof raw.amountPaise === 'number' ? raw.amountPaise : 0) / 100,
    description: raw.description,
    referenceId: raw.referenceId ?? undefined,
    createdAt: raw.createdAt,
  };
}
