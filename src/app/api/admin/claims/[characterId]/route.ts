import { NextResponse } from "next/server";
import { releaseClaim } from "@/lib/claims";
import { checkMutation, jsonError, requireAdmin } from "@/lib/http";

export async function DELETE(request: Request, { params }: { params: Promise<{ characterId: string }> }) {
  const rejected = checkMutation(request);
  if (rejected) return rejected;
  const { error } = await requireAdmin();
  if (error) return error;

  const characterId = Number.parseInt((await params).characterId, 10);
  if (!Number.isInteger(characterId)) return jsonError(400, "Invalid character.");
  if (!releaseClaim(characterId)) return jsonError(404, "That character is not claimed.");
  return NextResponse.json({ ok: true });
}
