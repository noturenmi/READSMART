export const SUBJECT_CODE_LIMITS = Object.freeze({ min: 2, max: 16 });
export const SUBJECT_CODE_PATTERN = /^[A-Z][A-Z0-9]*(?:-[A-Z0-9]+)*$/;

export function getSubjectCodeError(value) {
  const code = String(value || '').trim().toUpperCase();
  if (!code) return 'Enter a subject code.';
  if (code.length < SUBJECT_CODE_LIMITS.min) return `Use at least ${SUBJECT_CODE_LIMITS.min} characters.`;
  if (code.length > SUBJECT_CODE_LIMITS.max) return `Use no more than ${SUBJECT_CODE_LIMITS.max} characters.`;
  if (!SUBJECT_CODE_PATTERN.test(code)) return 'Use letters and numbers, with hyphens only between code parts.';
  return '';
}
