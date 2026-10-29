const assert = require('node:assert/strict');
const { after, before, test } = require('node:test');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const request = require('supertest');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { connectDatabase } = require('../config/database');
const { createApp } = require('../app');
const Lesson = require('../models/Lesson');
const Subject = require('../models/Subject');
const User = require('../models/User');
const WritingActivity = require('../models/WritingActivity');

const config = {
  jwtSecret: 'test-secret-that-is-long-enough-for-writing-limit-tests',
  jwtExpiresIn: '1h',
  corsOrigins: [],
};

let mongoServer;
let app;
let activity;
let token;
let lesson;

function asAdmin(req) {
  return req.set({ Authorization: `Bearer ${token}` });
}

before(async () => {
  mongoServer = await MongoMemoryServer.create();
  await connectDatabase(mongoServer.getUri('readsmart_writing_limits_test'));
  await Promise.all([User.init(), Subject.init(), Lesson.init(), WritingActivity.init()]);
  app = createApp(config);

  const admin = await User.create({
    name: 'Writing Test Admin',
    email: 'writing-limits-admin@example.com',
    passwordHash: 'test-hash',
    role: 'admin',
  });
  token = jwt.sign({ sub: String(admin._id) }, config.jwtSecret, {
    expiresIn: '1h', issuer: 'readsmart-api', audience: 'readsmart-mobile',
  });

  const subject = await Subject.create({
    name: 'Writing Limit Test Subject',
    code: 'WLIMIT',
    description: 'Temporary subject for writing activity validation tests.',
    order: 1,
  });
  lesson = await Lesson.create({
    subject: subject._id,
    title: 'Writing limit validation lesson',
    lessonNumber: 1,
    overview: 'A lesson created only for testing the admin writing form.',
    lesson: 'This lesson contains enough content to meet the ready lesson requirement.',
    discussion: 'A test discussion that is unrelated to score calculations.',
    example: 'A sample example for this integration test.',
    keyConcepts: ['Validation'],
    keyTakeaway: 'Long prompts should be accepted within the configured limit.',
    contentStatus: 'ready',
    isPublished: true,
  });
});

after(async () => {
  await mongoose.disconnect();
  if (mongoServer) await mongoServer.stop();
});

test('admin creates and edits long multiline writing content, with clear field-specific limits', async () => {
  const title = `Writing activity ${'x'.repeat(160 - 'Writing activity '.length)}`;
  const prompt = [
    'Explain one important idea from the lesson and support your response with an example.',
    'Connect the idea to the broader topic, include details from the lesson, organize your reasoning clearly, and conclude by explaining why the idea matters.',
  ].join('\n\n');
  const instructions = [
    'Write a clear, well-organized response that explains your thinking and includes supporting details.',
    'Use complete sentences, connect your points with relevant examples, and finish with a concise conclusion.',
    'Keep your response focused on the lesson topic.',
  ].join('\n');
  assert.equal(title.length, 160);
  assert.ok(prompt.length > 160 && prompt.length <= 4000);
  assert.ok(instructions.length > 160 && instructions.length <= 4000);

  const created = await asAdmin(request(app)
    .post(`/api/admin/lessons/${lesson.id}/writing`)
    .send({ title, prompt, instructions, minimumWords: 100, maximumWords: 500 }));
  assert.equal(created.status, 201);
  activity = created.body.data.activity;
  assert.equal(activity.title, title);
  assert.equal(activity.prompt, prompt);
  assert.equal(activity.instructions, instructions);

  const updatedPrompt = `${prompt}\n\nAdd a final reflection about the lesson's relevance.`;
  const updatedInstructions = `${instructions}\nUse paragraph breaks to separate your main points.`;
  const updated = await asAdmin(request(app).put(`/api/admin/writing/${activity.id}`).send({
    prompt: updatedPrompt,
    instructions: updatedInstructions,
  }));
  assert.equal(updated.status, 200);
  assert.equal(updated.body.data.activity.prompt, updatedPrompt);
  assert.equal(updated.body.data.activity.instructions, updatedInstructions);

  const limits = [
    ['title', 'A'.repeat(161), '160 characters'],
    ['prompt', 'P'.repeat(4001), '4,000 characters'],
    ['instructions', 'I'.repeat(4001), '4,000 characters'],
  ];
  for (const [field, value, message] of limits) {
    const response = await asAdmin(request(app).put(`/api/admin/writing/${activity.id}`).send({ [field]: value }));
    assert.equal(response.status, 400);
    const detail = response.body.error.details.find((item) => item.field === field);
    assert.ok(detail, `Expected a validation detail for ${field}.`);
    assert.match(detail.message, new RegExp(message));
  }

  const stored = await WritingActivity.findById(activity.id);
  stored.instructions = 'I'.repeat(4001);
  await assert.rejects(stored.validate(), /Instructions must be 4,000 characters or fewer/);
});
