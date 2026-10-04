const AssessmentAttempt = require('../models/AssessmentAttempt');
const Lesson = require('../models/Lesson');
const ReadingQuestion = require('../models/ReadingQuestion');
const progressService = require('./progressService');
const { AppError } = require('../utils/AppError');

const publishedLessonFilter = { isPublished: true, contentStatus: 'ready' };

function publicQuestion(question) {
  return {
    id: String(question._id),
    question: question.question,
    questionType: question.questionType,
    choices: question.choices,
    points: question.points,
    order: question.order,
  };
}

function feedbackFor(percentage) {
  if (percentage >= 90) return 'Excellent! You demonstrated a strong understanding of the lesson.';
  if (percentage >= 75) return 'Good work! You understood most of the important ideas in the lesson.';
  if (percentage >= 60) return 'You have a developing understanding of the lesson. Review the material and try again.';
  return 'Review the lesson carefully and try the assessment again.';
}

async function getLessonQuestions(lessonId) {
  const lesson = await Lesson.findOne({ _id: lessonId, ...publishedLessonFilter }).select('_id title').lean();
  if (!lesson) throw new AppError('This lesson is not available.', 404, 'LESSON_NOT_FOUND');
  const questions = await ReadingQuestion.find({ lesson: lesson._id, isPublished: true })
    .select('question questionType choices points order')
    .sort({ order: 1 })
    .lean();
  return {
    lesson: { id: String(lesson._id), title: lesson.title },
    questions: questions.map(publicQuestion),
  };
}

async function submitLessonAssessment(userId, lessonId, submittedAnswers) {
  const lesson = await Lesson.findOne({ _id: lessonId, ...publishedLessonFilter }).select('_id title').lean();
  if (!lesson) throw new AppError('This lesson is not available.', 404, 'LESSON_NOT_FOUND');

  const questions = await ReadingQuestion.find({ lesson: lesson._id, isPublished: true })
    .select('+correctAnswer question explanation choices points order')
    .sort({ order: 1 })
    .lean();
  if (questions.length === 0) {
    throw new AppError('An assessment is not available for this lesson yet.', 404, 'ASSESSMENT_NOT_FOUND');
  }
  if (submittedAnswers.length !== questions.length) {
    throw new AppError('Answer every assessment question before submitting.', 400, 'MISSING_ANSWERS');
  }

  const answerIds = submittedAnswers.map(({ questionId }) => questionId.toLowerCase());
  if (new Set(answerIds).size !== answerIds.length) {
    throw new AppError('Each assessment question can only be answered once.', 400, 'DUPLICATE_QUESTION');
  }
  const questionsById = new Map(questions.map((question) => [String(question._id), question]));
  const answers = submittedAnswers.map(({ questionId, selectedAnswer }) => {
    const question = questionsById.get(questionId.toLowerCase());
    if (!question) throw new AppError('A question is not available for this lesson.', 404, 'QUESTION_NOT_FOUND');
    if (!Number.isInteger(selectedAnswer) || selectedAnswer < 0 || selectedAnswer >= question.choices.length) {
      throw new AppError('Choose one of the available answers for every question.', 400, 'INVALID_ANSWER');
    }
    const isCorrect = selectedAnswer === question.correctAnswer;
    return {
      questionId: question._id,
      selectedAnswer,
      isCorrect,
      pointsEarned: isCorrect ? question.points : 0,
      explanation: question.explanation,
    };
  });

  const totalItems = questions.length;
  const totalPoints = questions.reduce((total, question) => total + question.points, 0);
  const score = answers.reduce((total, answer) => total + answer.pointsEarned, 0);
  const percentage = Math.round((score / totalPoints) * 100);
  const feedback = feedbackFor(percentage);
  const attempt = await AssessmentAttempt.create({
    user: userId,
    lesson: lesson._id,
    answers: answers.map(({ questionId, selectedAnswer, isCorrect, pointsEarned }) => ({
      questionId,
      selectedAnswer,
      isCorrect,
      pointsEarned,
    })),
    score,
    totalItems,
    totalPoints,
    percentage,
    submittedAt: new Date(),
  });
  await progressService.awardXP(userId, 'reading_assessment', lesson._id, attempt._id);

  return {
    attemptId: String(attempt._id),
    lesson: { id: String(lesson._id), title: lesson.title },
    score,
    totalItems,
    totalPoints,
    percentage,
    feedback,
    submittedAt: attempt.submittedAt,
    answers: answers.map(({ questionId, selectedAnswer, isCorrect, pointsEarned, explanation }) => ({
      questionId: String(questionId), selectedAnswer, isCorrect, pointsEarned, explanation,
    })),
  };
}

async function getAssessmentAttempts(userId, lessonId) {
  const lesson = await Lesson.findOne({ _id: lessonId, ...publishedLessonFilter }).select('_id title').lean();
  if (!lesson) throw new AppError('This lesson is not available.', 404, 'LESSON_NOT_FOUND');
  const attempts = await AssessmentAttempt.find({ user: userId, lesson: lesson._id })
    .sort({ submittedAt: -1 })
    .lean();
  return {
    lesson: { id: String(lesson._id), title: lesson.title },
    attempts: attempts.map((attempt) => ({
      id: String(attempt._id),
      score: attempt.score,
      totalItems: attempt.totalItems,
      totalPoints: attempt.totalPoints,
      percentage: attempt.percentage,
      submittedAt: attempt.submittedAt,
      answers: attempt.answers.map((answer) => ({
        questionId: String(answer.questionId),
        selectedAnswer: answer.selectedAnswer,
        isCorrect: answer.isCorrect,
        pointsEarned: answer.pointsEarned,
      })),
    })),
  };
}

module.exports = { feedbackFor, getAssessmentAttempts, getLessonQuestions, submitLessonAssessment };
