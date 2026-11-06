const subjectCodeLimits = Object.freeze({ min: 2, max: 16 });
const subjectCodePattern = /^[A-Z][A-Z0-9]*(?:-[A-Z0-9]+)*$/;

module.exports = { subjectCodeLimits, subjectCodePattern };
