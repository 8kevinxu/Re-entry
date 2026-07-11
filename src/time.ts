/** "moments", "20 minutes", "an hour", "a day", "3 weeks", "over a year" … */
export function awayFor(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 2) return "moments";
  if (minutes < 60) return `${minutes} minutes`;
  const hours = Math.floor(minutes / 60);
  if (hours < 2) return "an hour";
  if (hours < 36) return `${hours} hours`;
  const days = Math.round(hours / 24);
  if (days < 2) return "a day";
  if (days < 14) return `${days} days`;
  const weeks = Math.round(days / 7);
  if (days < 61) return weeks < 2 ? "a week" : `${weeks} weeks`;
  const months = Math.round(days / 30.4);
  if (days < 365) return months < 2 ? "a month" : `${months} months`;
  const years = Math.floor(days / 365);
  return years < 2 ? "over a year" : `${years} years`;
}

export function writtenAgo(iso: string): string {
  const away = awayFor(iso);
  return away === "moments" ? "moments ago" : `${away} ago`;
}

export function longDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}
