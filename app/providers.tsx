"use client";

import { SessionProvider } from "next-auth/react";
import AiConsentGate from "./components/AiConsentGate";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <AiConsentGate>{children}</AiConsentGate>
    </SessionProvider>
  );
}
