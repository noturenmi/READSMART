const writingActivityLimits = Object.freeze({
  title: Object.freeze({ min: 3, max: 160 }),
  prompt: Object.freeze({ min: 10, max: 4000 }),
  instructions: Object.freeze({ min: 10, max: 4000 }),
});

module.exports = { writingActivityLimits };
