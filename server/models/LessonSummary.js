const mongoose = require('mongoose');

const conceptSchema = new mongoose.Schema({
  term: { type: String, required: true, trim: true, maxlength: 80 },
  explanation: { type: String, required: true, trim: true, maxlength: 260 },
}, { _id: false });

const summarySchema = new mongoose.Schema({
  mainIdea: { type: String, required: true, trim: true, maxlength: 700 },
  importantIdeas: { type: [String], required: true, validate: (items) => items.length >= 2 && items.length <= 5 },
  importantConcepts: { type: [conceptSchema], required: true, default: [] },
  takeaway: { type: String, required: true, trim: true, maxlength: 350 },
}, { _id: false });

const lessonSummarySchema = new mongoose.Schema({
  lesson: { type: mongoose.Schema.Types.ObjectId, ref: 'Lesson', required: true, unique: true, index: true },
  contentHash: { type: String, required: true, minlength: 64, maxlength: 64 },
  model: { type: String, required: true, trim: true, maxlength: 120 },
  promptVersion: { type: String, required: true, trim: true, maxlength: 80 },
  summary: { type: summarySchema, required: true },
  generatedAt: { type: Date, required: true, default: Date.now },
}, { timestamps: true, versionKey: false });

module.exports = mongoose.model('LessonSummary', lessonSummarySchema);
