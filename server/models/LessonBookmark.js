const mongoose = require('mongoose');

const lessonBookmarkSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  lesson: { type: mongoose.Schema.Types.ObjectId, ref: 'Lesson', required: true },
}, { timestamps: true, versionKey: false });

lessonBookmarkSchema.index({ user: 1, lesson: 1 }, { unique: true });
lessonBookmarkSchema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.model('LessonBookmark', lessonBookmarkSchema);
