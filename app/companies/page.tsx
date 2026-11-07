"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { LanguageSwitcher, useLanguage } from "@/lib/language";

type Company = {
  id: string;
  name: string;
  website?: string;
  position: string;
  description?: string;
  notes?: string;
  updatedAt: string;
  questionCount: number;
};

const blankCompany = { name: "", website: "", position: "", description: "", notes: "" };

export default function CompaniesPage() {
  const { language, t } = useLanguage();
  const [user, setUser] = useState<{ email?: string } | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<Company | null>(null);
  const [form, setForm] = useState(blankCompany);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");

  const loadCompanies = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/companies");
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || t("Could not load companies."));
      setCompanies(data.companies || []);
    } catch (error) {
      setNotice(error instanceof Error ? t(error.message) : t("Could not load companies."));
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
        if (data.user) void loadCompanies();
      })
      .catch(() => setUser(null))
      .finally(() => setAuthLoading(false));
  }, [loadCompanies]);

  function openCreate() {
    setEditing(null);
    setForm(blankCompany);
    setShowForm(true);
    setNotice("");
  }

  function openEdit(company: Company) {
    setEditing(company);
    setShowForm(true);
    setForm({
      name: company.name,
      website: company.website || "",
      position: company.position || "",
      description: company.description || "",
      notes: company.notes || "",
    });
    setNotice("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function saveCompany(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setNotice("");
    try {
      const response = await fetch(editing ? `/api/companies/${editing.id}` : "/api/companies", {
        method: editing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not save company.");
      setNotice(editing ? t("Company details updated.") : t("Company workspace created."));
      setEditing(null);
      setForm(blankCompany);
      setShowForm(false);
      await loadCompanies();
    } catch (error) {
      setNotice(error instanceof Error ? t(error.message) : t("Could not save company."));
    } finally {
      setSaving(false);
    }
  }

  async function removeCompany(company: Company) {
    if (!window.confirm(t("Delete {name} and its questions from Google Drive?").replace("{name}", company.name))) return;
    setNotice("");
    try {
      const response = await fetch(`/api/companies/${company.id}`, { method: "DELETE" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not delete company.");
      setNotice(t("{name} workspace deleted.").replace("{name}", company.name));
      await loadCompanies();
    } catch (error) {
      setNotice(error instanceof Error ? t(error.message) : t("Could not delete company."));
    }
  }

  if (authLoading) {
    return <main className="shell"><div className="panel loading-panel">{t("Preparing your studio…")}</div></main>;
  }

  if (!user) {
    return (
      <main className="shell">
        <div className="login">
          <div className="panel">
            <div className="login-mark" aria-hidden="true">M</div>
            <LanguageSwitcher />
            <div className="eyebrow">{t("company preparation")}</div>
            <h1>{t("Sign in to continue.")}</h1>
            <p className="sub">{t("Company workspaces are stored privately in your Google Drive.")}</p>
            <a className="btn primary google" href="/api/auth/google">{t("Continue with Google")} <span aria-hidden="true">↗</span></a>
          </div>
        </div>
      </main>
    );
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
          <span className="drive-status"><span className="drive-dot" /> {t("Drive connected")}</span>
          <span className="email">{user.email || t("Google account connected")}</span>
          <a className="btn small" href="/api/auth/logout">{t("Sign out")}</a>
        </div>
      </header>

      <nav className="main-nav" aria-label={t("Main navigation")}>
        <Link href="/">{t("Home")}</Link>
        <Link href="/practice">{t("General Practice")}</Link>
        <span className="active" aria-current="page">{t("Company Preparation")}</span>
        <Link href="/recordings">{t("Recording Library")}</Link>
        {isAdmin && <Link href="/admin">{t("Admin / Question Manager")}</Link>}
      </nav>

      <section className="company-hero">
        <div className="eyebrow">{t("Your next opportunity, thoughtfully prepared")}</div>
        <h1>{t("Company preparation.")}</h1>
        <p className="sub">{t("Build a private workspace for every role. Your research, questions, and prepared answers stay in your Google Drive.")}</p>
      </section>

      {notice && <div className="page-notice" role="status">{t(notice)}</div>}

      {showForm && (
        <section className="panel company-form-panel" aria-labelledby="company-form-title">
          <div className="section-heading">
            <div>
              <div className="eyebrow">{editing ? t("Workspace details") : t("A new opportunity")}</div>
              <h2 id="company-form-title">{editing ? t("Edit company") : t("Add a company")}</h2>
            </div>
            <button type="button" className="btn small" onClick={() => { setShowForm(false); setEditing(null); }}>{t("Close")}</button>
          </div>
          <form onSubmit={saveCompany} className="form-grid">
            <label>{t("Company name")} <span className="required">*</span>
              <input required maxLength={120} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={t("e.g. Northstar Labs")} />
            </label>
            <label>{t("Position")}
              <input value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value })} placeholder={t("Role you are preparing for")} />
            </label>
            <label>{t("Website")}
              <input type="url" value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} placeholder="https://" />
            </label>
            <label>{t("Description")}
              <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder={t("A short company overview")} />
            </label>
            <label className="full-field">{t("Research notes")}
              <textarea rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder={t("What should you remember about this company?")} />
            </label>
            <div className="form-actions full-field">
              <button className="btn accent" type="submit" disabled={saving}>{saving ? t("Saving…") : editing ? t("Save changes") : t("Create workspace")}</button>
              <button className="btn" type="button" onClick={() => { setShowForm(false); setEditing(null); }}>{t("Cancel")}</button>
            </div>
          </form>
        </section>
      )}

      <section className="company-list-section">
        <div className="section-heading">
          <div>
            <div className="eyebrow">{t("Your interview pipeline")}</div>
            <h2>{t("Company workspaces")}</h2>
          </div>
          <button type="button" className="btn primary" onClick={() => { openCreate(); window.scrollTo({ top: 0, behavior: "smooth" }); }}>
            <span aria-hidden="true">＋</span> {t("Add company")}
          </button>
        </div>
        <div className="company-list">
          {loading ? (
            <div className="empty"><div className="empty-icon">◌</div><strong>{t("Opening your workspaces")}</strong><span>{t("Syncing with Google Drive.")}</span></div>
          ) : companies.length === 0 ? (
            <div className="empty">
              <div className="empty-icon">⌂</div>
              <strong>{t("Your preparation space starts here")}</strong>
              <span>{t("Add a company to keep role research and practice questions in one place.")}</span>
            </div>
          ) : companies.map((company) => (
            <article className="company-item" key={company.id}>
              <div className="company-monogram" aria-hidden="true">{company.name.slice(0, 1).toUpperCase()}</div>
              <div className="company-item-copy">
                <h3>{company.name}</h3>
                <p>{company.position || t("Position not specified")}</p>
                <div className="meta">{company.questionCount} {t(company.questionCount === 1 ? "question" : "questions")} · {t("Updated")} {new Date(company.updatedAt).toLocaleDateString(language === "fr" ? "fr-FR" : "en-US")}</div>
              </div>
              <div className="company-item-actions">
                <Link className="btn accent small" href={`/companies/${company.id}`}>{t("Open workspace")} <span aria-hidden="true">→</span></Link>
                <button className="btn small" type="button" onClick={() => openEdit(company)}>{t("Edit")}</button>
                <button className="btn small danger-button" type="button" onClick={() => void removeCompany(company)}>{t("Delete")}</button>
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
