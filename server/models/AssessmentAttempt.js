const mongoose = require('mongoose');

const answerSchema = new mongoose.Schema(
  {
    questionId: { type: mongoose.Schema.Types.ObjectId, ref: 'ReadingQuestion', required: true },
    selectedAnswer: { type: Number, required: true, min: 0, max: 3, validate: Number.isInteger },
    isCorrect: { type: Boolean, required: true },
    pointsEarned: { type: Number, required: true, min: 0, validate: Number.isInteger },
  },
  { _id: false },
);

const assessmentAttemptSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    lesson: { type: mongoose.Schema.Types.ObjectId, ref: 'Lesson', required: true },
    answers: {
      type: [answerSchema],
      required: true,
      validate: { validator: (answers) => answers.length > 0, message: 'An attempt needs at least one answer.' },
    },
    score: { type: Number, required: true, min: 0, validate: Number.isInteger },
    totalItems: { type: Number, required: true, min: 1, validate: Number.isInteger },
    totalPoints: { type: Number, required: true, min: 1, validate: Number.isInteger },
    percentage: { type: Number, required: true, min: 0, max: 100, validate: Number.isInteger },
    submittedAt: { type: Date, required: true, default: Date.now },
  },
  { timestamps: true, versionKey: false },
);

assessmentAttemptSchema.index({ user: 1, lesson: 1, submittedAt: -1 });

module.exports = mongoose.model('AssessmentAttempt', assessmentAttemptSchema);
