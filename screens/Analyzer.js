import { View, Text, TextInput, TouchableOpacity } from 'react-native'
import { useState } from 'react'

export default function Analyzer() {
  const [text, setText] = useState('')

  const handleAnalyze = () => {
    alert("Text received:\n\n" + text)
  }

  return (
    <View style={{
      flex: 1,
      padding: 20,
      backgroundColor: '#fff'
    }}>

      <Text style={{ fontSize: 22, fontWeight: 'bold', marginBottom: 10 }}>
        Enter Academic Text
      </Text>

      <TextInput
        placeholder="Paste or type text here..."
        value={text}
        onChangeText={setText}
        multiline
        style={{
          borderWidth: 1,
          borderColor: '#ccc',
          padding: 10,
          height: 150,
          borderRadius: 10,
          marginBottom: 20
        }}
      />

      <TouchableOpacity
        onPress={handleAnalyze}
        style={{
          backgroundColor: '#28a745',
          padding: 15,
          borderRadius: 10
        }}
      >
        <Text style={{ color: 'white', textAlign: 'center', fontWeight: 'bold' }}>
          Analyze Text
        </Text>
      </TouchableOpacity>

    </View>
  )
}