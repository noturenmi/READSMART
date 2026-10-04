const assert = require('node:assert/strict');
const { test } = require('node:test');
const { cleanSpeechText, lessonToSpeechText, splitSpeechText } = require('../src/utils/textToSpeech');
const { createSpeechController } = require('../src/utils/speechController');

test('lesson speech includes the content sections in the reading order, not UI metadata', () => {
  const text = lessonToSpeechText({
    _id: '0123456789abcdef01234567',
    title: 'Lesson 8: **Information Ethics**',
    overview: 'An introduction to responsible information use.',
    lesson: 'Readers should <b>credit</b> original sources.',
    discussion: 'Attribution helps people identify the source.',
    example: 'A student cites a paragraph they paraphrased.',
    keyConcepts: ['Attribution', 'Responsible information use'],
    keyTakeaway: 'Give creators appropriate credit.',
  });
  const headings = ['Lesson 8: Information Ethics', 'Overview', '\nLesson\n', 'Discussion', 'Example', 'Key Concepts', 'Key Takeaway'];
  let previousIndex = -1;
  for (const heading of headings) {
    const index = text.indexOf(heading);
    assert.ok(index > previousIndex, `${heading} should be included in order`);
    previousIndex = index;
  }
  assert.match(text, /Readers should credit original sources/u);
  assert.doesNotMatch(text, /0123456789abcdef01234567|<b>|\*\*|READING LIBRARY|Start Assessment/u);
});

test('text cleaning removes common Markdown, HTML, links, IDs, and unnecessary spacing', () => {
  const cleaned = cleanSpeechText('# **Important** idea\n- Visit [the source](https://example.com/a). <em>Read carefully.</em>  0123456789abcdef01234567');
  assert.equal(cleaned, 'Important idea\nVisit the source. Read carefully.');
});

test('empty text produces no speech chunks; long text is divided below safe utterance length', () => {
  assert.deepEqual(splitSpeechText('  '), []);
  const source = `${'A useful sentence explains the lesson clearly. '.repeat(120)}Final takeaway.`;
  const chunks = splitSpeechText(source, 3000);
  assert.ok(chunks.length > 1);
  assert.ok(chunks.every((chunk) => chunk.length <= 3000));
  assert.ok(chunks.at(-1).endsWith('Final takeaway.'));
});

test('play starts one session, repeated play does not overlap, and stop clears the session', async () => {
  const calls = { stop: 0, speak: [], errors: [], states: [] };
  const speech = {
    async stop() { calls.stop += 1; },
    async getAvailableVoicesAsync() { return [{ identifier: 'en-test', language: 'en-US' }]; },
    speak(text, options) {
      calls.speak.push({ text, options });
      options.onStart();
    },
  };
  const controller = createSpeechController(speech, {
    supportsPause: false,
    onError: (error) => calls.errors.push(error),
    onState: (state) => calls.states.push(state),
  });

  assert.equal(await controller.play('Hello lesson.'), true);
  assert.equal(controller.getState(), 'speaking');
  assert.equal(calls.speak.length, 1);
  assert.equal(calls.speak[0].options.rate, 0.9);
  assert.equal(calls.speak[0].options.voice, 'en-test');
  assert.equal(controller.getState(), 'speaking');
  assert.equal(await controller.play('Do not start a second copy.'), false);
  assert.equal(calls.speak.length, 1);
  assert.equal(await controller.pause(), false, 'Android-style unsupported pause is not faked');
  assert.equal(await controller.stop(), true);
  assert.equal(controller.getState(), 'idle');
  assert.equal(calls.errors.length, 0);
});

test('pause and resume call the native speech methods only when supported', async () => {
  let paused = 0;
  let resumed = 0;
  const speech = {
    async stop() {},
    async pause() { paused += 1; },
    async resume() { resumed += 1; },
    async getAvailableVoicesAsync() { return []; },
    speak(_text, options) { options.onStart(); },
  };
  const controller = createSpeechController(speech, { supportsPause: true });
  await controller.play('Pause and resume this lesson.');
  assert.equal(await controller.pause(), true);
  assert.equal(controller.getState(), 'paused');
  assert.equal(await controller.resume(), true);
  assert.equal(controller.getState(), 'speaking');
  assert.equal(paused, 1);
  assert.equal(resumed, 1);
  await controller.stop({ silent: true });
});

test('empty content and speech engine errors produce friendly messages', async () => {
  const errors = [];
  const noContent = createSpeechController({ async stop() {} }, { onError: (error) => errors.push(error) });
  assert.equal(await noContent.play('   '), false);
  assert.match(errors[0], /no lesson text/u);

  const unavailable = createSpeechController({ async stop() { throw new Error('native failure'); } }, { onError: (error) => errors.push(error) });
  assert.equal(await unavailable.play('This cannot be spoken.'), false);
  assert.match(errors.at(-1), /currently unavailable on this device/u);

  const speechError = createSpeechController({
    async stop() {},
    async getAvailableVoicesAsync() { return []; },
    speak(_text, options) { options.onError(new Error('native stack details')); },
  }, { onError: (error) => errors.push(error) });
  assert.equal(await speechError.play('The engine reports a playback error.'), false);
  assert.equal(errors.at(-1), 'Text-to-Speech is currently unavailable on this device.');
  assert.doesNotMatch(errors.at(-1), /native stack details/u);
});
