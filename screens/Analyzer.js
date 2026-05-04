import { View, Text, TextInput, TouchableOpacity } from 'react-native'
import { useState } from 'react'

export default function Analyzer({ navigation }) {
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)

  const handleAnalyze = () => {
    if (!text.trim()) {
      alert("Please enter text first.")
      return
    }

    setLoading(true)

    setTimeout(() => {
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

      // QUESTIONS (CLEAN + CONTROLLED)
      let questions = []

      keywords.forEach(word => {
        if (questions.length < 10) {
          questions.push(`What is the meaning of "${word}" in the text?`)
        }
        if (questions.length < 10) {
          questions.push(`How is "${word}" used in the context?`)
        }
      })

      const fixedQuestions = [
        "What is the main idea of the text?",
        "Why is this text important for understanding?",
        "What can be learned from the text?"
      ]

      fixedQuestions.forEach(q => {
        if (questions.length < 10) {
          questions.push(q)
        }
      })

      // safety minimum
      if (questions.length < 5) {
        questions = fixedQuestions
      }

      questions = questions.slice(0, 10)

      setLoading(false)

      navigation.navigate('Quiz', {
        keywords,
        questions
      })

    }, 1200)
  }

  return (
    <View style={{ flex: 1, padding: 20 }}>

      {loading && (
        <Text style={{ marginBottom: 10, color: 'gray' }}>
          Analyzing text...
        </Text>
      )}

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