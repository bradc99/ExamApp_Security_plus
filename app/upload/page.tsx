"use client";

import { useState } from "react";

export default function UploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [msg, setMsg] = useState<string>("");

  async function onUpload() {
    if (!file) return;

    setMsg("Uploading...");
    const fd = new FormData();
    fd.append("file", file);

    const res = await fetch("/api/import-csv", {
      method: "POST",
      body: fd,
    });

    const data = await res.json();
    if (!res.ok) {
      setMsg(`Error: ${data.error ?? "Upload failed"}`);
      return;
    }
    setMsg(`Imported: ${data.imported} (from ${data.totalRows} rows)`);
  }

  return (
    <div style={{ padding: 24, maxWidth: 720 }}>
      <h1>Import Questions (CSV)</h1>
      <p>CSV columns: type, domain, difficulty, prompt, choices, answer_key, explanation, tags</p>

      <input
        type="file"
        accept=".csv,text/csv"
        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
      />

      <div style={{ marginTop: 12 }}>
        <button onClick={onUpload} disabled={!file}>
          Upload
        </button>
      </div>

      {msg && <p style={{ marginTop: 12 }}>{msg}</p>}
    </div>
  );
}