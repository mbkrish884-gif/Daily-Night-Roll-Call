import { prisma } from "./db";

export interface AuditInput {
  actorId?: string | null;
  actorLabel: string;
  action: string;
  entity: string;
  entityId?: string | null;
  attendanceId?: string | null;
  field?: string | null;
  oldValue?: string | null;
  newValue?: string | null;
  meta?: unknown;
}

// Prisma transaction client type is structurally compatible with prisma for these calls.
type Db = typeof prisma | Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

export async function writeAudit(input: AuditInput, db: Db = prisma) {
  return db.auditLog.create({
    data: {
      actorId: input.actorId ?? null,
      actorLabel: input.actorLabel,
      action: input.action,
      entity: input.entity,
      entityId: input.entityId ?? null,
      attendanceId: input.attendanceId ?? null,
      field: input.field ?? null,
      oldValue: input.oldValue ?? null,
      newValue: input.newValue ?? null,
      meta: input.meta == null ? null : JSON.stringify(input.meta),
    },
  });
}
