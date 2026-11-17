import { useEffect, useLayoutEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { loadCourses } from "./CoursesPage";
import type { Course } from "./CoursesPage";
import { courseKey } from "./calendarStorage";
import { MarkdownGuideDialog } from "./MarkdownGuideDialog";
import { CANCELLED_KEY, loadSaved } from "./calendarStorage";
import { formatShortDate } from "./calendarDates";
import {
    createNoteId,
    getPickUpDate,
    loadNotes,
    saveNotes,
} from "./planningNotes";
import type { Note } from "./planningNotes";

type SortBy = "updatedAt" | "createdAt" | "classDate";

interface NoteCardProps {
    note: Note;
    // The class its "next class" line shows on, if it has one.
    pickUpDate?: string;
    courses: Course[];
    onAssignCourse: (id: string, courseId: string) => void;
    onEdit: (note: Note) => void;
    onDelete: (id: string) => void;
}

function CourseOptions({ courses }: { courses: Course[] }) {
    return courses.map((course) => (
        <option key={course.id} value={course.id}>
            {courseKey(course.code, course.section)} — {course.title} (
            {course.semester})
        </option>
    ));
}

function NoteCard({
    note,
    pickUpDate,
    courses,
    onAssignCourse,
    onEdit,
    onDelete,
}: NoteCardProps) {
    const cardRef = useRef<HTMLElement>(null);
    const [rowSpan, setRowSpan] = useState(1);

    useLayoutEffect(() => {
        const card = cardRef.current;
        const grid = card?.parentElement;
        if (!card || !grid) return;

        function updateRowSpan() {
            if (!card || !grid) return;
            const styles = getComputedStyle(grid);
            const rowHeight = parseFloat(styles.gridAutoRows);
            const rowGap = parseFloat(styles.rowGap);
            const height = card.getBoundingClientRect().height;
            if (!rowHeight || !Number.isFinite(rowGap) || !height) return;

            setRowSpan(Math.ceil((height + rowGap) / (rowHeight + rowGap)));
        }

        updateRowSpan();
        if (typeof ResizeObserver === "undefined") return;

        const observer = new ResizeObserver(updateRowSpan);
        observer.observe(card);
        return () => observer.disconnect();
    }, []);

    return (
        <article
            className="note-card"
            ref={cardRef}
            style={{ gridRowEnd: `span ${rowSpan}` }}
        >
            <h2>{note.title || "Untitled note"}</h2>
            <label className="note-course">
                <span>Course</span>
                <select
                    aria-label={`Course for ${note.title || "Untitled note"}`}
                    value={note.courseId}
                    onChange={(event) =>
                        onAssignCourse(note.id, event.target.value)
                    }
                >
                    <option value="">Unassigned</option>
                    <CourseOptions courses={courses} />
                </select>
            </label>
            {note.classDate && (
                <p className="note-class-date">
                    Class on {formatShortDate(note.classDate)}
                </p>
            )}
            {note.body && (
                <div className="note-markdown">
                    <ReactMarkdown skipHtml>{note.body}</ReactMarkdown>
                </div>
            )}
            {note.nextClass && (
                <p className="note-next-class">
                    <strong>
                        Next class
                        {pickUpDate && `, ${formatShortDate(pickUpDate)}`}:
                    </strong>{" "}
                    {note.nextClass}
                </p>
            )}
            <div className="note-card-actions">
                <button
                    type="button"
                    onClick={() => onEdit(note)}
                    aria-label={`Edit ${note.title || "Untitled note"}`}
                >
                    Edit
                </button>
                <button
                    type="button"
                    onClick={() => onDelete(note.id)}
                    aria-label={`Delete ${note.title || "Untitled note"}`}
                >
                    Delete
                </button>
            </div>
        </article>
    );
}

export function PlanningNotesPage({
    courses: sharedCourses,
}: {
    courses?: Course[];
}) {
    const [savedCourses] = useState(() => sharedCourses ?? loadCourses());
    const courses = sharedCourses ?? savedCourses;
    const [notes, setNotes] = useState<Note[]>(loadNotes);
    const [editorOpen, setEditorOpen] = useState(false);
    const [guideOpen, setGuideOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [title, setTitle] = useState("");
    const [body, setBody] = useState("");
    const [courseId, setCourseId] = useState("");
    const [classDate, setClassDate] = useState("");
    const [nextClass, setNextClass] = useState("");
    const [courseFilter, setCourseFilter] = useState("all");
    const [cancelledClasses] = useState(() =>
        loadSaved<string>(CANCELLED_KEY, []),
    );
    const [sortBy, setSortBy] = useState<SortBy>("updatedAt");

    const courseIds = new Set(courses.map((course) => course.id));
    const activeFilter =
        courseFilter === "all" || courseIds.has(courseFilter) ?
            courseFilter
        :   "";
    const sortedNotes = notes
        // Notes from deleted courses remain available as unassigned notes.
        .map((note) => ({
            ...note,
            courseId: courseIds.has(note.courseId) ? note.courseId : "",
        }))
        .filter(
            (note) => activeFilter === "all" || note.courseId === activeFilter,
        )
        .sort((first, second) =>
            sortBy === "classDate" ?
                // Latest class first; notes not about a class go last.
                (second.classDate ?? "").localeCompare(first.classDate ?? "") ||
                second.updatedAt - first.updatedAt
            :   second[sortBy] - first[sortBy],
        );

    const editorPickUpDate = getPickUpDate(
        { courseId, classDate },
        courses,
        cancelledClasses,
    );

    useEffect(() => {
        saveNotes(notes);
    }, [notes]);

    function closeEditor() {
        setEditorOpen(false);
        setEditingId(null);
        setTitle("");
        setBody("");
        setCourseId("");
        setClassDate("");
        setNextClass("");
    }

    function startNewNote() {
        setEditingId(null);
        setTitle("");
        setBody("");
        setCourseId(activeFilter === "all" ? "" : activeFilter);
        setClassDate("");
        setNextClass("");
        setEditorOpen(true);
    }

    function editNote(note: Note) {
        setEditingId(note.id);
        setTitle(note.title);
        setBody(note.body);
        setCourseId(note.courseId);
        setClassDate(note.classDate ?? "");
        setNextClass(note.nextClass ?? "");
        setEditorOpen(true);
    }

    function saveNote(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const nextTitle = title.trim();
        const nextBody = body.trim();
        // A class date only means something with a course, and "next class"
        // only with a class date.
        const nextClassDate = (courseId && classDate) || undefined;
        const pickUp = (nextClassDate && nextClass.trim()) || undefined;
        if (!nextTitle && !nextBody && !pickUp) return;

        if (editingId) {
            setNotes((current) =>
                current.map((note) =>
                    note.id === editingId ?
                        {
                            ...note,
                            title: nextTitle,
                            body: nextBody,
                            courseId,
                            classDate: nextClassDate,
                            nextClass: pickUp,
                            updatedAt: Math.max(Date.now(), note.updatedAt + 1),
                        }
                    :   note,
                ),
            );
        } else {
            const now = Date.now();
            setNotes((current) => [
                {
                    id: createNoteId(now),
                    title: nextTitle,
                    body: nextBody,
                    courseId,
                    classDate: nextClassDate,
                    nextClass: pickUp,
                    createdAt: now,
                    updatedAt: now,
                },
                ...current,
            ]);
        }
        closeEditor();
    }

    function deleteNote(id: string) {
        setNotes((current) => current.filter((note) => note.id !== id));
        if (editingId === id) closeEditor();
    }

    function assignCourse(id: string, nextCourseId: string) {
        setNotes((current) =>
            current.map((note) =>
                note.id === id ?
                    {
                        ...note,
                        courseId: nextCourseId,
                        updatedAt: Math.max(Date.now(), note.updatedAt + 1),
                    }
                :   note,
            ),
        );
        if (editingId === id) setCourseId(nextCourseId);
    }

    return (
        <section className="planning-notes-page">
            <header className="page-header notes-header">
                <div>
                    <h1>Planning Notes</h1>
                </div>
                <div className="notes-header-actions">
                    <button
                        className="add-note-button"
                        type="button"
                        onClick={startNewNote}
                    >
                        <span aria-hidden="true">+</span> Add Note
                    </button>
                    <button
                        className="markdown-guide-button"
                        type="button"
                        aria-haspopup="dialog"
                        onClick={() => setGuideOpen(true)}
                    >
                        Markdown Guide
                    </button>
                </div>
            </header>

            {guideOpen && (
                <MarkdownGuideDialog onClose={() => setGuideOpen(false)} />
            )}

            {editorOpen && (
                <form className="note-editor" onSubmit={saveNote}>
                    <label htmlFor="note-title">Title</label>
                    <input
                        id="note-title"
                        type="text"
                        placeholder="Note title"
                        value={title}
                        onChange={(event) => setTitle(event.target.value)}
                        autoFocus
                    />
                    <label htmlFor="note-course">Course</label>
                    <select
                        id="note-course"
                        value={courseId}
                        onChange={(event) => setCourseId(event.target.value)}
                    >
                        <option value="">Unassigned</option>
                        <CourseOptions courses={courses} />
                    </select>
                    {courseId && (
                        <>
                            <label htmlFor="note-class-date">
                                Class date (optional)
                            </label>
                            <input
                                id="note-class-date"
                                type="date"
                                value={classDate}
                                onChange={(event) =>
                                    setClassDate(event.target.value)
                                }
                            />
                        </>
                    )}
                    <label htmlFor="note-body">Note</label>
                    <textarea
                        id="note-body"
                        placeholder="Write a note..."
                        rows={6}
                        value={body}
                        onChange={(event) => setBody(event.target.value)}
                    />
                    <p className="note-markdown-hint">
                        Markdown supported: **bold**, *italic*, headings, lists,
                        links, quotes, and code.
                    </p>
                    {courseId && classDate && (
                        <>
                            <label htmlFor="note-next-class">
                                Pick up next class with
                            </label>
                            <input
                                id="note-next-class"
                                type="text"
                                placeholder="e.g. Start at slide 13"
                                value={nextClass}
                                onChange={(event) =>
                                    setNextClass(event.target.value)
                                }
                            />
                            <p className="note-markdown-hint">
                                {editorPickUpDate ?
                                    `Shows on the ${formatShortDate(editorPickUpDate)} class in the Calendar, and moves along if that class is cancelled.`
                                :   "Shows on the course's next class in the Calendar."
                                }
                            </p>
                        </>
                    )}
                    <div className="note-editor-actions">
                        <button type="button" onClick={closeEditor}>
                            Cancel
                        </button>
                        <button
                            className="save-note-button"
                            type="submit"
                            disabled={
                                !title.trim() &&
                                !body.trim() &&
                                !(courseId && classDate && nextClass.trim())
                            }
                        >
                            {editingId ? "Save changes" : "Save note"}
                        </button>
                    </div>
                </form>
            )}

            {notes.length > 0 && (
                <div className="notes-toolbar">
                    <div className="notes-toolbar-field">
                        <label htmlFor="notes-course-filter">
                            Filter by course
                        </label>
                        <select
                            id="notes-course-filter"
                            value={activeFilter}
                            onChange={(event) =>
                                setCourseFilter(event.target.value)
                            }
                        >
                            <option value="all">All courses</option>
                            <option value="">Unassigned</option>
                            <CourseOptions courses={courses} />
                        </select>
                    </div>
                    <div className="notes-toolbar-field">
                        <label htmlFor="notes-sort">Sort by</label>
                        <select
                            id="notes-sort"
                            value={sortBy}
                            onChange={(event) =>
                                setSortBy(event.target.value as SortBy)
                            }
                        >
                            <option value="updatedAt">Recently edited</option>
                            <option value="createdAt">Recently added</option>
                            <option value="classDate">Class date</option>
                        </select>
                    </div>
                </div>
            )}

            {notes.length === 0 ?
                <div className="notes-empty-state">
                    <div className="notes-empty-icon" aria-hidden="true">
                        ✎
                    </div>
                    <h2>Your notes will appear here</h2>
                    <p>Add a note to capture your first plan or idea.</p>
                </div>
            : sortedNotes.length === 0 ?
                <div className="notes-empty-state">
                    <h2>No notes for this course</h2>
                    <p>Add a note or choose another course filter.</p>
                </div>
            :   <div className="notes-grid" aria-label="Planning notes">
                    {sortedNotes.map((note) => (
                        <NoteCard
                            key={note.id}
                            note={note}
                            pickUpDate={
                                note.nextClass ?
                                    getPickUpDate(
                                        note,
                                        courses,
                                        cancelledClasses,
                                    )
                                :   undefined
                            }
                            courses={courses}
                            onAssignCourse={assignCourse}
                            onEdit={editNote}
                            onDelete={deleteNote}
                        />
                    ))}
                </div>
            }
        </section>
    );
}
