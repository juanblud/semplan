// Date helpers shared by the Calendar page and its add-activity form. Dates are
// stored as local "YYYY-MM-DD" keys so they never shift with time zones.

export const WEEKDAYS = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
];

export function toDateKey(date: Date): string {
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${date.getFullYear()}-${month}-${day}`;
}

export function parseDateKey(key: string): Date {
    const [year, month, day] = key.split("-").map(Number);
    return new Date(year, month - 1, day);
}

export function addDays(date: Date, days: number): Date {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

export function startOfMonth(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), 1);
}

// Every day shown in the month grid, including spill-over days from the
// neighbouring months so each week row is complete.
export function getMonthGrid(month: Date): Date[] {
    const gridStart = addDays(month, -month.getDay());
    const daysInMonth = new Date(
        month.getFullYear(),
        month.getMonth() + 1,
        0,
    ).getDate();
    const weeks = Math.ceil((month.getDay() + daysInMonth) / 7);
    return Array.from({ length: weeks * 7 }, (_, index) =>
        addDays(gridStart, index),
    );
}

// The Sunday-to-Saturday week holding the given date.
export function getWeek(date: Date): Date[] {
    const weekStart = addDays(date, -date.getDay());
    return Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));
}

// e.g. "October 11–17, 2026" or "September 27 – October 3, 2026".
export function formatWeekRange(start: Date, end: Date): string {
    const sameYear = start.getFullYear() === end.getFullYear();
    if (sameYear && start.getMonth() === end.getMonth()) {
        const month = start.toLocaleDateString("en-US", { month: "long" });
        return `${month} ${start.getDate()}–${end.getDate()}, ${end.getFullYear()}`;
    }
    const startText = start.toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: sameYear ? undefined : "numeric",
    });
    const endText = end.toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
    });
    return `${startText} – ${endText}`;
}

export function formatLongDate(date: Date): string {
    return date.toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
    });
}

// "14:45" (from a time input) -> "2:45 PM".
export function formatTime(value: string): string {
    const [hours, minutes] = value.split(":").map(Number);
    const period = hours >= 12 ? "PM" : "AM";
    return `${hours % 12 || 12}:${String(minutes).padStart(2, "0")} ${period}`;
}

// Whole Sunday-to-Saturday weeks from the week of `from` to the week of `to`.
// Rounding absorbs the hour lost or gained at daylight saving changes.
function weeksBetween(from: Date, to: Date): number {
    const fromSunday = addDays(from, -from.getDay());
    const toSunday = addDays(to, -to.getDay());
    return Math.round(
        (toSunday.getTime() - fromSunday.getTime()) / (7 * 86_400_000),
    );
}

export function getSemesterWeekCount(
    semesterStart: string,
    semesterEnd: string,
): number {
    return (
        weeksBetween(parseDateKey(semesterStart), parseDateKey(semesterEnd)) + 1
    );
}

// Semester weeks run Sunday to Saturday; week 1 is the week the semester
// starts in. Days outside the semester have no week number.
export function getSemesterWeek(
    date: Date,
    semesterStart: string,
    semesterEnd: string,
): number | null {
    const week = weeksBetween(parseDateKey(semesterStart), date) + 1;
    return (
            week >= 1 &&
                week <= getSemesterWeekCount(semesterStart, semesterEnd)
        ) ?
            week
        :   null;
}

// The Sunday that begins the given semester week.
export function getSemesterWeekStart(
    week: number,
    semesterStart: string,
): Date {
    const start = parseDateKey(semesterStart);
    return addDays(start, (week - 1) * 7 - start.getDay());
}

// "2026-10-14" as "Wed, Oct 14".
export function formatShortDate(key: string): string {
    return parseDateKey(key).toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
    });
}
