import { Fragment, useEffect, useState } from "react";
import type { Task } from "../tasks";
import { AddSemesterButton } from "./AddSemesterButton";
import type { Course } from "./CoursesPage";
import { HomeWeekView } from "./HomeWeekView";
import {
    CANCELLED_KEY,
    getCalendarSemesters,
    loadCalendarItems,
    loadSaved,
} from "./calendarStorage";
import {
    addDays,
    formatShortDate,
    parseDateKey,
    toDateKey,
} from "./calendarDates";
import { getCoursePlan } from "./coursePlan";
import type { Role } from "./SettingsPage";
import { useSelectedSemester } from "./useSelectedSemester";

const COMPLETED_ACTIVITIES_KEY = "semplan:completed-activities";

// How soon before grades are due Home starts mentioning it.
const GRADING_NOTICE_DAYS = 30;

function formatTodoDate(date: string | undefined) {
    if (!date) return "—";
    return new Date(`${date}T00:00:00`).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
    });
}

function formatTodoDay(date: string) {
    return new Date(`${date}T00:00:00`).toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
    });
}

interface HomePageProps {
    courses: Course[];
    tasks: Task[];
    role?: Role;
    showTasks: boolean;
    onToggleTask: (id: number) => void;
    onOpenCourse: (course: Course) => void;
    // Opens a course in the Calendar to plan it, pointing out what needs it.
    onPlanCourse?: (course: Course, focus: PlanFocus) => void;
    // Opens a course's Edit form on the Courses page.
    onEditCourse?: (course: Course) => void;
}

// What the Calendar points out when a "Needs attention" line is clicked.
export interface PlanFocus {
    // The first class this week with nothing planned.
    focusDate?: string;
    // There are unscheduled topics to drag in.
    highlightTopics: boolean;
    // There's an empty class but no topics to fill it: start a new one.
    createTopic: boolean;
}

// One thing for a professor to look at, with the place to sort it out.
interface AttentionItem {
    id: string;
    course?: Course;
    text: string;
    action: string;
    onAction?: () => void;
    // For the "Not started yet" line: each course, linked to start it.
    links?: { course: Course; onClick: () => void }[];
}

// How many "Needs attention" lines show before "Show N more".
const ATTENTION_SHOWN = 3;

export function HomePage({
    courses,
    onOpenCourse,
    tasks,
    role,
    showTasks,
    onToggleTask,
    onPlanCourse,
    onEditCourse,
}: HomePageProps) {
    const calendarSemesters = getCalendarSemesters(courses);
    const semesters = calendarSemesters.map((term) => term.name);
    const [semester, setSemester] = useSelectedSemester(semesters);
    const [now, setNow] = useState(() => new Date());
    const [showAllAttention, setShowAllAttention] = useState(false);
    const [expandedCompletedDays, setExpandedCompletedDays] = useState<
        string[]
    >([]);
    const [showOlderTasks, setShowOlderTasks] = useState(false);
    const [activities] = useState(loadCalendarItems);
    const [cancelledClasses] = useState(() =>
        loadSaved<string>(CANCELLED_KEY, []),
    );
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
    const today = toDateKey(now);
    const cutoffDate = new Date(now);
    cutoffDate.setDate(cutoffDate.getDate() + 14);
    const cutoff = toDateKey(cutoffDate);
    const upcomingTasks = tasks.filter(
        (task) =>
            task.semester === semester &&
            task.dueDate >= today &&
            task.dueDate <= cutoff,
    );
    const olderTaskItems = tasks
        .filter((task) => task.semester === semester && task.dueDate < today)
        .map((task) => ({
            ...task,
            id: "older-task-" + task.id,
            onToggle: () => onToggleTask(task.id),
        }));
    const upcomingActivities = activities.filter(
        (activity) =>
            activity.kind === "activity" &&
            activity.semester === semester &&
            activity.date !== undefined &&
            activity.date >= today &&
            activity.date <= cutoff,
    );
    const todoItems = [
        ...upcomingTasks.map((task) => ({
            ...task,
            id: `task-${task.id}`,
            onToggle: () => onToggleTask(task.id),
        })),
        ...upcomingActivities.map((activity) => ({
            id: `activity-${activity.id}`,
            course: activity.course,
            title: activity.title,
            dueDate: activity.date,
            completed: completedActivities.includes(activity.id),
            onToggle: () =>
                setCompletedActivities((current) =>
                    current.includes(activity.id) ?
                        current.filter((id) => id !== activity.id)
                    :   [...current, activity.id],
                ),
        })),
    ].sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? ""));
    const activeTodoItems = todoItems.filter((item) => !item.completed);
    const completedTodoItems = todoItems.filter((item) => item.completed);
    const todoDays = [
        ...new Set(
            todoItems
                .map((item) => item.dueDate)
                .filter((date): date is string => date !== undefined),
        ),
    ];
    const toggleCompletedDay = (date: string) =>
        setExpandedCompletedDays((current) =>
            current.includes(date) ?
                current.filter((item) => item !== date)
            :   [...current, date],
        );

    const selectedSemester = calendarSemesters.find(
        (term) => term.name === semester,
    );
    const visibleCourses = courses.filter(
        (course) => course.semester === semester,
    );

    // Professors get a list worked out from what they've already entered:
    // nothing here asks them to type anything.
    const showAttention = role === "professor";
    const attention: AttentionItem[] = [];
    // Courses with nothing planned at all share one line rather than each
    // getting their own, which at the start of a semester would be all of
    // them.
    const notStarted: AttentionItem["links"] = [];
    if (showAttention && selectedSemester) {
        for (const course of visibleCourses) {
            const plan = getCoursePlan(
                course,
                selectedSemester,
                activities,
                cancelledClasses,
                now,
            );
            if (!plan.hasSchedule) {
                attention.push({
                    id: `${course.id}-schedule`,
                    course,
                    text: "No meeting times set, so no classes to plan.",
                    action: "Add times",
                    onAction: () => onEditCourse?.(course),
                });
                continue;
            }
            if (!plan.started) {
                // Opens the course's first upcoming class, ready for a topic.
                notStarted.push({
                    course,
                    onClick: () =>
                        onPlanCourse?.(course, {
                            focusDate: plan.nextClass,
                            highlightTopics: false,
                            createTopic: true,
                        }),
                });
                continue;
            }
            // One line per course, so the list stays short with many courses.
            const notes: string[] = [];
            if (plan.emptyClassesThisWeek.length > 0) {
                const [first] = plan.emptyClassesThisWeek;
                const more = plan.emptyClassesThisWeek.length - 1;
                notes.push(
                    `${formatShortDate(first)} has nothing planned${
                        more > 0 ? ` (+${more} more this week)` : ""
                    }`,
                );
            }
            if (plan.unscheduledTopics > 0) {
                notes.push(
                    `${plan.unscheduledTopics} unscheduled ${
                        plan.unscheduledTopics === 1 ? "topic" : "topics"
                    } for ${plan.classesLeft} ${
                        plan.classesLeft === 1 ? "class" : "classes"
                    } left`,
                );
            }
            if (notes.length > 0) {
                attention.push({
                    id: course.id,
                    course,
                    text: `${notes.join("; ")}.`,
                    action: "Plan",
                    onAction: () =>
                        onPlanCourse?.(course, {
                            focusDate: plan.emptyClassesThisWeek.at(0),
                            highlightTopics: plan.unscheduledTopics > 0,
                            createTopic:
                                plan.emptyClassesThisWeek.length > 0 &&
                                plan.unscheduledTopics === 0,
                        }),
                });
            }
        }
        if (notStarted.length > 0) {
            attention.push({
                id: "not-started",
                text: "Not started yet:",
                action: "",
                links: notStarted,
            });
        }
        const gradingEnd = selectedSemester.gradingEnd;
        if (
            gradingEnd &&
            gradingEnd >= today &&
            gradingEnd <= toDateKey(addDays(now, GRADING_NOTICE_DAYS))
        ) {
            const days = Math.round(
                (parseDateKey(gradingEnd).getTime() -
                    parseDateKey(today).getTime()) /
                    86_400_000,
            );
            attention.unshift({
                id: "grading",
                text: `Grades are due ${
                    days === 0 ? "today"
                    : days === 1 ? "tomorrow"
                    : `in ${days} days`
                } (${formatShortDate(gradingEnd)}).`,
                action: "",
            });
        }
    }

    return (
        <section className="home-page">
            <header className="home-header">
                <h1>SemPlan</h1>
                <p>
                    {role === "professor" ?
                        "Your courses at a glance, and what needs planning next."
                    :   "Your favorite place to plan your semester!"}
                </p>
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

            <div
                className={`home-columns${showTasks || showAttention ? " has-tasks" : ""}`}
            >
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

                {showAttention && (
                    <section
                        className="todo-section attention-section"
                        aria-labelledby="attention-title"
                    >
                        <h2 id="attention-title">Needs attention</h2>
                        {attention.length === 0 ?
                            <p className="attention-clear">
                                You&apos;re all set: every class this week has
                                something planned.
                            </p>
                        :   <>
                                <ul className="attention-list">
                                    {(showAllAttention ? attention : (
                                        attention.slice(0, ATTENTION_SHOWN)
                                    )
                                    ).map((item) => (
                                        <li
                                            key={item.id}
                                            className={
                                                item.links ? "is-not-started"
                                                :   undefined
                                            }
                                            style={
                                                item.course && {
                                                    borderLeftColor:
                                                        item.course.color,
                                                }
                                            }
                                        >
                                            <span>
                                                {item.course && (
                                                    <strong>
                                                        {item.course.code}
                                                        {item.course.section &&
                                                            ` (${item.course.section})`}
                                                    </strong>
                                                )}{" "}
                                                {item.text}
                                                {item.links?.map(
                                                    (link, index) => (
                                                        <span
                                                            key={link.course.id}
                                                        >
                                                            {index > 0 && ","}{" "}
                                                            <button
                                                                type="button"
                                                                className="attention-link"
                                                                aria-label={`Start planning ${link.course.code}`}
                                                                onClick={
                                                                    link.onClick
                                                                }
                                                            >
                                                                {
                                                                    link.course
                                                                        .code
                                                                }
                                                            </button>
                                                        </span>
                                                    ),
                                                )}
                                            </span>
                                            {item.action && item.onAction && (
                                                <button
                                                    type="button"
                                                    onClick={item.onAction}
                                                >
                                                    {item.action}
                                                </button>
                                            )}
                                        </li>
                                    ))}
                                </ul>
                                {attention.length > ATTENTION_SHOWN && (
                                    <button
                                        type="button"
                                        className="attention-more"
                                        aria-expanded={showAllAttention}
                                        onClick={() =>
                                            setShowAllAttention(
                                                (shown) => !shown,
                                            )
                                        }
                                    >
                                        {showAllAttention ?
                                            "Show less"
                                        :   `Show ${attention.length - ATTENTION_SHOWN} more`
                                        }
                                    </button>
                                )}
                            </>
                        }
                    </section>
                )}

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
                            {" – "}
                            <time dateTime={cutoff}>
                                {cutoffDate.toLocaleDateString("en-US")}
                            </time>
                        </h2>
                        <div className="todo-table-wrap">
                            <table className="todo-table">
                                <thead>
                                    <tr>
                                        <th scope="col">Course</th>
                                        <th scope="col">Task</th>
                                        <th scope="col">Due</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {todoDays.map((date) => (
                                        <Fragment key={date}>
                                            <tr
                                                className="todo-day-heading"
                                                key={`${date}-heading`}
                                            >
                                                <th
                                                    colSpan={3}
                                                    scope="colgroup"
                                                >
                                                    <time dateTime={date}>
                                                        {date === today ?
                                                            "Today · "
                                                        :   ""}
                                                        {formatTodoDay(date)}
                                                    </time>
                                                </th>
                                            </tr>
                                            {activeTodoItems
                                                .filter(
                                                    (task) =>
                                                        task.dueDate === date,
                                                )
                                                .map((task) => (
                                                    <tr key={task.id}>
                                                        <th scope="row">
                                                            {task.course}
                                                        </th>
                                                        <td>
                                                            <label className="todo-item">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={
                                                                        task.completed
                                                                    }
                                                                    onChange={
                                                                        task.onToggle
                                                                    }
                                                                />
                                                                <span>
                                                                    {task.title}
                                                                </span>
                                                            </label>
                                                        </td>
                                                        <td className="todo-date-cell">
                                                            <time
                                                                dateTime={
                                                                    task.dueDate
                                                                }
                                                            >
                                                                {formatTodoDate(
                                                                    task.dueDate,
                                                                )}
                                                            </time>
                                                        </td>
                                                    </tr>
                                                ))}
                                            {(() => {
                                                const dayCompletedItems =
                                                    completedTodoItems.filter(
                                                        (task) =>
                                                            task.dueDate ===
                                                            date,
                                                    );
                                                const completedExpanded =
                                                    expandedCompletedDays.includes(
                                                        date,
                                                    );

                                                return (
                                                        dayCompletedItems.length >
                                                            0
                                                    ) ?
                                                        <>
                                                            <tr className="todo-completed-summary">
                                                                <td colSpan={3}>
                                                                    <button
                                                                        type="button"
                                                                        className="todo-completed-toggle"
                                                                        aria-expanded={
                                                                            completedExpanded
                                                                        }
                                                                        onClick={() =>
                                                                            toggleCompletedDay(
                                                                                date,
                                                                            )
                                                                        }
                                                                    >
                                                                        <span
                                                                            className="todo-completed-chevron"
                                                                            aria-hidden="true"
                                                                        >
                                                                            {(
                                                                                completedExpanded
                                                                            ) ?
                                                                                "▾"
                                                                            :   "▸"
                                                                            }
                                                                        </span>
                                                                        {(
                                                                            completedExpanded
                                                                        ) ?
                                                                            "Hide"
                                                                        :   "Show"
                                                                        }{" "}
                                                                        {
                                                                            dayCompletedItems.length
                                                                        }{" "}
                                                                        completed{" "}
                                                                        {(
                                                                            dayCompletedItems.length ===
                                                                            1
                                                                        ) ?
                                                                            "item"
                                                                        :   "items"
                                                                        }
                                                                    </button>
                                                                </td>
                                                            </tr>
                                                            {completedExpanded &&
                                                                dayCompletedItems.map(
                                                                    (task) => (
                                                                        <tr
                                                                            key={
                                                                                task.id
                                                                            }
                                                                            className="todo-completed-row"
                                                                        >
                                                                            <th scope="row">
                                                                                {
                                                                                    task.course
                                                                                }
                                                                            </th>
                                                                            <td>
                                                                                <label className="todo-item">
                                                                                    <input
                                                                                        type="checkbox"
                                                                                        checked={
                                                                                            task.completed
                                                                                        }
                                                                                        onChange={
                                                                                            task.onToggle
                                                                                        }
                                                                                    />
                                                                                    <span>
                                                                                        {
                                                                                            task.title
                                                                                        }
                                                                                    </span>
                                                                                </label>
                                                                            </td>
                                                                            <td className="todo-date-cell">
                                                                                <time
                                                                                    dateTime={
                                                                                        task.dueDate
                                                                                    }
                                                                                >
                                                                                    {formatTodoDate(
                                                                                        task.dueDate,
                                                                                    )}
                                                                                </time>
                                                                            </td>
                                                                        </tr>
                                                                    ),
                                                                )}
                                                        </>
                                                    :   null;
                                            })()}
                                        </Fragment>
                                    ))}
                                    {/* Legacy global completed-items rendering is kept disabled; completed items render beneath their own day. */}
                                    {/*
                                    {showCompletedTodo &&
                                        completedTodoItems.length > 0 && (
                                            <tr className="todo-completed-summary">
                                                <td colSpan={3}>
                                                    <button
                                                        type="button"
                                                        className="todo-completed-toggle"
                                                        aria-expanded={
                                                            showCompletedTodo
                                                        }
                                                        onClick={() =>
                                                            setShowCompletedTodo(
                                                                (current) =>
                                                                    !current,
                                                            )
                                                        }
                                                    >
                                                        <span
                                                            className="todo-completed-chevron"
                                                            aria-hidden="true"
                                                        >
                                                            {showCompletedTodo ?
                                                                "▾"
                                                            :   "▸"}
                                                        </span>
                                                        {showCompletedTodo ?
                                                            "Hide"
                                                        :   "Show"}{" "}
                                                        {
                                                            completedTodoItems.length
                                                        }{" "}
                                                        completed{" "}
                                                        {(
                                                            completedTodoItems.length ===
                                                            1
                                                        ) ?
                                                            "item"
                                                        :   "items"}
                                                    </button>
                                                </td>
                                            </tr>
                                        )}
                                    {showCompletedTodo &&
                                        completedTodoDays.map((date) => (
                                            <Fragment key={`completed-${date}`}>
                                                <tr className="todo-day-heading todo-completed-day-heading">
                                                    <th
                                                        colSpan={3}
                                                        scope="colgroup"
                                                    >
                                                        <time dateTime={date}>
                                                            {date === today ?
                                                                "Today · "
                                                            :   ""}
                                                            {formatTodoDay(
                                                                date,
                                                            )}
                                                        </time>
                                                    </th>
                                                </tr>
                                                {completedTodoItems
                                                    .filter(
                                                        (task) =>
                                                            task.dueDate ===
                                                            date,
                                                    )
                                                    .map((task) => (
                                                        <tr
                                                            key={task.id}
                                                            className="todo-completed-row"
                                                        >
                                                            <th scope="row">
                                                                {task.course}
                                                            </th>
                                                            <td>
                                                                <label className="todo-item">
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={
                                                                            task.completed
                                                                        }
                                                                        onChange={
                                                                            task.onToggle
                                                                        }
                                                                    />
                                                                    <span>
                                                                        {
                                                                            task.title
                                                                        }
                                                                    </span>
                                                                </label>
                                                            </td>
                                                            <td className="todo-date-cell">
                                                                <time
                                                                    dateTime={
                                                                        task.dueDate
                                                                    }
                                                                >
                                                                    {formatTodoDate(
                                                                        task.dueDate,
                                                                    )}
                                                                </time>
                                                            </td>
                                                        </tr>
                                                    ))}
                                            </Fragment>
                                        ))}
                                    */}
                                    {olderTaskItems.length > 0 && (
                                        <tr className="todo-completed-summary todo-older-summary">
                                            <td colSpan={3}>
                                                <button
                                                    type="button"
                                                    className="todo-completed-toggle"
                                                    aria-expanded={
                                                        showOlderTasks
                                                    }
                                                    onClick={() =>
                                                        setShowOlderTasks(
                                                            (current) =>
                                                                !current,
                                                        )
                                                    }
                                                >
                                                    <span
                                                        className="todo-completed-chevron"
                                                        aria-hidden="true"
                                                    >
                                                        {showOlderTasks ?
                                                            "▾"
                                                        :   "▸"}
                                                    </span>
                                                    {showOlderTasks ?
                                                        "Hide"
                                                    :   "Show"}{" "}
                                                    {olderTaskItems.length}{" "}
                                                    older{" "}
                                                    {(
                                                        olderTaskItems.length ===
                                                        1
                                                    ) ?
                                                        "task"
                                                    :   "tasks"}
                                                </button>
                                            </td>
                                        </tr>
                                    )}
                                    {showOlderTasks &&
                                        olderTaskItems.map((task) => (
                                            <tr
                                                key={task.id}
                                                className={
                                                    task.completed ?
                                                        "todo-completed-row"
                                                    :   "todo-older-row"
                                                }
                                            >
                                                <th scope="row">
                                                    {task.course}
                                                </th>
                                                <td>
                                                    <label className="todo-item">
                                                        <input
                                                            type="checkbox"
                                                            checked={
                                                                task.completed
                                                            }
                                                            onChange={
                                                                task.onToggle
                                                            }
                                                        />
                                                        <span>
                                                            {task.title}
                                                        </span>
                                                    </label>
                                                </td>
                                                <td className="todo-date-cell">
                                                    <time
                                                        dateTime={task.dueDate}
                                                    >
                                                        {formatTodoDate(
                                                            task.dueDate,
                                                        )}
                                                    </time>
                                                </td>
                                            </tr>
                                        ))}
                                    {todoItems.length === 0 &&
                                        olderTaskItems.length === 0 && (
                                            <tr>
                                                <td colSpan={3}>
                                                    No tasks or reminders due in
                                                    this window.
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
