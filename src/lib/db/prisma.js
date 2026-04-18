// @ts-check
const { PrismaClient } = require("@prisma/client");

const globalForPrisma = /** @type {any} */ (global);

/** @type {PrismaClient} */
const prisma = globalForPrisma.prisma ?? new PrismaClient({
  log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
});

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

module.exports = { prisma };
