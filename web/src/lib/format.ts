const dateHeading = new Intl.DateTimeFormat(undefined, {
  weekday: "long",
  month: "long",
  day: "numeric",
});
const dateHeadingWithYear = new Intl.DateTimeFormat(undefined, {
  month: "long",
  day: "numeric",
  year: "numeric",
});
const timeOfDay = new Intl.DateTimeFormat(undefined, {
  hour: "numeric",
  minute: "2-digit",
});

function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/** "Today" / "Yesterday" / "Friday, June 5" / "June 5, 2025" */
export function formatDayHeading(iso: string, now = new Date()): string {
  const date = new Date(iso);
  const dayDiff = Math.round((startOfDay(now) - startOfDay(date)) / 86_400_000);
  if (dayDiff === 0) return "Today";
  if (dayDiff === 1) return "Yesterday";
  if (date.getFullYear() === now.getFullYear()) return dateHeading.format(date);
  return dateHeadingWithYear.format(date);
}

export function formatTime(iso: string): string {
  return timeOfDay.format(new Date(iso));
}

export function formatDateTime(iso: string): string {
  return `${formatDayHeading(iso)} · ${formatTime(iso)}`;
}

/** Seconds → "m:ss" for transcript offsets. */
export function formatOffset(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}
