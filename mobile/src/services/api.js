import { clearToken, getToken } from './tokenStorage';

const REQUEST_TIMEOUT_MS = 12000;
let unauthorizedHandler;

export function setUnauthorizedHandler(handler) {
  unauthorizedHandler = handler;
  return () => {
    if (unauthorizedHandler === handler) unauthorizedHandler = undefined;
  };
}

export class ApiError extends Error {
  constructor(message, status = 0, code = 'REQUEST_FAILED', details) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

function getBaseUrl() {
  const configuredUrl = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (!configuredUrl) {
    throw new ApiError('Set EXPO_PUBLIC_API_URL in mobile/.env to the address of the READSMART API.', 0, 'API_URL_MISSING');
  }
  return configuredUrl.replace(/\/+$/, '');
}

async function request(path, { method = 'GET', body, authenticated = false } = {}) {
  const url = `${getBaseUrl()}${path}`;
  const headers = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (authenticated) {
    const token = await getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let response;
  try {
    response = await fetch(url, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (error) {
    const message = error.name === 'AbortError'
      ? 'The server took too long to respond. Please try again.'
      : 'Cannot reach the READSMART server. Check the API URL, network, and that the server is running.';
    throw new ApiError(message, 0, 'SERVER_UNAVAILABLE');
  } finally {
    clearTimeout(timer);
  }

  let payload;
  try {
    payload = await response.json();
  } catch {
    throw new ApiError('The server returned an unexpected response. Please try again later.', response.status, 'INVALID_RESPONSE');
  }

  if (!response.ok || payload.success !== true) {
    const error = payload.error || {};
    const fieldMessages = Array.isArray(error.details)
      ? error.details.map((detail) => detail.message).filter(Boolean)
      : [];
    const message = response.status === 401
      ? (error.message || 'Your session is invalid or has expired. Please sign in again.')
      : fieldMessages.length
        ? `${error.message || 'Please check the information you entered.'} ${fieldMessages.join(' ')}`
        : (error.message || 'The request could not be completed. Please try again.');
    if (response.status === 401 && authenticated) {
      await clearToken();
      unauthorizedHandler?.();
    }
    throw new ApiError(message, response.status, error.code || 'REQUEST_FAILED', error.details);
  }
  return payload.data;
}

export const api = {
  register(name, email, password) {
    return request('/auth/register', { method: 'POST', body: { name, email, password } });
  },
  login(email, password) {
    return request('/auth/login', { method: 'POST', body: { email, password } });
  },
  getCurrentUser() {
    return request('/auth/me', { authenticated: true });
  },
  getProtectedTest() {
    return request('/test/protected', { authenticated: true });
  },
  getAdminTest() {
    return request('/admin/test', { authenticated: true });
  },
  getSubjects() {
    return request('/subjects', { authenticated: true });
  },
  getSubject(subjectId) {
    return request(`/subjects/${encodeURIComponent(subjectId)}`, { authenticated: true });
  },
  getLessons(subjectId) {
    return request(`/subjects/${encodeURIComponent(subjectId)}/lessons`, { authenticated: true });
  },
  getLesson(lessonId) {
    return request(`/lessons/${encodeURIComponent(lessonId)}`, { authenticated: true });
  },
  getLessonSummary(lessonId) {
    return request(`/lessons/${encodeURIComponent(lessonId)}/summary`, {
      method: 'POST',
      body: {},
      authenticated: true,
    });
  },
  getLessonQuestions(lessonId) {
    return request(`/lessons/${encodeURIComponent(lessonId)}/questions`, { authenticated: true });
  },
  submitLessonAssessment(lessonId, answers) {
    return request(`/lessons/${encodeURIComponent(lessonId)}/assessment`, {
      method: 'POST',
      body: { answers },
      authenticated: true,
    });
  },
  getAssessmentAttempts(lessonId) {
    return request(`/lessons/${encodeURIComponent(lessonId)}/assessment-attempts`, { authenticated: true });
  },
  getAssessmentReview(lessonId, attemptId) {
    return request(
      `/lessons/${encodeURIComponent(lessonId)}/assessment-attempts/${encodeURIComponent(attemptId)}/review`,
      { authenticated: true },
    );
  },
  getWritingActivities() {
    return request('/writing/activities', { authenticated: true });
  },
  getLessonWritingActivity(lessonId) {
    return request(`/lessons/${encodeURIComponent(lessonId)}/writing`, { authenticated: true });
  },
  submitLessonWriting(lessonId, writingActivityId, response, requestKey) {
    return request(`/lessons/${encodeURIComponent(lessonId)}/writing`, {
      method: 'POST',
      body: { writingActivityId, response, ...(requestKey ? { requestKey } : {}) },
      authenticated: true,
    });
  },
  getMyWritingSubmissionHistory(page = 1, limit = 20) {
    return request(`/writing/submissions?page=${page}&limit=${limit}`, { authenticated: true });
  },
  getMyWritingSubmission(submissionId) {
    return request(`/writing/submissions/${encodeURIComponent(submissionId)}`, { authenticated: true });
  },
  getLessonWritingSubmissions(lessonId) {
    return request(`/lessons/${encodeURIComponent(lessonId)}/writing-submissions`, { authenticated: true });
  },
  getAIWritingFeedback(lessonId, submissionId) {
    return request(`/lessons/${encodeURIComponent(lessonId)}/writing/${encodeURIComponent(submissionId)}/ai-feedback`, {
      method: 'POST',
      body: {},
      authenticated: true,
    });
  },
  getMyProgress() {
    return request('/progress/me', { authenticated: true });
  },
  getSubjectProgress() {
    return request('/progress/subjects', { authenticated: true });
  },
  getRecommendedLessons() {
    return request('/progress/recommendations', { authenticated: true });
  },
  getMyAchievements() {
    return request('/progress/achievements', { authenticated: true });
  },
  adminGetDashboard() {
    return request('/admin/dashboard', { authenticated: true });
  },
  adminGetUsers(page = 1, limit = 20) {
    return request(`/admin/users?page=${page}&limit=${limit}`, { authenticated: true });
  },
  adminGetUser(userId) {
    return request(`/admin/users/${encodeURIComponent(userId)}`, { authenticated: true });
  },
  adminGetUserProgress(userId) {
    return request(`/admin/users/${encodeURIComponent(userId)}/progress`, { authenticated: true });
  },
  adminGetWritingSubmissionHistory(userId, page = 1, limit = 20) {
    return request(`/admin/users/${encodeURIComponent(userId)}/writing-submissions?page=${page}&limit=${limit}`, { authenticated: true });
  },
  adminGetWritingSubmission(userId, submissionId) {
    return request(`/admin/users/${encodeURIComponent(userId)}/writing-submissions/${encodeURIComponent(submissionId)}`, { authenticated: true });
  },
  adminGetSubjects() {
    return request('/admin/subjects', { authenticated: true });
  },
  adminCreateSubject(subject) {
    return request('/admin/subjects', { method: 'POST', body: subject, authenticated: true });
  },
  adminUpdateSubject(subjectId, subject) {
    return request(`/admin/subjects/${encodeURIComponent(subjectId)}`, { method: 'PUT', body: subject, authenticated: true });
  },
  adminSetSubjectActive(subjectId, isActive) {
    return request(`/admin/subjects/${encodeURIComponent(subjectId)}/publish`, { method: 'PATCH', body: { isActive }, authenticated: true });
  },
  adminGetLessons(subjectId) {
    return request(`/admin/subjects/${encodeURIComponent(subjectId)}/lessons`, { authenticated: true });
  },
  adminCreateLesson(subjectId, lesson) {
    return request(`/admin/subjects/${encodeURIComponent(subjectId)}/lessons`, { method: 'POST', body: lesson, authenticated: true });
  },
  adminUpdateLesson(lessonId, lesson) {
    return request(`/admin/lessons/${encodeURIComponent(lessonId)}`, { method: 'PUT', body: lesson, authenticated: true });
  },
  adminSetLessonPublished(lessonId, isPublished) {
    return request(`/admin/lessons/${encodeURIComponent(lessonId)}/publish`, { method: 'PATCH', body: { isPublished }, authenticated: true });
  },
  adminGetQuestions(lessonId) {
    return request(`/admin/lessons/${encodeURIComponent(lessonId)}/questions`, { authenticated: true });
  },
  adminCreateQuestion(lessonId, question) {
    return request(`/admin/lessons/${encodeURIComponent(lessonId)}/questions`, { method: 'POST', body: question, authenticated: true });
  },
  adminUpdateQuestion(questionId, question) {
    return request(`/admin/questions/${encodeURIComponent(questionId)}`, { method: 'PUT', body: question, authenticated: true });
  },
  adminSetQuestionPublished(questionId, isPublished) {
    return request(`/admin/questions/${encodeURIComponent(questionId)}/publish`, { method: 'PATCH', body: { isPublished }, authenticated: true });
  },
  adminGetWritingActivity(lessonId) {
    return request(`/admin/lessons/${encodeURIComponent(lessonId)}/writing`, { authenticated: true });
  },
  adminCreateWritingActivity(lessonId, activity) {
    return request(`/admin/lessons/${encodeURIComponent(lessonId)}/writing`, { method: 'POST', body: activity, authenticated: true });
  },
  adminUpdateWritingActivity(activityId, activity) {
    return request(`/admin/writing/${encodeURIComponent(activityId)}`, { method: 'PUT', body: activity, authenticated: true });
  },
  adminSetWritingActivityPublished(activityId, isPublished) {
    return request(`/admin/writing/${encodeURIComponent(activityId)}/publish`, { method: 'PATCH', body: { isPublished }, authenticated: true });
  },
};
