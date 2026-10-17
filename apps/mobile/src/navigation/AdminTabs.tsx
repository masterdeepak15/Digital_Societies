import React, { Suspense } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { TabFallback, tabIcon, useTabScreenOptions } from './tabBar';

const Tab = createBottomTabNavigator();

// Lazy imports for code splitting
const DashboardScreen          = React.lazy(() => import('../screens/admin/DashboardScreen'));
const BillingScreen            = React.lazy(() => import('../screens/admin/BillingScreen'));
const ComplaintsScreen         = React.lazy(() => import('../screens/admin/ComplaintsScreen'));
const MembersScreen            = React.lazy(() => import('../screens/admin/MembersScreen'));
const ParkingManagementScreen  = React.lazy(() => import('../screens/admin/ParkingManagementScreen'));
const SettingsScreen           = React.lazy(() => import('../screens/admin/SettingsScreen'));

export default function AdminTabs() {
  const options = useTabScreenOptions();
  return (
    <Suspense fallback={<TabFallback />}>
      <Tab.Navigator screenOptions={options}>
        <Tab.Screen name="Dashboard"  component={DashboardScreen}         options={{ title: 'Dashboard',  tabBarIcon: tabIcon('grid') }} />
        <Tab.Screen name="Billing"    component={BillingScreen}           options={{ title: 'Billing',    tabBarIcon: tabIcon('file-text') }} />
        <Tab.Screen name="Complaints" component={ComplaintsScreen}        options={{ title: 'Complaints', tabBarIcon: tabIcon('tool') }} />
        <Tab.Screen name="Members"    component={MembersScreen}           options={{ title: 'Members',    tabBarIcon: tabIcon('users') }} />
        <Tab.Screen name="Parking"    component={ParkingManagementScreen} options={{ title: 'Parking',    tabBarIcon: tabIcon('layers') }} />
        <Tab.Screen name="Settings"   component={SettingsScreen}          options={{ title: 'Settings',   tabBarIcon: tabIcon('settings') }} />
      </Tab.Navigator>
    </Suspense>
  );
}
