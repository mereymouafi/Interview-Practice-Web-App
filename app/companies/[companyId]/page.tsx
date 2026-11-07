"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { LanguageSwitcher, useLanguage } from "@/lib/language";

type Company = {
  id: string;
  name: string;
  website?: string;
  position: string;
  description?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
};

type CompanyQuestion = {
  id: string;
  companyId: string;
  question: string;
  answer: string;
  category: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
};

type QuestionForm = Pick<CompanyQuestion, "question" | "answer" | "category" | "notes">;
const emptyQuestion: QuestionForm = { question: "", answer: "", category: "", notes: "" };

function shuffleQuestions<T>(items: T[]) {
  const shuffled = [...items];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function formatDuration(seconds: number) {
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

export default function CompanyWorkspacePage() {
  const { language, t } = useLanguage();
  const params = useParams<{ companyId: string }>();
  const companyId = params.companyId;
  const [user, setUser] = useState<{ email?: string } | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [company, setCompany] = useState<Company | null>(null);
  const [questions, setQuestions] = useState<CompanyQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All categories");
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<CompanyQuestion | null>(null);
  const [questionForm, setQuestionForm] = useState<QuestionForm>(emptyQuestion);
  const [savingQuestion, setSavingQuestion] = useState(false);
  const [practiceOrder, setPracticeOrder] = useState<CompanyQuestion[]>([]);
  const [practiceIndex, setPracticeIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [previewUrl, setPreviewUrl] = useState("");
  const [previewBlob, setPreviewBlob] = useState<Blob | null>(null);
  const [savingRecording, setSavingRecording] = useState(false);
  const [editingCompany, setEditingCompany] = useState(false);
  const [companyForm, setCompanyForm] = useState({ name: "", website: "", position: "", description: "", notes: "" });
  const [savingCompany, setSavingCompany] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const clockRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedRef = useRef(0);
  const practiceQuestion = practiceOrder[practiceIndex];

  const loadWorkspace = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/companies/${companyId}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not load this workspace.");
      setCompany(data.company);
      setQuestions(data.questions || []);
    } catch (error) {
      setNotice(error instanceof Error ? t(error.message) : t("Could not load this workspace."));
    } finally {
      setLoading(false);
    }
  }, [companyId, t]);

  useEffect(() => { void loadWorkspace(); }, [loadWorkspace]);
  useEffect(() => {
    fetch("/api/auth/status")
      .then((response) => response.json())
      .then((data) => {
        setUser(data.user || null);
        setIsAdmin(Boolean(data.isAdmin));
      })
      .catch(() => setUser(null));
  }, []);
  useEffect(() => () => {
    if (clockRef.current) clearInterval(clockRef.current);
    streamRef.current?.getTracks().forEach((track) => track.stop());
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  const categories = useMemo(
    () => ["All categories", ...Array.from(new Set(questions.map((item) => item.category).filter(Boolean))).sort()],
    [questions]
  );
  const filteredQuestions = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return questions.filter((item) => {
      const matchesCategory = category === "All categories" || item.category === category;
      const matchesSearch = !query || `${item.question} ${item.answer} ${item.notes || ""}`.toLocaleLowerCase().includes(query);
      return matchesCategory && matchesSearch;
    });
  }, [questions, search, category]);

  function clearPreview() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl("");
    setPreviewBlob(null);
  }

  function startCreateQuestion() {
    setEditing(null);
    setQuestionForm(emptyQuestion);
    setEditorOpen(true);
  }

  function startEditQuestion(question: CompanyQuestion) {
    setEditing(question);
    setQuestionForm({
      question: question.question,
      answer: question.answer,
      category: question.category || "",
      notes: question.notes || "",
    });
    setEditorOpen(true);
  }

  async function saveQuestion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingQuestion(true);
    setNotice("");
    try {
      const url = editing
        ? `/api/companies/${companyId}/questions/${editing.id}`
        : `/api/companies/${companyId}/questions`;
      const response = await fetch(url, {
        method: editing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(questionForm),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not save question.");
      setQuestions(data.questions || []);
      setEditorOpen(false);
      setEditing(null);
      setNotice(editing ? t("Question updated.") : t("Question added."));
    } catch (error) {
      setNotice(error instanceof Error ? t(error.message) : t("Could not save question."));
    } finally {
      setSavingQuestion(false);
    }
  }

  async function removeQuestion(question: CompanyQuestion) {
    if (!window.confirm(t("Delete this question and its prepared answer?"))) return;
    try {
      const response = await fetch(`/api/companies/${companyId}/questions/${question.id}`, { method: "DELETE" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not delete question.");
      setQuestions(data.questions || []);
      setNotice(t("Question deleted."));
    } catch (error) {
      setNotice(error instanceof Error ? t(error.message) : t("Could not delete question."));
    }
  }

  async function saveCompany(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingCompany(true);
    try {
      const response = await fetch(`/api/companies/${companyId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(companyForm),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not update company.");
      setCompany(data.company);
      setEditingCompany(false);
      setNotice(t("Company information updated."));
    } catch (error) {
      setNotice(error instanceof Error ? t(error.message) : t("Could not update company."));
    } finally {
      setSavingCompany(false);
    }
  }

  function beginPractice() {
    if (!questions.length) {
      setNotice(t("Add at least one question before starting company practice."));
      return;
    }
    setPracticeOrder(shuffleQuestions(questions));
    setPracticeIndex(0);
    setRevealed(false);
    setNotice("");
    clearPreview();
    setSeconds(0);
  }

  function movePractice(direction: -1 | 1) {
    setPracticeIndex((index) => Math.min(Math.max(index + direction, 0), practiceOrder.length - 1));
    setRevealed(false);
    clearPreview();
    setSeconds(0);
  }

  function restartPractice() {
    setPracticeOrder(shuffleQuestions(questions));
    setPracticeIndex(0);
    setRevealed(false);
    clearPreview();
    setSeconds(0);
  }

  function exitPractice() {
    if (recording) stopRecording();
    setPracticeOrder([]);
    setRevealed(false);
    clearPreview();
  }

  async function startRecording() {
    if (!practiceQuestion) return;
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      setNotice(t("Microphone recording requires HTTPS. Open the deployed Vercel website."));
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];
      const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus") ? "audio/webm;codecs=opus" : "";
      const recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      recorderRef.current = recorder;
      recorder.ondataavailable = (event) => { if (event.data.size) chunksRef.current.push(event.data); };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        setPreviewBlob(blob);
        setPreviewUrl(URL.createObjectURL(blob));
        streamRef.current?.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        setNotice(t("Your company practice take is ready to review."));
      };
      recorder.start();
      startedRef.current = Date.now();
      setSeconds(0);
      setRecording(true);
      setNotice(t("Recording your answer…"));
      clockRef.current = setInterval(() => setSeconds(Math.floor((Date.now() - startedRef.current) / 1000)), 250);
    } catch (error) {
      const exception = error as DOMException;
      setNotice(exception.name === "NotAllowedError" ? t("Microphone permission was denied. Allow microphone access.") : `${t("Could not start microphone: ")}${exception.name}.`);
    }
  }

  function stopRecording() {
    setSeconds(Math.floor((Date.now() - startedRef.current) / 1000));
    if (clockRef.current) clearInterval(clockRef.current);
    clockRef.current = null;
    if (recorderRef.current && recorderRef.current.state !== "inactive") recorderRef.current.stop();
    setRecording(false);
  }

  async function savePracticeRecording() {
    if (!previewBlob || !practiceQuestion || !company) return;
    setSavingRecording(true);
    setNotice(t("Saving your take to Google Drive…"));
    try {
      const form = new FormData();
      const ext = previewBlob.type.includes("mp4") ? "m4a" : "webm";
      form.append("audio", previewBlob, `answer.${ext}`);
      form.append("question", practiceQuestion.question);
      form.append("category", practiceQuestion.category || "Company Practice");
      form.append("durationSeconds", String(seconds));
      form.append("companyId", company.id);
      form.append("questionId", practiceQuestion.id);
      const response = await fetch("/api/recordings", { method: "POST", body: form });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not save recording.");
      setNotice(`${t("Saved to Google Drive: ")}${data.recording.name}`);
      clearPreview();
    } catch (error) {
      setNotice(error instanceof Error ? t(error.message) : t("Could not save recording."));
    } finally {
      setSavingRecording(false);
    }
  }

  if (loading) return <main className="shell"><div className="panel loading-panel">{t("Opening your workspace…")}</div></main>;
  if (!company) return (
    <main className="shell">
      <header className="topbar"><Link className="brand-lockup brand-link" href="/companies"><span className="brand-mark">M</span><span className="brand">MERYY<small>INTERVIEW STUDIO</small></span></Link><LanguageSwitcher /></header>
      <div className="panel workspace-error"><div className="eyebrow">{t("Workspace unavailable")}</div><h1>{t("We couldn't open this company.")}</h1><p>{t(notice || "Check your connection and try again.")}</p><Link className="btn accent" href="/companies">{t("Back to companies")}</Link></div>
    </main>
  );

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
          <span className="email">{user?.email || t("Google account connected")}</span>
          <a className="btn small" href="/api/auth/logout">{t("Sign out")}</a>
        </div>
      </header>
      <nav className="main-nav" aria-label={t("Main navigation")}>
        <Link href="/">{t("Home")}</Link><Link href="/practice">{t("General Practice")}</Link><Link className="active" href="/companies">{t("Company Preparation")}</Link><Link href="/recordings">{t("Recording Library")}</Link>{isAdmin && <Link href="/admin">{t("Admin / Question Manager")}</Link>}
      </nav>

      <div className="workspace-back"><Link href="/companies">← {t("All company workspaces")}</Link></div>

      {practiceQuestion ? (
        <section className="practice-mode" aria-label={t("Company practice")}>
          <div className="practice-toolbar">
            <div><div className="eyebrow">{company.name} · {t("Practice mode")}</div><p>{company.position || t("Interview preparation")}</p></div>
            <div className="practice-toolbar-actions">
              <button className="btn small" type="button" onClick={restartPractice} disabled={recording || savingRecording}>↻ {t("New shuffle")}</button>
              <button className="btn small" type="button" onClick={exitPractice} disabled={recording}>{t("Exit practice")}</button>
            </div>
          </div>
          <div className="practice-progress"><span>{t("Question ")}{practiceIndex + 1}{t(" of ")}{practiceOrder.length}</span><div><i style={{ width: `${((practiceIndex + 1) / practiceOrder.length) * 100}%` }} /></div></div>
          <div className="practice-prompt">
            <div className="question-kicker">{t(practiceQuestion.category || "Company question")}</div>
            <h1>{practiceQuestion.question}</h1>
            <p>{t("Think it through and answer in your own words before revealing your prepared response.")}</p>
            <button type="button" className="btn accent" onClick={() => setRevealed((value) => !value)}>{revealed ? t("Hide answer") : t("Reveal prepared answer")}</button>
            {revealed && <div className="prepared-answer"><div className="eyebrow">{t("Your prepared answer")}</div><p>{practiceQuestion.answer}</p>{practiceQuestion.notes && <div className="answer-notes"><strong>{t("Notes")}</strong><p>{practiceQuestion.notes}</p></div>}</div>}
          </div>
          <div className="practice-recording">
            <div className="practice-recording-head"><div><div className="eyebrow">{t("Rehearse out loud")}</div><h2>{recording ? t("Recording in progress") : t("Record your answer")}</h2></div><div className="timer light-timer">{formatDuration(seconds)}</div></div>
            <div className="practice-recording-actions">
              {!recording ? <button className="record-button" type="button" onClick={() => void startRecording()} disabled={savingRecording}>● {t("Record answer")}</button> : <button className="record-button recording" type="button" onClick={stopRecording}>■ {t("Stop recording")}</button>}
              {previewUrl && previewBlob && <div className="company-preview"><audio controls src={previewUrl} /><button className="btn accent small" type="button" disabled={savingRecording} onClick={() => void savePracticeRecording()}>{savingRecording ? t("Saving…") : t("Save to Google Drive")}</button><button className="btn small" type="button" onClick={clearPreview} disabled={savingRecording}>{t("Discard")}</button></div>}
            </div>
          </div>
          <div className="practice-navigation">
            <button type="button" className="btn" onClick={() => movePractice(-1)} disabled={practiceIndex === 0 || recording || savingRecording}>← {t("Previous")}</button>
            <span>{practiceIndex + 1} / {practiceOrder.length}</span>
            <button type="button" className="btn primary" onClick={() => movePractice(1)} disabled={practiceIndex === practiceOrder.length - 1 || recording || savingRecording}>{t("Next question")} →</button>
          </div>
          {notice && <div className="page-notice" role="status">{t(notice)}</div>}
        </section>
      ) : (
        <>
          <section className="workspace-hero">
            <div className="company-monogram large" aria-hidden="true">{company.name.slice(0, 1).toUpperCase()}</div>
            <div className="workspace-title">
              <div className="eyebrow">{t("Company workspace")}</div>
              <h1>{company.name}</h1>
              <p>{company.position || t("Position not specified")}</p>
              {company.website && <a href={company.website} target="_blank" rel="noreferrer">{company.website} ↗</a>}
            </div>
            <div className="workspace-hero-actions">
              <button type="button" className="btn small" onClick={() => {
                setCompanyForm({ name: company.name, website: company.website || "", position: company.position || "", description: company.description || "", notes: company.notes || "" });
                setEditingCompany(true);
              }}>{t("Edit details")}</button>
              <button type="button" className="btn primary" onClick={beginPractice} disabled={!questions.length}>{t("Start Company Practice")} <span aria-hidden="true">→</span></button>
            </div>
          </section>
          {(company.description || company.notes) && <section className="company-context panel">
            {company.description && <div><div className="eyebrow">{t("About the company")}</div><p>{company.description}</p></div>}
            {company.notes && <div><div className="eyebrow">{t("Your research notes")}</div><p>{company.notes}</p></div>}
          </section>}

          {editingCompany && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setEditingCompany(false); }}>
            <section className="panel modal-panel" role="dialog" aria-modal="true" aria-labelledby="edit-company-heading">
              <div className="section-heading"><div><div className="eyebrow">{t("Workspace details")}</div><h2 id="edit-company-heading">{t("Edit company")}</h2></div><button className="btn small" type="button" onClick={() => setEditingCompany(false)}>{t("Close")}</button></div>
              <form className="form-grid" onSubmit={(event) => void saveCompany(event)}>
                <label>{t("Company name")} <span className="required">*</span><input required maxLength={120} value={companyForm.name} onChange={(event) => setCompanyForm({ ...companyForm, name: event.target.value })} /></label>
                <label>{t("Position")}<input value={companyForm.position} onChange={(event) => setCompanyForm({ ...companyForm, position: event.target.value })} /></label>
                <label>{t("Website")}<input type="url" value={companyForm.website} onChange={(event) => setCompanyForm({ ...companyForm, website: event.target.value })} /></label>
                <label>{t("Description")}<input value={companyForm.description} onChange={(event) => setCompanyForm({ ...companyForm, description: event.target.value })} /></label>
                <label className="full-field">{t("Research notes")}<textarea rows={4} value={companyForm.notes} onChange={(event) => setCompanyForm({ ...companyForm, notes: event.target.value })} /></label>
                <div className="form-actions full-field"><button className="btn accent" type="submit" disabled={savingCompany}>{savingCompany ? t("Saving…") : t("Save changes")}</button><button className="btn" type="button" onClick={() => setEditingCompany(false)}>{t("Cancel")}</button></div>
              </form>
            </section>
          </div>}

          <section className="questions-section">
            <div className="section-heading">
              <div><div className="eyebrow">{t("Make every answer your own")}</div><h2>{t("Question bank")} <span className="count-pill">{questions.length}</span></h2></div>
              <button className="btn accent" type="button" onClick={startCreateQuestion}>＋ {t("Add question")}</button>
            </div>
            <div className="question-filters">
              <label className="search-field"><span aria-hidden="true">⌕</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t("Search your questions")} aria-label={t("Search questions")} /></label>
              <select value={category} onChange={(event) => setCategory(event.target.value)} aria-label={t("Filter by category")}>{categories.map((item) => <option key={item} value={item}>{t(item)}</option>)}</select>
            </div>
            {notice && <div className="page-notice" role="status">{t(notice)}</div>}
            <div className="question-list">
              {filteredQuestions.length === 0 ? <div className="empty panel"><div className="empty-icon">✳</div><strong>{questions.length ? t("No questions match your search") : t("Your question bank is ready")}</strong><span>{questions.length ? t("Try another search or category.") : t("Add a question and prepare an answer to start your practice.")}</span></div> :
                filteredQuestions.map((item) => <article className="question-item panel" key={item.id}>
                  <div className="question-item-main"><div className="question-item-meta">{item.category && <span className="category-chip">{t(item.category)}</span>}<span>{t("Updated")} {new Date(item.updatedAt).toLocaleDateString(language === "fr" ? "fr-FR" : "en-US")}</span></div><h3>{item.question}</h3><p>{item.answer}</p>{item.notes && <div className="question-item-notes"><strong>{t("Notes")}</strong> · {item.notes}</div>}</div>
                  <div className="question-item-actions"><button className="btn small" type="button" onClick={() => startEditQuestion(item)}>{t("Edit")}</button><button className="btn small danger-button" type="button" onClick={() => void removeQuestion(item)}>{t("Delete")}</button></div>
                </article>)}
            </div>
          </section>

          {editorOpen && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setEditorOpen(false); }}>
            <section className="panel modal-panel" role="dialog" aria-modal="true" aria-labelledby="question-editor-heading">
              <div className="section-heading"><div><div className="eyebrow">{editing ? t("Refine your response") : t("Add to your preparation")}</div><h2 id="question-editor-heading">{editing ? t("Edit question") : t("New question")}</h2></div><button className="btn small" type="button" onClick={() => setEditorOpen(false)}>{t("Close")}</button></div>
              <form className="form-grid" onSubmit={(event) => void saveQuestion(event)}>
                <label className="full-field">{t("Interview question")} <span className="required">*</span><textarea required maxLength={2000} rows={3} value={questionForm.question} onChange={(event) => setQuestionForm({ ...questionForm, question: event.target.value })} placeholder={t("What might they ask you?")} /></label>
                <label className="full-field">{t("Prepared answer")} <span className="required">*</span><textarea required maxLength={12000} rows={7} value={questionForm.answer} onChange={(event) => setQuestionForm({ ...questionForm, answer: event.target.value })} placeholder={t("Structure your key points in your own words…")} /></label>
                <label>{t("Category")}<select value={questionForm.category} onChange={(event) => setQuestionForm({ ...questionForm, category: event.target.value })}><option value="">{t("No category")}</option><option value="HR">{t("HR")}</option><option value="Technical">{t("Technical")}</option><option value="Behavioral">{t("Behavioral")}</option><option value="Company fit">{t("Company fit")}</option><option value="Role-specific">{t("Role-specific")}</option><option value="Other">{t("Other")}</option></select></label>
                <label>{t("Notes")}<input maxLength={4000} value={questionForm.notes} onChange={(event) => setQuestionForm({ ...questionForm, notes: event.target.value })} placeholder={t("Optional reminders")} /></label>
                <div className="form-actions full-field"><button className="btn accent" type="submit" disabled={savingQuestion}>{savingQuestion ? t("Saving…") : t("Save question")}</button><button className="btn" type="button" onClick={() => setEditorOpen(false)}>{t("Cancel")}</button></div>
              </form>
            </section>
          </div>}
        </>
      )}
    </main>
  );
}
