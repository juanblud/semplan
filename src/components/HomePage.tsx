import { useEffect, useState } from "react";
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
