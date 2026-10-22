import { addDays, parseDateKey, toDateKey } from "./calendarDates";

export interface Semester {
    name: string;
    start: string;
    end: string;
}

export interface CalendarItem {
    id: string;
    course: string;
    semester?: string;
    kind: "topic" | "activity";
    title: string;
    detail?: string;
    date?: string;
    activityId?: string;
}

// Match lectures by class number rather than by the old calendar date.
export function copySchedule(
    items: CalendarItem[],
    source: Semester,
    target: Semester,
    meetingDays: number[],
    cancelled: string[],
    course: string,
    createId: (kind: CalendarItem["kind"]) => string,
): CalendarItem[] {
    function meetings(term: Semester) {
        const dates: string[] = [];
        for (
            let day = parseDateKey(term.start);
            toDateKey(day) <= term.end;
            day = addDays(day, 1)
        ) {
            const key = toDateKey(day);
            if (
                meetingDays.includes(day.getDay()) &&
                !cancelled.includes(`${course}|${key}`)
            )
                dates.push(key);
        }
        return dates;
    }
    const oldMeetings = meetings(source);
    const newMeetings = meetings(target);
    const ids = new Map(items.map((item) => [item.id, createId(item.kind)]));
    function activityDate(date: string) {
        const start = parseDateKey(source.start);
        const original = parseDateKey(date);
        const offset = Math.round(
            (Date.UTC(
                original.getFullYear(),
                original.getMonth(),
                original.getDate(),
            ) -
                Date.UTC(
                    start.getFullYear(),
                    start.getMonth(),
                    start.getDate(),
                )) /
                86400000,
        );
        const result = toDateKey(addDays(parseDateKey(target.start), offset));
        if (result < target.start || result > target.end)
            throw new Error(
                "An activity falls outside the destination semester. Adjust its source date before copying.",
            );
        return result;
    }
    const activityDates = new Map(
        items
            .filter((item) => item.kind === "activity" && item.date)
            .map((item) => [item.id, activityDate(item.date!)]),
    );
    return items.map((item) => {
        const activityId =
            item.activityId ? ids.get(item.activityId) : undefined;
        const date =
            item.kind === "activity" ? activityDates.get(item.id)
            : activityId ? activityDates.get(item.activityId!)
            : item.date ? newMeetings[oldMeetings.indexOf(item.date)]
            : undefined;
        return {
            ...item,
            id: ids.get(item.id)!,
            semester: target.name,
            date,
            activityId,
        };
    });
}
