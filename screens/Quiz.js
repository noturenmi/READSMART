import { View, Text, TextInput, TouchableOpacity } from 'react-native'
import { useState } from 'react'

export default function Quiz({ route, navigation }) {
  const { questions, keywords } = route.params

  const [answers, setAnswers] = useState(Array(questions.length).fill(""))

  const handleChange = (text, index) => {
    let newAnswers = [...answers]
    newAnswers[index] = text
    setAnswers(newAnswers)
  }

  const handleSubmit = () => {
    navigation.navigate('Results', {
    keywords,
    questions,
    answers
    })
  }

  return (
    <View style={{ flex: 1, padding: 20 }}>

      <Text style={{ fontSize: 24, fontWeight: 'bold', marginBottom: 10 }}>
        Answer the Questions
      </Text>

      {questions.map((q, index) => (
        <View key={index} style={{ marginBottom: 15 }}>
          <Text>{index + 1}. {q}</Text>

          <TextInput
            placeholder="Your answer..."
            value={answers[index]}
            onChangeText={(text) => handleChange(text, index)}
            style={{
              borderWidth: 1,
              borderColor: '#ccc',
              padding: 8,
              marginTop: 5,
              borderRadius: 8
            }}
          />
        </View>
      ))}

      <TouchableOpacity
        onPress={handleSubmit}
        style={{
          backgroundColor: '#007BFF',
          padding: 15,
          borderRadius: 10
        }}
      >
        <Text style={{ color: 'white', textAlign: 'center' }}>
          Submit Answers
        </Text>
      </TouchableOpacity>

    </View>
  )
}