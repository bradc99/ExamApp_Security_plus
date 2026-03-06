"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function HomePage() {
  const router = useRouter();
  const [count, setCount] = useState(20);
  const [mode, setMode] = useState<"EXAM" | "PRACTICE">("EXAM");
  const [msg, setMsg] = useState("");

  async function start() {
    setMsg("Creating exam...");
    const res = await fetch("/api/exam/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode, count }),
    });
    const text = await res.text();
	const data = text ? JSON.parse(text) : {};
    if (!res.ok) {
      setMsg(`Error: ${data.error ?? "Failed"}`);
      return;
    }
    router.push(`/attempt/${data.attemptId}`);
  }

  return (
    <div style={{ padding: 24, maxWidth: 720 }}>
      <h1>Exam App (Local)</h1>
      <p>Upload CSV at <a href="/upload">/upload</a></p>

      <div style={{ marginTop: 16 }}>
        <label>
          Mode:{" "}
          <select value={mode} onChange={(e) => setMode(e.target.value as any)}>
            <option value="EXAM">EXAM (no feedback until end)</option>
            <option value="PRACTICE">PRACTICE (instant feedback)</option>
          </select>
        </label>
      </div>

      <div style={{ marginTop: 12 }}>
        <label>
          Question count:{" "}
          <input
            type="number"
            value={count}
            min={1}
            max={200}
            onChange={(e) => setCount(Number(e.target.value))}
          />
        </label>
      </div>

      <button style={{ marginTop: 16 }} onClick={start}>
        Start
      </button>

      {msg && <p style={{ marginTop: 12 }}>{msg}</p>}
    </div>
  );
}