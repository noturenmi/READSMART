import { View, Text, TouchableOpacity } from 'react-native'

export default function Dashboard({ navigation }) {
  return (
    <View style={{
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: '#f2f2f2'
    }}>

      <Text style={{ fontSize: 32, fontWeight: 'bold' }}>
        READSMART
      </Text>

      <Text style={{ marginVertical: 10, textAlign: 'center' }}>
        Smart Reading Comprehension & Writing Assistant
      </Text>

      <TouchableOpacity
        onPress={() => navigation.navigate('Analyzer')}
        style={{
          marginTop: 20,
          backgroundColor: '#4A90E2',
          padding: 15,
          borderRadius: 10
        }}
      >
        <Text style={{ color: 'white', fontWeight: 'bold' }}>
          Start Analyzer
        </Text>
      </TouchableOpacity>

    </View>
  )
}