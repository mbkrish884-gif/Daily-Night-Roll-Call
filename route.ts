import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { todayKey } from "@/lib/date";
import { pcNumberSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("pc") ?? "";
  const parsed = pcNumberSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Enter a valid PC number." }, { status: 400 });
  }
  const date = todayKey();
  const entry = await prisma.dailyRosterEntry.findFirst({
    where: { roster: { date }, pc: { pcNumber: parsed.data } },
    include: { pc: true, attendance: true, roster: true },
  });

  if (!entry) {
    return NextResponse.json(
      { ok: false, error: "This PC number is not on tonight's roster." },
      { status: 404 }
    );
  }

  return NextResponse.json({
    ok: true,
    date,
    rollCallTime: entry.roster.rollCallTime,
    platoon: entry.roster.platoon,
    pc: {
      pcNumber: entry.pc.pcNumber,
      rank: entry.pc.rank,
      name: entry.pc.name,
      unit: entry.pc.unit,
    },
    status: entry.attendance?.status ?? "PENDING",
    presentAt: entry.attendance?.presentAt ?? null,
    dutyRemarks: entry.attendance?.dutyRemarks ?? entry.dutyRemarks ?? null,
  });
}
