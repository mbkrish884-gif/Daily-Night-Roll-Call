// Central constants and environment-driven defaults.

export const ATTENDANCE_STATUSES = [
  "PENDING",
  "PRESENT",
  "ABSENT",
  "OFF",
  "AVAILABLE",
  "DUTY_ASSIGNED",
] as const;
export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];

// Statuses a PC may self-select on the public form (PENDING is system-only).
export const SELF_STATUSES = ["PRESENT", "ABSENT", "OFF", "AVAILABLE"] as const;

// Statuses that require a validated in-geofence location.
export const GEO_REQUIRED_STATUSES: AttendanceStatus[] = ["PRESENT"];

export const STATUS_LABELS: Record<AttendanceStatus, string> = {
  PENDING: "Not marked",
  PRESENT: "Present at HQ",
  ABSENT: "Absent",
  OFF: "Off",
  AVAILABLE: "Available at HQ",
  DUTY_ASSIGNED: "Sent on Duty",
};

export const STATUS_COLORS: Record<AttendanceStatus, string> = {
  PENDING: "#94a3b8",
  PRESENT: "#16a34a",
  ABSENT: "#dc2626",
  OFF: "#d97706",
  AVAILABLE: "#2563eb",
  DUTY_ASSIGNED: "#7c3aed",
};

export const ROLES = ["ADMIN", "SUPERADMIN"] as const;
export type Role = (typeof ROLES)[number];

// HQ geofence fallback. The real centre is stored in the HqLocation table and
// is editable from Admin -> Settings. These env values seed the first row.
export const HQ_DEFAULTS = {
  name: process.env.HQ_NAME || "CAR Headquarters, Hyderabad",
  mapsUrl: process.env.HQ_MAPS_URL || "https://maps.app.goo.gl/3gAe8kV9YivVQYr6A",
  // Placeholder = Hyderabad city centre. REPLACE with the exact HQ coordinates
  // (open the maps link, read lat/lng) via .env or Admin -> Settings.
  lat: Number(process.env.HQ_LAT ?? 17.385044),
  lng: Number(process.env.HQ_LNG ?? 78.486671),
  radiusM: Number(process.env.HQ_RADIUS_M ?? 150),
};

export const ROLL_CALL_TIME = process.env.ROLL_CALL_TIME || "19:00";
export const IST_OFFSET_MINUTES = 330; // Asia/Kolkata, no DST
