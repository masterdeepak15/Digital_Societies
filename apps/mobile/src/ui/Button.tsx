import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { Icon, type IconName } from './Icon';

export interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  loading?: boolean;
  disabled?: boolean;
  icon?: IconName;
}

export function Button({ title, onPress, variant = 'primary', loading, disabled, icon }: ButtonProps) {
  const { colors, fonts, radius } = useTheme();
  const inactive = disabled || loading;
  const solid = variant === 'primary';
  const fg = solid ? colors.onPrimary : variant === 'danger' ? colors.danger : colors.text;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        {
          borderRadius: radius.control,
          backgroundColor: solid ? colors.primary : 'transparent',
          borderColor: solid ? colors.primary : variant === 'danger' ? colors.danger : colors.line,
          opacity: inactive ? 0.5 : pressed ? 0.85 : 1,
        },
      ]}>
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <View style={styles.row}>
          {icon ? <Icon name={icon} size={18} color={fg} /> : null}
          <Text style={{ color: fg, fontFamily: fonts.bold, fontSize: 16 }}>{title}</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { minHeight: 52, paddingHorizontal: 20, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
