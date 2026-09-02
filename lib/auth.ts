import { NextAuthOptions } from "next-auth";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import GoogleProvider from "next-auth/providers/google";
import AppleProvider from "next-auth/providers/apple";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { generateAppleClientSecret } from "@/lib/appleClientSecret";

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
