import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: attemptId } = await params;

    const attempt = await prisma.attempt.findUnique({
      where: { id: attemptId },
      include: { exam: true },
    });

    if (!attempt) {
      return NextResponse.json(
        { ok: false, error: "Attempt not found" },
        { status: 404 }
      );
    }

    const answers = await prisma.attemptAnswer.findMany({
      where: { attemptId },
      orderBy: { createdAt: "asc" },
      include: {
        question: {
          include: {
            choices: { orderBy: { order: "asc" } },
            correct: true,
            pbqItems: { orderBy: { order: "asc" } },
          },
        },
        selected: true,
      },
    });

    const questions = answers.map((a) => ({
      attemptAnswerId: a.id,
      questionId: a.questionId,
      isCorrect: a.isCorrect,
      type: a.question.type,
      domain: a.question.domain,
      difficulty: a.question.difficulty,
      prompt: a.question.prompt,
      explanation: a.question.explanation,
      tags: a.question.tags,
      // send choices as real arrays (no JSON text)
      choices: a.question.choices.map((c) => ({
        id: c.id,
        text: c.text,
        order: c.order,
      })),
      // user selections
      selectedChoiceIds: a.selected.map((s) => s.choiceId),
      // PBQ items
      pbqItems: a.question.pbqItems.map((p) => ({
        text: p.text,
        order: p.order,
      })),
      pbqText: a.pbqText ?? null,
    }));

    return NextResponse.json({
      ok: true,
      attemptId: attempt.id,
      mode: attempt.exam.mode,
      finishedAt: attempt.finishedAt,
      score: attempt.score,
      questions,
    });
  } catch (err: any) {
    console.error("GET /api/attempt/[id] error:", err);
    return NextResponse.json(
      { ok: false, error: err?.message ?? String(err) },
      { status: 500 }
    );
  }
}
