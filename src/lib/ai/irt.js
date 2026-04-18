// @ts-check

/**
 * IRT 3-Parameter Logistic model adaptive diagnostic engine.
 *
 * P(correct | θ) = c + (1 - c) / (1 + e^(-a(θ - b)))
 *
 * θ  = student ability (0–1)
 * b  = item difficulty (normalized 0–1)
 * a  = discrimination = 1.7 (fixed)
 * c  = guessing = 0.25 for MCQ, 0 otherwise
 */

const A = 2.5;   // discrimination (3PL standard value)
const C_MCQ = 0.25; // guessing for MCQ

/**
 * Normalize difficulty 1–5 to 0–1 scale.
 * @param {number} difficulty
 * @returns {number}
 */
function normalizeDifficulty(difficulty) {
  return (difficulty - 1) / 4;
}

/**
 * IRT 3PL probability of correct response.
 * @param {number} theta - Student ability (0–1)
 * @param {number} difficulty - Item difficulty (1–5)
 * @param {boolean} isMCQ - Whether question is MCQ (adds guessing parameter)
 * @returns {number} Probability of correct answer (0–1)
 */
function probabilityCorrect(theta, difficulty, isMCQ) {
  const b = normalizeDifficulty(difficulty);
  const c = isMCQ ? C_MCQ : 0;
  return c + (1 - c) / (1 + Math.exp(-A * (theta - b)));
}

/**
 * Update theta using a simplified MLE step (EAP approximation).
 * @param {number} theta - Current ability estimate
 * @param {boolean} correct - Whether answer was correct
 * @param {number} difficulty - Item difficulty (1–5)
 * @returns {number} Updated theta (clamped 0–1)
 */
function updateTheta(theta, correct, difficulty) {
  const p = probabilityCorrect(theta, difficulty, false);
  // Gradient step: Fisher scoring
  const weight = p * (1 - p);
  const residual = (correct ? 1 : 0) - p;
  const learningRate = 0.3;
  const delta = (learningRate * A * residual * weight) / (weight + 1e-8);
  return Math.min(1, Math.max(0, theta + delta));
}

/**
 * Select the next question difficulty based on current theta.
 * @param {number} theta - Student ability (0–1)
 * @param {boolean} lastCorrect - Whether the last answer was correct
 * @returns {number} Difficulty 1–5
 */
function selectNextDifficulty(theta, lastCorrect) {
  // Target difficulty b that matches theta (discrimination ≈ 0.5)
  const targetB = theta;
  // Convert back from normalized to 1–5 scale
  const targetDiff = Math.round(targetB * 4 + 1);
  // Adjust slightly based on last answer
  const adjustment = lastCorrect ? 1 : -1;
  return Math.min(5, Math.max(1, targetDiff + adjustment));
}

/**
 * Check if the diagnostic should stop.
 * Stops if: maxQuestions reached OR theta has converged (variance < 0.01).
 * Minimum 5 questions before stopping.
 * @param {number} questionCount - Number of questions asked so far
 * @param {number[]} thetaHistory - Array of past theta estimates
 * @param {number} maxQuestions
 * @returns {boolean}
 */
function shouldStopDiagnostic(questionCount, thetaHistory, maxQuestions) {
  if (questionCount >= maxQuestions) return true;
  if (thetaHistory.length < 5) return false;

  const recent = thetaHistory.slice(-5);
  const mean = recent.reduce((a, b) => a + b, 0) / recent.length;
  const variance =
    recent.reduce((sum, t) => sum + Math.pow(t - mean, 2), 0) / recent.length;

  return variance < 0.01;
}

/**
 * Build a gap map from diagnostic answers.
 * @param {Array<{topic: string, subtopic: string, correct: boolean, difficulty: number}>} answers
 * @returns {{ mastered: string[], partial: string[], gaps: string[] }}
 */
function buildGapMap(answers) {
  /** @type {Record<string, {correct: number, total: number, maxDifficulty: number}>} */
  const topicStats = {};

  for (const answer of answers) {
    if (!topicStats[answer.topic]) {
      topicStats[answer.topic] = { correct: 0, total: 0, maxDifficulty: 0 };
    }
    topicStats[answer.topic].total++;
    if (answer.correct) topicStats[answer.topic].correct++;
    topicStats[answer.topic].maxDifficulty = Math.max(
      topicStats[answer.topic].maxDifficulty,
      answer.difficulty
    );
  }

  const mastered = [];
  const partial = [];
  const gaps = [];

  for (const [topic, stats] of Object.entries(topicStats)) {
    const accuracy = stats.correct / stats.total;
    if (accuracy >= 0.8 && stats.maxDifficulty >= 3) {
      mastered.push(topic);
    } else if (accuracy >= 0.5) {
      partial.push(topic);
    } else {
      gaps.push(topic);
    }
  }

  return { mastered, partial, gaps };
}

module.exports = {
  probabilityCorrect,
  updateTheta,
  selectNextDifficulty,
  shouldStopDiagnostic,
  buildGapMap,
};
