import React from 'react';
import { Text, View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';

export function ScreenHeader({ title, subtitle, right }: { title: string; subtitle?: string; right?: React.ReactNode }) {
  const { colors, fonts } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
      <View style={{ flex: 1 }}>
        {subtitle ? <Text style={{ color: colors.muted, fontFamily: fonts.semibold, fontSize: 13 }}>{subtitle}</Text> : null}
        <Text accessibilityRole="header" style={{ color: colors.text, fontFamily: fonts.extrabold, fontSize: 26 }}>{title}</Text>
      </View>
      {right}
    </View>
  );
}
