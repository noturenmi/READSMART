const mongoose = require('mongoose');

const xpByActivityType = {
  reading_assessment: 20,
  writing_activity: 25,
  lesson_completion: 5,
};

const activityRecordSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  activityType: {
    type: String,
    enum: Object.keys(xpByActivityType),
    required: true,
  },
  lesson: { type: mongoose.Schema.Types.ObjectId, ref: 'Lesson', required: true },
  subject: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject', required: true },
  sourceId: { type: mongoose.Schema.Types.ObjectId, required: true },
  xpEarned: { type: Number, required: true, min: 0, max: 25, validate: Number.isInteger },
}, { timestamps: true, versionKey: false });

activityRecordSchema.pre('validate', function validateReward() {
  if (this.activityType && this.xpEarned !== xpByActivityType[this.activityType]) {
    this.invalidate('xpEarned', 'XP rewards are determined by activity type.');
  }
});

activityRecordSchema.index({ user: 1, activityType: 1, lesson: 1 }, { unique: true });
activityRecordSchema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.model('ActivityRecord', activityRecordSchema);
