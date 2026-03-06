import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";

function arraysEqual(a: string[], b: string[]) {
  if (a.length !== b.length) return false;
  const A = [...a].sort();
  const B = [...b].sort();
  return A.every((v, i) => v === B[i]);
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const attemptId = String(body.attemptId ?? "");

    if (!attemptId) {
      return NextResponse.json(
        { ok: false, error: "Missing attemptId" },
        { status: 400 }
      );
    }

    const answers = await prisma.attemptAnswer.findMany({
      where: { attemptId },
      include: {
        question: { include: { correct: true } },
        selected: true,
      },
    });

    let correctCount = 0;
    let gradableCount = 0;

    for (const a of answers) {
      if (a.question.type !== "MCQ" && a.question.type !== "MULTI") continue;
      gradableCount += 1;

      const selectedIds = a.selected.map((s) => s.choiceId);
      const correctIds = a.question.correct.map((c) => c.choiceId);

      const ok = arraysEqual(selectedIds, correctIds);
      if (ok) correctCount += 1;

      await prisma.attemptAnswer.update({
        where: { id: a.id },
        data: { isCorrect: ok },
      });
    }

    const score = gradableCount ? (correctCount / gradableCount) * 100 : 0;

    await prisma.attempt.update({
      where: { id: attemptId },
      data: {
        finishedAt: new Date(),
        score,
      },
    });

    return NextResponse.json({ ok: true, score, correctCount, gradableCount });
  } catch (err: any) {
    console.error("POST /api/exam/finish error:", err);
    return NextResponse.json(
      { ok: false, error: err?.message ?? String(err) },
      { status: 500 }
    );
  }
}
