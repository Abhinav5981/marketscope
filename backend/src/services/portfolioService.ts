import { prisma } from "../lib/prismaClient";
import { parsePortfolioFile } from "../lib/fileParser";
import { validatePortfolioHeaders, type RowError, type RowWarning } from "../lib/headerValidation";
import { BadRequestError } from "../types/errors";

export interface UploadPortfolioResult {
  insertedCount: number;
  rejectedCount: number;
  rowWarnings: RowWarning[];
  rowErrors: RowError[];
}

/**
 * Parses + validates an uploaded portfolio file and replaces the current
 * portfolio with it. Re-upload is destructive by design (delete-then-insert
 * in one transaction) — see README "Architecture decisions" for why, given
 * this app has no auth/multi-tenancy or upload-batch concept.
 */
export async function uploadPortfolio(buffer: Buffer, originalFilename: string): Promise<UploadPortfolioResult> {
  const { headers, rows } = await parsePortfolioFile(buffer, originalFilename);
  const validation = validatePortfolioHeaders(headers, rows);

  if (!validation.valid) {
    throw new BadRequestError("Portfolio file failed header validation.", {
      columnErrors: validation.columnErrors,
    });
  }

  await prisma.$transaction([
    prisma.portfolioStore.deleteMany({}),
    prisma.portfolioStore.createMany({
      data: validation.acceptedRows.map((row) => ({
        storeName: row.storeName,
        address: row.address,
        city: row.city,
        state: row.state,
        country: row.country,
        category: row.category,
        latitude: row.latitude,
        longitude: row.longitude,
        geocoded: row.latitude !== null,
        geocodeSource: row.latitude !== null ? "upload" : null,
      })),
    }),
  ]);

  return {
    insertedCount: validation.acceptedRowCount,
    rejectedCount: validation.rejectedRowCount,
    rowWarnings: validation.rowWarnings,
    rowErrors: validation.rowErrors,
  };
}

export function listPortfolio() {
  return prisma.portfolioStore.findMany({ orderBy: { createdAt: "desc" } });
}
