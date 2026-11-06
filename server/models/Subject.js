const mongoose = require('mongoose');
const { subjectCodeLimits, subjectCodePattern } = require('../utils/subjectCodeValidation');

const subjectSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 120 },
    code: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      minlength: subjectCodeLimits.min,
      maxlength: subjectCodeLimits.max,
      match: [subjectCodePattern, 'Use uppercase letters and numbers, with hyphens only between code parts.'],
      unique: true,
    },
    description: { type: String, trim: true, maxlength: 500, default: '' },
    order: { type: Number, required: true, min: 0, validate: Number.isInteger },
    isActive: { type: Boolean, default: true, required: true },
  },
  { timestamps: true, versionKey: false },
);

subjectSchema.index({ isActive: 1, order: 1 });

module.exports = mongoose.model('Subject', subjectSchema);
