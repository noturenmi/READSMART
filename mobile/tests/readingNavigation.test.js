const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

const read = (relativePath) => fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');

test('Reading tab returns its nested stack to the subject browser after leaving the tab', () => {
  const tabs = read('src/navigation/StudentTabs.js');
  const navigator = read('src/navigation/ReadingNavigator.js');

  assert.match(tabs, /name="Reading"[\s\S]*?component=\{ReadingNavigator\}[\s\S]*?options=\{\{\s*popToTopOnBlur:\s*true\s*\}\}/);
  assert.match(tabs, /CommonActions\.reset\(\{\s*index:\s*0,\s*routes:\s*\[\{\s*name:\s*'Subjects'\s*\}\]\s*\}\)/);
  assert.match(tabs, /target:\s*readingStackKey/);
  assert.match(navigator, /<Stack\.Navigator initialRouteName="Subjects"/);
  assert.match(navigator, /<Stack\.Screen name="Subjects" component=\{ReadingScreen\} \/>/);
  assert.match(navigator, /<Stack\.Screen name="Lessons" component=\{ReadingLessonsScreen\} \/>/);
  assert.match(navigator, /<Stack\.Screen name="Lesson" component=\{LessonDetailScreen\} \/>/);
});

test('Reading browse and lesson selection continue to pass the selected subject and lesson IDs', () => {
  const subjects = read('src/screens/ReadingScreen.js');
  const lessons = read('src/screens/ReadingLessonsScreen.js');

  assert.match(subjects, /api\.getSubjects\(\)/);
  assert.match(subjects, /navigation\.navigate\('Lessons',[\s\S]*subjectId:\s*subject\.id/);
  assert.match(lessons, /api\.getLessons\(subjectId\)/);
  assert.match(lessons, /navigation\.navigate\(learningFlow\.destination, learningFlow\.lessonParams\(lesson\)\)/);
});

test('Home browse opens the Reading root while recommendations open their selected lesson directly', () => {
  const home = read('src/screens/HomeScreen.js');

  assert.match(home, /Browse reading materials[\s\S]*?navigation\.navigate\('Reading'\)/);
  assert.match(home, /navigation\.navigate\('Reading',\s*\{\s*screen:\s*'Lesson',\s*params:\s*\{\s*lessonId\s*\}\s*\}\)/);
});
