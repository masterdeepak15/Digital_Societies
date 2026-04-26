export const Colors = {
  // Brand
  primary:   '#1B4F72',   // Deep navy — trust, security
  secondary: '#2ECC71',   // Emerald — action, success
  accent:    '#F39C12',   // Amber — alerts, pending

  // Status
  success:   '#27AE60',
  warning:   '#F39C12',
  error:     '#E74C3C',
  info:      '#2980B9',

  // Neutrals
  background: '#F8F9FA',
  surface:    '#FFFFFF',
  border:     '#DEE2E6',
  divider:    '#E9ECEF',

  // Text
  textPrimary:   '#212529',
  textSecondary: '#6C757D',
  textDisabled:  '#ADB5BD',
  textOnPrimary: '#FFFFFF',

  // Role-specific tints (used for role indicator chips)
  roleAdmin:     '#8E44AD',
  roleResident:  '#1B4F72',
  roleGuard:     '#E74C3C',
  roleStaff:     '#16A085',
} as const;

export type ColorKey = keyof typeof Colors;
