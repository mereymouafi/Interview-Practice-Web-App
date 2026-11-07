import { NextResponse } from "next/server";
import { authenticatedGoogleEmail, isAdminEmail, readSession } from "@/lib/session";

export const runtime = "nodejs";

export async function GET() {
  const session = await readSession();
  if (!session?.refresh_token) return NextResponse.json({ user: null });
  try {
    const email = await authenticatedGoogleEmail();
    return NextResponse.json({ user: email ? { email } : null, isAdmin: isAdminEmail(email) });
  } catch {
    return NextResponse.json({ user: null, isAdmin: false });
  }
}
