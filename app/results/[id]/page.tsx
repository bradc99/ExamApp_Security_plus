"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";

function formatAnswer(q: any) {
  if (q.type === "PBQ") {
    if (q.pbqText) return q.pbqText;
    return "(PBQ answer not submitted)";
  }

  if (q.type === "CODE_PY_SCRIPT") {
    return "(code submission shown later)";
  }

  const choices: Array<{ id: string; text: string }> = Array.isArray(q.choices)
    ? q.choices
    : [];
  const selectedIds: string[] = Array.isArray(q.selectedChoiceIds)
    ? q.selectedChoiceIds
    : [];

  if (!selectedIds.length) return "(no answer)";

  const selectedTexts = selectedIds
    .map((id) => choices.find((c) => c.id === id)?.text)
    .filter(Boolean) as string[];

  if (!selectedTexts.length) return "(answer saved, but choices not found)";

  return q.type === "MULTI" ? selectedTexts.join(", ") : selectedTexts[0];
}

export default function ResultsPage() {
  const params = useParams<{ id: string }>();
  const attemptId = params.id;

  const [data, setData] = useState<any>(null);
  const [msg, setMsg] = useState("Loading...");

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/attempt/${attemptId}`, {
          cache: "no-store",
        });
        const text = await res.text();
        const d = text ? JSON.parse(text) : {};

        if (!res.ok) {
          setMsg(`Error: ${d.error ?? "Failed"}`);
          return;
        }

        setData(d);
        setMsg("");
      } catch (err: any) {
        setMsg(`Error: ${err?.message || "Failed to load results"}`);
      }
    })();
  }, [attemptId]);

  const questions = useMemo(() => (data?.questions ?? []) as any[], [data]);

  const correctCount = useMemo(
    () => questions.filter((q) => q.isCorrect === true).length,
    [questions],
  );

  const gradedCount = useMemo(
    () =>
      questions.filter((q) => q.isCorrect === true || q.isCorrect === false)
        .length,
    [questions],
  );

  if (!data) return <div className="p-6">{msg}</div>;

  return (
    <main className="mx-auto max-w-5xl p-6">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold">Results</h1>
          <p className="text-sm text-gray-600">Attempt ID: {attemptId}</p>
        </div>

        <a href="/" className="rounded border px-4 py-2">
          Start another
        </a>
      </div>

      <section className="mb-6 rounded border p-5">
        <div className="grid gap-4 sm:grid-cols-4">
          <div>
            <div className="text-sm text-gray-500">Mode</div>
            <div className="text-lg font-medium">{data.mode}</div>
          </div>

          <div>
            <div className="text-sm text-gray-500">Finished</div>
            <div className="text-lg font-medium">
              {data.finishedAt ? "Yes" : "No"}
            </div>
          </div>

          <div>
            <div className="text-sm text-gray-500">Score</div>
            <div className="text-lg font-medium">{data.score ?? "N/A"}</div>
          </div>

          <div>
            <div className="text-sm text-gray-500">Correct</div>
            <div className="text-lg font-medium">
              {correctCount} / {gradedCount || questions.length}
            </div>
          </div>
        </div>

        {typeof data.timeTakenS !== "undefined" && (
          <div className="mt-4 text-sm text-gray-600">
            Time taken: <b>{data.timeTakenS ?? 0}</b> seconds
          </div>
        )}
      </section>

      <section className="space-y-4">
        {questions.map((q: any, idx: number) => (
          <div key={q.attemptAnswerId} className="rounded border p-5">
            <div className="mb-2 flex items-center justify-between gap-4">
              <h2 className="text-lg font-medium">
                Q{idx + 1}. {q.prompt}
              </h2>

              <div className="text-sm">
                {q.isCorrect === true && (
                  <span className="rounded border px-2 py-1">Correct</span>
                )}
                {q.isCorrect === false && (
                  <span className="rounded border px-2 py-1">Incorrect</span>
                )}
                {q.isCorrect === null && (
                  <span className="rounded border px-2 py-1">Not graded</span>
                )}
              </div>
            </div>

            <div className="mb-3 text-sm text-gray-500">
              {q.domain ? `Domain: ${q.domain}` : ""}
              {q.difficulty ? ` | Difficulty: ${q.difficulty}` : ""}
              {q.type ? ` | Type: ${q.type}` : ""}
            </div>

            {(q.type === "MCQ" || q.type === "MULTI") &&
              Array.isArray(q.choices) && (
                <div className="mb-3 space-y-2">
                  {q.choices.map((choice: any) => {
                    const selected = Array.isArray(q.selectedChoiceIds)
                      ? q.selectedChoiceIds.includes(choice.id)
                      : false;

                    return (
                      <div
                        key={choice.id}
                        className={`rounded border px-4 py-2 ${
                          selected ? "font-semibold" : ""
                        }`}
                      >
                        <span className="mr-2">{choice.label ?? ""}</span>
                        {choice.text}
                        {selected ? " (Selected)" : ""}
                      </div>
                    );
                  })}
                </div>
              )}

            <div className="mb-3">
              <span className="font-medium">Your answer:</span>{" "}
              {formatAnswer(q)}
            </div>

            {q.type === "PBQ" && q.pbqItems?.length > 0 && (
              <div className="mb-3">
                <div className="mb-1 font-medium">PBQ Items</div>
                <ul className="list-disc pl-6">
                  {q.pbqItems.map((item: any, i: number) => (
                    <li key={i}>{item.text}</li>
                  ))}
                </ul>
              </div>
            )}

            {q.explanation ? (
              <div className="mt-4 rounded border p-4">
                <div className="mb-1 font-medium">Explanation</div>
                <div>{q.explanation}</div>
              </div>
            ) : null}
          </div>
        ))}
      </section>
    </main>
  );
}
