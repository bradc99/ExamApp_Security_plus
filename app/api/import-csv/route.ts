import { NextResponse } from "next/server";
import Papa from "papaparse";
import { prisma } from "@/app/lib/prisma";

type CsvRow = {
  type?: string;
  domain?: string;
  difficulty?: string;
  prompt?: string;

  // For MCQ/MULTI
  choices?: string; // pipe-separated: A|B|C
  answer_key?: string; // can be: "0" or "0|2" OR "B" OR "A|C" (texts)

  explanation?: string;
  tags?: string;

  // Optional for PBQ if you want later:
  // pbq_json?: string;
};

function normalizeType(raw?: string) {
  const t = (raw ?? "").trim().toUpperCase();
  if (t === "MCQ") return "MCQ";
  if (t === "MULTI") return "MULTI";
  if (t === "PBQ") return "PBQ";
  if (t === "CODE_PY_SCRIPT") return "CODE_PY_SCRIPT";
  return null;
}

function splitPipe(raw?: string): string[] {
  return (raw ?? "")
    .split("|")
    .map((x) => x.trim())
    .filter(Boolean);
}

function parseAnswerIndexes(raw?: string): number[] {
  const s = (raw ?? "").trim();
  if (!s) return [];

  // ONLY treat as indexes if every token is a number
  const tokens = s
    .split("|")
    .map((x) => x.trim())
    .filter(Boolean);
  if (tokens.length === 0) return [];

  const nums = tokens.map((x) => Number(x));
  const allNumeric = nums.every((n) => Number.isFinite(n));

  if (!allNumeric) return [];
  return nums.filter((n) => n >= 0);
}

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const file = form.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { ok: false, error: "No file uploaded (field name must be 'file')" },
        { status: 400 }
      );
    }

    const text = await file.text();
    const parsed = Papa.parse<CsvRow>(text, {
      header: true,
      skipEmptyLines: true,
    });

    if (parsed.errors?.length) {
      return NextResponse.json(
        { ok: false, error: "CSV parse error", details: parsed.errors },
        { status: 400 }
      );
    }

    const rows = parsed.data ?? [];
    let inserted = 0;
    const warnings: string[] = [];

    for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
      const r = rows[rowIndex];

      const type = normalizeType(r.type);
      const prompt = (r.prompt ?? "").trim();
      if (!type || !prompt) continue;

      const domain = r.domain?.trim() || null;
      const difficulty = r.difficulty?.trim() || null;
      const explanation = r.explanation?.trim() || null;
      const tags = r.tags?.trim() || null;

      // Create the question first
      const q = await prisma.question.create({
        data: {
          type: type as any,
          domain,
          difficulty,
          prompt,
          explanation,
          tags,
        },
      });

      // MCQ/MULTI: create Choice rows + CorrectChoice rows
      if (type === "MCQ" || type === "MULTI") {
        const choiceTexts = splitPipe(r.choices);

        if (choiceTexts.length === 0) {
          warnings.push(
            `Row ${rowIndex + 2}: MCQ/MULTI has no choices (prompt="${prompt}")`
          );
          inserted++;
          continue;
        }

        // Create choices
        await prisma.choice.createMany({
          data: choiceTexts.map((text, idx) => ({
            questionId: q.id,
            text,
            order: idx,
            label: null,
          })),
        });

        // Fetch back with IDs
        const choices = await prisma.choice.findMany({
          where: { questionId: q.id },
          orderBy: { order: "asc" },
          select: { id: true, text: true, order: true },
        });

        // Figure out correct choices:
        // 1) If answer_key is numeric => indexes (0-based)
        // 2) Otherwise => match by text
        const idxs = parseAnswerIndexes(r.answer_key);
        let correctIds: string[] = [];

        if (idxs.length > 0) {
          correctIds = idxs
            .map((i) => choices.find((c) => c.order === i)?.id)
            .filter(Boolean) as string[];
        } else {
          const correctTexts = splitPipe(r.answer_key);
          if (correctTexts.length > 0) {
            const set = new Set(correctTexts.map((x) => x.trim()));
            correctIds = choices
              .filter((c) => set.has(c.text.trim()))
              .map((c) => c.id);
          }
        }

        if (correctIds.length === 0) {
          warnings.push(
            `Row ${rowIndex + 2}: No correct answers matched. ` +
              `Use answer_key as indexes (0|2) OR exact choice text. prompt="${prompt}"`
          );
        } else {
          await prisma.correctChoice.createMany({
            data: correctIds.map((choiceId) => ({
              questionId: q.id,
              choiceId,
            })),
          });
        }

        inserted++;
        continue;
      }

      // PBQ: store PBQ items (not choices) - keep simple and reliable
      if (type === "PBQ") {
        const items = splitPipe(r.choices); // you can still use "choices" column as PBQ items list
        if (items.length) {
          await prisma.pbqItem.createMany({
            data: items.map((text, idx) => ({
              questionId: q.id,
              text,
              order: idx,
            })),
          });
        }
        inserted++;
        continue;
      }

      // CODE_PY_SCRIPT etc: nothing extra for now
      inserted++;
    }

    return NextResponse.json({ ok: true, inserted, warnings });
  } catch (err: any) {
    console.error("POST /api/import-csv error:", err);
    return NextResponse.json(
      { ok: false, error: err?.message ?? String(err) },
      { status: 500 }
    );
  }
}
