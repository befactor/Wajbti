"use client";

import { useEffect, useRef, useState } from "react";
import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import { dict, Lang } from "@/lib/i18n";
import TabsBar from "@/app/components/TabsBar";
import { localDateStr } from "@/lib/date";

type WaterSettings = {
  dailyGoalMl: number;
  remindersEnabled: boolean;
  reminderCount: number;
  startHour: number;
  endHour: number;
};

type WaterLog = { id: string; amountMl: number };

export default function WaterPage() {
  const [lang, setLang] = useState<Lang>("ar");
  const t = dict[lang];
  const tw = t.water;
  const { data: session, status } = useSession();

  const [hasProfile, setHasProfile] = useState<boolean | null>(null);
  const [settings, setSettings] = useState<WaterSettings | null>(null);
  const [logs, setLogs] = useState<WaterLog[]>([]);
  const [totalMl, setTotalMl] = useState(0);
  const [loading, setLoading] = useState(false);
  const [notifPermission, setNotifPermission] = useState<NotificationPermission | "unsupported">(
    "default"
  );
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  function loadData() {
    setLoading(true);
    Promise.all([
      fetch("/api/profile").then((r) => r.json()),
      fetch(`/api/water?date=${localDateStr()}`).then((r) => r.json()),
    ])
      .then(([profileData, waterData]) => {
        setHasProfile(!!profileData.profile);
        setSettings(waterData.settings);
        setLogs(waterData.logs || []);
        setTotalMl(waterData.totalMl || 0);
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    if (status !== "authenticated") return;
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      setNotifPermission("unsupported");
      return;
    }
    setNotifPermission(Notification.permission);
  }, []);

  // Best-effort in-tab reminders: schedules timeouts for the remaining
  // reminder slots today, spaced evenly between startHour-endHour. Only
  // fires while this page stays open (real background push needs the
  // Capacitor-wrapped app, per the project roadmap).
  useEffect(() => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];

    if (
      !settings?.remindersEnabled ||
      notifPermission !== "granted" ||
      !settings.reminderCount ||
      settings.startHour >= settings.endHour
    ) {
      return;
    }

    const now = new Date();
    const spanMs = (settings.endHour - settings.startHour) * 3600 * 1000;
    const stepMs = spanMs / Math.max(settings.reminderCount - 1, 1);
    const dayStart = new Date(now);
    dayStart.setHours(settings.startHour, 0, 0, 0);

    for (let i = 0; i < settings.reminderCount; i++) {
      const fireAt = new Date(dayStart.getTime() + stepMs * i);
      const delay = fireAt.getTime() - now.getTime();
      if (delay > 0) {
        const timer = setTimeout(() => {
          new Notification(tw.title, {
            body: lang === "ar" ? "وقت شرب المية 💧" : "Time to drink water 💧",
          });
        }, delay);
        timersRef.current.push(timer);
      }
    }

    return () => timersRef.current.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings, notifPermission]);

  async function requestNotifications() {
    if (!("Notification" in window)) return;
    const perm = await Notification.requestPermission();
    setNotifPermission(perm);
  }

  async function addWater(amountMl: number) {
    setTotalMl((prev) => prev + amountMl);
    const res = await fetch("/api/water", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amountMl }),
    });
    const data = await res.json();
    if (data.log) setLogs((prev) => [...prev, data.log]);
  }

  async function undoLast() {
    const last = logs[logs.length - 1];
    if (!last) return;
    setLogs((prev) => prev.slice(0, -1));
    setTotalMl((prev) => prev - last.amountMl);
    await fetch(`/api/water/${last.id}`, { method: "DELETE" }).catch(() => {});
  }

  async function saveSettings(e: React.FormEvent) {
    e.preventDefault();
    if (!settings) return;
    const res = await fetch("/api/water/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    });
    const data = await res.json();
    if (data.settings) setSettings(data.settings);
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
          <p style={{ marginBottom: 14 }}>{tw.title}</p>
          <Link href="/auth/signin" className="analyze-cta" style={{ display: "block" }}>
            {t.auth.signInCta}
          </Link>
        </div>
        <TabsBar lang={lang} />
      </div>
    );
  }

  const goal = settings?.dailyGoalMl || 2000;
  const pct = Math.min(1, totalMl / goal);
  const remaining = Math.max(0, goal - totalMl);
  const cupsTotal = 8;
  const cupsFilled = Math.round(pct * cupsTotal);

  return (
    <div dir={t.dir} className="container">
      <div className="top-nav">
        <span>{session?.user?.name || session?.user?.email}</span>
        <button onClick={() => signOut({ callbackUrl: "/" })}>{t.auth.signOut}</button>
      </div>
      <button className="lang-toggle" onClick={() => setLang(lang === "ar" ? "en" : "ar")}>
        {lang === "ar" ? "English" : "العربية"}
      </button>

      <div className="brand">
        <div className="brand-mark" />
        <h1 className="title">{tw.title}</h1>
      </div>

      {hasProfile === false && (
        <div className="tip-card">
          <p style={{ marginBottom: 10 }}>{tw.noProfile}</p>
          <Link href="/profile" className="analyze-cta" style={{ display: "block", textAlign: "center" }}>
            {tw.completeProfile}
          </Link>
        </div>
      )}

      <div className="water-progress">
        <div className="water-bar-outer">
          <div className="water-bar-inner" style={{ width: `${pct * 100}%` }} />
        </div>
        <p className="water-summary">
          {(totalMl / 1000).toFixed(2)} / {(goal / 1000).toFixed(2)} {tw.liters}
        </p>
        {pct >= 1 ? (
          <p className="water-goal-reached">{tw.goalReached}</p>
        ) : (
          <p className="water-remaining">
            {tw.remaining}: {remaining} {tw.ml}
          </p>
        )}
        <div className="water-cups">
          {Array.from({ length: cupsTotal }).map((_, i) => (
            <span key={i} className={i < cupsFilled ? "cup filled" : "cup"}>
              🥤
            </span>
          ))}
        </div>
      </div>

      <div className="feedback-row">
        <button onClick={() => addWater(250)}>+ {tw.addGlass}</button>
        <button onClick={() => addWater(500)}>+ {tw.addBottle}</button>
      </div>
      {logs.length > 0 && (
        <button className="analyze-cta" onClick={undoLast} style={{ background: "var(--card)", color: "var(--tanoor)", border: "1px solid var(--line)" }}>
          {tw.undo}
        </button>
      )}

      {notifPermission !== "granted" && notifPermission !== "unsupported" && (
        <div className="tip-card">
          <p style={{ marginBottom: 10 }}>{tw.notifPermissionNote}</p>
          <button className="analyze-cta" onClick={requestNotifications}>
            {tw.enableNotifications}
          </button>
        </div>
      )}

      {settings && (
        <form className="form-card" onSubmit={saveSettings}>
          <h3 style={{ fontFamily: "El Messiri", fontSize: 15, marginBottom: 14 }}>{tw.settingsTitle}</h3>

          <div className="form-field">
            <label>
              <input
                type="checkbox"
                checked={settings.remindersEnabled}
                onChange={(e) => setSettings({ ...settings, remindersEnabled: e.target.checked })}
                style={{ width: "auto", display: "inline-block", marginInlineEnd: 8 }}
              />
              {tw.remindersEnabled}
            </label>
          </div>

          <div className="form-field">
            <label>{tw.reminderCount}</label>
            <input
              type="number"
              min={1}
              max={12}
              value={settings.reminderCount}
              onChange={(e) => setSettings({ ...settings, reminderCount: Number(e.target.value) })}
            />
          </div>

          <div className="form-field">
            <label>{tw.startHour}</label>
            <input
              type="number"
              min={0}
              max={23}
              value={settings.startHour}
              onChange={(e) => setSettings({ ...settings, startHour: Number(e.target.value) })}
            />
          </div>

          <div className="form-field">
            <label>{tw.endHour}</label>
            <input
              type="number"
              min={0}
              max={23}
              value={settings.endHour}
              onChange={(e) => setSettings({ ...settings, endHour: Number(e.target.value) })}
            />
          </div>

          <button className="analyze-cta" type="submit">
            {tw.saveSettings}
          </button>
        </form>
      )}

      <TabsBar lang={lang} />
    </div>
  );
}
