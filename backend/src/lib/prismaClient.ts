import { PrismaClient } from "@prisma/client";

// A single shared Prisma client for the process — this is the standard
// pattern for a non-serverless Node/Express app (avoids exhausting the
// Postgres connection pool by creating a new client per request).
export const prisma = new PrismaClient();
