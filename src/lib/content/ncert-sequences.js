// @ts-check

/**
 * NCERT Chapter Sequences by Subject and Class.
 * Used to constrain the AI curriculum generator to proper NCERT ordering.
 */
const NCERT_SEQUENCES = {
  maths: {
    6: [
      "Knowing Our Numbers", "Whole Numbers", "Playing with Numbers",
      "Basic Geometrical Ideas", "Understanding Elementary Shapes", "Integers",
      "Fractions", "Decimals", "Data Handling", "Mensuration",
      "Algebra", "Ratio and Proportion", "Symmetry", "Practical Geometry",
    ],
    7: [
      "Integers", "Fractions and Decimals", "Data Handling", "Simple Equations",
      "Lines and Angles", "The Triangle and its Properties", "Congruence of Triangles",
      "Comparing Quantities", "Rational Numbers", "Practical Geometry",
      "Perimeter and Area", "Algebraic Expressions", "Exponents and Powers",
      "Symmetry", "Visualising Solid Shapes",
    ],
    8: [
      "Rational Numbers", "Linear Equations in One Variable",
      "Understanding Quadrilaterals", "Practical Geometry", "Data Handling",
      "Squares and Square Roots", "Cubes and Cube Roots", "Comparing Quantities",
      "Algebraic Expressions and Identities", "Visualising Solid Shapes",
      "Mensuration", "Exponents and Powers", "Direct and Inverse Proportions",
      "Factorisation", "Introduction to Graphs", "Playing with Numbers",
    ],
    9: [
      "Number Systems", "Polynomials", "Coordinate Geometry",
      "Linear Equations in Two Variables", "Introduction to Euclid's Geometry",
      "Lines and Angles", "Triangles", "Quadrilaterals",
      "Areas of Parallelograms and Triangles", "Circles", "Constructions",
      "Heron's Formula", "Surface Areas and Volumes", "Statistics", "Probability",
    ],
    10: [
      "Real Numbers", "Polynomials", "Pair of Linear Equations in Two Variables",
      "Quadratic Equations", "Arithmetic Progressions", "Triangles",
      "Coordinate Geometry", "Introduction to Trigonometry",
      "Some Applications of Trigonometry", "Circles", "Constructions",
      "Areas Related to Circles", "Surface Areas and Volumes", "Statistics", "Probability",
    ],
    11: [
      "Sets", "Relations and Functions", "Trigonometric Functions",
      "Principle of Mathematical Induction",
      "Complex Numbers and Quadratic Equations", "Linear Inequalities",
      "Permutations and Combinations", "Binomial Theorem", "Sequences and Series",
      "Straight Lines", "Conic Sections",
      "Introduction to Three Dimensional Geometry", "Limits and Derivatives",
      "Mathematical Reasoning", "Statistics", "Probability",
    ],
    12: [
      "Relations and Functions", "Inverse Trigonometric Functions",
      "Matrices", "Determinants", "Continuity and Differentiability",
      "Application of Derivatives", "Integrals", "Application of Integrals",
      "Differential Equations", "Vector Algebra", "Three Dimensional Geometry",
      "Linear Programming", "Probability",
    ],
  },
  science: {
    8: [
      "Crop Production and Management", "Microorganisms: Friend and Foe",
      "Synthetic Fibres and Plastics", "Materials: Metals and Non-Metals",
      "Coal and Petroleum", "Combustion and Flame",
      "Conservation of Plants and Animals", "Cell — Structure and Functions",
      "Reproduction in Animals", "Reaching the Age of Adolescence",
      "Force and Pressure", "Friction", "Sound",
      "Chemical Effects of Electric Current", "Some Natural Phenomena",
      "Light", "Stars and The Solar System", "Pollution of Air and Water",
    ],
    9: [
      "Matter in Our Surroundings", "Is Matter Around Us Pure",
      "Atoms and Molecules", "Structure of the Atom",
      "The Fundamental Unit of Life", "Tissues", "Diversity in Living Organisms",
      "Motion", "Force and Laws of Motion", "Gravitation", "Work and Energy",
      "Sound", "Why Do We Fall Ill", "Natural Resources",
      "Improvement in Food Resources",
    ],
    10: [
      "Chemical Reactions and Equations", "Acids, Bases and Salts",
      "Metals and Non-metals", "Carbon and its Compounds",
      "Periodic Classification of Elements", "Life Processes",
      "Control and Coordination", "How do Organisms Reproduce",
      "Heredity and Evolution", "Light — Reflection and Refraction",
      "Human Eye and Colourful World", "Electricity",
      "Magnetic Effects of Electric Current", "Sources of Energy",
      "Our Environment", "Sustainable Management of Natural Resources",
    ],
  },
  english: {
    9: [
      "The Fun They Had", "The Sound of Music", "The Little Girl",
      "A Truly Beautiful Mind", "The Snake and the Mirror", "My Childhood",
      "Packing", "Reach for the Top", "The Bond of Love", "Kathmandu",
      "If I Were You",
    ],
    10: [
      "A Letter to God", "Nelson Mandela: Long Walk to Freedom",
      "Two Stories About Flying", "From the Diary of Anne Frank",
      "The Hundred Dresses–I", "The Hundred Dresses–II", "Glimpses of India",
      "Mijbil the Otter", "Madam Rides the Bus", "The Sermon at Benares",
      "The Proposal",
    ],
  },
  social_science: {
    9: [
      "The French Revolution",
      "Socialism in Europe and the Russian Revolution",
      "Nazism and the Rise of Hitler", "Forest Society and Colonialism",
      "Pastoralists in the Modern World", "India — Size and Location",
      "Physical Features of India", "Drainage", "Climate",
      "Natural Vegetation and Wildlife", "Population",
      "What is Democracy? Why Democracy?", "Constitutional Design",
      "Electoral Politics", "Working of Institutions", "Democratic Rights",
      "The Story of Village Palampur", "People as Resource",
      "Poverty as a Challenge", "Food Security in India",
    ],
    10: [
      "The Rise of Nationalism in Europe", "Nationalism in India",
      "The Making of a Global World", "The Age of Industrialisation",
      "Print Culture and the Modern World", "Resources and Development",
      "Forest and Wildlife Resources", "Water Resources", "Agriculture",
      "Minerals and Energy Resources", "Manufacturing Industries",
      "Life Lines of National Economy", "Power Sharing", "Federalism",
      "Democracy and Diversity", "Gender, Religion and Caste",
      "Popular Struggles and Movements", "Political Parties",
      "Outcomes of Democracy", "Challenges to Democracy", "Development",
      "Sectors of the Indian Economy", "Money and Credit",
      "Globalisation and the Indian Economy", "Consumer Rights",
    ],
  },
  hindi: {
    9: [
      "दो बैलों की कथा", "ल्हासा की ओर", "उपभोक्तावाद की संस्कृति",
      "साँवले सपनों की याद", "नाना पाटेकर", "प्रेमचंद के फटे जूते",
      "मेरे बचपन के दिन", "एक कुत्ता और एक मैना",
    ],
    10: [
      "बड़े भाई साहब", "डायरी का एक पन्ना", "तताँरा-वामीरो कथा",
      "तीसरी कसम के शिल्पकार शैलेंद्र", "गिरगिट",
      "अब कहाँ दूसरे के दुख से दुखी होने वाले",
      "पतझर में टूटी पत्तियाँ", "कारतूस",
    ],
  },
};

module.exports = { NCERT_SEQUENCES };
