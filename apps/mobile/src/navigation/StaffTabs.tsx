import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

const Tab = createBottomTabNavigator();

const TasksScreen   = React.lazy(() => import('../screens/staff/TasksScreen'));
const ProfileScreen = React.lazy(() => import('../screens/staff/ProfileScreen'));

export default function StaffTabs() {
  return (
    <Tab.Navigator screenOptions={{ headerShown: false }}>
      <Tab.Screen name="Tasks"   component={TasksScreen}   options={{ title: 'My Tasks' }} />
      <Tab.Screen name="Profile" component={ProfileScreen} options={{ title: 'Profile' }}  />
    </Tab.Navigator>
  );
}
