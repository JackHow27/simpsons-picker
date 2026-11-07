"use client";

import { useCallback, useEffect, useState } from "react";
import { postJson, type ClientCharacter } from "@/lib/types";

type AdminClaim = {
  characterId: number;
  characterName: string;
  imageUrl: string | null;
  userId: number;
  displayName: string;
  email: string;
  claimedAt: number;
};

type AdminUser = {
  id: number;
  email: string;
  displayName: string;
  role: "user" | "admin";
  characterId: number | null;
  characterName: string | null;
};

export default function AdminPanel() {
  const [data, setData] = useState<{ claims: AdminClaim[]; users: AdminUser[] } | null>(null);
  const [message, setMessage] = useState<{ kind: "error" | "success"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/claims");
    const body = await res.json();
    if (!res.ok) setMessage({ kind: "error", text: body.error });
    else setData(body);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function release(claim: AdminClaim) {
    if (!window.confirm(`Release ${claim.characterName} from ${claim.displayName}?`)) return;
    setBusy(true);
    try {
      await postJson(`/api/admin/claims/${claim.characterId}`, undefined, "DELETE");
      setMessage({ kind: "success", text: `Released ${claim.characterName}.` });
    } catch (err) {
      setMessage({ kind: "error", text: (err as Error).message });
    } finally {
      setBusy(false);
      load();
    }
  }

  async function assign(user: AdminUser, character: ClientCharacter) {
    setBusy(true);
    try {
      await postJson("/api/admin/claims", { userId: user.id, characterId: character.id });
      setMessage({ kind: "success", text: `Assigned ${character.name} to ${user.displayName}.` });
    } catch (err) {
      setMessage({ kind: "error", text: (err as Error).message });
    } finally {
      setBusy(false);
      load();
    }
  }

  return (
    <div className="admin">
      <h1>Admin</h1>
      <p className="muted">Release any claim, or assign a character to a user. Assigning overrides existing claims on either side.</p>
      {message && (
        <p className={`alert alert-${message.kind}`} role="status">
          {message.text}
        </p>
      )}
      {!data ? (
        <p className="muted">Loading…</p>
      ) : (
        <>
          <AssignForm users={data.users} busy={busy} onAssign={assign} />

          <section className="card">
            <h2>Claims ({data.claims.length})</h2>
            {data.claims.length === 0 ? (
              <p className="muted">No characters have been claimed yet.</p>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>Character</th>
                    <th>Claimed by</th>
                    <th>When</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {data.claims.map((c) => (
                    <tr key={c.characterId} data-testid={`claim-row-${c.characterId}`}>
                      <td className="cell-character">
                        {c.imageUrl && (
                          <img src={c.imageUrl} alt="" />
                        )}
                        {c.characterName}
                      </td>
                      <td>
                        {c.displayName} <span className="muted small">{c.email}</span>
                      </td>
                      <td className="muted small">{new Date(c.claimedAt).toLocaleString()}</td>
                      <td>
                        <button className="btn btn-danger btn-sm" disabled={busy} onClick={() => release(c)}>
                          Release
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          <section className="card">
            <h2>Users ({data.users.length})</h2>
            <table className="table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Character</th>
                </tr>
              </thead>
              <tbody>
                {data.users.map((u) => (
                  <tr key={u.id}>
                    <td>{u.displayName}</td>
                    <td className="muted">{u.email}</td>
                    <td>{u.role === "admin" ? <span className="badge badge-mine">admin</span> : "user"}</td>
                    <td>{u.characterName ?? <span className="muted">none</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </>
      )}
    </div>
  );
}

function AssignForm({
  users,
  busy,
  onAssign,
}: {
  users: AdminUser[];
  busy: boolean;
  onAssign: (user: AdminUser, character: ClientCharacter) => void;
}) {
  const [userId, setUserId] = useState<string>("");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ClientCharacter[]>([]);
  const [picked, setPicked] = useState<ClientCharacter | null>(null);

  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setResults([]);
      return;
    }
    const t = setTimeout(async () => {
      const res = await fetch(`/api/characters?q=${encodeURIComponent(q)}&limit=8`);
      if (res.ok) setResults((await res.json()).results);
    }, 200);
    return () => clearTimeout(t);
  }, [query]);

  const user = users.find((u) => String(u.id) === userId) ?? null;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !picked) return;
    const warnings = [
      user.characterName && `${user.displayName} currently has ${user.characterName}; that claim will be removed.`,
      picked.claim && picked.claim.userId !== user.id && `${picked.name} is taken by ${picked.claim.displayName}; they will lose it.`,
    ].filter(Boolean);
    if (warnings.length && !window.confirm(`${warnings.join("\n")}\n\nContinue?`)) return;
    onAssign(user, picked);
    setPicked(null);
    setQuery("");
  }

  return (
    <section className="card">
      <h2>Assign a character</h2>
      <form className="assign-form" onSubmit={submit}>
        <label>
          User
          <select value={userId} onChange={(e) => setUserId(e.target.value)} required aria-label="User">
            <option value="">Choose a user…</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.displayName} ({u.email}){u.characterName ? ` · has ${u.characterName}` : ""}
              </option>
            ))}
          </select>
        </label>
        <label className="assign-search">
          Character
          <input
            value={picked ? picked.name : query}
            onChange={(e) => {
              setPicked(null);
              setQuery(e.target.value);
            }}
            placeholder="Search by name…"
            aria-label="Character"
          />
          {!picked && results.length > 0 && (
            <ul className="suggestions" role="listbox">
              {results.map((c) => (
                <li key={c.id}>
                  <button type="button" onClick={() => setPicked(c)}>
                    {c.name}
                    <span className="muted small">{c.claim ? ` · taken by ${c.claim.displayName}` : " · available"}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </label>
        <button className="btn btn-primary" disabled={busy || !user || !picked}>
          Assign
        </button>
      </form>
    </section>
  );
}
