import React, { Suspense } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

const Tab = createBottomTabNavigator();

const TabFallback = () => (
  <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
    <ActivityIndicator />
  </View>
);

const TasksScreen   = React.lazy(() => import('../screens/staff/TasksScreen'));
const ProfileScreen = React.lazy(() => import('../screens/staff/ProfileScreen'));

export default function StaffTabs() {
  return (
    <Suspense fallback={<TabFallback />}>
      <Tab.Navigat