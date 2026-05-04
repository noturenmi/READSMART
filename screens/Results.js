import { View, Text } from 'react-native'

export default function Results({ route }) {
  const { keywords, questions } = route.params

  return (
    <View style={{ flex: 1, padding: 20 }}>

      <Text style={{ fontSize: 24, fontWeight: 'bold', marginBottom: 10 }}>
        Analysis Results
      </Text>

      <Text style={{ fontSize: 18, marginTop: 10 }}>
        Keywords:
      </Text>
      <Text style={{ marginBottom: 15 }}>
        {keywords.join(', ')}
      </Text>

      <Text style={{ fontSize: 18 }}>
        Comprehension Questions:
      </Text>

      {questions.map((q, index) => (
        <Text key={index} style={{ marginTop: 5 }}>
          {index + 1}. {q}
        </Text>
      ))}

    </View>
  )
}