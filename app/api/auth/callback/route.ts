import { NextRequest, NextResponse } from "next/server";
import { consumeOAuthState, oauthClient, saveSession } from "@/lib/session";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const expected = await consumeOAuthState();
  if (!code || !state || !expected || state !== expected) {
    return NextResponse.redirect(new URL("/?error=oauth_state", request.url));
  }
  try {
    const client = oauthClient();
    const { tokens } = await client.getToken(code);
    if (!tokens.access_token) throw new Error("Google did not return an access token.");
    await saveSession({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token || "",
      expiry_date: tokens.expiry_date || Date.now() + 3500000,
    });
    return NextResponse.redirect(new URL("/", request.url));
  } catch {
    return NextResponse.redirect(new URL("/?error=oauth_failed", request.url));
  }
}
