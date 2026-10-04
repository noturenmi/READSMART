import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { WritingScreen } from '../screens/WritingScreen';
import { WritingActivityScreen } from '../screens/WritingActivityScreen';
import { WritingResultScreen } from '../screens/WritingResultScreen';

const Stack = createNativeStackNavigator();

export function WritingNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="WritingActivities" component={WritingScreen} />
      <Stack.Screen name="WritingActivity" component={WritingActivityScreen} />
      <Stack.Screen name="WritingResult" component={WritingResultScreen} />
    </Stack.Navigator>
  );
}
