import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { oauthClient, saveOAuthState } from "@/lib/session";

export const runtime = "nodejs";

export async function GET() {
  const state = crypto.randomBytes(24).toString("hex");
  await saveOAuthState(state);
  const url = oauthClient().generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: ["openid", "email", "profile", "https://www.googleapis.com/auth/drive.file"],
    state,
  });
  return NextResponse.redirect(url);
}
