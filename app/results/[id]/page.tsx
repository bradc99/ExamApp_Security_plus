"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";

function formatAnswer(q: any) {
  // PBQ (if you store free text)
  if (q.type === "PBQ") {
    if (q.pbqText) return q.pbqText;
    return "(PBQ answer not submitted)";
  }

  // CODE (if later)
  if (q.type === "CODE_PY_SCRIPT") {
    return "(code submission shown later)";
  }

  // MCQ / MULTI: selected choice IDs -> text
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

  // MULTI -> show list, MCQ -> show single
  return q.type === "MULTI" ? selectedTexts.join(", ") : selectedTexts[0];
}

export default function ResultsPage() {
  const params = useParams<{ id: string }>();
  const attemptId = params.id;

  const [data, setData] = useState<any>(null);
  const [msg, setMsg] = useState("Loading...");

  useEffect(() => {
    (async () => {
      const res = await fetch(`/api/attempt/${attemptId}`);
      const text = await res.text();
      const d = text ? JSON.parse(text) : {};

      if (!res.ok) {
        setMsg(`Error: ${d.error ?? "Failed"}`);
        return;
      }
      setData(d);
      setMsg("");
    })();
  }, [attemptId]);

  const questions = useMemo(() => (data?.questions ?? []) as any[], [data]);

  if (!data) return <div style={{ padding: 24 }}>{msg}</div>;

  return (
    <div style={{ padding: 24, maxWidth: 900 }}>
      <h1>Results</h1>
      <p>
        Mode: <b>{data.mode}</b>
      </p>
      <p>
        Finished: <b>{data.finishedAt ? "Yes" : "No"}</b>
      </p>
      <p>
        Score: <b>{data.score ?? "N/A"}</b>
      </p>

      <hr style={{ margin: "16px 0" }} />

      <h3>Questions</h3>
      <ol>
        {questions.map((q: any) => (
          <li key={q.attemptAnswerId} style={{ marginBottom: 10 }}>
            <div>
              <b>{q.prompt}</b>
            </div>

            <div>Your answer: {formatAnswer(q)}</div>

            {(q.type === "MCQ" || q.type === "MULTI") && (
              <div>
                Marked correct:{" "}
                {q.isCorrect === true
                  ? "Yes"
                  : q.isCorrect === false
                  ? "No"
                  : "N/A"}
              </div>
            )}
          </li>
        ))}
      </ol>

      <p>
        <a href="/">Start another</a>
      </p>
    </div>
  );
}
