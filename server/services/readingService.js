const Lesson = require('../models/Lesson');
const Subject = require('../models/Subject');

const publishedLessonFilter = { isPublished: true, contentStatus: 'ready' };

function serializeSubject(subject, counts = {}) {
  const plannedLessonCount = counts.plannedLessonCount || 0;
  const availableLessonCount = counts.availableLessonCount || 0;
  return {
    id: String(subject._id),
    code: subject.code,
    name: subject.name,
    description: subject.description || '',
    order: subject.order,
    availableLessonCount,
    plannedLessonCount,
    pendingLessonCount: Math.max(0, plannedLessonCount - availableLessonCount),
  };
}

function serializeLesson(lesson, includeBody = false) {
  const result = {
    id: String(lesson._id),
    subject: lesson.subject && lesson.subject._id
      ? {
        id: String(lesson.subject._id),
        code: lesson.subject.code,
        name: lesson.subject.name,
      }
      : String(lesson.subject),
    title: lesson.title,
    lessonNumber: lesson.lessonNumber,
    overview: lesson.overview || '',
    updatedAt: lesson.updatedAt,
  };

  if (includeBody) {
    result.lesson = lesson.lesson || '';
    result.discussion = lesson.discussion || '';
    result.example = lesson.example || '';
    result.keyConcepts = Array.isArray(lesson.keyConcepts) ? lesson.keyConcepts : [];
    result.keyTakeaway = lesson.keyTakeaway || '';
  }
  return result;
}

async function subjectCounts(subjectIds) {
  if (!subjectIds.length) return new Map();
  const entries = await Lesson.aggregate([
    { $match: { subject: { $in: subjectIds } } },
    {
      $group: {
        _id: '$subject',
        plannedLessonCount: { $sum: 1 },
        availableLessonCount: {
          $sum: {
            $cond: [
              { $and: [{ $eq: ['$isPublished', true] }, { $eq: ['$contentStatus', 'ready'] }] },
              1,
              0,
            ],
          },
        },
      },
    },
  ]);
  return new Map(entries.map((entry) => [String(entry._id), entry]));
}

async function listSubjects() {
  const subjects = await Subject.find({ isActive: true }).sort({ order: 1, name: 1 }).lean();
  const counts = await subjectCounts(subjects.map((subject) => subject._id));
  return subjects.map((subject) => serializeSubject(subject, counts.get(String(subject._id))));
}

async function getSubject(subjectId) {
  const subject = await Subject.findOne({ _id: subjectId, isActive: true }).lean();
  if (!subject) return null;
  const counts = await subjectCounts([subject._id]);
  return serializeSubject(subject, counts.get(String(subject._id)));
}

async function listPublishedLessons(subjectId) {
  const subject = await Subject.findOne({ _id: subjectId, isActive: true }).lean();
  if (!subject) return null;
  const lessons = await Lesson.find({ subject: subject._id, ...publishedLessonFilter })
    .select('subject title lessonNumber overview updatedAt')
    .sort({ lessonNumber: 1 })
    .lean();
  const counts = await subjectCounts([subject._id]);
  return {
    subject: serializeSubject(subject, counts.get(String(subject._id))),
    lessons: lessons.map((lesson) => serializeLesson(lesson)),
  };
}

async function getPublishedLesson(lessonId) {
  const lesson = await Lesson.findOne({ _id: lessonId, ...publishedLessonFilter })
    .populate({ path: 'subject', select: 'name code' })
    .lean();
  return lesson ? serializeLesson(lesson, true) : null;
}

module.exports = { getPublishedLesson, getSubject, listPublishedLessons, listSubjects };
