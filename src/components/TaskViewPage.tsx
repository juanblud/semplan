import { useRef, useState } from "react";
import type { Dispatch, FormEvent, SetStateAction } from "react";
import type { Task } from "../tasks";
import { AddSemesterButton } from "./AddSemesterButton";
import type { Course } from "./CoursesPage";
import { getCalendarSemesters } from "./calendarStorage";
import { useSelectedSemester } from "./useSelectedSemester";

interface TaskViewPageProps {
    courses: Course[];
    tasks: Task[];
    setTasks: Dispatch<SetStateAction<Task[]>>;
}

function formatTaskDate(date: string): string {
    const [year, month, day] = date.split("-");
    return `${month}/${day}/${year}`;
}

function normalizeCourseCode(code: string): string {
    return code.toUpperCase().replace(/\s+/g, "");
}

export function TaskViewPage({ courses, tasks, setTasks }: TaskViewPageProps) {
    const semesters = getCalendarSemesters([...courses, ...tasks]);
    const semesterNames = semesters.map((term) => term.name);
    const [semester, setSemester] = useSelectedSemester(semesterNames);
    const [title, setTitle] = useState("");
    const [course, setCourse] = useState("All");
    const [startDate, setStartDate] = useState("");
    const [finishDate, setFinishDate] = useState("");
    const [editingId, setEditingId] = useState<number | null>(null);
    const titleInput = useRef<HTMLInputElement>(null);
    function changeSemester(name: string) {
        setSemester(name);
        setCourse("All");
    }
    const semesterCourses = courses.filter(
        (item) => item.semester === semester,
    );
    const semesterTasks = tasks.filter((task) => task.semester === semester);
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
        setStartDate("");
        setFinishDate("");
    }

    function editTask(task: Task) {
        setEditingId(task.id);
        setTitle(task.title);
        setCourse(
            task.course === "All" ? "All" : normalizeCourseCode(task.course),
        );
        setStartDate(task.startDate);
        setFinishDate(task.finishDate);
        titleInput.current?.focus();
    }

    function saveTask(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (
            !title.trim() ||
            !startDate ||
            !finishDate ||
            finishDate < startDate
        )
            return;
        if (editingId !== null) {
            setTasks((current) =>
                current.map((task) =>
                    task.id === editingId ?
                        {
                            ...task,
                            title: title.trim(),
                            course,
                            semester,
                            startDate,
                            finishDate,
                        }
                    :   task,
                ),
            );
            resetForm();
            return;
        }
        setTasks((current) => [
            ...current,
            {
                id: Math.max(0, ...current.map((task) => task.id)) + 1,
                title: title.trim(),
                course,
                semester,
                startDate,
                finishDate,
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
                            }}
                        >
                            <option>All</option>
                            {courseOptions.map((code) => (
                                <option key={code}>{code}</option>
                            ))}
                        </select>
                    </label>
                    <label>
                        Start date
                        <input
                            type="date"
                            required
                            value={startDate}
                            onChange={(event) =>
                                setStartDate(event.target.value)
                            }
                        />
                    </label>
                    <label>
                        Finish date
                        <input
                            type="date"
                            required
                            min={startDate || undefined}
                            value={finishDate}
                            onChange={(event) =>
                                setFinishDate(event.target.value)
                            }
                        />
                    </label>
                    {editingId !== null && (
                        <div className="task-edit-actions">
                            <button type="submit">Save changes</button>
                            <button type="button" onClick={resetForm}>
                                Cancel
                            </button>
                        </div>
                    )}
                </form>
                {semesterTasks.length === 0 && (
                    <p className="task-edit-notice" role="status">
                        No tasks scheduled for {semester}. Add a task above to
                        get started.
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
                        {!semesterTasks.some(
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
                            {semesterTasks
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
                                                Start date
                                            </span>
                                            <time dateTime={task.startDate}>
                                                {formatTaskDate(task.startDate)}
                                            </time>
                                        </span>
                                        <span className="task-date">
                                            <span className="task-date-label">
                                                Finish date
                                            </span>
                                            <time dateTime={task.finishDate}>
                                                {formatTaskDate(
                                                    task.finishDate,
                                                )}
                                            </time>
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
