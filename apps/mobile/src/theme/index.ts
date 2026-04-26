// Barrel re-export — allows both:
//   import { Colors } from '../theme/colors'       (individual files)
//   import { Colors, Typography, Spacing } from '../theme'  (barrel)
export { Colors }             from './colors';
export type { ColorKey }      from './colors';
export { Typography }         from './typography';
export { Spacing, Radius }    from './spacing';
