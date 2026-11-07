import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { and, eq, gt, lt } from "drizzle-orm";
import { getDb, schema } from "@/db";
import type { User } from "@/db/schema";

export const SESSION_COOKIE = "sp_session";
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export type PublicUser = Pick<User, "id" | "email" | "displayName" | "role">;

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function toPublicUser(user: User): PublicUser {
  return { id: user.id, email: user.email, displayName: user.displayName, role: user.role };
}

export async function createSession(userId: number) {
  const db = getDb();
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  db.delete(schema.sessions).where(lt(schema.sessions.expiresAt, new Date())).run();
  db.insert(schema.sessions).values({ id: hashToken(token), userId, expiresAt }).run();

  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) {
    getDb().delete(schema.sessions).where(eq(schema.sessions.id, hashToken(token))).run();
  }
  store.delete(SESSION_COOKIE);
}

export async function getCurrentUser(): Promise<PublicUser | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const row = getDb()
    .select({ user: schema.users })
    .from(schema.sessions)
    .innerJoin(schema.users, eq(schema.sessions.userId, schema.users.id))
    .where(and(eq(schema.sessions.id, hashToken(token)), gt(schema.sessions.expiresAt, new Date())))
    .get();
  return row ? toPublicUser(row.user) : null;
}
