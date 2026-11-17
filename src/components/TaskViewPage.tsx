import { useRef, useState } from "react";
import type { Dispatch, FormEvent, SetStateAction } from "react";
import type { Task } from "../tasks";
import { AddSemesterButton } from "./AddSemesterButton";
import type { Course } from "./CoursesPage";
import { formatShortDate, toDateKey } from "./calendarDates";
import {
    CANCELLED_KEY,
    getCalendarSemesters,
    loadSaved,
} from "./calendarStorage";
import { getClassesFrom, toScheduledCourse } from "./courseSchedule";
import { findTaskCourse, normalizeCourseCode } from "./taskSchedule";
import { useSelectedSemester } from "./useSelectedSemester";

interface TaskViewPageProps {
    courses: Course[];
    tasks: Task[];
    setTasks: Dispatch<SetStateAction<Task[]>>;
}

// How many upcoming classes "Due" offers.
const CLASS_CHOICES = 6;

function formatTaskDate(date: string): string {
    const [year, month, day] = date.split("-");
    return `${month}/${day}/${year}`;
}

export function TaskViewPage({ courses, tasks, setTasks }: TaskViewPageProps) {
    const semesters = getCalendarSemesters([...courses, ...tasks]);
    const semesterNames = semesters.map((term) => term.name);
    const [semester, setSemester] = useSelectedSemester(semesterNames);
    const [title, setTitle] = useState("");
    const [course, setCourse] = useState("All");
    const [courseFilter, setCourseFilter] = useState("All");
    const [dueDate, setDueDate] = useState("");
    // The class a task is due at, or "" for a due date instead.
    const [dueClass, setDueClass] = useState("");
    const [editingId, setEditingId] = useState<number | null>(null);
    const titleInput = useRef<HTMLInputElement>(null);
    const [cancelledClasses] = useState(() =>
        loadSaved<string>(CANCELLED_KEY, []),
    );
    const todayKey = toDateKey(new Date());
    function changeSemester(name: string) {
        setSemester(name);
        setCourse("All");
        setDueClass("");
        setCourseFilter("All");
    }
    // The chosen course's next few classes, for "Due". A task being edited
    // keeps its own class as a choice even once that class has passed.
    const taskCourse =
        course === "All" ? undefined : (
            findTaskCourse({ course, semester }, courses)
        );
    const term = semesters.find((option) => option.name === semester);
    const upcomingClasses =
        taskCourse && term ?
            getClassesFrom(
                todayKey,
                toScheduledCourse(taskCourse),
                term,
                cancelledClasses,
                CLASS_CHOICES,
            )
        :   [];
    const classChoices =
        dueClass && !upcomingClasses.includes(dueClass) ?
            [dueClass, ...upcomingClasses]
        :   upcomingClasses;
    const semesterCourses = courses.filter(
        (item) => item.semester === semester,
    );
    const semesterTasks = tasks.filter((task) => task.semester === semester);
    const filteredSemesterTasks = semesterTasks.filter(
        (task) =>
            courseFilter === "All" ||
            normalizeCourseCode(task.course) === courseFilter,
    );
    const courseOptions = [
        ...new Set([
            ...semesterCourses.map((item) => normalizeCourseCode(item.code)),
            ...semesterTasks.map((task) => normalizeCourseCode(task.course)),
        ]),
    ].filter((code) => code !== "ALL");
    function resetForm() {
        setEditingId(null);
        setTitle("");
        setCourse("All");
        setDueDate("");
        setDueClass("");
    }

    function editTask(task: Task) {
        setEditingId(task.id);
        setTitle(task.title);
        setCourse(
            task.course === "All" ? "All" : normalizeCourseCode(task.course),
        );
        setDueDate(task.dueDate);
        setDueClass(task.dueClass ?? "");
        titleInput.current?.focus();
    }

    function saveTask(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        // A task due at a class is due on that class's date.
        const due = dueClass || dueDate;
        if (!title.trim() || !due) return;
        const details = {
            title: title.trim(),
            course,
            semester,
            dueDate: due,
            dueClass: dueClass || undefined,
        };
        if (editingId !== null) {
            setTasks((current) =>
                current.map((task) =>
                    task.id === editingId ? { ...task, ...details } : task,
                ),
            );
            resetForm();
            return;
        }
        setTasks((current) => [
            ...current,
            {
                id: Math.max(0, ...current.map((task) => task.id)) + 1,
                ...details,
                completed: false,
            },
        ]);
        resetForm();
    }

    return (
        <section className="task-view-page">
            <header className="page-header">
                <h1>Task View</h1>
            </header>
            <div className="task-panel">
                {editingId !== null && (
                    <p className="task-edit-notice" role="status">
                        Editing task — update the fields below, then save.
                    </p>
                )}
                <form
                    className={`task-form${editingId !== null ? " is-editing" : ""}`}
                    onSubmit={saveTask}
                >
                    {editingId === null && (
                        <button
                            type="submit"
                            className="task-add"
                            aria-label="Add task"
                            title="Add task"
                        >
                            +
                        </button>
                    )}
                    <label>
                        Task
                        <input
                            ref={titleInput}
                            required
                            value={title}
                            onChange={(event) => setTitle(event.target.value)}
                        />
                    </label>
                    <div className="task-semester-field semester-with-add">
                        <label>
                            Semester
                            <select
                                required
                                value={semester}
                                onChange={(event) =>
                                    changeSemester(event.target.value)
                                }
                            >
                                {semesterNames.map((term) => (
                                    <option key={term}>{term}</option>
                                ))}
                            </select>
                        </label>
                        <AddSemesterButton
                            existing={semesterNames}
                            onAdd={changeSemester}
                        />
                    </div>
                    <label>
                        Class
                        <select
                            value={course}
                            onChange={(event) => {
                                setCourse(event.target.value);
                                setDueClass("");
                            }}
                        >
                            <option>All</option>
                            {courseOptions.map((code) => (
                                <option key={code}>{code}</option>
                            ))}
                        </select>
                    </label>
                    {classChoices.length > 0 && (
                        <label>
                            Due
                            <select
                                value={dueClass}
                                onChange={(event) =>
                                    setDueClass(event.target.value)
                                }
                            >
                                <option value="">On a date</option>
                                {classChoices.map((date) => (
                                    <option key={date} value={date}>
                                        {formatShortDate(date)}
                                        {date === upcomingClasses.at(0) &&
                                            " · next class"}
                                    </option>
                                ))}
                            </select>
                        </label>
                    )}
                    {/* A class picked above is the due date. */}
                    {!dueClass && (
                        <label>
                            Due date
                            <input
                                type="date"
                                required
                                value={dueDate}
                                onChange={(event) =>
                                    setDueDate(event.target.value)
                                }
                            />
                        </label>
                    )}
                    {editingId !== null && (
                        <div className="task-edit-actions">
                            <button type="submit">Save changes</button>
                            <button type="button" onClick={resetForm}>
                                Cancel
                            </button>
                        </div>
                    )}
                </form>
                <div className="task-filter-bar">
                    <label>
                        Filter by course
                        <select
                            value={courseFilter}
                            onChange={(event) =>
                                setCourseFilter(event.target.value)
                            }
                        >
                            <option>All</option>
                            {courseOptions.map((code) => (
                                <option key={code}>{code}</option>
                            ))}
                        </select>
                    </label>
                </div>
                {semesterTasks.length === 0 && (
                    <p className="task-edit-notice" role="status">
                        No tasks scheduled for {semester}. Add a task above to
                        get started.
                    </p>
                )}
                {semesterTasks.length > 0 &&
                    filteredSemesterTasks.length === 0 && (
                        <p className="task-edit-notice" role="status">
                            No tasks found for {courseFilter} in {semester}.
                        </p>
                    )}
                {[false, true].map((completed) => (
                    <section
                        key={String(completed)}
                        aria-label={
                            completed ? "Completed Tasks" : "Active Tasks"
                        }
                    >
                        <h2>
                            {completed ? "Completed Tasks" : "Active Tasks"}
                        </h2>
                        {!filteredSemesterTasks.some(
                            (task) => task.completed === completed,
                        ) && (
                            <p>
                                {completed ?
                                    "No completed tasks yet."
                                :   "No active tasks."}
                            </p>
                        )}
                        <ul
                            className="task-list"
                            aria-label={completed ? "Completed tasks" : "Tasks"}
                        >
                            {filteredSemesterTasks
                                .filter((task) => task.completed === completed)
                                .map((task) => (
                                    <li
                                        key={task.id}
                                        className={`task-row${task.completed ? " is-complete" : ""}`}
                                    >
                                        <label className="task-title">
                                            <input
                                                type="checkbox"
                                                checked={task.completed}
                                                onChange={() =>
                                                    setTasks((current) =>
                                                        current.map((item) =>
                                                            (
                                                                item.id ===
                                                                task.id
                                                            ) ?
                                                                {
                                                                    ...item,
                                                                    completed:
                                                                        !item.completed,
                                                                }
                                                            :   item,
                                                        ),
                                                    )
                                                }
                                            />
                                            <span>{task.title}</span>
                                        </label>
                                        <span>
                                            <span className="task-mobile-label">
                                                Class:{" "}
                                            </span>
                                            <span>{task.course}</span>
                                            {task.semester && (
                                                <small className="task-semester">
                                                    {task.semester}
                                                </small>
                                            )}
                                        </span>
                                        <span className="task-date">
                                            <span className="task-date-label">
                                                Due date
                                            </span>
                                            <time dateTime={task.dueDate}>
                                                {formatTaskDate(task.dueDate)}
                                            </time>
                                            {task.dueClass && (
                                                <small className="task-due-class">
                                                    {task.movedFrom ?
                                                        `Moved: class on ${formatShortDate(task.movedFrom)} was cancelled`
                                                    :   "Due at class"}
                                                </small>
                                            )}
                                        </span>
                                        <div className="task-actions">
                                            <button
                                                type="button"
                                                aria-label={`Edit ${task.title}`}
                                                onClick={() => editTask(task)}
                                            >
                                                Edit
                                            </button>
                                            <button
                                                type="button"
                                                className="task-delete"
                                                aria-label={`Delete ${task.title}`}
                                                onClick={() => {
                                                    setTasks((current) =>
                                                        current.filter(
                                                            (item) =>
                                                                item.id !==
                                                                task.id,
                                                        ),
                                                    );
                                                    if (editingId === task.id)
                                                        resetForm();
                                                }}
                                            >
                                                Delete
                                            </button>
                                        </div>
                                    </li>
                                ))}
                        </ul>
                    </section>
                ))}
            </div>
        </section>
    );
}
