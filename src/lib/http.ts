import "server-only";
import { NextResponse } from "next/server";
import { getCurrentUser, type PublicUser } from "./auth";

export function jsonError(status: number, error: string) {
  return NextResponse.json({ error }, { status });
}

/**
 * Mutating endpoints only accept same-origin JSON requests. Together with the
 * SameSite=Lax session cookie this blocks cross-site form posts (CSRF).
 */
export function checkMutation(request: Request): NextResponse | null {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (origin && host && new URL(origin).host !== host) {
    return jsonError(403, "Cross-origin request rejected.");
  }
  if (request.method !== "DELETE" && !request.headers.get("content-type")?.includes("application/json")) {
    return jsonError(415, "Expected application/json.");
  }
  return null;
}

export async function readJson<T>(request: Request): Promise<Partial<T> | null> {
  try {
    const body = await request.json();
    return body && typeof body === "object" ? body : null;
  } catch {
    return null;
  }
}

type Guard = { user: PublicUser; error?: never } | { user?: never; error: NextResponse };

export async function requireUser(): Promise<Guard> {
  const user = await getCurrentUser();
  if (!user) return { error: jsonError(401, "Please log in first.") };
  return { user };
}

export async function requireAdmin(): Promise<Guard> {
  const result = await requireUser();
  if (result.error) return result;
  if (result.user.role !== "admin") return { error: jsonError(403, "Admins only.") };
  return result;
}
