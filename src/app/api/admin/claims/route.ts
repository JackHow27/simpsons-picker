import { NextResponse } from "next/server";
import { ClaimError, assignCharacter, listClaimsForAdmin } from "@/lib/claims";
import { checkMutation, jsonError, readJson, requireAdmin } from "@/lib/http";

export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;
  return NextResponse.json(await listClaimsForAdmin());
}

export async function POST(request: Request) {
  const rejected = checkMutation(request);
  if (rejected) return rejected;
  const { error } = await requireAdmin();
  if (error) return error;

  const body = await readJson<{ userId: number; characterId: number }>(request);
  const userId = Number(body?.userId);
  const characterId = Number(body?.characterId);
  if (!Number.isInteger(userId) || !Number.isInteger(characterId)) {
    return jsonError(400, "userId and characterId are required.");
  }

  try {
    const claim = await assignCharacter(userId, characterId);
    return NextResponse.json({ claim }, { status: 201 });
  } catch (err) {
    if (err instanceof ClaimError) return jsonError(err.status, err.message);
    throw err;
  }
}
