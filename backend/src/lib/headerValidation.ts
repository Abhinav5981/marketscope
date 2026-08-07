// Header + row-level validation for an uploaded portfolio (PF) file.
//
// Deliberately decoupled from any DB/network access — this is a pure
// function over already-parsed rows, so it's fast to run at upload time and
// trivial to unit test in isolation (see tests/lib/headerValidation.test.ts).
// Geocoding of missing lat/lng happens later, during market creation, not
// here.

export interface RawPortfolioRow {
  [originalHeader: string]: unknown;
}

export interface NormalizedPortfolioRow {
  storeName: string;
  address: string;
  city: string;
  state: string;
  country: string;
  category: string;
  latitude: number | null;
  longitude: number | null;
}

export interface ColumnError {
  column: string;
  message: string;
}

export interface RowError {
  /** 1-indexed position among data rows, i.e. row 1 is the first row after the header. */
  row: number;
  column: string;
  value: unknown;
  message: string;
}

export interface RowWarning {
  row: number;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  columnErrors: ColumnError[];
  rowErrors: RowError[];
  rowWarnings: RowWarning[];
  acceptedRowCount: number;
  rejectedRowCount: number;
  acceptedRows: NormalizedPortfolioRow[];
}

const REQUIRED_COLUMNS = ["store_name", "address", "city", "state", "country"] as const;
const OPTIONAL_TEXT_COLUMNS = ["category"] as const;
const OPTIONAL_COORD_COLUMNS = ["latitude", "longitude"] as const;

type RequiredColumn = (typeof REQUIRED_COLUMNS)[number];

function normalizeHeader(header: string): string {
  return header.trim().toLowerCase().replace(/\s+/g, "_");
}

/** Maps canonical column name -> the original header string used in the file, if present. */
function buildHeaderMap(headers: string[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const original of headers) {
    const canonical = normalizeHeader(original);
    if (!map.has(canonical)) {
      map.set(canonical, original);
    }
  }
  return map;
}

function asTrimmedString(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

/**
 * Validates an uploaded portfolio file's headers and rows.
 *
 * Column-level failures (a required column missing entirely) are fatal:
 * `valid` is false and no rows are processed, since row checks would be
 * meaningless against columns that don't exist.
 *
 * Row-level failures are NOT fatal at the file level: a bad row (blank
 * required field, malformed lat/lng) is skipped and reported, but the rest
 * of the file is still accepted. A single messy row shouldn't block an
 * otherwise-good upload.
 */
export function validatePortfolioHeaders(
  headers: string[],
  rows: RawPortfolioRow[]
): ValidationResult {
  const headerMap = buildHeaderMap(headers);

  const columnErrors: ColumnError[] = [];
  for (const required of REQUIRED_COLUMNS) {
    if (!headerMap.has(required)) {
      columnErrors.push({
        column: required,
        message: `Required column "${required}" is missing.`,
      });
    }
  }

  if (columnErrors.length > 0) {
    return {
      valid: false,
      columnErrors,
      rowErrors: [],
      rowWarnings: [],
      acceptedRowCount: 0,
      rejectedRowCount: 0,
      acceptedRows: [],
    };
  }

  const rowWarnings: RowWarning[] = [];
  const hasCategoryColumn = headerMap.has("category");
  if (!hasCategoryColumn) {
    rowWarnings.push({
      row: 0,
      message: 'Optional column "category" is missing; all rows will default to "Unknown".',
    });
  }

  const rowErrors: RowError[] = [];
  const acceptedRows: NormalizedPortfolioRow[] = [];

  rows.forEach((rawRow, index) => {
    const rowNumber = index + 1;
    const get = (canonical: RequiredColumn | (typeof OPTIONAL_TEXT_COLUMNS)[number]) => {
      const original = headerMap.get(canonical);
      return original ? rawRow[original] : undefined;
    };

    const storeName = asTrimmedString(get("store_name"));
    const address = asTrimmedString(get("address"));
    const city = asTrimmedString(get("city"));
    const state = asTrimmedString(get("state"));
    const country = asTrimmedString(get("country"));

    let rowIsValid = true;
    for (const [column, value] of [
      ["store_name", storeName],
      ["address", address],
      ["city", city],
      ["state", state],
      ["country", country],
    ] as const) {
      if (value === "") {
        rowErrors.push({
          row: rowNumber,
          column,
          value: rawRow[headerMap.get(column) ?? column],
          message: `"${column}" is required and cannot be blank.`,
        });
        rowIsValid = false;
      }
    }

    const category = hasCategoryColumn ? asTrimmedString(get("category")) || "Unknown" : "Unknown";

    const { latitude, longitude, error: coordError } = parseCoordinates(headerMap, rawRow);
    if (coordError) {
      rowErrors.push({ row: rowNumber, ...coordError });
      rowIsValid = false;
    }

    if (rowIsValid) {
      acceptedRows.push({ storeName, address, city, state, country, category, latitude, longitude });
    }
  });

  return {
    valid: true,
    columnErrors: [],
    rowErrors,
    rowWarnings,
    acceptedRowCount: acceptedRows.length,
    rejectedRowCount: rows.length - acceptedRows.length,
    acceptedRows,
  };
}

function parseCoordinates(
  headerMap: Map<string, string>,
  rawRow: RawPortfolioRow
): { latitude: number | null; longitude: number | null; error?: { column: string; value: unknown; message: string } } {
  const latHeader = headerMap.get("latitude");
  const lngHeader = headerMap.get("longitude");

  const rawLat = latHeader ? rawRow[latHeader] : undefined;
  const rawLng = lngHeader ? rawRow[lngHeader] : undefined;

  const latPresent = rawLat !== undefined && rawLat !== null && String(rawLat).trim() !== "";
  const lngPresent = rawLng !== undefined && rawLng !== null && String(rawLng).trim() !== "";

  if (!latPresent && !lngPresent) {
    return { latitude: null, longitude: null };
  }

  if (latPresent !== lngPresent) {
    const [presentColumn, presentValue] = latPresent
      ? [OPTIONAL_COORD_COLUMNS[0], rawLat]
      : [OPTIONAL_COORD_COLUMNS[1], rawLng];
    return {
      latitude: null,
      longitude: null,
      error: {
        column: presentColumn,
        value: presentValue,
        message: "latitude and longitude must both be present, or both omitted.",
      },
    };
  }

  const lat = Number(rawLat);
  const lng = Number(rawLng);

  if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
    return {
      latitude: null,
      longitude: null,
      error: { column: "latitude", value: rawLat, message: "latitude must be a number between -90 and 90." },
    };
  }
  if (!Number.isFinite(lng) || lng < -180 || lng > 180) {
    return {
      latitude: null,
      longitude: null,
      error: { column: "longitude", value: rawLng, message: "longitude must be a number between -180 and 180." },
    };
  }

  return { latitude: lat, longitude: lng };
}
