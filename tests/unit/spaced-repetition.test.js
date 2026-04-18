const {
  calculateNextReview,
  scoreToQuality,
  processQuizResult,
  getTopicsDueForReview,
  DEFAULT_CARD,
} = require("@/lib/spaced-repetition/scheduler");

describe("Spaced Repetition Scheduler", () => {
  describe("scoreToQuality", () => {
    it("maps perfect score to quality 5", () => {
      expect(scoreToQuality(100)).toBe(5);
      expect(scoreToQuality(95)).toBe(5);
    });

    it("maps good score to quality 4", () => {
      expect(scoreToQuality(80)).toBe(4);
      expect(scoreToQuality(75)).toBe(4);
    });

    it("maps passing score to quality 3", () => {
      expect(scoreToQuality(65)).toBe(3);
      expect(scoreToQuality(60)).toBe(3);
    });

    it("maps failing scores to quality 0–2", () => {
      expect(scoreToQuality(50)).toBe(2);
      expect(scoreToQuality(25)).toBe(1);
      expect(scoreToQuality(10)).toBe(0);
    });
  });

  describe("calculateNextReview", () => {
    it("resets interval on failure (quality < 3)", () => {
      const card = { ...DEFAULT_CARD, interval: 14, repetitions: 5 };
      const result = calculateNextReview(card, 2);
      expect(result.interval).toBe(1);
      expect(result.repetitions).toBe(0);
    });

    it("sets interval to 1 on first success", () => {
      const result = calculateNextReview(DEFAULT_CARD, 4);
      expect(result.interval).toBe(1);
      expect(result.repetitions).toBe(1);
    });

    it("sets interval to 6 on second success", () => {
      const card = { ...DEFAULT_CARD, repetitions: 1, interval: 1 };
      const result = calculateNextReview(card, 4);
      expect(result.interval).toBe(6);
      expect(result.repetitions).toBe(2);
    });

    it("multiplies interval by ease on subsequent successes", () => {
      const card = { ease: 2.5, interval: 6, repetitions: 2 };
      const result = calculateNextReview(card, 5);
      expect(result.interval).toBe(Math.round(6 * 2.5));
    });

    it("adjusts ease factor based on quality", () => {
      const resultPerfect = calculateNextReview(DEFAULT_CARD, 5);
      expect(resultPerfect.ease).toBeGreaterThan(DEFAULT_CARD.ease);

      const resultHard = calculateNextReview(DEFAULT_CARD, 3);
      expect(resultHard.ease).toBeLessThan(DEFAULT_CARD.ease);
    });

    it("never lets ease drop below 1.3", () => {
      let card = { ...DEFAULT_CARD };
      for (let i = 0; i < 20; i++) {
        const result = calculateNextReview(card, 0);
        card = { ease: result.ease, interval: result.interval, repetitions: result.repetitions };
      }
      expect(card.ease).toBeGreaterThanOrEqual(1.3);
    });

    it("schedules nextReviewAt in the future", () => {
      const result = calculateNextReview(DEFAULT_CARD, 4);
      expect(result.nextReviewAt.getTime()).toBeGreaterThan(Date.now());
    });
  });

  describe("processQuizResult", () => {
    it("processes a passing quiz correctly", () => {
      const result = processQuizResult(DEFAULT_CARD, 85);
      expect(result.repetitions).toBe(1);
    });

    it("processes a failing quiz and resets", () => {
      const card = { ease: 2.5, interval: 10, repetitions: 4 };
      const result = processQuizResult(card, 40);
      expect(result.interval).toBe(1);
      expect(result.repetitions).toBe(0);
    });
  });

  describe("getTopicsDueForReview", () => {
    it("returns topics with nextReviewAt in the past", () => {
      const cards = [
        {
          topic: "Fractions", subject: "maths", ease: 2.5, interval: 3, repetitions: 2,
          nextReviewAt: new Date(Date.now() - 1000),
        },
        {
          topic: "Algebra", subject: "maths", ease: 2.5, interval: 7, repetitions: 3,
          nextReviewAt: new Date(Date.now() + 86400000),
        },
      ];
      const due = getTopicsDueForReview(cards);
      expect(due).toHaveLength(1);
      expect(due[0].topic).toBe("Fractions");
    });

    it("returns empty array when nothing is due", () => {
      const cards = [
        {
          topic: "Algebra", subject: "maths", ease: 2.5, interval: 7, repetitions: 3,
          nextReviewAt: new Date(Date.now() + 86400000),
        },
      ];
      expect(getTopicsDueForReview(cards)).toHaveLength(0);
    });
  });
});
