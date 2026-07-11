import type { Language } from '../models/settings';

export function toDateInputValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function todayISO(): string {
  return toDateInputValue(new Date());
}

export function currentTime(): string {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

export function dateFromISO(date: string): Date {
  return new Date(`${date}T00:00:00`);
}

export function isSameDate(date: string, target = todayISO()): boolean {
  return date === target;
}

export function getLastSevenDays(): string[] {
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - index));
    return toDateInputValue(date);
  });
}

export function getWeekStart(date = new Date()): Date {
  const start = new Date(date);
  const day = start.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() + diff);
  return start;
}

export function isDateInCurrentWeek(date: string): boolean {
  const value = dateFromISO(date).getTime();
  const start = getWeekStart().getTime();
  const end = new Date(getWeekStart());
  end.setDate(end.getDate() + 7);
  return value >= start && value < end.getTime();
}

export function formatDisplayDate(date: string, language: Language): string {
  return new Intl.DateTimeFormat(language === 'ar' ? 'ar-SA-u-nu-latn' : 'en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).format(dateFromISO(date));
}

export function formatShortDate(date: string, language: Language): string {
  return new Intl.DateTimeFormat(language === 'ar' ? 'ar-SA-u-nu-latn' : 'en-US', {
    month: 'short',
    day: 'numeric',
  }).format(dateFromISO(date));
}

export function compareDateTimeDesc(
  left: { date: string; time: string },
  right: { date: string; time: string },
): number {
  return `${right.date}T${right.time}`.localeCompare(`${left.date}T${left.time}`);
}
