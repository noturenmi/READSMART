import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ReadingScreen } from '../screens/ReadingScreen';
import { ReadingLessonsScreen } from '../screens/ReadingLessonsScreen';
import { LessonDetailScreen } from '../screens/LessonDetailScreen';
import { AssessmentScreen } from '../screens/AssessmentScreen';
import { AssessmentResultScreen } from '../screens/AssessmentResultScreen';
import { AssessmentReviewScreen } from '../screens/AssessmentReviewScreen';
import { WritingActivityScreen } from '../screens/WritingActivityScreen';
import { WritingResultScreen } from '../screens/WritingResultScreen';

const Stack = createNativeStackNavigator();

export function ReadingNavigator() {
  return (
    <Stack.Navigator initialRouteName="Subjects" screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Subjects" component={ReadingScreen} />
      <Stack.Screen name="Lessons" component={ReadingLessonsScreen} />
      <Stack.Screen name="Lesson" component={LessonDetailScreen} />
      <Stack.Screen name="Assessment" component={AssessmentScreen} />
      <Stack.Screen name="AssessmentResult" component={AssessmentResultScreen} />
      <Stack.Screen name="AssessmentReview" component={AssessmentReviewScreen} />
      <Stack.Screen name="WritingActivity" component={WritingActivityScreen} />
      <Stack.Screen name="WritingResult" component={WritingResultScreen} />
    </Stack.Navigator>
  );
}
