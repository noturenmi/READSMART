const ACHIEVEMENTS = Object.freeze([
  Object.freeze({
    id: 'first-learning-step',
    name: 'First Step',
    description: 'Complete your first reading assessment or writing activity.',
    requirement: 'Complete 1 learning activity.',
    icon: 'flag-outline',
    type: 'first_learning_activity',
    target: 1,
  }),
  Object.freeze({
    id: 'curious-reader',
    name: 'Curious Reader',
    description: 'Complete reading assessments for different lessons.',
    requirement: 'Complete assessments for 5 different lessons.',
    icon: 'book-outline',
    type: 'reading_lessons',
    target: 5,
  }),
  Object.freeze({
    id: 'writer-in-practice',
    name: 'Writer in Practice',
    description: 'Submit writing activities for different lessons.',
    requirement: 'Complete 5 different writing activities.',
    icon: 'create-outline',
    type: 'writing_activities',
    target: 5,
  }),
  Object.freeze({
    id: 'perfect-score',
    name: 'Perfect Score',
    description: 'Earn a perfect score on a completed reading assessment.',
    requirement: 'Earn 100% on one completed assessment.',
    icon: 'star-outline',
    type: 'perfect_assessment',
    target: 1,
  }),
  Object.freeze({
    id: 'across-subjects',
    name: 'Across Subjects',
    description: 'Learn across every subject with available published activities.',
    requirement: 'Complete an assessment or writing activity in every eligible subject.',
    icon: 'trophy-outline',
    type: 'all_subjects',
    target: null,
  }),
]);

const ACHIEVEMENT_IDS = Object.freeze(ACHIEVEMENTS.map(({ id }) => id));

module.exports = { ACHIEVEMENTS, ACHIEVEMENT_IDS };
