export function parseExamSettings(settings: string | null | undefined) {
  try {
    return JSON.parse(settings || "{}") as {
      count?: number;
      questionIds?: string[];
      durationMin?: number;
    };
  } catch {
    return {};
  }
}

export function getDurationMin(settings: string | null | undefined) {
  const parsed = parseExamSettings(settings);
  const raw = Number(parsed.durationMin ?? 0);
  return Number.isFinite(raw) && raw > 0 ? raw : 0;
}

export function getExpiresAt(startedAt: Date, durationMin: number) {
  return new Date(startedAt.getTime() + durationMin * 60 * 1000);
}

export function isAttemptExpired(startedAt: Date, durationMin: number) {
  if (!durationMin || durationMin <= 0) return false;
  return Date.now() >= getExpiresAt(startedAt, durationMin).getTime();
}

export function getRemainingSeconds(startedAt: Date, durationMin: number) {
  if (!durationMin || durationMin <= 0) return null;
  const expiresAt = getExpiresAt(startedAt, durationMin).getTime();
  return Math.max(0, Math.floor((expiresAt - Date.now()) / 1000));
}