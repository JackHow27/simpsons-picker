import "server-only";
import { eq, or } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { getAllCharacters, getCharacter, getCharacterMap, type Character } from "./simpsons";

export type ClaimInfo = { userId: number; displayName: string; claimedAt: number };
export type CharacterWithClaim = Character & { claim: ClaimInfo | null };

function claimIndex(): Map<number, ClaimInfo> {
  const rows = getDb()
    .select({
      characterId: schema.claims.characterId,
      userId: schema.claims.userId,
      claimedAt: schema.claims.claimedAt,
      displayName: schema.users.displayName,
    })
    .from(schema.claims)
    .innerJoin(schema.users, eq(schema.claims.userId, schema.users.id))
    .all();
  return new Map(
    rows.map((r) => [
      r.characterId,
      { userId: r.userId, displayName: r.displayName, claimedAt: r.claimedAt.getTime() },
    ]),
  );
}

export function withClaims(characters: Character[]): CharacterWithClaim[] {
  const index = claimIndex();
  return characters.map((c) => ({ ...c, claim: index.get(c.id) ?? null }));
}

export async function searchCharacters(query: string, limit: number, offset: number) {
  const all = await getAllCharacters();
  const q = query.trim().toLowerCase();
  const matches = q ? all.filter((c) => c.name.toLowerCase().includes(q)) : all;
  return {
    total: matches.length,
    results: withClaims(matches.slice(offset, offset + limit)),
  };
}

export async function carouselWindow(start: number, size: number) {
  const all = await getAllCharacters();
  const total = all.length;
  if (total === 0) return { total, start: 0, results: [] };
  const from = ((start % total) + total) % total;
  const items = Array.from({ length: Math.min(size, total) }, (_, i) => all[(from + i) % total]);
  return { total, start: from, results: withClaims(items) };
}

export async function getUserClaim(userId: number): Promise<CharacterWithClaim | null> {
  const row = getDb().select().from(schema.claims).where(eq(schema.claims.userId, userId)).get();
  if (!row) return null;
  const character = (await getCharacterMap()).get(row.characterId) ?? {
    id: row.characterId,
    name: `Character #${row.characterId}`,
    age: null,
    birthdate: null,
    gender: null,
    occupation: null,
    status: null,
    phrases: [],
    imageUrl: null,
  };
  return withClaims([character])[0];
}

export async function getCharacterWithClaim(id: number): Promise<CharacterWithClaim | null> {
  const character = await getCharacter(id);
  return character ? withClaims([character])[0] : null;
}

export class ClaimError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

function isUniqueViolation(err: unknown) {
  return (err as { code?: string })?.code?.startsWith("SQLITE_CONSTRAINT") ?? false;
}

/** A user claims an available character. Users hold at most one and cannot switch. */
export async function claimCharacter(userId: number, characterId: number) {
  const character = (await getCharacterMap()).get(characterId);
  if (!character) throw new ClaimError(404, "Character not found.");

  const db = getDb();
  const existingMine = db.select().from(schema.claims).where(eq(schema.claims.userId, userId)).get();
  if (existingMine) {
    throw new ClaimError(409, "You already have a character. Only an admin can release it.");
  }
  const taken = db.select().from(schema.claims).where(eq(schema.claims.characterId, characterId)).get();
  if (taken) throw new ClaimError(409, "That character is already taken.");

  try {
    db.insert(schema.claims).values({ characterId, userId, claimedAt: new Date() }).run();
  } catch (err) {
    if (isUniqueViolation(err)) throw new ClaimError(409, "That character was just taken, or you already have one.");
    throw err;
  }
  return withClaims([character])[0];
}

/** Admin override: give a character to a user, replacing any claim held by either side. */
export async function assignCharacter(userId: number, characterId: number) {
  const character = (await getCharacterMap()).get(characterId);
  if (!character) throw new ClaimError(404, "Character not found.");

  const db = getDb();
  const user = db.select().from(schema.users).where(eq(schema.users.id, userId)).get();
  if (!user) throw new ClaimError(404, "User not found.");

  db.transaction((tx) => {
    tx.delete(schema.claims)
      .where(or(eq(schema.claims.userId, userId), eq(schema.claims.characterId, characterId)))
      .run();
    tx.insert(schema.claims).values({ characterId, userId, claimedAt: new Date() }).run();
  });
  return withClaims([character])[0];
}

export function releaseClaim(characterId: number): boolean {
  const result = getDb().delete(schema.claims).where(eq(schema.claims.characterId, characterId)).run();
  return result.changes > 0;
}

export async function listClaimsForAdmin() {
  const db = getDb();
  const characters = await getCharacterMap();
  const users = db.select().from(schema.users).orderBy(schema.users.id).all();
  const claims = db.select().from(schema.claims).all();
  const claimByUser = new Map(claims.map((c) => [c.userId, c]));
  const userById = new Map(users.map((u) => [u.id, u]));

  return {
    claims: claims
      .map((c) => {
        const user = userById.get(c.userId)!;
        const character = characters.get(c.characterId);
        return {
          characterId: c.characterId,
          characterName: character?.name ?? `Character #${c.characterId}`,
          imageUrl: character?.imageUrl ?? null,
          userId: c.userId,
          displayName: user.displayName,
          email: user.email,
          claimedAt: c.claimedAt.getTime(),
        };
      })
      .sort((a, b) => b.claimedAt - a.claimedAt),
    users: users.map((u) => {
      const claim = claimByUser.get(u.id);
      return {
        id: u.id,
        email: u.email,
        displayName: u.displayName,
        role: u.role,
        characterId: claim?.characterId ?? null,
        characterName: claim ? (characters.get(claim.characterId)?.name ?? null) : null,
      };
    }),
  };
}
