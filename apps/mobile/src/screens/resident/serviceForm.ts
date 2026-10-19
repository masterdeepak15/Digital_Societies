/** The form a resident fills to register a service person (plumber, electrician, ...). */

export interface ServiceFormValues {
  providerName: string;
  phone: string;
  category: string;
  title: string;
  description: string;
  rate: string;
  rateUnit: string;
}

export const SERVICE_CATEGORIES = ['Plumber', 'Electrician', 'Carpenter', 'Painter', 'Cleaner', 'PestControl', 'AcRepair', 'ApplianceRepair', 'Gardener', 'Other'];

export const RATE_UNITS: { value: string; label: string }[] = [
  { value: 'PerVisit', label: 'per visit' },
  { value: 'PerHour', label: 'per hour' },
  { value: 'PerDay', label: 'per day' },
];

export const EMPTY_SERVICE_FORM: ServiceFormValues = {
  providerName: '', phone: '', category: 'Plumber', title: '', description: '', rate: '', rateUnit: 'PerVisit',
};

/** First problem in plain words, or null when the form can be sent. */
export function serviceFormError(v: ServiceFormValues): string | null {
  if (v.providerName.trim().length < 2) return 'Enter the name of the person.';
  if (!/^\+?[0-9]{10,13}$/.test(v.phone.replace(/[\s-]/g, ''))) return 'Enter a valid phone number.';
  if (v.title.trim().length < 3) return 'Say what the service is, for example "Leak repair".';
  const rate = Number(v.rate);
  if (!v.rate.trim() || !Number.isFinite(rate) || rate <= 0) return 'Enter the rate in rupees.';
  return null;
}

/** The body the server expects. The server fills in who registered it and decides the commission. */
export function toServicePayload(v: ServiceFormValues) {
  return {
    providerName: v.providerName.trim(),
    phone: v.phone.replace(/[\s-]/g, ''),
    category: v.category,
    title: v.title.trim(),
    description: v.description.trim(),
    baseRateRupees: Number(v.rate),
    rateUnit: v.rateUnit,
    commissionPct: 10,
  };
}

export type ListingApproval = 'Pending' | 'Approved' | 'Rejected';

/** What the owner sees about their own registration. */
export function approvalNote(approval: ListingApproval | undefined, reason?: string | null): string | null {
  if (approval === 'Pending') return 'Waiting for the admin to approve. Residents will see it after that.';
  if (approval === 'Rejected') return reason ? `Not approved: ${reason}. Change it and send it again.` : 'Not approved. Change it and send it again.';
  return null;
}

/** Residents can book only approved services. */
export const canBook = (l: { approval?: ListingApproval }): boolean => (l.approval ?? 'Approved') === 'Approved';
