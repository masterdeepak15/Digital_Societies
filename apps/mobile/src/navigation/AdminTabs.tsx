import React, { Suspense } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { TabFallback, tabIcon, useTabScreenOptions } from './tabBar';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();
const ComplaintDetailScreen = React.lazy(() => import('../screens/shared/ComplaintDetailScreen'));

// Lazy imports for code splitting
const DashboardScreen          = React.lazy(() => import('../screens/admin/DashboardScreen'));
const BillingScreen            = React.lazy(() => import('../screens/admin/BillingScreen'));
const ComplaintsScreen         = React.lazy(() => import('../screens/admin/ComplaintsScreen'));
const MembersScreen            = React.lazy(() => import('../screens/admin/MembersScreen'));
const ParkingManagementScreen  = React.lazy(() => import('../screens/admin/ParkingManagementScreen'));
const SettingsScreen           = React.lazy(() => import('../screens/admin/SettingsScreen'));

function Tabs() {
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

/** The tabs, plus screens that open on top of them (a complaint's detail and updates). */
export default function AdminTabs() {
  return (
    <Suspense fallback={<TabFallback />}>
      <Stack.Navigator>
        <Stack.Screen name="Tabs" component={Tabs} options={{ headerShown: false }} />
        <Stack.Screen name="ComplaintDetail" component={ComplaintDetailScreen} options={{ title: 'Complaint' }} />
      </Stack.Navigator>
    </Suspense>
  );
}
