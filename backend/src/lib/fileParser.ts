import ExcelJS from "exceljs";
import Papa from "papaparse";
import type { RawPortfolioRow } from "./headerValidation";

export interface ParsedFile {
  headers: string[];
  rows: RawPortfolioRow[];
}

export class UnsupportedFileTypeError extends Error {}

function fileExtension(filename: string): string {
  return filename.toLowerCase().split(".").pop() ?? "";
}

function isBlankRow(row: RawPortfolioRow): boolean {
  return Object.values(row).every((v) => v === null || v === undefined || String(v).trim() === "");
}

function parseCsv(buffer: Buffer): ParsedFile {
  const text = buffer.toString("utf-8");
  const parsed = Papa.parse<RawPortfolioRow>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header) => header.trim(),
  });

  const headers = parsed.meta.fields ?? [];
  const rows = parsed.data.filter((row) => !isBlankRow(row));
  return { headers, rows };
}

/**
 * ExcelJS cell values can be a plain primitive, a Date, or one of several
 * rich object shapes (rich text, formula results, hyperlinks). We only need
 * a display-ish string/number/boolean out of them for portfolio parsing —
 * this intentionally doesn't try to preserve formatting or formulas.
 */
function cellValueToPrimitive(value: ExcelJS.CellValue): unknown {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") {
    const obj = value as unknown as Record<string, unknown>;
    if (typeof obj.text === "string") return obj.text;
    if (Array.isArray(obj.richText)) {
      return (obj.richText as { text: string }[]).map((t) => t.text).join("");
    }
    if ("result" in obj) return obj.result;
    return String(value);
  }
  return value;
}

async function parseXlsx(buffer: Buffer): Promise<ParsedFile> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);

  const worksheet = workbook.worksheets[0];
  if (!worksheet) return { headers: [], rows: [] };

  const headers: string[] = [];
  worksheet.getRow(1).eachCell({ includeEmpty: false }, (cell, colNumber) => {
    headers[colNumber - 1] = String(cellValueToPrimitive(cell.value) ?? "").trim();
  });

  const rows: RawPortfolioRow[] = [];
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return; // header row already consumed
    const rawRow: RawPortfolioRow = {};
    headers.forEach((header, idx) => {
      if (!header) return;
      rawRow[header] = cellValueToPrimitive(row.getCell(idx + 1).value);
    });
    if (!isBlankRow(rawRow)) rows.push(rawRow);
  });

  return { headers, rows };
}

/** Parses an uploaded portfolio file (CSV or XLSX) into headers + raw rows, ready for validatePortfolioHeaders. */
export function parsePortfolioFile(buffer: Buffer, originalFilename: string): Promise<ParsedFile> {
  const ext = fileExtension(originalFilename);
  if (ext === "csv") return Promise.resolve(parseCsv(buffer));
  if (ext === "xlsx") return parseXlsx(buffer);
  throw new UnsupportedFileTypeError(`Unsupported file type ".${ext}" — please upload a .csv or .xlsx file.`);
}
