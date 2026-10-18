import React, { Suspense } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { TabFallback, tabIcon, useTabScreenOptions } from './tabBar';

const Tab = createBottomTabNavigator();

const TasksScreen   = React.lazy(() => import('../screens/staff/TasksScreen'));
const ProfileScreen = React.lazy(() => import('../screens/staff/ProfileScreen'));

export default function StaffTabs() {
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
