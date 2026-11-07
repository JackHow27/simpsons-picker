import { NextResponse, type NextRequest } from "next/server";
import { searchCharacters } from "@/lib/claims";
import { jsonError } from "@/lib/http";

function intParam(value: string | null, fallback: number, min: number, max: number) {
  const n = Number.parseInt(value ?? "", 10);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const q = (params.get("q") ?? "").slice(0, 100);
  const limit = intParam(params.get("limit"), 48, 1, 200);
  const offset = intParam(params.get("offset"), 0, 0, 100_000);
  try {
    return NextResponse.json(await searchCharacters(q, limit, offset));
  } catch (err) {
    console.error(err);
    return jsonError(502, "Could not load characters from The Simpsons API.");
  }
}
