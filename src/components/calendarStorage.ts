import type { CalendarItem, Semester } from "./scheduleTemplate";

interface Course {
    code: string;
    meetingDays: number[];
}

export const semesters: Semester[] = [
    { name: "Fall 2026", start: "2026-09-01", end: "2026-12-14" },
    { name: "Spring 2027", start: "2027-02-08", end: "2027-05-17" },
];

interface SemesterCourse {
    semester: string;
    startDate?: string;
    endDate?: string;
}

function semesterOrderDate(term: Semester): string {
    const year = term.name.match(/\b\d{4}\b/)?.[0];
    const season = term.name
        .match(/\b(winter|spring|summer|fall|autumn)\b/i)?.[0]
        .toLowerCase();
    const months: Record<string, string> = {
        winter: "01",
        spring: "03",
        summer: "06",
        fall: "09",
        autumn: "09",
    };
    // Semester labels determine their order even if a course's dates differ.
    return year && season ? `${year}-${months[season]}-01` : term.start;
}

// Include every saved course's term. New terms use their course date ranges,
// falling back to the configured season's dates in the requested year.
export function getCalendarSemesters(courses: SemesterCourse[]): Semester[] {
    const names = new Set([
        ...semesters.map((term) => term.name),
        ...courses.map((course) => course.semester),
    ]);
    return [...names]
        .map((name) => {
            const configured = semesters.find((term) => term.name === name);
            if (configured) return configured;
            const termCourses = courses.filter(
                (course) => course.semester === name,
            );
            const starts = termCourses
                .flatMap((course) =>
                    course.startDate ? [course.startDate] : [],
                )
                .sort();
            const ends = termCourses
                .flatMap((course) => (course.endDate ? [course.endDate] : []))
                .sort();
            const year =
                name.match(/\b\d{4}\b/)?.[0] ??
                String(new Date().getFullYear());
            const season = name.split(" ")[0].toLowerCase();
            const base = semesters.find(
                (term) => term.name.split(" ")[0].toLowerCase() === season,
            );
            return {
                name,
                start:
                    starts[0] ?? `${year}${base?.start.slice(4) ?? "-01-01"}`,
                end: ends.at(-1) ?? `${year}${base?.end.slice(4) ?? "-12-31"}`,
            };
        })
        .sort(
            (a, b) =>
                semesterOrderDate(a).localeCompare(semesterOrderDate(b)) ||
                a.name.localeCompare(b.name),
        );
}

export const calendarCourses: Course[] = [
    { code: "CISC 275", meetingDays: [1, 3, 5] },
    { code: "CISC 320", meetingDays: [2, 4] },
];

export function courseKey(code: string, section = ""): string {
    return section ? `${code} - Section ${section}` : code;
}

const initialItems: CalendarItem[] = [
    {
        id: "275-task-6",
        course: "CISC 275",
        kind: "activity",
        title: "Task 6",
        detail: "Due 11:59 PM",
        date: "2026-10-11",
    },
    {
        id: "275-immutability",
        course: "CISC 275",
        kind: "topic",
        title: "Immutability",
        date: "2026-10-12",
    },
    {
        id: "275-array-methods",
        course: "CISC 275",
        kind: "topic",
        title: "Higher Order Array Methods",
        date: "2026-10-12",
    },
    {
        id: "275-practice-test",
        course: "CISC 275",
        kind: "activity",
        title: "Practice Test",
        detail: "Due 2:45 PM",
        date: "2026-10-16",
    },
    {
        id: "275-react-intro",
        course: "CISC 275",
        kind: "topic",
        title: "React Introduction",
    },
    {
        id: "275-what-is-se",
        course: "CISC 275",
        kind: "topic",
        title: "What is SE?",
    },
    { id: "275-forms", course: "CISC 275", kind: "topic", title: "Forms" },
    {
        id: "320-dynamic-programming",
        course: "CISC 320",
        kind: "topic",
        title: "Dynamic Programming",
        date: "2026-10-13",
    },
    {
        id: "320-graph-search",
        course: "CISC 320",
        kind: "topic",
        title: "Graph Search",
    },
    {
        id: "320-greedy",
        course: "CISC 320",
        kind: "topic",
        title: "Greedy Algorithms",
    },
];

// Calendar data is saved in this browser so it survives a refresh.
export const ITEMS_KEY = "semester-planner:calendar-items";
// Cancelled classes are stored as "COURSE|YYYY-MM-DD".
export const CANCELLED_KEY = "semester-planner:cancelled-classes";

export function loadSaved<T>(key: string, fallback: T[]): T[] {
    try {
        const saved = localStorage.getItem(key);
        if (saved) {
            const parsed = JSON.parse(saved) as T[] | null;
            if (Array.isArray(parsed)) {
                return parsed;
            }
        }
    } catch {
        // Storage can be blocked or hold bad data; fall back to the defaults.
    }
    return fallback;
}

export function loadCalendarItems(): CalendarItem[] {
    return loadSaved<CalendarItem>(ITEMS_KEY, initialItems).map((item) => ({
        ...item,
        semester:
            item.semester ??
            semesters.find(
                (term) =>
                    item.date &&
                    item.date >= term.start &&
                    item.date <= term.end,
            )?.name ??
            semesters[0].name,
    }));
}

// A name for one semester week of one course, e.g. "Midterm review".
export interface WeekLabel {
    course: string;
    semester: string;
    week: number;
    label: string;
}

export const WEEK_LABELS_KEY = "semester-planner:week-labels";
