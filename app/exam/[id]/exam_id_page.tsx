"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";

type Choice = {
  id: string;
  label?: string | null;
  text: string;
  order: number;
};

type Question = {
  attemptAnswerId: string;
  questionId: string;
  isCorrect: boolean | null;
  type: string;
  domain?: string | null;
  difficulty?: string | null;
  prompt: string;
  explanation?: string | null;
  tags?: string | null;
  choices: Choice[];
  selectedChoiceIds: string[];
  pbqItems: { text: string; order: number }[];
  pbqText: string;
};

type AttemptPayload = {
  ok: boolean;
  attemptId: string;
  mode: string;
  score: number | null;
  finishedAt: string | null;
  startedAt: string;
  durationMin: number;
  remainingSeconds: number | null;
  expiresAt: string | null;
  questions: Question[];
};

function formatSeconds(totalSeconds: number) {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

export default function ExamAttemptPage() {
  const params = useParams<{ id: string }>();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [payload, setPayload] = useState<AttemptPayload | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [error, setError] = useState("");
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);

  const autoFinishedRef = useRef(false);

  async function loadAttempt() {
    setLoading(true);
    setError("");

    try {
      const res = await fetch(`/api/attempt/${params.id}`, {
        cache: "no-store",
      });
      const data = await res.json();

      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Failed to load attempt");
      }

      setPayload(data);
      setRemainingSeconds(data.remainingSeconds ?? null);
    } catch (err: any) {
      setError(err?.message || "Failed to load attempt");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadAttempt();
  }, [params.id]);

  const currentQuestion = useMemo(() => {
    return payload?.questions?.[currentIndex] ?? null;
  }, [payload, currentIndex]);

  const isFinished = Boolean(payload?.finishedAt);

  useEffect(() => {
    if (!payload || isFinished || remainingSeconds === null) return;

    const interval = setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev === null) return prev;
        return Math.max(0, prev - 1);
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [payload, isFinished, remainingSeconds]);

  useEffect(() => {
    if (!payload || isFinished) return;
    if (remainingSeconds !== 0) return;
    if (autoFinishedRef.current) return;

    autoFinishedRef.current = true;
    void handleFinish(true);
  }, [remainingSeconds, payload, isFinished]);

  async function saveAnswer(nextSelectedIds: string[], pbqText = "") {
    if (!currentQuestion || !payload || payload.finishedAt) return;

    const res = await fetch("/api/attempt/answer", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        attemptAnswerId: currentQuestion.attemptAnswerId,
        selectedChoiceIds: nextSelectedIds,
        pbqText,
      }),
    });

    const data = await res.json();

    if (!res.ok || !data.ok) {
      throw new Error(data.error || "Failed to save answer");
    }

    setPayload((prev) => {
      if (!prev) return prev;

      const questions = [...prev.questions];
      questions[currentIndex] = {
        ...questions[currentIndex],
        selectedChoiceIds: nextSelectedIds,
        pbqText,
        isCorrect: data.isCorrect ?? questions[currentIndex].isCorrect,
      };

      return { ...prev, questions };
    });
  }

  async function handleChoiceClick(choiceId: string) {
    if (!currentQuestion || isFinished) return;

    try {
      if (currentQuestion.type === "MCQ") {
        await saveAnswer([choiceId], currentQuestion.pbqText || "");
        return;
      }

      if (currentQuestion.type === "MULTI") {
        const exists = currentQuestion.selectedChoiceIds.includes(choiceId);
        const nextSelectedIds = exists
          ? currentQuestion.selectedChoiceIds.filter((id) => id !== choiceId)
          : [...currentQuestion.selectedChoiceIds, choiceId];

        await saveAnswer(nextSelectedIds, currentQuestion.pbqText || "");
      }
    } catch (err: any) {
      setError(err?.message || "Failed to save answer");
    }
  }

  async function handleFinish(isAuto = false) {
  if (!payload) return;

  setSubmitting(true);
  setError("");

  try {
    const res = await fetch("/api/exam/finish", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        attemptId: payload.attemptId,
      }),
    });

    const data = await res.json();
    console.log("finish response:", data);

    if (!res.ok || !data.ok) {
      throw new Error(data.error || "Failed to finish exam");
    }

    const target = isAuto
      ? `/results/${payload.attemptId}?auto=1`
      : `/results/${payload.attemptId}`;

    console.log("redirecting to:", target);
    router.push(target);
  } catch (err: any) {
    console.error("handleFinish error:", err);
    setError(err?.message || "Failed to finish exam");
  } finally {
    setSubmitting(false);
  }
}

  if (loading) {
    return <div className="p-6">Loading attempt...</div>;
  }

  if (error && !payload) {
    return <div className="p-6 text-red-600">{error}</div>;
  }

  if (!payload || !currentQuestion) {
    return <div className="p-6">No attempt data found.</div>;
  }

  return (
    <main className="mx-auto max-w-4xl p-6">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Exam Attempt</h1>
          <p className="text-sm text-gray-600">
            Mode: {payload.mode} | Question {currentIndex + 1} of {payload.questions.length}
          </p>
          <p className="text-sm text-gray-600">
            Duration: {payload.durationMin} min
          </p>
        </div>

        <div className="text-right">
          {remainingSeconds !== null && !isFinished ? (
            <div className="mb-2 text-lg font-semibold">
              Time Left: {formatSeconds(remainingSeconds)}
            </div>
          ) : null}

          {isFinished ? (
            <div className="text-sm font-medium">
              Score: {payload.score ?? 0}%
            </div>
          ) : (
            <button
              onClick={() => handleFinish(false)}
              disabled={submitting}
              className="rounded border px-4 py-2"
            >
              {submitting ? "Finishing..." : "Finish Exam"}
            </button>
          )}
        </div>
      </div>

      {error ? <div className="mb-4 text-red-600">{error}</div> : null}

      <div className="mb-4 flex flex-wrap gap-2">
        {payload.questions.map((q, idx) => {
          const answered =
            q.selectedChoiceIds.length > 0 || (q.pbqText && q.pbqText.trim().length > 0);

          return (
            <button
              key={q.attemptAnswerId}
              onClick={() => setCurrentIndex(idx)}
              className={`rounded border px-3 py-1 text-sm ${
                idx === currentIndex ? "font-semibold" : ""
              }`}
            >
              Q{idx + 1} {answered ? "✓" : ""}
            </button>
          );
        })}
      </div>

      <section className="rounded border p-5">
        <div className="mb-3 text-sm text-gray-500">
          {currentQuestion.domain ? `Domain: ${currentQuestion.domain}` : null}
          {currentQuestion.difficulty ? ` | Difficulty: ${currentQuestion.difficulty}` : null}
          {currentQuestion.type ? ` | Type: ${currentQuestion.type}` : null}
        </div>

        <h2 className="mb-4 text-xl font-medium">{currentQuestion.prompt}</h2>

        {(currentQuestion.type === "MCQ" || currentQuestion.type === "MULTI") && (
          <div className="space-y-3">
            {currentQuestion.choices.map((choice) => {
              const selected = currentQuestion.selectedChoiceIds.includes(choice.id);

              return (
                <button
                  key={choice.id}
                  onClick={() => handleChoiceClick(choice.id)}
                  disabled={isFinished}
                  className={`block w-full rounded border px-4 py-3 text-left ${
                    selected ? "font-semibold" : ""
                  }`}
                >
                  <span className="mr-2">{choice.label ?? ""}</span>
                  {choice.text}
                </button>
              );
            })}
          </div>
        )}

        {currentQuestion.type === "PBQ" && (
          <div>
            {currentQuestion.pbqItems.length > 0 && (
              <ul className="mb-3 list-disc pl-6">
                {currentQuestion.pbqItems.map((item) => (
                  <li key={`${item.order}-${item.text}`}>{item.text}</li>
                ))}
              </ul>
            )}

            <textarea
              className="min-h-40 w-full rounded border p-3"
              placeholder="Type your answer here..."
              defaultValue={currentQuestion.pbqText || ""}
              disabled={isFinished}
              onBlur={async (e) => {
                try {
                  await saveAnswer(
                    currentQuestion.selectedChoiceIds,
                    e.currentTarget.value
                  );
                } catch (err: any) {
                  setError(err?.message || "Failed to save PBQ answer");
                }
              }}
            />
          </div>
        )}

        {isFinished && currentQuestion.explanation ? (
          <div className="mt-6 rounded border p-4">
            <div className="mb-1 font-medium">Explanation</div>
            <div>{currentQuestion.explanation}</div>
          </div>
        ) : null}
      </section>

      <div className="mt-6 flex justify-between">
        <button
          onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
          disabled={currentIndex === 0}
          className="rounded border px-4 py-2"
        >
          Previous
        </button>

        <button
          onClick={() =>
            setCurrentIndex((i) => Math.min(payload.questions.length - 1, i + 1))
          }
          disabled={currentIndex === payload.questions.length - 1}
          className="rounded border px-4 py-2"
        >
          Next
        </button>
      </div>
    </main>
  );
}