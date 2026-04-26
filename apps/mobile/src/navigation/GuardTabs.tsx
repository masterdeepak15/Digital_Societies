import React, { Suspense } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Colors } from '../theme/colors';

const Tab = createBottomTabNavigator();

const TabFallback = () => (
  <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
    <ActivityIndicator color={Colors.error} size="large" />
  </View>
);

// Guard screens: LARGE buttons, minimal cognitive load, offline-first
const GateScreen     = React.lazy(() => import('../screens/guard/GateScreen'));
const LogScreen      = React.lazy(() => import('../screens/guard/LogScreen'));
const DeliveryScreen = React.lazy(() => import('../screens/guard/DeliveryScreen'));
const SOSScreen      = React.lazy(() => import('../screens/guard/SOSScreen'));

export default function GuardTabs() {
  return (
    <Suspense fallback={<TabFallback />}>
      <Tab.Navigator
        screenOptions={{
          tabBarActiveTintColor: Colors.error,   // Red — urgency awareness
          headerShown:           false,
          tabBarStyle:           { height: 70, paddingBottom: 8 },
          tabBarLabelStyle:      { fontSize: 14, fontWeight: '700' },
        }}>
        <Tab.Screen name="Gate"     component={GateScreen}     options={{ title: '🚪 Gate' }}     />
        <Tab.Screen name="Log"      component={LogScreen}      options={{ title: '📋 Log' }}      />
        <Tab.Screen name="Delivery" component={DeliveryScreen} options={{ title: '📦 Delivery' }} />
        <Tab.Screen name="SOS"      component={SOSScreen}      options={{ title: '🚨 SOS' }}      />
      </Tab.Navigator>
    </Suspense>
  );
}
