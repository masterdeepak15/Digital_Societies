import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Colors } from '../theme/colors';

const Tab = createBottomTabNavigator();

const HomeScreen       = React.lazy(() => import('../screens/resident/HomeScreen'));
const BillsScreen      = React.lazy(() => import('../screens/resident/BillsScreen'));
const VisitorsScreen   = React.lazy(() => import('../screens/resident/VisitorsScreen'));
const ComplaintsScreen = React.lazy(() => import('../screens/resident/ComplaintsScreen'));
const NoticesScreen    = React.lazy(() => import('../screens/resident/NoticesScreen'));
const ProfileScreen    = React.lazy(() => import('../screens/resident/ProfileScreen'));

export default function ResidentTabs() {
  return (
    <Tab.Navigator
      screenOptions={{ tabBarActiveTintColor: Colors.primary, headerShown: false }}>
      <Tab.Screen name="Home"       component={HomeScreen}       options={{ title: 'Home' }}        />
      <Tab.Screen name="Bills"      component={BillsScreen}      options={{ title: 'My Bills' }}    />
      <Tab.Screen name="Visitors"   component={VisitorsScreen}   options={{ title: 'Visitors' }}    />
      <Tab.Screen name="Complaints" component={ComplaintsScreen} options={{ title: 'Complaints' }}  />
      <Tab.Screen name="Notices"    component={NoticesScreen}    options={{ title: 'Notices' }}     />
      <Tab.Screen name="Profile"    component={ProfileScreen}    options={{ title: 'Profile' }}     />
    </Tab.Navigator>
  );
}
