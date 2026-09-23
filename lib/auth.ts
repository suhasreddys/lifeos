import { cookies } from "next/headers";
import { webcrypto } from "crypto";

const SESSION_COOKIE_NAME = "lifeos_session";
const SECRET_KEY = process.env.AUTH_SECRET || "lifeos-local-secret-key-2026";

export type SessionUser = {
  id: string;
  name: string;
  email: string;
};

// Password hashing using Web Crypto PBKDF2
export async function hashPassword(password: string, saltHex?: string): Promise<{ hash: string; salt: string }> {
  const encoder = new TextEncoder();
  const salt = saltHex
    ? Uint8Array.from(Buffer.from(saltHex, "hex"))
    : webcrypto.getRandomValues(new Uint8Array(16));

  const keyMaterial = await webcrypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveBits", "deriveKey"]
  );

  const derivedKey = await webcrypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt,
      iterations: 100000,
      hash: "SHA-256",
    },
    keyMaterial,
    256
  );

  const hashHex = Buffer.from(derivedKey).toString("hex");
  const saltHexStr = Buffer.from(salt).toString("hex");

  return { hash: hashHex, salt: saltHexStr };
}

export async function verifyPassword(password: string, storedHash: string, storedSalt: string): Promise<boolean> {
  const { hash } = await hashPassword(password, storedSalt);
  return hash === storedHash;
}

// Token creation using Base64URL + HMAC SHA-256 signature
export async function createSessionToken(user: SessionUser): Promise<string> {
  const header = { alg: "HS256", typ: "JWT" };
  const payload = {
    sub: user.id,
    name: user.name,
    email: user.email,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30, // 30 days
  };

  const encodedHeader = Buffer.from(JSON.stringify(header)).toString("base64url");
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const dataToSign = `${encodedHeader}.${encodedPayload}`;

  const encoder = new TextEncoder();
  const secretKey = await webcrypto.subtle.importKey(
    "raw",
    encoder.encode(SECRET_KEY),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await webcrypto.subtle.sign("HMAC", secretKey, encoder.encode(dataToSign));
  const encodedSignature = Buffer.from(signature).toString("base64url");

  return `${dataToSign}.${encodedSignature}`;
}

export async function verifySessionToken(token: string): Promise<SessionUser | null> {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;

    const [encodedHeader, encodedPayload, encodedSignature] = parts;
    const dataToSign = `${encodedHeader}.${encodedPayload}`;

    const encoder = new TextEncoder();
    const secretKey = await webcrypto.subtle.importKey(
      "raw",
      encoder.encode(SECRET_KEY),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    );

    const signature = Buffer.from(encodedSignature, "base64url");
    const isValid = await webcrypto.subtle.verify("HMAC", secretKey, signature, encoder.encode(dataToSign));

    if (!isValid) return null;

    const payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8"));
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      return null; // Expired
    }

    return {
      id: payload.sub,
      name: payload.name,
      email: payload.email,
    };
  } catch {
    return null;
  }
}

export async function getSessionUserFromCookie(): Promise<SessionUser | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    if (!token) return null;
    return await verifySessionToken(token);
  } catch {
    return null;
  }
}

export async function getSessionUserFromRequest(request: Request): Promise<SessionUser | null> {
  try {
    const cookieHeader = request.headers.get("cookie");
    if (!cookieHeader) return null;

    const match = cookieHeader.match(new RegExp(`(?:^|; )${SESSION_COOKIE_NAME}=([^;]*)`));
    if (!match) return null;

    const token = decodeURIComponent(match[1]);
    return await verifySessionToken(token);
  } catch {
    return null;
  }
}

export { SESSION_COOKIE_NAME };
