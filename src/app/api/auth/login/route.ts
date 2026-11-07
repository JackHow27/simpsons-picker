import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { createSession, toPublicUser } from "@/lib/auth";
import { checkMutation, jsonError, readJson } from "@/lib/http";
import { verifyPassword } from "@/lib/password";

export async function POST(request: Request) {
  const rejected = checkMutation(request);
  if (rejected) return rejected;

  const body = await readJson<{ email: string; password: string }>(request);
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body?.password === "string" ? body.password : "";

  const user = email ? getDb().select().from(schema.users).where(eq(schema.users.email, email)).get() : undefined;
  if (!user || !verifyPassword(password, user.passwordHash)) {
    return jsonError(401, "Incorrect email or password.");
  }

  await createSession(user.id);
  return NextResponse.json({ user: toPublicUser(user) });
}
