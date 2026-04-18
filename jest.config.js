const nextJest = require("next/jest");

const createJestConfig = nextJest({ dir: "./" });

/** @type {import('jest').Config} */
const config = {
  testEnvironment: "node",
  testMatch: ["**/tests/unit/**/*.test.js"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
  },
  collectCoverageFrom: [
    "src/lib/**/*.js",
    "!src/lib/db/**",
    "!src/lib/cache/**",
    "!src/lib/sms/**",
  ],
  coverageThreshold: {
    global: {
      lines: 70,
    },
  },
};

module.exports = createJestConfig(config);
