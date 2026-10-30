import { useEffect, useLayoutEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";

interface Note {
    id: string;
    title: string;
    body: string;
    createdAt: number;
    updatedAt: number;
}

type StoredNote = Pick<Note, "id" | "title" | "body"> &
    Partial<Pick<Note, "createdAt" | "updatedAt">>;

type SortBy = "updatedAt" | "createdAt";

const storageKey = "semplan-planning-notes";

function loadNotes(): Note[] {
    try {
        const saved = localStorage.getItem(storageKey);
        if (!saved) return [];

        const parsed = JSON.parse(saved) as Array<StoredNote | null>;
        if (!Array.isArray(parsed)) return [];

        return parsed.flatMap((note, index) => {
            if (
                note === null ||
                typeof note !== "object" ||
                typeof note.id !== "string" ||
                typeof note.title !== "string" ||
                typeof note.body !== "string"
            ) {
                return [];
            }

            // Older notes used a creation timestamp at the start of their ID.
            const idTimestamp = Number(note.id.split("-")[0]);
            const createdAt =
                (
                    typeof note.createdAt === "number" &&
                    Number.isFinite(note.createdAt)
                ) ?
                    note.createdAt
                : Number.isFinite(idTimestamp) && idTimestamp > 0 ? idTimestamp
                : Date.now() - index;

            return [
                {
                    id: note.id,
                    title: note.title,
                    body: note.body,
                    createdAt,
                    updatedAt:
                        (
                            typeof note.updatedAt === "number" &&
                            Number.isFinite(note.updatedAt)
                        ) ?
                            note.updatedAt
                        :   createdAt,
                },
            ];
        });
    } catch {
        return [];
    }
}

interface NoteCardProps {
    note: Note;
    onEdit: (note: Note) => void;
    onDelete: (id: string) => void;
}

function NoteCard({ note, onEdit, onDelete }: NoteCardProps) {
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
            {note.body && (
                <div className="note-markdown">
                    <ReactMarkdown skipHtml>{note.body}</ReactMarkdown>
                </div>
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

export function PlanningNotesPage() {
    const [notes, setNotes] = useState<Note[]>(loadNotes);
    const [editorOpen, setEditorOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [title, setTitle] = useState("");
    const [body, setBody] = useState("");
    const [sortBy, setSortBy] = useState<SortBy>("updatedAt");

    const sortedNotes = [...notes].sort(
        (first, second) => second[sortBy] - first[sortBy],
    );

    useEffect(() => {
        try {
            localStorage.setItem(storageKey, JSON.stringify(notes));
        } catch {
            // Notes remain available for the current session if storage is disabled.
        }
    }, [notes]);

    function closeEditor() {
        setEditorOpen(false);
        setEditingId(null);
        setTitle("");
        setBody("");
    }

    function startNewNote() {
        setEditingId(null);
        setTitle("");
        setBody("");
        setEditorOpen(true);
    }

    function editNote(note: Note) {
        setEditingId(note.id);
        setTitle(note.title);
        setBody(note.body);
        setEditorOpen(true);
    }

    function saveNote(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const nextTitle = title.trim();
        const nextBody = body.trim();
        if (!nextTitle && !nextBody) return;

        if (editingId) {
            setNotes((current) =>
                current.map((note) =>
                    note.id === editingId ?
                        {
                            ...note,
                            title: nextTitle,
                            body: nextBody,
                            updatedAt: Math.max(Date.now(), note.updatedAt + 1),
                        }
                    :   note,
                ),
            );
        } else {
            const now = Date.now();
            setNotes((current) => [
                {
                    id: `${now}-${Math.random().toString(36).slice(2)}`,
                    title: nextTitle,
                    body: nextBody,
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

    return (
        <section className="planning-notes-page">
            <header className="page-header notes-header">
                <div>
                    <h1>Planning Notes</h1>
                </div>
                <button
                    className="add-note-button"
                    type="button"
                    onClick={startNewNote}
                >
                    <span aria-hidden="true">+</span> Add Note
                </button>
            </header>

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
                    <div className="note-editor-actions">
                        <button type="button" onClick={closeEditor}>
                            Cancel
                        </button>
                        <button
                            className="save-note-button"
                            type="submit"
                            disabled={!title.trim() && !body.trim()}
                        >
                            {editingId ? "Save changes" : "Save note"}
                        </button>
                    </div>
                </form>
            )}

            {notes.length > 0 && (
                <div className="notes-toolbar">
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
                    </select>
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
            :   <div className="notes-grid" aria-label="Planning notes">
                    {sortedNotes.map((note) => (
                        <NoteCard
                            key={note.id}
                            note={note}
                            onEdit={editNote}
                            onDelete={deleteNote}
                        />
                    ))}
                </div>
            }
        </section>
    );
}
