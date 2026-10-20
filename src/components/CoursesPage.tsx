import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import type { Task } from "../tasks";
import "./CoursesPage.css";
import { TEMPLATE_KEY } from "./savedTemplates";
import type { SavedTemplate } from "./savedTemplates";
import {
    loadSaved,
    loadCalendarItems,
    semesters as calendarSemesters,
    CANCELLED_KEY,
    ITEMS_KEY,
} from "./calendarStorage";
import { copySchedule } from "./scheduleTemplate";
import { ScheduleTemplateActions } from "./ScheduleTemplateActions";

interface Course {
    id: string;
    code: string;
    title: string;
    semester: string;
    instructor: string;
    schedule: string;
    location: string;
    color: string;
}
const storageKey = "semester-planner-courses-v1";
const initialCourses: Course[] = [
    {
        id: "cisc275",
        code: "CISC 275",
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
        title: "Algorithms",
        semester: "Fall 2026",
        instructor: "",
        schedule: "",
        location: "",
        color: "#6e4799",
    },
];
function loadCourses(): Course[] {
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
        )
            return saved;
    } catch {
        /* Fall back when saved data is invalid or unavailable. */
    }
    return initialCourses;
}
function normalize(value: string) {
    return value.toLowerCase().replace(/\s/g, "");
}

export function CoursesPage({ tasks = [] }: { tasks?: Task[] }) {
    const [courses, setCourses] = useState(loadCourses);
    const [semester, setSemester] = useState("Fall 2026");
    const [search, setSearch] = useState("");
    const [draft, setDraft] = useState<Course | null>(null);
    const [savedTemplates, setSavedTemplates] = useState<SavedTemplate[]>([]);
    const [selectedTemplate, setSelectedTemplate] = useState("");
    const [deleting, setDeleting] = useState<Course | null>(null);
    const [error, setError] = useState("");
    const [storageError, setStorageError] = useState("");
    const dialog = useRef<HTMLDialogElement>(null);
    const semesters = Array.from(
        new Set([
            "Fall 2026",
            "Spring 2027",
            ...courses.map((course) => course.semester),
        ]),
    ).sort();
    function updateCourses(update: (current: Course[]) => Course[]) {
        const next = update(courses);
        setCourses(next);
        try {
            localStorage.setItem(storageKey, JSON.stringify(next));
            setStorageError("");
        } catch {
            setStorageError(
                "Courses could not be saved in this browser. Keep this page open to retain your changes.",
            );
        }
    }
    useEffect(() => {
        if (draft || deleting) dialog.current?.showModal();
        else if (dialog.current?.open) dialog.current.close();
    }, [draft, deleting]);
    function closeDialog() {
        setDraft(null);
        setSelectedTemplate("");
        setDeleting(null);
        setError("");
    }
    function saveCourse(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (!draft) return;
        const cleaned = {
            ...draft,
            code: draft.code.trim(),
            title: draft.title.trim(),
            semester: draft.semester.trim(),
            instructor: draft.instructor.trim(),
            schedule: draft.schedule.trim(),
            location: draft.location.trim(),
        };
        if (!cleaned.code || !cleaned.title || !cleaned.semester) {
            setError("Enter a course code, name, and semester.");
            return;
        }
        if (cleaned.schedule) {
            const day = "(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)";
            const time = "(?:[1-9]|1[0-2]):[0-5][0-9]";
            const format = new RegExp(
                `^${day}(?: / ${day}){0,2} ${time} - ${time} (?:AM|PM)$`,
            );
            const days = cleaned.schedule.split(/ \d/)[0].split(" / ");
            if (
                !format.test(cleaned.schedule) ||
                new Set(days).size !== days.length
            ) {
                setError(
                    "Enter Meets as Mon / Wed / Fri 1:50 - 2:45 PM. Use 1–3 different abbreviated days separated by /, valid 12-hour times, and uppercase AM or PM.",
                );
                return;
            }
        }
        if (
            courses.some(
                (course) =>
                    course.id !== cleaned.id &&
                    normalize(course.code) === normalize(cleaned.code) &&
                    normalize(course.semester) === normalize(cleaned.semester),
            )
        ) {
            setError("That course code already exists in this semester.");
            return;
        }
        if (selectedTemplate !== "") {
            const template = savedTemplates[Number(selectedTemplate)];
            const target = calendarSemesters.find(
                (term) => term.name === cleaned.semester,
            );
            if (!target) {
                setError(
                    "Choose a destination semester with calendar dates: Fall 2026 or Spring 2027.",
                );
                return;
            }
            const items = loadCalendarItems();
            if (
                items.some(
                    (item) =>
                        normalize(item.course) === normalize(cleaned.code) &&
                        item.semester === target.name,
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
                                    key.startsWith(`${cleaned.code}|`) &&
                                    key.split("|")[1] >= target.start &&
                                    key.split("|")[1] <= target.end,
                            )
                            .map(
                                (key) =>
                                    `${template.course}|${key.split("|")[1]}`,
                            ),
                    ],
                    template.course,
                    (kind) => `${kind}-${crypto.randomUUID()}`,
                ).map((item) => ({ ...item, course: cleaned.code }));
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
            updateCourses((current) =>
                current.some((course) => course.id === cleaned.id) ?
                    current.map((course) =>
                        course.id === cleaned.id ? cleaned : course,
                    )
                :   [...current, cleaned],
            );
        }
        setSemester(cleaned.semester);
        setSearch("");
        closeDialog();
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
                <p>Your classes, meeting details, and tasks in one place.</p>
            </header>
            <div className="course-toolbar" aria-label="Course controls">
                <label>
                    Semester
                    <select
                        value={semester}
                        onChange={(event) => setSemester(event.target.value)}
                    >
                        {semesters.map((term) => (
                            <option key={term}>{term}</option>
                        ))}
                    </select>
                </label>
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
                    onClick={() => {
                        setSelectedTemplate("");
                        setSavedTemplates(
                            loadSaved<SavedTemplate>(TEMPLATE_KEY, []),
                        );
                        setDraft({
                            id: crypto.randomUUID(),
                            code: "",
                            title: "",
                            semester,
                            instructor: "",
                            schedule: "",
                            location: "",
                            color: "#00539f",
                        });
                    }}
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
                                normalize(task.course) ===
                                    normalize(course.code),
                        )
                        .sort((a, b) => a.date.localeCompare(b.date));
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
                                    <dt>Instructor(s)</dt>
                                    <dd>{course.instructor || "Not added"}</dd>
                                </div>
                                <div>
                                    <dt>Meets</dt>
                                    <dd>
                                        {course.schedule ||
                                            "Schedule not added"}
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
                                        `${pending[0].title} - Due ${new Date(`${pending[0].date}T00:00:00`).toLocaleDateString("en-US")}`
                                    :   "No pending tasks for this course."}
                                </p>
                            </div>
                            <ScheduleTemplateActions
                                key={`${course.code}-${course.semester}`}
                                code={course.code}
                                details={{
                                    title: course.title,
                                    instructor: course.instructor,
                                    schedule: course.schedule,
                                    location: course.location,
                                    color: course.color,
                                }}
                                semester={course.semester}
                            />
                            <div className="course-actions">
                                <button
                                    type="button"
                                    aria-label={`Edit ${course.code}`}
                                    onClick={() => setDraft({ ...course })}
                                >
                                    Edit course
                                </button>
                                <button
                                    className="course-danger"
                                    type="button"
                                    aria-label={`Delete ${course.code}`}
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
                                                        course.semester ===
                                                            template.semester
                                                                .name,
                                                );
                                                setDraft({
                                                    ...draft,
                                                    ...(template.details ??
                                                        (source ?
                                                            {
                                                                title: source.title,
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
                                                    key={`${template.course}-${template.semester.name}`}
                                                    value={String(index)}
                                                >
                                                    {template.course} -{" "}
                                                    {template.semester.name}
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
                                    [
                                        "schedule",
                                        "Meets",
                                        "Mon / Wed / Fri 1:50 - 2:45 PM",
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
                                        aria-label={
                                            key === "schedule" ? "Meets" : (
                                                undefined
                                            )
                                        }
                                        aria-describedby={
                                            key === "schedule" ?
                                                "meeting-format-help"
                                            :   undefined
                                        }
                                        onChange={(event) =>
                                            setDraft({
                                                ...draft,
                                                [key]: event.target.value,
                                            })
                                        }
                                    />
                                    {key === "schedule" && (
                                        <span id="meeting-format-help">
                                            Example: Mon / Wed / Fri 1:50 - 2:45
                                            PM. Use 1–3 different days: Mon,
                                            Tue, Wed, Thu, Fri, Sat, Sun.
                                            Separate days with “ / ” and times
                                            with “ - ”.
                                        </span>
                                    )}
                                </label>
                            ))}
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
                            <button type="submit" className="course-primary">
                                Save course
                            </button>
                        </div>
                    </form>
                )}
                {deleting && (
                    <>
                        <h2 id="course-dialog-title">
                            Delete {deleting.code}?
                        </h2>
                        <p>
                            This removes {deleting.title} from your courses.
                            Existing tasks and calendar events will remain.
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
            </dialog>
        </section>
    );
}
