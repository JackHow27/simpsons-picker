import { NextResponse } from "next/server";
import { UserAdminError, deleteManagedUser, setUserRole } from "@/lib/admin-users";
import { checkMutation, jsonError, readJson, requireAdmin } from "@/lib/http";

function parseId(raw: string) {
  const id = Number.parseInt(raw, 10);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const rejected = checkMutation(request);
  if (rejected) return rejected;
  const { error } = await requireAdmin();
  if (error) return error;

  const id = parseId((await params).id);
  if (!id) return jsonError(400, "Invalid user.");

  const body = await readJson<{ role: "user" | "admin" }>(request);
  if (body?.role !== "user" && body?.role !== "admin") return jsonError(400, "Role must be user or admin.");

  try {
    return NextResponse.json({ user: setUserRole(id, body.role) });
  } catch (err) {
    if (err instanceof UserAdminError) return jsonError(err.status, err.message);
    throw err;
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const rejected = checkMutation(request);
  if (rejected) return rejected;
  const { user, error } = await requireAdmin();
  if (error) return error;

  const id = parseId((await params).id);
  if (!id) return jsonError(400, "Invalid user.");

  try {
    return NextResponse.json(deleteManagedUser(user.id, id));
  } catch (err) {
    if (err instanceof UserAdminError) return jsonError(err.status, err.message);
    throw err;
  }
}
