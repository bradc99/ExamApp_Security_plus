import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";

type Body = {
  attemptAnswerId?: string;
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
        attempt: {
          include: {
            exam: true,
          },
        },
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

    let durationMin = 0;
    try {
      const settings = JSON.parse(row.attempt.exam.settings || "{}");
      durationMin = Number(settings.durationMin ?? 0);
    } catch {
      durationMin = 0;
    }

    if (durationMin > 0) {
      const expiresAt =
        new Date(row.attempt.startedAt).getTime() + durationMin * 60 * 1000;

      if (Date.now() > expiresAt) {
        return NextResponse.json(
          { ok: false, error: "Time is up for this attempt" },
          { status: 400 }
        );
      }
    }

    const selectedChoiceIdsRaw = Array.isArray(body.selectedChoiceIds)
      ? body.selectedChoiceIds
      : [];

    const selectedChoiceIds = [...new Set(selectedChoiceIdsRaw)];

    const validChoiceIds = new Set(row.question.choices.map((c) => c.id));
    const invalidChoiceIds = selectedChoiceIds.filter(
      (id) => !validChoiceIds.has(id)
    );

    if (invalidChoiceIds.length > 0) {
      return NextResponse.json(
        {
          ok: false,
          error: "One or more selected choices do not belong to this question",
        },
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

    const pbqText =
      typeof body.pbqText === "string" ? body.pbqText : row.pbqText ?? null;

    let isCorrect: boolean | null = null;

    const examMode = String(row.attempt.exam.mode ?? "").trim().toUpperCase();

    if (examMode === "PRACTICE") {
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

    return NextResponse.json({
      ok: true,
      isCorrect,
      mode: examMode,
    });
  } catch (err: any) {
    console.error("POST /api/attempt/answer error:", err);
    return NextResponse.json(
      { ok: false, error: err?.message ?? "Failed to save answer" },
      { status: 500 }
    );
  }
}