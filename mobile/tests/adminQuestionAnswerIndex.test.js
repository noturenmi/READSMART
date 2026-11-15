const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

const screen = fs.readFileSync(path.join(__dirname, '..', 'src', 'screens', 'AdminQuestionsScreen.js'), 'utf8');
const assessment = fs.readFileSync(path.join(__dirname, '..', 'src', 'screens', 'AssessmentScreen.js'), 'utf8');

test('admin question form reads, saves, and highlights 1-based choice numbers', () => {
  assert.match(screen, /correctAnswer: String\(question\.correctAnswer\)/);
  assert.match(screen, /correctAnswer: correctAnswerNumber/);
  assert.match(screen, /index \+ 1 === Number\(question\.correctAnswer\)/);
  assert.match(screen, /Correct choice \(1–4\)/);
  assert.match(screen, /\{index \+ 1\}\. \{choice\}/);
});

test('student assessment stores the selected 1-based choice number and submits it unchanged', () => {
  assert.match(assessment, /selectedAnswer: selections\[id\]/);
  assert.match(assessment, /\[currentQuestion\.id\]: index \+ 1/);
  assert.match(assessment, /selected=\{selections\[currentQuestion\.id\] === index \+ 1\}/);
  assert.match(assessment, /choiceNumber=\{index \+ 1\}/);
});
