"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";

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
  startedAt?: string;
  settings?: {
    durationMin?: number;
    [key: string]: any;
  };
  questions: Question[];
  timeTakenS?: number | null;
};

function formatTime(totalSeconds: number) {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

export default function ExamAttemptPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [payload, setPayload] = useState<AttemptPayload | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [error, setError] = useState("");
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);
  const [autoFinishing, setAutoFinishing] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [pbqDraft, setPbqDraft] = useState("");
  const [pbqSaving, setPbqSaving] = useState(false);

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

  useEffect(() => {
    setPbqDraft(currentQuestion?.pbqText ?? "");
  }, [currentQuestion?.attemptAnswerId, currentQuestion?.pbqText]);

  const unansweredCount = useMemo(() => {
    if (!payload) return 0;

    return payload.questions.filter((q) => {
      const answered =
        q.selectedChoiceIds.length > 0 ||
        (q.pbqText && q.pbqText.trim().length > 0);
      return !answered;
    }).length;
  }, [payload]);

  const isFinished = Boolean(payload?.finishedAt);
  const isPracticeMode =
    String(payload?.mode ?? "").trim().toUpperCase() === "PRACTICE";

  useEffect(() => {
    if (!payload?.startedAt || payload?.finishedAt) {
      setRemainingSeconds(null);
      return;
    }

    const durationMin = Number(payload?.settings?.durationMin ?? 0);

    if (!durationMin || durationMin < 1) {
      setRemainingSeconds(null);
      return;
    }

    const startedAtMs = new Date(payload.startedAt).getTime();
    const durationMs = durationMin * 60 * 1000;

    const tick = () => {
      const now = Date.now();
      const endAt = startedAtMs + durationMs;
      const remaining = Math.max(0, Math.floor((endAt - now) / 1000));
      setRemainingSeconds(remaining);
    };

    tick();
    const interval = setInterval(tick, 1000);

    return () => clearInterval(interval);
  }, [payload?.startedAt, payload?.finishedAt, payload?.settings?.durationMin]);

  useEffect(() => {
    if (!payload || payload.finishedAt) return;
    if (remainingSeconds === null) return;
    if (remainingSeconds > 0) return;
    if (autoFinishing) return;

    setAutoFinishing(true);

    (async () => {
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

        if (!res.ok || !data.ok) {
          throw new Error(data.error || "Failed to auto-finish exam");
        }

        router.push(`/results/${payload.attemptId}`);
      } catch (err: any) {
        setError(err?.message || "Failed to auto-finish exam");
        setAutoFinishing(false);
      }
    })();
  }, [remainingSeconds, payload, autoFinishing, router]);

  async function saveAnswer(nextSelectedIds: string[], nextPbqText = "") {
    if (!currentQuestion || !payload || payload.finishedAt) return;

    const res = await fetch("/api/attempt/answer", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        attemptAnswerId: currentQuestion.attemptAnswerId,
        selectedChoiceIds: nextSelectedIds,
        pbqText: nextPbqText,
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
        pbqText: nextPbqText,
        isCorrect:
          typeof data.isCorrect === "boolean"
            ? data.isCorrect
            : questions[currentIndex].isCorrect,
      };

      return { ...prev, questions };
    });
  }

  async function handleChoiceClick(choiceId: string) {
    if (!currentQuestion) return;

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

  async function handleFinish() {
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

      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Failed to finish exam");
      }

      router.push(`/results/${payload.attemptId}`);
    } catch (err: any) {
      setError(err?.message || "Failed to finish exam");
    } finally {
      setSubmitting(false);
      setShowReviewModal(false);
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
            Mode: {payload.mode} | Question {currentIndex + 1} of{" "}
            {payload.questions.length}
          </p>
        </div>

        <div className="text-right">
          {remainingSeconds !== null && !isFinished ? (
            <div className="mb-2 text-sm font-medium">
              Time Left: {formatTime(remainingSeconds)}
            </div>
          ) : null}

          {isFinished ? (
            <div className="text-sm font-medium">
              Score: {payload.score ?? 0}%
            </div>
          ) : (
            <button
              onClick={() => setShowReviewModal(true)}
              disabled={submitting || autoFinishing}
              className="rounded border px-4 py-2"
            >
              {submitting
                ? "Finishing..."
                : autoFinishing
                ? "Auto-finishing..."
                : "Finish Exam"}
            </button>
          )}
        </div>
      </div>

      {error ? <div className="mb-4 text-red-600">{error}</div> : null}

      <div className="mb-4 flex flex-wrap gap-2">
        {payload.questions.map((q, idx) => {
          const answered =
            q.selectedChoiceIds.length > 0 ||
            (q.pbqText && q.pbqText.trim().length > 0);

          return (
            <button
              key={q.attemptAnswerId}
              onClick={() => setCurrentIndex(idx)}
              className={`rounded border px-3 py-1 text-sm ${
                idx === currentIndex ? "border-black font-semibold" : ""
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
          {currentQuestion.difficulty
            ? ` | Difficulty: ${currentQuestion.difficulty}`
            : null}
          {currentQuestion.type ? ` | Type: ${currentQuestion.type}` : null}
        </div>

        <h2 className="mb-4 text-xl font-medium">{currentQuestion.prompt}</h2>

        {(currentQuestion.type === "MCQ" || currentQuestion.type === "MULTI") && (
          <div className="space-y-3">
            {currentQuestion.choices.map((choice) => {
              const selected = currentQuestion.selectedChoiceIds.includes(
                choice.id
              );

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

        {isPracticeMode &&
          !isFinished &&
          (currentQuestion.type === "MCQ" ||
            currentQuestion.type === "MULTI") &&
          currentQuestion.selectedChoiceIds.length > 0 &&
          currentQuestion.isCorrect !== null && (
            <div className="mt-4 rounded border p-4">
              <div className="font-medium">
                {currentQuestion.isCorrect ? "Correct" : "Incorrect"}
              </div>

              {currentQuestion.explanation ? (
                <div className="mt-2 text-sm text-gray-700">
                  {currentQuestion.explanation}
                </div>
              ) : null}
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
              value={pbqDraft}
              disabled={isFinished}
              onChange={(e) => setPbqDraft(e.target.value)}
              onBlur={async () => {
                try {
                  setPbqSaving(true);
                  await saveAnswer(
                    currentQuestion.selectedChoiceIds,
                    pbqDraft
                  );
                } catch (err: any) {
                  setError(err?.message || "Failed to save PBQ answer");
                } finally {
                  setPbqSaving(false);
                }
              }}
            />

            {!isFinished && (
              <div className="mt-2 text-sm text-gray-500">
                {pbqSaving
                  ? "Saving..."
                  : "Your PBQ answer saves when you leave the box."}
              </div>
            )}
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
            setCurrentIndex((i) =>
              Math.min(payload.questions.length - 1, i + 1)
            )
          }
          disabled={currentIndex === payload.questions.length - 1}
          className="rounded border px-4 py-2"
        >
          Next
        </button>
      </div>

      {showReviewModal && !isFinished && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded border bg-white p-5">
            <h2 className="mb-3 text-xl font-semibold">Review Before Submit</h2>

            <p className="mb-2">
              Total questions: <b>{payload.questions.length}</b>
            </p>
            <p className="mb-4">
              Unanswered questions: <b>{unansweredCount}</b>
            </p>

            <div className="mb-4 max-h-48 overflow-auto rounded border p-3">
              <div className="flex flex-wrap gap-2">
                {payload.questions.map((q, idx) => {
                  const answered =
                    q.selectedChoiceIds.length > 0 ||
                    (q.pbqText && q.pbqText.trim().length > 0);

                  return (
                    <button
                      key={q.attemptAnswerId}
                      onClick={() => {
                        setCurrentIndex(idx);
                        setShowReviewModal(false);
                      }}
                      className="rounded border px-3 py-1 text-sm"
                    >
                      Q{idx + 1} {answered ? "✓" : "•"}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowReviewModal(false)}
                className="rounded border px-4 py-2"
              >
                Cancel
              </button>

              <button
                onClick={handleFinish}
                disabled={submitting}
                className="rounded border px-4 py-2"
              >
                {submitting ? "Finishing..." : "Confirm Submit"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}