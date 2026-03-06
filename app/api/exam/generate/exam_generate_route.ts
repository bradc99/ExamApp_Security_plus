import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const mode = String(body.mode ?? "EXAM").toUpperCase(); // EXAM|PRACTICE
    const count = Math.max(1, Number(body.count ?? 20) || 20);

    const total = await prisma.question.count();
    if (total === 0) {
      return NextResponse.json(
        { ok: false, error: "No questions in database" },
        { status: 400 }
      );
    }

    const all = await prisma.question.findMany({ select: { id: true } });
    const selected = all
      .sort(() => Math.random() - 0.5)
      .slice(0, Math.min(count, all.length));
    const questionIds = selected.map((q) => q.id);

    const exam = await prisma.exam.create({
      data: {
        mode: mode as any,
        settings: JSON.stringify({ count }),
      },
    });

    const attempt = await prisma.attempt.create({
      data: {
        examId: exam.id,
      },
    });

    await prisma.attemptAnswer.createMany({
      data: questionIds.map((qid) => ({
        attemptId: attempt.id,
        questionId: qid,
      })),
    });

    return NextResponse.json({
      ok: true,
      examId: exam.id,
      attemptId: attempt.id,
    });
  } catch (err: any) {
    console.error("POST /api/exam/generate error:", err);
    return NextResponse.json(
      { ok: false, error: err?.message ?? String(err) },
      { status: 500 }
    );
  }
}
