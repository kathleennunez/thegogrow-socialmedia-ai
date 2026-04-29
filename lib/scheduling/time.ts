export function toUtcIso(localDate: string, localTime: string): string {
  const date = new Date(`${localDate}T${localTime}:00`);
  if (Number.isNaN(date.getTime())) {
    throw new Error("Invalid date/time selection.");
  }

  return date.toISOString();
}

export function ensureScheduleInFuture(utcIso: string) {
  const scheduled = new Date(utcIso).getTime();
  const now = Date.now();
  if (Number.isNaN(scheduled)) {
    throw new Error("Invalid UTC schedule timestamp.");
  }

  if (scheduled <= now + 60 * 1000) {
    throw new Error("Scheduled time must be at least 1 minute in the future.");
  }
}
