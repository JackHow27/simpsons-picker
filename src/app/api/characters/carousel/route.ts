import { NextResponse, type NextRequest } from "next/server";
import { carouselWindow } from "@/lib/claims";
import { jsonError } from "@/lib/http";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const start = Number.parseInt(params.get("start") ?? "0", 10) || 0;
  const size = Math.min(30, Math.max(1, Number.parseInt(params.get("size") ?? "7", 10) || 7));
  try {
    return NextResponse.json(await carouselWindow(start, size));
  } catch (err) {
    console.error(err);
    return jsonError(502, "Could not load characters from The Simpsons API.");
  }
}
