import { useState } from "react";
import type { FormEvent } from "react";
import { CalendarModal } from "./CalendarModal";
import {
    WEEKDAYS,
    formatLongDate,
    getMonthGrid,
    startOfMonth,
    toDateKey,
} from "./calendarDates";

export interface NewActivity {
    title: string;
    date: string;
    time: string;
}

interface AddActivityDialogProps {
    courseCode: string;
    // The mini calendar opens on the month the main calendar is showing, or
    // on this month if that one has already passed.
    initialMonth: Date;
    onAdd: (activity: NewActivity) => void;
    onClose: () => void;
}

const listFormat = new Intl.ListFormat("en-US", { type: "conjunction" });

export function AddActivityDialog({
    courseCode,
    initialMonth,
    onAdd,
    onClose,
}: AddActivityDialogProps) {
    const [month, setMonth] = useState(() => {
        const thisMonth = startOfMonth(new Date());
        const shown = startOfMonth(initialMonth);
        return shown < thisMonth ? thisMonth : shown;
    });
    const [date, setDate] = useState<string | null>(null);
    const [time, setTime] = useState("");
    const [title, setTitle] = useState("");
    const [error, setError] = useState("");

    const todayKey = toDateKey(new Date());

    function changeMonth(offset: number) {
        setMonth(
            (current) =>
                new Date(current.getFullYear(), current.getMonth() + offset, 1),
        );
    }

    function submit(event: FormEvent) {
        event.preventDefault();
        const missing = [
            !title.trim() && "a name",
            !date && "a date",
            !time && "a time",
        ].filter((field): field is string => Boolean(field));
        if (missing.length > 0 || !date) {
            setError(
                `Add ${listFormat.format(missing)} to save this activity.`,
            );
            return;
        }
        onAdd({ title: title.trim(), date, time });
    }

    return (
        <CalendarModal labelledBy="add-activity-title" onClose={onClose}>
            <h2 id="add-activity-title">Add Activity</h2>
            <p className="calendar-dialog-course">{courseCode}</p>

            <form onSubmit={submit} noValidate>
                <label className="calendar-dialog-field">
                    <span>Activity name</span>
                    <input
                        type="text"
                        value={title}
                        placeholder="e.g. Practice Test"
                        autoFocus
                        onChange={(event) => setTitle(event.target.value)}
                    />
                </label>

                <fieldset className="mini-calendar">
                    <legend>Date</legend>
                    <div className="mini-calendar-nav">
                        <button
                            type="button"
                            aria-label="Previous month"
                            onClick={() => changeMonth(-1)}
                        >
                            ‹
                        </button>
                        <span aria-live="polite">
                            {month.toLocaleDateString("en-US", {
                                month: "long",
                                year: "numeric",
                            })}
                        </span>
                        <button
                            type="button"
                            aria-label="Next month"
                            onClick={() => changeMonth(1)}
                        >
                            ›
                        </button>
                    </div>
                    <div className="mini-calendar-grid">
                        {WEEKDAYS.map((day) => (
                            <abbr
                                key={day}
                                title={day}
                                className="mini-calendar-weekday"
                            >
                                {day.slice(0, 2)}
                            </abbr>
                        ))}
                        {getMonthGrid(month).map((day) => {
                            const key = toDateKey(day);
                            // Activities can only be added from today on.
                            const past = key < todayKey;
                            const className = [
                                "mini-calendar-day",
                                day.getMonth() !== month.getMonth() &&
                                    "is-outside",
                                key === todayKey && "is-today",
                                past && "is-past",
                            ]
                                .filter(Boolean)
                                .join(" ");
                            return (
                                <button
                                    key={key}
                                    type="button"
                                    className={className}
                                    aria-label={formatLongDate(day)}
                                    aria-pressed={date === key}
                                    disabled={past}
                                    onClick={() => setDate(key)}
                                >
                                    {day.getDate()}
                                </button>
                            );
                        })}
                    </div>
                </fieldset>

                <label className="calendar-dialog-field">
                    <span>Time</span>
                    <input
                        type="time"
                        value={time}
                        onChange={(event) => setTime(event.target.value)}
                    />
                </label>

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
                    <button type="submit">Save Activity</button>
                </div>
            </form>
        </CalendarModal>
    );
}
