import React from 'react';
import { Text, TextInput, View, type TextInputProps } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';

export function TextField({ label, error, style, ...rest }: TextInputProps & { label: string; error?: string }) {
  const { colors, fonts, radius } = useTheme();
  return (
    <View style={{ gap: 8 }}>
      <Text style={{ color: colors.text, fontFamily: fonts.semibold, fontSize: 14 }}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={colors.muted}
        {...rest}
        style={[
          {
            minHeight: 56, borderRadius: radius.control, paddingHorizontal: 16,
            borderWidth: 1.5, borderColor: error ? colors.danger : colors.line,
            backgroundColor: colors.surface, color: colors.text, fontFamily: fonts.medium, fontSize: 16,
          },
          style,
        ]}
      />
      {error ? <Text accessibilityLiveRegion="polite" style={{ color: colors.danger, fontFamily: fonts.medium, fontSize: 13 }}>{error}</Text> : null}
    </View>
  );
}
