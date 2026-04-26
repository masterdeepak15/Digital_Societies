import { StyleSheet } from 'react-native';

export const Typography = StyleSheet.create({
  h1: { fontSize: 28, fontWeight: '700', lineHeight: 36 },
  h2: { fontSize: 22, fontWeight: '700', lineHeight: 30 },
  h3: { fontSize: 18, fontWeight: '600', lineHeight: 26 },
  h4: { fontSize: 16, fontWeight: '600', lineHeight: 24 },
  body1: { fontSize: 16, fontWeight: '400', lineHeight: 24 },
  body2: { fontSize: 14, fontWeight: '400', lineHeight: 20 },
  caption: { fontSize: 12, fontWeight: '400', lineHeight: 16 },
  // Guard UI: large text for glanceability
  guardAction: { fontSize: 20, fontWeight: '700', lineHeight: 28 },
  guardLabel:  { fontSize: 16, fontWeight: '500', lineHeight: 22 },
});
