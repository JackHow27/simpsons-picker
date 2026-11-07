import { NextResponse } from "next/server";
import { ClaimError, claimCharacter, getUserClaim } from "@/lib/claims";
import { checkMutation, jsonError, readJson, requireUser } from "@/lib/http";

export async function GET() {
  const { user, error } = await requireUser();
  if (error) return error;
  return NextResponse.json({ claim: await getUserClaim(user.id) });
}

export async function POST(request: Request) {
  const rejected = checkMutation(request);
  if (rejected) return rejected;
  const { user, error } = await requireUser();
  if (error) return error;

  const body = await readJson<{ characterId: number }>(request);
  const characterId = Number(body?.characterId);
  if (!Number.isInteger(characterId) || characterId <= 0) return jsonError(400, "Invalid character.");

  try {
    const claim = await claimCharacter(user.id, characterId);
    return NextResponse.json({ claim }, { status: 201 });
  } catch (err) {
    if (err instanceof ClaimError) return jsonError(err.status, err.message);
    throw err;
  }
}
