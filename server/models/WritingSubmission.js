const mongoose = require('mongoose');

const rubricScoresSchema = new mongoose.Schema(
  {
    grammar: { type: Number, required: true, min: 1, max: 5, validate: Number.isInteger },
    vocabulary: { type: Number, required: true, min: 1, max: 5, validate: Number.isInteger },
    organization: { type: Number, required: true, min: 1, max: 5, validate: Number.isInteger },
    coherence: { type: Number, required: true, min: 1, max: 5, validate: Number.isInteger },
    developmentOfIdeas: { type: Number, required: true, min: 1, max: 5, validate: Number.isInteger },
  },
  { _id: false },
);

const criterionFeedbackSchema = new mongoose.Schema(
  {
    grammar: { type: String, required: true, trim: true, maxlength: 500 },
    vocabulary: { type: String, required: true, trim: true, maxlength: 500 },
    organization: { type: String, required: true, trim: true, maxlength: 500 },
    coherence: { type: String, required: true, trim: true, maxlength: 500 },
    developmentOfIdeas: { type: String, required: true, trim: true, maxlength: 500 },
  },
  { _id: false },
);

const aiFeedbackSchema = new mongoose.Schema({
  strengths: { type: [String], required: true, validate: (items) => items.length >= 1 && items.length <= 3 },
  areasForImprovement: { type: [String], required: true, validate: (items) => items.length >= 1 && items.length <= 3 },
  suggestions: { type: [String], required: true, validate: (items) => items.length >= 1 && items.length <= 3 },
  encouragement: { type: String, required: true, trim: true, maxlength: 350 },
}, { _id: false });

const writingSubmissionSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    lesson: { type: mongoose.Schema.Types.ObjectId, ref: 'Lesson', required: true },
    writingActivity: { type: mongoose.Schema.Types.ObjectId, ref: 'WritingActivity', required: true },
    response: { type: String, required: true, trim: true, minlength: 1, maxlength: 15000 },
    wordCount: { type: Number, required: true, min: 1, validate: Number.isInteger },
    rubricScores: { type: rubricScoresSchema, required: true },
    criterionFeedback: { type: criterionFeedbackSchema, required: true },
    totalScore: { type: Number, required: true, min: 5, max: 25, validate: Number.isInteger },
    maxScore: { type: Number, required: true, min: 25, max: 25, default: 25, validate: Number.isInteger },
    percentage: { type: Number, required: true, min: 0, max: 100, validate: Number.isInteger },
    feedback: { type: String, required: true, trim: true, maxlength: 1000 },
    submittedAt: { type: Date, required: true, default: Date.now },
    // Supplementary cache fields; these do not participate in official rubric calculation.
    aiFeedback: { type: aiFeedbackSchema, required: false },
    aiFeedbackContentHash: { type: String, required: false, minlength: 64, maxlength: 64 },
    aiFeedbackModel: { type: String, required: false, trim: true, maxlength: 120 },
    aiFeedbackPromptVersion: { type: String, required: false, trim: true, maxlength: 80 },
    aiFeedbackGeneratedAt: { type: Date, required: false },
  },
  { timestamps: true, versionKey: false },
);

writingSubmissionSchema.pre('validate', function validateCalculatedResult() {
  if (this.rubricScores) {
    const calculatedTotal = Object.values(this.rubricScores.toObject()).reduce((sum, score) => sum + score, 0);
    if (this.totalScore !== calculatedTotal) {
      this.invalidate('totalScore', 'Total score must equal the sum of rubric scores.');
    }
    if (this.percentage !== Math.round((calculatedTotal / 25) * 100)) {
      this.invalidate('percentage', 'Percentage must be calculated from the rubric score.');
    }
  }
  if (this.maxScore !== 25) this.invalidate('maxScore', 'The writing rubric is scored out of 25.');
});

writingSubmissionSchema.index({ user: 1, lesson: 1, submittedAt: -1 });
writingSubmissionSchema.index({ user: 1, writingActivity: 1, submittedAt: -1 });

module.exports = mongoose.model('WritingSubmission', writingSubmissionSchema);
