import React, { Suspense } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useTheme } from '../theme/ThemeProvider';
import { TabFallback, tabIcon, useTabScreenOptions } from './tabBar';

const Tab = createBottomTabNavigator();

// Guard screens: LARGE buttons, minimal cognitive load, offline-first
const GateScreen     = React.lazy(() => import('../screens/guard/GateScreen'));
const LogScreen      = React.lazy(() => import('../screens/guard/LogScreen'));
const DeliveryScreen = React.lazy(() => import('../screens/guard/DeliveryScreen'));
const SOSScreen      = React.lazy(() => import('../screens/guard/SOSScreen'));
const MeScreen       = React.lazy(() => import('../screens/resident/ProfileScreen'));

export default function GuardTabs() {
  const options = useTabScreenOptions();
  const { colors, fonts } = useTheme();
  return (
    <Suspense fallback={<TabFallback />}>
      <Tab.Navigator
        screenOptions={{
          ...options,
          tabBarStyle: { ...(options.tabBarStyle as object), height: 76 },
          tabBarLabelStyle: { fontFamily: fonts.bold, fontSize: 13 },
        }}>
        <Tab.Screen name="Gate" component={GateScreen} options={{ title: 'Gate', tabBarIcon: tabIcon('log-in') }} />
        <Tab.Screen name="Log"  component={LogScreen}  options={{ title: 'Log',  tabBarIcon: tabIcon('list') }} />
        <Tab.Screen name="Sos"  component={SOSScreen}  options={{ title: 'SOS',  tabBarIcon: tabIcon('alert-triangle'), tabBarActiveTintColor: colors.danger }} />
        <Tab.Screen name="Me"   component={MeScreen}   options={{ title: 'Me',   tabBarIcon: tabIcon('user') }} />
        {/* Delivery stays registered so existing links keep working; it is opened from the Gate screen. */}
        <Tab.Screen name="Delivery" component={DeliveryScreen} options={{ title: 'Delivery', tabBarButton: () => null }} />
      </Tab.Navigator>
    </Suspense>
  );
}
