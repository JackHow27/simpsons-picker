import "server-only";
import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { eq } from "drizzle-orm";
import * as schema from "./schema";
import { hashPassword } from "@/lib/password";

type Db = BetterSQLite3Database<typeof schema>;

const globalForDb = globalThis as unknown as { __simpsonsDb?: Db };

const DDL = `
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON sessions(user_id);
CREATE TABLE IF NOT EXISTS claims (
  character_id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  claimed_at INTEGER NOT NULL
);
`;

function seedAdmin(db: Db) {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) {
    console.warn("[db] ADMIN_EMAIL / ADMIN_PASSWORD not set; no admin seeded.");
    return;
  }
  const existing = db.select().from(schema.users).where(eq(schema.users.email, email)).get();
  if (!existing) {
    db.insert(schema.users)
      .values({
        email,
        displayName: process.env.ADMIN_DISPLAY_NAME?.trim() || "Admin",
        passwordHash: hashPassword(password),
        role: "admin",
        createdAt: new Date(),
      })
      .run();
    console.log(`[db] Seeded admin ${email}`);
  } else if (existing.role !== "admin") {
    db.update(schema.users).set({ role: "admin" }).where(eq(schema.users.id, existing.id)).run();
    console.log(`[db] Promoted ${email} to admin`);
  }
}

export function getDb(): Db {
  if (globalForDb.__simpsonsDb) return globalForDb.__simpsonsDb;

  const file = path.resolve(/*turbopackIgnore: true*/ process.env.DATABASE_PATH || "./data/app.db");
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const sqlite = new Database(file);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  sqlite.pragma("busy_timeout = 5000");
  sqlite.exec(DDL);

  const db = drizzle(sqlite, { schema });
  seedAdmin(db);
  globalForDb.__simpsonsDb = db;
  return db;
}

export { schema };
