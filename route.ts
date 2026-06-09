import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { loginSchema } from "@/lib/validation";
import { verifyPassword } from "@/lib/password";
import { signSession, SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import type { Role } from "@/lib/config";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request." }, { status: 400 });
  }
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Enter username and password." }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { username: parsed.data.username } });
  const valid = user && user.active && (await verifyPassword(parsed.data.password, user.passwordHash));
  if (!user || !valid) {
    return NextResponse.json({ ok: false, error: "Invalid username or password." }, { status: 401 });
  }

  const token = await signSession({
    sub: user.id,
    username: user.username,
    name: user.name,
    role: user.role as Role,
  });
  cookies().set(SESSION_COOKIE, token, sessionCookieOptions());

  await writeAudit({
    actorId: user.id,
    actorLabel: `admin:${user.username}`,
    action: "LOGIN",
    entity: "user",
    entityId: user.id,
  });

  return NextResponse.json({ ok: true });
}
