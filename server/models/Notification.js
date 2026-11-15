const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, required: true, trim: true, minlength: 2, maxlength: 120 },
  message: { type: String, required: true, trim: true, minlength: 2, maxlength: 500 },
  type: {
    type: String,
    required: true,
    enum: ['assessment_result', 'writing_feedback', 'learning_reminder', 'learning_milestone'],
  },
  relatedRecordId: { type: mongoose.Schema.Types.ObjectId },
  relatedLesson: { type: mongoose.Schema.Types.ObjectId, ref: 'Lesson' },
  relatedDateKey: { type: String, match: /^\d{4}-\d{2}-\d{2}$/ },
  dedupeKey: { type: String, required: true, trim: true, maxlength: 160 },
  isRead: { type: Boolean, required: true, default: false },
}, { timestamps: true, versionKey: false });

notificationSchema.index({ user: 1, dedupeKey: 1 }, { unique: true });
notificationSchema.index({ user: 1, createdAt: -1, _id: -1 });
notificationSchema.index({ user: 1, isRead: 1 });

module.exports = mongoose.model('Notification', notificationSchema);
