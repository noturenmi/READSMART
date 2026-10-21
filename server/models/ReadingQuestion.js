const mongoose = require('mongoose');

const readingQuestionSchema = new mongoose.Schema(
  {
    lesson: { type: mongoose.Schema.Types.ObjectId, ref: 'Lesson', required: true, index: true },
    question: { type: String, required: true, trim: true, minlength: 10, maxlength: 1200 },
    questionType: {
      type: String,
      enum: ['key_idea', 'vocabulary', 'inference', 'interpretation', 'evaluation'],
      required: true,
    },
    choices: {
      type: [{ type: String, required: true, trim: true, minlength: 1, maxlength: 500 }],
      required: true,
      validate: {
        validator: (choices) => choices.length === 4 && new Set(choices).size === 4,
        message: 'Each reading question needs four unique choices.',
      },
    },
    correctAnswer: { type: Number, required: true, min: 1, max: 4, validate: Number.isInteger, select: false },
    explanation: { type: String, required: true, trim: true, minlength: 10, maxlength: 1000 },
    points: { type: Number, required: true, default: 1, min: 1, validate: Number.isInteger },
    order: { type: Number, required: true, min: 1, validate: Number.isInteger },
    isPublished: { type: Boolean, required: true, default: false },
  },
  { timestamps: true, versionKey: false },
);

readingQuestionSchema.index({ lesson: 1, order: 1 }, { unique: true });
readingQuestionSchema.index({ lesson: 1, isPublished: 1, order: 1 });

module.exports = mongoose.model('ReadingQuestion', readingQuestionSchema);
