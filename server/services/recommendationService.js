const AssessmentAttempt = require('../models/AssessmentAttempt');
const Lesson = require('../models/Lesson');
const ReadingQuestion = require('../models/ReadingQuestion');
const Subject = require('../models/Subject');
const progressService = require('./progressService');

const REVIEW_SCORE_THRESHOLD = 75;
const MASTERED_SCORE_THRESHOLD = 90;
const MAX_RECOMMENDATIONS = 5;
const publishedLessonFilter = { isPublished: true, contentStatus: 'ready' };

function getAssessmentPercentage(attempt) {
  if (Number.isFinite(attempt.percentage) && attempt.percentage >= 0 && attempt.percentage <= 100) {
    return Math.round(attempt.percentage);
  }
  if (Number.isFinite(attempt.score)
    && Number.isFinite(attempt.totalPoints)
    && attempt.score >= 0
    && attempt.totalPoints > 0
    && attempt.score <= attempt.totalPoints) {
    return Math.round((attempt.score / attempt.totalPoints) * 100);
  }
  return null;
}

function timestamp(value) {
  const valueMs = new Date(value || 0).getTime();
  return Number.isFinite(valueMs) ? valueMs : 0;
}

function compareRecommendations(left, right) {
  // Rank actual mistakes first, then low latest/subject scores, repeated mistakes,
  // and finally lessons in subjects with lower existing progress. Stable fields
  // break ties so the same data always produces the same order.
  return Number(right.incorrectAnswerCount > 0) - Number(left.incorrectAnswerCount > 0)
    || left.subjectAveragePercentage - right.subjectAveragePercentage
    || left.latestPercentage - right.latestPercentage
    || right.repeatedIncorrectAnswerCount - left.repeatedIncorrectAnswerCount
    || left.subjectProgressPercentage - right.subjectProgressPercentage
    || right.submittedAt.getTime() - left.submittedAt.getTime()
    || left.lesson.lessonNumber - right.lesson.lessonNumber
    || left.lesson.id.localeCompare(right.lesson.id);
}

function getReason(candidate) {
  let reason;
  if (candidate.repeatedIncorrectAnswerCount > 0) {
    const count = candidate.repeatedIncorrectAnswerCount;
    reason = 'You missed ' + count + ' question' + (count === 1 ? '' : 's') + ' in this lesson on more than one attempt.';
  } else if (candidate.incorrectAnswerCount > 0 && candidate.latestPercentage < REVIEW_SCORE_THRESHOLD) {
    const count = candidate.incorrectAnswerCount;
    reason = 'Your latest assessment had ' + count + ' incorrect answer' + (count === 1 ? '' : 's')
      + ' and a score of ' + candidate.latestPercentage + '%.';
  } else if (candidate.incorrectAnswerCount > 0) {
    const count = candidate.incorrectAnswerCount;
    reason = 'Your latest assessment had ' + count + ' incorrect answer' + (count === 1 ? '' : 's') + '.';
  } else {
    reason = 'Your latest assessment score was ' + candidate.latestPercentage + '%, below the '
      + REVIEW_SCORE_THRESHOLD + '% review range.';
  }
  if (candidate.subjectAveragePercentage < REVIEW_SCORE_THRESHOLD
    && candidate.latestPercentage >= REVIEW_SCORE_THRESHOLD) {
    reason += ' Recent scores in this subject average ' + candidate.subjectAveragePercentage + '%.';
  } else if (candidate.subjectProgressPercentage < 25) {
    reason += ' This subject is at ' + candidate.subjectProgressPercentage + '% overall progress.';
  }
  return reason;
}

async function getRecommendedLessons(userId, subjectProgress) {
  const subjects = await Subject.find({ isActive: true })
    .select('_id name code order')
    .sort({ order: 1, name: 1 })
    .lean();
  const subjectIds = subjects.map(({ _id }) => _id);
  const lessons = subjectIds.length
    ? await Lesson.find({ subject: { $in: subjectIds }, ...publishedLessonFilter })
      .select('_id subject title lessonNumber')
      .sort({ lessonNumber: 1 })
      .lean()
    : [];
  const lessonIds = lessons.map(({ _id }) => _id);
  const assessmentLessonIds = lessonIds.length
    ? await ReadingQuestion.distinct('lesson', { lesson: { $in: lessonIds }, isPublished: true })
    : [];

  if (!assessmentLessonIds.length) {
    return { recommendations: [], emptyReason: 'no_assessment_history' };
  }

  const attempts = await AssessmentAttempt.find({
    user: userId,
    lesson: { $in: assessmentLessonIds },
  })
    .sort({ submittedAt: -1, _id: -1 })
    .select('lesson answers.questionId answers.isCorrect score totalPoints percentage submittedAt')
    .lean();

  if (!attempts.length) {
    return { recommendations: [], emptyReason: 'no_assessment_history' };
  }

  const lessonById = new Map(lessons.map((lesson) => [String(lesson._id), lesson]));
  const subjectById = new Map(subjects.map((subject) => [String(subject._id), subject]));
  const assessmentsByLesson = new Map();
  for (const attempt of attempts) {
    const lessonId = String(attempt.lesson);
    if (!lessonById.has(lessonId)) continue;
    const rows = assessmentsByLesson.get(lessonId) || [];
    rows.push(attempt);
    assessmentsByLesson.set(lessonId, rows);
  }

  // Older misses contribute to repeated difficulty. A latest strong, all-correct
  // attempt marks a lesson mastered and suppresses its older recommendations.
  const latestByLesson = new Map();
  for (const [lessonId, rows] of assessmentsByLesson) {
    rows.sort((left, right) => (
      timestamp(right.submittedAt) - timestamp(left.submittedAt)
      || String(right._id).localeCompare(String(left._id))
    ));
    const latest = rows[0];
    const latestPercentage = getAssessmentPercentage(latest);
    if (latestPercentage === null || !Array.isArray(latest.answers) || latest.answers.length === 0) continue;
    const latestIncorrectAnswers = (latest.answers || []).filter(({ isCorrect }) => isCorrect === false);
    const allIncorrectQuestionIds = new Map();
    for (const attempt of rows) {
      for (const answer of attempt.answers || []) {
        if (answer.isCorrect !== false || !answer.questionId) continue;
        const questionId = String(answer.questionId);
        allIncorrectQuestionIds.set(questionId, (allIncorrectQuestionIds.get(questionId) || 0) + 1);
      }
    }
    const repeatedIncorrectQuestionIds = new Set(
      latestIncorrectAnswers
        .map(({ questionId }) => questionId && String(questionId))
        .filter((questionId) => questionId && allIncorrectQuestionIds.get(questionId) > 1),
    );
    latestByLesson.set(lessonId, {
      latest,
      latestPercentage,
      latestIncorrectAnswers,
      repeatedIncorrectAnswerCount: repeatedIncorrectQuestionIds.size,
    });
  }

  if (!latestByLesson.size) {
    return { recommendations: [], emptyReason: 'assessment_data_incomplete' };
  }

  const latestScoresBySubject = new Map();
  for (const [lessonId, result] of latestByLesson) {
    const lesson = lessonById.get(lessonId);
    const subjectId = String(lesson.subject);
    const scores = latestScoresBySubject.get(subjectId) || [];
    scores.push(result.latestPercentage);
    latestScoresBySubject.set(subjectId, scores);
  }
  const subjectAverageById = new Map(
    [...latestScoresBySubject].map(([subjectId, scores]) => [
      subjectId,
      Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length),
    ]),
  );

  const existingSubjectProgress = subjectProgress || await progressService.getSubjectProgress(userId);
  const subjectProgressById = new Map(existingSubjectProgress.map((subject) => [
    String(subject.subjectId),
    Number.isFinite(subject.percentage) ? subject.percentage : 100,
  ]));

  const candidates = [];
  for (const [lessonId, result] of latestByLesson) {
    const { latest, latestPercentage, latestIncorrectAnswers, repeatedIncorrectAnswerCount } = result;
    const incorrectAnswerCount = latestIncorrectAnswers.length;
    if (latestPercentage >= MASTERED_SCORE_THRESHOLD && incorrectAnswerCount === 0) continue;
    // Assessment evidence is required: a missed answer or a score in the existing
    // below-75% feedback band. Subject progress only ranks these candidates.
    if (incorrectAnswerCount === 0 && latestPercentage >= REVIEW_SCORE_THRESHOLD) continue;

    const lesson = lessonById.get(lessonId);
    const subject = subjectById.get(String(lesson.subject));
    if (!subject) continue;
    const candidate = {
      lesson: {
        id: lessonId,
        title: lesson.title,
        lessonNumber: lesson.lessonNumber,
        subjectId: String(subject._id),
        subjectName: subject.name,
        subjectCode: subject.code,
      },
      latestPercentage,
      incorrectAnswerCount,
      repeatedIncorrectAnswerCount,
      subjectAveragePercentage: subjectAverageById.get(String(subject._id)) ?? latestPercentage,
      subjectProgressPercentage: subjectProgressById.get(String(subject._id)) ?? 100,
      submittedAt: new Date(timestamp(latest.submittedAt)),
    };
    candidates.push({ ...candidate, reason: getReason(candidate) });
  }

  candidates.sort(compareRecommendations);
  const recommendations = candidates.slice(0, MAX_RECOMMENDATIONS).map((candidate) => ({
    lessonId: candidate.lesson.id,
    lessonTitle: candidate.lesson.title,
    lessonNumber: candidate.lesson.lessonNumber,
    subjectId: candidate.lesson.subjectId,
    subjectName: candidate.lesson.subjectName,
    subjectCode: candidate.lesson.subjectCode,
    latestPercentage: candidate.latestPercentage,
    incorrectAnswerCount: candidate.incorrectAnswerCount,
    reason: candidate.reason,
  }));

  return {
    recommendations,
    emptyReason: recommendations.length ? null : 'no_lessons_need_review',
  };
}

module.exports = {
  getRecommendedLessons,
  getAssessmentPercentage,
  REVIEW_SCORE_THRESHOLD,
  MASTERED_SCORE_THRESHOLD,
  MAX_RECOMMENDATIONS,
};
