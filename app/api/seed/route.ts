import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";

export async function GET() {
  const choices = [
    "Confidentiality, Integrity, Availability",
    "Control, Inspect, Audit",
    "Cloud, Identity, Access",
  ];

  const q = await prisma.question.create({
    data: {
      type: "MCQ",
      prompt: "What does CIA stand for in security?",
      choices: JSON.stringify(choices),                 // ✅ store as JSON text
      answerKey: JSON.stringify(choices[0]),            // ✅ store as JSON text
      explanation: "CIA triad = Confidentiality, Integrity, Availability.",
    },
  });

  return NextResponse.json({ created: q });
}