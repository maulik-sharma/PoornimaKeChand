// @ts-check

/**
 * SM-2 Spaced Repetition Scheduler
 *
 * Quality mapping:
 *   Score ≥ 90% → Quality 5 (perfect)
 *   Score 75–89% → Quality 4
 *   Score 60–74% → Quality 3
 *   Score < 60%  → Quality 0–2 (reset)
 */

/** @type {{ ease: number, interval: number, repetitions: number }} */
const DEFAULT_CARD = {
  ease: 2.5,
  interval: 1,
  repetitions: 0,
};

/**
 * Map a quiz score (0–100) to SM-2 quality (0–5).
 * @param {number} score
 * @returns {number}
 */
function scoreToQuality(score) {
  if (score >= 90) return 5;
  if (score >= 75) return 4;
  if (score >= 60) return 3;
  if (score >= 50) return 2;
  if (score >= 25) return 1;
  return 0;
}

/**
 * Calculate next review using SM-2 algorithm.
 * @param {{ ease: number, interval: number, repetitions: number }} card
 * @param {number} quality - Quality 0–5
 * @returns {{ ease: number, interval: number, repetitions: number, nextReviewAt: Date }}
 */
function calculateNextReview(card, quality) {
  let { ease, interval, repetitions } = card;

  if (quality < 3) {
    // Failed: reset to beginning
    repetitions = 0;
    interval = 1;
  } else {
    // Passed
    if (repetitions === 0) {
      interval = 1;
    } else if (repetitions === 1) {
      interval = 6;
    } else {
      interval = Math.round(interval * ease);
    }
    repetitions += 1;
  }

  // Adjust ease factor (SM-2 formula)
  ease = ease + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
  ease = Math.max(1.3, ease); // Never below 1.3

  const nextReviewAt = new Date(Date.now() + interval * 24 * 60 * 60 * 1000);

  return { ease, interval, repetitions, nextReviewAt };
}

/**
 * Process a quiz result and return updated card state.
 * @param {{ ease: number, interval: number, repetitions: number }} card
 * @param {number} score - 0–100
 * @returns {{ ease: number, interval: number, repetitions: number, nextReviewAt: Date }}
 */
function processQuizResult(card, score) {
  const quality = scoreToQuality(score);
  return calculateNextReview(card, quality);
}

/**
 * Filter cards that are due for review.
 * @param {Array<{ topic: string, subject: string, ease: number, interval: number, repetitions: number, nextReviewAt: Date }>} cards
 * @returns {typeof cards}
 */
function getTopicsDueForReview(cards) {
  const now = new Date();
  return cards.filter((card) => new Date(card.nextReviewAt) <= now);
}

module.exports = {
  DEFAULT_CARD,
  scoreToQuality,
  calculateNextReview,
  processQuizResult,
  getTopicsDueForReview,
};
