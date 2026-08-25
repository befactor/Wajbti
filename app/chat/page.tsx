"use client";

import { useEffect, useRef, useState } from "react";
import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import { dict, Lang } from "@/lib/i18n";
import TabsBar from "@/app/components/TabsBar";

type ChatMsg = { id: string; role: "user" | "assistant"; content: string };

export default function ChatPage() {
  const [lang, setLang] = useState<Lang>("ar");
  const t = dict[lang];
  const tc = t.chat;
  const { data: session, status } = useSession();

  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (status !== "authenticated") return;
    setLoading(true);
    fetch("/api/chat")
      .then((r) => r.json())
      .then((data) => setMessages(data.messages || []))
      .finally(() => setLoading(false));
  }, [status]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  async function sendMessage() {
    const text = input.trim();
    if (!text || sending) return;
    setInput("");
    setSending(true);
    setMessages((prev) => [...prev, { id: `tmp-${Date.now()}`, role: "user", content: text }]);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });
      const data = await res.json();
      if (data.assistantMessage) {
        setMessages((prev) => [
          ...prev.filter((m) => !m.id.startsWith("tmp-")),
          { id: data.userMessage.id, role: "user", content: data.userMessage.content },
          { id: data.assistantMessage.id, role: "assistant", content: data.assistantMessage.content },
        ]);
      }
    } catch {
      // leave the optimistic user message; user can retry
    } finally {
      setSending(false);
    }
  }

  if (status === "loading" || loading) {
    return (
      <div dir={t.dir} className="container">
        <div className="loading-box">
          <div className="spin" />
        </div>
      </div>
    );
  }

  if (status === "unauthenticated") {
    return (
      <div dir={t.dir} className="container">
        <div className="form-card" style={{ textAlign: "center" }}>
          <p style={{ marginBottom: 14 }}>{tc.title}</p>
          <Link href="/auth/signin" className="analyze-cta" style={{ display: "block" }}>
            {t.auth.signInCta}
          </Link>
        </div>
        <TabsBar lang={lang} />
      </div>
    );
  }

  return (
    <div dir={t.dir} className="container chat-container">
      <div className="top-nav">
        <div className="top-nav-auth">
          <span>{session?.user?.name || session?.user?.email}</span>
          <button onClick={() => signOut({ callbackUrl: "/" })}>{t.auth.signOut}</button>
        </div>
        <button className="lang-toggle-inline" onClick={() => setLang(lang === "ar" ? "en" : "ar")}>
          {lang === "ar" ? "English" : "العربية"}
        </button>
      </div>

      <div className="brand">
        <div className="brand-mark" />
        <h1 className="title">{tc.title}</h1>
      </div>
      <p className="tagline">{tc.subtitle}</p>

      <div className="chat-thread">
        {messages.length === 0 && <div className="chat-bubble assistant">{tc.empty}</div>}
        {messages.map((m) => (
          <div key={m.id} className={`chat-bubble ${m.role}`}>
            {m.content}
          </div>
        ))}
        {sending && <div className="chat-bubble assistant chat-thinking">{tc.thinking}</div>}
        <div ref={bottomRef} />
      </div>

      <p className="chat-disclaimer">{tc.disclaimer}</p>

      <div className="chat-input-row">
        <input
          type="text"
          placeholder={tc.placeholder}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && sendMessage()}
        />
        <button onClick={sendMessage} disabled={sending || !input.trim()}>
          {tc.send}
        </button>
      </div>

      <TabsBar lang={lang} />
    </div>
  );
}
