const Lesson = require('../models/Lesson');
const LessonBookmark = require('../models/LessonBookmark');
const Subject = require('../models/Subject');
const { AppError } = require('../utils/AppError');

const publishedLessonFilter = { isPublished: true, contentStatus: 'ready' };

async function getVisibleLesson(lessonId) {
  const lesson = await Lesson.findOne({ _id: lessonId, ...publishedLessonFilter })
    .populate({ path: 'subject', match: { isActive: true }, select: 'name code' })
    .lean();
  return lesson?.subject ? lesson : null;
}

function serializeBookmark(bookmark, lesson) {
  return {
    id: String(bookmark._id),
    createdAt: bookmark.createdAt,
    lesson: {
      id: String(lesson._id),
      title: lesson.title,
      lessonNumber: lesson.lessonNumber,
      overview: lesson.overview || '',
      subject: {
        id: String(lesson.subject._id),
        code: lesson.subject.code,
        name: lesson.subject.name,
      },
    },
  };
}

async function listBookmarks(userId, subjectId) {
  let lessonFilter = {};
  if (subjectId) {
    const subject = await Subject.findOne({ _id: subjectId, isActive: true }).select('_id').lean();
    if (!subject) throw new AppError('This subject is not available.', 404, 'SUBJECT_NOT_FOUND');
    const lessonIds = await Lesson.find({ subject: subject._id, ...publishedLessonFilter }).distinct('_id');
    lessonFilter = { lesson: { $in: lessonIds } };
  }

  const bookmarks = await LessonBookmark.find({ user: userId, ...lessonFilter })
    .sort({ createdAt: -1, _id: -1 })
    .lean();
  if (!bookmarks.length) return { bookmarks: [] };

  const lessonIds = bookmarks.map(({ lesson }) => lesson);
  const lessons = await Lesson.find({ _id: { $in: lessonIds }, ...publishedLessonFilter })
    .populate({ path: 'subject', match: { isActive: true }, select: 'name code' })
    .lean();
  const lessonById = new Map(lessons.filter(({ subject }) => subject).map((lesson) => [String(lesson._id), lesson]));

  return {
    bookmarks: bookmarks.flatMap((bookmark) => {
      const lesson = lessonById.get(String(bookmark.lesson));
      return lesson ? [serializeBookmark(bookmark, lesson)] : [];
    }),
  };
}

async function getBookmarkStatus(userId, lessonId) {
  const lesson = await getVisibleLesson(lessonId);
  if (!lesson) throw new AppError('This lesson is not available.', 404, 'LESSON_NOT_FOUND');
  const bookmark = await LessonBookmark.exists({ user: userId, lesson: lessonId });
  return { lessonId: String(lessonId), isBookmarked: Boolean(bookmark) };
}

async function addBookmark(userId, lessonId) {
  const lesson = await getVisibleLesson(lessonId);
  if (!lesson) throw new AppError('This lesson is not available.', 404, 'LESSON_NOT_FOUND');

  let bookmark;
  try {
    bookmark = await LessonBookmark.findOneAndUpdate(
      { user: userId, lesson: lessonId },
      { $setOnInsert: { user: userId, lesson: lessonId } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    ).lean();
  } catch (error) {
    // A concurrent duplicate PUT can race the unique index; treat it as the same idempotent save.
    if (error?.code !== 11000) throw error;
    bookmark = await LessonBookmark.findOne({ user: userId, lesson: lessonId }).lean();
    if (!bookmark) throw error;
  }

  return { lessonId: String(lessonId), isBookmarked: true, createdAt: bookmark.createdAt };
}

async function removeBookmark(userId, lessonId) {
  await LessonBookmark.deleteOne({ user: userId, lesson: lessonId });
  return { lessonId: String(lessonId), isBookmarked: false };
}

module.exports = { addBookmark, getBookmarkStatus, listBookmarks, removeBookmark };
