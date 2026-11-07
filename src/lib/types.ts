export type ClientUser = {
  id: number;
  email: string;
  displayName: string;
  role: "user" | "admin";
};

export type ClientCharacter = {
  id: number;
  name: string;
  occupation: string | null;
  status: string | null;
  imageUrl: string | null;
  claim: { userId: number; displayName: string; claimedAt: number } | null;
};

export async function postJson<T>(url: string, body?: unknown, method = "POST"): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: body === undefined ? undefined : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error || `Request failed (${res.status})`);
  return data as T;
}
