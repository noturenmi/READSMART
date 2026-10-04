const mongoose = require('mongoose');

const studentProgressSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
  totalXP: { type: Number, required: true, default: 0, min: 0, validate: Number.isInteger },
  level: { type: Number, required: true, default: 1, min: 1, validate: Number.isInteger },
  readingAssessmentsCompleted: { type: Number, required: true, default: 0, min: 0, validate: Number.isInteger },
  writingActivitiesCompleted: { type: Number, required: true, default: 0, min: 0, validate: Number.isInteger },
  lessonsCompleted: { type: Number, required: true, default: 0, min: 0, validate: Number.isInteger },
  overallProgressPercentage: { type: Number, required: true, default: 0, min: 0, max: 100 },
  lastActivityAt: { type: Date, default: null },
}, { timestamps: true, versionKey: false });

module.exports = mongoose.model('StudentProgress', studentProgressSchema);
