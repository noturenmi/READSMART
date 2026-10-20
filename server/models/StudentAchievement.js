const mongoose = require('mongoose');
const { ACHIEVEMENT_IDS } = require('../data/achievementCatalog');

const studentAchievementSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  achievementId: { type: String, enum: ACHIEVEMENT_IDS, required: true },
  earnedAt: { type: Date, required: true },
}, { timestamps: true, versionKey: false });

studentAchievementSchema.index({ user: 1, achievementId: 1 }, { unique: true });
studentAchievementSchema.index({ user: 1, earnedAt: -1 });

module.exports = mongoose.model('StudentAchievement', studentAchievementSchema);
