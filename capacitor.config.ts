import type { CapacitorConfig } from '@capacitor/cli';

// Wajbti is a server-rendered Next.js app (NextAuth sessions, API routes,
// a Postgres database) - it can't be shipped as static files bundled into
// the native app the way most Capacitor apps are. Instead the native
// WebView loads the live production deployment directly over HTTPS.
// `webDir` still has to point at *something* that exists for `cap sync`
// to run, even though its contents are never actually used - see
// mobile-shell/index.html.
const config: CapacitorConfig = {
  appId: 'com.wajbti.app',
  appName: 'Wajbti',
  webDir: 'mobile-shell',
  server: {
    url: 'https://wajbti-kohl.vercel.app',
    cleartext: false,
  },
};

export default config;
