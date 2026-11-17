import { useEffect, useRef, useState } from "react";
import type { CSSProperties, DragEvent, FormEvent } from "react";
import { AddActivityDialog } from "./AddActivityDialog";
import type { NewActivity } from "./AddActivityDialog";
import { AddSemesterButton } from "./AddSemesterButton";
import { CalendarModal } from "./CalendarModal";
import { ClassMeetingDialog } from "./ClassMeetingDialog";
import { ClippedDay } from "./ClippedDay";
import type { CancelPlan } from "./ClassMeetingDialog";
import { loadCourses } from "./CoursesPage";
import type { CalendarCourseSelection } from "./CoursesPage";
import {
    CANCELLED_KEY,
    ITEMS_KEY,
    loadCalendarItems,
    loadSaved,
    REFLECTIONS_KEY,
    WEEK_LABELS_KEY,
    getCalendarSemesters,
    courseKey,
} from "./calendarStorage";
import type { WeekLabel, WeekReflection } from "./calendarStorage";
import type { CalendarItem } from "./scheduleTemplate";
import type { Role } from "./SettingsPage";
import type { Task } from "../tasks";
import { WeekReflectionPanel } from "./WeekReflectionPanel";
import "./CalendarPage.css";
import {
    WEEKDAYS,
    addDays,
    formatLongDate,
    formatShortDate,
    formatTime,
    formatWeekRange,
    getMonthGrid,
    getSemesterWeek,
    getSemesterWeekCount,
    getSemesterWeekStart,
    getWeek,
    parseDateKey,
    startOfMonth,
    toDateKey,
} from "./calendarDates";
import {
    classKey,
    getPreviousClass,
    getStartMinutes,
    isClassMeeting,
    toScheduledCourse,
} from "./courseSchedule";
import type { ScheduledCourse as Course } from "./courseSchedule";
import { useSelectedSemester } from "./useSelectedSemester";
import { createNoteId, loadNotes, saveNotes } from "./planningNotes";
import type { Note } from "./planningNotes";
import { resolveTaskDates } from "./taskSchedule";

interface GoogleCalendarEvent {
    id: string;
    summary?: string;
    start: { date?: string; dateTime?: string };
    end: { date?: string; dateTime?: string };
}

// One course's class on one day.
interface OpenClass {
    course: string;
    date: string;
}

// A topic moved by cancelling a class; no `to` means sent to Unscheduled.
interface TopicMove {
    id: string;
    from: string;
    to?: string;
}

// A just-cancelled class and the topics it moved, so it can be undone.
interface CancelledClass extends OpenClass {
    key: string;
    moves: TopicMove[];
    outcome: string;
}

// Where a dragged topic or activity lands.
type ItemPlacement = Pick<CalendarItem, "course" | "date" | "activityId">;

interface RangeEvents {
    rangeKey: string;
    events: GoogleCalendarEvent[];
    failed: boolean;
}

type CalendarView = "month" | "week";
type CalendarDays = "all" | "mwf" | "tth";

// The course picker's value for planning every course at once.
const ALL_COURSES = "__all__";

// The course of a topic not yet dragged onto any course's class or activity.
const UNASSIGNED = "";

// The Google Calendar API is only used to fetch events for the month or week
// being shown. Set these in .env.local; without a key the calendar still works.
const GOOGLE_API_KEY = import.meta.env.VITE_GOOGLE_CALENDAR_API_KEY as
    string | undefined;
const GOOGLE_CALENDAR_ID =
    (import.meta.env.VITE_GOOGLE_CALENDAR_ID as string | undefined) ??
    "en.usa#holiday@group.v.calendar.google.com";

function save<T>(key: string, value: T[]) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch {
        // Storage is full or blocked; the calendar keeps working unsaved.
    }
}

// Timestamped so ids stay unique across page reloads.
let itemCount = 0;
function createItemId(kind: CalendarItem["kind"]): string {
    itemCount += 1;
    return `${kind}-${Date.now().toString(36)}-${itemCount}`;
}

// All-day Google events have an exclusive end date and may span several days.
function getEventDateKeys(event: GoogleCalendarEvent): string[] {
    if (event.start.dateTime) {
        return [toDateKey(new Date(event.start.dateTime))];
    }
    if (!event.start.date) {
        return [];
    }
    const keys: string[] = [];
    const end = parseDateKey(event.end.date ?? event.start.date);
    let day = parseDateKey(event.start.date);
    do {
        keys.push(toDateKey(day));
        day = addDays(day, 1);
    } while (day < end);
    return keys;
}

// Blocks, and the topics and activities inside them, take their course's color.
function courseColorStyle(color?: string): CSSProperties | undefined {
    return color ? ({ "--course-color": color } as CSSProperties) : undefined;
}

// "Sep 1 – Dec 14, 2026", with both years when the range crosses one.
function formatDateRange(startKey: string, endKey: string): string {
    const start = parseDateKey(startKey);
    const end = parseDateKey(endKey);
    const sameYear = start.getFullYear() === end.getFullYear();
    const startText = start.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        ...(sameYear ? {} : { year: "numeric" }),
    });
    const endText = end.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
    });
    return `${startText} – ${endText}`;
}

// A clipboard marks activities (assignments, tests and the like) so they
// stand apart from the plain topic chips.
// Topics get an open book, activities a clipboard, so neither looks like
// the class meeting they sit in.
function TopicIcon() {
    return (
        <svg
            className="calendar-topic-icon"
            viewBox="0 0 16 16"
            aria-hidden="true"
        >
            <path d="M8 4.5C6.5 3.3 4.5 3 2 3v9.5c2.5 0 4.5.3 6 1.5 1.5-1.2 3.5-1.5 6-1.5V3c-2.5 0-4.5.3-6 1.5z M8 4.5V14" />
        </svg>
    );
}

function ActivityIcon() {
    return (
        <svg
            className="calendar-activity-icon"
            viewBox="0 0 16 16"
            aria-hidden="true"
        >
            <rect x="3" y="3" width="10" height="12" rx="1.5" />
            <path d="M6 2h4v2.5H6z M5.5 8h5 M5.5 11h3.5" />
        </svg>
    );
}

function formatShortTaskDate(date: string): string {
    const [, month, day] = date.split("-");
    return `${Number(month)}/${Number(day)}`;
}

export function CalendarPage({
    role = "student",
    initialCourse,
    initialReflectionOpen = false,
    tasks = [],
    onToggleTask,
}: {
    role?: Role;
    initialCourse?: CalendarCourseSelection;
    initialReflectionOpen?: boolean;
    tasks?: Task[];
    onToggleTask?: (id: number) => void;
}) {
    const [savedCourses] = useState(loadCourses);
    const semesters = getCalendarSemesters(savedCourses);
    const [semesterName, setSemesterName] = useSelectedSemester(
        semesters.map((option) => option.name),
        initialCourse?.semester,
    );
    const semester =
        semesters.find((option) => option.name === semesterName) ??
        semesters[0];
    const [courseCode, setCourseCode] = useState(() =>
        initialCourse ?
            courseKey(initialCourse.code, initialCourse.section)
        :   ALL_COURSES,
    );
    const courses: Course[] = savedCourses
        .filter((course) => course.semester === semesterName)
        .map(toScheduledCourse);
    const [view, setView] = useState<CalendarView>(
        initialReflectionOpen || initialCourse?.focusDate ? "week" : "month",
    );
    // What Home's "Needs attention" asked to point out: a class and/or the
    // unscheduled topics. Shown briefly, then cleared.
    const [attention, setAttention] = useState(() =>
        initialCourse?.focusDate || initialCourse?.highlightTopics ?
            {
                course: courseKey(initialCourse.code, initialCourse.section),
                date: initialCourse.focusDate,
                topics: Boolean(initialCourse.highlightTopics),
            }
        :   null,
    );
    useEffect(() => {
        if (!attention) {
            return;
        }
        const timer = window.setTimeout(() => setAttention(null), 4000);
        return () => window.clearTimeout(timer);
    }, [attention]);
    const [dayFilter, setDayFilter] = useState<CalendarDays>("all");
    const [showWeekends, setShowWeekends] = useState(true);
    const visibleDayIndexes = [0, 1, 2, 3, 4, 5, 6].filter((day) => {
        if (dayFilter === "mwf") {
            return day === 1 || day === 3 || day === 5;
        }
        if (dayFilter === "tth") {
            return day === 2 || day === 4;
        }
        return showWeekends || (day !== 0 && day !== 6);
    });
    // The week highlighted in the monthly view: the current week to start
    // with, then the last one chosen or shown in the weekly view.
    const [selectedWeek, setSelectedWeek] = useState<number | null>(() =>
        getSemesterWeek(new Date(), semester.start, semester.end),
    );
    // The day the calendar is centred on: its month in the monthly view, its
    // week in the weekly view. It opens on today, or on the semester's start
    // when today is outside the semester.
    const [focusDate, setFocusDate] = useState(() =>
        initialCourse?.focusDate ? parseDateKey(initialCourse.focusDate)
        : selectedWeek === null ? parseDateKey(semester.start)
        : new Date(),
    );
    const [items, setItems] = useState<CalendarItem[]>(loadCalendarItems);
    const [cancelledClasses, setCancelledClasses] = useState<string[]>(() =>
        loadSaved<string>(CANCELLED_KEY, []),
    );
    const [openClass, setOpenClass] = useState<OpenClass | null>(null);
    // The last "Fill empty classes", so it can be undone: each topic, the
    // class it went to, and the course it had before.
    const [lastFill, setLastFill] = useState<{
        moves: { id: string; date: string; course: string }[];
    } | null>(null);
    // The month-view day whose "+N more" was clicked, shown in full.
    const [expandedDay, setExpandedDay] = useState<string | null>(null);
    const [lastCancelled, setLastCancelled] = useState<CancelledClass | null>(
        null,
    );
    const [draggedId, setDraggedId] = useState<string | null>(null);
    const [dropTarget, setDropTarget] = useState<string | null>(null);
    const [rangeEvents, setRangeEvents] = useState<RangeEvents | null>(null);
    const [addingActivity, setAddingActivity] = useState(false);
    // Starts open when Home sent an empty class with no topics to fill it.
    const [topicDraft, setTopicDraft] = useState<string | null>(
        initialCourse?.createTopic ? "" : null,
    );
    const [weekLabels, setWeekLabels] = useState<WeekLabel[]>(() =>
        loadSaved<WeekLabel>(WEEK_LABELS_KEY, []),
    );
    const [reflections, setReflections] = useState<WeekReflection[]>(() =>
        loadSaved<WeekReflection>(REFLECTIONS_KEY, []),
    );
    // Planning Notes, for class notes and "pick up next class" lines.
    const [notes, setNotes] = useState<Note[]>(loadNotes);
    const addActivityButton = useRef<HTMLButtonElement>(null);
    const [weekMenuOpen, setWeekMenuOpen] = useState(false);
    const weekMenu = useRef<HTMLDivElement>(null);

    // The week menu closes on a click outside it or Escape, like a dropdown.
    useEffect(() => {
        if (!weekMenuOpen) {
            return;
        }
        function closeOnOutsideClick(event: MouseEvent) {
            if (!weekMenu.current?.contains(event.target as Node)) {
                setWeekMenuOpen(false);
            }
        }
        function closeOnEscape(event: KeyboardEvent) {
            if (event.key === "Escape") {
                setWeekMenuOpen(false);
            }
        }
        document.addEventListener("mousedown", closeOnOutsideClick);
        document.addEventListener("keydown", closeOnEscape);
        return () => {
            document.removeEventListener("mousedown", closeOnOutsideClick);
            document.removeEventListener("keydown", closeOnEscape);
        };
    }, [weekMenuOpen]);

    const course = courses.find((option) => option.code === courseCode) ??
        courses.at(0) ?? { code: "", meetingDays: [], meetingTime: "" };
    const hasCourse = courses.length > 0;
    // With one course, All Courses would show the same thing.
    const canShowAll = courses.length > 1;
    const showAll = canShowAll && courseCode === ALL_COURSES;
    const visibleMonth = startOfMonth(focusDate);
    const grid =
        view === "month" ? getMonthGrid(visibleMonth) : getWeek(focusDate);
    const weeks = Array.from({ length: grid.length / 7 }, (_, week) =>
        grid.slice(week * 7, week * 7 + 7),
    );
    const todayKey = toDateKey(new Date());
    const rangeStart = toDateKey(grid[0]);
    const rangeEnd = toDateKey(addDays(grid[grid.length - 1], 1));
    const rangeKey = `${rangeStart}/${rangeEnd}`;
    const title =
        view === "month" ?
            visibleMonth.toLocaleDateString("en-US", {
                month: "long",
                year: "numeric",
            })
        :   `Week of: ${formatWeekRange(grid[0], grid[6])}`;

    useEffect(() => {
        save(ITEMS_KEY, items);
    }, [items]);

    useEffect(() => {
        save(CANCELLED_KEY, cancelledClasses);
    }, [cancelledClasses]);

    useEffect(() => {
        saveNotes(notes);
    }, [notes]);

    useEffect(() => {
        save(WEEK_LABELS_KEY, weekLabels);
    }, [weekLabels]);

    useEffect(() => {
        save(REFLECTIONS_KEY, reflections);
    }, [reflections]);

    useEffect(() => {
        if (!GOOGLE_API_KEY) {
            return;
        }
        const controller = new AbortController();
        const params = new URLSearchParams({
            key: GOOGLE_API_KEY,
            timeMin: parseDateKey(rangeStart).toISOString(),
            timeMax: parseDateKey(rangeEnd).toISOString(),
            singleEvents: "true",
            orderBy: "startTime",
            maxResults: "250",
        });
        fetch(
            `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(
                GOOGLE_CALENDAR_ID,
            )}/events?${params.toString()}`,
            { signal: controller.signal },
        )
            .then((response) => {
                if (!response.ok) {
                    throw new Error(`Google Calendar ${response.status}`);
                }
                return response.json() as Promise<{
                    items?: GoogleCalendarEvent[];
                }>;
            })
            .then((data) => {
                setRangeEvents({
                    rangeKey,
                    events: data.items ?? [],
                    failed: false,
                });
            })
            .catch(() => {
                if (!controller.signal.aborted) {
                    setRangeEvents({ rangeKey, events: [], failed: true });
                }
            });
        return () => controller.abort();
    }, [rangeKey, rangeStart, rangeEnd]);

    const currentEvents =
        rangeEvents?.rangeKey === rangeKey ? rangeEvents : null;
    const eventsByDate = new Map<string, GoogleCalendarEvent[]>();
    for (const event of currentEvents?.events ?? []) {
        for (const key of getEventDateKeys(event)) {
            eventsByDate.set(key, [...(eventsByDate.get(key) ?? []), event]);
        }
    }

    // All Courses plans every course at once; otherwise just the chosen one.
    // Topics created under All Courses have no course until dragged onto a
    // class or activity, so every course's view lists them.
    const visibleCourses = showAll ? courses : [course];
    const courseItems = items.filter(
        (item) =>
            item.semester === semesterName &&
            (item.course === UNASSIGNED ||
                visibleCourses.some((option) => option.code === item.course)),
    );
    function normalizeCourseCode(code: string): string {
        return code.split(" - Section")[0].replace(/\s+/g, "").toUpperCase();
    }
    const visibleTaskCourses =
        showAll ?
            visibleCourses.map((option) => normalizeCourseCode(option.code))
        :   [normalizeCourseCode(course.code)];
    // Re-worked out here so a task due at a class moves the moment that
    // class is cancelled (or the cancel is undone).
    const calendarTasks = resolveTaskDates(
        tasks,
        savedCourses,
        cancelledClasses,
    ).filter(
        (task) =>
            task.semester === semesterName &&
            (task.course === "All" ||
                visibleTaskCourses.includes(normalizeCourseCode(task.course))),
    );
    const draggedItem = items.find((item) => item.id === draggedId);
    const weekCount = getSemesterWeekCount(semester.start, semester.end);
    const focusWeek = getSemesterWeek(focusDate, semester.start, semester.end);
    const todayWeek = getSemesterWeek(new Date(), semester.start, semester.end);
    // The weekly view always highlights the week it shows.
    const highlightedWeek = view === "week" ? focusWeek : selectedWeek;

    // Week labels belong to one course, so All Courses shows none.
    function getWeekLabel(week: number | null): string {
        if (showAll) {
            return "";
        }
        return (
            weekLabels.find(
                (entry) =>
                    entry.week === week &&
                    entry.course === course.code &&
                    entry.semester === semesterName,
            )?.label ?? ""
        );
    }

    // An empty label removes the entry rather than storing a blank one.
    function setWeekLabel(week: number, label: string) {
        setWeekLabels((current) => [
            ...current.filter(
                (entry) =>
                    !(
                        entry.week === week &&
                        entry.course === course.code &&
                        entry.semester === semesterName
                    ),
            ),
            ...(label ?
                [{ course: course.code, semester: semesterName, week, label }]
            :   []),
        ]);
    }

    function getReflection(week: number): WeekReflection | undefined {
        return reflections.find(
            (entry) =>
                entry.week === week &&
                entry.course === course.code &&
                entry.semester === semesterName,
        );
    }

    // A reflection emptied of everything is removed rather than stored blank.
    function updateReflection(week: number, changes: Partial<WeekReflection>) {
        const next: WeekReflection = {
            ...getReflection(week),
            ...changes,
            course: course.code,
            semester: semesterName,
            week,
        };
        const isEmpty =
            !next.confidence &&
            !next.understood?.trim() &&
            !next.struggled?.trim() &&
            !next.plan?.trim();
        setReflections((current) => [
            ...current.filter(
                (entry) =>
                    !(
                        entry.week === week &&
                        entry.course === course.code &&
                        entry.semester === semesterName
                    ),
            ),
            ...(isEmpty ? [] : [next]),
        ]);
    }

    // The weekly view jumps to the week. The monthly view highlights it, and
    // only changes month when the week isn't on screen, going to the month
    // that holds most of it. Choosing the highlighted week again clears it.
    function selectWeek(week: number) {
        const weekStart = getSemesterWeekStart(week, semester.start);
        if (view === "week") {
            setFocusDate(weekStart);
            setSelectedWeek(week);
            return;
        }
        if (week === selectedWeek) {
            setSelectedWeek(null);
            return;
        }
        setSelectedWeek(week);
        if (!grid.some((day) => toDateKey(day) === toDateKey(weekStart))) {
            setFocusDate(addDays(weekStart, 3));
        }
    }

    const unscheduledTopics = courseItems.filter(
        (item) => item.kind === "topic" && !item.date,
    );

    // Earliest first, so back-to-back classes stack in the order they meet.
    function getMeetings(date: Date): Course[] {
        return visibleCourses
            .filter((option) =>
                isClassMeeting(date, option, semester, cancelledClasses),
            )
            .sort(
                (a, b) =>
                    getStartMinutes(a.meetingTime) -
                    getStartMinutes(b.meetingTime),
            );
    }

    function getClassTopics({ course: code, date }: OpenClass): CalendarItem[] {
        return courseItems.filter(
            (item) =>
                item.kind === "topic" &&
                item.course === code &&
                item.date === date &&
                !item.activityId,
        );
    }

    // The course's classes after this one that are still on, in order.
    function getLaterClasses({ course: code, date }: OpenClass): string[] {
        const option = courses.find((entry) => entry.code === code);
        if (!option) {
            return [];
        }
        const end = option.endDate || semester.end;
        const dates: string[] = [];
        for (
            let day = addDays(parseDateKey(date), 1);
            toDateKey(day) <= end;
            day = addDays(day, 1)
        ) {
            if (isClassMeeting(day, option, semester, cancelledClasses)) {
                dates.push(toDateKey(day));
            }
        }
        return dates;
    }

    // Notes belong to a saved course by id; the calendar knows it by code.
    function getCourseId(code: string): string | undefined {
        return savedCourses.find(
            (option) =>
                option.semester === semesterName &&
                courseKey(option.code, option.section) === code,
        )?.id;
    }

    function getClassNote({ course: code, date }: OpenClass): Note | undefined {
        const id = getCourseId(code);
        return id ?
                notes.find(
                    (note) => note.courseId === id && note.classDate === date,
                )
            :   undefined;
    }

    // "Pick up next class" lines meant for this class: left on the previous
    // class still on, or on classes cancelled since then.
    function getPickUps({ course: code, date }: OpenClass): Note[] {
        const id = getCourseId(code);
        const option = courses.find((entry) => entry.code === code);
        if (!id || !option) {
            return [];
        }
        const previous =
            getPreviousClass(date, option, semester, cancelledClasses) ?? "";
        return notes.filter(
            (note) =>
                note.courseId === id &&
                note.nextClass &&
                note.classDate &&
                note.classDate < date &&
                note.classDate >= previous,
        );
    }

    function saveClassNote(meeting: OpenClass, body: string, next: string) {
        const courseId = getCourseId(meeting.course);
        const existing = getClassNote(meeting);
        const text = body.trim();
        const nextClass = next.trim() || undefined;
        if (
            !courseId ||
            (existing ?
                existing.body === text && existing.nextClass === nextClass
            :   !text && !nextClass)
        ) {
            return;
        }
        const title = `${meeting.course} · ${formatShortDate(meeting.date)}`;
        const now = Date.now();
        setNotes((current) => {
            if (!existing) {
                return [
                    {
                        id: createNoteId(now),
                        title,
                        body: text,
                        courseId,
                        classDate: meeting.date,
                        nextClass,
                        createdAt: now,
                        updatedAt: now,
                    },
                    ...current,
                ];
            }
            // Emptying a note made here removes it; one with its own title
            // from Planning Notes stays.
            if (!text && !nextClass && existing.title === title) {
                return current.filter((note) => note.id !== existing.id);
            }
            return current.map((note) =>
                note.id === existing.id ?
                    {
                        ...note,
                        body: text,
                        nextClass,
                        updatedAt: Math.max(now, note.updatedAt + 1),
                    }
                :   note,
            );
        });
    }

    // For "Fill empty classes": the course's unscheduled topics paired, in
    // order, with its upcoming classes (from today) that have no topics yet.
    function getFillPlan(): { id: string; date: string }[] {
        if (showAll || unscheduledTopics.length === 0) {
            return [];
        }
        const yesterday = toDateKey(addDays(parseDateKey(todayKey), -1));
        const emptyClasses = getLaterClasses({
            course: course.code,
            date: yesterday,
        }).filter(
            (date) =>
                getClassTopics({ course: course.code, date }).length === 0,
        );
        return unscheduledTopics
            .slice(0, emptyClasses.length)
            .map((topic, index) => ({
                id: topic.id,
                date: emptyClasses[index],
            }));
    }

    const fillPlan = getFillPlan();

    function fillEmptyClasses() {
        const plan = getFillPlan();
        if (plan.length === 0) {
            return;
        }
        const moves = plan.map(({ id, date }) => ({
            id,
            date,
            // Topics made under All Courses have no course until placed.
            course: items.find((item) => item.id === id)?.course ?? "",
        }));
        setItems((current) =>
            current.map((item) => {
                const move = moves.find((entry) => entry.id === item.id);
                return move ?
                        {
                            ...item,
                            course: course.code,
                            date: move.date,
                            activityId: undefined,
                        }
                    :   item;
            }),
        );
        setLastCancelled(null);
        setLastFill({ moves });
    }

    // Sends filled topics back, unless they've been moved again since.
    function undoFill() {
        if (!lastFill) {
            return;
        }
        setItems((current) =>
            current.map((item) => {
                const move = lastFill.moves.find(
                    (entry) => entry.id === item.id,
                );
                return move && item.date === move.date && !item.activityId ?
                        { ...item, course: move.course, date: undefined }
                    :   item;
            }),
        );
        setLastFill(null);
    }

    // Activities stay put; the class's topics go where the plan says.
    function cancelClass(meeting: OpenClass, plan: CancelPlan) {
        const key = classKey(meeting.course, meeting.date);
        const topicIds = getClassTopics(meeting).map((item) => item.id);
        const moves: TopicMove[] = [];
        let outcome = "";
        if (plan.kind === "push") {
            // Each class takes the previous one's topics, until a class with
            // nothing planned absorbs them. Past the last class, they go back
            // to Unscheduled topics.
            let carried = topicIds.map((id) => ({ id, from: meeting.date }));
            for (const date of getLaterClasses(meeting)) {
                if (carried.length === 0) {
                    break;
                }
                moves.push(...carried.map((move) => ({ ...move, to: date })));
                carried = getClassTopics({ course: meeting.course, date }).map(
                    (item) => ({ id: item.id, from: date }),
                );
            }
            moves.push(...carried);
            outcome = " Plans pushed back one class.";
        } else {
            const to = plan.kind === "move" ? plan.to : undefined;
            moves.push(
                ...topicIds.map((id) => ({ id, from: meeting.date, to })),
            );
            if (topicIds.length > 0) {
                outcome =
                    to ?
                        ` Topics moved to ${formatLongDate(parseDateKey(to))}.`
                    :   " Topics moved to Unscheduled topics.";
            }
        }
        setItems((current) =>
            current.map((item) => {
                const move = moves.find((entry) => entry.id === item.id);
                return move ? { ...item, date: move.to } : item;
            }),
        );
        // Tasks due at this class now fall on the next one.
        const movedTasks = calendarTasks.filter(
            (task) =>
                task.dueClass &&
                task.finishDate === meeting.date &&
                task.course === normalizeCourseCode(meeting.course),
        ).length;
        if (movedTasks > 0) {
            outcome += ` ${movedTasks} ${movedTasks === 1 ? "task is" : "tasks are"} now due at the next class.`;
        }
        setCancelledClasses((current) => [...current, key]);
        setLastCancelled({ ...meeting, key, moves, outcome });
        setOpenClass(null);
    }

    function undoCancelClass() {
        if (!lastCancelled) {
            return;
        }
        const { key, moves } = lastCancelled;
        setCancelledClasses((current) => current.filter((k) => k !== key));
        // Only topics still where the cancel put them go back; ones moved
        // since stay put.
        setItems((current) =>
            current.map((item) => {
                const move = moves.find((entry) => entry.id === item.id);
                return move && item.date === move.to && !item.activityId ?
                        { ...item, date: move.from }
                    :   item;
            }),
        );
        setLastCancelled(null);
    }

    // Deleting an activity sends its topics back to the unscheduled list.
    function deleteItem(id: string) {
        setItems((current) =>
            current
                .filter((item) => item.id !== id)
                .map((item) =>
                    item.activityId === id ?
                        { ...item, date: undefined, activityId: undefined }
                    :   item,
                ),
        );
    }

    function changePeriod(offset: number) {
        setFocusDate((date) =>
            view === "month" ?
                new Date(date.getFullYear(), date.getMonth() + offset, 1)
            :   addDays(date, offset * 7),
        );
    }

    // Opening the weekly view on the current month starts on this week.
    // The weekly view opens on the selected week if there is one.
    function changeView(next: CalendarView) {
        const today = new Date();
        if (next === "week" && view === "month" && selectedWeek !== null) {
            setFocusDate(getSemesterWeekStart(selectedWeek, semester.start));
        } else if (
            next === "week" &&
            view === "month" &&
            today.getFullYear() === focusDate.getFullYear() &&
            today.getMonth() === focusDate.getMonth()
        ) {
            setFocusDate(today);
        }
        // Leaving the weekly view keeps the week it was showing selected.
        if (next === "month" && view === "week") {
            setSelectedWeek(focusWeek);
        }
        setView(next);
    }

    function changeSemester(name: string) {
        setSemesterName(name);
        setCourseCode(ALL_COURSES);
        setTopicDraft(null);
        setLastCancelled(null);
        setLastFill(null);
        setOpenClass(null);
        setAddingActivity(false);
        // Looked up fresh because the semester may have only just been added.
        const next = getCalendarSemesters(savedCourses).find(
            (option) => option.name === name,
        );
        // Today's week, or nothing when today is outside the new semester.
        setSelectedWeek(
            next ? getSemesterWeek(new Date(), next.start, next.end) : null,
        );
        if (next) {
            setFocusDate(parseDateKey(next.start));
        }
    }

    function closeActivityDialog() {
        setAddingActivity(false);
        addActivityButton.current?.focus();
    }

    // Jump to the new activity so the user sees where it landed.
    function addActivity({ title, date, time, course: code }: NewActivity) {
        if (!hasCourse) return;
        setItems((current) => [
            ...current,
            {
                id: createItemId("activity"),
                course: code,
                semester: semesterName,
                kind: "activity",
                title,
                detail: `Due ${formatTime(time)}`,
                date,
            },
        ]);
        setFocusDate(parseDateKey(date));
        closeActivityDialog();
    }

    // New topics start unscheduled, ready to be dragged onto a class meeting.
    function createTopic(event: FormEvent) {
        event.preventDefault();
        const title = topicDraft?.trim();
        if (!title || !hasCourse) {
            return;
        }
        setItems((current) => [
            ...current,
            {
                id: createItemId("topic"),
                course: showAll ? UNASSIGNED : course.code,
                semester: semesterName,
                kind: "topic",
                title,
            },
        ]);
        setTopicDraft(null);
    }

    // Topics sit inside activities, so stop their drag starting the
    // activity's too.
    function startDrag(event: DragEvent, id: string) {
        event.stopPropagation();
        event.dataTransfer.setData("text/plain", id);
        event.dataTransfer.effectAllowed = "move";
        setDraggedId(id);
    }

    function endDrag() {
        setDraggedId(null);
        setDropTarget(null);
    }

    function allowDrop(event: DragEvent, target: string) {
        if (draggedId) {
            event.preventDefault();
            setDropTarget(target);
        }
    }

    // A dropped item takes on the course it lands in, so one put in the wrong
    // class can be dragged into the right one. An activity's topics move with
    // it.
    function moveItem(id: string, target: ItemPlacement) {
        setItems((current) =>
            current.map((item) =>
                item.id === id ? { ...item, ...target }
                : item.activityId === id ?
                    { ...item, course: target.course, date: target.date }
                :   item,
            ),
        );
    }

    // A topic dropped on a class meeting is scheduled for that day, on an
    // activity it joins that activity, and on the unscheduled list it loses
    // its date. Activities can be dropped on any day.
    function dropItem(target: ItemPlacement) {
        if (draggedId) {
            moveItem(draggedId, target);
        }
        endDrag();
    }

    function renderDeleteButton(item: CalendarItem) {
        return (
            <button
                type="button"
                className="calendar-delete"
                aria-label={`Delete ${item.title}`}
                title={`Delete ${item.kind}`}
                onClick={() => deleteItem(item.id)}
            >
                ×
            </button>
        );
    }

    function renderTopic(item: CalendarItem) {
        return (
            <li
                key={item.id}
                className={`calendar-topic${draggedId === item.id ? " is-dragging" : ""}`}
                draggable
                onDragStart={(event) => startDrag(event, item.id)}
                onDragEnd={endDrag}
            >
                <span className="calendar-topic-title">
                    <TopicIcon />
                    {item.title}
                </span>
                {renderDeleteButton(item)}
            </li>
        );
    }

    // Activities take dropped topics on any day, not just class meetings, so
    // they stop those drag events reaching the day cell. A dragged activity
    // passes over them to the meeting or day underneath.
    function renderActivity(activity: CalendarItem) {
        const target = `activity:${activity.id}`;
        const takesTopic = draggedItem?.kind === "topic";
        const activityTopics = courseItems.filter(
            (item) => item.kind === "topic" && item.activityId === activity.id,
        );
        const title =
            showAll ? `${activity.course}: ${activity.title}` : activity.title;
        const className = [
            "calendar-activity",
            takesTopic && "accepts-drop",
            dropTarget === target && "is-drop-target",
            draggedId === activity.id && "is-dragging",
        ]
            .filter(Boolean)
            .join(" ");

        return (
            <div
                key={activity.id}
                className={className}
                style={courseColorStyle(
                    courses.find((option) => option.code === activity.course)
                        ?.color,
                )}
                role="group"
                aria-label={title}
                draggable
                onDragStart={(event) => startDrag(event, activity.id)}
                onDragEnd={endDrag}
                onDragOver={(event) => {
                    if (takesTopic) {
                        event.stopPropagation();
                        allowDrop(event, target);
                    }
                }}
                onDragLeave={(event) => {
                    if (takesTopic) {
                        event.stopPropagation();
                        setDropTarget(null);
                    }
                }}
                onDrop={(event) => {
                    if (takesTopic) {
                        event.stopPropagation();
                        dropItem({
                            course: activity.course,
                            date: activity.date,
                            activityId: activity.id,
                        });
                    }
                }}
            >
                {renderDeleteButton(activity)}
                <strong>
                    <ActivityIcon />
                    {title}
                </strong>
                {activity.detail && <span>{activity.detail}</span>}
                {activityTopics.length > 0 && (
                    <ul className="calendar-activity-topics">
                        {activityTopics.map(renderTopic)}
                    </ul>
                )}
            </div>
        );
    }

    function renderTask(task: Task) {
        return (
            <div
                key={task.id}
                className={`calendar-task${task.completed ? " is-complete" : ""}`}
                role="group"
                aria-label={task.title}
            >
                <label>
                    <input
                        type="checkbox"
                        checked={task.completed}
                        onChange={() => onToggleTask?.(task.id)}
                        disabled={!onToggleTask}
                    />
                    <strong>{task.title}</strong>
                </label>
                <span>
                    {task.course === "All" ? "Task" : task.course} ·{" "}
                    {"Due\u00a0"}
                    {formatShortTaskDate(task.finishDate)}
                </span>
            </div>
        );
    }

    function renderMeeting(
        meeting: Course,
        date: Date,
        dayItems: CalendarItem[],
    ) {
        const key = toDateKey(date);
        const target = `meeting:${classKey(meeting.code, key)}`;
        const meetingItems = dayItems.filter(
            (item) => item.course === meeting.code,
        );
        const topics = meetingItems.filter(
            (item) => item.kind === "topic" && !item.activityId,
        );
        const activities = meetingItems.filter(
            (item) => item.kind === "activity",
        );
        const meetingClass = { course: meeting.code, date: key };
        const pickUps = getPickUps(meetingClass);
        const hasNote = Boolean(getClassNote(meetingClass)?.body);
        const className = [
            "calendar-meeting",
            dropTarget === target && "is-drop-target",
            attention?.date === key &&
                attention.course === meeting.code &&
                "is-attention",
        ]
            .filter(Boolean)
            .join(" ");

        return (
            // Clicking the meeting, but not its topics or activities, opens
            // the class pop-up. The label button is the keyboard route; its
            // click bubbles up to here.
            <div
                key={meeting.code}
                className={className}
                style={courseColorStyle(meeting.color)}
                onClick={(event) => {
                    const clicked = event.target as Element;
                    if (
                        !clicked.closest(".calendar-topic, .calendar-activity")
                    ) {
                        setExpandedDay(null);
                        setOpenClass({ course: meeting.code, date: key });
                    }
                }}
                onDragOver={(event) => {
                    event.stopPropagation();
                    allowDrop(event, target);
                }}
                onDragLeave={(event) => {
                    event.stopPropagation();
                    setDropTarget(null);
                }}
                onDrop={(event) => {
                    event.stopPropagation();
                    dropItem({
                        course: meeting.code,
                        date: key,
                        activityId: undefined,
                    });
                }}
            >
                <button
                    type="button"
                    className="calendar-meeting-label"
                    aria-label={`${showAll ? `${meeting.code} class` : "Class"} meeting on ${formatLongDate(date)}${
                        meeting.meetingTime ? `, ${meeting.meetingTime}` : ""
                    }${hasNote ? ", has class notes" : ""}`}
                >
                    {showAll ? meeting.code : "Class Meeting"}
                    {hasNote && (
                        <span
                            className="calendar-meeting-note"
                            aria-hidden="true"
                            title="Has class notes"
                        >
                            ✎
                        </span>
                    )}
                    {meeting.meetingTime && (
                        <span className="calendar-meeting-time">
                            {meeting.meetingTime}
                        </span>
                    )}
                </button>
                {pickUps.map((note) => (
                    <p key={note.id} className="calendar-pickup">
                        <strong>Pick up:</strong> {note.nextClass}
                    </p>
                ))}
                <ul>{topics.map(renderTopic)}</ul>
                {activities.map(renderActivity)}
                {view === "week" && meetingItems.length === 0 && (
                    <p className="calendar-placeholder">
                        No Topics or Activities Scheduled
                    </p>
                )}
            </div>
        );
    }

    // Everything on a day: events, classes with their topics and activities,
    // other activities, and tasks. Shared by the grid and the day pop-up.
    function renderDayEntries(date: Date) {
        const key = toDateKey(date);
        const meetings = getMeetings(date);
        const dayItems = courseItems.filter((item) => item.date === key);
        const dayTasks = calendarTasks.filter(
            (task) => task.startDate <= key && key <= task.finishDate,
        );
        // Activities sit in their course's meeting when it meets that day.
        const looseActivities = dayItems
            .filter(
                (item) =>
                    item.kind === "activity" &&
                    !meetings.some((meeting) => meeting.code === item.course),
            )
            .map(renderActivity);
        const dayEvents = eventsByDate.get(key) ?? [];
        return (
            <>
                {dayEvents.map((event) => (
                    <p key={event.id} className="calendar-event">
                        {event.summary ?? "Busy"}
                    </p>
                ))}
                {role === "professor" && key === semester.gradingEnd && (
                    <p className="calendar-event">Grading period ends</p>
                )}
                {meetings.map((meeting) =>
                    renderMeeting(meeting, date, dayItems),
                )}
                {looseActivities}
                {dayTasks.map(renderTask)}
                {view === "week" &&
                    meetings.length === 0 &&
                    looseActivities.length === 0 &&
                    dayTasks.length === 0 &&
                    dayEvents.length === 0 && (
                        <p className="calendar-placeholder">Nothing Planned</p>
                    )}
            </>
        );
    }

    function renderDay(date: Date) {
        const key = toDateKey(date);
        const meetings = getMeetings(date);
        // Outside a meeting, the day takes activities, and topics only when a
        // single course is shown and meets that day.
        const acceptsDrop =
            draggedItem?.kind === "activity" ||
            (!showAll && meetings.length > 0);
        const className = [
            "calendar-day",
            view === "month" &&
                date.getMonth() !== visibleMonth.getMonth() &&
                "is-outside",
            view === "month" && date.getDate() === 1 && "is-month-start",
            key === todayKey && "is-today",
            // The weekly view shows only that week, so it needs no outline.
            view === "month" &&
                highlightedWeek !== null &&
                getSemesterWeek(date, semester.start, semester.end) ===
                    highlightedWeek &&
                "is-selected-week",
            dropTarget === key && "is-drop-target",
        ]
            .filter(Boolean)
            .join(" ");

        return (
            <td
                key={key}
                className={className}
                aria-label={formatLongDate(date)}
                onDragOver={(event) => acceptsDrop && allowDrop(event, key)}
                onDragLeave={() => setDropTarget(null)}
                onDrop={() =>
                    acceptsDrop &&
                    draggedItem &&
                    dropItem({
                        course:
                            draggedItem.kind === "activity" ?
                                draggedItem.course
                            :   course.code,
                        date: key,
                        activityId: undefined,
                    })
                }
            >
                {view === "month" ?
                    // A busy day shows what fits and "+N more" for the rest.
                    <ClippedDay
                        label={formatLongDate(date)}
                        onShowAll={() => setExpandedDay(key)}
                    >
                        <span className="calendar-date">
                            {/* The 1st names its month, marking where one ends. */}
                            {date.getDate() === 1 ?
                                date.toLocaleDateString("en-US", {
                                    month: "short",
                                    day: "numeric",
                                })
                            :   date.getDate()}
                        </span>
                        {renderDayEntries(date)}
                    </ClippedDay>
                :   <div className="calendar-day-content">
                        {renderDayEntries(date)}
                    </div>
                }
            </td>
        );
    }

    return (
        <section className="calendar-page">
            <header className="page-header">
                <h1>Calendar</h1>
                {/* The semester's dates, which drive the week numbers. Shown
                    as text rather than fields since they aren't editable
                    here yet. */}
                <p className="calendar-semester-dates">
                    {semesterName} runs{" "}
                    {formatDateRange(semester.start, semester.end)}
                </p>
                <div className="calendar-print-only" aria-hidden="true">
                    <p>
                        {semesterName} · {showAll ? "All Courses" : course.code}
                    </p>
                    <p>
                        {formatLongDate(parseDateKey(semester.start))} –{" "}
                        {formatLongDate(parseDateKey(semester.end))}
                    </p>
                    <p>
                        {view === "week" ? "Weekly" : "Monthly"} view ·{" "}
                        {visibleDayIndexes
                            .map((index) => WEEKDAYS[index])
                            .join(", ")}
                    </p>
                </div>
            </header>

            <section
                className="calendar-toolbar"
                aria-label="Calendar controls"
            >
                <div className="semester-with-add">
                    <label>
                        <span>Semester</span>
                        <select
                            value={semesterName}
                            onChange={(event) =>
                                changeSemester(event.target.value)
                            }
                        >
                            {semesters.map((option) => (
                                <option key={option.name}>{option.name}</option>
                            ))}
                        </select>
                    </label>
                    <AddSemesterButton
                        existing={semesters.map((option) => option.name)}
                        role={role}
                        onAdd={changeSemester}
                    />
                </div>
                <label>
                    <span>Course</span>
                    <select
                        value={showAll ? ALL_COURSES : course.code}
                        disabled={!hasCourse}
                        onChange={(event) => {
                            setCourseCode(event.target.value);
                            setTopicDraft(null);
                            setLastCancelled(null);
                            setLastFill(null);
                        }}
                    >
                        {!hasCourse && <option value="">No courses</option>}
                        {canShowAll && (
                            <option value={ALL_COURSES}>All Courses</option>
                        )}
                        {courses.map((option) => (
                            <option key={option.code}>{option.code}</option>
                        ))}
                    </select>
                </label>
                <button
                    ref={addActivityButton}
                    type="button"
                    disabled={!hasCourse}
                    onClick={() => setAddingActivity(true)}
                >
                    +&nbsp; Add Activity
                </button>
                <button type="button" onClick={() => window.print()}>
                    Print
                </button>
            </section>

            <div className="calendar-month-nav">
                <button
                    type="button"
                    aria-label={`Previous ${view}`}
                    onClick={() => changePeriod(-1)}
                >
                    ‹
                </button>
                <h2 aria-live="polite">{title}</h2>
                <button
                    type="button"
                    aria-label={`Next ${view}`}
                    onClick={() => changePeriod(1)}
                >
                    ›
                </button>
                <div
                    className="calendar-view-toggle"
                    role="group"
                    aria-labelledby="calendar-view-label"
                >
                    <span id="calendar-view-label">View:</span>
                    <button
                        type="button"
                        aria-pressed={view === "week"}
                        onClick={() => changeView("week")}
                    >
                        Weekly
                    </button>
                    <button
                        type="button"
                        aria-pressed={view === "month"}
                        onClick={() => changeView("month")}
                    >
                        Monthly
                    </button>
                </div>
                {/* Every semester week, to jump straight to one. Labelled
                    weeks show their label. Tucked behind one button so it
                    doesn't take a row of its own. */}
                {hasCourse && (
                    <div className="calendar-week-menu" ref={weekMenu}>
                        <button
                            type="button"
                            className="calendar-week-menu-toggle"
                            aria-expanded={weekMenuOpen}
                            aria-controls="calendar-week-strip"
                            onClick={() => setWeekMenuOpen((open) => !open)}
                        >
                            {highlightedWeek !== null ?
                                `Week ${highlightedWeek} of ${weekCount}`
                            :   "Jump to week"}
                            <span aria-hidden="true"> ▾</span>
                        </button>
                        {weekMenuOpen && (
                            <nav
                                id="calendar-week-strip"
                                className="calendar-week-strip"
                                aria-label="Semester weeks"
                            >
                                {Array.from(
                                    { length: weekCount },
                                    (_, index) => {
                                        const week = index + 1;
                                        const label = getWeekLabel(week);
                                        const className = [
                                            label && "has-label",
                                            week === todayWeek && "is-current",
                                            !showAll &&
                                                getReflection(week) &&
                                                "has-reflection",
                                        ]
                                            .filter(Boolean)
                                            .join(" ");
                                        return (
                                            <button
                                                key={week}
                                                type="button"
                                                className={
                                                    className || undefined
                                                }
                                                aria-pressed={
                                                    week === highlightedWeek
                                                }
                                                title={label || `Week ${week}`}
                                                onClick={() => {
                                                    selectWeek(week);
                                                    setWeekMenuOpen(false);
                                                }}
                                            >
                                                <span>{week}</span>
                                                {label && (
                                                    <small>{label}</small>
                                                )}
                                            </button>
                                        );
                                    },
                                )}
                            </nav>
                        )}
                    </div>
                )}
                <div className="calendar-day-filters">
                    <label>
                        Days
                        <select
                            value={dayFilter}
                            onChange={(event) =>
                                setDayFilter(event.target.value as CalendarDays)
                            }
                        >
                            <option value="all">All days</option>
                            <option value="mwf">
                                Monday / Wednesday / Friday
                            </option>
                            <option value="tth">Tuesday / Thursday</option>
                        </select>
                    </label>
                    <label
                        title={
                            dayFilter !== "all" ?
                                "Choose All days to show weekends"
                            :   undefined
                        }
                    >
                        <input
                            type="checkbox"
                            checked={dayFilter === "all" && showWeekends}
                            disabled={dayFilter !== "all"}
                            onChange={(event) =>
                                setShowWeekends(event.target.checked)
                            }
                        />
                        Show weekends
                    </label>
                </div>
                <ul className="calendar-legend" aria-label="Key">
                    <li>
                        <span
                            className="calendar-legend-swatch is-topic"
                            aria-hidden="true"
                        >
                            <TopicIcon />
                        </span>
                        Topic
                    </li>
                    <li>
                        <span
                            className="calendar-legend-swatch is-activity"
                            aria-hidden="true"
                        >
                            <ActivityIcon />
                        </span>
                        Activity
                    </li>
                </ul>
                {GOOGLE_API_KEY && (
                    <p className="calendar-sync-status">
                        {!currentEvents ?
                            "Loading Google Calendar events…"
                        : currentEvents.failed ?
                            "Couldn't load Google Calendar events."
                        :   "Synced with Google Calendar"}
                    </p>
                )}
            </div>

            {/* DRAFT idea 2: in the weekly view, show the week number and
                let the user name the week. */}
            {hasCourse && !showAll && view === "week" && focusWeek !== null && (
                <div className="calendar-week-label-bar">
                    <span className="calendar-week-badge">
                        Week {focusWeek} of {weekCount}
                    </span>
                    <input
                        type="text"
                        aria-label={`Label for week ${focusWeek}`}
                        placeholder="Label this week, e.g. Midterm review"
                        value={getWeekLabel(focusWeek)}
                        onChange={(event) =>
                            setWeekLabel(focusWeek, event.target.value)
                        }
                    />
                    <span className="calendar-print-only" aria-hidden="true">
                        {getWeekLabel(focusWeek)}
                    </span>
                </div>
            )}

            {hasCourse && view === "week" && focusWeek !== null && !showAll && (
                <WeekReflectionPanel
                    role={role}
                    defaultOpen={initialReflectionOpen}
                    week={focusWeek}
                    reflection={getReflection(focusWeek)}
                    previousPlan={getReflection(focusWeek - 1)?.plan ?? ""}
                    onChange={(changes) => updateReflection(focusWeek, changes)}
                />
            )}
            {hasCourse && view === "week" && focusWeek !== null && showAll && (
                <p className="calendar-reflection-hint">
                    Choose a single course to reflect on this week.
                </p>
            )}

            {lastFill && (
                <div className="calendar-notice" role="status">
                    <span>
                        Placed {lastFill.moves.length}{" "}
                        {lastFill.moves.length === 1 ? "topic" : "topics"} into{" "}
                        {lastFill.moves.length === 1 ?
                            formatLongDate(parseDateKey(lastFill.moves[0].date))
                        :   `classes from ${formatLongDate(
                                parseDateKey(lastFill.moves[0].date),
                            )} to ${formatLongDate(
                                parseDateKey(
                                    lastFill.moves[lastFill.moves.length - 1]
                                        .date,
                                ),
                            )}`
                        }
                        .
                    </span>
                    <button type="button" onClick={undoFill}>
                        Undo
                    </button>
                    <button
                        type="button"
                        className="calendar-delete"
                        aria-label="Dismiss"
                        onClick={() => setLastFill(null)}
                    >
                        ×
                    </button>
                </div>
            )}

            {lastCancelled && (
                <div className="calendar-notice" role="status">
                    <span>
                        {lastCancelled.course} class on{" "}
                        {formatLongDate(parseDateKey(lastCancelled.date))}{" "}
                        cancelled.{lastCancelled.outcome}
                    </span>
                    <button type="button" onClick={undoCancelClass}>
                        Undo
                    </button>
                    <button
                        type="button"
                        className="calendar-delete"
                        aria-label="Dismiss"
                        onClick={() => setLastCancelled(null)}
                    >
                        ×
                    </button>
                </div>
            )}

            {!hasCourse ?
                <p className="empty-message">
                    No courses in this semester. Add a course on the Courses
                    page to start planning.
                </p>
            :   <div className="calendar-layout">
                    <aside
                        className={`calendar-unscheduled${dropTarget === "unscheduled" ? " is-drop-target" : ""}${attention?.topics ? " is-attention" : ""}`}
                        aria-labelledby="unscheduled-title"
                        // Only topics can be unscheduled; they keep their
                        // course.
                        onDragOver={(event) =>
                            draggedItem?.kind === "topic" &&
                            allowDrop(event, "unscheduled")
                        }
                        onDragLeave={() => setDropTarget(null)}
                        onDrop={() =>
                            draggedItem?.kind === "topic" &&
                            dropItem({
                                course: draggedItem.course,
                                date: undefined,
                                activityId: undefined,
                            })
                        }
                    >
                        <h3 id="unscheduled-title">Unscheduled topics</h3>
                        <p>Drag a topic onto a class meeting or activity</p>
                        {unscheduledTopics.length === 0 ?
                            <p className="calendar-empty">
                                All topics scheduled
                            </p>
                        : showAll ?
                            [
                                {
                                    code: UNASSIGNED,
                                    heading: "Not assigned yet",
                                },
                                ...courses.map((option) => ({
                                    code: option.code,
                                    heading: option.code,
                                })),
                            ].map(({ code, heading }) => {
                                const topics = unscheduledTopics.filter(
                                    (item) => item.course === code,
                                );
                                return (
                                    topics.length > 0 && (
                                        <div key={code}>
                                            <h4 className="calendar-unscheduled-course">
                                                {heading}
                                            </h4>
                                            <ul>{topics.map(renderTopic)}</ul>
                                        </div>
                                    )
                                );
                            })
                        :   <ul>{unscheduledTopics.map(renderTopic)}</ul>}
                        {fillPlan.length > 0 && (
                            <button
                                type="button"
                                className="calendar-fill-topics is-secondary"
                                title="Place these topics, in order, into the next classes that have none"
                                onClick={fillEmptyClasses}
                            >
                                Fill {fillPlan.length} empty{" "}
                                {fillPlan.length === 1 ? "class" : "classes"}
                            </button>
                        )}
                        {topicDraft === null ?
                            <button
                                type="button"
                                className="calendar-create-topic"
                                onClick={() => setTopicDraft("")}
                            >
                                +&nbsp; Create Topic
                            </button>
                        :   <form
                                className="calendar-topic-form"
                                onSubmit={createTopic}
                            >
                                <input
                                    type="text"
                                    aria-label="Topic name"
                                    placeholder="Topic name"
                                    value={topicDraft}
                                    autoFocus
                                    onChange={(event) =>
                                        setTopicDraft(event.target.value)
                                    }
                                    onKeyDown={(event) => {
                                        if (event.key === "Escape") {
                                            setTopicDraft(null);
                                        }
                                    }}
                                />
                                <div>
                                    <button
                                        type="button"
                                        className="is-secondary"
                                        onClick={() => setTopicDraft(null)}
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={!topicDraft.trim()}
                                    >
                                        Add
                                    </button>
                                </div>
                            </form>
                        }
                    </aside>

                    <div className="calendar-grid-wrap">
                        <table
                            className={`calendar-grid is-${view}`}
                            style={{
                                minWidth:
                                    visibleDayIndexes.length * 100 +
                                    (view === "month" ? 64 : 0),
                            }}
                        >
                            <thead>
                                <tr>
                                    {/* DRAFT idea 1: a week-number column on
                                        the monthly grid. */}
                                    {view === "month" && (
                                        <th
                                            scope="col"
                                            className="calendar-week-col"
                                        >
                                            <abbr title="Semester week">
                                                Wk
                                            </abbr>
                                        </th>
                                    )}
                                    {visibleDayIndexes.map((index) => (
                                        <th
                                            key={index}
                                            scope="col"
                                            className={
                                                (
                                                    view === "week" &&
                                                    toDateKey(grid[index]) ===
                                                        todayKey
                                                ) ?
                                                    "is-today"
                                                :   undefined
                                            }
                                        >
                                            {view === "month" ?
                                                <abbr title={WEEKDAYS[index]}>
                                                    {WEEKDAYS[index].slice(
                                                        0,
                                                        3,
                                                    )}
                                                </abbr>
                                            :   <>
                                                    {WEEKDAYS[index]}
                                                    <span className="calendar-header-date">
                                                        {grid[index].getDate()}
                                                    </span>
                                                </>
                                            }
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {weeks.map((week) => {
                                    const weekNumber = getSemesterWeek(
                                        week[0],
                                        semester.start,
                                        semester.end,
                                    );
                                    const label = getWeekLabel(weekNumber);
                                    return (
                                        <tr key={toDateKey(week[0])}>
                                            {view === "month" && (
                                                <th
                                                    scope="row"
                                                    className={`calendar-week-col${weekNumber !== null && weekNumber === highlightedWeek ? " is-selected-week" : ""}`}
                                                >
                                                    {weekNumber !== null && (
                                                        <button
                                                            type="button"
                                                            aria-label={`Select week ${weekNumber}`}
                                                            aria-pressed={
                                                                weekNumber ===
                                                                highlightedWeek
                                                            }
                                                            onClick={() =>
                                                                selectWeek(
                                                                    weekNumber,
                                                                )
                                                            }
                                                        >
                                                            <span>
                                                                {weekNumber}
                                                            </span>
                                                            {label && (
                                                                <small>
                                                                    {label}
                                                                </small>
                                                            )}
                                                        </button>
                                                    )}
                                                </th>
                                            )}
                                            {visibleDayIndexes.map((index) =>
                                                renderDay(week[index]),
                                            )}
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            }

            {expandedDay && (
                <CalendarModal
                    labelledBy="day-detail-title"
                    onClose={() => setExpandedDay(null)}
                >
                    <h2 id="day-detail-title">
                        {formatLongDate(parseDateKey(expandedDay))}
                    </h2>
                    <div className="calendar-day-detail">
                        {renderDayEntries(parseDateKey(expandedDay))}
                    </div>
                    <div className="calendar-dialog-actions">
                        <button
                            type="button"
                            className="is-secondary"
                            autoFocus
                            onClick={() => setExpandedDay(null)}
                        >
                            Close
                        </button>
                    </div>
                </CalendarModal>
            )}

            {openClass && (
                <ClassMeetingDialog
                    courseCode={openClass.course}
                    date={parseDateKey(openClass.date)}
                    topics={getClassTopics(openClass)}
                    laterClasses={getLaterClasses(openClass)}
                    note={getClassNote(openClass)}
                    pickUps={getPickUps(openClass)}
                    onSaveNote={(body, next) =>
                        saveClassNote(openClass, body, next)
                    }
                    onCancelClass={(plan) => cancelClass(openClass, plan)}
                    onClose={() => setOpenClass(null)}
                />
            )}

            {addingActivity && (
                <AddActivityDialog
                    courseCode={course.code}
                    courseCodes={visibleCourses.map((option) => option.code)}
                    initialMonth={visibleMonth}
                    onAdd={addActivity}
                    onClose={closeActivityDialog}
                />
            )}
        </section>
    );
}
