import { addDays, parseDateKey, toDateKey } from "./calendarDates";
import { getCalendarSemesters } from "./calendarStorage";
import { getClassesFrom, toScheduledCourse } from "./courseSchedule";

export interface Note {
    id: string;
    title: string;
    body: string;
    courseId: string;
    createdAt: number;
    updatedAt: number;
    // A note about one class meeting: its date, e.g. "2026-10-14".
    classDate?: string;
    // What to pick up with next class. It shows on the course's next class
    // that's still on, so a cancellation moves it along.
    nextClass?: string;
}

type StoredNote = Pick<Note, "id" | "title" | "body"> &
    Partial<
        Pick<
            Note,
            "courseId" | "createdAt" | "updatedAt" | "classDate" | "nextClass"
        >
    >;

export const NOTES_KEY = "semplan-planning-notes";

function optionalString(value?: string): string | undefined {
    return typeof value === "string" && value ? value : undefined;
}

export function loadNotes(): Note[] {
    try {
        const saved = localStorage.getItem(NOTES_KEY);
        if (!saved) return [];

        const parsed = JSON.parse(saved) as Array<StoredNote | null>;
        if (!Array.isArray(parsed)) return [];

        return parsed.flatMap((note, index) => {
            if (
                note === null ||
                typeof note !== "object" ||
                typeof note.id !== "string" ||
                typeof note.title !== "string" ||
                typeof note.body !== "string"
            ) {
                return [];
            }

            // Older notes used a creation timestamp at the start of their ID.
            const idTimestamp = Number(note.id.split("-")[0]);
            const createdAt =
                (
                    typeof note.createdAt === "number" &&
                    Number.isFinite(note.createdAt)
                ) ?
                    note.createdAt
                : Number.isFinite(idTimestamp) && idTimestamp > 0 ? idTimestamp
                : Date.now() - index;

            return [
                {
                    id: note.id,
                    title: note.title,
                    body: note.body,
                    courseId:
                        typeof note.courseId === "string" ? note.courseId : "",
                    createdAt,
                    updatedAt:
                        (
                            typeof note.updatedAt === "number" &&
                            Number.isFinite(note.updatedAt)
                        ) ?
                            note.updatedAt
                        :   createdAt,
                    classDate: optionalString(note.classDate),
                    nextClass: optionalString(note.nextClass),
                },
            ];
        });
    } catch {
        return [];
    }
}

export function saveNotes(notes: Note[]) {
    try {
        localStorage.setItem(NOTES_KEY, JSON.stringify(notes));
    } catch {
        // Notes remain available for the current session if storage is disabled.
    }
}

export function createNoteId(now = Date.now()): string {
    return `${now}-${Math.random().toString(36).slice(2)}`;
}

interface NoteCourse {
    id: string;
    code: string;
    section?: string;
    semester: string;
    schedule: string;
    startDate?: string;
    endDate?: string;
}

// The class a note's "next class" line will show on: the course's first
// class still on after the note's class. Undefined when there's none left.
export function getPickUpDate(
    note: Pick<Note, "courseId" | "classDate">,
    courses: NoteCourse[],
    cancelledClasses: string[],
): string | undefined {
    const course = courses.find((option) => option.id === note.courseId);
    const semester =
        course &&
        getCalendarSemesters(courses).find(
            (term) => term.name === course.semester,
        );
    if (!note.classDate || !course || !semester) {
        return undefined;
    }
    return getClassesFrom(
        toDateKey(addDays(parseDateKey(note.classDate), 1)),
        toScheduledCourse(course),
        semester,
        cancelledClasses,
        1,
    )[0];
}
