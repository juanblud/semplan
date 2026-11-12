import { addDays, parseDateKey, toDateKey } from "./calendarDates";
import { isClassMeeting, toScheduledCourse } from "./courseSchedule";
import type { CalendarItem, Semester } from "./scheduleTemplate";

// What a course is saved with, as far as planning needs.
interface PlanCourse {
    code: string;
    section?: string;
    schedule: string;
    color?: string;
    startDate?: string;
    endDate?: string;
}

// A course's teaching plan from today to its last class, worked out from the
// schedule, cancelled classes and calendar items already saved. Nothing here
// asks the user for anything.
export interface CoursePlan {
    // The course's name in calendar items, e.g. "CISC 275 - Section 010".
    key: string;
    hasSchedule: boolean;
    classesLeft: number;
    // Upcoming classes with at least one topic or activity on them.
    plannedClassesLeft: number;
    nextClass?: string;
    // Upcoming classes in the next week with nothing on them.
    emptyClassesThisWeek: string[];
    unscheduledTopics: number;
}

export function getCoursePlan(
    course: PlanCourse,
    semester: Semester,
    items: CalendarItem[],
    cancelledClasses: string[],
    today: Date,
): CoursePlan {
    const scheduled = toScheduledCourse(course);
    const key = scheduled.code;
    const courseItems = items.filter(
        (item) => item.semester === semester.name && item.course === key,
    );
    const todayKey = toDateKey(today);
    const weekEnd = toDateKey(addDays(today, 7));
    const start = scheduled.startDate || semester.start;
    const end = scheduled.endDate || semester.end;

    const plan: CoursePlan = {
        key,
        hasSchedule: scheduled.meetingDays.length > 0,
        classesLeft: 0,
        plannedClassesLeft: 0,
        emptyClassesThisWeek: [],
        unscheduledTopics: courseItems.filter(
            (item) => item.kind === "topic" && !item.date,
        ).length,
    };
    if (!plan.hasSchedule) {
        return plan;
    }

    for (
        let day = parseDateKey(todayKey > start ? todayKey : start);
        toDateKey(day) <= end;
        day = addDays(day, 1)
    ) {
        if (!isClassMeeting(day, scheduled, semester, cancelledClasses)) {
            continue;
        }
        const date = toDateKey(day);
        plan.classesLeft += 1;
        plan.nextClass ??= date;
        if (courseItems.some((item) => item.date === date)) {
            plan.plannedClassesLeft += 1;
        } else if (date < weekEnd) {
            plan.emptyClassesThisWeek.push(date);
        }
    }
    return plan;
}
