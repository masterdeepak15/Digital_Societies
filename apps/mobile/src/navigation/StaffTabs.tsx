import React, { Suspense } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { TabFallback, tabIcon, useTabScreenOptions } from './tabBar';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();
const ComplaintDetailScreen = React.lazy(() => import('../screens/shared/ComplaintDetailScreen'));

const TasksScreen   = React.lazy(() => import('../screens/staff/TasksScreen'));
const ProfileScreen = React.lazy(() => import('../screens/staff/ProfileScreen'));

function Tabs() {
  const options = useTabScreenOptions();
  return (
    <Suspense fallback={<TabFallback />}>
      <Tab.Navigator screenOptions={options}>
        <Tab.Screen name="Tasks"   component={TasksScreen}   options={{ title: 'My tasks', tabBarIcon: tabIcon('check-square') }} />
        <Tab.Screen name="Profile" component={ProfileScreen} options={{ title: 'Profile',  tabBarIcon: tabIcon('user') }} />
      </Tab.Navigator>
    </Suspense>
  );
}

/** The tabs, plus screens that open on top of them (a complaint's detail and updates). */
export default function StaffTabs() {
  return (
    <Suspense fallback={<TabFallback />}>
      <Stack.Navigator>
        <Stack.Screen name="Tabs" component={Tabs} options={{ headerShown: false }} />
        <Stack.Screen name="ComplaintDetail" component={ComplaintDetailScreen} options={{ title: 'Complaint' }} />
      </Stack.Navigator>
    </Suspense>
  );
}
