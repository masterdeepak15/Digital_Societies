import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import type { BottomTabNavigationOptions } from '@react-navigation/bottom-tabs';
import { useTheme } from '../theme/ThemeProvider';
import { Icon, type IconName } from '../ui';

/** Themed bottom-tab options shared by every role navigator. */
export function useTabScreenOptions(): BottomTabNavigationOptions {
  const { colors, fonts } = useTheme();
  return {
    headerShown: false,
    tabBarActiveTintColor: colors.primary,
    tabBarInactiveTintColor: colors.muted,
    tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.line, borderTopWidth: 1, height: 68, paddingTop: 6, paddingBottom: 10 },
    tabBarLabelStyle: { fontFamily: fonts.semibold, fontSize: 12 },
    tabBarHideOnKeyboard: true,
  };
}

/** Icon renderer for a tab; React Navigation passes the tint color. */
export const tabIcon = (name: IconName) =>
  ({ color, size }: { color: string; size: number }) => <Icon name={name} size={size} color={color} />;

export function TabFallback() {
  const { colors } = useTheme();
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.ground }}>
      <ActivityIndicator color={colors.primary} />
    </View>
  );
}
