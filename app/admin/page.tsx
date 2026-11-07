"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { LanguageSwitcher, useLanguage } from "@/lib/language";

type Category = "HR" | "Technical" | "Behavioral";
type Difficulty = "" | "Beginner" | "Intermediate" | "Advanced";
type Question = {
  id: string;
  question: string;
  answer: string;
  category: Category;
  difficulty?: Exclude<Difficulty, "">;
  tags?: string[];
  notes?: string;
  createdAt: string;
  updatedAt: string;
};
type FormValue = {
  question: string;
  answer: string;
  category: Category;
  difficulty: Difficulty;
  tags: string;
  notes: string;
};

const CATEGORIES: Category[] = ["HR", "Technical", "Behavioral"];
const EMPTY_FORM: FormValue = {
  question: "",
  answer: "",
  category: "HR",
  difficulty: "",
  tags: "",
  notes: "",
};

export default function AdminPage() {
  const { language, t } = useLanguage();
  const [access, setAccess] = useState<"loading" | "granted" | "denied" | "error">("loading");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [activeCategory, setActiveCategory] = useState<Category>("HR");
  const [search, setSearch] = useState("");
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<Question | null>(null);
  const [form, setForm] = useState<FormValue>(EMPTY_FORM);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");

  const loadQuestions = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/questions", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          setAccess("denied");
          setNotice(t(data.error || "Administrator access is required."));
          return;
        }
        throw new Error(t(data.error || "Could not load question bank."));
      }
      setQuestions(data.questions || []);
      setAccess("granted");
      setNotice("");
    } catch (error) {
      setAccess("error");
      setNotice(error instanceof Error ? t(error.message) : t("Could not load question bank."));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => { void loadQuestions(); }, [loadQuestions]);

  const categoryCounts = useMemo(
    () => Object.fromEntries(CATEGORIES.map((category) => [
      category,
      questions.filter((item) => item.category === category).length,
    ])) as Record<Category, number>,
    [questions]
  );
  const visibleQuestions = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return questions.filter((item) => {
      if (item.category !== activeCategory) return false;
      return !query || `${item.question} ${item.answer} ${item.tags?.join(" ") || ""} ${item.notes || ""}`.toLocaleLowerCase().includes(query);
    }).sort((a, b) => a.question.localeCompare(b.question));
  }, [questions, activeCategory, search]);

  function addQuestion() {
    setEditing(null);
    setForm({ ...EMPTY_FORM, category: activeCategory });
    setEditorOpen(true);
    setNotice("");
  }

  function editQuestion(question: Question) {
    setEditing(question);
    setForm({
      question: question.question,
      answer: question.answer || "",
      category: question.category,
      difficulty: question.difficulty || "",
      tags: question.tags?.join(", ") || "",
      notes: question.notes || "",
    });
    setEditorOpen(true);
    setNotice("");
  }

  async function saveQuestion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setNotice("");
    try {
      const payload = {
        ...form,
        tags: form.tags.split(",").map((tag) => tag.trim()).filter(Boolean),
      };
      const response = await fetch(
        editing ? `/api/admin/questions/${editing.id}` : "/api/admin/questions",
        {
          method: editing ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not save question.");
      setEditorOpen(false);
      setEditing(null);
      setNotice(t(editing ? "Question updated in Google Drive." : "Question added to Google Drive."));
      await loadQuestions();
    } catch (error) {
      setNotice(error instanceof Error ? t(error.message) : t("Could not save question."));
    } finally {
      setSaving(false);
    }
  }

  async function removeQuestion(question: Question) {
    if (!window.confirm(`${t("Delete this ")}${t(question.category)}${t(" question? This cannot be undone.")}`)) return;
    setNotice("");
    try {
      const response = await fetch(`/api/admin/questions/${question.id}`, { method: "DELETE" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not delete question.");
      setNotice(t("Question deleted from Google Drive."));
      await loadQuestions();
    } catch (error) {
      setNotice(error instanceof Error ? t(error.message) : t("Could not delete question."));
    }
  }

  if (access === "loading") {
    return <main className="shell"><div className="panel loading-panel">{t("Verifying administrator access…")}</div></main>;
  }

  if (access === "denied" || access === "error") {
    return (
      <main className="shell">
        <header className="topbar">
          <Link className="brand-lockup brand-link" href="/"><span className="brand-mark">M</span><span className="brand">MERYY<small>INTERVIEW STUDIO</small></span></Link>
          <LanguageSwitcher />
        </header>
        <section className="panel admin-denied">
          <div className="login-mark" aria-hidden="true">M</div>
          <div className="eyebrow">{access === "denied" ? t("Restricted workspace") : t("Question bank unavailable")}</div>
          <h1>{access === "denied" ? t("Admin access required.") : t("We couldn't load the question bank.")}</h1>
          <p>{t(notice)}</p>
          {access === "denied" && <p className="admin-hint">{t("To grant access, add the signed-in Google account to")} <code>ADMIN_EMAILS</code> {t("in your environment settings.")}</p>}
          <div className="form-actions"><Link className="btn accent" href="/practice">{t("Return to practice")}</Link><button className="btn" type="button" onClick={() => void loadQuestions()}>{t("Try again")}</button></div>
        </section>
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
          <span className="admin-status"><span /> {t("Administrator")}</span>
          <a className="btn small" href="/api/auth/logout">{t("Sign out")}</a>
        </div>
      </header>

      <nav className="main-nav" aria-label={t("Main navigation")}>
        <Link href="/">{t("Home")}</Link>
        <Link href="/practice">{t("General Practice")}</Link>
        <Link href="/companies">{t("Company Preparation")}</Link>
        <Link href="/recordings">{t("Recording Library")}</Link>
        <span className="active" aria-current="page">{t("Admin / Question Manager")}</span>
      </nav>

      <section className="admin-hero">
        <div>
          <div className="eyebrow">{t("Your general interview library")}</div>
          <h1>{t("Question manager.")}</h1>
          <p className="sub">{t("Shape the prompts you practise with. Changes are saved privately to Google Drive and appear in General Practice.")}</p>
        </div>
        <button className="btn accent" type="button" onClick={addQuestion}>{t("＋ Add New Question")}</button>
      </section>

      {notice && <div className="page-notice" role="status">{t(notice)}</div>}

      <section className="admin-workspace">
        <div className="admin-category-list" aria-label={t("Question categories")}>
          {CATEGORIES.map((category) => (
            <button type="button" key={category} className={`admin-category ${activeCategory === category ? "active" : ""}`} onClick={() => setActiveCategory(category)}>
              <span className="admin-category-icon" aria-hidden="true">{category === "HR" ? "✳" : category === "Technical" ? "⌘" : "◈"}</span>
              <span><strong>{t(category)} {t("Questions")}</strong><small>{categoryCounts[category]} {t(categoryCounts[category] === 1 ? "prompt" : "prompts")}</small></span>
              <span className="admin-category-arrow" aria-hidden="true">→</span>
            </button>
          ))}
          <div className="admin-drive-note"><span className="drive-dot" /> {t("Synced with your private Google Drive")}</div>
        </div>

        <div className="admin-question-panel">
          <div className="admin-list-heading">
            <div><div className="eyebrow">{t(activeCategory)} {t("question bank")}</div><h2>{t(activeCategory)} {t("Questions")} <span className="count-pill">{categoryCounts[activeCategory]}</span></h2></div>
            <button type="button" className="btn small" onClick={() => void loadQuestions()} disabled={loading}>{loading ? t("Refreshing…") : `↻ ${t("Refresh")}`}</button>
          </div>
          <label className="search-field admin-search"><span aria-hidden="true">⌕</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={`${t("Search")} ${t(activeCategory).toLowerCase()} ${t("questions")}`} aria-label={t("Search questions")} /></label>
          {loading ? <div className="empty"><div className="empty-icon">◌</div><strong>{t("Syncing your question bank")}</strong><span>{t("Reading question files from Google Drive.")}</span></div> :
            visibleQuestions.length === 0 ? <div className="empty"><div className="empty-icon">✳</div><strong>{search ? t("No matching questions") : t("No questions in this category")}</strong><span>{search ? t("Try another search phrase.") : t("Add a question to build this part of your practice.")}</span></div> :
              <div className="admin-question-list">
                {visibleQuestions.map((question) => (
                  <article className="admin-question-item" key={question.id}>
                    <div className="admin-question-copy">
                      <div className="question-item-meta">
                        <span className="category-chip">{t(question.category)}</span>
                        {question.difficulty && <span className="difficulty-chip">{t(question.difficulty)}</span>}
                        <span>{t("Updated")} {new Date(question.updatedAt).toLocaleDateString(language === "fr" ? "fr-FR" : "en-US")}</span>
                      </div>
                      <h3>{question.question}</h3>
                      <p className="admin-answer-preview">{question.answer || t("No prepared answer yet.")}</p>
                      {Boolean(question.tags?.length) && <div className="question-tags">{question.tags?.map((tag) => <span key={tag}>{tag}</span>)}</div>}
                    </div>
                    <div className="admin-question-actions">
                      <button className="btn small" type="button" onClick={() => editQuestion(question)}>{t("Edit")}</button>
                      <button className="btn small danger-button" type="button" onClick={() => void removeQuestion(question)}>{t("Delete")}</button>
                    </div>
                  </article>
                ))}
              </div>}
        </div>
      </section>

      {editorOpen && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) setEditorOpen(false); }}>
        <section className="panel modal-panel admin-editor" role="dialog" aria-modal="true" aria-labelledby="admin-editor-heading">
          <div className="section-heading">
            <div><div className="eyebrow">{editing ? t("Refine your question bank") : t("Add to general practice")}</div><h2 id="admin-editor-heading">{editing ? t("Edit question") : t("Add New Question")}</h2></div>
            <button className="btn small" type="button" onClick={() => setEditorOpen(false)} disabled={saving}>{t("Close")}</button>
          </div>
          <form className="form-grid" onSubmit={(event) => void saveQuestion(event)}>
            <label className="full-field">{t("Question")} <span className="required">*</span>
              <textarea required maxLength={4000} rows={3} value={form.question} onChange={(event) => setForm({ ...form, question: event.target.value })} placeholder={t("Write the interview question…")} />
            </label>
            <label className="full-field">{t("Prepared answer")} <span className="optional-label">{t("Optional")}</span>
              <textarea maxLength={20000} rows={7} value={form.answer} onChange={(event) => setForm({ ...form, answer: event.target.value })} placeholder={t("Add a prepared answer now or come back to it later…")} />
            </label>
            <label>{t("Category")} <span className="required">*</span>
              <select value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value as Category })}>{CATEGORIES.map((category) => <option key={category} value={category}>{t(category)}</option>)}</select>
            </label>
            <label>{t("Difficulty")}
              <select value={form.difficulty} onChange={(event) => setForm({ ...form, difficulty: event.target.value as Difficulty })}><option value="">{t("Not specified")}</option><option value="Beginner">{t("Beginner")}</option><option value="Intermediate">{t("Intermediate")}</option><option value="Advanced">{t("Advanced")}</option></select>
            </label>
            <label className="full-field">{t("Tags")} <span className="optional-label">{t("Separate with commas")}</span>
              <input maxLength={1000} value={form.tags} onChange={(event) => setForm({ ...form, tags: event.target.value })} placeholder={t("Motivation, Strengths, Leadership")} />
            </label>
            <label className="full-field">{t("Notes")} <span className="optional-label">{t("Optional")}</span>
              <textarea maxLength={5000} rows={3} value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} placeholder={t("Private reminders for your practice…")} />
            </label>
            <div className="form-actions full-field"><button className="btn accent" type="submit" disabled={saving}>{saving ? t("Saving to Drive…") : t("Save Question")}</button><button className="btn" type="button" onClick={() => setEditorOpen(false)} disabled={saving}>{t("Cancel")}</button></div>
          </form>
        </section>
      </div>}
    </main>
  );
}
