const rubricCriteria = [
  {
    key: 'grammar',
    label: 'Grammar',
    description: 'Basic sentence construction, grammar, punctuation, and spelling.',
    maximumScore: 5,
  },
  {
    key: 'vocabulary',
    label: 'Vocabulary',
    description: 'Clear, appropriate, and varied word choice. Simple vocabulary is not penalized.',
    maximumScore: 5,
  },
  {
    key: 'organization',
    label: 'Organization',
    description: 'Logical arrangement of ideas, supporting points, and a clear overall structure.',
    maximumScore: 5,
  },
  {
    key: 'coherence',
    label: 'Coherence',
    description: 'Clear connections between ideas and appropriate transitions.',
    maximumScore: 5,
  },
  {
    key: 'developmentOfIdeas',
    label: 'Development of Ideas',
    description: 'Explanation, support, and development of the response’s main ideas.',
    maximumScore: 5,
  },
];

const ratingLabels = {
  5: 'Excellent',
  4: 'Good',
  3: 'Satisfactory',
  2: 'Needs Improvement',
  1: 'Poor',
};

const criterionFeedback = {
  grammar: {
    5: 'Your writing shows strong control of grammar, punctuation, and sentence structure.',
    4: 'Your sentences are clear overall. Review a few punctuation or sentence details as you revise.',
    3: 'Your writing is understandable, but some grammar or punctuation improvements may be needed.',
    2: 'Review sentence boundaries, punctuation, and spacing to make your ideas easier to read.',
    1: 'Review basic grammar, punctuation, and sentence construction before revising your response.',
  },
  vocabulary: {
    5: 'Your word choices are clear and appropriate for the topic.',
    4: 'Your word choices fit the topic. A little more variation could make some points clearer.',
    3: 'Your vocabulary is understandable, and you may improve word variety and precision.',
    2: 'Try using a few more precise topic words while keeping your meaning clear.',
    1: 'Try using clear and appropriate words to express your ideas.',
  },
  organization: {
    5: 'Your ideas are organized clearly and follow a logical structure.',
    4: 'Your response has a clear structure. Separate or reorder a few points to improve its flow.',
    3: 'Your ideas are generally understandable but could be arranged more clearly.',
    2: 'Group related ideas and add a clearer beginning, supporting points, and conclusion.',
    1: 'Organize your ideas into a clearer beginning, supporting points, and conclusion.',
  },
  coherence: {
    5: 'Your ideas connect smoothly and are easy to follow.',
    4: 'Your ideas are connected well. Add transitions where a change between points feels abrupt.',
    3: 'Your ideas are understandable, but some connections between them could be clearer.',
    2: 'Use clearer connections and transitions to show how each point relates to the next.',
    1: 'Use clear connections and transitions between your ideas.',
  },
  developmentOfIdeas: {
    5: 'Your response develops the topic with clear explanations and supporting details.',
    4: 'Your main ideas are developed. Add another relevant explanation or example where useful.',
    3: 'Your response addresses the topic but could provide more explanation or supporting details.',
    2: 'Add explanations or examples to support the main points in your response.',
    1: 'Develop your main idea further by adding explanations, examples, or supporting details.',
  },
};

function overallFeedbackFor(percentage) {
  if (percentage >= 90) {
    return 'Excellent writing! Your response demonstrates strong organization, clear ideas, and effective use of language.';
  }
  if (percentage >= 75) {
    return 'Good work! Your response communicates your ideas clearly, with some areas that can still be improved.';
  }
  if (percentage >= 60) {
    return 'Your response shows a developing level of writing. Review the feedback and revise areas that need improvement.';
  }
  return 'Your response needs further improvement. Review the lesson, writing prompt, and rubric feedback, then try revising your work.';
}

module.exports = { criterionFeedback, overallFeedbackFor, ratingLabels, rubricCriteria };
