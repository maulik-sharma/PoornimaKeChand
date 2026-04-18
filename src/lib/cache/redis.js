// @ts-check
const { Redis } = require("@upstash/redis");

/** @type {Redis} */
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL ?? "https://fake.upstash.io",
  token: process.env.UPSTASH_REDIS_REST_TOKEN ?? "fake",
});

module.exports = { redis };
