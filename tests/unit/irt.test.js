const {
  probabilityCorrect,
  updateTheta,
  selectNextDifficulty,
  shouldStopDiagnostic,
  buildGapMap,
} = require("@/lib/ai/irt");

describe("IRT Module", () => {
  describe("probabilityCorrect", () => {
    it("returns ~0.5 when theta equals difficulty", () => {
      const p = probabilityCorrect(0.5, 3, false);
      expect(p).toBeCloseTo(0.5, 1);
    });

    it("returns higher probability for easy question with high-ability student", () => {
      const p = probabilityCorrect(0.9, 1, false);
      expect(p).toBeGreaterThan(0.85);
    });

    it("returns lower probability for hard question with low-ability student", () => {
      const p = probabilityCorrect(0.1, 5, false);
      expect(p).toBeLessThan(0.35);
    });

    it("includes guessing parameter for MCQ", () => {
      const p = probabilityCorrect(0, 5, true);
      expect(p).toBeGreaterThanOrEqual(0.25);
    });
  });

  describe("updateTheta", () => {
    it("increases theta on correct answer", () => {
      const newTheta = updateTheta(0.5, true, 3);
      expect(newTheta).toBeGreaterThan(0.5);
    });

    it("decreases theta on incorrect answer", () => {
      const newTheta = updateTheta(0.5, false, 3);
      expect(newTheta).toBeLessThan(0.5);
    });

    it("clamps theta to [0, 1] range", () => {
      const maxTheta = updateTheta(0.99, true, 1);
      expect(maxTheta).toBeLessThanOrEqual(1.0);

      const minTheta = updateTheta(0.01, false, 5);
      expect(minTheta).toBeGreaterThanOrEqual(0.0);
    });

    it("larger update when answering correctly at right difficulty", () => {
      const updateAtMatch = updateTheta(0.5, true, 3) - 0.5;
      const updateAtEasy = updateTheta(0.5, true, 1) - 0.5;
      expect(updateAtMatch).toBeGreaterThan(updateAtEasy);
    });
  });

  describe("selectNextDifficulty", () => {
    it("returns higher difficulty after correct answer", () => {
      const d1 = selectNextDifficulty(0.5, true);
      const d2 = selectNextDifficulty(0.5, false);
      expect(d1).toBeGreaterThanOrEqual(d2);
    });

    it("returns difficulty in range 1–5", () => {
      for (let theta = 0; theta <= 1; theta += 0.1) {
        const d = selectNextDifficulty(theta, true);
        expect(d).toBeGreaterThanOrEqual(1);
        expect(d).toBeLessThanOrEqual(5);
      }
    });
  });

  describe("shouldStopDiagnostic", () => {
    it("stops at max questions", () => {
      const history = Array(20).fill(0.5);
      expect(shouldStopDiagnostic(20, history, 20)).toBe(true);
    });

    it("does not stop before minimum 5 questions", () => {
      const history = [0.5, 0.5, 0.5, 0.5];
      expect(shouldStopDiagnostic(4, history, 20)).toBe(false);
    });

    it("stops when theta has converged (low variance)", () => {
      const history = [0.501, 0.499, 0.500, 0.501, 0.499];
      expect(shouldStopDiagnostic(5, history, 20)).toBe(true);
    });

    it("continues when theta is still varying", () => {
      const history = [0.2, 0.8, 0.3, 0.7, 0.4];
      expect(shouldStopDiagnostic(5, history, 20)).toBe(false);
    });
  });

  describe("buildGapMap", () => {
    it("categorizes mastered topics correctly", () => {
      const answers = [
        { topic: "Fractions", subtopic: "Basic", correct: true, difficulty: 2 },
        { topic: "Fractions", subtopic: "Basic", correct: true, difficulty: 2 },
        { topic: "Fractions", subtopic: "Basic", correct: true, difficulty: 2 },
        { topic: "Fractions", subtopic: "Basic", correct: true, difficulty: 3 },
        { topic: "Fractions", subtopic: "Basic", correct: true, difficulty: 3 },
      ];
      const result = buildGapMap(answers);
      expect(result.mastered.length).toBeGreaterThan(0);
      expect(result.gaps.length).toBe(0);
    });

    it("categorizes gap topics correctly", () => {
      const answers = [
        { topic: "Algebra", subtopic: "Equations", correct: false, difficulty: 3 },
        { topic: "Algebra", subtopic: "Equations", correct: false, difficulty: 4 },
        { topic: "Algebra", subtopic: "Equations", correct: false, difficulty: 2 },
      ];
      const result = buildGapMap(answers);
      expect(result.gaps.length).toBeGreaterThan(0);
    });

    it("categorizes partial topics correctly", () => {
      const answers = [
        { topic: "Statistics", subtopic: "Mean", correct: true, difficulty: 2 },
        { topic: "Statistics", subtopic: "Mean", correct: false, difficulty: 3 },
        { topic: "Statistics", subtopic: "Mean", correct: true, difficulty: 2 },
      ];
      const result = buildGapMap(answers);
      expect(result.partial.length).toBeGreaterThan(0);
    });
  });
});
