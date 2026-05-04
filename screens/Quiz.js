import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform
} from 'react-native'

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
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >

      <ScrollView
        contentContainerStyle={{
          padding: 20,
          paddingBottom: 100
        }}
        keyboardShouldPersistTaps="handled"
      >

        <Text style={{
          fontSize: 24,
          fontWeight: 'bold',
          marginBottom: 15
        }}>
          Answer the Questions
        </Text>

        {questions.map((q, index) => (
          <View
            key={index}
            style={{
              backgroundColor: '#fff',
              padding: 12,
              borderRadius: 10,
              marginBottom: 15
            }}
          >

            {/* Progress indicator */}
            <Text style={{
              fontSize: 14,
              marginBottom: 5,
              color: '#666'
            }}>
              Question {index + 1} of {questions.length}
            </Text>

            {/* Question text */}
            <Text style={{ marginBottom: 8 }}>
              {q}
            </Text>

            {/* Answer input */}
            <TextInput
              placeholder="Type your answer..."
              value={answers[index]}
              onChangeText={(text) => handleChange(text, index)}
              style={{
                borderWidth: 1,
                borderColor: '#ccc',
                padding: 8,
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
            borderRadius: 10,
            marginTop: 10
          }}
        >
          <Text style={{ color: 'white', textAlign: 'center' }}>
            Submit Answers
          </Text>
        </TouchableOpacity>

      </ScrollView>

    </KeyboardAvoidingView>
  )
}