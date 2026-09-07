import { NextAuthOptions } from "next-auth";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import GoogleProvider from "next-auth/providers/google";
import AppleProvider from "next-auth/providers/apple";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { jwtVerify, createRemoteJWKSet } from "jose";
import { prisma } from "@/lib/prisma";
import { generateAppleClientSecret } from "@/lib/appleClientSecret";

const APPLE_JWKS = createRemoteJWKSet(new URL("https://appleid.apple.com/auth/keys"));

const providers: NextAuthOptions["providers"] = [
  CredentialsProvider({
    name: "Email",
    credentials: {
      email: { label: "Email", type: "email" },
      password: { label: "Password", type: "password" },
    },
    async authorize(credentials) {
      if (!credentials?.email || !credentials?.password) return null;

      const user = await prisma.user.findUnique({
        where: { email: credentials.email },
      });
      if (!user || !user.passwordHash) return null;

      const valid = await bcrypt.compare(credentials.password, user.passwordHash);
      if (!valid) return null;

      return { id: user.id, name: user.name, email: user.email, image: user.image };
    },
  }),
];

// Google Sign-In: only registered once real OAuth credentials exist, so the
// app keeps working (build + dev) before the user sets them up.
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  providers.push(
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      // Google verifies email ownership itself, so it's safe to link a
      // Google sign-in to an existing account with the same email instead
      // of NextAuth's default of blocking it (OAuthAccountNotLinked) -
      // otherwise users who registered with email/password first can never
      // use "Sign in with Google" afterward.
      allowDangerousEmailAccountLinking: true,
    })
  );
}

// Apple Sign-In: only registered once the Services ID, Team ID, Key ID, and
// private key (see lib/appleClientSecret.ts) are all in place.
const appleClientSecret = generateAppleClientSecret();
if (process.env.APPLE_CLIENT_ID && appleClientSecret) {
  providers.push(
    AppleProvider({
      clientId: process.env.APPLE_CLIENT_ID,
      clientSecret: appleClientSecret,
      // Same reasoning as Google - see comment above.
      allowDangerousEmailAccountLinking: true,
    })
  );
}

// Apple Sign-In, native path: App Review found that the web OAuth flow above
// fails when driven inside the app's embedded WKWebView (Apple's identity
// servers reject completing sign-in in an untrusted embedded browser
// context). On native, AppleSignInPlugin.swift instead uses Apple's own
// AuthenticationServices framework directly (no webview, no redirect) and
// hands back a signed identityToken, which this provider verifies against
// Apple's public keys instead of going through an OAuth code exchange.
if (process.env.APPLE_CLIENT_ID) {
  providers.push(
    CredentialsProvider({
      id: "apple-native",
      name: "Apple",
      credentials: {
        identityToken: { label: "Identity Token", type: "text" },
      },
      async authorize(credentials) {
        if (!credentials?.identityToken) return null;
        try {
          const { payload } = await jwtVerify(credentials.identityToken, APPLE_JWKS, {
            issuer: "https://appleid.apple.com",
            // The Services ID is the audience for the web OAuth flow; the
            // app's bundle ID is the audience Apple uses for the native
            // AuthenticationServices flow - both are valid depending on
            // which path issued the token.
            audience: [process.env.APPLE_CLIENT_ID as string, "com.wajbti.app"],
          });
          const email = typeof payload.email === "string" ? payload.email : null;
          if (!email) return null;

          // Same trust model as Google/Apple web sign-in above: the identity
          // provider has already verified email ownership, so it's safe to
          // link to (or create) an account by email.
          let user = await prisma.user.findUnique({ where: { email } });
          if (!user) {
            user = await prisma.user.create({ data: { email } });
          }
          return { id: user.id, name: user.name, email: user.email, image: user.image };
        } catch (err) {
          console.error("Apple native sign-in verification failed:", err);
          return null;
        }
      },
    })
  );
}

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  // Credentials provider requires JWT sessions in NextAuth v4 (database
  // sessions aren't supported for it), so the whole app uses JWT sessions.
  session: { strategy: "jwt" },
  providers,
  pages: {
    signIn: "/auth/signin",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) token.uid = user.id;
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.uid) {
        (session.user as { id?: string }).id = token.uid as string;
      }
      return session;
    },
  },
};
