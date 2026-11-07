"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { LanguageSwitcher, useLanguage } from "@/lib/language";

type Recording = {
  id: string;
  name: string;
  question: string;
  category: string;
  date: string;
  version: number;
  duration?: string;
  companyName?: string;
};

function formatDuration(seconds: number) {
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

export default function RecordingLibraryPage() {
  const { language, t } = useLanguage();
  const [user, setUser] = useState<{ email?: string } | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [loading, setLoading] = useState(true);
  const [playingId, setPlayingId] = useState("");
  const [notice, setNotice] = useState("");

  const loadRecordings = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/recordings", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not load recordings.");
      setRecordings(data.recordings || []);
      setNotice("");
    } catch (error) {
      setNotice(error instanceof Error ? t(error.message) : t("Could not load recordings."));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetch("/api/auth/status")
      .then((response) => response.json())
      .then((data) => {
        setUser(data.user || null);
        setIsAdmin(Boolean(data.isAdmin));
        if (data.user) void loadRecordings();
        else setLoading(false);
      })
      .catch(() => {
        setUser(null);
        setLoading(false);
        setNotice(t("Could not check your Google sign-in status."));
      });
  }, [loadRecordings, t]);

  async function deleteRecording(recording: Recording) {
    if (!window.confirm(t("Delete this saved recording? This cannot be undone."))) return;
    try {
      const response = await fetch(`/api/recordings/${recording.id}`, { method: "DELETE" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not delete recording.");
      setPlayingId("");
      setRecordings((current) => current.filter((item) => item.id !== recording.id));
      setNotice(t("Recording deleted from Google Drive."));
    } catch (error) {
      setNotice(error instanceof Error ? t(error.message) : t("Could not delete recording."));
    }
  }

  return (
    <main className="shell">
      <header className="topbar">
        <Link className="brand-lockup brand-link" href="/">
          <span className="brand-mark" aria-hidden="true">M</span>
          <span className="brand">MERYY<small>INTERVIEW STUDIO</small></span>
        </Link>
        <div className="account">
          <LanguageSwitcher />
          {user && <span className="email">{user.email || t("Google account connected")}</span>}
          {user ? <a className="btn small" href="/api/auth/logout">{t("Sign out")}</a> : <a className="btn small" href="/api/auth/google">{t("Sign in")}</a>}
        </div>
      </header>

      <nav className="main-nav" aria-label={t("Main navigation")}>
        <Link href="/">{t("Home")}</Link>
        <Link href="/practice">{t("General Practice")}</Link>
        <Link href="/companies">{t("Company Preparation")}</Link>
        <Link className="active" href="/recordings" aria-current="page">{t("Recording Library")}</Link>
        {isAdmin && <Link href="/admin">{t("Admin / Question Manager")}</Link>}
      </nav>

      {!user ? (
        <section className="panel library-locked">
          <div className="eyebrow">{t("Your personal archive")}</div>
          <h1>{t("Sign in to continue.")}</h1>
          <p className="sub">{t("Your saved answers, stored privately in Google Drive.")}</p>
          <a className="btn primary" href="/api/auth/google">{t("Continue with Google")}</a>
        </section>
      ) : (
        <>
          <header className="page-heading library-page-heading">
            <div><div className="eyebrow">{t("Your personal archive")}</div><h1>{t("Recording library")}</h1><p>{t("Your saved answers, stored privately in Google Drive.")}</p></div>
            <button className="btn" type="button" onClick={() => void loadRecordings()} disabled={loading}>{loading ? t("Refreshing…") : t("Refresh")}</button>
          </header>
          {notice && <div className="page-notice" role="status">{t(notice)}</div>}
          <section className="recording-library-page" aria-label={t("Recording Library")}>
            {loading ? (
              <div className="empty panel"><strong>{t("Loading your archive")}</strong><span>{t("Your saved takes will appear here.")}</span></div>
            ) : recordings.length === 0 ? (
              <div className="empty panel"><strong>{t("Your library is ready")}</strong><span>{t("Your first saved answer will appear here.")}</span><Link href="/practice">{t("Go to General Practice")} →</Link></div>
            ) : recordings.map((item) => (
              <article className="recording-item" key={item.id}>
                <div className="recording-copy">
                  <div className="recording-meta">{item.companyName && <span>{item.companyName}</span>}<span>{t(item.category)}</span><time dateTime={item.date}>{new Date(`${item.date}T12:00:00`).toLocaleDateString(language === "fr" ? "fr-FR" : "en-US")}</time><span>{t("Version")} {item.version}{item.duration ? ` · ${formatDuration(Number(item.duration))}` : ""}</span></div>
                  <h2>{item.question}</h2>
                  <p>{item.name}</p>
                  {playingId === item.id && <audio controls autoPlay src={`/api/recordings/${item.id}/audio`} />}
                </div>
                <div className="recording-item-actions">
                  <button className="btn small" type="button" onClick={() => setPlayingId(playingId === item.id ? "" : item.id)}>{playingId === item.id ? t("Close player") : t("Play")}</button>
                  <button className="btn small danger-button" type="button" onClick={() => void deleteRecording(item)}>{t("Delete")}</button>
                </div>
              </article>
            ))}
          </section>
        </>
      )}
    </main>
  );
}
