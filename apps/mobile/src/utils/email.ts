// Mirrors the backend Email value object (services/DigitalSocieties.Shared): trimmed, lowercased,
// at most 250 characters, simple local@domain.tld shape.
const MAX_LENGTH = 250;
const SHAPE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

export function isValidEmail(raw: string): boolean {
  const e = normalizeEmail(raw);
  return e.length > 0 && e.length <= MAX_LENGTH && SHAPE.test(e);
}
