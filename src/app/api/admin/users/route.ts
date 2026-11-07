import { NextResponse } from "next/server";
import { UserAdminError, createManagedUser } from "@/lib/admin-users";
import { checkMutation, jsonError, readJson, requireAdmin } from "@/lib/http";

export async function POST(request: Request) {
  const rejected = checkMutation(request);
  if (rejected) return rejected;
  const { error } = await requireAdmin();
  if (error) return error;

  const body = await readJson<{ email: string; displayName: string; password: string; role: "user" | "admin" }>(request);
  const role = body?.role === "admin" || body?.role === "user" ? body.role : null;
  if (!role || typeof body?.email !== "string" || typeof body.displayName !== "string" || typeof body.password !== "string") {
    return jsonError(400, "Email, display name, password, and role are required.");
  }

  try {
    const user = createManagedUser({ email: body.email, displayName: body.displayName, password: body.password, role });
    return NextResponse.json({ user }, { status: 201 });
  } catch (err) {
    if (err instanceof UserAdminError) return jsonError(err.status, err.message);
    throw err;
  }
}
