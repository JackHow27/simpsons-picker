// End-to-end API smoke test against a running server.
// Usage: BASE_URL=http://localhost:3000 node scripts/smoke-test.mjs
// Reads ADMIN_EMAIL / ADMIN_PASSWORD from the environment or .env.local.
import fs from "node:fs";

const BASE = process.env.BASE_URL || "http://localhost:3000";

function loadEnvFile(file) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2];
  }
}
loadEnvFile(".env.local");

let failures = 0;
function check(label, ok, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? `  (${detail})` : ""}`);
  if (!ok) failures++;
}

function client() {
  let cookie = "";
  return async function call(method, path, body) {
    const res = await fetch(BASE + path, {
      method,
      headers: {
        ...(body !== undefined && { "content-type": "application/json" }),
        ...(cookie && { cookie }),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      redirect: "manual",
    });
    const set = res.headers.getSetCookie?.() ?? [];
    for (const c of set) {
      const [pair] = c.split(";");
      if (pair.startsWith("sp_session=")) cookie = pair.endsWith("=") ? "" : pair;
    }
    const text = await res.text();
    let json = null;
    try {
      json = JSON.parse(text);
    } catch {}
    return { status: res.status, json, text };
  };
}

const run = Date.now().toString(36);
const alice = client();
const bob = client();
const admin = client();

let r = await alice("POST", "/api/auth/register", { email: `alice-${run}@test.dev`, password: "password-a1", displayName: `Alice ${run}` });
check("register alice", r.status === 201, r.status);
r = await bob("POST", "/api/auth/register", { email: `bob-${run}@test.dev`, password: "password-b1", displayName: `Bob ${run}` });
check("register bob", r.status === 201, r.status);
r = await bob("POST", "/api/auth/register", { email: `bob-${run}@test.dev`, password: "password-b1", displayName: "Dup" });
check("duplicate email rejected", r.status === 409, r.status);

r = await bob("POST", "/api/auth/logout", {});
check("bob logout", r.status === 200);
r = await bob("GET", "/api/auth/me");
check("bob logged out", r.json?.user === null);
r = await bob("POST", "/api/auth/login", { email: `bob-${run}@test.dev`, password: "wrong-password" });
check("wrong password rejected", r.status === 401, r.status);
r = await bob("POST", "/api/auth/login", { email: `bob-${run}@test.dev`, password: "password-b1" });
check("bob login", r.status === 200 && r.json?.user?.role === "user", r.status);

r = await alice("GET", "/api/characters?q=homer");
check("search 'homer'", r.status === 200 && r.json.results.some((c) => c.name === "Homer Simpson"), `${r.json?.total} matches`);
r = await alice("GET", "/api/characters?q=");
check("full list cached", r.json?.total > 1000, `${r.json?.total} characters`);
r = await alice("GET", "/api/characters/carousel?start=0&size=5");
check("carousel window", r.json?.results?.length === 5 && r.json.results[0].id === 1);
r = await alice("GET", "/api/characters/carousel?start=-1&size=3");
check("carousel wraps", r.json?.results?.length === 3 && r.json.start === r.json.total - 1, `start=${r.json?.start}`);

// Pick two characters nobody holds yet so the test is repeatable.
const all = (await alice("GET", "/api/characters?limit=200")).json.results.filter((c) => !c.claim);
const [c1, c2] = all;

r = await alice("POST", "/api/claims", { characterId: c1.id });
check(`alice claims ${c1.name}`, r.status === 201, r.status);
r = await alice("POST", "/api/claims", { characterId: c2.id });
check("alice cannot claim a second character", r.status === 409, r.json?.error);
r = await bob("POST", "/api/claims", { characterId: c1.id });
check("bob cannot claim alice's character", r.status === 409, r.json?.error);
r = await bob("GET", `/api/characters?q=${encodeURIComponent(c1.name)}`);
const seen = r.json.results.find((c) => c.id === c1.id);
check("taken display shows alice", seen?.claim?.displayName === `Alice ${run}`, `Taken by ${seen?.claim?.displayName}`);
r = await bob("POST", "/api/claims", { characterId: c2.id });
check(`bob claims ${c2.name}`, r.status === 201, r.status);

r = await alice("DELETE", `/api/admin/claims/${c1.id}`);
check("normal user cannot release", r.status === 403, r.status);
r = await alice("POST", "/api/admin/claims", { userId: 1, characterId: c2.id });
check("normal user cannot assign", r.status === 403, r.status);
r = await alice("GET", "/api/admin/claims");
check("normal user cannot list admin claims", r.status === 403, r.status);

r = await admin("POST", "/api/auth/login", { email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD });
check("admin login (seeded)", r.status === 200 && r.json?.user?.role === "admin", r.status);
r = await admin("GET", "/api/admin/claims");
const aliceUser = r.json?.users?.find((u) => u.email === `alice-${run}@test.dev`);
const bobUser = r.json?.users?.find((u) => u.email === `bob-${run}@test.dev`);
check("admin lists claims", r.status === 200 && r.json.claims.some((c) => c.characterId === c1.id));

r = await admin("POST", "/api/admin/claims", { userId: aliceUser.id, characterId: c2.id });
check(`admin assigns ${c2.name} (bob's) to alice`, r.status === 201, r.status);
r = await bob("GET", "/api/claims");
check("bob lost his claim", r.json?.claim === null);
r = await alice("GET", "/api/claims");
check("alice now holds c2, c1 freed", r.json?.claim?.id === c2.id);
r = await bob("GET", `/api/characters/carousel?start=${c1.id - 1}&size=1`);
check("c1 available again", r.json?.results?.[0]?.id === c1.id && r.json.results[0].claim === null);

r = await admin("DELETE", `/api/admin/claims/${c2.id}`);
check("admin releases alice's claim", r.status === 200, r.status);
r = await alice("GET", "/api/claims");
check("alice has no claim after release", r.json?.claim === null);
r = await admin("DELETE", `/api/admin/claims/${c2.id}`);
check("release unclaimed -> 404", r.status === 404, r.status);

r = await bob("POST", "/api/claims", { characterId: c2.id });
check("bob can claim again after release", r.status === 201, r.status);
await admin("DELETE", `/api/admin/claims/${c2.id}`);

r = await fetch(BASE + "/api/claims", {
  method: "POST",
  headers: { "content-type": "application/json", origin: "https://evil.example" },
  body: JSON.stringify({ characterId: 1 }),
});
check("cross-origin POST rejected", r.status === 403, r.status);

console.log(failures ? `\n${failures} check(s) failed` : "\nAll checks passed");
process.exit(failures ? 1 : 0);
