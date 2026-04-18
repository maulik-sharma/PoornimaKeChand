// @ts-check

/**
 * Diagnostic Question Bank — NCERT-aligned questions.
 * @typedef {{ id: string, topic: string, subtopic: string, difficulty: number, type: 'mcq' | 'true_false', question: string, options: string[], correctAnswer: string, explanation: string }} DiagnosticQuestion
 */

/** @type {Record<string, DiagnosticQuestion[]>} */
const NCERT_QUESTIONS = {
  maths: [
    {
      id: "m_001", topic: "Fractions", subtopic: "Basic Fractions", difficulty: 1, type: "mcq",
      question: "Which fraction represents 'three out of four equal parts'?",
      options: ["4/3", "3/4", "1/4", "3/3"], correctAnswer: "3/4",
      explanation: "Three out of four equal parts is written as 3/4, where 3 is the numerator and 4 is the denominator.",
    },
    {
      id: "m_002", topic: "Whole Numbers", subtopic: "Properties", difficulty: 1, type: "true_false",
      question: "Zero is the smallest whole number.",
      options: ["True", "False"], correctAnswer: "True",
      explanation: "Whole numbers are 0, 1, 2, 3, ... Zero (0) is indeed the smallest whole number.",
    },
    {
      id: "m_003", topic: "Rational Numbers", subtopic: "Definition", difficulty: 2, type: "mcq",
      question: "Which of the following is NOT a rational number?",
      options: ["3/4", "-7/2", "√2", "0"], correctAnswer: "√2",
      explanation: "√2 = 1.41421... is non-terminating, non-repeating. It cannot be expressed as p/q, so it is irrational.",
    },
    {
      id: "m_004", topic: "Linear Equations", subtopic: "Solving One-Variable Equations", difficulty: 2, type: "mcq",
      question: "What is the value of x in: 2x + 5 = 13?",
      options: ["x = 3", "x = 4", "x = 9", "x = 6"], correctAnswer: "x = 4",
      explanation: "2x + 5 = 13 → 2x = 8 → x = 4. Check: 2(4) + 5 = 13 ✓",
    },
    {
      id: "m_005", topic: "Algebraic Expressions", subtopic: "Like and Unlike Terms", difficulty: 2, type: "mcq",
      question: "Simplify: 3x + 2y + 5x - y",
      options: ["8x + y", "8x - y", "8xy", "5x + 3y"], correctAnswer: "8x + y",
      explanation: "(3x + 5x) + (2y - y) = 8x + y.",
    },
    {
      id: "m_006", topic: "Coordinate Geometry", subtopic: "Plotting Points", difficulty: 3, type: "mcq",
      question: "In which quadrant does the point (-3, 4) lie?",
      options: ["Quadrant I", "Quadrant II", "Quadrant III", "Quadrant IV"], correctAnswer: "Quadrant II",
      explanation: "In QII, x is negative and y is positive. (-3, 4) fits this: x = -3 < 0, y = 4 > 0.",
    },
    {
      id: "m_007", topic: "Polynomials", subtopic: "Degree of Polynomial", difficulty: 3, type: "mcq",
      question: "What is the degree of the polynomial 5x³ - 2x² + 7x - 1?",
      options: ["1", "2", "3", "4"], correctAnswer: "3",
      explanation: "The degree is the highest power of the variable. Here it is 3 (in 5x³).",
    },
    {
      id: "m_008", topic: "Quadratic Equations", subtopic: "Finding Roots", difficulty: 4, type: "mcq",
      question: "What are the roots of x² - 5x + 6 = 0?",
      options: ["x = 2 and x = 3", "x = -2 and x = -3", "x = 1 and x = 6", "x = 2 and x = -3"],
      correctAnswer: "x = 2 and x = 3",
      explanation: "x² - 5x + 6 = (x-2)(x-3) = 0 → x = 2 or x = 3.",
    },
    {
      id: "m_009", topic: "Arithmetic Progressions", subtopic: "nth Term Formula", difficulty: 4, type: "mcq",
      question: "Find the 10th term of the AP: 2, 5, 8, 11, ...",
      options: ["27", "29", "31", "32"], correctAnswer: "29",
      explanation: "aₙ = a + (n-1)d = 2 + 9×3 = 29.",
    },
    {
      id: "m_010", topic: "Probability", subtopic: "Basic Probability", difficulty: 3, type: "mcq",
      question: "A bag has 3 red and 5 blue balls. What is the probability of drawing a red ball?",
      options: ["3/5", "3/8", "5/8", "1/3"], correctAnswer: "3/8",
      explanation: "P(red) = 3 / (3+5) = 3/8.",
    },
    {
      id: "m_011", topic: "Trigonometry", subtopic: "Basic Ratios", difficulty: 4, type: "mcq",
      question: "In a right triangle, if sin θ = 3/5, what is cos θ?",
      options: ["4/5", "3/4", "5/3", "5/4"], correctAnswer: "4/5",
      explanation: "sin²θ + cos²θ = 1 → 9/25 + cos²θ = 1 → cos θ = 4/5.",
    },
    {
      id: "m_012", topic: "Statistics", subtopic: "Mean", difficulty: 2, type: "mcq",
      question: "Find the mean of: 4, 7, 13, 16, 10",
      options: ["9", "10", "11", "12"], correctAnswer: "10",
      explanation: "Mean = (4+7+13+16+10)/5 = 50/5 = 10.",
    },
    {
      id: "m_013", topic: "Integers", subtopic: "Operations on Integers", difficulty: 1, type: "mcq",
      question: "What is (-8) + (+13)?",
      options: ["-5", "+5", "-21", "+21"], correctAnswer: "+5",
      explanation: "13 - 8 = 5, take the sign of the larger absolute value. Answer: +5.",
    },
    {
      id: "m_014", topic: "Surface Areas and Volumes", subtopic: "Volume of Cylinder", difficulty: 3, type: "mcq",
      question: "The volume of a cylinder with radius 7 cm and height 10 cm is: (use π = 22/7)",
      options: ["1540 cm³", "154 cm³", "440 cm³", "1440 cm³"], correctAnswer: "1540 cm³",
      explanation: "V = πr²h = (22/7)×49×10 = 1540 cm³.",
    },
    {
      id: "m_015", topic: "Circles", subtopic: "Properties of Circles", difficulty: 4, type: "true_false",
      question: "The angle subtended by a diameter at the circumference of a circle is always 90°.",
      options: ["True", "False"], correctAnswer: "True",
      explanation: "Thales' theorem: any angle inscribed in a semicircle is 90°.",
    },
  ],

  science: [
    {
      id: "s_001", topic: "Motion", subtopic: "Speed and Velocity", difficulty: 2, type: "mcq",
      question: "A car travels 150 km in 3 hours. What is its average speed?",
      options: ["30 km/h", "45 km/h", "50 km/h", "60 km/h"], correctAnswer: "50 km/h",
      explanation: "Speed = 150 ÷ 3 = 50 km/h.",
    },
    {
      id: "s_002", topic: "Force and Laws of Motion", subtopic: "Newton's Laws", difficulty: 2, type: "mcq",
      question: "According to Newton's First Law, a moving object will continue moving unless:",
      options: ["It reaches maximum speed", "An external force acts on it", "It generates heat", "Gravity pulls it"],
      correctAnswer: "An external force acts on it",
      explanation: "Newton's First Law: an object in motion stays in motion unless acted upon by an external net force.",
    },
    {
      id: "s_003", topic: "Atoms and Molecules", subtopic: "Atomic Structure", difficulty: 1, type: "mcq",
      question: "What is the charge of a proton?",
      options: ["Negative", "Positive", "Neutral", "It varies"], correctAnswer: "Positive",
      explanation: "Protons carry +1 charge. Electrons carry -1. Neutrons are neutral.",
    },
    {
      id: "s_004", topic: "Cell — Structure and Functions", subtopic: "Cell Organelles", difficulty: 2, type: "mcq",
      question: "Which organelle is called the 'powerhouse of the cell'?",
      options: ["Nucleus", "Ribosome", "Mitochondria", "Vacuole"], correctAnswer: "Mitochondria",
      explanation: "Mitochondria produce ATP through cellular respiration — the cell's energy currency.",
    },
    {
      id: "s_005", topic: "Chemical Reactions and Equations", subtopic: "Types of Reactions", difficulty: 3, type: "mcq",
      question: "In the reaction: 2H₂ + O₂ → 2H₂O, this is an example of:",
      options: ["Decomposition reaction", "Combination reaction", "Displacement reaction", "Double displacement"],
      correctAnswer: "Combination reaction",
      explanation: "Two substances combine to form a single product — this is a combination reaction.",
    },
    {
      id: "s_006", topic: "Gravitation", subtopic: "Universal Law of Gravitation", difficulty: 3, type: "mcq",
      question: "The value of acceleration due to gravity (g) on Earth's surface is approximately:",
      options: ["6.67 m/s²", "9.8 m/s²", "11.2 m/s²", "3.8 m/s²"], correctAnswer: "9.8 m/s²",
      explanation: "g ≈ 9.8 m/s² on Earth's surface. Note: G (gravitational constant) = 6.67×10⁻¹¹ N·m²/kg².",
    },
    {
      id: "s_007", topic: "Light — Reflection and Refraction", subtopic: "Laws of Reflection", difficulty: 2, type: "true_false",
      question: "The angle of incidence is always equal to the angle of reflection.",
      options: ["True", "False"], correctAnswer: "True",
      explanation: "First law of reflection: ∠i = ∠r. Both measured from the normal.",
    },
    {
      id: "s_008", topic: "Acids, Bases and Salts", subtopic: "pH Scale", difficulty: 2, type: "mcq",
      question: "A solution with pH = 3 is:",
      options: ["Strongly basic", "Weakly basic", "Neutral", "Acidic"], correctAnswer: "Acidic",
      explanation: "pH 0–6 = acidic, 7 = neutral, 8–14 = basic. pH 3 is acidic.",
    },
    {
      id: "s_009", topic: "Electricity", subtopic: "Ohm's Law", difficulty: 3, type: "mcq",
      question: "If voltage = 12V and resistance = 4Ω, current is:",
      options: ["3 A", "48 A", "0.33 A", "8 A"], correctAnswer: "3 A",
      explanation: "I = V/R = 12/4 = 3 A.",
    },
    {
      id: "s_010", topic: "Heredity and Evolution", subtopic: "Mendel's Laws", difficulty: 4, type: "mcq",
      question: "In a monohybrid cross between Tt × Tt, what is the phenotypic ratio?",
      options: ["1:2:1", "3:1", "1:1", "2:1:1"], correctAnswer: "3:1",
      explanation: "Tt × Tt gives TT:Tt:tt = 1:2:1 (genotypic). Phenotypic = 3 dominant : 1 recessive.",
    },
  ],
};

module.exports = { NCERT_QUESTIONS };
