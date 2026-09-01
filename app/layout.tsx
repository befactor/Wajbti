import "./globals.css";
import { Providers } from "./providers";

export const metadata = {
  title: "وجبتي — Wajbti",
  description: "AI nutrition assistant for Arabic cuisine",
  icons: {
    icon: "/logo-icon.png",
    apple: "/logo-icon.png",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          href="https://fonts.googleapis.com/css2?family=El+Messiri:wght@500;600;700&family=Cairo:wght@400;500;600;700&family=Tajawal:wght@400;500;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <div
          id="__debug_banner"
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            zIndex: 999999,
            background: "#ffeb3b",
            color: "#000",
            fontSize: "11px",
            padding: "6px",
            fontFamily: "monospace",
            whiteSpace: "pre-wrap",
            wordBreak: "break-all",
          }}
        >
          DEBUG BUILD LOADED
        </div>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                function log(msg) {
                  var el = document.getElementById('__debug_banner');
                  if (el) el.innerText += '\\n' + msg;
                }
                log('UA: ' + navigator.userAgent);
                log('URL: ' + window.location.href);
                window.onerror = function(msg, src, line, col, err) {
                  log('ERROR: ' + msg + ' @ ' + src + ':' + line);
                };
                window.addEventListener('unhandledrejection', function(e) {
                  log('PROMISE REJECTION: ' + e.reason);
                });
              })();
            `,
          }}
        />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
