import { NavigationContainer } from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'

import Dashboard from './screens/Dashboard'
import Analyzer from './screens/Analyzer'
import Results from './screens/Results'

const Stack = createNativeStackNavigator()

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="Dashboard">

        <Stack.Screen 
          name="Dashboard" 
          component={Dashboard}
          options={{ headerShown: false }}
        />

        <Stack.Screen 
          name="Analyzer" 
          component={Analyzer}
          options={{ title: "READSMART Analyzer" }}
        />

        <Stack.Screen 
          name="Results" 
          component={Results}
          options={{ title: "Results" }}
        />

      </Stack.Navigator>
    </NavigationContainer>
  )
}