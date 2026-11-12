// Sample data so the site has something to show while it's being designed.
// Only main.tsx uses this, so the tests keep their own small starting data.
// To remove it, delete the two placeholder lines in main.tsx and this file.
import {
    CUSTOM_SEMESTERS_KEY,
    ITEMS_KEY,
    REFLECTIONS_KEY,
    WEEK_LABELS_KEY,
    loadCalendarItems,
    loadSaved,
} from "./components/calendarStorage";
import type { WeekLabel, WeekReflection } from "./components/calendarStorage";
import { loadCourses } from "./components/CoursesPage";
import type { Course } from "./components/CoursesPage";
import type { CalendarItem, Semester } from "./components/scheduleTemplate";
import type { Task } from "./tasks";

// These match the storage keys inside CoursesPage and PlanningNotesPage.
const COURSES_KEY = "semester-planner-courses-v1";
const NOTES_KEY = "semplan-planning-notes";
// Set once the placeholders are added, so deleting one doesn't bring it back.
const SEEDED_KEY = "semplan:placeholders-added";

const FALL = "Fall 2026";

const placeholderCourses: Course[] = [
    {
        id: "placeholder-math241",
        code: "MATH 241",
        section: "",
        title: "Analytic Geometry and Calculus A",
        semester: FALL,
        instructor: "Dr. Placeholder",
        schedule: "Mon / Wed / Fri 9:05 AM - 9:55 AM",
        location: "Room 101",
        color: "#c0392b",
    },
    {
        id: "placeholder-engl110",
        code: "ENGL 110",
        section: "",
        title: "Seminar in Composition",
        semester: FALL,
        instructor: "Prof. Example",
        schedule: "Tue / Thu 11:00 AM - 12:15 PM",
        location: "Room 202",
        color: "#e67e22",
    },
    {
        id: "placeholder-phys207",
        code: "PHYS 207",
        section: "",
        title: "Fundamentals of Physics I",
        semester: FALL,
        instructor: "Dr. Sample",
        schedule: "Mon / Wed 2:30 PM - 3:20 PM",
        location: "Room 303",
        color: "#16a085",
    },
    {
        id: "placeholder-cisc220",
        code: "CISC 220",
        section: "",
        title: "Data Structures",
        semester: FALL,
        instructor: "Prof. Demo",
        schedule: "Tue / Thu 2:00 PM - 3:15 PM",
        location: "Room 404",
        color: "#2c3e50",
    },
    {
        id: "placeholder-hist104",
        code: "HIST 104",
        section: "",
        title: "World History",
        semester: FALL,
        instructor: "Dr. Mock",
        schedule: "Fri 1:25 PM - 2:15 PM",
        location: "Room 505",
        color: "#b8860b",
    },
];

export const placeholderTasks: Task[] = [
    {
        id: 101,
        title: "Problem Set 7",
        course: "MATH 241",
        semester: FALL,
        startDate: "2026-11-05",
        finishDate: "2026-11-12",
        completed: false,
    },
    {
        id: 102,
        title: "Essay 2 draft",
        course: "ENGL 110",
        semester: FALL,
        startDate: "2026-11-02",
        finishDate: "2026-11-10",
        completed: false,
    },
    {
        id: 103,
        title: "Lab report 5",
        course: "PHYS 207",
        semester: FALL,
        startDate: "2026-11-09",
        finishDate: "2026-11-13",
        completed: false,
    },
    {
        id: 104,
        title: "Linked list project",
        course: "CISC 220",
        semester: FALL,
        startDate: "2026-11-04",
        finishDate: "2026-11-18",
        completed: false,
    },
    {
        id: 105,
        title: "Reading response 4",
        course: "HIST 104",
        semester: FALL,
        startDate: "2026-11-01",
        finishDate: "2026-11-06",
        completed: true,
    },
];

function item(
    id: string,
    course: string,
    kind: CalendarItem["kind"],
    title: string,
    date?: string,
    detail?: string,
): CalendarItem {
    return {
        id: `placeholder-${id}`,
        course,
        semester: FALL,
        kind,
        title,
        ...(date && { date }),
        ...(detail && { detail }),
    };
}

// Activities (assignments) sit on class days, so they show inside the class
// blocks. Two topics are left unscheduled for the side panel.
const placeholderItems: CalendarItem[] = [
    item("quiz4", "MATH 241", "activity", "Quiz 4", "2026-11-11", "In class"),
    item(
        "essay2",
        "ENGL 110",
        "activity",
        "Essay 2",
        "2026-11-12",
        "Due 11:59 PM",
    ),
    item("lab6", "PHYS 207", "activity", "Lab 6", "2026-11-16", "Due 2:30 PM"),
    item(
        "project3",
        "CISC 220",
        "activity",
        "Project 3",
        "2026-11-17",
        "Due 11:59 PM",
    ),
    item(
        "midterm",
        "HIST 104",
        "activity",
        "Midterm",
        "2026-11-13",
        "In class",
    ),
    item("integrals", "MATH 241", "topic", "Multiple integrals", "2026-11-09"),
    item("thesis", "ENGL 110", "topic", "Thesis statements", "2026-11-10"),
    item("rotation", "PHYS 207", "topic", "Rotational motion", "2026-11-11"),
    item("hashing", "CISC 220", "topic", "Hash tables"),
    item("silk-road", "HIST 104", "topic", "The Silk Road"),
];

const placeholderWeekLabels: WeekLabel[] = [
    [4, "Testing basics"],
    [7, "Midterm review"],
    [9, "Project kickoff"],
    [12, "Sprint demo"],
    [16, "Final presentations"],
].map(([week, label]) => ({
    course: "CISC 275",
    semester: FALL,
    week: week as number,
    label: label as string,
}));

const placeholderReflections: WeekReflection[] = [
    {
        week: 6,
        confidence: 2,
        understood: "Writing simple unit tests.",
        struggled: "Mocking things in tests.",
        plan: "Go to office hours on Tuesday.",
    },
    {
        week: 7,
        confidence: 3,
        understood: "How to mock a function.",
        struggled: "Reading the midterm practice questions quickly.",
        plan: "Do one practice problem each day.",
    },
    {
        week: 8,
        confidence: 4,
        understood: "Most of the midterm material.",
        struggled: "React state updates.",
        plan: "Rebuild the counter example from scratch.",
    },
    {
        week: 9,
        confidence: 3,
        understood: "useState and props.",
        struggled: "Splitting the project into components.",
        plan: "Sketch the components before coding.",
    },
    {
        week: 10,
        confidence: 4,
        understood: "Component structure for our project.",
        struggled: "Merge conflicts in git.",
        plan: "Pull before starting work every day.",
    },
].map((reflection) => ({
    course: "CISC 275",
    semester: FALL,
    ...reflection,
}));

const placeholderSemesters: Semester[] = [
    { name: "Winter 2027", start: "2027-01-04", end: "2027-02-05" },
    { name: "Summer 2027", start: "2027-06-07", end: "2027-08-13" },
    { name: "Fall 2027", start: "2027-08-31", end: "2027-12-13" },
    { name: "Spring 2028", start: "2028-02-07", end: "2028-05-15" },
    { name: "Summer 2028", start: "2028-06-05", end: "2028-08-11" },
];

const placeholderNotes = [
    {
        title: "Weekly study plan",
        body: "- **Mon:** MATH 241 problem set\n- **Tue:** ENGL 110 reading\n- **Wed:** PHYS 207 lab prep\n- **Thu:** CISC 220 project\n- **Fri:** Review the week",
    },
    {
        title: "Midterm dates",
        body: "HIST 104 midterm is **Nov 13** in class.\nAsk about the review session.",
    },
    {
        title: "Project ideas",
        body: "1. Semester planner improvements\n2. Study timer\n3. Flashcard app",
    },
    {
        title: "Office hours",
        body: "MATH 241: Tue 3–4 PM\nCISC 220: Wed 1–2 PM",
    },
    {
        title: "Spring registration",
        body: "> Registration opens Nov 30.\n\nCheck prerequisites for CISC 320.",
    },
].map((note, index) => {
    // Spread out a day apart so the two sort orders differ.
    const time = Date.UTC(2026, 10, 1 + index, 15);
    return {
        id: `placeholder-note-${index + 1}`,
        ...note,
        createdAt: time,
        updatedAt: time + (index % 2 ? 86_400_000 * 3 : 0),
    };
});

// Adds what isn't there yet, so running this twice changes nothing.
function addMissing<T>(
    key: string,
    current: T[],
    extra: T[],
    sameAs: (a: T, b: T) => boolean,
) {
    const missing = extra.filter(
        (entry) => !current.some((existing) => sameAs(existing, entry)),
    );
    if (missing.length > 0) {
        localStorage.setItem(key, JSON.stringify([...current, ...missing]));
    }
}

// Adds the placeholders to this browser's saved data, once.
export function addPlaceholderData() {
    try {
        if (localStorage.getItem(SEEDED_KEY)) return;
        addMissing(
            COURSES_KEY,
            loadCourses(),
            placeholderCourses,
            (a, b) => a.id === b.id,
        );
        addMissing(
            ITEMS_KEY,
            loadCalendarItems(),
            placeholderItems,
            (a, b) => a.id === b.id,
        );
        addMissing(
            WEEK_LABELS_KEY,
            loadSaved<WeekLabel>(WEEK_LABELS_KEY, []),
            placeholderWeekLabels,
            (a, b) =>
                a.course === b.course &&
                a.semester === b.semester &&
                a.week === b.week,
        );
        addMissing(
            REFLECTIONS_KEY,
            loadSaved<WeekReflection>(REFLECTIONS_KEY, []),
            placeholderReflections,
            (a, b) =>
                a.course === b.course &&
                a.semester === b.semester &&
                a.week === b.week,
        );
        addMissing(
            CUSTOM_SEMESTERS_KEY,
            loadSaved<Semester>(CUSTOM_SEMESTERS_KEY, []),
            placeholderSemesters,
            (a, b) => a.name === b.name,
        );
        addMissing(
            NOTES_KEY,
            loadSaved<{ id: string }>(NOTES_KEY, []),
            placeholderNotes,
            (a, b) => a.id === b.id,
        );
        localStorage.setItem(SEEDED_KEY, "true");
    } catch {
        // Storage is blocked or full; the site works without placeholders.
    }
}
