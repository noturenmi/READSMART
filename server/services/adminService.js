const ActivityRecord = require('../models/ActivityRecord');
const Lesson = require('../models/Lesson');
const ReadingQuestion = require('../models/ReadingQuestion');
const Subject = require('../models/Subject');
const User = require('../models/User');
const WritingActivity = require('../models/WritingActivity');
const progressService = require('./progressService');
const recommendationService = require('./recommendationService');
const achievementService = require('./achievementService');
const learningReportService = require('./learningReportService');
const writingService = require('./writingService');
const { rubricCriteria } = require('../utils/writingRubric');
const { AppError } = require('../utils/AppError');

function notFound(message, code) {
  throw new AppError(message, 404, code);
}

function conflict(message, code = 'DUPLICATE_RECORD') {
  throw new AppError(message, 409, code);
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function serializeSubject(subject) {
  return {
    id: String(subject._id),
    name: subject.name,
    code: subject.code,
    description: subject.description || '',
    order: subject.order,
    isActive: subject.isActive,
    createdAt: subject.createdAt,
    updatedAt: subject.updatedAt,
  };
}

function serializeLesson(lesson) {
  return {
    id: String(lesson._id),
    subjectId: String(lesson.subject?._id || lesson.subject),
    title: lesson.title,
    lessonNumber: lesson.lessonNumber,
    overview: lesson.overview || '',
    lesson: lesson.lesson || '',
    discussion: lesson.discussion || '',
    example: lesson.example || '',
    keyConcepts: Array.isArray(lesson.keyConcepts) ? lesson.keyConcepts : [],
    keyTakeaway: lesson.keyTakeaway || '',
    contentStatus: lesson.contentStatus,
    isPublished: lesson.isPublished,
    createdAt: lesson.createdAt,
    updatedAt: lesson.updatedAt,
  };
}

function serializeQuestion(question) {
  return {
    id: String(question._id),
    lessonId: String(question.lesson),
    question: question.question,
    questionType: question.questionType,
    choices: question.choices,
    correctAnswer: question.correctAnswer,
    explanation: question.explanation,
    points: question.points,
    order: question.order,
    isPublished: question.isPublished,
  };
}

function serializeWritingActivity(activity) {
  return {
    id: String(activity._id),
    lessonId: String(activity.lesson),
    title: activity.title,
    prompt: activity.prompt,
    instructions: activity.instructions,
    minimumWords: activity.minimumWords,
    maximumWords: activity.maximumWords,
    criteria: activity.criteria,
    isPublished: activity.isPublished,
    createdAt: activity.createdAt,
    updatedAt: activity.updatedAt,
  };
}

async function getDashboard() {
  const [totalStudents, totalSubjects, totalLessons, publishedLessons, totalReadingQuestions, totalWritingActivities, activityRows] = await Promise.all([
    User.countDocuments({ role: 'student' }),
    Subject.countDocuments({}),
    Lesson.countDocuments({}),
    Lesson.countDocuments({ isPublished: true, contentStatus: 'ready' }),
    ReadingQuestion.countDocuments({}),
    WritingActivity.countDocuments({}),
    ActivityRecord.find({})
      .sort({ createdAt: -1 })
      .limit(8)
      .populate({ path: 'user', select: 'name' })
      .populate({ path: 'lesson', select: 'title lessonNumber subject', populate: { path: 'subject', select: 'name' } })
      .select('activityType user lesson createdAt')
      .lean(),
  ]);
  const labels = {
    reading_assessment: 'Reading Assessment Completed',
    writing_activity: 'Writing Activity Submitted',
    lesson_completion: 'Lesson Completed',
  };
  return {
    totalStudents,
    totalSubjects,
    totalLessons,
    publishedLessons,
    totalReadingQuestions,
    totalWritingActivities,
    recentActivity: activityRows.map((row) => ({
      id: String(row._id),
      activity: labels[row.activityType] || 'Learning Activity',
      studentName: row.user?.name || 'Student account',
      lessonTitle: row.lesson?.title || 'Lesson',
      lessonNumber: row.lesson?.lessonNumber || null,
      subjectName: row.lesson?.subject?.name || '',
      occurredAt: row.createdAt,
    })),
  };
}

async function listStudents({ page = 1, limit = 20 }) {
  const filter = { role: 'student' };
  const [users, total] = await Promise.all([
    User.find(filter).sort({ createdAt: -1, _id: 1 }).skip((page - 1) * limit).limit(limit)
      .select('name email role createdAt').lean(),
    User.countDocuments(filter),
  ]);
  const usersWithProgress = await Promise.all(users.map(async (user) => {
    // Reuse the canonical progress calculation so older accounts are not shown with stale/empty snapshots.
    const progress = await progressService.getStudentProgress(user._id);
    return {
      id: String(user._id),
      name: user.name,
      email: user.email,
      createdAt: user.createdAt,
      level: progress.level,
      totalXP: progress.totalXP,
      lessonsCompleted: progress.lessonsCompleted,
      totalLessons: progress.totalLessons,
      overallProgressPercentage: progress.overallProgressPercentage,
    };
  }));
  return {
    users: usersWithProgress,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}

async function getStudent(userId) {
  const user = await User.findOne({ _id: userId, role: 'student' }).select('name email role createdAt').lean();
  if (!user) notFound('This student account was not found.', 'STUDENT_NOT_FOUND');
  return { id: String(user._id), name: user.name, email: user.email, role: user.role, createdAt: user.createdAt };
}

async function getStudentProgress(userId) {
  const student = await getStudent(userId);
  const progressSnapshot = await progressService.getProgressSnapshot(userId);
  const [{ recommendations, emptyReason }, achievements, learningReport] = await Promise.all([
    recommendationService.getRecommendedLessons(userId, progressSnapshot.subjects),
    achievementService.getStudentAchievements(userId),
    learningReportService.getLearningReport(userId, { progressSnapshot }),
  ]);
  return {
    student,
    progress: progressSnapshot.progress,
    subjects: progressSnapshot.subjects,
    recommendations,
    recommendationsEmptyReason: emptyReason,
    achievements,
    learningReport,
  };
}

async function getStudentWritingSubmissionHistory(userId, pagination) {
  await getStudent(userId);
  return writingService.getWritingSubmissionHistory(userId, pagination);
}

async function getStudentWritingSubmission(userId, submissionId) {
  await getStudent(userId);
  return writingService.getWritingSubmissionDetail(userId, submissionId);
}

async function listSubjects() {
  const [subjects, lessonCounts] = await Promise.all([
    Subject.find({}).sort({ order: 1, name: 1 }).lean(),
    Lesson.aggregate([{ $group: { _id: '$subject', totalLessons: { $sum: 1 } } }]),
  ]);
  const counts = new Map(lessonCounts.map((entry) => [String(entry._id), entry.totalLessons]));
  return subjects.map((subject) => ({ ...serializeSubject(subject), totalLessons: counts.get(String(subject._id)) || 0 }));
}

async function assertUniqueSubject({ name, code }, exceptId) {
  const nameRegex = new RegExp(`^${escapeRegex(name.trim())}$`, 'i');
  const conditions = [{ name: nameRegex }, { code: code.trim().toUpperCase() }];
  const filter = { $or: conditions };
  if (exceptId) filter._id = { $ne: exceptId };
  if (await Subject.exists(filter)) conflict('A subject with this name or code already exists.', 'SUBJECT_EXISTS');
}

async function createSubject(input) {
  await assertUniqueSubject(input);
  const subject = await Subject.create(input);
  return serializeSubject(subject);
}

async function updateSubject(subjectId, input) {
  const subject = await Subject.findById(subjectId);
  if (!subject) notFound('This subject was not found.', 'SUBJECT_NOT_FOUND');
  if (input.name || input.code) {
    await assertUniqueSubject({ name: input.name || subject.name, code: input.code || subject.code }, subject._id);
  }
  Object.assign(subject, input);
  await subject.save();
  return serializeSubject(subject);
}

async function setSubjectActive(subjectId, isActive) {
  const subject = await Subject.findById(subjectId);
  if (!subject) notFound('This subject was not found.', 'SUBJECT_NOT_FOUND');
  subject.isActive = isActive;
  await subject.save();
  return serializeSubject(subject);
}

async function listLessons(subjectId) {
  const subject = await Subject.findById(subjectId).lean();
  if (!subject) notFound('This subject was not found.', 'SUBJECT_NOT_FOUND');
  const lessons = await Lesson.find({ subject: subject._id }).sort({ lessonNumber: 1 }).lean();
  return { subject: serializeSubject(subject), lessons: lessons.map(serializeLesson) };
}

async function createLesson(subjectId, input) {
  const subject = await Subject.findById(subjectId).select('_id').lean();
  if (!subject) notFound('This subject was not found.', 'SUBJECT_NOT_FOUND');
  const lesson = await Lesson.create({
    ...input,
    subject: subject._id,
    contentStatus: input.contentStatus || 'ready',
  });
  return serializeLesson(lesson);
}

async function updateLesson(lessonId, input) {
  const lesson = await Lesson.findById(lessonId);
  if (!lesson) notFound('This lesson was not found.', 'LESSON_NOT_FOUND');
  Object.assign(lesson, input);
  await lesson.save();
  return serializeLesson(lesson);
}

async function setLessonPublished(lessonId, isPublished) {
  const lesson = await Lesson.findById(lessonId);
  if (!lesson) notFound('This lesson was not found.', 'LESSON_NOT_FOUND');
  lesson.isPublished = isPublished;
  if (isPublished) lesson.contentStatus = 'ready';
  await lesson.save();
  return serializeLesson(lesson);
}

async function listQuestions(lessonId) {
  const lesson = await Lesson.findById(lessonId).select('_id title lessonNumber subject').populate('subject', 'name code').lean();
  if (!lesson) notFound('This lesson was not found.', 'LESSON_NOT_FOUND');
  const questions = await ReadingQuestion.find({ lesson: lesson._id }).select('+correctAnswer')
    .sort({ order: 1 }).lean();
  return {
    lesson: { id: String(lesson._id), title: lesson.title, lessonNumber: lesson.lessonNumber, subjectName: lesson.subject?.name || '' },
    questions: questions.map(serializeQuestion),
  };
}

async function createQuestion(lessonId, input) {
  const lesson = await Lesson.findById(lessonId).select('_id').lean();
  if (!lesson) notFound('This lesson was not found.', 'LESSON_NOT_FOUND');
  const question = await ReadingQuestion.create({ ...input, lesson: lesson._id });
  return serializeQuestion(question);
}

async function updateQuestion(questionId, input) {
  const question = await ReadingQuestion.findById(questionId).select('+correctAnswer');
  if (!question) notFound('This reading question was not found.', 'QUESTION_NOT_FOUND');
  Object.assign(question, input);
  await question.save();
  return serializeQuestion(question);
}

async function setQuestionPublished(questionId, isPublished) {
  const question = await ReadingQuestion.findById(questionId).select('+correctAnswer');
  if (!question) notFound('This reading question was not found.', 'QUESTION_NOT_FOUND');
  question.isPublished = isPublished;
  await question.save();
  return serializeQuestion(question);
}

async function getWritingActivity(lessonId) {
  const lesson = await Lesson.findById(lessonId).select('_id title lessonNumber subject').populate('subject', 'name code').lean();
  if (!lesson) notFound('This lesson was not found.', 'LESSON_NOT_FOUND');
  const activity = await WritingActivity.findOne({ lesson: lesson._id }).lean();
  return {
    lesson: { id: String(lesson._id), title: lesson.title, lessonNumber: lesson.lessonNumber, subjectName: lesson.subject?.name || '' },
    activity: activity ? serializeWritingActivity(activity) : null,
    defaultCriteria: rubricCriteria,
  };
}

async function createWritingActivity(lessonId, input) {
  const lesson = await Lesson.findById(lessonId).select('_id').lean();
  if (!lesson) notFound('This lesson was not found.', 'LESSON_NOT_FOUND');
  const existing = await WritingActivity.exists({ lesson: lesson._id });
  if (existing) conflict('This lesson already has a writing activity.', 'WRITING_ACTIVITY_EXISTS');
  const activity = await WritingActivity.create({
    ...input,
    lesson: lesson._id,
    criteria: input.criteria || rubricCriteria,
  });
  return serializeWritingActivity(activity);
}

async function updateWritingActivity(activityId, input) {
  const activity = await WritingActivity.findById(activityId);
  if (!activity) notFound('This writing activity was not found.', 'WRITING_ACTIVITY_NOT_FOUND');
  Object.assign(activity, input);
  await activity.save();
  return serializeWritingActivity(activity);
}

async function setWritingActivityPublished(activityId, isPublished) {
  const activity = await WritingActivity.findById(activityId);
  if (!activity) notFound('This writing activity was not found.', 'WRITING_ACTIVITY_NOT_FOUND');
  activity.isPublished = isPublished;
  await activity.save();
  return serializeWritingActivity(activity);
}

module.exports = {
  createLesson,
  createQuestion,
  createSubject,
  createWritingActivity,
  getDashboard,
  getStudent,
  getStudentProgress,
  getStudentWritingSubmission,
  getStudentWritingSubmissionHistory,
  getWritingActivity,
  listLessons,
  listQuestions,
  listStudents,
  listSubjects,
  setLessonPublished,
  setQuestionPublished,
  setSubjectActive,
  setWritingActivityPublished,
  updateLesson,
  updateQuestion,
  updateSubject,
  updateWritingActivity,
};
