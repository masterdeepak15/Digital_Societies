import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { useThemeMode } from '../theme/modeStore';
import type { ThemeMode } from '../theme/themes';
import { Icon, type IconName } from './Icon';

const OPTIONS: { mode: ThemeMode; label: string; icon: IconName }[] = [
  { mode: 'light',  label: 'Light',  icon: 'sun' },
  { mode: 'dark',   label: 'Dark',   icon: 'moon' },
  { mode: 'system', label: 'System', icon: 'smartphone' },
];

/** Light / Dark / System segmented control, bound to the persisted appearance preference. */
export function ThemeModeSelector() {
  const { colors, fonts, radius } = useTheme();
  const { mode, setMode } = useThemeMode();
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel="Appearance"
      style={{ flexDirection: 'row', borderWidth: 1.5, borderColor: colors.line, borderRadius: radius.control, overflow: 'hidden' }}>
      {OPTIONS.map((o) => {
        const selected = mode === o.mode;
        const fg = selected ? colors.onPrimary : colors.text;
        return (
          <Pressable
            key={o.mode}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            accessibilityLabel={o.label}
            onPress={() => setMode(o.mode)}
            style={{
              flex: 1, minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
              backgroundColor: selected ? colors.primary : 'transparent',
            }}>
            <Icon name={o.icon} size={16} color={fg} />
            <Text style={{ color: fg, fontFamily: fonts.semibold, fontSize: 14 }}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}
