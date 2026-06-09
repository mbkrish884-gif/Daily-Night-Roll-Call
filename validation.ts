import { z } from "zod";
import { ATTENDANCE_STATUSES, SELF_STATUSES } from "./config";

export const pcNumberSchema = z
  .string()
  .trim()
  .min(1, "PC number is required")
  .max(20)
  .regex(/^[A-Za-z0-9/-]+$/, "PC number has invalid characters");

// Public self-service attendance submission.
export const attendanceSubmitSchema = z
  .object({
    pcNumber: pcNumberSchema,
    status: z.enum(SELF_STATUSES),
    latitude: z.number().min(-90).max(90).optional(),
    longitude: z.number().min(-180).max(180).optional(),
    accuracyM: z.number().min(0).max(100000).optional(),
    remarks: z.string().trim().max(500).optional(),
  })
  .refine(
    (v) => v.status !== "PRESENT" || (v.latitude != null && v.longitude != null),
    { message: "Location is required to mark Present.", path: ["latitude"] }
  );

// Admin edit of an attendance record.
export const adminAttendanceUpdateSchema = z.object({
  recordId: z.string().min(1),
  status: z.enum(ATTENDANCE_STATUSES).optional(),
  dutyLocation: z.string().trim().max(200).nullable().optional(),
  dutyRemarks: z.string().trim().max(500).nullable().optional(),
});

export const rosterEntryInputSchema = z.object({
  pcNumber: pcNumberSchema,
  rank: z.string().trim().max(20).optional(),
  name: z.string().trim().max(120).optional(),
  unit: z.string().trim().max(60).optional(),
  mobile: z.string().trim().max(20).optional(),
  dutyRemarks: z.string().trim().max(500).optional(),
});

export const rosterImportSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  platoon: z.string().trim().max(40).optional(),
  rollCallTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  vehicleNo: z.string().trim().max(40).optional(),
  instructions: z.string().trim().max(1000).optional(),
  replace: z.boolean().optional(),
  entries: z.array(rosterEntryInputSchema).min(1, "At least one PC is required"),
});

export const loginSchema = z.object({
  username: z.string().trim().min(1).max(60),
  password: z.string().min(1).max(200),
});

export const hqUpdateSchema = z.object({
  name: z.string().trim().min(1).max(120),
  mapsUrl: z.string().trim().max(300).optional().nullable(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  radiusM: z.number().int().min(20).max(5000),
});

export type AttendanceSubmit = z.infer<typeof attendanceSubmitSchema>;
export type RosterImport = z.infer<typeof rosterImportSchema>;
