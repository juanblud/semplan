import { CalendarModal } from "./CalendarModal";
import { formatLongDate } from "./calendarDates";

interface ClassMeetingDialogProps {
    courseCode: string;
    date: Date;
    topicCount: number;
    onCancelClass: () => void;
    onClose: () => void;
}

export function ClassMeetingDialog({
    courseCode,
    date,
    topicCount,
    onCancelClass,
    onClose,
}: ClassMeetingDialogProps) {
    return (
        <CalendarModal labelledBy="class-meeting-title" onClose={onClose}>
            <h2 id="class-meeting-title">Class Meeting</h2>
            <p className="calendar-dialog-course">
                {courseCode} · {formatLongDate(date)}
            </p>
            <p className="calendar-dialog-text">
                {topicCount > 0 &&
                    `Cancelling this class moves its ${topicCount} ${
                        topicCount === 1 ? "topic" : "topics"
                    } back to Unscheduled topics. `}
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
                    onClick={onCancelClass}
                >
                    Mark as Cancelled
                </button>
            </div>
        </CalendarModal>
    );
}
