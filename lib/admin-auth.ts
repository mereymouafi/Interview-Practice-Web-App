import { NextResponse } from "next/server";
import { authenticatedGoogleEmail, isAdminEmail } from "@/lib/session";

export async function authorizeAdmin() {
  let email: string | null;
  try {
    email = await authenticatedGoogleEmail();
  } catch (error) {
    console.error("Could not verify Google account for admin access:", error);
    return {
      email: null,
      response: NextResponse.json({ error: "Could not verify your Google account." }, { status: 503 }),
    };
  }
  if (!email) {
    return {
      email: null,
      response: NextResponse.json({ error: "Administrator access is required." }, { status: 403 }),
    };
  }
  if (!isAdminEmail(email)) {
    return {
      email,
      response: NextResponse.json({ error: "Administrator access is required." }, { status: 403 }),
    };
  }
  return { email, response: null };
}
