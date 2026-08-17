import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import type { ApiClient } from '@kiosk/core';
import { DashboardScreen } from '../screens/DashboardScreen';
import { WebOrdersScreen } from '../screens/WebOrdersScreen';
import { UsersScreen } from '../screens/UsersScreen';
import { AnalyticsScreen } from '../screens/AnalyticsScreen';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function MainTabs({ api, onLogout }: { api: ApiClient; onLogout: () => void }) {
  return (
    <Tab.Navigator>
      <Tab.Screen name="Overview" options={{ title: 'Overview' }}>
        {() => <DashboardScreen api={api} onLogout={onLogout} />}
      </Tab.Screen>
      <Tab.Screen name="Orders" options={{ title: 'Web Orders' }}>
        {() => <WebOrdersScreen api={api} />}
      </Tab.Screen>
      <Tab.Screen name="Users" options={{ title: 'Users' }}>
        {() => <UsersScreen api={api} />}
      </Tab.Screen>
      <Tab.Screen name="Analytics" options={{ title: 'Analytics' }}>
        {() => <AnalyticsScreen api={api} />}
      </Tab.Screen>
    </Tab.Navigator>
  );
}

export function AppNavigator({ api, onLogout }: { api: ApiClient; onLogout: () => void }) {
  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Main">{() => <MainTabs api={api} onLogout={onLogout} />}</Stack.Screen>
      </Stack.Navigator>
    </NavigationContainer>
  );
}
