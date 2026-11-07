"use client";

import Link from "next/link";
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

type NewUser = { email: string; displayName: string; password: string; role: "user" | "admin" };

export default function AdminPanel({ currentUserId }: { currentUserId: number }) {
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

  async function createUser(input: NewUser) {
    setBusy(true);
    setMessage(null);
    try {
      await postJson("/api/admin/users", input);
      setMessage({ kind: "success", text: `Created ${input.displayName.trim()}.` });
      return true;
    } catch (err) {
      setMessage({ kind: "error", text: (err as Error).message });
      return false;
    } finally {
      setBusy(false);
      load();
    }
  }

  async function toggleRole(user: AdminUser) {
    const role = user.role === "admin" ? "user" : "admin";
    if (role === "user" && !window.confirm(`Make ${user.displayName} a regular user?`)) return;
    setBusy(true);
    setMessage(null);
    try {
      await postJson(`/api/admin/users/${user.id}`, { role }, "PATCH");
      setMessage({
        kind: "success",
        text: role === "admin" ? `${user.displayName} is now an admin.` : `${user.displayName} is now a regular user.`,
      });
    } catch (err) {
      setMessage({ kind: "error", text: (err as Error).message });
    } finally {
      setBusy(false);
      load();
    }
  }

  async function removeUser(user: AdminUser) {
    const claimNote = user.characterName ? ` Their claim on ${user.characterName} will be released.` : "";
    if (!window.confirm(`Remove ${user.displayName}?${claimNote}`)) return;
    setBusy(true);
    setMessage(null);
    try {
      await postJson(`/api/admin/users/${user.id}`, undefined, "DELETE");
      setMessage({
        kind: "success",
        text: user.characterName
          ? `Removed ${user.displayName}. ${user.characterName} is available again.`
          : `Removed ${user.displayName}.`,
      });
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
      <p className="muted">
        Create and remove users, change who is an admin, release any claim, or assign a character. Assigning overrides
        existing claims on either side. Removing a user releases their claim.
      </p>
      {message && (
        <p className={`alert alert-${message.kind}`} role="status">
          {message.text}
        </p>
      )}
      {!data ? (
        <p className="muted">Loading…</p>
      ) : (
        <>
          <CreateUserForm busy={busy} onCreate={createUser} />
          <AssignForm users={data.users} busy={busy} onAssign={assign} />

          <section className="card">
            <h2>Claims ({data.claims.length})</h2>
            {data.claims.length === 0 ? (
              <p className="muted">No characters have been claimed yet.</p>
            ) : (
              <div className="table-wrap">
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
                        <Link href={`/characters/${c.characterId}`}>{c.characterName}</Link>
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
              </div>
            )}
          </section>

          <section className="card">
            <h2>Users ({data.users.length})</h2>
            <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Character</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {data.users.map((u) => {
                  const lastAdmin = u.role === "admin" && data.users.filter((x) => x.role === "admin").length <= 1;
                  const isSelf = u.id === currentUserId;
                  return (
                    <tr key={u.id} data-testid={`user-row-${u.id}`}>
                      <td>{u.displayName}</td>
                      <td className="muted">{u.email}</td>
                      <td>{u.role === "admin" ? <span className="badge badge-mine">admin</span> : "user"}</td>
                      <td>
                        {u.characterId ? (
                          <Link href={`/characters/${u.characterId}`}>{u.characterName}</Link>
                        ) : (
                          <span className="muted">none</span>
                        )}
                      </td>
                      <td className="row-actions">
                        <button
                          className="btn btn-ghost btn-sm"
                          disabled={busy || lastAdmin}
                          title={lastAdmin ? "Can't demote the last admin." : undefined}
                          onClick={() => toggleRole(u)}
                        >
                          {u.role === "admin" ? "Make user" : "Make admin"}
                        </button>
                        <button
                          className="btn btn-danger btn-sm"
                          disabled={busy || isSelf || lastAdmin}
                          title={
                            isSelf ? "You can't remove your own account." : lastAdmin ? "Can't remove the last admin." : undefined
                          }
                          onClick={() => removeUser(u)}
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function CreateUserForm({ busy, onCreate }: { busy: boolean; onCreate: (input: NewUser) => Promise<boolean> }) {
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"user" | "admin">("user");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const ok = await onCreate({ email, displayName, password, role });
    if (ok) {
      setDisplayName("");
      setEmail("");
      setPassword("");
      setRole("user");
    }
  }

  return (
    <section className="card">
      <h2>Add a user</h2>
      <form className="create-user-form" onSubmit={submit} data-testid="create-user">
        <label>
          Display name
          <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} required maxLength={40} />
        </label>
        <label>
          Email
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required aria-label="New user email" />
        </label>
        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            aria-label="New user password"
          />
        </label>
        <label>
          Role
          <select value={role} onChange={(e) => setRole(e.target.value as "user" | "admin")} aria-label="New user role">
            <option value="user">user</option>
            <option value="admin">admin</option>
          </select>
        </label>
        <button className="btn btn-primary" disabled={busy}>
          Create
        </button>
      </form>
    </section>
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
