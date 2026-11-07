"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { LanguageSwitcher, useLanguage } from "@/lib/language";

export default function HomePage() {
  const { t } = useLanguage();
  const [user, setUser] = useState<{ email?: string } | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    fetch("/api/auth/status")
      .then((response) => response.json())
      .then((data) => {
        setUser(data.user || null);
        setIsAdmin(Boolean(data.isAdmin));
      })
      .catch(() => setUser(null));
  }, []);

  return (
    <main className="shell home-shell">
      <header className="topbar">
        <Link className="brand-lockup brand-link" href="/">
          <span className="brand-mark" aria-hidden="true">M</span>
          <span className="brand">MERYY<small>INTERVIEW STUDIO</small></span>
        </Link>
        <div className="account">
          <LanguageSwitcher />
          {user ? (
            <a className="btn small" href="/api/auth/logout">{t("Sign out")}</a>
          ) : (
            <a className="btn small" href="/api/auth/google">{t("Sign in")}</a>
          )}
        </div>
      </header>

      <nav className="main-nav" aria-label={t("Main navigation")}>
        <Link className="active" href="/" aria-current="page">{t("Home")}</Link>
        <Link href="/practice">{t("General Practice")}</Link>
        <Link href="/companies">{t("Company Preparation")}</Link>
        <Link href="/recordings">{t("Recording Library")}</Link>
        {isAdmin && <Link href="/admin">{t("Admin / Question Manager")}</Link>}
      </nav>

      <section className="home-welcome">
        <div className="eyebrow">{t("A quieter kind of preparation")}</div>
        <h1>{t("Make every answer count.")}</h1>
        <p className="sub">{t("A focused space to rehearse, record, and review your interview answers. Your recordings stay in your own Google Drive.")}</p>
        {!user && <a className="btn primary home-signin" href="/api/auth/google">{t("Continue with Google")}</a>}
      </section>

      <section className="home-links" aria-label={t("Your interview studio")}>
        <Link className="home-link-card" href="/practice">
          <span className="home-link-number">01</span>
          <div><h2>{t("General Practice")}</h2><p>{t("Practise interview questions at your own pace.")}</p></div>
          <span className="home-link-arrow" aria-hidden="true">→</span>
        </Link>
        <Link className="home-link-card" href="/companies">
          <span className="home-link-number">02</span>
          <div><h2>{t("Company Preparation")}</h2><p>{t("Prepare for each role in a dedicated workspace.")}</p></div>
          <span className="home-link-arrow" aria-hidden="true">→</span>
        </Link>
        <Link className="home-link-card" href="/recordings">
          <span className="home-link-number">03</span>
          <div><h2>{t("Recording Library")}</h2><p>{t("Listen back to your saved practice answers.")}</p></div>
          <span className="home-link-arrow" aria-hidden="true">→</span>
        </Link>
        {isAdmin && (
          <Link className="home-link-card" href="/admin">
            <span className="home-link-number">04</span>
            <div><h2>{t("Admin / Question Manager")}</h2><p>{t("Manage your general question bank.")}</p></div>
            <span className="home-link-arrow" aria-hidden="true">→</span>
          </Link>
        )}
      </section>
    </main>
  );
}
