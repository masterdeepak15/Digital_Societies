import React, { Suspense } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Colors } from '../theme/colors';

const Tab = createBottomTabNavigator();

const TabFallback = () => (
  <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
    <ActivityIndicator color={Colors.primary} />
  </View>
);

// Lazy imports for code splitting
const DashboardScreen    = React.lazy(() => import('../screens/admin/DashboardScreen'));
const BillingScreen      = React.lazy(() => import('../screens/admin/BillingScreen'));
const ComplaintsScreen   = React.lazy(() => import('../screens/admin/ComplaintsScreen'));
const MembersScreen      = React.lazy(() => import('../screens/admin/MembersScreen'));
const SettingsScreen     = React.lazy(() => import('../screens/admin/SettingsScreen'));

export default function AdminTabs() {
  return (
    <Suspense fallback={<TabFallback />}>
      <Tab.Navigator
        screenOptions={{
          tabBarActiveTintColor:   Colors.primary,
          tabBarInactiveTintColor: Colors.textSecondary,
          headerShown: false,
        }}>
        <Tab.Screen name="Dashboard"  component={DashboardScreen}  options={{ title: 'Dashboard',  tabBarIcon: () => null }} />
        <Tab.Screen name="Billing"    component={BillingScreen}    options={{ title: 'Billing',    tabBarIcon: () => null }} />
        <Tab.Screen name="Complaints" component={ComplaintsScreen} options={{ title: 'Complaints', tabBarIcon: