import { useEffect, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import type { Briefing, BriefingSections } from "../../shared/types";
import { api } from "../api";
import { writtenAgo } from "../time";
import { firstLine } from "../ui";

interface Step {
  key: keyof BriefingSections;
  prompt: string;
  hint: string;
  required: boolean;
}

const STEPS: Step[] = [
  {
    key: "standNow",
    prompt: "Where do things stand?",
    hint: "What's true right now — what works, what's done, what's in motion.",
    required: true,
  },
  {
    key: "why",
    prompt: "Why?",
    hint: "The goal, and why recent decisions went the way they did.",
    required: false,
  },
  {
    key: "openQuestions",
    prompt: "What's still open?",
    hint: "Uncertainties, unresolved questions, things you don't trust yet.",
    required: false,
  },
  {
    key: "nextMove",
    prompt: "What's the very next move?",
    hint: "The single smallest action that restarts momentum. Just one.",
    required: true,
  },
  {
    key: "ignore",
    prompt: "What should future-you ignore?",
    hint: "Dead ends and red herrings — things that look important but aren't.",
    required: false,
  },
  {
    key: "letter",
    prompt: "A line to future you?",
    hint: "However you'd sign off a letter. This one's just for morale.",
    required: false,
  },
];

const RITUAL_SECONDS = 60;

interface Draft {
  step: number;
  answers: Record<string, string>;
}

function loadDraft(key: string): Draft | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const draft = JSON.parse(raw);
    if (typeof draft.step !== "number" || typeof draft.answers !== "object")
      return null;
    return draft;
  } catch {
    return null;
  }
}

export function Ritual({ slug }: { slug: string }) {
  const draftKey = `reentry:draft:${slug}`;
  const [draft] = useState(() => loadDraft(draftKey));
  const [step, setStep] = useState(draft?.step ?? 0);
  const [answers, setAnswers] = useState<Record<string, string>>(
    draft?.answers ?? {}
  );
  const [nudge, setNudge] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sealed, setSealed] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [previous, setPrevious] = useState<Briefing | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // The last letter echoes into this one: past next-move while you describe
  // the present, past open questions while you list the new ones.
  useEffect(() => {
    api.getProject(slug).then(
      (detail) => setPrevious(detail.latest),
      () => setPrevious(null)
    );
  }, [slug]);

  useEffect(() => {
    const started = Date.now();
    const tick = setInterval(
      () => setElapsed((Date.now() - started) / 1000),
      500
    );
    return () => clearInterval(tick);
  }, []);

  useEffect(() => {
    textareaRef.current?.focus();
    setNudge(false);
  }, [step]);

  // Keep an unsent draft around so a stray navigation or reload loses nothing.
  useEffect(() => {
    if (Object.values(answers).some((a) => a.trim() !== "")) {
      localStorage.setItem(draftKey, JSON.stringify({ step, answers }));
    }
  }, [draftKey, step, answers]);

  const isReview = step === STEPS.length;
  const current = STEPS[Math.min(step, STEPS.length - 1)];
  const value = answers[current.key] ?? "";

  async function seal(finalAnswers: Record<string, string>) {
    try {
      await api.createBriefing(slug, {
        standNow: finalAnswers.standNow ?? "",
        why: finalAnswers.why ?? "",
        openQuestions: finalAnswers.openQuestions ?? "",
        nextMove: finalAnswers.nextMove ?? "",
        ignore: finalAnswers.ignore ?? "",
        letter: finalAnswers.letter ?? "",
      });
      localStorage.removeItem(draftKey);
      setSealed(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  function advance() {
    if (current.required && value.trim() === "") {
      setNudge(true);
      return;
    }
    setStep(step + 1); // past the last question lands on the review
  }

  // Keyboard for the review screen: Enter seals, Esc goes back.
  useEffect(() => {
    if (!isReview || sealed) return;
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.target instanceof HTMLTextAreaElement) return;
      if (event.key === "Enter") {
        event.preventDefault();
        void seal(answers);
      } else if (event.key === "Escape") {
        event.preventDefault();
        setStep(STEPS.length - 1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      // Don't let this same keystroke reach the review screen's window
      // listener the moment it mounts — it would seal the letter instantly.
      event.stopPropagation();
      advance();
    } else if (event.key === "Escape" && step > 0) {
      event.preventDefault();
      event.stopPropagation();
      setStep(step - 1);
    }
  }

  if (sealed) {
    return (
      <div className="page ritual sealed">
        <div className="seal-mark">✉</div>
        <h1 className="seal-title">Letter sealed.</h1>
        <p className="seal-sub">See you when you get back.</p>
        <a className="button" href="#/">Back to your projects</a>
      </div>
    );
  }

  if (isReview) {
    return (
      <div className="page ritual">
        <a className="back" href={`#/p/${encodeURIComponent(slug)}`}>
          ← Never mind, I'm staying
        </a>
        <div className="ritual-body">
          <h1 className="ritual-prompt">Read it back.</h1>
          <p className="ritual-hint">
            Click any part to change it. This is what future-you receives.
          </p>
          <div className="review">
            {STEPS.map((s, i) => {
              const answer = (answers[s.key] ?? "").trim();
              if (!answer) return null;
              return (
                <button
                  key={s.key}
                  type="button"
                  className="review-item"
                  onClick={() => setStep(i)}
                >
                  <span className="review-label">{s.prompt}</span>
                  <span className="review-answer">{answer}</span>
                </button>
              );
            })}
          </div>
          {error && <p className="error">{error}</p>}
          <div className="review-actions">
            <button className="button primary" onClick={() => void seal(answers)}>
              Seal the letter
            </button>
            <div className="ritual-keys">
              <span><kbd>Enter</kbd> seal</span>
              <span><kbd>Esc</kbd> back</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page ritual">
      <div
        className="ritual-timer"
        style={{ width: `${Math.min(elapsed / RITUAL_SECONDS, 1) * 100}%` }}
      />
      <a className="back" href={`#/p/${encodeURIComponent(slug)}`}>
        ← Never mind, I'm staying
      </a>

      <div className="ritual-body">
        <div className="ritual-dots" aria-label={`Step ${step + 1} of ${STEPS.length}`}>
          {STEPS.map((s, i) => (
            <span
              key={s.key}
              className={`dot${i === step ? " current" : ""}${i < step ? " done" : ""}`}
            />
          ))}
        </div>

        {draft && step === draft.step && (
          <p className="draft-note">Picked up where you left off.</p>
        )}
        <h1 className="ritual-prompt">{current.prompt}</h1>
        <p className="ritual-hint">
          {current.hint}
          {!current.required && " Press Enter to skip."}
        </p>

        {previous && current.key === "standNow" && previous.sections.nextMove && (
          <blockquote className="echo">
            <span className="echo-label">
              {writtenAgo(previous.writtenAt)}, the next move was
            </span>
            “{firstLine(previous.sections.nextMove)}”
          </blockquote>
        )}
        {previous &&
          current.key === "openQuestions" &&
          previous.sections.openQuestions && (
            <blockquote className="echo">
              <span className="echo-label">
                {writtenAgo(previous.writtenAt)}, you wondered
              </span>
              “{firstLine(previous.sections.openQuestions)}”
            </blockquote>
          )}

        <textarea
          ref={textareaRef}
          value={value}
          rows={4}
          onChange={(e) =>
            setAnswers({ ...answers, [current.key]: e.target.value })
          }
          onKeyDown={onKeyDown}
        />
        {nudge && (
          <p className="nudge">Future-you really does need this one.</p>
        )}
        {error && <p className="error">{error}</p>}

        <div className="ritual-keys">
          <span><kbd>Enter</kbd> {step === STEPS.length - 1 ? "read it back" : "next"}</span>
          <span><kbd>Shift</kbd>+<kbd>Enter</kbd> new line</span>
          {step > 0 && <span><kbd>Esc</kbd> back</span>}
        </div>
      </div>
    </div>
  );
}
