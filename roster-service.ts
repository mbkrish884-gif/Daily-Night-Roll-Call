import { prisma } from "./db";
import { writeAudit } from "./audit";
import type { ParsedEntry } from "./roster-parse";

export interface ApplyRosterInput {
  date: string; // YYYY-MM-DD
  platoon?: string;
  rollCallTime?: string;
  vehicleNo?: string;
  instructions?: string;
  replace?: boolean; // if true, clears existing entries for that day first
  entries: ParsedEntry[];
  actorId?: string | null;
  actorLabel: string;
}

export interface ApplyRosterResult {
  rosterId: string;
  created: number;
  skippedDuplicates: number;
}

/**
 * Idempotently builds a day's roster. Each entry upserts the PC master record,
 * attaches it to the day, and seeds a PENDING attendance record. Re-importing
 * the same day merges by default, or fully replaces when `replace` is true.
 */
export async function applyRoster(input: ApplyRosterInput): Promise<ApplyRosterResult> {
  const {
    date,
    platoon = "NIGHT",
    rollCallTime = "19:00",
    vehicleNo,
    instructions,
    replace = false,
    entries,
    actorId = null,
    actorLabel,
  } = input;

  return prisma.$transaction(async (tx) => {
    const roster = await tx.dailyRoster.upsert({
      where: { date },
      create: { date, platoon, rollCallTime, vehicleNo, instructions },
      update: {
        platoon,
        rollCallTime,
        ...(vehicleNo !== undefined ? { vehicleNo } : {}),
        ...(instructions !== undefined ? { instructions } : {}),
      },
    });

    if (replace) {
      // Attendance rows cascade-delete with their entries.
      await tx.dailyRosterEntry.deleteMany({ where: { rosterId: roster.id } });
    }

    let created = 0;
    let skippedDuplicates = 0;
    let sl = 1;

    for (const e of entries) {
      const pc = await tx.pc.upsert({
        where: { pcNumber: e.pcNumber },
        create: {
          pcNumber: e.pcNumber,
          rank: e.rank || "PC",
          name: e.name ?? null,
          unit: e.unit ?? null,
          mobile: e.mobile ?? null,
        },
        update: {
          rank: e.rank || undefined,
          ...(e.name ? { name: e.name } : {}),
          ...(e.unit ? { unit: e.unit } : {}),
          ...(e.mobile ? { mobile: e.mobile } : {}),
        },
      });

      const existing = await tx.dailyRosterEntry.findUnique({
        where: { rosterId_pcId: { rosterId: roster.id, pcId: pc.id } },
      });
      if (existing) {
        skippedDuplicates++;
        sl++;
        continue;
      }

      const entry = await tx.dailyRosterEntry.create({
        data: {
          rosterId: roster.id,
          pcId: pc.id,
          slNo: e.slNo ?? sl,
          dutyRemarks: e.dutyRemarks ?? null,
        },
      });

      await tx.attendanceRecord.create({
        data: {
          date,
          entryId: entry.id,
          pcId: pc.id,
          status: "PENDING",
          dutyRemarks: e.dutyRemarks ?? null,
        },
      });

      created++;
      sl++;
    }

    await writeAudit(
      {
        actorId,
        actorLabel,
        action: replace ? "RESET_ROSTER" : "IMPORT_ROSTER",
        entity: "roster",
        entityId: roster.id,
        meta: { date, created, skippedDuplicates, total: entries.length },
      },
      tx
    );

    return { rosterId: roster.id, created, skippedDuplicates };
  });
}
