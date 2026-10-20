import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { AdminDashboardScreen } from '../screens/AdminDashboardScreen';
import { AdminUsersScreen } from '../screens/AdminUsersScreen';
import { AdminStudentProgressScreen } from '../screens/AdminStudentProgressScreen';
import { AdminSubjectsScreen } from '../screens/AdminSubjectsScreen';
import { AdminLessonsScreen } from '../screens/AdminLessonsScreen';
import { AdminQuestionsScreen } from '../screens/AdminQuestionsScreen';
import { AdminWritingActivitiesScreen } from '../screens/AdminWritingActivitiesScreen';
import { WritingHistoryScreen, WritingSubmissionDetailScreen } from '../screens/WritingHistoryScreen';

const Stack = createNativeStackNavigator();

export function AdminNavigator() {
  return (
    <Stack.Navigator initialRouteName="AdminDashboard" screenOptions={{ headerShown: false }}>
      <Stack.Screen name="AdminDashboard" component={AdminDashboardScreen} />
      <Stack.Screen name="AdminUsers" component={AdminUsersScreen} />
      <Stack.Screen name="AdminStudentProgress" component={AdminStudentProgressScreen} />
      <Stack.Screen name="AdminSubjects" component={AdminSubjectsScreen} />
      <Stack.Screen name="AdminLessons" component={AdminLessonsScreen} />
      <Stack.Screen name="AdminQuestions" component={AdminQuestionsScreen} />
      <Stack.Screen name="AdminWritingActivities" component={AdminWritingActivitiesScreen} />
      <Stack.Screen name="AdminWritingHistory" component={WritingHistoryScreen} />
      <Stack.Screen name="AdminWritingSubmissionDetail" component={WritingSubmissionDetailScreen} />
    </Stack.Navigator>
  );
}
