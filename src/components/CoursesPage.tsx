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
import { parseDateKey } from "./calendarDates";
import { AddSemesterButton } from "./AddSemesterButton";
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
}: {
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
    const [search, setSearch] = useState("");
    const [draft, setDraft] = useState<Course | null>(null);
    const [meeting, setMeeting] = useState(() => parseMeetingSchedule(""));
    const [savedTemplates, setSavedTemplates] = useState(() =>
        loadSaved<SavedTemplate>(TEMPLATE_KEY, []),
    );
    const [selectedTemplate, setSelectedTemplate] = useState("");
    const [deleting, setDeleting] = useState<Course | null>(null);
    const [deletingTemplate, setDeletingTemplate] =
        useState<SavedTemplate | null>(null);
    const [error, setError] = useState("");
    const [storageError, setStorageError] = useState("");
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
            instructor:
                template?.details?.instructor ?? source?.instructor ?? "",
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
        setSearch("");
        closeDialog();
        if (planInCalendar) onPlanInCalendar?.(cleaned);
    }
    const visibleCourses = courses.filter(
        (course) =>
            course.semester === semester &&
            normalize(`${course.code} ${course.title}`).includes(
                normalize(search),
            ),
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
                <label>
                    Search by course code or title
                    <input
                        type="search"
                        placeholder="Search courses"
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                    />
                </label>
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
                                    normalize(course.code) &&
                                (course.section ?
                                    task.section === course.section
                                :   !courses.some(
                                        (other) =>
                                            other.id !== course.id &&
                                            other.semester ===
                                                course.semester &&
                                            normalize(other.code) ===
                                                normalize(course.code) &&
                                            other.section === task.section,
                                    )),
                        )
                        .sort((a, b) =>
                            a.finishDate.localeCompare(b.finishDate),
                        );
                    return (
                        <article
                            className="course-card"
                            key={course.id}
                            style={{ borderLeftColor: course.color }}
                        >
                            <h2>{course.code}</h2>
                            <p className="course-name">{course.title}</p>
                            <dl className="course-facts">
                                <div>
                                    <dt>Section</dt>
                                    <dd>{course.section || "Not added"}</dd>
                                </div>
                                <div>
                                    <dt>Instructor(s)</dt>
                                    <dd>{course.instructor || "Not added"}</dd>
                                </div>
                                <div>
                                    <dt>Meets on</dt>
                                    <dd>
                                        {course.schedule ||
                                            "Schedule not added"}
                                        {course.startDate && course.endDate && (
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
                                <div>
                                    <dt>Location</dt>
                                    <dd>{course.location || "Not added"}</dd>
                                </div>
                            </dl>
                            <div className="course-task-summary">
                                <strong>
                                    {pending.length} pending{" "}
                                    {pending.length === 1 ? "task" : "tasks"}
                                </strong>
                                <p>
                                    {pending[0] ?
                                        `${pending[0].title} - Due ${new Date(`${pending[0].finishDate}T00:00:00`).toLocaleDateString("en-US")}`
                                    :   "No pending tasks for this course."}
                                </p>
                            </div>
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
                    {search ?
                        "No courses match your search. Try another code or name."
                    :   "No courses in this semester yet. Add a course to get started."
                    }
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
                                    Plan in Calender View
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
