import React, { Suspense } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Colors } from '../theme/colors';

const TabFallback = () => (
  <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
    <ActivityIndicator color={Colors.primary} />
  </View>
);

const Tab = createBottomTabNavigator();

const HomeScreen       = React.lazy(() => import('../screens/resident/HomeScreen'));
const BillsScreen      = React.lazy(() => import('../screens/resident/BillsScreen'));
const VisitorsScreen   = React.lazy(() => import('../screens/resident/VisitorsScreen'));
const ComplaintsScreen = React.lazy(() => import('../screens/resident/ComplaintsScreen'));
const NoticesScreen    = React.lazy(() => import('../screens/resident/NoticesScreen'));
const FeedScreen       = React.lazy(() => import('../screens/resident/FeedScreen'));
const ProfileScreen    = React.lazy(() => import('../screens/resident/ProfileScreen'));

export default function ResidentTabs() {
  return (
    <Suspense fallback={<TabFallback />}>
      <Tab.Navigator
        screenOptions={{ tabBarActiveTintColor: Colors.primary, headerShown: false }}>
        <Tab.Screen name="Home"       component={HomeScreen}       options={{ title: 'Home' }}        />
        <Tab.Screen name="Feed"       component={FeedScreen}       options={{ title: 'Community' }}   />
        <Tab.Screen name="Bills"      component={BillsScreen}      options={{ title: 'My Bills' }}    />
        <Tab.Screen name="Visitors"   component={VisitorsScreen}   options={{ title: 'Visitors' }}    />
        <Tab.Screen name="Complaints" compone