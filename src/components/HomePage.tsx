import { useEffect, useState } from "react";
import type { Task } from "../tasks";
import { AddSemesterButton } from "./AddSemesterButton";
import type { Course } from "./CoursesPage";
import { HomeWeekView } from "./HomeWeekView";
import {
    getCalendarSemesters,
    loadCalendarItems,
    loadSaved,
} from "./calendarStorage";
import type { Role } from "./SettingsPage";
import { useSelectedSemester } from "./useSelectedSemester";

const COMPLETED_ACTIVITIES_KEY = "semplan:completed-activities";

interface HomePageProps {
    courses: Course[];
    tasks: Task[];
    role?: Role;
    showTasks: boolean;
    onToggleTask: (id: number) => void;
    onOpenCourse: (course: Course) => void;
}

export function HomePage({
    courses,
    onOpenCourse,
    tasks,
    role,
    showTasks,
    onToggleTask,
}: HomePageProps) {
    const calendarSemesters = getCalendarSemesters(courses);
    const semesters = calendarSemesters.map((term) => term.name);
    const [semester, setSemester] = useSelectedSemester(semesters);
    const [now, setNow] = useState(() => new Date());
    const [activities] = useState(loadCalendarItems);
    const [completedActivities, setCompletedActivities] = useState(() =>
        loadSaved<string>(COMPLETED_ACTIVITIES_KEY, []),
    );
    useEffect(() => {
        try {
            localStorage.setItem(
                COMPLETED_ACTIVITIES_KEY,
                JSON.stringify(completedActivities),
            );
        } catch {
            // Checkboxes still work for this visit if storage is unavailable.
        }
    }, [completedActivities]);
    useEffect(() => {
        const nextDay = new Date(now);
        nextDay.setHours(24, 0, 0, 0);
        const timer = window.setTimeout(
            () => setNow(new Date()),
            Math.max(0, nextDay.getTime() - Date.now()),
        );
        return () => window.clearTimeout(timer);
    }, [now]);
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    const todayTasks = tasks.filter(
        (task) =>
            task.semester === semester &&
            task.startDate <= today &&
            today <= task.finishDate,
    );
    const todayActivities = activities.filter(
        (activity) =>
            activity.kind === "activity" &&
            activity.semester === semester &&
            activity.date === today,
    );
    const todoItems = [
        ...todayTasks.map((task) => ({
            ...task,
            id: `task-${task.id}`,
            onToggle: () => onToggleTask(task.id),
        })),
        ...todayActivities.map((activity) => ({
            id: `activity-${activity.id}`,
            course: activity.course,
            title: activity.title,
            completed: completedActivities.includes(activity.id),
            onToggle: () =>
                setCompletedActivities((current) =>
                    current.includes(activity.id) ?
                        current.filter((id) => id !== activity.id)
                    :   [...current, activity.id],
                ),
        })),
    ];

    const selectedSemester = calendarSemesters.find(
        (term) => term.name === semester,
    );
    const visibleCourses = courses.filter(
        (course) => course.semester === semester,
    );

    return (
        <section className="home-page">
            <header className="home-header">
                <h1>SemPlan</h1>
                <p>Your favorite place to plan your semester!</p>
            </header>

            <section
                className="course-toolbar home-course-toolbar"
                aria-label="Course controls"
            >
                <div className="semester-with-add">
                    <label className="semester-field">
                        <span>Semester</span>
                        <select
                            value={semester}
                            onChange={(event) =>
                                setSemester(event.target.value)
                            }
                        >
                            {semesters.map((term) => (
                                <option key={term}>{term}</option>
                            ))}
                        </select>
                    </label>
                    <AddSemesterButton
                        existing={semesters}
                        role={role}
                        onAdd={setSemester}
                    />
                </div>
            </section>

            {selectedSemester && visibleCourses.length > 0 && (
                <HomeWeekView
                    courses={visibleCourses}
                    semester={selectedSemester}
                    now={now}
                />
            )}

            <div className={`home-columns${showTasks ? " has-tasks" : ""}`}>
                <section
                    className="courses-section"
                    aria-labelledby="courses-title"
                >
                    <h2 id="courses-title">Current courses</h2>
                    {visibleCourses.length > 0 ?
                        <div className="course-grid">
                            {visibleCourses.map((course) => (
                                <article
                                    className="course-card"
                                    key={course.id}
                                >
                                    <h3>{course.code}</h3>
                                    <p>{course.title}</p>
                                    <p>
                                        {course.section ?
                                            `Section ${course.section} · `
                                        :   ""}
                                        {course.semester}
                                    </p>
                                    <button
                                        type="button"
                                        onClick={() => onOpenCourse(course)}
                                    >
                                        Open Course Reflection
                                    </button>
                                </article>
                            ))}
                        </div>
                    :   <p className="empty-message">
                            No courses match this selection.
                        </p>
                    }
                </section>

                {showTasks && (
                    <section
                        className="todo-section"
                        aria-labelledby="todo-title"
                    >
                        <h2 id="todo-title">
                            To-Do &amp; Reminders:{" "}
                            <time dateTime={today}>
                                {now.toLocaleDateString("en-US")}
                            </time>
                        </h2>
                        <div className="todo-table-wrap">
                            <table className="todo-table">
                                <thead>
                                    <tr>
                                        <th scope="col">Course</th>
                                        <th scope="col">Task</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {todoItems.map((task) => (
                                        <tr key={task.id}>
                                            <th scope="row">{task.course}</th>
                                            <td>
                                                <label className="todo-item">
                                                    <input
                                                        type="checkbox"
                                                        checked={task.completed}
                                                        onChange={task.onToggle}
                                                    />
                                                    <span>{task.title}</span>
                                                </label>
                                            </td>
                                        </tr>
                                    ))}
                                    {todoItems.length === 0 && (
                                        <tr>
                                            <td colSpan={2}>
                                                No tasks scheduled for today.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </section>
                )}
            </div>
        </section>
    );
}
