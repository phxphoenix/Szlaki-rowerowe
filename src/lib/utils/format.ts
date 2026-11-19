export function formatDistance(km: number): string {
  const safeKm = Number.isFinite(km) ? Math.max(0, km) : 0;
  const rounded = Math.round(safeKm * 10) / 10;
  const formatted = new Intl.NumberFormat("pl-PL", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
    useGrouping: false,
  }).format(rounded);
  return `${formatted} km`;
}

export function formatElevation(meters: number): string {
  const safeMeters = Number.isFinite(meters) ? Math.max(0, Math.round(meters)) : 0;
  return `↑ ${safeMeters} m`;
}

export function formatDuration(minutes: number | null | undefined): string {
  if (minutes === null || minutes === undefined || !Number.isFinite(minutes)) {
    return "—";
  }

  const totalMinutes = Math.max(0, Math.round(minutes));
  if (totalMinutes < 60) {
    return `${totalMinutes} min`;
  }

  const hours = Math.floor(totalMinutes / 60);
  const remainingMinutes = totalMinutes % 60;

  if (remainingMinutes === 0) {
    return `${hours}h`;
  }

  return `${hours}h ${remainingMinutes}m`;
}

export function formatDatePl(date: Date | string): string {
  const parsed = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(parsed.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat("pl-PL", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Warsaw",
  }).format(parsed);
}
