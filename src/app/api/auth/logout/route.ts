import { NextResponse } from "next/server";
import { destroySession } from "@/lib/auth";
import { checkMutation } from "@/lib/http";

export async function POST(request: Request) {
  const rejected = checkMutation(request);
  if (rejected) return rejected;
  await destroySession();
  return NextResponse.json({ ok: true });
}
