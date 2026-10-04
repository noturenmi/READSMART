import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { HomeScreen } from '../screens/HomeScreen';
import { ReadingNavigator } from './ReadingNavigator';
import { WritingNavigator } from './WritingNavigator';
import { ProgressScreen } from '../screens/ProgressScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { colors } from '../theme';

const Tabs = createBottomTabNavigator();
const icons = {
  Home: ['home', 'home-outline'],
  Reading: ['book', 'book-outline'],
  Writing: ['create', 'create-outline'],
  Progress: ['stats-chart', 'stats-chart-outline'],
  Profile: ['person-circle', 'person-circle-outline'],
};

export function StudentTabs() {
  return (
    <Tabs.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.green,
        tabBarInactiveTintColor: colors.muted,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600', marginBottom: 3 },
        tabBarStyle: {
          height: 66,
          paddingTop: 8,
          paddingBottom: 7,
          borderTopColor: colors.border,
          backgroundColor: colors.surface,
        },
        tabBarIcon: ({ focused, color, size }) => {
          const [active, inactive] = icons[route.name];
          return <Ionicons name={focused ? active : inactive} size={size} color={color} />;
        },
      })}
    >
      <Tabs.Screen name="Home" component={HomeScreen} />
      <Tabs.Screen name="Reading" component={ReadingNavigator} />
      <Tabs.Screen name="Writing" component={WritingNavigator} />
      <Tabs.Screen name="Progress" component={ProgressScreen} />
      <Tabs.Screen name="Profile" component={ProfileScreen} />
    </Tabs.Navigator>
  );
}
