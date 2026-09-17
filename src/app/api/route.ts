import { NextResponse } from "next/server";

// Required for `CAP_STATIC=1 next build` (output: "export") — the Capacitor
// APK bundle cannot contain dynamic route handlers, so pin this scaffold
// endpoint to static. Nothing in the game client fetches /api; it only exists
// so the standalone preview server stays healthy.
export const dynamic = "force-static";

export async function GET() {
  return NextResponse.json({ message: "Hello, world!" });
}