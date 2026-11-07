import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { createSession, toPublicUser } from "@/lib/auth";
import { checkMutation, jsonError, readJson } from "@/lib/http";
import { hashPassword } from "@/lib/password";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  const rejected = checkMutation(request);
  if (rejected) return rejected;

  const body = await readJson<{ email: string; password: string; displayName: string }>(request);
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body?.password === "string" ? body.password : "";
  const displayName = typeof body?.displayName === "string" ? body.displayName.trim() : "";

  if (!EMAIL_RE.test(email) || email.length > 254) return jsonError(400, "Enter a valid email address.");
  if (password.length < 8 || password.length > 200) return jsonError(400, "Password must be at least 8 characters.");
  if (displayName.length < 1 || displayName.length > 40) return jsonError(400, "Display name must be 1-40 characters.");

  const db = getDb();
  if (db.select().from(schema.users).where(eq(schema.users.email, email)).get()) {
    return jsonError(409, "An account with that email already exists.");
  }

  const user = db
    .insert(schema.users)
    .values({ email, displayName, passwordHash: hashPassword(password), role: "user", createdAt: new Date() })
    .returning()
    .get();

  await createSession(user.id);
  return NextResponse.json({ user: toPublicUser(user) }, { status: 201 });
}
