import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { HomeScreen } from '../screens/HomeScreen';
import { DailyLearningGoalsScreen } from '../screens/DailyLearningGoalsScreen';
import { NotificationCenterScreen } from '../screens/NotificationCenterScreen';

const Stack = createNativeStackNavigator();

export function HomeNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="HomeDashboard" component={HomeScreen} />
      <Stack.Screen name="DailyGoals" component={DailyLearningGoalsScreen} />
      <Stack.Screen name="Notifications" component={NotificationCenterScreen} />
    </Stack.Navigator>
  );
}
