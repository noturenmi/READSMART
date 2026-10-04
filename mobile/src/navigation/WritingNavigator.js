import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ReadingScreen } from '../screens/ReadingScreen';
import { ReadingLessonsScreen } from '../screens/ReadingLessonsScreen';
import { WritingActivityScreen } from '../screens/WritingActivityScreen';
import { WritingResultScreen } from '../screens/WritingResultScreen';

const Stack = createNativeStackNavigator();

export function WritingNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="WritingSubjects" component={ReadingScreen} initialParams={{ flow: 'writing' }} />
      <Stack.Screen name="Lessons" component={ReadingLessonsScreen} />
      <Stack.Screen name="WritingActivity" component={WritingActivityScreen} />
      <Stack.Screen name="WritingResult" component={WritingResultScreen} />
    </Stack.Navigator>
  );
}
