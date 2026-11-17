import { useState } from "react";
import { CalendarModal } from "./CalendarModal";
import {
    formatLongDate,
    formatShortDate,
    parseDateKey,
    toDateKey,
} from "./calendarDates";
import type { Note } from "./planningNotes";

// The same day next month, or that month's last day when it is shorter
// (January 31 gives February 28).
function oneMonthAfter(date: Date): Date {
    const lastDay = new Date(
        date.getFullYear(),
        date.getMonth() + 2,
        0,
    ).getDate();
    return new Date(
        date.getFullYear(),
        date.getMonth() + 1,
        Math.min(date.getDate(), lastDay),
    );
}

// What happens to a cancelled class's topics: pushed back one class (with
// later classes' topics shifting along), moved to one other class, or sent
// back to Unscheduled topics.
export type CancelPlan =
    { kind: "push" } | { kind: "move"; to: string } | { kind: "unschedule" };

interface ClassMeetingDialogProps {
    courseCode: string;
    date: Date;
    topics: { id: string; title: string }[];
    // The course's remaining classes after this one, as date keys.
    laterClasses: string[];
    // This class's own notes, if any.
    note?: Pick<Note, "body" | "nextClass">;
    // "Pick up next class" lines left for this class by earlier ones.
    pickUps: Pick<Note, "id" | "classDate" | "nextClass">[];
    // Called with the notes as typed whenever the dialog closes or the
    // class is cancelled; unchanged notes are left alone by the caller.
    onSaveNote: (body: string, nextClass: string) => void;
    onCancelClass: (plan: CancelPlan) => void;
    onClose: () => void;
}

export function ClassMeetingDialog({
    courseCode,
    date,
    topics,
    laterClasses,
    note,
    pickUps,
    onSaveNote,
    onCancelClass: cancelWithPlan,
    onClose: close,
}: ClassMeetingDialogProps) {
    // With topics planned, cancelling first asks what should happen to them.
    const [choosing, setChoosing] = useState(false);
    const [body, setBody] = useState(note?.body ?? "");
    const [nextClassNote, setNextClassNote] = useState(note?.nextClass ?? "");
    // Notes save however the dialog is left, so nothing typed is lost.
    function onClose() {
        onSaveNote(body, nextClassNote);
        close();
    }
    function onCancelClass(plan: CancelPlan) {
        onSaveNote(body, nextClassNote);
        cancelWithPlan(plan);
    }
    const nextClass = laterClasses.at(0);
    // Rescheduling reaches at most a month ahead; laterClasses already stops
    // at the course's last class. The next class is always offered, even
    // after a break longer than a month.
    const cutoff = toDateKey(oneMonthAfter(date));
    const rescheduleOptions = laterClasses.filter(
        (key, index) => index === 0 || key <= cutoff,
    );
    const [rescheduleTo, setRescheduleTo] = useState(nextClass ?? "");
    const topicWord = topics.length === 1 ? "topic" : "topics";

    if (choosing) {
        return (
            <CalendarModal labelledBy="class-meeting-title" onClose={onClose}>
                <h2 id="class-meeting-title">Cancel Class</h2>
                <p className="calendar-dialog-course">
                    {courseCode} · {formatLongDate(date)}
                </p>
                <p className="calendar-dialog-text">
                    This class has {topics.length} {topicWord} planned. What
                    should happen to {topics.length === 1 ? "it" : "them"}?
                </p>
                <ul className="cancel-plan-topics">
                    {topics.map((topic) => (
                        <li key={topic.id}>{topic.title}</li>
                    ))}
                </ul>
                <div className="cancel-plan-options">
                    {nextClass ?
                        <>
                            <button
                                type="button"
                                className="cancel-plan-option"
                                autoFocus
                                onClick={() => onCancelClass({ kind: "push" })}
                            >
                                <strong>Push plans back one class</strong>
                                <span>
                                    They move to{" "}
                                    {formatLongDate(parseDateKey(nextClass))},
                                    and each later class&apos;s topics shift
                                    back one class until a class with nothing
                                    planned.
                                </span>
                            </button>
                            <button
                                type="button"
                                className="cancel-plan-option"
                                onClick={() =>
                                    onCancelClass({
                                        kind: "move",
                                        to: nextClass,
                                    })
                                }
                            >
                                <strong>Move to the next class</strong>
                                <span>
                                    Adds them to{" "}
                                    {formatLongDate(parseDateKey(nextClass))}.
                                    Nothing else moves.
                                </span>
                            </button>
                            <div className="cancel-plan-option is-reschedule">
                                <label>
                                    <strong>Reschedule to another class</strong>
                                    <span>Up to one month ahead.</span>
                                    <select
                                        value={rescheduleTo}
                                        onChange={(event) =>
                                            setRescheduleTo(event.target.value)
                                        }
                                    >
                                        {rescheduleOptions.map((key) => (
                                            <option key={key} value={key}>
                                                {formatLongDate(
                                                    parseDateKey(key),
                                                )}
                                            </option>
                                        ))}
                                    </select>
                                </label>
                                <button
                                    type="button"
                                    onClick={() =>
                                        onCancelClass({
                                            kind: "move",
                                            to: rescheduleTo,
                                        })
                                    }
                                >
                                    Move Here
                                </button>
                            </div>
                        </>
                    :   <p className="calendar-dialog-text">
                            This is the course&apos;s last class, so there is no
                            later class to move them to.
                        </p>
                    }
                    <button
                        type="button"
                        className="cancel-plan-option is-plain"
                        autoFocus={!nextClass}
                        onClick={() => onCancelClass({ kind: "unschedule" })}
                    >
                        <strong>Just cancel</strong>
                        <span>
                            The {topicWord}{" "}
                            {topics.length === 1 ? "goes" : "go"} back to
                            Unscheduled topics without being pushed back.
                        </span>
                    </button>
                </div>
                <div className="calendar-dialog-actions">
                    <button
                        type="button"
                        className="is-secondary"
                        onClick={() => setChoosing(false)}
                    >
                        Back
                    </button>
                </div>
            </CalendarModal>
        );
    }

    return (
        <CalendarModal labelledBy="class-meeting-title" onClose={onClose}>
            <h2 id="class-meeting-title">Class Meeting</h2>
            <p className="calendar-dialog-course">
                {courseCode} · {formatLongDate(date)}
            </p>
            {pickUps.map((pickUp) => (
                <div key={pickUp.id} className="class-pickup">
                    <strong>Pick up from last class</strong>
                    <p>{pickUp.nextClass}</p>
                    {pickUp.classDate && (
                        <small>
                            From your notes on{" "}
                            {formatShortDate(pickUp.classDate)}
                        </small>
                    )}
                </div>
            ))}
            <div className="class-notes">
                <label>
                    Class notes
                    <textarea
                        rows={3}
                        placeholder="What you covered, questions that came up…"
                        value={body}
                        onChange={(event) => setBody(event.target.value)}
                    />
                </label>
                <label>
                    Pick up next class with
                    <input
                        type="text"
                        placeholder="e.g. Start at slide 13"
                        value={nextClassNote}
                        onChange={(event) =>
                            setNextClassNote(event.target.value)
                        }
                    />
                </label>
                <small>
                    {nextClass ?
                        `Shows on ${formatShortDate(nextClass)}, or the class after if that one's cancelled. Notes save to Planning Notes.`
                    :   "This is the last class. Notes save to Planning Notes."}
                </small>
            </div>
            <p className="calendar-dialog-text">
                {topics.length > 0 &&
                    `This class has ${topics.length} ${topicWord} planned; cancelling asks where they should go. `}
                Activities due this day stay on the calendar.
            </p>
            <div className="calendar-dialog-actions">
                <button
                    type="button"
                    className="is-secondary"
                    autoFocus
                    onClick={onClose}
                >
                    Close
                </button>
                <button
                    type="button"
                    className="is-danger"
                    onClick={() =>
                        topics.length > 0 ?
                            setChoosing(true)
                        :   onCancelClass({ kind: "unschedule" })
                    }
                >
                    Mark as Cancelled
                </button>
            </div>
        </CalendarModal>
    );
}
