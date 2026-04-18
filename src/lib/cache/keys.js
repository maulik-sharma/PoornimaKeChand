// @ts-check

/** Cache TTL constants (in seconds) */
const CACHE_TTL = {
  CURRICULUM: 60 * 60 * 24 * 7,     // 7 days
  MODULE_CONTENT: 60 * 60 * 24 * 30, // 30 days
  QUIZ_FINGERPRINTS: 60 * 60 * 24 * 30,
  STUDENT_SESSION: 60 * 30,          // 30 minutes
  CLASS_ANALYTICS: 60 * 60,          // 1 hour
  TUTOR_CHAT: 60 * 60 * 4,           // 4 hours
};

/** Cache key factory functions */
const CACHE_KEYS = {
  curriculum: (studentId, subject) => `curriculum:${studentId}:${subject}`,
  moduleContent: (moduleId) => `module:content:${moduleId}`,
  recentQuizFingerprints: (studentId, moduleId) =>
    `quiz:fingerprints:${studentId}:${moduleId}`,
  classAnalytics: (teacherId, classGrade, subject) =>
    `analytics:${teacherId}:${classGrade}:${subject}`,
  diagnosticSession: (sessionId) => `diag:session:${sessionId}`,
  tutorChat: (studentId, subject) => `tutor:chat:${studentId}:${subject}`,
};

module.exports = { CACHE_KEYS, CACHE_TTL };
