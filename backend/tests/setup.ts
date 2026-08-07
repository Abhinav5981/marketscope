// Vitest setup: ensures `npm test` is runnable standalone (no Postgres, no
// .env file needed) per the deliverable "tests runnable via a single
// documented command." Nothing under test actually opens a DB connection —
// this only satisfies env.ts's eager validation at import time.
process.env.DATABASE_URL ??= "postgresql://test:test@localhost:5432/test";
process.env.CONTACT_EMAIL ??= "test@example.com";
