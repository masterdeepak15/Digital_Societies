import React from 'react';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeProvider';

export type IconName = React.ComponentProps<typeof Feather>['name'];

/** Feather stroke icon in the theme's text color unless told otherwise. Decorative by default. */
export function Icon({ name, size = 22, color }: { name: IconName; size?: number; color?: string }) {
  const theme = useTheme();
  return (
    <Feather
      name={name}
      size={size}
      color={color ?? theme.colors.text}
      accessibilityElementsHidden
      importantForAccessibility="no"
    />
  );
}
