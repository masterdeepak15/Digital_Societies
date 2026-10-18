import React from 'react';
import { View, type ViewProps } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';

/** Surface container. Pass `tint` (e.g. a Courtyard module tint) to color it instead of the surface. */
export function Card({ tint, style, children, ...rest }: ViewProps & { tint?: { bg: string } }) {
  const { colors, radius } = useTheme();
  return (
    <View
      {...rest}
      style={[
        {
          backgroundColor: tint?.bg ?? colors.surface,
          borderRadius: radius.card,
          borderWidth: tint ? 0 : 1,
          borderColor: colors.line,
          padding: 16,
        },
        style,
      ]}>
      {children}
    </View>
  );
}
