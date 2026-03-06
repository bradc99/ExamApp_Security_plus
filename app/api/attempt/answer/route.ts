import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { getDurationMin, isAttemptExpired } from "@/app/lib/examTiming";

type Body = {
  attemptAnswerId: string;
  selectedChoiceIds?: string[];
  pbqText?: string;
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
    const attemptAnswerId = String(body.attemptAnswerId ?? "");

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
        question: {
          include: {
            correct: true,
            choices: true,
          },
        },
        selected: true,
      },
    });

    if (!row) {
      return NextResponse.json(
        { ok: false, error: "AttemptAnswer not found" },
        { status: 404 }
      );
    }

    if (row.attempt.finishedAt) {
      return NextResponse.json(
        { ok: false, error: "This attempt is already finished" },
        { status: 400 }
      );
    }

    const durationMin = getDurationMin(row.attempt.exam.settings);

    if (isAttemptExpired(row.attempt.startedAt, durationMin)) {
      const finishedAt = new Date();
      const timeTakenS = Math.max(
        0,
        Math.floor((finishedAt.getTime() - row.attempt.startedAt.getTime()) / 1000)
      );

      await prisma.attempt.update({
        where: { id: row.attempt.id },
        data: {
          finishedAt,
          timeTakenS,
        },
      });

      return NextResponse.json(
        { ok: false, error: "Time is up. This attempt has expired." },
        { status: 400 }
      );
    }

    const selectedChoiceIdsRaw = Array.isArray(body.selectedChoiceIds)
      ? body.selectedChoiceIds
      : [];

    const selectedChoiceIds = [...new Set(selectedChoiceIdsRaw)];

    const validChoiceIds = new Set(row.question.choices.map((c) => c.id));
    const invalidChoiceIds = selectedChoiceIds.filter((id) => !validChoiceIds.has(id));

    if (invalidChoiceIds.length > 0) {
      return NextResponse.json(
        { ok: false, error: "One or more selected choices do not belong to this question" },
        { status: 400 }
      );
    }

    if (row.question.type === "MCQ" && selectedChoiceIds.length > 1) {
      return NextResponse.json(
        { ok: false, error: "MCQ questions can only have one selected choice" },
        { status: 400 }
      );
    }

    await prisma.attemptAnswerChoice.deleteMany({
      where: { attemptAnswerId },
    });

    if (selectedChoiceIds.length > 0) {
      await prisma.attemptAnswerChoice.createMany({
        data: selectedChoiceIds.map((choiceId) => ({
          attemptAnswerId,
          choiceId,
        })),
      });
    }

    const pbqText = typeof body.pbqText === "string" ? body.pbqText : null;

    let isCorrect: boolean | null = null;

    if (row.attempt.exam.mode === "PRACTICE") {
      const correctChoiceIds = row.question.correct.map((c) => c.choiceId);

      if (row.question.type === "MCQ" || row.question.type === "MULTI") {
        isCorrect = arraysEqual(selectedChoiceIds, correctChoiceIds);
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