import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import type { Task } from "../tasks";
import "./CalendarPage.css";
import { formatWeekRange } from "./calendarDates";

type Item = {
    id: number;
    title: string;
    course: string;
    date: string;
    kind: "Topic" | "Activity";
    time?: string;
};
const initialItems: Item[] = [
    {
        id: 1,
        title: "Task 6",
        course: "CISC 275",
        date: "2026-10-11",
        kind: "Activity",
        time: "23:59",
    },
    {
        id: 2,
        title: "Immutability",
        course: "CISC 275",
        date: "2026-10-12",
        kind: "Topic",
    },
    {
        id: 3,
        title: "Higher Order Array Methods",
        course: "CISC 275",
        date: "2026-10-12",
        kind: "Topic",
    },
    {
        id: 4,
        title: "Practice Test",
        course: "CISC 275",
        date: "2026-10-16",
        kind: "Activity",
        time: "14:45",
    },
    ...["React Introduction", "What is SE?", "Forms"].map((title, i) => ({
        id: i + 5,
        title,
        course: "CISC 275",
        date: "",
        kind: "Topic" as const,
    })),
];
const weekdays = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
];
function dateKey(date: Date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
function dueTime(time: string) {
    const [hour, minute] = time.split(":").map(Number);
    return `${hour % 12 || 12}:${String(minute).padStart(2, "0")} ${hour >= 12 ? "PM" : "AM"}`;
}
interface CalendarPageProps {
    tasks?: Task[];
    onToggleTask?: (id: number) => void;
}
export function CalendarPage({ tasks = [], onToggleTask }: CalendarPageProps) {
    const [semester, setSemester] = useState("Fall 2026");
    const [course, setCourse] = useState("CISC 275");
    const [week, setWeek] = useState(new Date(2026, 9, 11));
    const [items, setItems] = useState(initialItems);
    const [editor, setEditor] = useState<
        "Topic" | "Activity" | "Schedule Topic" | null
    >(null);
    const editorDialog = useRef<HTMLDialogElement>(null);
    useEffect(() => {
        if (!editor) return;
        const previousFocus = document.activeElement;
        editorDialog.current?.showModal();
        return () => {
            if (previousFocus instanceof HTMLElement) previousFocus.focus();
        };
    }, [editor]);
    const [workload, setWorkload] = useState(false);
    const [selected, setSelected] = useState<number | null>(null);
    const [notice, setNotice] = useState("");
    const days = weekdays.map((name, i) => {
        const date = new Date(week);
        date.setDate(date.getDate() + i);
        return { name, date, key: dateKey(date) };
    });
    const courseItems = items.filter((item) => item.course === course);
    const semesterItems = courseItems.filter((item) =>
        semester === "Fall 2026" ?
            item.date >= "2026-08-01" && item.date < "2027-01-01"
        :   item.date >= "2027-01-01" && item.date < "2027-06-01",
    );
    const unscheduled = courseItems.filter((item) => !item.date);
    const meetingDates: Date[] = [];
    const semesterStart =
        semester === "Fall 2026" ? "2026-08-01" : "2027-01-01";
    const semesterEnd = semester === "Fall 2026" ? "2026-12-31" : "2027-05-31";
    for (
        const date = new Date(`${semesterStart}T12:00:00`);
        dateKey(date) <= semesterEnd;
        date.setDate(date.getDate() + 1)
    ) {
        if ([1, 3, 5].includes(date.getDay()))
            meetingDates.push(new Date(date));
    }
    const defaultMeeting =
        meetingDates.find((date) => dateKey(date) >= dateKey(week)) ??
        meetingDates[0];
    function moveWeek(direction: number) {
        const next = new Date(week);
        next.setDate(next.getDate() + direction * 7);
        setWeek(next);
    }
    function schedule(id: number, date: string) {
        if (!meetingDates.some((meetingDate) => dateKey(meetingDate) === date))
            return;
        if (!unscheduled.some((item) => item.id === id)) return;
        setItems((current) =>
            current.map((item) => (item.id === id ? { ...item, date } : item)),
        );
        setSelected(null);
        setNotice("Topic scheduled.");
    }
    function save(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        const textField = (name: string) => {
            const value = data.get(name);
            return typeof value === "string" ? value : "";
        };
        if (editor === "Schedule Topic") {
            schedule(Number(data.get("topic")), textField("date"));
            setEditor(null);
            return;
        }
        const title = textField("title").trim();
        if (!title || !editor) return;
        setItems((current) => [
            ...current,
            {
                id: Math.max(...current.map((item) => item.id), 0) + 1,
                title,
                course,
                kind: editor,
                date: editor === "Topic" ? "" : textField("date"),
                time: textField("time"),
            },
        ]);
        setEditor(null);
        setNotice(`${editor} added.`);
    }
    return (
        <section className="calendar-page">
            <header className="page-header">
                <h1>Calendar</h1>
                <p>
                    Plan class meetings, schedule topics, and keep deadlines in
                    view.
                </p>
            </header>
            <div className="course-toolbar calendar-toolbar">
                <label>
                    Semester
                    <select
                        value={semester}
                        onChange={(event) => {
                            setSemester(event.target.value);
                            setWeek(
                                event.target.value === "Fall 2026" ?
                                    new Date(2026, 9, 11)
                                :   new Date(2027, 1, 7),
                            );
                        }}
                    >
                        <option>Fall 2026</option>
                        <option>Spring 2027</option>
                    </select>
                </label>
                <label>
                    Course
                    <select
                        value={course}
                        onChange={(event) => {
                            setCourse(event.target.value);
                            setSelected(null);
                        }}
                    >
                        <option>CISC 275</option>
                        <option>CISC 320</option>
                    </select>
                </label>
                <button
                    className="calendar-button primary"
                    onClick={() => setEditor("Activity")}
                >
                    + Add Activity
                </button>
                <button
                    className="calendar-button"
                    aria-expanded={workload}
                    onClick={() => setWorkload(!workload)}
                >
                    View Semester Workload
                </button>
            </div>
            {workload && (
                <section
                    className="calendar-workload"
                    aria-label="Semester workload"
                >
                    <h2>
                        {course} - {semester}
                    </h2>
                    <p>
                        {
                            semesterItems.filter(
                                (item) => item.kind === "Topic",
                            ).length
                        }{" "}
                        scheduled topics -{" "}
                        {
                            semesterItems.filter(
                                (item) => item.kind === "Activity",
                            ).length
                        }{" "}
                        activities - {unscheduled.length} unscheduled topics
                    </p>
                </section>
            )}
            <div className="calendar-week-nav">
                <button
                    className="calendar-button"
                    aria-label="Previous week"
                    onClick={() => moveWeek(-1)}
                >
                    {"<"}
                </button>
                <h2 aria-live="polite">
                    Week of: {formatWeekRange(week, days[6].date)}
                </h2>
                <button
                    className="calendar-button"
                    aria-label="Next week"
                    onClick={() => moveWeek(1)}
                >
                    {">"}
                </button>
            </div>
            <div className="calendar-layout">
                <aside
                    className="calendar-topics"
                    aria-labelledby="unscheduled-title"
                >
                    <h2 id="unscheduled-title">Unscheduled topics</h2>
                    <p>
                        Drag a topic onto a day, or select it and choose a day.
                    </p>
                    <div className="calendar-topic-list">
                        {unscheduled.map((topic) => (
                            <button
                                key={topic.id}
                                className="calendar-topic"
                                draggable
                                onDragStart={(event) =>
                                    event.dataTransfer.setData(
                                        "text/plain",
                                        String(topic.id),
                                    )
                                }
                                onClick={() =>
                                    setSelected(
                                        selected === topic.id ? null : topic.id,
                                    )
                                }
                                aria-pressed={selected === topic.id}
                            >
                                {topic.title}
                            </button>
                        ))}
                        {!unscheduled.length && <p>No unscheduled topics.</p>}
                    </div>
                    <button
                        className="calendar-button"
                        onClick={() => setEditor("Topic")}
                    >
                        + Create topic
                    </button>
                    <button
                        className="calendar-button"
                        onClick={() => {
                            setEditor("Schedule Topic");
                        }}
                    >
                        + Add Topic
                    </button>
                </aside>
                <div className="calendar-grid-scroll">
                    <div className="calendar-grid" aria-label="Weekly calendar">
                        {days.map((day, index) => {
                            const entries = semesterItems.filter(
                                (item) => item.date === day.key,
                            );
                            const meeting = [1, 3, 5].includes(index);
                            const dayTasks = tasks.filter(
                                (task) =>
                                    task.date === day.key &&
                                    (task.course === "All" ||
                                        task.course
                                            .replace(/\s/g, "")
                                            .toLowerCase() ===
                                            course
                                                .replace(/\s/g, "")
                                                .toLowerCase()),
                            );
                            return (
                                <section
                                    className="calendar-day"
                                    key={day.key}
                                    aria-label={`${day.name}, ${day.key}`}
                                    onDragOver={(event) =>
                                        event.preventDefault()
                                    }
                                    onDrop={(event) => {
                                        event.preventDefault();
                                        schedule(
                                            Number(
                                                event.dataTransfer.getData(
                                                    "text/plain",
                                                ),
                                            ),
                                            day.key,
                                        );
                                    }}
                                >
                                    <header>
                                        <h3>{day.name}</h3>
                                        <time dateTime={day.key}>
                                            {day.date.toLocaleDateString(
                                                "en-US",
                                                {
                                                    month: "short",
                                                    day: "numeric",
                                                },
                                            )}
                                        </time>
                                    </header>
                                    <div
                                        className="calendar-day-body"
                                        tabIndex={0}
                                        role="region"
                                        aria-label={`${day.name} topics, activities, and tasks`}
                                    >
                                        <div
                                            className={
                                                meeting ?
                                                    "calendar-class-meeting"
                                                :   undefined
                                            }
                                        >
                                            {meeting && (
                                                <p className="calendar-meeting-label">
                                                    Class Meeting
                                                </p>
                                            )}
                                            {entries.map((item) => (
                                                <article
                                                    key={item.id}
                                                    className={`calendar-event ${item.kind.toLowerCase()}`}
                                                >
                                                    <span>{item.kind}</span>
                                                    <h4>{item.title}</h4>
                                                    {item.time && (
                                                        <p>
                                                            Due{" "}
                                                            {dueTime(item.time)}
                                                        </p>
                                                    )}
                                                    {item.kind === "Topic" && (
                                                        <button
                                                            className="calendar-unschedule"
                                                            aria-label={`Unschedule ${item.title}`}
                                                            onClick={() =>
                                                                setItems(
                                                                    (current) =>
                                                                        current.map(
                                                                            (
                                                                                entry,
                                                                            ) =>
                                                                                (
                                                                                    entry.id ===
                                                                                    item.id
                                                                                ) ?
                                                                                    {
                                                                                        ...entry,
                                                                                        date: "",
                                                                                    }
                                                                                :   entry,
                                                                        ),
                                                                )
                                                            }
                                                        >
                                                            -
                                                        </button>
                                                    )}
                                                </article>
                                            ))}
                                            {(!entries.length || !meeting) && (
                                                <p className="calendar-day-empty">
                                                    {meeting ?
                                                        "No topics or activities scheduled"
                                                    :   "No Class"}
                                                </p>
                                            )}
                                            {selected !== null && meeting && (
                                                <button
                                                    className="calendar-schedule"
                                                    onClick={() =>
                                                        schedule(
                                                            selected,
                                                            day.key,
                                                        )
                                                    }
                                                >
                                                    + Schedule here
                                                </button>
                                            )}
                                        </div>
                                        {dayTasks.length > 0 && (
                                            <section
                                                className="calendar-tasks"
                                                aria-label={`${day.name} tasks`}
                                            >
                                                <h4>Tasks</h4>
                                                {dayTasks.map((task) => (
                                                    <article
                                                        className="calendar-event calendar-task"
                                                        key={task.id}
                                                    >
                                                        <label className="todo-item">
                                                            <input
                                                                type="checkbox"
                                                                checked={
                                                                    task.completed
                                                                }
                                                                disabled={
                                                                    !onToggleTask
                                                                }
                                                                onChange={() =>
                                                                    onToggleTask?.(
                                                                        task.id,
                                                                    )
                                                                }
                                                            />
                                                            <span>
                                                                {task.title}
                                                            </span>
                                                        </label>
                                                        <p>
                                                            {(
                                                                task.course ===
                                                                "All"
                                                            ) ?
                                                                "All courses"
                                                            :   task.course}
                                                        </p>
                                                    </article>
                                                ))}
                                            </section>
                                        )}
                                    </div>
                                </section>
                            );
                        })}
                    </div>
                </div>
            </div>
            <p role="status" className="calendar-notice">
                {notice}
            </p>
            {editor && (
                <dialog
                    ref={editorDialog}
                    className="calendar-editor"
                    aria-labelledby="calendar-editor-title"
                    onCancel={() => setEditor(null)}
                >
                    <h2 id="calendar-editor-title">
                        {editor === "Schedule Topic" ?
                            "Add topic to class meeting"
                        : editor === "Topic" ?
                            "Create topic"
                        :   "Add activity"}
                    </h2>
                    <form onSubmit={save}>
                        {editor === "Schedule Topic" ?
                            <>
                                <label>
                                    Available topic
                                    <select
                                        name="topic"
                                        required
                                        autoFocus
                                        defaultValue={selected ?? ""}
                                    >
                                        <option value="" disabled>
                                            Choose a topic
                                        </option>
                                        {unscheduled.map((topic) => (
                                            <option
                                                key={topic.id}
                                                value={topic.id}
                                            >
                                                {topic.title}
                                            </option>
                                        ))}
                                    </select>
                                </label>
                                <label>
                                    Class meeting date
                                    <select
                                        name="date"
                                        required
                                        defaultValue={dateKey(defaultMeeting)}
                                    >
                                        {meetingDates.map((date) => (
                                            <option
                                                key={dateKey(date)}
                                                value={dateKey(date)}
                                            >
                                                {date.toLocaleDateString(
                                                    "en-US",
                                                    {
                                                        weekday: "long",
                                                        month: "long",
                                                        day: "numeric",
                                                        year: "numeric",
                                                    },
                                                )}
                                            </option>
                                        ))}
                                    </select>
                                </label>
                                {unscheduled.length === 0 && (
                                    <p>
                                        No available topics. Create a topic
                                        first.
                                    </p>
                                )}
                            </>
                        :   <label>
                                Title
                                <input
                                    name="title"
                                    required
                                    maxLength={120}
                                    autoFocus
                                />
                            </label>
                        }
                        {editor === "Activity" && (
                            <label>
                                Date
                                <input
                                    type="date"
                                    name="date"
                                    required
                                    defaultValue={dateKey(week)}
                                    min={
                                        semester === "Fall 2026" ? "2026-08-01"
                                        :   "2027-01-01"
                                    }
                                    max={
                                        semester === "Fall 2026" ? "2026-12-31"
                                        :   "2027-05-31"
                                    }
                                />
                            </label>
                        )}
                        {editor === "Activity" && (
                            <label>
                                Due time
                                <input
                                    type="time"
                                    name="time"
                                    defaultValue="23:59"
                                />
                            </label>
                        )}
                        <button
                            className="calendar-button primary"
                            type="submit"
                            disabled={
                                editor === "Schedule Topic" &&
                                unscheduled.length === 0
                            }
                        >
                            Save{" "}
                            {editor === "Schedule Topic" ?
                                "topic"
                            :   editor.toLowerCase()}
                        </button>
                        <button
                            className="calendar-button"
                            type="button"
                            onClick={() => setEditor(null)}
                        >
                            Cancel
                        </button>
                    </form>
                </dialog>
            )}
        </section>
    );
}
