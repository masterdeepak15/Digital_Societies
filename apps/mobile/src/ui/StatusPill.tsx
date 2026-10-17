import React from 'react';
import { Text, View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { statusTone, type Tone } from './statusTone';

export function StatusPill({ label, tone }: { label: string; tone?: Tone }) {
  const { colors, fonts, radius } = useTheme();
  const t = tone ?? statusTone(label);
  const fg = t === 'good' ? colors.success : t === 'warn' ? colors.warning : t === 'bad' ? colors.danger : colors.muted;
  return (
    <View
      accessible
      accessibilityLabel={label}
      style={{ alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill, backgroundColor: `${fg}1A` }}>
      <Text style={{ color: fg, fontFamily: fonts.semibold, fontSize: 12 }}>{label}</Text>
    </View>
  );
}
