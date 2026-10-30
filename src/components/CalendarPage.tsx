import { useEffect, useRef, useState } from "react";
import type { DragEvent, FormEvent } from "react";
import { AddActivityDialog } from "./AddActivityDialog";
import type { NewActivity } from "./AddActivityDialog";
import { ClassMeetingDialog } from "./ClassMeetingDialog";
import { loadCourses } from "./CoursesPage";
import {
    calendarCourses,
    CANCELLED_KEY,
    courseKey,
    ITEMS_KEY,
    loadCalendarItems,
    loadSaved,
    WEEK_LABELS_KEY,
    getCalendarSemesters,
} from "./calendarStorage";
import type { WeekLabel } from "./calendarStorage";
import type { CalendarItem } from "./scheduleTemplate";
import "./CalendarPage.css";
import {
    WEEKDAYS,
    addDays,
    formatLongDate,
    formatTime,
    getMonthGrid,
    getSemesterWeek,
    getSemesterWeekCount,
    getSemesterWeekStart,
    parseDateKey,
    startOfMonth,
    toDateKey,
} from "./calendarDates";

interface Course {
    code: string;
    meetingDays: number[];
    startDate?: string;
    endDate?: string;
}

interface GoogleCalendarEvent {
    id: string;
    summary?: string;
    start: { date?: string; dateTime?: string };
    end: { date?: string; dateTime?: string };
}

// A just-cancelled class and the topics it sent back, so it can be undone.
interface CancelledClass {
    key: string;
    date: string;
    topicIds: string[];
}

interface RangeEvents {
    rangeKey: string;
    events: GoogleCalendarEvent[];
    failed: boolean;
}

type CalendarView = "month" | "week";

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

function classKey(courseCode: string, date: string): string {
    return `${courseCode}|${date}`;
}

// Timestamped so ids stay unique across page reloads.
let itemCount = 0;
function createItemId(kind: CalendarItem["kind"]): string {
    itemCount += 1;
    return `${kind}-${Date.now().toString(36)}-${itemCount}`;
}

function getWeek(date: Date): Date[] {
    const weekStart = addDays(date, -date.getDay());
    return Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));
}

// e.g. "October 11–17, 2026" or "September 27 – October 3, 2026".
function formatWeekRange(start: Date, end: Date): string {
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

export function CalendarPage() {
    const [savedCourses] = useState(loadCourses);
    const semesters = getCalendarSemesters(savedCourses);
    const [semesterName, setSemesterName] = useState(semesters[0].name);
    const [courseCode, setCourseCode] = useState("");
    const courses: Course[] = savedCourses
        .filter((course) => course.semester === semesterName)
        .map((course) => {
            const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
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
                startDate: course.startDate,
                endDate: course.endDate,
                meetingDays:
                    meetingDays ?
                        [
                            ...new Set(
                                meetingDays.map((day) => weekdays.indexOf(day)),
                            ),
                        ]
                    : !course.schedule.trim() && !course.section ?
                        (defaultCourse?.meetingDays ?? [])
                    :   [],
            };
        });
    const [view, setView] = useState<CalendarView>("month");
    // The week highlighted in the monthly view: the current week to start
    // with, then the last one chosen or shown in the weekly view.
    const [selectedWeek, setSelectedWeek] = useState<number | null>(() =>
        getSemesterWeek(new Date(), semesters[0].start, semesters[0].end),
    );
    // The day the calendar is centred on: its month in the monthly view, its
    // week in the weekly view.
    const [focusDate, setFocusDate] = useState(() => new Date());
    const [items, setItems] = useState<CalendarItem[]>(loadCalendarItems);
    const [cancelledClasses, setCancelledClasses] = useState<string[]>(() =>
        loadSaved<string>(CANCELLED_KEY, []),
    );
    const [openClass, setOpenClass] = useState<string | null>(null);
    const [lastCancelled, setLastCancelled] = useState<CancelledClass | null>(
        null,
    );
    const [draggedId, setDraggedId] = useState<string | null>(null);
    const [dropTarget, setDropTarget] = useState<string | null>(null);
    const [rangeEvents, setRangeEvents] = useState<RangeEvents | null>(null);
    const [addingActivity, setAddingActivity] = useState(false);
    const [topicDraft, setTopicDraft] = useState<string | null>(null);
    const [weekLabels, setWeekLabels] = useState<WeekLabel[]>(() =>
        loadSaved<WeekLabel>(WEEK_LABELS_KEY, []),
    );
    const addActivityButton = useRef<HTMLButtonElement>(null);

    const semester =
        semesters.find((option) => option.name === semesterName) ??
        semesters[0];
    const course = courses.find((option) => option.code === courseCode) ??
        courses.at(0) ?? { code: "", meetingDays: [] };
    const hasCourse = courses.length > 0;
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
        save(WEEK_LABELS_KEY, weekLabels);
    }, [weekLabels]);

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

    const courseItems = items.filter(
        (item) => item.course === course.code && item.semester === semesterName,
    );
    const weekCount = getSemesterWeekCount(semester.start, semester.end);
    const focusWeek = getSemesterWeek(focusDate, semester.start, semester.end);
    const todayWeek = getSemesterWeek(new Date(), semester.start, semester.end);
    // The weekly view always highlights the week it shows.
    const highlightedWeek = view === "week" ? focusWeek : selectedWeek;

    function getWeekLabel(week: number | null): string {
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

    function isClassMeeting(date: Date): boolean {
        const key = toDateKey(date);
        return (
            hasCourse &&
            key >= (course.startDate || semester.start) &&
            key <= (course.endDate || semester.end) &&
            course.meetingDays.includes(date.getDay()) &&
            !cancelledClasses.includes(classKey(course.code, key))
        );
    }

    function getClassTopics(date: string): CalendarItem[] {
        return courseItems.filter(
            (item) =>
                item.kind === "topic" && item.date === date && !item.activityId,
        );
    }

    // The class's topics go back to the unscheduled list; activities stay.
    function cancelClass(date: string) {
        const key = classKey(course.code, date);
        const topicIds = getClassTopics(date).map((item) => item.id);
        setItems((current) =>
            current.map((item) =>
                topicIds.includes(item.id) ?
                    { ...item, date: undefined }
                :   item,
            ),
        );
        setCancelledClasses((current) => [...current, key]);
        setLastCancelled({ key, date, topicIds });
        setOpenClass(null);
    }

    function undoCancelClass() {
        if (!lastCancelled) {
            return;
        }
        const { key, date, topicIds } = lastCancelled;
        setCancelledClasses((current) => current.filter((k) => k !== key));
        // Only topics still unscheduled go back; ones moved since stay put.
        setItems((current) =>
            current.map((item) =>
                topicIds.includes(item.id) && !item.date ?
                    { ...item, date }
                :   item,
            ),
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
        setCourseCode("");
        setTopicDraft(null);
        setLastCancelled(null);
        setOpenClass(null);
        setAddingActivity(false);
        const next = semesters.find((option) => option.name === name);
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
    function addActivity({ title, date, time }: NewActivity) {
        if (!hasCourse) return;
        setItems((current) => [
            ...current,
            {
                id: createItemId("activity"),
                course: course.code,
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
                course: course.code,
                semester: semesterName,
                kind: "topic",
                title,
            },
        ]);
        setTopicDraft(null);
    }

    function startDrag(event: DragEvent, id: string) {
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

    function moveTopic(id: string, date?: string, activityId?: string) {
        setItems((current) =>
            current.map((item) =>
                item.id === id ? { ...item, date, activityId } : item,
            ),
        );
    }

    // A topic dropped on a class meeting is scheduled for that day, on an
    // activity it joins that activity, and on the unscheduled list it loses
    // its date.
    function dropTopic(date?: string, activityId?: string) {
        if (draggedId) {
            moveTopic(draggedId, date, activityId);
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
                {item.title}
                {renderDeleteButton(item)}
            </li>
        );
    }

    // Activities take dropped topics on any day, not just class meetings, so
    // they stop the drag events reaching the day cell.
    function renderActivity(activity: CalendarItem) {
        const target = `activity:${activity.id}`;
        const activityTopics = courseItems.filter(
            (item) => item.kind === "topic" && item.activityId === activity.id,
        );
        const className = [
            "calendar-activity",
            draggedId && "accepts-drop",
            dropTarget === target && "is-drop-target",
        ]
            .filter(Boolean)
            .join(" ");

        return (
            <div
                key={activity.id}
                className={className}
                role="group"
                aria-label={activity.title}
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
                    dropTopic(activity.date, activity.id);
                }}
            >
                {renderDeleteButton(activity)}
                <strong>{activity.title}</strong>
                {activity.detail && <span>{activity.detail}</span>}
                {activityTopics.length > 0 && (
                    <ul className="calendar-activity-topics">
                        {activityTopics.map(renderTopic)}
                    </ul>
                )}
            </div>
        );
    }

    function renderDay(date: Date) {
        const key = toDateKey(date);
        const meeting = isClassMeeting(date);
        const dayItems = courseItems.filter((item) => item.date === key);
        const topics = dayItems.filter(
            (item) => item.kind === "topic" && !item.activityId,
        );
        const activities = dayItems
            .filter((item) => item.kind === "activity")
            .map(renderActivity);
        const dayEvents = eventsByDate.get(key) ?? [];
        const className = [
            "calendar-day",
            view === "month" &&
                date.getMonth() !== visibleMonth.getMonth() &&
                "is-outside",
            key === todayKey && "is-today",
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
                onDragOver={(event) => meeting && allowDrop(event, key)}
                onDragLeave={() => setDropTarget(null)}
                onDrop={() => meeting && dropTopic(key)}
            >
                {view === "month" && (
                    <span className="calendar-date">{date.getDate()}</span>
                )}
                {dayEvents.map((event) => (
                    <p key={event.id} className="calendar-event">
                        {event.summary ?? "Busy"}
                    </p>
                ))}
                {meeting ?
                    // Clicking the meeting, but not its topics or activities,
                    // opens the class pop-up. The label button is the keyboard
                    // route; its click bubbles up to here.
                    <div
                        className="calendar-meeting"
                        onClick={(event) => {
                            const target = event.target as Element;
                            if (
                                !target.closest(
                                    ".calendar-topic, .calendar-activity",
                                )
                            ) {
                                setOpenClass(key);
                            }
                        }}
                    >
                        <button
                            type="button"
                            className="calendar-meeting-label"
                            aria-label={`Class meeting on ${formatLongDate(date)}`}
                        >
                            Class Meeting
                        </button>
                        <ul>{topics.map(renderTopic)}</ul>
                        {activities}
                        {view === "week" && dayItems.length === 0 && (
                            <p className="calendar-placeholder">
                                No Topics or Activities Scheduled
                            </p>
                        )}
                    </div>
                :   activities}
                {view === "week" &&
                    !meeting &&
                    activities.length === 0 &&
                    dayEvents.length === 0 && (
                        <p className="calendar-placeholder">Nothing Planned</p>
                    )}
            </td>
        );
    }

    return (
        <section className="calendar-page">
            <header className="page-header">
                <h1>Calendar</h1>
            </header>

            <section
                className="calendar-toolbar"
                aria-label="Calendar controls"
            >
                <label>
                    <span>Semester</span>
                    <select
                        value={semesterName}
                        onChange={(event) => changeSemester(event.target.value)}
                    >
                        {semesters.map((option) => (
                            <option key={option.name}>{option.name}</option>
                        ))}
                    </select>
                </label>
                {/* PLACEHOLDER: the semester's first and last day drive the
                    week numbers. These show the built-in dates for now; they
                    will become editable once they are tied in with the course
                    input on the Courses page. */}
                <label>
                    <span>First day</span>
                    <input
                        type="date"
                        value={semester.start}
                        disabled
                        title="Editing semester dates is coming soon"
                    />
                </label>
                <label>
                    <span>Last day</span>
                    <input
                        type="date"
                        value={semester.end}
                        disabled
                        title="Editing semester dates is coming soon"
                    />
                </label>
                <label>
                    <span>Course</span>
                    <select
                        value={course.code}
                        disabled={!hasCourse}
                        onChange={(event) => {
                            setCourseCode(event.target.value);
                            setTopicDraft(null);
                            setLastCancelled(null);
                        }}
                    >
                        {!hasCourse && <option value="">No courses</option>}
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
            {hasCourse && view === "week" && focusWeek !== null && (
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
                </div>
            )}

            {/* DRAFT idea 3: a numbered strip of every semester week, to jump
                straight to one. Labelled weeks show their label. */}
            {hasCourse && (
                <nav
                    className="calendar-week-strip"
                    aria-label="Semester weeks"
                >
                    {Array.from({ length: weekCount }, (_, index) => {
                        const week = index + 1;
                        const label = getWeekLabel(week);
                        const className = [
                            label && "has-label",
                            week === todayWeek && "is-current",
                        ]
                            .filter(Boolean)
                            .join(" ");
                        return (
                            <button
                                key={week}
                                type="button"
                                className={className || undefined}
                                aria-pressed={week === highlightedWeek}
                                title={label || `Week ${week}`}
                                onClick={() => selectWeek(week)}
                            >
                                <span>{week}</span>
                                {label && <small>{label}</small>}
                            </button>
                        );
                    })}
                </nav>
            )}

            {lastCancelled && (
                <div className="calendar-notice" role="status">
                    <span>
                        {course.code} class on{" "}
                        {formatLongDate(parseDateKey(lastCancelled.date))}{" "}
                        cancelled.
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
                        className={`calendar-unscheduled${dropTarget === "unscheduled" ? " is-drop-target" : ""}`}
                        aria-labelledby="unscheduled-title"
                        onDragOver={(event) => allowDrop(event, "unscheduled")}
                        onDragLeave={() => setDropTarget(null)}
                        onDrop={() => dropTopic(undefined)}
                    >
                        <h3 id="unscheduled-title">Unscheduled topics</h3>
                        <p>Drag a topic onto a class meeting or activity</p>
                        {unscheduledTopics.length > 0 ?
                            <ul>{unscheduledTopics.map(renderTopic)}</ul>
                        :   <p className="calendar-empty">
                                All topics scheduled
                            </p>
                        }
                        {topicDraft === null ?
                            <button
                                type="button"
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
                        <table className={`calendar-grid is-${view}`}>
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
                                    {WEEKDAYS.map((day, index) => (
                                        <th
                                            key={day}
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
                                                <abbr title={day}>
                                                    {day.slice(0, 3)}
                                                </abbr>
                                            :   <>
                                                    {day}
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
                                            {week.map(renderDay)}
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            }

            {openClass && (
                <ClassMeetingDialog
                    courseCode={course.code}
                    date={parseDateKey(openClass)}
                    topicCount={getClassTopics(openClass).length}
                    onCancelClass={() => cancelClass(openClass)}
                    onClose={() => setOpenClass(null)}
                />
            )}

            {addingActivity && (
                <AddActivityDialog
                    courseCode={course.code}
                    initialMonth={visibleMonth}
                    onAdd={addActivity}
                    onClose={closeActivityDialog}
                />
            )}
        </section>
    );
}
