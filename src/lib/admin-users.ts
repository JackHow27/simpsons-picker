import "server-only";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { hashPassword } from "@/lib/password";
import { toPublicUser, type PublicUser } from "@/lib/auth";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export class UserAdminError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

function adminCount() {
  return getDb().select().from(schema.users).where(eq(schema.users.role, "admin")).all().length;
}

export function createManagedUser(input: {
  email: string;
  displayName: string;
  password: string;
  role: "user" | "admin";
}): PublicUser {
  const email = input.email.trim().toLowerCase();
  const displayName = input.displayName.trim();
  const { password, role } = input;

  if (!EMAIL_RE.test(email) || email.length > 254) throw new UserAdminError(400, "Enter a valid email address.");
  if (password.length < 8 || password.length > 200) throw new UserAdminError(400, "Password must be at least 8 characters.");
  if (displayName.length < 1 || displayName.length > 40) {
    throw new UserAdminError(400, "Display name must be 1-40 characters.");
  }
  if (role !== "user" && role !== "admin") throw new UserAdminError(400, "Role must be user or admin.");

  const db = getDb();
  if (db.select().from(schema.users).where(eq(schema.users.email, email)).get()) {
    throw new UserAdminError(409, "An account with that email already exists.");
  }

  const user = db
    .insert(schema.users)
    .values({ email, displayName, passwordHash: hashPassword(password), role, createdAt: new Date() })
    .returning()
    .get();
  return toPublicUser(user);
}

/** Deletes the user, which cascades to their session and releases their claim. */
export function deleteManagedUser(actorId: number, targetId: number) {
  const db = getDb();
  const target = db.select().from(schema.users).where(eq(schema.users.id, targetId)).get();
  if (!target) throw new UserAdminError(404, "User not found.");
  if (target.role === "admin" && adminCount() <= 1) {
    throw new UserAdminError(409, "You can't delete the last admin.");
  }
  if (target.id === actorId) throw new UserAdminError(409, "You can't delete your own account.");

  const claim = db.select().from(schema.claims).where(eq(schema.claims.userId, targetId)).get();
  db.transaction((tx) => {
    tx.delete(schema.claims).where(eq(schema.claims.userId, targetId)).run();
    tx.delete(schema.sessions).where(eq(schema.sessions.userId, targetId)).run();
    tx.delete(schema.users).where(eq(schema.users.id, targetId)).run();
  });
  return { displayName: target.displayName, releasedCharacterId: claim?.characterId ?? null };
}

export function setUserRole(targetId: number, role: "user" | "admin") {
  if (role !== "user" && role !== "admin") throw new UserAdminError(400, "Role must be user or admin.");

  const db = getDb();
  const target = db.select().from(schema.users).where(eq(schema.users.id, targetId)).get();
  if (!target) throw new UserAdminError(404, "User not found.");
  if (target.role === "admin" && role === "user" && adminCount() <= 1) {
    throw new UserAdminError(409, "You can't demote the last admin.");
  }

  db.update(schema.users).set({ role }).where(eq(schema.users.id, targetId)).run();
  return { id: target.id, displayName: target.displayName, role };
}
