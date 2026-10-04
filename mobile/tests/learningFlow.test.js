const assert = require('node:assert/strict');
const { test } = require('node:test');
const { getLearningFlow } = require('../src/utils/learningFlow');

test('writing flow uses the subject and lesson journey and opens the existing writing activity', () => {
  const flow = getLearningFlow('writing');
  const lesson = { id: 'lesson-1', title: 'Introduction to Media and Information Literacy' };

  assert.equal(flow.libraryTitle, 'Writing Enhancement');
  assert.equal(flow.destination, 'WritingActivity');
  assert.deepEqual(flow.lessonParams(lesson), {
    lessonId: 'lesson-1',
    lessonTitle: 'Introduction to Media and Information Literacy',
  });
});

test('reading remains the default flow and continues opening lesson detail', () => {
  const flow = getLearningFlow();

  assert.equal(flow.libraryTitle, 'Reading library');
  assert.equal(flow.destination, 'Lesson');
  assert.deepEqual(flow.lessonParams({ id: 'lesson-1' }), { lessonId: 'lesson-1' });
});
