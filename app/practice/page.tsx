"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { LanguageSwitcher, useLanguage } from "@/lib/language";

type GeneralCategory = "HR" | "Technical" | "Behavioral";
type GeneralQuestion = {
  id: string;
  question: string;
  answer: string;
  category: GeneralCategory;
  difficulty?: "Beginner" | "Intermediate" | "Advanced";
  tags?: string[];
  notes?: string;
  createdAt: string;
  updatedAt: string;
};

const CATEGORIES: GeneralCategory[] = ["HR", "Technical", "Behavioral"];
const CATEGORY_DETAILS: Record<GeneralCategory, { icon: string; subtitle: string }> = {
  HR: { icon: "✳", subtitle: "Personal & career" },
  Technical: { icon: "⌘", subtitle: "Skills & knowledge" },
  Behavioral: { icon: "◈", subtitle: "Real situations" },
};

function formatDuration(seconds: number) {
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(
    seconds % 60
  ).padStart(2, "0")}`;
}

export default function GeneralPracticePage() {
  const { t } = useLanguage();
  const [user, setUser] = useState<{ email?: string } | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState<GeneralCategory>("HR");
  const [selectedQuestionId, setSelectedQuestionId] = useState("");
  const [question, setQuestion] = useState("");
  const [preparedAnswer, setPreparedAnswer] = useState("");
  const [answerRevealed, setAnswerRevealed] = useState(false);
  const [generalQuestions, setGeneralQuestions] = useState<GeneralQuestion[]>([]);
  const [questionLoading, setQuestionLoading] = useState(false);
  const [spinning, setSpinning] = useState(false);
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [notice, setNotice] = useState("Choose a question to begin.");
  const [previewUrl, setPreviewUrl] = useState("");
  const [previewBlob, setPreviewBlob] = useState<Blob | null>(null);
  const [saving, setSaving] = useState(false);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const spinRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const clockRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedRef = useRef(0);

  const questionList = useMemo(
    () => generalQuestions.filter((item) => item.category === category),
    [generalQuestions, category]
  );

  async function loadQuestionBank() {
    setQuestionLoading(true);
    try {
      const res = await fetch("/api/questions", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t("Could not load interview questions."));
      const nextQuestions = Array.isArray(data.questions) ? data.questions as GeneralQuestion[] : [];
      setGeneralQuestions(nextQuestions);
      const currentQuestion = nextQuestions.find((item) => item.id === selectedQuestionId);
      if (selectedQuestionId && !currentQuestion) {
        setQuestion("");
        setSelectedQuestionId("");
        setPreparedAnswer("");
        setAnswerRevealed(false);
      } else if (currentQuestion) {
        setQuestion(currentQuestion.question);
        setPreparedAnswer(currentQuestion.answer || "");
      }
    } catch (error) {
      setNotice(error instanceof Error ? t(error.message) : t("Could not load interview questions."));
    } finally {
      setQuestionLoading(false);
    }
  }

  useEffect(() => {
    fetch("/api/auth/status")
      .then((r) => r.json())
      .then((data) => {
        setUser(data.user || null);
        setIsAdmin(Boolean(data.isAdmin));
        if (data.user) {
          void loadQuestionBank();
        }
      })
      .catch(() => {
        setUser(null);
        setNotice(t("Could not check your Google sign-in status."));
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    return () => {
      if (spinRef.current) clearInterval(spinRef.current);
      if (clockRef.current) clearInterval(clockRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  function clearPreview() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl("");
    setPreviewBlob(null);
  }

  function pickQuestion() {
    const list = questionList;
    if (!list.length) {
      setNotice(questionLoading ? t("Loading questions from Google Drive…") : t("There are no questions in this category yet."));
      return;
    }

    let next = list[Math.floor(Math.random() * list.length)];
    if (list.length > 1 && next.question === question) {
      next = list[(list.indexOf(next) + 1) % list.length];
    }

    setSelectedQuestionId(next.id);
    setQuestion(next.question);
    setPreparedAnswer(next.answer || "");
    setAnswerRevealed(false);
    setNotice(t("Question selected. Take a moment to prepare."));
    clearPreview();
    setSeconds(0);
  }

  function startSpin() {
    if (spinning) {
      if (spinRef.current) clearInterval(spinRef.current);
      spinRef.current = null;
      setSpinning(false);
      pickQuestion();
      return;
    }

    const list = questionList;
    if (!list.length) {
      setNotice(questionLoading ? t("Loading questions from Google Drive…") : t("There are no questions in this category yet."));
      return;
    }
    setSpinning(true);
    setNotice(t("Choosing a question… click STOP when ready."));
    let i = 0;
    spinRef.current = setInterval(() => {
      const next = list[i++ % list.length];
      setSelectedQuestionId(next.id);
      setQuestion(next.question);
      setPreparedAnswer(next.answer || "");
      setAnswerRevealed(false);
    }, 100);
  }

  function changeCategory(nextCategory: GeneralCategory) {
    if (recording || spinning || saving) return;
    setCategory(nextCategory);
    setSelectedQuestionId("");
    setQuestion("");
    setPreparedAnswer("");
    setAnswerRevealed(false);
    clearPreview();
    setSeconds(0);
    setNotice(t("Choose a question to begin."));
  }

  async function startRecording() {
    if (!question) {
      setNotice(t("Choose a question first."));
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      setNotice(t("Microphone recording requires HTTPS. Open the deployed Vercel website."));
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];

      const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "";

      const recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      recorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, {
          type: recorder.mimeType || "audio/webm",
        });
        setPreviewBlob(blob);
        setPreviewUrl(URL.createObjectURL(blob));
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        setNotice(t("Your take is ready. Listen back, then save it to Drive."));
      };

      recorder.start();
      startedRef.current = Date.now();
      setSeconds(0);
      setRecording(true);
      setNotice(t("Recording in progress. Speak naturally and take your time."));

      clockRef.current = setInterval(() => {
        setSeconds(Math.floor((Date.now() - startedRef.current) / 1000));
      }, 250);
    } catch (error) {
      const e = error as DOMException;
      setNotice(
        e.name === "NotAllowedError"
          ? t("Microphone permission was denied. Allow microphone access.")
          : `${t("Could not start microphone: ")}${e.name}${t(". Check your microphone connection.")}`
      );
    }
  }

  function stopRecording() {
    const finalSeconds = Math.floor((Date.now() - startedRef.current) / 1000);
    setSeconds(finalSeconds);

    if (clockRef.current) {
      clearInterval(clockRef.current);
      clockRef.current = null;
    }

    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      recorderRef.current.stop();
    }
    setRecording(false);
  }

  async function saveRecording() {
    if (!previewBlob || !question) return;

    setSaving(true);
    setNotice(t("Saving your answer to Google Drive…"));
    try {
      const form = new FormData();
      const ext = previewBlob.type.includes("mp4") ? "m4a" : "webm";
      form.append("audio", previewBlob, `answer.${ext}`);
      form.append("question", question);
      form.append("category", category);
      form.append("durationSeconds", String(seconds));

      const res = await fetch("/api/recordings", {
        method: "POST",
        body: form,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t("Could not save recording."));

      setNotice(`${t("Saved to Google Drive: ")}${data.recording.name}`);
      clearPreview();
    } catch (error) {
      setNotice(error instanceof Error ? t(error.message) : t("Upload failed. Please try again."));
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="shell">
        <div className="panel loading-panel">{t("Preparing your studio…")}</div>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="shell">
        <div className="login">
          <div className="panel">
            <div className="login-mark">M</div>
            <LanguageSwitcher />
            <div className="eyebrow">{t("Your personal practice space")}</div>
            <h1>{t("Make every answer count.")}</h1>
            <p className="sub">
              {t("A focused space to rehearse, record, and review your interview answers. Your recordings stay in your own Google Drive.")}
            </p>
            <a className="btn primary google" href="/api/auth/google">
              {t("Continue with Google")} <span aria-hidden="true">↗</span>
            </a>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="shell">
      <header className="topbar">
        <div className="brand-lockup">
          <div className="brand-mark" aria-hidden="true">M</div>
          <div className="brand">
            MERYY
            <small>INTERVIEW STUDIO</small>
          </div>
        </div>

        <div className="account">
          <LanguageSwitcher />
          <span className="drive-status"><span className="drive-dot" /> {t("Drive connected")}</span>
          <span className="email">{user.email || t("Google account connected")}</span>
          <a className="btn small" href="/api/auth/logout">{t("Sign out")}</a>
        </div>
      </header>

      <nav className="main-nav" aria-label={t("Main navigation")}>
        <a href="/">{t("Home")}</a>
        <a className="active" href="/practice" aria-current="page">{t("General Practice")}</a>
        <a href="/companies">{t("Company Preparation")}</a>
        <a href="/recordings">{t("Recording Library")}</a>
        {isAdmin && <a href="/admin">{t("Admin / Question Manager")}</a>}
      </nav>

      <section className="intro practice-page-heading">
        <div className="eyebrow">{t("Your personal interview studio")}</div>
        <h1>{t("Show up ready.")}</h1>
        <p className="sub">{t("Build confidence one answer at a time. Choose a question, find your rhythm, and keep your best takes close.")}</p>
      </section>

      <section className="studio" id="general-practice">
        <div className="studio-inner">
          <div className="studio-top">
            <div className="studio-heading">
              <div className="studio-icon" aria-hidden="true">◉</div>
              <div>
                <strong>{t("Practice room")}</strong>
                <span>{t("A private space to find your best answer")}</span>
              </div>
            </div>
            <div className="session-label">{t("Session · 01")}</div>
          </div>

          <div className="category-grid" aria-label={t("Question category")}>
            {CATEGORIES.map((name) => (
              <button
                type="button"
                key={name}
                className={`category ${category === name ? "active" : ""}`}
                onClick={() => changeCategory(name)}
                disabled={recording || spinning || saving || questionLoading}
                aria-pressed={category === name}
              >
                <span className="category-icon">{CATEGORY_DETAILS[name].icon}</span>
                <span>
                  <strong>{t(name)}</strong>
                  <small>{t(CATEGORY_DETAILS[name].subtitle)}</small>
                </span>
              </button>
            ))}
          </div>

          <div className="question-stage">
            <div className="question-copy">
              <div className="question-kicker">{t("Your interview prompt · ")}{t(category)}</div>
              <p className="question">{question || t("Your next great answer starts with a question.")}</p>
              <p className="question-hint">
                {question
                  ? t("Take a breath, structure your thoughts, and answer as if you're in the room.")
                  : questionLoading
                    ? t("Loading your question bank from Google Drive…")
                    : questionList.length
                      ? t("Generate a prompt to begin your practice session.")
                      : t("No questions in this category yet. Add questions from Admin / Question Manager.")}
              </p>
              <div className="question-tools">
                <button className="btn-ghost" type="button" onClick={startSpin} disabled={recording || questionLoading || questionList.length === 0}>
                  {spinning ? t("Stop shuffle") : t("↻  Shuffle question")}
                </button>
                <button className="btn-ghost" type="button" onClick={pickQuestion} disabled={recording || spinning || saving || questionLoading || questionList.length === 0}>
                  {t("Next question →")}
                </button>
                <button className="btn-ghost" type="button" onClick={() => void loadQuestionBank()} disabled={questionLoading || recording || spinning}>
                  {questionLoading ? t("Refreshing…") : t("↻ Refresh bank")}
                </button>
              </div>
              {question && <div className="general-answer-tools">
                <button className="btn-ghost" type="button" onClick={() => setAnswerRevealed((value) => !value)}>
                  {answerRevealed ? t("Hide prepared answer") : t("Reveal prepared answer")}
                </button>
                {answerRevealed && <div className="general-prepared-answer">
                  <div className="question-kicker">{t("Prepared answer")}</div>
                  <p>{preparedAnswer || t("No prepared answer has been added for this question yet.")}</p>
                </div>}
              </div>}
            </div>

            <div className="record-console">
              <div className={`waveform ${recording ? "active" : ""}`} aria-hidden="true">
                {Array.from({ length: 17 }).map((_, i) => <span key={i} />)}
              </div>
              <div className="timer">{formatDuration(seconds)}</div>
              <div className="timer-caption">{recording ? t("Recording live") : t("Session timer")}</div>
              {!recording ? (
                <button
                  type="button"
                  className="record-button"
                  disabled={!question || saving || spinning}
                  onClick={startRecording}
                >
                  <span className="record-dot" /> {t("Record answer")}
                </button>
              ) : (
                <button type="button" className="record-button recording" onClick={stopRecording}>
                  <span className="record-dot" /> {t("Stop recording")}
                </button>
              )}
            </div>
          </div>

          <div className="notice" role="status">{t(notice)}</div>

          {previewUrl && previewBlob && (
            <div className="preview">
              <div className="eyebrow">{t("Review your take")}</div>
              <audio controls src={previewUrl} />
              <div className="preview-actions">
                <button className="btn accent" type="button" onClick={saveRecording} disabled={saving}>
                  {saving ? t("Saving to Drive…") : t("Save to Google Drive")}
                </button>
                <button
                  className="btn small"
                  type="button"
                  onClick={() => {
                    clearPreview();
                    setNotice("Recording discarded.");
                  }}
                  disabled={saving}
                >
                  {t("Discard take")}
                </button>
              </div>
            </div>
          )}
        </div>
      </section>

    </main>
  );
}
