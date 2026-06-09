import { prisma } from "./db";
import type { RecordRow, SummaryCounts } from "./types";

export async function getDayData(date: string): Promise<{
  rosterExists: boolean;
  instructions: string | null;
  rollCallTime: string;
  platoon: string;
  rows: RecordRow[];
  counts: SummaryCounts;
}> {
  const roster = await prisma.dailyRoster.findUnique({
    where: { date },
    include: {
      entries: {
        orderBy: { slNo: "asc" },
        include: { pc: true, attendance: true },
      },
    },
  });

  const rows: RecordRow[] = (roster?.entries ?? []).map((e) => ({
    id: e.attendance?.id ?? e.id,
    slNo: e.slNo,
    pcNumber: e.pc.pcNumber,
    rank: e.pc.rank,
    name: e.pc.name,
    unit: e.pc.unit,
    mobile: e.pc.mobile,
    status: e.attendance?.status ?? "PENDING",
    presentAt: e.attendance?.presentAt?.toISOString() ?? null,
    markedAt: e.attendance?.markedAt?.toISOString() ?? null,
    distanceM: e.attendance?.distanceM ?? null,
    geofenceOk: e.attendance?.geofenceOk ?? null,
    dutyLocation: e.attendance?.dutyLocation ?? null,
    dutyRemarks: e.attendance?.dutyRemarks ?? e.dutyRemarks ?? null,
    source: e.attendance?.source ?? "self",
  }));

  const counts: SummaryCounts = {
    total: rows.length,
    present: rows.filter((r) => r.status === "PRESENT").length,
    absent: rows.filter((r) => r.status === "ABSENT").length,
    off: rows.filter((r) => r.status === "OFF").length,
    available: rows.filter((r) => r.status === "AVAILABLE").length,
    duty: rows.filter((r) => r.status === "DUTY_ASSIGNED").length,
    pending: rows.filter((r) => r.status === "PENDING").length,
  };

  return {
    rosterExists: !!roster,
    instructions: roster?.instructions ?? null,
    rollCallTime: roster?.rollCallTime ?? "19:00",
    platoon: roster?.platoon ?? "NIGHT",
    rows,
    counts,
  };
}
