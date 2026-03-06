"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";

type Choice = { id: string; text: string; order: number };

type Q = {
  attemptAnswerId: string;
  questionId: string;
  isCorrect?: boolean | null;
  type: "MCQ" | "MULTI" | "PBQ" | "CODE_PY_SCRIPT";
  domain?: string | null;
  difficulty?: string | null;
  prompt: string;
  explanation?: string | null;
  tags?: string | null;

  choices: Choice[];
  selectedChoiceIds: string[];

  pbqItems?: { text: string; order: number }[];
  pbqText?: string | null;
};

export default function AttemptPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const attemptId = params.id;

  const [mode, setMode] = useState<"EXAM" | "PRACTICE">("EXAM");
  const [finishedAt, setFinishedAt] = useState<string | null>(null);
  const [score, setScore] = useState<number | null>(null);

  const [questions, setQuestions] = useState<Q[]>([]);
  const [idx, setIdx] = useState(0);
  const [msg, setMsg] = useState("");

  const current = useMemo(() => questions[idx], [questions, idx]);

  async function load() {
    setMsg("Loading...");
    const res = await fetch(`/api/attempt/${attemptId}`);
    const text = await res.text();
    const data = text ? JSON.parse(text) : {};

    if (!res.ok || !data.ok) {
      setMsg(`Error: ${data.error ?? "Failed to load attempt"}`);
      return;
    }

    setMode(data.mode);
    setFinishedAt(data.finishedAt ?? null);
    setScore(data.score ?? null);
    setQuestions(data.questions ?? []);
    setMsg("");
  }

  useEffect(() => {
    if (!attemptId) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attemptId]);

  async function saveChoices(nextSelectedIds: string[]) {
    if (!current) return;

    setMsg("Saving...");
    const res = await fetch("/api/attempt/answer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        attemptAnswerId: current.attemptAnswerId,
        selectedChoiceIds: nextSelectedIds,
      }),
    });

    const text = await res.text();
    const data = text ? JSON.parse(text) : {};

    if (!res.ok || !data.ok) {
      setMsg(`Error: ${data.error ?? "Save failed"}`);
      return;
    }

    setQuestions((prev) =>
      prev.map((q, i) =>
        i === idx
          ? {
              ...q,
              selectedChoiceIds: nextSelectedIds,
              isCorrect: data.isCorrect ?? q.isCorrect, // PRACTICE returns true/false, EXAM returns null
            }
          : q
      )
    );

    setMsg(mode === "PRACTICE" ? "Saved" : "Saved (no feedback in exam mode)");
  }

  async function finishExam() {
    setMsg("Finishing exam...");
    const res = await fetch("/api/exam/finish", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ attemptId }),
    });

    const text = await res.text();
    const data = text ? JSON.parse(text) : {};

    if (!res.ok || !data.ok) {
      setMsg(`Error: ${data.error ?? "Finish failed"}`);
      return;
    }

    router.push(`/results/${attemptId}`);
  }

  if (!questions.length) {
    return <div style={{ padding: 24 }}>{msg || "Loading..."}</div>;
  }

  if (finishedAt) {
    return (
      <div style={{ padding: 24 }}>
        <h1>Attempt already finished</h1>
        <p>Score: {score ?? "N/A"}</p>
        <a href={`/results/${attemptId}`}>View results</a>
      </div>
    );
  }

  return (
    <div style={{ padding: 24, maxWidth: 900 }}>
      <div
        style={{ display: "flex", justifyContent: "space-between", gap: 12 }}
      >
        <div>
          <h2 style={{ margin: 0 }}>Attempt</h2>
          <p style={{ margin: "6px 0" }}>
            Mode: <b>{mode}</b> • Question {idx + 1} / {questions.length}
          </p>
        </div>
        <button onClick={finishExam}>Finish Exam</button>
      </div>

      <hr style={{ margin: "16px 0" }} />

      <div>
        <p style={{ margin: "0 0 8px 0" }}>
          <b>{current.domain ?? "No domain"}</b>{" "}
          {current.difficulty ? `• ${current.difficulty}` : ""}
        </p>

        <h3 style={{ marginTop: 0 }}>{current.prompt}</h3>

        {(current.type === "MCQ" || current.type === "MULTI") && (
          <Choices
            type={current.type}
            choices={current.choices}
            selectedChoiceIds={current.selectedChoiceIds}
            onChange={saveChoices}
          />
        )}

        {current.type === "PBQ" && (
          <div>
            <p>PBQ UI coming next. (We imported PBQ items)</p>
            {current.pbqItems?.length ? (
              <ul>
                {current.pbqItems.map((x) => (
                  <li key={x.order}>{x.text}</li>
                ))}
              </ul>
            ) : (
              <p>No PBQ items.</p>
            )}
          </div>
        )}

        {current.type === "CODE_PY_SCRIPT" && <p>Code lab UI coming next.</p>}

        {mode === "PRACTICE" && typeof current.isCorrect === "boolean" && (
          <p>
            Result:{" "}
            <b style={{ color: current.isCorrect ? "green" : "crimson" }}>
              {current.isCorrect ? "Correct" : "Incorrect"}
            </b>
          </p>
        )}

        {msg && <p style={{ marginTop: 12 }}>{msg}</p>}
      </div>

      <hr style={{ margin: "16px 0" }} />

      <div style={{ display: "flex", gap: 10 }}>
        <button
          onClick={() => setIdx((v) => Math.max(0, v - 1))}
          disabled={idx === 0}
        >
          Prev
        </button>
        <button
          onClick={() => setIdx((v) => Math.min(questions.length - 1, v + 1))}
          disabled={idx === questions.length - 1}
        >
          Next
        </button>
      </div>
    </div>
  );
}

function Choices(props: {
  type: "MCQ" | "MULTI";
  choices: { id: string; text: string }[];
  selectedChoiceIds: string[];
  onChange: (ids: string[]) => void;
}) {
  const { type, choices, selectedChoiceIds, onChange } = props;

  if (type === "MCQ") {
    const selected = selectedChoiceIds?.[0] ?? "";
    return (
      <div style={{ display: "grid", gap: 8 }}>
        {choices.map((c) => (
          <label
            key={c.id}
            style={{ display: "flex", gap: 8, alignItems: "center" }}
          >
            <input
              type="radio"
              name="mcq"
              checked={selected === c.id}
              onChange={() => onChange([c.id])}
            />
            {c.text}
          </label>
        ))}
      </div>
    );
  }

  // MULTI
  const selected = Array.isArray(selectedChoiceIds) ? selectedChoiceIds : [];
  function toggle(choiceId: string) {
    const exists = selected.includes(choiceId);
    const next = exists
      ? selected.filter((x) => x !== choiceId)
      : [...selected, choiceId];
    onChange(next);
  }

  return (
    <div style={{ display: "grid", gap: 8 }}>
      {choices.map((c) => (
        <label
          key={c.id}
          style={{ display: "flex", gap: 8, alignItems: "center" }}
        >
          <input
            type="checkbox"
            checked={selected.includes(c.id)}
            onChange={() => toggle(c.id)}
          />
          {c.text}
        </label>
      ))}
    </div>
  );
}
