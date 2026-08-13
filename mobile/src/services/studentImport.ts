/**
 * Parse Excel/CSV (and public Google Sheets CSV export) into student contact rows,
 * create students without enrollment, and export contacts to a shareable sheet.
 */
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import * as XLSX from "xlsx";
import { createStudent, listStudents } from "@/src/repositories";

export type ParsedStudentRow = {
  rowNumber: number;
  name: string;
  student_phone: string | null;
  guardian_phone: string | null;
  error?: string;
};

export type StudentImportParseResult = {
  rows: ParsedStudentRow[];
  validCount: number;
  errorCount: number;
};

export type StudentImportRunResult = {
  imported: number;
  skipped: number;
  errors: string[];
};

type MappedField = "name" | "student_phone" | "guardian_phone";

const HEADER_ALIASES: Record<MappedField, string[]> = {
  name: [
    "name",
    "student name",
    "student",
    "full name",
    "اسم",
    "اسم الطالب",
    "الطالب",
    "الاسم",
  ],
  student_phone: [
    "student phone",
    "student_phone",
    "phone",
    "mobile",
    "هاتف",
    "هاتف الطالب",
    "جوال الطالب",
    "رقم الطالب",
  ],
  guardian_phone: [
    "guardian phone",
    "guardian_phone",
    "parent phone",
    "parent",
    "guardian",
    "هاتف ولي الأمر",
    "ولي الأمر",
    "جوال ولي الأمر",
    "رقم ولي الأمر",
    "هاتف الولي",
  ],
};

/** Stable export / re-import headers (English so sheets stay portable). */
export const STUDENT_SHEET_HEADERS = [
  "name",
  "parent phone",
  "student phone",
] as const;

function normalizeHeader(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");
}

function cellToString(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  return String(value).trim();
}

function mapHeaders(headers: string[]): Partial<Record<MappedField, number>> {
  const map: Partial<Record<MappedField, number>> = {};
  headers.forEach((header, index) => {
    const normalized = normalizeHeader(header);
    if (!normalized) return;
    (Object.keys(HEADER_ALIASES) as MappedField[]).forEach((field) => {
      if (map[field] != null) return;
      if (HEADER_ALIASES[field].includes(normalized)) {
        map[field] = index;
      }
    });
  });
  return map;
}

/** Convert a 2D sheet matrix into validated contact-only student rows. */
export function parseStudentMatrix(
  matrix: unknown[][]
): StudentImportParseResult {
  if (!matrix.length) {
    return { rows: [], validCount: 0, errorCount: 0 };
  }

  const headerRowIndex = matrix.findIndex((row) =>
    (row ?? []).some((cell) => cellToString(cell).length > 0)
  );
  if (headerRowIndex < 0) {
    return { rows: [], validCount: 0, errorCount: 0 };
  }

  const headers = (matrix[headerRowIndex] ?? []).map((cell) =>
    cellToString(cell)
  );
  const col = mapHeaders(headers);
  if (col.name == null) {
    throw new Error("IMPORT_MISSING_NAME_COLUMN");
  }

  const rows: ParsedStudentRow[] = [];
  for (let i = headerRowIndex + 1; i < matrix.length; i += 1) {
    const raw = matrix[i] ?? [];
    const isEmpty = raw.every((cell) => !cellToString(cell));
    if (isEmpty) continue;

    const name = cellToString(raw[col.name!]);
    const student_phone =
      col.student_phone != null
        ? cellToString(raw[col.student_phone]) || null
        : null;
    const guardian_phone =
      col.guardian_phone != null
        ? cellToString(raw[col.guardian_phone]) || null
        : null;

    const rowNumber = i + 1;
    if (!name) {
      rows.push({
        rowNumber,
        name: "",
        student_phone,
        guardian_phone,
        error: "IMPORT_ROW_MISSING_NAME",
      });
      continue;
    }

    rows.push({
      rowNumber,
      name,
      student_phone,
      guardian_phone,
    });
  }

  const errorCount = rows.filter((r) => r.error).length;
  return {
    rows,
    validCount: rows.length - errorCount,
    errorCount,
  };
}

function workbookToMatrix(workbook: XLSX.WorkBook): unknown[][] {
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return [];
  const sheet = workbook.Sheets[sheetName];
  return XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: "",
    raw: false,
  }) as unknown[][];
}

/** Parse a local Excel (.xlsx/.xls) or CSV file URI. */
export async function parseStudentsFromFileUri(
  uri: string,
  fileName?: string
): Promise<StudentImportParseResult> {
  const lower = (fileName ?? uri).toLowerCase();
  const isCsv = lower.endsWith(".csv") || lower.includes("text/csv");

  if (isCsv) {
    const text = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.UTF8,
    });
    const workbook = XLSX.read(text, { type: "string" });
    return parseStudentMatrix(workbookToMatrix(workbook));
  }

  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  const workbook = XLSX.read(base64, { type: "base64" });
  return parseStudentMatrix(workbookToMatrix(workbook));
}

/**
 * Turn a Google Sheets share / edit / pub link into a CSV export URL.
 * Requires the sheet to be viewable by anyone with the link (no OAuth).
 */
export function googleSheetsToCsvExportUrl(input: string): string {
  const url = input.trim();
  if (!url) {
    throw new Error("IMPORT_SHEETS_URL_REQUIRED");
  }

  if (
    /output=csv/i.test(url) ||
    /export\?.*format=csv/i.test(url) ||
    /\.csv(\?|$)/i.test(url)
  ) {
    return url;
  }

  const idMatch = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (!idMatch?.[1]) {
    throw new Error("IMPORT_SHEETS_URL_INVALID");
  }
  const id = idMatch[1];

  let gid = "0";
  const gidHash = url.match(/[#&?]gid=([0-9]+)/);
  if (gidHash?.[1]) gid = gidHash[1];

  return `https://docs.google.com/spreadsheets/d/${id}/export?format=csv&gid=${gid}`;
}

/** Fetch a public Google Sheet as CSV and parse student rows. */
export async function parseStudentsFromGoogleSheetsUrl(
  url: string
): Promise<StudentImportParseResult> {
  const exportUrl = googleSheetsToCsvExportUrl(url);
  const response = await fetch(exportUrl);
  if (!response.ok) {
    throw new Error("IMPORT_SHEETS_FETCH_FAILED");
  }
  const text = await response.text();
  const looksLikeHtml =
    /^\s*</.test(text) ||
    /<!DOCTYPE/i.test(text) ||
    /<html/i.test(text) ||
    /accounts\.google/i.test(text);
  if (looksLikeHtml) {
    throw new Error("IMPORT_SHEETS_NOT_PUBLIC");
  }
  const workbook = XLSX.read(text, { type: "string" });
  return parseStudentMatrix(workbookToMatrix(workbook));
}

/** Open the system file picker for Excel / CSV sheets. */
export async function pickStudentSheetFile(): Promise<{
  uri: string;
  name: string;
} | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: [
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-excel",
      "text/csv",
      "text/comma-separated-values",
      "application/csv",
      "application/octet-stream",
      "*/*",
    ],
    copyToCacheDirectory: true,
  });
  if (result.canceled || !result.assets?.[0]) return null;
  const asset = result.assets[0];
  return { uri: asset.uri, name: asset.name ?? "sheet" };
}

/** Create students from contact rows (no group enrollment). */
export async function importParsedStudents(
  rows: ParsedStudentRow[]
): Promise<StudentImportRunResult> {
  let imported = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const row of rows) {
    if (row.error || !row.name.trim()) {
      skipped += 1;
      errors.push(`#${row.rowNumber}: missing name`);
      continue;
    }
    try {
      await createStudent({
        name: row.name.trim(),
        student_phone: row.student_phone,
        guardian_phone: row.guardian_phone,
      });
      imported += 1;
    } catch (e) {
      skipped += 1;
      errors.push(
        `#${row.rowNumber}: ${e instanceof Error ? e.message : "failed"}`
      );
    }
  }

  return { imported, skipped, errors };
}

/** Build an .xlsx of student contacts and open the system share sheet. */
export async function exportStudentsSheet(): Promise<{
  path: string;
  count: number;
}> {
  const students = await listStudents();
  if (!students.length) {
    throw new Error("EXPORT_NO_STUDENTS");
  }

  const aoa: (string | number)[][] = [
    [...STUDENT_SHEET_HEADERS],
    ...students.map((s) => [
      s.name ?? "",
      s.guardian_phone ?? "",
      s.student_phone ?? "",
    ]),
  ];

  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet(aoa);
  XLSX.utils.book_append_sheet(workbook, sheet, "Students");
  const base64 = XLSX.write(workbook, {
    type: "base64",
    bookType: "xlsx",
  }) as string;

  const dir = FileSystem.cacheDirectory ?? FileSystem.documentDirectory;
  if (!dir) throw new Error("EXPORT_NO_STORAGE");
  const path = `${dir}students-export-${Date.now()}.xlsx`;
  await FileSystem.writeAsStringAsync(path, base64, {
    encoding: FileSystem.EncodingType.Base64,
  });

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(path, {
      mimeType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      dialogTitle: "Export students",
      UTI: "org.openxmlformats.spreadsheetml.sheet",
    });
  }

  return { path, count: students.length };
}
