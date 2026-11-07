import "server-only";
import fs from "node:fs/promises";
import path from "node:path";

const API_BASE = "https://thesimpsonsapi.com/api";
// The CDN rejects bare portrait paths; it needs a size segment (200, 500 or 1280).
const CDN_BASE = "https://cdn.thesimpsonsapi.com/500";
const FETCH_CONCURRENCY = 6;

export type Character = {
  id: number;
  name: string;
  occupation: string | null;
  status: string | null;
  imageUrl: string | null;
};

type ApiCharacter = {
  id: number;
  name: string;
  occupation?: string | null;
  status?: string | null;
  portrait_path?: string | null;
};

type ApiPage = { count: number; pages: number; results: ApiCharacter[] };

type CacheFile = { fetchedAt: number; characters: Character[] };

type CacheState = {
  data: CacheFile | null;
  inflight: Promise<CacheFile> | null;
};

const globalForCache = globalThis as unknown as { __simpsonsCache?: CacheState };
const state: CacheState = (globalForCache.__simpsonsCache ??= { data: null, inflight: null });

function cachePath() {
  return path.resolve(/*turbopackIgnore: true*/ process.env.CHARACTER_CACHE_PATH || "./data/characters-cache.json");
}

function ttlMs() {
  const hours = Number(process.env.CHARACTER_CACHE_TTL_HOURS);
  return (Number.isFinite(hours) && hours > 0 ? hours : 24) * 60 * 60 * 1000;
}

function toCharacter(c: ApiCharacter): Character {
  return {
    id: c.id,
    name: c.name,
    occupation: c.occupation || null,
    status: c.status || null,
    imageUrl: c.portrait_path ? `${CDN_BASE}${c.portrait_path}` : null,
  };
}

async function fetchPage(page: number): Promise<ApiPage> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(`${API_BASE}/characters?page=${page}`, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return (await res.json()) as ApiPage;
    } catch (err) {
      lastError = err;
      await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
    }
  }
  throw new Error(`Failed to fetch characters page ${page}: ${String(lastError)}`);
}

async function fetchAllCharacters(): Promise<CacheFile> {
  const first = await fetchPage(1);
  const pages = Array.from({ length: Math.max(0, first.pages - 1) }, (_, i) => i + 2);
  const results: ApiCharacter[][] = [first.results];

  for (let i = 0; i < pages.length; i += FETCH_CONCURRENCY) {
    const batch = await Promise.all(pages.slice(i, i + FETCH_CONCURRENCY).map(fetchPage));
    results.push(...batch.map((p) => p.results));
  }

  const byId = new Map<number, Character>();
  for (const c of results.flat()) byId.set(c.id, toCharacter(c));
  const characters = [...byId.values()].sort((a, b) => a.id - b.id);
  return { fetchedAt: Date.now(), characters };
}

async function readCacheFile(): Promise<CacheFile | null> {
  try {
    const parsed = JSON.parse(await fs.readFile(/*turbopackIgnore: true*/ cachePath(), "utf8")) as CacheFile;
    return Array.isArray(parsed.characters) && parsed.characters.length > 0 ? parsed : null;
  } catch {
    return null;
  }
}

async function writeCacheFile(data: CacheFile) {
  const file = cachePath();
  await fs.mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(data));
  await fs.rename(tmp, file);
}

function refresh(): Promise<CacheFile> {
  state.inflight ??= fetchAllCharacters()
    .then(async (data) => {
      state.data = data;
      await writeCacheFile(data).catch((err) => console.error("[simpsons] cache write failed", err));
      console.log(`[simpsons] cached ${data.characters.length} characters`);
      return data;
    })
    .finally(() => {
      state.inflight = null;
    });
  return state.inflight;
}

/**
 * Full character list from memory, then the JSON file cache, then the API.
 * Stale data is served immediately while a background refresh runs.
 */
export async function getAllCharacters(): Promise<Character[]> {
  if (!state.data) state.data = await readCacheFile();
  if (!state.data) return (await refresh()).characters;

  if (Date.now() - state.data.fetchedAt > ttlMs()) {
    refresh().catch((err) => console.error("[simpsons] background refresh failed", err));
  }
  return state.data.characters;
}

export async function getCharacterMap(): Promise<Map<number, Character>> {
  return new Map((await getAllCharacters()).map((c) => [c.id, c]));
}
