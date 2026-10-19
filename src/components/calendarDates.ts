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
