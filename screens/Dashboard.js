import { View, Text, Button } from 'react-native'

export default function Dashboard() {
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      
      <Text style={{ fontSize: 28, fontWeight: 'bold' }}>
        READSMART
      </Text>

      <Text style={{ marginVertical: 10 }}>
        Reading Comprehension & Writing Support System
      </Text>

      <Button
        title="Start Analyzer"
        onPress={() => alert('Next step: Analyzer screen')}
      />

    </View>
  )
}