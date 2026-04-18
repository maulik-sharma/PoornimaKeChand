require('dotenv').config();
const { callWithFallback } = require('./src/lib/ai/fallback.js');
const { prisma } = require('./src/lib/db/prisma.js');

async function main() {
  console.log("Starting AI test...");
  try {
    const rawResponse = await callWithFallback({
      useCase: "curriculum",
      cacheKey: "test_cache",
      systemPrompt: "You are an expert Indian school curriculum designer. Return ONLY valid JSON.",
      userMessage: "Generate a mock plan.",
    });
    console.log("Response:", rawResponse);
  } catch(e) {
    console.error("Test Error:", e);
  } finally {
    await prisma.$disconnect();
  }
}
main();
