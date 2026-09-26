import { signOut } from "next-auth/react";

// NextAuth's own post-sign-out redirect is an absolute URL built from the
// server's NEXTAUTH_URL, which can be a different domain from the one the
// app is actually running on. Inside the iOS app, navigating to any domain
// outside capacitor.config.ts's allowNavigation list gets kicked out to
// Safari - so sign out without NextAuth's redirect and reload relatively.
export async function signOutInPlace() {
  await signOut({ redirect: false });
  window.location.replace("/");
}
