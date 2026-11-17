import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import type { Task } from "../tasks";
import "./CoursesPage.css";
import { TEMPLATE_KEY } from "./savedTemplates";
import type { SavedTemplate } from "./savedTemplates";
import {
    loadSaved,
    loadCalendarItems,
    getCalendarSemesters,
    CANCELLED_KEY,
    ITEMS_KEY,
    courseKey,
} from "./calendarStorage";
import { copySchedule } from "./scheduleTemplate";
import { ScheduleTemplateActions } from "./ScheduleTemplateActions";
import { MeetingScheduleFields } from "./MeetingScheduleFields";
import type { MeetingSchedule, MeetingTime } from "./MeetingScheduleFields";
import { formatShortDate, parseDateKey } from "./calendarDates";
import { AddSemesterButton } from "./AddSemesterButton";
import { getCoursePlan } from "./coursePlan";
import type { CoursePlan } from "./coursePlan";
import type { Role } from "./SettingsPage";
import { useSelectedSemester } from "./useSelectedSemester";

export interface Course {
    id: string;
    code: string;
    section: string;
    title: string;
    semester: string;
    instructor: string;
    schedule: string;
    location: string;
    color: string;
    startDate?: string;
    endDate?: string;
}
export interface CalendarCourseSelection {
    code: string;
    section?: string;
    semester: string;
    schedule: string;
    // From Home's "Needs attention": a class to open the week on and point
    // out, whether to point out the unscheduled topics, and whether to open
    // the new-topic form because there are none to drag in.
    focusDate?: string;
    highlightTopics?: boolean;
    createTopic?: boolean;
}
const storageKey = "semester-planner-courses-v1";
const initialCourses: Course[] = [
    {
        id: "cisc275",
        code: "CISC 275",
        section: "",
        title: "Software Engineering",
        semester: "Fall 2026",
        instructor: "",
        schedule: "",
        location: "",
        color: "#00539f",
    },
    {
        id: "cisc320",
        code: "CISC 320",
        section: "",
        title: "Algorithms",
        semester: "Fall 2026",
        instructor: "",
        schedule: "",
        location: "",
        color: "#6e4799",
    },
];
function normalize(value: string) {
    return value.toLowerCase().replace(/\s/g, "");
}

const LAST_INSTRUCTOR_KEY = "semplan:last-instructor";

function loadLastInstructor(): string {
    try {
        return localStorage.getItem(LAST_INSTRUCTOR_KEY) ?? "";
    } catch {
        return "";
    }
}

function saveLastInstructor(name: string) {
    try {
        localStorage.setItem(LAST_INSTRUCTOR_KEY, name);
    } catch {
        // Only a convenience; the course itself still saves.
    }
}

// The blank details a course card offers to fill in, e.g. "instructor and
// location". A section is optional, so it isn't asked for.
function missingDetails(course: Course): string {
    const missing = [
        !course.instructor && "instructor",
        !course.schedule && "meeting times",
        !course.location && "location",
    ].filter((entry): entry is string => Boolean(entry));
    return missing.length > 1 ?
            `${missing.slice(0, -1).join(", ")} and ${missing.at(-1)}`
        :   (missing.at(0) ?? "");
}

// A professor's at-a-glance plan for a course, in place of student tasks.
function CoursePlanSummary({ plan }: { plan?: CoursePlan }) {
    if (!plan?.hasSchedule) {
        return (
            <div className="course-task-summary">
                <strong>No class meetings yet</strong>
                <p>Add meeting times to see classes left and plan topics.</p>
            </div>
        );
    }
    const unplanned = plan.classesLeft - plan.plannedClassesLeft;
    return (
        <div className="course-task-summary course-plan-summary">
            <strong>
                {plan.classesLeft}{" "}
                {plan.classesLeft === 1 ? "class" : "classes"} left
                {plan.nextClass && ` · next ${formatShortDate(plan.nextClass)}`}
            </strong>
            {plan.classesLeft > 0 && (
                <div
                    className="course-plan-meter"
                    role="img"
                    aria-label={`${plan.plannedClassesLeft} of ${plan.classesLeft} upcoming classes planned`}
                >
                    <span
                        style={{
                            width: `${(plan.plannedClassesLeft / plan.classesLeft) * 100}%`,
                        }}
                    />
                </div>
            )}
            <p>
                {plan.classesLeft === 0 ?
                    "No classes left this semester."
                : unplanned === 0 ?
                    "Every upcoming class has something planned."
                :   `${plan.plannedClassesLeft} of ${plan.classesLeft} planned · ${unplanned} still open`
                }
                {plan.unscheduledTopics > 0 &&
                    ` · ${plan.unscheduledTopics} unscheduled ${
                        plan.unscheduledTopics === 1 ? "topic" : "topics"
                    }`}
            </p>
        </div>
    );
}
function parseMeetingSchedule(schedule: string): MeetingSchedule {
    const times = schedule.match(
        /([1-9]|1[0-2]):([0-5][0-9])(?: (AM|PM))? - ([1-9]|1[0-2]):([0-5][0-9]) (AM|PM)$/,
    );
    return {
        days: schedule.match(/\b(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)\b/g) ?? [],
        start: {
            hour: times?.[1] ?? "",
            minute: times?.[2] ?? "",
            period: times?.[3] ?? times?.[6] ?? "",
        },
        end: {
            hour: times?.[4] ?? "",
            minute: times?.[5] ?? "",
            period: times?.[6] ?? "",
        },
    };
}
function timeInMinutes(time: MeetingTime) {
    return (
        (Number(time.hour) % 12) * 60 +
        Number(time.minute) +
        (time.period === "PM" ? 720 : 0)
    );
}
// The calendar reads the same saved courses so sections remain separate there.
// eslint-disable-next-line react-refresh/only-export-components
export function loadCourses(): Course[] {
    try {
        const saved = JSON.parse(localStorage.getItem(storageKey) ?? "null") as
            Course[] | null;
        if (
            Array.isArray(saved) &&
            saved.every(
                (course: Course | null) =>
                    course &&
                    [
                        "id",
                        "code",
                        "title",
                        "semester",
                        "instructor",
                        "schedule",
                        "location",
                        "color",
                    ].every(
                        (key) =>
                            typeof course[key as keyof Course] === "string",
                    ),
            )
        ) {
            const courses = saved.map((course) => ({
                ...course,
                section:
                    typeof course.section === "string" ? course.section : "",
                instructor:
                    (
                        normalize(course.code) === "cisc275" &&
                        course.instructor.trim() === "Cory Bart"
                    ) ?
                        "Austin Cory Bart"
                    :   course.instructor,
            }));
            if (
                courses.some(
                    (course, index) =>
                        course.instructor !== saved[index].instructor,
                )
            ) {
                try {
                    localStorage.setItem(storageKey, JSON.stringify(courses));
                } catch {
                    // Keep the corrected name visible if storage is unavailable.
                }
            }
            return courses;
        }
    } catch {
        /* Fall back when saved data is invalid or unavailable. */
    }
    return initialCourses;
}
export function CoursesPage({
    courses: sharedCourses,
    onCoursesChange,
    tasks = [],
    onPlanInCalendar,
    role,
    initialEditId,
}: {
    // A course whose Edit form opens straight away, e.g. from Home's
    // "Add times".
    initialEditId?: string;
    courses?: Course[];
    onCoursesChange?: (courses: Course[]) => void;
    tasks?: Task[];
    onPlanInCalendar?: (course: CalendarCourseSelection) => void;
    role?: Role;
}) {
    const [localCourses, setLocalCourses] = useState(
        () => sharedCourses ?? loadCourses(),
    );
    const courses = sharedCourses ?? localCourses;
    const calendarSemesters = getCalendarSemesters(courses);
    function setCourses(next: Course[]) {
        setLocalCourses(next);
        onCoursesChange?.(next);
    }
    const semesters = calendarSemesters.map((term) => term.name);
    const [semester, setSemester] = useSelectedSemester(semesters);
    const [draft, setDraft] = useState<Course | null>(() => {
        const editing = courses.find((course) => course.id === initialEditId);
        return editing ? { ...editing } : null;
    });
    const [meeting, setMeeting] = useState(() =>
        parseMeetingSchedule(draft?.schedule ?? ""),
    );
    const [savedTemplates, setSavedTemplates] = useState(() =>
        loadSaved<SavedTemplate>(TEMPLATE_KEY, []),
    );
    const [selectedTemplate, setSelectedTemplate] = useState("");
    const [deleting, setDeleting] = useState<Course | null>(null);
    const [deletingTemplate, setDeletingTemplate] =
        useState<SavedTemplate | null>(null);
    const [error, setError] = useState("");
    const [storageError, setStorageError] = useState("");
    // Read once per visit for the professor's plan summary on each card.
    const [calendarItems] = useState(loadCalendarItems);
    const [cancelledClasses] = useState(() =>
        loadSaved<string>(CANCELLED_KEY, []),
    );
    const [today] = useState(() => new Date());
    const dialog = useRef<HTMLDialogElement>(null);
    function updateCourses(update: (current: Course[]) => Course[]): boolean {
        const next = update(courses);
        setCourses(next);
        try {
            localStorage.setItem(storageKey, JSON.stringify(next));
            setStorageError("");
            return true;
        } catch {
            setStorageError(
                "Courses could not be saved in this browser. Keep this page open to retain your changes.",
            );
            return false;
        }
    }
    useEffect(() => {
        if (draft || deleting || deletingTemplate) dialog.current?.showModal();
        else if (dialog.current?.open) dialog.current.close();
    }, [draft, deleting, deletingTemplate]);
    function closeDialog() {
        setDraft(null);
        setSelectedTemplate("");
        setDeleting(null);
        setDeletingTemplate(null);
        setError("");
    }
    function openDraft(course: Course) {
        setDraft(course);
        setMeeting(parseMeetingSchedule(course.schedule));
        setError("");
    }
    function deleteTemplate() {
        if (!deletingTemplate) return;
        const next = savedTemplates.filter(
            (template) =>
                normalize(template.course) !==
                    normalize(deletingTemplate.course) ||
                (template.section ?? "") !== (deletingTemplate.section ?? "") ||
                template.semester.name !== deletingTemplate.semester.name,
        );
        try {
            localStorage.setItem(TEMPLATE_KEY, JSON.stringify(next));
            setSavedTemplates(next);
            closeDialog();
        } catch {
            setError("The template could not be deleted from this browser.");
        }
    }
    function openCreateCourse(templateIndex?: number) {
        const templates = loadSaved<SavedTemplate>(TEMPLATE_KEY, []);
        const template =
            templateIndex === undefined ? undefined : templates[templateIndex];
        const source =
            template &&
            courses.find(
                (course) =>
                    normalize(course.code) === normalize(template.course) &&
                    course.section === (template.section ?? "") &&
                    course.semester === template.semester.name,
            );
        setSavedTemplates(templates);
        setSelectedTemplate(template ? String(templateIndex) : "");
        setError("");
        openDraft({
            id: crypto.randomUUID(),
            code: template?.course ?? "",
            section:
                template?.section ??
                template?.details?.section ??
                source?.section ??
                "",
            title: template?.details?.title ?? source?.title ?? "",
            semester:
                template && semester === template.semester.name ?
                    (calendarSemesters.find(
                        (term) => term.name !== template.semester.name,
                    )?.name ?? semester)
                :   semester,
            // A professor usually teaches their own courses, so a new one
            // starts with the name they gave last time.
            instructor:
                template?.details?.instructor ??
                source?.instructor ??
                (role === "professor" ? loadLastInstructor() : ""),
            schedule: template?.details?.schedule ?? source?.schedule ?? "",
            location: template?.details?.location ?? source?.location ?? "",
            color: template?.details?.color ?? source?.color ?? "#00539f",
        });
    }
    function saveCourse(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (!draft) return;
        const planInCalendar =
            (event.nativeEvent as SubmitEvent).submitter?.getAttribute(
                "name",
            ) === "planInCalendar";
        const timeParts = [
            meeting.start.hour,
            meeting.start.minute,
            meeting.start.period,
            meeting.end.hour,
            meeting.end.minute,
            meeting.end.period,
        ];
        const hasMeeting = meeting.days.length > 0 || timeParts.some(Boolean);
        if (hasMeeting && (!meeting.days.length || !timeParts.every(Boolean))) {
            setError(
                "Choose at least one meeting day and a complete start and end time.",
            );
            return;
        }
        if (
            hasMeeting &&
            timeInMinutes(meeting.end) <= timeInMinutes(meeting.start)
        ) {
            setError("End time must be later than start time.");
            return;
        }
        const schedule =
            hasMeeting ?
                `${meeting.days.join(" / ")} ${meeting.start.hour}:${meeting.start.minute} ${meeting.start.period} - ${meeting.end.hour}:${meeting.end.minute} ${meeting.end.period}`
            :   "";
        const cleaned = {
            ...draft,
            code: draft.code.trim(),
            section: (draft.section || "").trim(),
            title: draft.title.trim(),
            semester: draft.semester.trim(),
            instructor: draft.instructor.trim(),
            schedule,
            location: draft.location.trim(),
        };
        if (!cleaned.code || !cleaned.title || !cleaned.semester) {
            setError("Enter a course code, name, and semester.");
            return;
        }
        if (role === "professor" && cleaned.instructor) {
            saveLastInstructor(cleaned.instructor);
        }
        if (cleaned.section && !/^\d{3}$/.test(cleaned.section)) {
            setError("Section must be exactly three digits, such as 010.");
            return;
        }
        if (Boolean(cleaned.startDate) !== Boolean(cleaned.endDate)) {
            setError(
                "Choose both a start date and an end date, or leave both blank.",
            );
            return;
        }
        if (
            cleaned.startDate &&
            cleaned.endDate &&
            cleaned.endDate < cleaned.startDate
        ) {
            setError("End date must be on or after the start date.");
            return;
        }
        if (
            courses.some(
                (course) =>
                    course.id !== cleaned.id &&
                    normalize(course.code) === normalize(cleaned.code) &&
                    course.section === cleaned.section &&
                    normalize(course.semester) === normalize(cleaned.semester),
            )
        ) {
            setError(
                "That course code and section already exist in this semester.",
            );
            return;
        }
        if (selectedTemplate !== "") {
            const template = savedTemplates[Number(selectedTemplate)];
            const target = getCalendarSemesters([...courses, cleaned]).find(
                (term) => term.name === cleaned.semester,
            );
            if (!target) {
                setError("Enter a destination semester and its course dates.");
                return;
            }
            const items = loadCalendarItems();
            if (
                items.some(
                    (item) =>
                        normalize(item.course) ===
                            normalize(
                                courseKey(cleaned.code, cleaned.section),
                            ) && item.semester === target.name,
                )
            ) {
                setError(
                    "This course already has topics or activities in that semester. Choose an empty course schedule to avoid duplicates.",
                );
                return;
            }
            const previousCourses = localStorage.getItem(storageKey);
            try {
                const copied = copySchedule(
                    template.items,
                    template.semester,
                    target,
                    template.meetingDays,
                    [
                        ...template.cancelled.filter(
                            (key) =>
                                key.split("|")[1] >= template.semester.start &&
                                key.split("|")[1] <= template.semester.end,
                        ),
                        ...loadSaved<string>(CANCELLED_KEY, [])
                            .filter(
                                (key) =>
                                    key.startsWith(
                                        `${courseKey(cleaned.code, cleaned.section)}|`,
                                    ) &&
                                    key.split("|")[1] >= target.start &&
                                    key.split("|")[1] <= target.end,
                            )
                            .map(
                                (key) =>
                                    `${courseKey(template.course, template.section)}|${key.split("|")[1]}`,
                            ),
                    ],
                    courseKey(template.course, template.section),
                    (kind) => `${kind}-${crypto.randomUUID()}`,
                ).map((item) => ({
                    ...item,
                    course: courseKey(cleaned.code, cleaned.section),
                }));
                const next = [...courses, cleaned];
                localStorage.setItem(storageKey, JSON.stringify(next));
                try {
                    localStorage.setItem(
                        ITEMS_KEY,
                        JSON.stringify([...items, ...copied]),
                    );
                } catch (error) {
                    if (previousCourses === null)
                        localStorage.removeItem(storageKey);
                    else localStorage.setItem(storageKey, previousCourses);
                    throw error;
                }
                setCourses(next);
                setStorageError("");
            } catch {
                setError(
                    "The course and template could not be saved. Check the destination semester and available browser storage, then try again.",
                );
                return;
            }
        } else {
            const saved = updateCourses((current) =>
                current.some((course) => course.id === cleaned.id) ?
                    current.map((course) =>
                        course.id === cleaned.id ? cleaned : course,
                    )
                :   [...current, cleaned],
            );
            if (!saved) return;
        }
        setSemester(cleaned.semester);
        closeDialog();
        if (planInCalendar) onPlanInCalendar?.(cleaned);
    }
    const visibleCourses = courses.filter(
        (course) => course.semester === semester,
    );
    return (
        <section className="courses-page">
            <header className="page-header">
                <h1>Courses</h1>
            </header>
            <div className="course-toolbar" aria-label="Course controls">
                <div className="semester-with-add">
                    <label>
                        Semester
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
                <button
                    className="create-course"
                    type="button"
                    onClick={() => openCreateCourse()}
                >
                    Create Course
                </button>
            </div>
            {storageError && <p role="alert">{storageError}</p>}
            <p className="courses-count" role="status">
                {visibleCourses.length}{" "}
                {visibleCourses.length === 1 ? "course" : "courses"} in{" "}
                {semester}
            </p>
            <div className="course-grid">
                {visibleCourses.map((course) => {
                    const pending = tasks
                        .filter(
                            (task) =>
                                !task.completed &&
                                task.semester === course.semester &&
                                normalize(task.course) ===
                                    normalize(course.code),
                        )
                        .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
                    const term = calendarSemesters.find(
                        (option) => option.name === course.semester,
                    );
                    const plan =
                        role === "professor" && term ?
                            getCoursePlan(
                                course,
                                term,
                                calendarItems,
                                cancelledClasses,
                                today,
                            )
                        :   undefined;
                    return (
                        <article
                            className="course-card"
                            key={course.id}
                            style={{ borderLeftColor: course.color }}
                            role={onPlanInCalendar ? "link" : undefined}
                            tabIndex={onPlanInCalendar ? 0 : undefined}
                            aria-label={
                                onPlanInCalendar ?
                                    `View ${courseKey(course.code, course.section)} in calendar`
                                :   undefined
                            }
                            onClick={(event) => {
                                if (
                                    !(event.target as HTMLElement).closest(
                                        "button, a, input, select, textarea",
                                    )
                                ) {
                                    onPlanInCalendar?.(course);
                                }
                            }}
                            onKeyDown={(event) => {
                                if (
                                    event.target === event.currentTarget &&
                                    event.key === "Enter"
                                ) {
                                    event.preventDefault();
                                    onPlanInCalendar?.(course);
                                }
                            }}
                        >
                            <h2>{course.code}</h2>
                            <p className="course-name">{course.title}</p>
                            {/* Only details that exist; the rest are one
                                link below rather than rows of "Not added". */}
                            <dl className="course-facts">
                                {course.section && (
                                    <div>
                                        <dt>Section</dt>
                                        <dd>{course.section}</dd>
                                    </div>
                                )}
                                {course.instructor && (
                                    <div>
                                        <dt>Instructor(s)</dt>
                                        <dd>{course.instructor}</dd>
                                    </div>
                                )}
                                {course.schedule && (
                                    <div>
                                        <dt>Meets on</dt>
                                        <dd>
                                            {course.schedule}
                                            {course.startDate &&
                                                course.endDate && (
                                                    <span className="course-meeting-dates">
                                                        {parseDateKey(
                                                            course.startDate,
                                                        ).toLocaleDateString()}
                                                        {" – "}
                                                        {parseDateKey(
                                                            course.endDate,
                                                        ).toLocaleDateString()}
                                                    </span>
                                                )}
                                        </dd>
                                    </div>
                                )}
                                {course.location && (
                                    <div>
                                        <dt>Location</dt>
                                        <dd>{course.location}</dd>
                                    </div>
                                )}
                            </dl>
                            {missingDetails(course) && (
                                <button
                                    type="button"
                                    className="course-add-details"
                                    onClick={() => openDraft({ ...course })}
                                >
                                    + Add {missingDetails(course)}
                                </button>
                            )}
                            {role === "professor" ?
                                <CoursePlanSummary plan={plan} />
                            :   <div className="course-task-summary">
                                    <strong>
                                        {pending.length} pending{" "}
                                        {pending.length === 1 ?
                                            "task"
                                        :   "tasks"}
                                    </strong>
                                    <p>
                                        {pending[0] ?
                                            `${pending[0].title} - Due ${new Date(`${pending[0].dueDate}T00:00:00`).toLocaleDateString("en-US")}`
                                        :   "No pending tasks for this course."}
                                    </p>
                                </div>
                            }
                            <ScheduleTemplateActions
                                key={`${courseKey(course.code, course.section)}-${course.semester}`}
                                code={course.code}
                                section={course.section}
                                details={{
                                    title: course.title,
                                    section: course.section,
                                    instructor: course.instructor,
                                    schedule: course.schedule,
                                    location: course.location,
                                    color: course.color,
                                    startDate: course.startDate,
                                    endDate: course.endDate,
                                }}
                                semester={course.semester}
                                onSaved={() =>
                                    setSavedTemplates(
                                        loadSaved<SavedTemplate>(
                                            TEMPLATE_KEY,
                                            [],
                                        ),
                                    )
                                }
                            />
                            <div className="course-actions">
                                <button
                                    type="button"
                                    aria-label={`Edit ${courseKey(course.code, course.section)}`}
                                    onClick={() => openDraft({ ...course })}
                                >
                                    Edit course
                                </button>
                                <button
                                    className="course-danger"
                                    type="button"
                                    aria-label={`Delete ${courseKey(course.code, course.section)}`}
                                    onClick={() => setDeleting(course)}
                                >
                                    Delete
                                </button>
                            </div>
                        </article>
                    );
                })}
            </div>
            {visibleCourses.length === 0 && (
                <p className="empty-message">
                    No courses in this semester yet. Add a course to get
                    started.
                </p>
            )}
            <section
                className="saved-templates-section"
                aria-labelledby="saved-templates-title"
            >
                <h2 id="saved-templates-title">Saved course templates</h2>
                {savedTemplates.length === 0 ?
                    <p className="saved-templates-empty">
                        No saved templates yet. Save a schedule template from a
                        course card to see it here.
                    </p>
                :   <ul className="saved-template-list">
                        {savedTemplates.map((template, index) => (
                            <li
                                className="saved-template-card"
                                key={`${courseKey(template.course, template.section)}-${template.semester.name}`}
                            >
                                <h3>
                                    {courseKey(
                                        template.course,
                                        template.section,
                                    )}
                                </h3>
                                {template.details?.title && (
                                    <p>{template.details.title}</p>
                                )}
                                <p>From {template.semester.name}</p>
                                <p>
                                    {template.items.length} planned{" "}
                                    {template.items.length === 1 ?
                                        "item"
                                    :   "items"}
                                </p>
                                <div className="saved-template-actions">
                                    <button
                                        type="button"
                                        aria-label={`Create course from ${courseKey(template.course, template.section)} ${template.semester.name} template`}
                                        onClick={() => openCreateCourse(index)}
                                    >
                                        Create course from template
                                    </button>
                                    <button
                                        type="button"
                                        className="course-danger"
                                        aria-label={`Delete ${courseKey(template.course, template.section)} ${template.semester.name} template`}
                                        onClick={() =>
                                            setDeletingTemplate(template)
                                        }
                                    >
                                        Delete template
                                    </button>
                                </div>
                            </li>
                        ))}
                    </ul>
                }
            </section>
            <dialog
                ref={dialog}
                className="course-dialog"
                aria-labelledby="course-dialog-title"
                onCancel={closeDialog}
            >
                {draft && (
                    <form onSubmit={saveCourse}>
                        <h2 id="course-dialog-title">
                            {courses.some((course) => course.id === draft.id) ?
                                "Edit course"
                            :   "Add course"}
                        </h2>
                        <p>
                            Start with the basics. Meeting details can be added
                            later.
                        </p>
                        {!courses.some((course) => course.id === draft.id) && (
                            <div className="course-form-fields">
                                <label>
                                    Saved templates
                                    <select
                                        value={selectedTemplate}
                                        onChange={(event) => {
                                            const value = event.target.value;
                                            setSelectedTemplate(value);
                                            setError("");
                                            const template =
                                                savedTemplates[Number(value)];
                                            if (value !== "") {
                                                const source = courses.find(
                                                    (course) =>
                                                        normalize(
                                                            course.code,
                                                        ) ===
                                                            normalize(
                                                                template.course,
                                                            ) &&
                                                        course.section ===
                                                            (template.section ??
                                                                "") &&
                                                        course.semester ===
                                                            template.semester
                                                                .name,
                                                );
                                                openDraft({
                                                    ...draft,
                                                    ...(template.details ??
                                                        (source ?
                                                            {
                                                                title: source.title,
                                                                section:
                                                                    source.section,
                                                                instructor:
                                                                    source.instructor,
                                                                schedule:
                                                                    source.schedule,
                                                                location:
                                                                    source.location,
                                                                color: source.color,
                                                            }
                                                        :   {})),
                                                    code: template.course,
                                                    startDate: draft.startDate,
                                                    endDate: draft.endDate,
                                                    section:
                                                        template.section ??
                                                        template.details
                                                            ?.section ??
                                                        source?.section ??
                                                        "",
                                                });
                                            }
                                        }}
                                    >
                                        <option value="">
                                            Start without a template
                                        </option>
                                        {savedTemplates.map(
                                            (template, index) => (
                                                <option
                                                    key={`${courseKey(template.course, template.section)}-${template.semester.name}`}
                                                    value={String(index)}
                                                >
                                                    {courseKey(
                                                        template.course,
                                                        template.section,
                                                    )}{" "}
                                                    - {template.semester.name}
                                                </option>
                                            ),
                                        )}
                                    </select>
                                </label>
                                <p>
                                    {savedTemplates.length === 0 ?
                                        "No saved templates yet. Save a schedule template from a course card first."
                                    :   "Choose a saved schedule to fill course details and copy its lectures and activities when you save. Set Semester to the destination term."
                                    }
                                </p>
                            </div>
                        )}
                        <div className="course-form-fields">
                            {(
                                [
                                    ["code", "Course code", "CISC 275"],
                                    [
                                        "title",
                                        "Course name",
                                        "Software Engineering",
                                    ],
                                    ["semester", "Semester", "Fall 2026"],
                                    [
                                        "instructor",
                                        "Instructor(s)",
                                        "Instructor name(s)",
                                    ],
                                    ["location", "Location", "Gore Hall 103"],
                                ] as const
                            ).map(([key, label, placeholder]) => (
                                <label key={key}>
                                    {label}
                                    {(
                                        ["code", "title", "semester"].includes(
                                            key,
                                        )
                                    ) ?
                                        " *"
                                    :   ""}
                                    <input
                                        autoFocus={key === "code"}
                                        required={[
                                            "code",
                                            "title",
                                            "semester",
                                        ].includes(key)}
                                        maxLength={160}
                                        value={draft[key]}
                                        placeholder={placeholder}
                                        onChange={(event) => {
                                            setDraft({
                                                ...draft,
                                                [key]: event.target.value,
                                            });
                                        }}
                                    />
                                </label>
                            ))}
                            <label>
                                Section
                                <input
                                    type="text"
                                    inputMode="numeric"
                                    maxLength={3}
                                    placeholder="010"
                                    value={draft.section || ""}
                                    onChange={(event) => {
                                        setDraft({
                                            ...draft,
                                            section: event.target.value,
                                        });
                                        setError("");
                                    }}
                                />
                            </label>
                            <label>
                                Course color
                                <input
                                    type="color"
                                    value={draft.color}
                                    onChange={(event) =>
                                        setDraft({
                                            ...draft,
                                            color: event.target.value,
                                        })
                                    }
                                />
                            </label>
                            <MeetingScheduleFields
                                value={meeting}
                                onChange={(value) => {
                                    setMeeting(value);
                                    setError("");
                                }}
                                onClear={() => {
                                    setMeeting(parseMeetingSchedule(""));
                                    setDraft({
                                        ...draft,
                                        startDate: "",
                                        endDate: "",
                                    });
                                    setError("");
                                }}
                            >
                                <div className="course-date-inputs">
                                    <label>
                                        Start date
                                        <input
                                            type="date"
                                            value={draft.startDate ?? ""}
                                            max={draft.endDate || undefined}
                                            onChange={(event) => {
                                                setDraft({
                                                    ...draft,
                                                    startDate:
                                                        event.target.value,
                                                });
                                                setError("");
                                            }}
                                        />
                                    </label>
                                    <label>
                                        End date
                                        <input
                                            type="date"
                                            value={draft.endDate ?? ""}
                                            min={draft.startDate || undefined}
                                            onChange={(event) => {
                                                setDraft({
                                                    ...draft,
                                                    endDate: event.target.value,
                                                });
                                                setError("");
                                            }}
                                        />
                                    </label>
                                </div>
                                <p className="meeting-date-help">
                                    Leave dates blank to use semester dates.
                                </p>
                            </MeetingScheduleFields>
                        </div>
                        {error && (
                            <p role="alert" className="course-error">
                                {error}
                            </p>
                        )}
                        <div className="course-dialog-actions">
                            <button type="button" onClick={closeDialog}>
                                Cancel
                            </button>
                            {courses.some(
                                (course) => course.id === draft.id,
                            ) && (
                                <button
                                    type="submit"
                                    name="planInCalendar"
                                    value="true"
                                >
                                    Plan in Calendar View
                                </button>
                            )}
                            <button type="submit" className="course-primary">
                                Save course
                            </button>
                        </div>
                    </form>
                )}
                {deleting && (
                    <>
                        <h2 id="course-dialog-title">
                            Delete {courseKey(deleting.code, deleting.section)}?
                        </h2>
                        <p>
                            This removes {deleting.title} from your courses and
                            the calendar's course list. Existing tasks and
                            calendar events will remain saved.
                        </p>
                        <div className="course-dialog-actions">
                            <button
                                type="button"
                                autoFocus
                                onClick={closeDialog}
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                className="course-danger"
                                onClick={() => {
                                    updateCourses((current) =>
                                        current.filter(
                                            (course) =>
                                                course.id !== deleting.id,
                                        ),
                                    );
                                    closeDialog();
                                }}
                            >
                                Delete course
                            </button>
                        </div>
                    </>
                )}
                {deletingTemplate && (
                    <>
                        <h2 id="course-dialog-title">Delete template?</h2>
                        <p>
                            Delete the saved{" "}
                            {courseKey(
                                deletingTemplate.course,
                                deletingTemplate.section,
                            )}{" "}
                            template from {deletingTemplate.semester.name}?
                            Existing courses and calendar items will remain.
                        </p>
                        {error && <p role="alert">{error}</p>}
                        <div className="course-dialog-actions">
                            <button type="button" onClick={closeDialog}>
                                Cancel
                            </button>
                            <button
                                type="button"
                                className="course-danger"
                                onClick={deleteTemplate}
                            >
                                Delete template
                            </button>
                        </div>
                    </>
                )}
            </dialog>
        </section>
    );
}
