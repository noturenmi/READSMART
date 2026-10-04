const mongoose = require('mongoose');

const lessonSchema = new mongoose.Schema(
  {
    subject: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject', required: true, index: true },
    title: { type: String, required: true, trim: true, minlength: 2, maxlength: 180 },
    lessonNumber: { type: Number, required: true, min: 1, validate: Number.isInteger },
    overview: { type: String, trim: true, maxlength: 1000, default: '' },
    lesson: { type: String, trim: true, default: '' },
    discussion: { type: String, trim: true, default: '' },
    example: { type: String, trim: true, default: '' },
    keyConcepts: { type: [String], default: [] },
    keyTakeaway: { type: String, trim: true, default: '' },
    contentStatus: { type: String, enum: ['pending', 'ready'], default: 'pending', required: true },
    isPublished: { type: Boolean, default: false, required: true },
  },
  { timestamps: true, versionKey: false },
);

lessonSchema.index({ subject: 1, lessonNumber: 1 }, { unique: true });
lessonSchema.index({ subject: 1, isPublished: 1, lessonNumber: 1 });

lessonSchema.pre('validate', function validatePublicationState() {
  if (this.isPublished && this.contentStatus !== 'ready') {
    this.invalidate('contentStatus', 'A lesson must have ready content before it can be published.');
  }
  if (this.contentStatus === 'ready' && !this.lesson.trim()) {
    this.invalidate('lesson', 'Ready lessons need an introduction.');
  }
});

module.exports = mongoose.model('Lesson', lessonSchema);
