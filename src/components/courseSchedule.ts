import { calendarCourses, courseKey } from "./calendarStorage";
import { addDays, parseDateKey, toDateKey } from "./calendarDates";
import type { Semester } from "./scheduleTemplate";

// A saved course with its schedule text broken into days and times.
export interface ScheduledCourse {
    code: string;
    meetingDays: number[];
    meetingTime: string;
    color?: string;
    startDate?: string;
    endDate?: string;
}

interface SavedSchedule {
    code: string;
    section?: string;
    schedule: string;
    color?: string;
    startDate?: string;
    endDate?: string;
}

const WEEKDAY_ABBREVIATIONS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function toScheduledCourse(course: SavedSchedule): ScheduledCourse {
    const meetingDays = course.schedule.match(
        /\b(?:Sun|Mon|Tue|Wed|Thu|Fri|Sat)\b/g,
    );
    const defaultCourse = calendarCourses.find(
        (option) =>
            option.code.replace(/\s/g, "").toLowerCase() ===
            course.code.replace(/\s/g, "").toLowerCase(),
    );
    return {
        code: courseKey(course.code, course.section),
        // "Mon / Wed 1:50 PM - 2:45 PM" meets at "1:50 PM - 2:45 PM".
        meetingTime: course.schedule.match(/\d{1,2}:\d{2}.*$/)?.[0] ?? "",
        color: course.color,
        startDate: course.startDate,
        endDate: course.endDate,
        meetingDays:
            meetingDays ?
                [
                    ...new Set(
                        meetingDays.map((day) =>
                            WEEKDAY_ABBREVIATIONS.indexOf(day),
                        ),
                    ),
                ]
            : !course.schedule.trim() && !course.section ?
                (defaultCourse?.meetingDays ?? [])
            :   [],
    };
}

export function classKey(courseCode: string, date: string): string {
    return `${courseCode}|${date}`;
}

export function isClassMeeting(
    date: Date,
    course: ScheduledCourse,
    semester: Semester,
    cancelledClasses: string[],
): boolean {
    const key = toDateKey(date);
    return (
        key >= (course.startDate || semester.start) &&
        key <= (course.endDate || semester.end) &&
        course.meetingDays.includes(date.getDay()) &&
        !cancelledClasses.includes(classKey(course.code, key))
    );
}

// "1:50 PM - 2:45 PM" starts at 13:50. A start with no AM or PM shares the
// end's, unless that would put it after the end ("11:00 - 12:15 PM").
export function getStartMinutes(meetingTime: string): number {
    const match = meetingTime.match(
        /^(\d{1,2}):(\d{2})(?: (AM|PM))? - (\d{1,2}):\d{2} (AM|PM)$/,
    );
    if (!match) {
        return Infinity;
    }
    // An optional group that didn't match is undefined.
    const [, hour, minute, startPeriod, endHour, endPeriod] = match as (
        string | undefined
    )[];
    const otherPeriod = endPeriod === "PM" ? "AM" : "PM";
    const period =
        startPeriod ??
        (Number(hour) % 12 > Number(endHour) % 12 ? otherPeriod : endPeriod);
    return (
        ((Number(hour) % 12) + (period === "PM" ? 12 : 0)) * 60 + Number(minute)
    );
}

// The course's classes still on from `fromKey` (inclusive), in order, up to
// `limit` of them. Cancelled classes are skipped.
export function getClassesFrom(
    fromKey: string,
    course: ScheduledCourse,
    semester: Semester,
    cancelledClasses: string[],
    limit = Infinity,
): string[] {
    const end = course.endDate || semester.end;
    const dates: string[] = [];
    for (
        let day = parseDateKey(fromKey);
        dates.length < limit && toDateKey(day) <= end;
        day = addDays(day, 1)
    ) {
        if (isClassMeeting(day, course, semester, cancelledClasses)) {
            dates.push(toDateKey(day));
        }
    }
    return dates;
}

// The course's last class still on before `beforeKey`, if any.
export function getPreviousClass(
    beforeKey: string,
    course: ScheduledCourse,
    semester: Semester,
    cancelledClasses: string[],
): string | undefined {
    const start = course.startDate || semester.start;
    for (
        let day = addDays(parseDateKey(beforeKey), -1);
        toDateKey(day) >= start;
        day = addDays(day, -1)
    ) {
        if (isClassMeeting(day, course, semester, cancelledClasses)) {
            return toDateKey(day);
        }
    }
    return undefined;
}
