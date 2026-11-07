import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getUserClaim } from "@/lib/claims";

export async function GET() {
  const user = await getCurrentUser();
  const claim = user ? await getUserClaim(user.id) : null;
  return NextResponse.json({ user, claim });
}
