import crypto from "node:crypto";
import { cookies } from "next/headers";
import { google } from "googleapis";

const COOKIE_NAME = "ip_google_session";
const STATE_COOKIE = "ip_oauth_state";
const SESSION_SECRET = process.env.SESSION_SECRET || "";

export type GoogleSession = {
  access_token: string;
  refresh_token: string;
  expiry_date: number;
};

function key() {
  if (!SESSION_SECRET || SESSION_SECRET.length < 32) {
    throw new Error("SESSION_SECRET must be set to a random value of at least 32 characters.");
  }
  return crypto.createHash("sha256").update(SESSION_SECRET).digest();
}

function encrypt(value: object) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key(), iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString("base64url");
}

function decrypt<T>(value: string): T {
  const data = Buffer.from(value, "base64url");
  const iv = data.subarray(0, 12);
  const tag = data.subarray(12, 28);
  const encrypted = data.subarray(28);
  const decipher = crypto.createDecipheriv("aes-256-gcm", key(), iv);
  decipher.setAuthTag(tag);
  const plain = Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
  return JSON.parse(plain) as T;
}

const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
};

export async function saveSession(session: GoogleSession) {
  const jar = await cookies();
  jar.set(COOKIE_NAME, encrypt(session), { ...cookieOptions, maxAge: 60 * 60 * 24 * 30 });
}

export async function readSession(): Promise<GoogleSession | null> {
  const jar = await cookies();
  const value = jar.get(COOKIE_NAME)?.value;
  if (!value) return null;
  try { return decrypt<GoogleSession>(value); } catch { return null; }
}

export async function clearSession() {
  const jar = await cookies();
  jar.set(COOKIE_NAME, "", { ...cookieOptions, maxAge: 0 });
}

export async function saveOAuthState(state: string) {
  const jar = await cookies();
  jar.set(STATE_COOKIE, state, { ...cookieOptions, maxAge: 10 * 60 });
}

export async function consumeOAuthState() {
  const jar = await cookies();
  const value = jar.get(STATE_COOKIE)?.value || "";
  jar.set(STATE_COOKIE, "", { ...cookieOptions, maxAge: 0 });
  return value;
}

export function oauthClient() {
  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI } = process.env;
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_REDIRECT_URI) {
    throw new Error("Google OAuth environment variables are missing.");
  }
  return new google.auth.OAuth2(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI);
}

export async function driveClient() {
  const session = await readSession();
  if (!session?.refresh_token) return null;
  const auth = oauthClient();
  auth.setCredentials(session);
  if (!session.expiry_date || session.expiry_date < Date.now() + 120_000) {
    const refreshed = await auth.refreshAccessToken();
    const credentials = refreshed.credentials;
    await saveSession({
      access_token: credentials.access_token || session.access_token,
      refresh_token: credentials.refresh_token || session.refresh_token,
      expiry_date: credentials.expiry_date || Date.now() + 3_500_000,
    });
    auth.setCredentials({ ...credentials, refresh_token: credentials.refresh_token || session.refresh_token });
  }
  return auth;
}

export async function authenticatedGoogleEmail() {
  const auth = await driveClient();
  if (!auth) return null;
  const oauth2 = google.oauth2({ version: "v2", auth });
  const result = await oauth2.userinfo.get();
  return result.data.email?.trim().toLowerCase() || null;
}

export function isAdminEmail(email: string | null) {
  if (!email) return false;
  const admins = (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  return admins.includes(email);
}
