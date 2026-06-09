import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import type { Role } from "./config";

export const SESSION_COOKIE = "nrc_session";
const ALG = "HS256";
const MAX_AGE_SECONDS = 60 * 60 * 12; // 12 hours

function secret(): Uint8Array {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 16) {
    throw new Error("AUTH_SECRET is missing or too short (set a 32+ char value in .env)");
  }
  return new TextEncoder().encode(s);
}

export interface SessionUser {
  sub: string; // user id
  username: string;
  name: string;
  role: Role;
}

export async function signSession(user: SessionUser): Promise<string> {
  return new SignJWT({ username: user.username, name: user.name, role: user.role })
    .setProtectedHeader({ alg: ALG })
    .setSubject(user.sub)
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_SECONDS}s`)
    .sign(secret());
}

export async function verifySession(token: string): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, secret(), { algorithms: [ALG] });
    const p = payload as JWTPayload & { username: string; name: string; role: Role };
    if (!p.sub || !p.username) return null;
    return { sub: p.sub, username: p.username, name: p.name, role: p.role };
  } catch {
    return null;
  }
}

/** Reads and verifies the session from the request cookie. Server-only. */
export async function getSession(): Promise<SessionUser | null> {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySession(token);
}

/** For server components / actions: redirect to /login if not authenticated. */
export async function requireAdmin(): Promise<SessionUser> {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  };
}
