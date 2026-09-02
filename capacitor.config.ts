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
    // Without this, Capacitor's WebView refuses to navigate to any domain
    // other than the app's own origin and kicks the navigation out to the
    // system browser instead - which is exactly what happens mid-OAuth-flow
    // when Google/Apple sign-in redirects to their own login pages.
    allowNavigation: ['accounts.google.com', 'appleid.apple.com'],
  },
};

export default config;
