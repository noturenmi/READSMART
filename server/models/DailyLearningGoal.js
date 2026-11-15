const mongoose = require('mongoose');

const targetSchema = new mongoose.Schema({
  readingLessons: { type: Number, required: true, min: 1, max: 10, validate: Number.isInteger, default: 1 },
  assessments: { type: Number, required: true, min: 1, max: 10, validate: Number.isInteger, default: 1 },
  writingActivities: { type: Number, required: true, min: 1, max: 10, validate: Number.isInteger, default: 1 },
}, { _id: false });

const dailyLearningGoalSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  dateKey: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
  targets: { type: targetSchema, required: true, default: () => ({}) },
}, { timestamps: true, versionKey: false });

dailyLearningGoalSchema.index({ user: 1, dateKey: 1 }, { unique: true });

module.exports = mongoose.model('DailyLearningGoal', dailyLearningGoalSchema);
