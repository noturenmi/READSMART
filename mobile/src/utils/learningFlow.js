const flowDefinitions = {
  reading: {
    key: 'reading',
    libraryTitle: 'Reading library',
    librarySubtitle: 'Choose a subject to explore its lessons.',
    libraryEyebrow: 'EXPLORE & UNDERSTAND',
    noSubjectsMessage: 'Please check back when the reading library is ready.',
    lessonsSubtitle: (subject) => (
      subject?.availableLessonCount > 0
        ? `${subject.availableLessonCount} published lessons`
        : 'Lessons for this subject'
    ),
    lessonsEyebrow: (subject, subjectCode) => subject?.code || subjectCode || 'SUBJECT',
    noLessonsTitle: 'No published lessons yet.',
    noLessonsMessage: 'Lesson content is being prepared for this subject.',
    destination: 'Lesson',
    lessonParams: (lesson) => ({ lessonId: lesson.id }),
  },
  writing: {
    key: 'writing',
    libraryTitle: 'Writing Enhancement',
    librarySubtitle: 'Choose a subject, then select a lesson writing activity.',
    libraryEyebrow: 'THINK · WRITE · REFLECT',
    noSubjectsMessage: 'Please check back when writing activities are ready.',
    lessonsSubtitle: () => 'Select a lesson to open its writing activity.',
    lessonsEyebrow: () => 'WRITING ENHANCEMENT',
    noLessonsTitle: 'No writing lessons are available yet.',
    noLessonsMessage: 'Writing activities will appear here when they are ready.',
    destination: 'WritingActivity',
    lessonParams: (lesson) => ({ lessonId: lesson.id, lessonTitle: lesson.title }),
  },
};

function getLearningFlow(flow) {
  return flow === 'writing' ? flowDefinitions.writing : flowDefinitions.reading;
}

module.exports = { getLearningFlow };
