import { useRef, useState } from "react";
import type { FormEvent } from "react";
import { createPortal } from "react-dom";
import { CalendarModal } from "./CalendarModal";
import { addCustomSemester } from "./calendarStorage";
import type { Role } from "./SettingsPage";

const SEASONS = ["Spring", "Summer", "Fall", "Winter"];

interface AddSemesterDialogProps {
    existing: string[];
    role: Role;
    onAdd: (name: string) => void;
    onClose: () => void;
}

function AddSemesterDialog({
    existing,
    role,
    onAdd,
    onClose,
}: AddSemesterDialogProps) {
    const [season, setSeason] = useState("Fall");
    const [year, setYear] = useState(() => String(new Date().getFullYear()));
    const [start, setStart] = useState("");
    const [end, setEnd] = useState("");
    const [gradingEnd, setGradingEnd] = useState("");
    const [error, setError] = useState("");

    function submit(event: FormEvent) {
        event.preventDefault();
        // React bubbles events through portals, so this would also submit a
        // form the button sits inside, like the one on the Task View page.
        event.stopPropagation();
        const name = `${season} ${year}`;
        if (!/^\d{4}$/.test(year) || !start || !end) {
            setError("Add a four-digit year, a start date, and an end date.");
        } else if (existing.includes(name)) {
            setError(`${name} already exists.`);
        } else if (end < start) {
            setError("The end date can't be before the start date.");
        } else if (gradingEnd && gradingEnd < end) {
            setError("The grading period can't end before the end date.");
        } else {
            addCustomSemester({
                name,
                start,
                end,
                ...(gradingEnd ? { gradingEnd } : {}),
            });
            onAdd(name);
            onClose();
        }
    }

    return (
        <CalendarModal labelledBy="add-semester-title" onClose={onClose}>
            <h2 id="add-semester-title">Add Semester</h2>
            <form onSubmit={submit} noValidate>
                <div className="add-semester-row">
                    <label className="calendar-dialog-field">
                        <span>Season</span>
                        <select
                            value={season}
                            autoFocus
                            onChange={(event) => setSeason(event.target.value)}
                        >
                            {SEASONS.map((option) => (
                                <option key={option}>{option}</option>
                            ))}
                        </select>
                    </label>
                    <label className="calendar-dialog-field">
                        <span>Year</span>
                        <input
                            type="number"
                            value={year}
                            onChange={(event) => setYear(event.target.value)}
                        />
                    </label>
                    <label className="calendar-dialog-field">
                        <span>Start date</span>
                        <input
                            type="date"
                            value={start}
                            onChange={(event) => setStart(event.target.value)}
                        />
                    </label>
                    <label className="calendar-dialog-field">
                        <span>End date</span>
                        <input
                            type="date"
                            value={end}
                            onChange={(event) => setEnd(event.target.value)}
                        />
                    </label>
                </div>
                {role === "professor" && (
                    <label className="calendar-dialog-field">
                        <span>Grading period end date (optional)</span>
                        <input
                            type="date"
                            value={gradingEnd}
                            onChange={(event) =>
                                setGradingEnd(event.target.value)
                            }
                        />
                    </label>
                )}
                {error && (
                    <p className="calendar-dialog-error" role="alert">
                        {error}
                    </p>
                )}
                <div className="calendar-dialog-actions">
                    <button
                        type="button"
                        className="is-secondary"
                        onClick={onClose}
                    >
                        Cancel
                    </button>
                    <button type="submit">Add Semester</button>
                </div>
            </form>
        </CalendarModal>
    );
}

interface AddSemesterButtonProps {
    existing: string[];
    role?: Role;
    onAdd: (name: string) => void;
}

export function AddSemesterButton({
    existing,
    role = "student",
    onAdd,
}: AddSemesterButtonProps) {
    const [open, setOpen] = useState(false);
    const button = useRef<HTMLButtonElement>(null);

    function close() {
        setOpen(false);
        button.current?.focus();
    }

    return (
        <>
            <button
                ref={button}
                type="button"
                className="add-semester"
                aria-label="Add semester"
                title="Add semester"
                onClick={() => setOpen(true)}
            >
                +&nbsp;Add
            </button>
            {/* Portalled because this button can sit inside another form. The
                shell carries the color scheme's variables. */}
            {open &&
                createPortal(
                    <AddSemesterDialog
                        existing={existing}
                        role={role}
                        onAdd={onAdd}
                        onClose={close}
                    />,
                    document.querySelector(".app-shell") ?? document.body,
                )}
        </>
    );
}
