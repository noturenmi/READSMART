import { View, Text, TextInput, TouchableOpacity } from 'react-native'
import { useState } from 'react'

export default function Analyzer({ navigation }) {
  const [text, setText] = useState('')

  const handleAnalyze = () => {
  if (!text.trim()) {
    alert("Please enter text first.")
    return
  }

  let words = text.toLowerCase().split(/\W+/)

  const stopwords = [
    "the","is","and","a","to","of","in","that","it","on","for","with",
    "as","are","was","were","by","an","be","this","which","or"
  ]

  let filtered = words.filter(word => 
    word && !stopwords.includes(word)
  )

  let freq = {}
  filtered.forEach(word => {
    freq[word] = (freq[word] || 0) + 1
  })

  let keywords = Object.keys(freq)
    .sort((a, b) => freq[b] - freq[a])
    .slice(0, 5)

  let questions = keywords.map(word => {
  return `What is ${word}?`
})

// add extra questions
questions.push("What is the main idea of the text?")
questions.push("Why is this topic important?")

  navigation.navigate('Quiz', {
  keywords,
  questions
  })
}

  return (
    <View style={{ flex: 1, padding: 20 }}>

      <Text style={{ fontSize: 22, fontWeight: 'bold', marginBottom: 10 }}>
        Enter Academic Text
      </Text>

      <TextInput
        placeholder="Paste your academic text here..."
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