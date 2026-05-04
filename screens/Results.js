import { View, Text, ScrollView } from 'react-native'

export default function Results({ route }) {
  const { keywords, questions, answers } = route.params

  const totalQuestions = questions.length
  const answered = answers ? answers.filter(a => a.trim() !== "").length : 0
  const score = answered

  let feedback = ""
  if (score === totalQuestions) {
    feedback = "Excellent! You understood the text very well."
  } else if (score >= totalQuestions / 2) {
    feedback = "Good job! You have a fair understanding of the text."
  } else {
    feedback = "Needs improvement. Try reviewing the text again."
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: '#f5f7fa' }}>
      <View style={{ padding: 20 }}>

        <Text style={{
          fontSize: 26,
          fontWeight: 'bold',
          marginBottom: 15
        }}>
          Analysis Results
        </Text>

        {/* KEYWORDS CARD */}
        <View style={{
          backgroundColor: '#fff',
          padding: 15,
          borderRadius: 10,
          marginBottom: 15
        }}>
          <Text style={{ fontSize: 18, fontWeight: 'bold' }}>
            Keywords
          </Text>
          <Text style={{ marginTop: 5 }}>
            {keywords.join(', ')}
          </Text>
        </View>

        {/* QUESTIONS CARD */}
        <View style={{
          backgroundColor: '#fff',
          padding: 15,
          borderRadius: 10,
          marginBottom: 15
        }}>
          <Text style={{ fontSize: 18, fontWeight: 'bold' }}>
            Questions
          </Text>

          {questions.map((q, index) => (
            <Text key={index} style={{ marginTop: 5 }}>
              {index + 1}. {q}
            </Text>
          ))}
        </View>

        {/* ANSWERS CARD */}
        <View style={{
          backgroundColor: '#fff',
          padding: 15,
          borderRadius: 10,
          marginBottom: 15
        }}>
          <Text style={{ fontSize: 18, fontWeight: 'bold' }}>
            Your Answers
          </Text>

          {answers && answers.map((ans, index) => (
            <Text key={index} style={{ marginTop: 5 }}>
              {index + 1}. {ans || "No answer"}
            </Text>
          ))}
        </View>

        {/* SCORE CARD */}
        <View style={{
          backgroundColor: '#4A90E2',
          padding: 15,
          borderRadius: 10
        }}>
          <Text style={{
            fontSize: 18,
            color: 'white',
            fontWeight: 'bold'
          }}>
            Score: {score} / {totalQuestions}
          </Text>

          <Text style={{
            color: 'white',
            marginTop: 5
          }}>
            {feedback}
          </Text>
        </View>

      </View>
    </ScrollView>
  )
}