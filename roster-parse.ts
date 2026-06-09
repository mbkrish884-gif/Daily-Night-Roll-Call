import * as XLSX from "xlsx";
import Papa from "papaparse";

export interface ParsedEntry {
  slNo?: number;
  pcNumber: string;
  rank?: string;
  name?: string;
  unit?: string;
  mobile?: string;
  dutyRemarks?: string;
}

export interface ParsedRoster {
  date?: string;
  platoon?: string;
  vehicleNo?: string;
  instructions?: string;
  entries: ParsedEntry[];
  warnings: string[];
}

const HEADER_MAP: Record<string, keyof ParsedEntry> = {
  "sl no": "slNo",
  "sl. no": "slNo",
  "slno": "slNo",
  "s.no": "slNo",
  rank: "rank",
  "g.no": "pcNumber",
  gno: "pcNumber",
  "pc number": "pcNumber",
  "pc no": "pcNumber",
  pcnumber: "pcNumber",
  pc: "pcNumber",
  name: "name",
  "name s/sri/smt/kum": "name",
  coy: "unit",
  unit: "unit",
  "coy/ unit": "unit",
  "coy/unit": "unit",
  "mobile no": "mobile",
  "mobile no.": "mobile",
  mobile: "mobile",
  remarks: "dutyRemarks",
}; 

function norm(h: string): string {
  return h.toLowerCase().replace(/\s+/g, " ").replace(/\n/g, " ").trim();
}

function cleanNumber(v: unknown): string {
  if (v == null) return "";
  let s = String(v).trim();
  // Excel often stores PC/mobile numbers as floats like "11809.0"
  if (/^\d+\.0+$/.test(s)) s = s.replace(/\.0+$/, "");
  return s;
}

function rowsToEntries(rows: Record<string, unknown>[], warnings: string[]): ParsedEntry[] {
  const entries: ParsedEntry[] = [];
  for (const raw of rows) {
    const mapped: Partial<ParsedEntry> = {};
    for (const [key, value] of Object.entries(raw)) {
      const target = HEADER_MAP[norm(key)];
      if (!target) continue;
      if (target === "slNo") {
        const n = parseInt(cleanNumber(value), 10);
        if (!isNaN(n)) mapped.slNo = n;
      } else if (target === "pcNumber" || target === "mobile") {
        (mapped as Record<string, unknown>)[target] = cleanNumber(value);
      } else {
        const s = value == null ? "" : String(value).trim();
        if (s && s !== "#ERROR!") (mapped as Record<string, unknown>)[target] = s;
      }
    }
    if (!mapped.pcNumber) continue; // skip rows without a PC number
    entries.push({
      slNo: mapped.slNo,
      pcNumber: mapped.pcNumber,
      rank: mapped.rank || "PC",
      name: mapped.name,
      unit: mapped.unit,
      mobile: mapped.mobile,
      dutyRemarks: mapped.dutyRemarks,
    });
  }
  if (entries.length === 0) warnings.push("No rows with a valid PC/G.No were found.");
  return entries;
}

/** Parse a CSV string. */
export function parseCsv(text: string): ParsedRoster {
  const warnings: string[] = [];
  const res = Papa.parse<Record<string, unknown>>(text, {
    header: true,
    skipEmptyLines: true,
  });
  if (res.errors?.length) {
    for (const e of res.errors.slice(0, 5)) warnings.push(`CSV: ${e.message} (row ${e.row})`);
  }
  return { entries: rowsToEntries(res.data, warnings), warnings };
}

/**
 * Parse an .xlsx/.xls buffer. Detects the header row automatically (the duty
 * passport has title rows above the real header).
 */
export function parseXlsx(buf: Buffer): ParsedRoster {
  const warnings: string[] = [];
  const wb = XLSX.read(buf, { type: "buffer" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const grid: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: "" });

  // Find the header row: the row containing a "G.No" / "PC" type column.
  let headerIdx = -1;
  for (let i = 0; i < Math.min(grid.length, 15); i++) {
    const cells = grid[i].map((c) => norm(String(c)));
    if (cells.some((c) => c === "g.no" || c === "gno" || c === "pc number" || c === "rank")) {
      headerIdx = i;
      break;
    }
  }
  if (headerIdx === -1) {
    warnings.push("Could not locate a header row; assuming the first row is the header.");
    headerIdx = 0;
  }

  const headers = grid[headerIdx].map((c) => String(c));
  const rows: Record<string, unknown>[] = [];
  for (let i = headerIdx + 1; i < grid.length; i++) {
    const row = grid[i];
    if (!row || row.every((c) => String(c).trim() === "")) continue;
    const obj: Record<string, unknown> = {};
    headers.forEach((h, j) => (obj[h] = row[j]));
    rows.push(obj);
  }
  return { entries: rowsToEntries(rows, warnings), warnings };
}

export function parseRosterFile(filename: string, buf: Buffer): ParsedRoster {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".csv") || lower.endsWith(".tsv") || lower.endsWith(".txt")) {
    return parseCsv(buf.toString("utf8"));
  }
  return parseXlsx(buf);
}
