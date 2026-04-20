import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Colors } from '../theme/colors';

const Tab = createBottomTabNavigator();

// Lazy imports for code splitting
const DashboardScreen    = React.lazy(() => import('../screens/admin/DashboardScreen'));
const BillingScreen      = React.lazy(() => import('../screens/admin/BillingScreen'));
const ComplaintsScreen   = React.lazy(() => import('../screens/admin/ComplaintsScreen'));
const MembersScreen      = React.lazy(() => import('../screens/admin/MembersScreen'));
const SettingsScreen     = React.lazy(() => import('../screens/admin/SettingsScreen'));

export default function AdminTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor:   Colors.primary,
        tabBarInactiveTintColor: Colors.textSecondary,
        headerShown: false,
      }}>
      <Tab.Screen name="Dashboard"  component={DashboardScreen}  options={{ title: 'Dashboard',  tabBarIcon: () => null }} />
      <Tab.Screen name="Billing"    component={BillingScreen}    options={{ title: 'Billing',    tabBarIcon: () => null }} />
      <Tab.Screen name="Complaints" component={ComplaintsScreen} options={{ title: 'Complaints', tabBarIcon: () => null }} />
      <Tab.Screen name="Members"    component={MembersScreen}    options={{ title: 'Members',    tabBarIcon: () => null }} />
      <Tab.Screen name="Settings"   component={SettingsScreen}   options={{ title: 'Settings',   tabBarIcon: () => null }} />
    </Tab.Navigator>
  );
}
