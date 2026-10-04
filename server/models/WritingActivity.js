const mongoose = require('mongoose');

const criterionSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      enum: ['grammar', 'vocabulary', 'organization', 'coherence', 'developmentOfIdeas'],
      required: true,
    },
    label: { type: String, required: true, trim: true, maxlength: 80 },
    description: { type: String, required: true, trim: true, maxlength: 400 },
    maximumScore: { type: Number, required: true, default: 5, min: 1, max: 5, validate: Number.isInteger },
  },
  { _id: false },
);

const writingActivitySchema = new mongoose.Schema(
  {
    lesson: { type: mongoose.Schema.Types.ObjectId, ref: 'Lesson', required: true },
    title: { type: String, required: true, trim: true, minlength: 3, maxlength: 160 },
    prompt: { type: String, required: true, trim: true, minlength: 10, maxlength: 2000 },
    instructions: { type: String, required: true, trim: true, minlength: 10, maxlength: 1200 },
    minimumWords: { type: Number, required: true, default: 100, min: 1, max: 5000, validate: Number.isInteger },
    maximumWords: { type: Number, required: true, default: 250, min: 1, max: 10000, validate: Number.isInteger },
    criteria: {
      type: [criterionSchema],
      required: true,
      validate: {
        validator: (criteria) => criteria.length === 5
          && new Set(criteria.map(({ key }) => key)).size === 5,
        message: 'A writing activity must define each of the five rubric criteria once.',
      },
    },
    isPublished: { type: Boolean, required: true, default: false },
  },
  { timestamps: true, versionKey: false },
);

writingActivitySchema.pre('validate', function validateWordRange() {
  if (this.maximumWords < this.minimumWords) {
    this.invalidate('maximumWords', 'Maximum word count must be at least the minimum word count.');
  }
});

writingActivitySchema.index({ lesson: 1 }, { unique: true });
writingActivitySchema.index({ isPublished: 1, lesson: 1 });

module.exports = mongoose.model('WritingActivity', writingActivitySchema);
