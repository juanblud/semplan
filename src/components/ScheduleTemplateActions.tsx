import { useState } from "react";
import {
    calendarCourses,
    CANCELLED_KEY,
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
    semester,
    details,
}: {
    code: string;
    semester: string;
    details?: SavedTemplate["details"];
}) {
    const [notice, setNotice] = useState("");
    const [error, setError] = useState("");

    function saveTemplate() {
        setError("");
        const term = semesters.find((term) => term.name === semester);
        const course = calendarCourses.find(
            (course) => normalize(course.code) === normalize(code),
        );
        if (!term || !course) {
            setError(
                "Add this course's semester dates and class meeting days in Calendar before saving a schedule template.",
            );
            return;
        }
        const items = loadCalendarItems().filter(
            (item) =>
                normalize(item.course) === normalize(code) &&
                item.semester === semester,
        );
        if (items.length === 0) {
            setError(
                "Add lecture topics or activities to this course's calendar before saving a schedule template.",
            );
            return;
        }
        const saved: SavedTemplate = {
            course: course.code,
            semester: term,
            meetingDays: course.meetingDays,
            cancelled: loadSaved<string>(CANCELLED_KEY, []),
            items,
            details,
        };
        try {
            const others = loadSaved<SavedTemplate>(TEMPLATE_KEY, []).filter(
                (entry) =>
                    normalize(entry.course) !== normalize(code) ||
                    entry.semester.name !== semester,
            );
            localStorage.setItem(
                TEMPLATE_KEY,
                JSON.stringify([...others, saved]),
            );
            setNotice(
                `Schedule template saved for ${code}, ${semester}. You can use it in another semester.`,
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
