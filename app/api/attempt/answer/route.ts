import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";

type Body = {
  attemptAnswerId: string;
  selectedChoiceIds?: string[]; // for MCQ/MULTI
  pbqText?: string; // for PBQ free-form (later)
};

function arraysEqual(a: string[], b: string[]) {
  if (a.length !== b.length) return false;
  const A = [...a].sort();
  const B = [...b].sort();
  return A.every((v, i) => v === B[i]);
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as Body;
    const attemptAnswerId = body.attemptAnswerId;

    if (!attemptAnswerId) {
      return NextResponse.json(
        { ok: false, error: "Missing attemptAnswerId" },
        { status: 400 }
      );
    }

    const row = await prisma.attemptAnswer.findUnique({
      where: { id: attemptAnswerId },
      include: {
        attempt: { include: { exam: true } },
        question: { include: { correct: true } },
        selected: true,
      },
    });

    if (!row) {
      return NextResponse.json(
        { ok: false, error: "AttemptAnswer not found" },
        { status: 404 }
      );
    }

    // Clear existing selections
    await prisma.attemptAnswerChoice.deleteMany({
      where: { attemptAnswerId },
    });

    // Insert new selections (if any)
    const selectedChoiceIds = Array.isArray(body.selectedChoiceIds)
      ? body.selectedChoiceIds
      : [];
    if (selectedChoiceIds.length) {
      await prisma.attemptAnswerChoice.createMany({
        data: selectedChoiceIds.map((choiceId) => ({
          attemptAnswerId,
          choiceId,
        })),
      });
    }

    // PBQ text (optional)
    const pbqText = typeof body.pbqText === "string" ? body.pbqText : null;

    // Compute correctness only in PRACTICE (for MCQ/MULTI)
    let isCorrect: boolean | null = null;

    if (row.attempt.exam.mode === "PRACTICE") {
      const correctChoiceIds = row.question.correct.map((c) => c.choiceId);
      if (row.question.type === "MCQ" || row.question.type === "MULTI") {
        isCorrect = arraysEqual(selectedChoiceIds, correctChoiceIds);
      } else {
        isCorrect = null; // PBQ/coding later
      }
    }

    await prisma.attemptAnswer.update({
      where: { id: attemptAnswerId },
      data: {
        pbqText,
        isCorrect,
      },
    });

    return NextResponse.json({ ok: true, isCorrect });
  } catch (err: any) {
    console.error("POST /api/attempt/answer error:", err);
    return NextResponse.json(
      { ok: false, error: err?.message ?? String(err) },
      { status: 500 }
    );
  }
}
