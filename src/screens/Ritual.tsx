import { useEffect, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import type { BriefingSections } from "../../shared/types";
import { api } from "../api";

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

export function Ritual({ slug }: { slug: string }) {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [nudge, setNudge] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sealed, setSealed] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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

  const current = STEPS[step];
  const value = answers[current?.key] ?? "";

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
    if (step < STEPS.length - 1) {
      setStep(step + 1);
    } else {
      void seal(answers);
    }
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      advance();
    } else if (event.key === "Escape" && step > 0) {
      event.preventDefault();
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

        <h1 className="ritual-prompt">{current.prompt}</h1>
        <p className="ritual-hint">
          {current.hint}
          {!current.required && " Press Enter to skip."}
        </p>

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
          <span><kbd>Enter</kbd> {step === STEPS.length - 1 ? "seal the letter" : "next"}</span>
          <span><kbd>Shift</kbd>+<kbd>Enter</kbd> new line</span>
          {step > 0 && <span><kbd>Esc</kbd> back</span>}
        </div>
      </div>
    </div>
  );
}
