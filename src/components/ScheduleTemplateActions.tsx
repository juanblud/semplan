import { useState } from "react";
import {
    calendarCourses,
    CANCELLED_KEY,
    courseKey,
    loadCalendarItems,
    loadSaved,
    semesters,
} from "./calendarStorage";
import { TEMPLATE_KEY } from "./savedTemplates";
import type { SavedTemplate } from "./savedTemplates";

function normalize(code: string) {
    return code.toLowerCase().replace(/\s/g, "");
}

export function ScheduleTemplateActions({
    code,
    section,
    semester,
    details,
    onSaved,
}: {
    code: string;
    section: string;
    semester: string;
    details?: SavedTemplate["details"];
    onSaved: () => void;
}) {
    const [notice, setNotice] = useState("");
    const [error, setError] = useState("");

    function saveTemplate() {
        setError("");
        const term = semesters.find((term) => term.name === semester);
        const course = calendarCourses.find(
            (course) => normalize(course.code) === normalize(code),
        );
        const meetingDays =
            details?.schedule.match(/\b(?:Sun|Mon|Tue|Wed|Thu|Fri|Sat)\b/g) ??
            [];
        const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
        const days =
            meetingDays.length ?
                [...new Set(meetingDays.map((day) => weekdays.indexOf(day)))]
            : section ? []
            : (course?.meetingDays ?? []);
        if (!term || days.length === 0) {
            setError(
                "Add this course's semester dates and class meeting days in Calendar before saving a schedule template.",
            );
            return;
        }
        const items = loadCalendarItems().filter(
            (item) =>
                normalize(item.course) ===
                    normalize(courseKey(code, section)) &&
                item.semester === semester,
        );
        if (items.length === 0) {
            setError(
                "Add lecture topics or activities to this course's calendar before saving a schedule template.",
            );
            return;
        }
        const saved: SavedTemplate = {
            course: code,
            section,
            semester: term,
            meetingDays: days,
            cancelled: loadSaved<string>(CANCELLED_KEY, []),
            items,
            details,
        };
        try {
            const others = loadSaved<SavedTemplate>(TEMPLATE_KEY, []).filter(
                (entry) =>
                    normalize(entry.course) !== normalize(code) ||
                    (entry.section ?? "") !== section ||
                    entry.semester.name !== semester,
            );
            localStorage.setItem(
                TEMPLATE_KEY,
                JSON.stringify([...others, saved]),
            );
            onSaved();
            setNotice(
                `Schedule template saved for ${courseKey(code, section)}, ${semester}. You can use it in another semester.`,
            );
        } catch {
            setError(
                "The schedule template could not be saved in this browser. Try again after freeing storage.",
            );
        }
    }

    return (
        <div className="course-template">
            <div className="course-template-actions">
                <button type="button" onClick={saveTemplate}>
                    Save schedule template
                </button>
            </div>
            {notice && <p role="status">{notice}</p>}
            {error && (
                <p role="alert" className="course-error">
                    {error}
                </p>
            )}
        </div>
    );
}
