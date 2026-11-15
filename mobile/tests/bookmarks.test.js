const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

const read = (relativePath) => fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');

test('bookmark API uses the existing authenticated client for save, remove, status, and saved lessons', () => {
  const api = read('src/services/api.js');
  assert.match(api, /getSavedLessons\(subjectId\)[\s\S]*?request\(`\/bookmarks\$\{query\}`, \{ authenticated: true \}\)/);
  assert.match(api, /getLessonBookmark\(lessonId\)[\s\S]*?request\(`\/bookmarks\//);
  assert.match(api, /bookmarkLesson\(lessonId\)[\s\S]*?method: 'PUT', authenticated: true/);
  assert.match(api, /removeLessonBookmark\(lessonId\)[\s\S]*?method: 'DELETE', authenticated: true/);
  assert.doesNotMatch(api, /bookmarkLesson\(userId|studentId/);
});

test('Saved Lessons is reachable from Reading and navigates to a saved lesson by its database ID', () => {
  const navigator = read('src/navigation/ReadingNavigator.js');
  const reading = read('src/screens/ReadingScreen.js');
  const saved = read('src/screens/SavedLessonsScreen.js');
  assert.match(navigator, /name="SavedLessons" component=\{SavedLessonsScreen\}/);
  assert.match(reading, /navigation\.navigate\('SavedLessons'\)/);
  assert.match(saved, /api\.getSavedLessons\(\)/);
  assert.match(saved, /navigation\.navigate\('Lesson', \{ lessonId: lesson\.id \}\)/);
  assert.match(saved, /No saved lessons yet/);
  assert.match(saved, /selectedSubjectId/);
});

test('lesson lists and detail expose an accessible bookmark control and restore state on request failure', () => {
  const component = read('src/components/ReadingComponents.js');
  const lessons = read('src/screens/ReadingLessonsScreen.js');
  const detail = read('src/screens/LessonDetailScreen.js');
  assert.match(component, /accessibilityLabel=.*Remove lesson bookmark/);
  assert.match(component, /accessibilityLabel=.*Bookmark lesson/);
  assert.match(lessons, /api\.getSavedLessons\(\)/);
  assert.match(lessons, /useFocusEffect\(useCallback/);
  assert.match(lessons, /api\.removeLessonBookmark\(lessonId\)/);
  assert.match(lessons, /setBookmarkActionError\(true\)/);
  assert.match(detail, /api\.getLessonBookmark\(lessonId\)/);
  assert.match(detail, /<BookmarkButton/);
  assert.match(detail, /setBookmarked\(wasBookmarked\)/);
});
