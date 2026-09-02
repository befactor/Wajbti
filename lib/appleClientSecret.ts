import crypto from "crypto";

// Apple Sign-In doesn't use a static client secret like Google - instead
// NextAuth needs a JWT signed with the private key (.p8) downloaded from
// Apple Developer, valid for at most 6 months. Generated fresh from env
// vars on each cold start (cheap, synchronous, no extra dependency needed -
// Node's crypto module signs ES256/P-1363 JWTs directly).
export function generateAppleClientSecret(): string | null {
  const teamId = process.env.APPLE_TEAM_ID;
  const keyId = process.env.APPLE_KEY_ID;
  const clientId = process.env.APPLE_CLIENT_ID;
  // Vercel env vars store literal "\n" for newlines in multi-line values.
  const privateKey = process.env.APPLE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!teamId || !keyId || !clientId || !privateKey) return null;

  const base64url = (input: Buffer | string) =>
    Buffer.from(input).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

  const header = base64url(JSON.stringify({ alg: "ES256", kid: keyId }));
  const now = Math.floor(Date.now() / 1000);
  const payload = base64url(
    JSON.stringify({
      iss: teamId,
      iat: now,
      // Apple's hard cap is 6 months (15777000s) - stay comfortably under it.
      exp: now + 60 * 60 * 24 * 150,
      aud: "https://appleid.apple.com",
      sub: clientId,
    })
  );

  const signature = crypto
    .sign("sha256", Buffer.from(`${header}.${payload}`), {
      key: privateKey,
      dsaEncoding: "ieee-p1363",
    })
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  return `${header}.${payload}.${signature}`;
}
