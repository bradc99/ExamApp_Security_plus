"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function HomePage() {
  const router = useRouter();
  const [count, setCount] = useState(10);
  const [mode, setMode] = useState("EXAM");
  const [durationMin, setDurationMin] = useState(30);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function startExam() {
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/exam/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          count,
          mode,
          durationMin,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Failed to generate exam");
      }

      router.push(`/exam/${data.attemptId}`);
    } catch (err: any) {
      setError(err?.message || "Failed to start exam");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-xl p-6">
      <h1 className="mb-6 text-3xl font-semibold">Offline Exam App</h1>

      <div className="space-y-4 rounded border p-5">
        <div>
          <label className="mb-1 block text-sm font-medium">Mode</label>
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value)}
            className="w-full rounded border px-3 py-2"
          >
            <option value="EXAM">EXAM</option>
            <option value="PRACTICE">PRACTICE</option>
          </select>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Question count</label>
          <input
            type="number"
            min={1}
            value={count}
            onChange={(e) => setCount(Number(e.target.value))}
            className="w-full rounded border px-3 py-2"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Duration (minutes)</label>
          <input
            type="number"
            min={1}
            value={durationMin}
            onChange={(e) => setDurationMin(Number(e.target.value))}
            className="w-full rounded border px-3 py-2"
          />
        </div>

        <button
          onClick={startExam}
          disabled={loading}
          className="rounded border px-4 py-2"
        >
          {loading ? "Starting..." : "Start"}
        </button>

        {error ? <div className="text-red-600">{error}</div> : null}
      </div>
    </main>
  );
}