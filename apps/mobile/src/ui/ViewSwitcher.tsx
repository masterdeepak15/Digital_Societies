import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { useAuthStore } from '../store/authStore';
import { useTheme } from '../theme/ThemeProvider';
import { availableViews, VIEW_LABEL, VIEW_HINT, type RoleView } from '../navigation/roleViews';
import { Icon, type IconName } from './Icon';

const ICON: Record<RoleView, IconName> = { resident: 'home', admin: 'shield', guard: 'log-in', staff: 'tool' };

/**
 * Shown only to someone who holds more than one role in the society (admin and resident, guard and resident ...).
 * Each role has its own screens; this switches between them so nothing a role was given is hidden.
 */
export function ViewSwitcher() {
  const { colors, fonts, radius } = useTheme();
  const { memberships, activeSocietyId, activeView, setActiveView } = useAuthStore();
  const views = availableViews(memberships, activeSocietyId);
  if (views.length < 2) return null;

  return (
    <View accessibilityRole="tablist" style={{ flexDirection: 'row', gap: 8, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.card, padding: 6 }}>
      {views.map((v) => {
        const on = v === activeView;
        return (
          <Pressable key={v} accessibilityRole="tab" accessibilityState={{ selected: on }} accessibilityLabel={`${VIEW_LABEL[v]}. ${VIEW_HINT[v]}`}
            onPress={() => setActiveView(v)}
            style={{ flex: 1, minHeight: 44, borderRadius: radius.control, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6, paddingHorizontal: 6,
              backgroundColor: on ? colors.primary : 'transparent' }}>
            <Icon name={ICON[v]} size={16} color={on ? colors.onPrimary : colors.muted} />
            <Text numberOfLines={1} style={{ fontFamily: on ? fonts.bold : fonts.semibold, fontSize: 13, color: on ? colors.onPrimary : colors.muted }}>{VIEW_LABEL[v]}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}
