export const WRITING_ACTIVITY_LIMITS = Object.freeze({
  title: 160,
  prompt: 4000,
  instructions: 4000,
});

const fieldLabels = Object.freeze({
  title: 'Activity title',
  prompt: 'Writing prompt',
  instructions: 'Instructions',
  minimumWords: 'Minimum words',
  maximumWords: 'Maximum words',
});

export function getWritingActivityLengthErrors(activity) {
  const errors = {};
  for (const field of ['title', 'prompt', 'instructions']) {
    if (String(activity[field] || '').length > WRITING_ACTIVITY_LIMITS[field]) {
      errors[field] = `${fieldLabels[field]} must be ${WRITING_ACTIVITY_LIMITS[field].toLocaleString()} characters or fewer.`;
    }
  }
  return errors;
}

export function getWritingActivityApiFeedback(error) {
  const fieldErrors = {};
  for (const detail of Array.isArray(error?.details) ? error.details : []) {
    if (fieldLabels[detail.field] && detail.message) fieldErrors[detail.field] = detail.message;
  }

  if (Object.keys(fieldErrors).length) {
    return { fieldErrors, message: 'Please correct the highlighted fields.' };
  }

  return {
    fieldErrors,
    message: error?.message || 'Unable to save writing activity. Please check the information and try again.',
  };
}
