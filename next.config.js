/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    // Inlined at build time so the client can decide whether to show the
    // Google/Apple sign-in buttons as active, without exposing the actual
    // secrets (only their presence) to the browser.
    NEXT_PUBLIC_GOOGLE_AUTH_ENABLED: process.env.GOOGLE_CLIENT_ID ? "true" : "false",
    NEXT_PUBLIC_APPLE_AUTH_ENABLED: process.env.APPLE_CLIENT_ID ? "true" : "false",
  },
};
module.exports = nextConfig;
