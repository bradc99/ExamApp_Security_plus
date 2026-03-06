import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";

function shuffleArray<T>(items: T[]) {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));

    const rawMode = String(body.mode ?? "EXAM").toUpperCase();
    const mode = rawMode === "PRACTICE" ? "PRACTICE" : "EXAM";
    const count = Math.max(1, Number(body.count ?? 20) || 20);
    const durationMin = Math.max(1, Number(body.durationMin ?? 30) || 30);

    const total = await prisma.question.count();
    if (total === 0) {
      return NextResponse.json(
        { ok: false, error: "No questions in database" },
        { status: 400 }
      );
    }

    const all = await prisma.question.findMany({
      select: { id: true },
    });

    const selected = shuffleArray(all).slice(0, Math.min(count, all.length));
    const questionIds = selected.map((q) => q.id);

    const result = await prisma.$transaction(async (tx) => {
      const exam = await tx.exam.create({
        data: {
          mode,
          settings: JSON.stringify({
            count: questionIds.length,
            questionIds,
            durationMin,
          }),
        },
      });

      const attempt = await tx.attempt.create({
        data: {
          examId: exam.id,
        },
      });

      for (const qid of questionIds) {
        await tx.attemptAnswer.create({
          data: {
            attemptId: attempt.id,
            questionId: qid,
          },
        });
      }

      return { exam, attempt };
    });

    return NextResponse.json({
      ok: true,
      examId: result.exam.id,
      attemptId: result.attempt.id,
      questionCount: questionIds.length,
      mode,
      durationMin,
    });
  } catch (err: any) {
    console.error("POST /api/exam/generate error:", err);
    return NextResponse.json(
      { ok: false, error: err?.message ?? String(err) },
      { status: 500 }
    );
  }
}