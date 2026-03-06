/*
  Warnings:

  - You are about to drop the column `userAnswer` on the `AttemptAnswer` table. All the data in the column will be lost.
  - You are about to drop the column `answerKey` on the `Question` table. All the data in the column will be lost.
  - You are about to drop the column `choices` on the `Question` table. All the data in the column will be lost.
  - You are about to drop the column `hiddenTests` on the `Question` table. All the data in the column will be lost.
  - You are about to drop the column `pbqConfig` on the `Question` table. All the data in the column will be lost.
  - You are about to drop the column `starterCode` on the `Question` table. All the data in the column will be lost.
  - You are about to drop the column `testsJson` on the `Question` table. All the data in the column will be lost.

*/
-- CreateTable
CREATE TABLE "Choice" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "questionId" TEXT NOT NULL,
    "label" TEXT,
    "text" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    CONSTRAINT "Choice_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CorrectChoice" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "questionId" TEXT NOT NULL,
    "choiceId" TEXT NOT NULL,
    CONSTRAINT "CorrectChoice_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CorrectChoice_choiceId_fkey" FOREIGN KEY ("choiceId") REFERENCES "Choice" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PbqItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "questionId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    CONSTRAINT "PbqItem_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AttemptAnswerChoice" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "attemptAnswerId" TEXT NOT NULL,
    "choiceId" TEXT NOT NULL,
    CONSTRAINT "AttemptAnswerChoice_attemptAnswerId_fkey" FOREIGN KEY ("attemptAnswerId") REFERENCES "AttemptAnswer" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AttemptAnswerChoice_choiceId_fkey" FOREIGN KEY ("choiceId") REFERENCES "Choice" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Attempt" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "examId" TEXT NOT NULL,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" DATETIME,
    "score" REAL,
    "timeTakenS" INTEGER,
    CONSTRAINT "Attempt_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Attempt" ("examId", "finishedAt", "id", "score", "startedAt", "timeTakenS") SELECT "examId", "finishedAt", "id", "score", "startedAt", "timeTakenS" FROM "Attempt";
DROP TABLE "Attempt";
ALTER TABLE "new_Attempt" RENAME TO "Attempt";
CREATE TABLE "new_AttemptAnswer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "attemptId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "pbqText" TEXT,
    "isCorrect" BOOLEAN,
    "timeSpentS" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AttemptAnswer_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "Attempt" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AttemptAnswer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_AttemptAnswer" ("attemptId", "createdAt", "id", "isCorrect", "questionId", "timeSpentS") SELECT "attemptId", "createdAt", "id", "isCorrect", "questionId", "timeSpentS" FROM "AttemptAnswer";
DROP TABLE "AttemptAnswer";
ALTER TABLE "new_AttemptAnswer" RENAME TO "AttemptAnswer";
CREATE UNIQUE INDEX "AttemptAnswer_attemptId_questionId_key" ON "AttemptAnswer"("attemptId", "questionId");
CREATE TABLE "new_CodeSubmission" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "attemptId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "resultsJson" TEXT NOT NULL,
    "passedCount" INTEGER NOT NULL,
    "totalCount" INTEGER NOT NULL,
    "runtimeMs" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CodeSubmission_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "Attempt" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CodeSubmission_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_CodeSubmission" ("attemptId", "code", "createdAt", "id", "language", "passedCount", "questionId", "resultsJson", "runtimeMs", "totalCount") SELECT "attemptId", "code", "createdAt", "id", "language", "passedCount", "questionId", "resultsJson", "runtimeMs", "totalCount" FROM "CodeSubmission";
DROP TABLE "CodeSubmission";
ALTER TABLE "new_CodeSubmission" RENAME TO "CodeSubmission";
CREATE TABLE "new_Question" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "domain" TEXT,
    "difficulty" TEXT,
    "prompt" TEXT NOT NULL,
    "explanation" TEXT,
    "tags" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Question" ("createdAt", "difficulty", "domain", "explanation", "id", "prompt", "tags", "type", "updatedAt") SELECT "createdAt", "difficulty", "domain", "explanation", "id", "prompt", "tags", "type", "updatedAt" FROM "Question";
DROP TABLE "Question";
ALTER TABLE "new_Question" RENAME TO "Question";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "Choice_questionId_idx" ON "Choice"("questionId");

-- CreateIndex
CREATE UNIQUE INDEX "Choice_questionId_order_key" ON "Choice"("questionId", "order");

-- CreateIndex
CREATE INDEX "CorrectChoice_questionId_idx" ON "CorrectChoice"("questionId");

-- CreateIndex
CREATE UNIQUE INDEX "CorrectChoice_questionId_choiceId_key" ON "CorrectChoice"("questionId", "choiceId");

-- CreateIndex
CREATE INDEX "PbqItem_questionId_idx" ON "PbqItem"("questionId");

-- CreateIndex
CREATE UNIQUE INDEX "PbqItem_questionId_order_key" ON "PbqItem"("questionId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "AttemptAnswerChoice_attemptAnswerId_choiceId_key" ON "AttemptAnswerChoice"("attemptAnswerId", "choiceId");
