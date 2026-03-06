import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import {
  getDurationMin,
  getExpiresAt,
  getRemainingSeconds,
  isAttemptExpired,
  parseExamSettings,
} from "@/app/lib/examTiming";

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

    const settings = parseExamSettings(attempt.exam.settings);
    const durationMin = getDurationMin(attempt.exam.settings);

    if (!attempt.finishedAt && isAttemptExpired(attempt.startedAt, durationMin)) {
      const finishedAt = new Date();
      const timeTakenS = Math.max(
        0,
        Math.floor((finishedAt.getTime() - attempt.startedAt.getTime()) / 1000)
      );

      await prisma.attempt.update({
        where: { id: attempt.id },
        data: {
          finishedAt,
          timeTakenS,
        },
      });

      attempt.finishedAt = finishedAt;
      attempt.timeTakenS = timeTakenS;
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
      choices: a.question.choices.map((c) => ({
        id: c.id,
        label: c.label,
        text: c.text,
        order: c.order,
      })),
      selectedChoiceIds: a.selected.map((s) => s.choiceId),
      pbqItems: a.question.pbqItems.map((p) => ({
        text: p.text,
        order: p.order,
      })),
      pbqText: a.pbqText ?? "",
    }));

    return NextResponse.json({
      ok: true,
      attemptId: attempt.id,
      mode: attempt.exam.mode,
      settings,
      durationMin,
      remainingSeconds: attempt.finishedAt
        ? 0
        : getRemainingSeconds(attempt.startedAt, durationMin),
      expiresAt:
        durationMin > 0 ? getExpiresAt(attempt.startedAt, durationMin).toISOString() : null,
      startedAt: attempt.startedAt,
      finishedAt: attempt.finishedAt,
      score: attempt.score,
      timeTakenS: attempt.timeTakenS,
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