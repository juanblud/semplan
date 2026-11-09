import { useState } from "react";
import type { Course } from "./CoursesPage";
import {
    formatWeekRange,
    getSemesterWeek,
    getWeek,
    parseDateKey,
    toDateKey,
} from "./calendarDates";
import { CANCELLED_KEY, loadSaved } from "./calendarStorage";
import {
    getStartMinutes,
    isClassMeeting,
    toScheduledCourse,
} from "./courseSchedule";
import type { Semester } from "./scheduleTemplate";

interface HomeWeekViewProps {
    courses: Course[];
    semester: Semester;
    now: Date;
}

// One week of classes, with a column only for the days that have one. Outside
// the semester it shows the semester's nearest week, its first or its last.
export function HomeWeekView({ courses, semester, now }: HomeWeekViewProps) {
    const [cancelledClasses] = useState(() =>
        loadSaved<string>(CANCELLED_KEY, []),
    );
    const scheduledCourses = courses.map(toScheduledCourse);
    const today = toDateKey(now);
    const shownDate =
        today < semester.start ? parseDateKey(semester.start)
        : today > semester.end ? parseDateKey(semester.end)
        : now;
    const week = getWeek(shownDate);
    const isThisWeek = week.some((date) => toDateKey(date) === today);
    const classDays = week
        .map((date) => ({
            date,
            meetings: scheduledCourses
                .filter((course) =>
                    isClassMeeting(date, course, semester, cancelledClasses),
                )
                .sort(
                    (a, b) =>
                        getStartMinutes(a.meetingTime) -
                        getStartMinutes(b.meetingTime),
                ),
        }))
        .filter((day) => day.meetings.length > 0);

    return (
        <section className="home-week" aria-labelledby="home-week-title">
            <h2 id="home-week-title">
                {isThisWeek ?
                    "This week"
                :   `Week ${getSemesterWeek(shownDate, semester.start, semester.end)}`
                }
            </h2>
            <p className="home-week-range">
                {formatWeekRange(week[0], week[6])}
            </p>
            {classDays.length > 0 ?
                <ul className="home-week-days">
                    {classDays.map(({ date, meetings }) => {
                        const isToday = toDateKey(date) === today;
                        return (
                            <li
                                key={toDateKey(date)}
                                className={`home-week-day${isToday ? " is-today" : ""}`}
                                aria-current={isToday ? "date" : undefined}
                            >
                                <h3>
                                    {date.toLocaleDateString("en-US", {
                                        weekday: "long",
                                    })}{" "}
                                    <span>
                                        {date.toLocaleDateString("en-US", {
                                            month: "short",
                                            day: "numeric",
                                        })}
                                    </span>
                                </h3>
                                <ul>
                                    {meetings.map((meeting) => (
                                        <li key={meeting.code}>
                                            <strong>{meeting.code}</strong>
                                            {meeting.meetingTime && (
                                                <span>
                                                    {meeting.meetingTime}
                                                </span>
                                            )}
                                        </li>
                                    ))}
                                </ul>
                            </li>
                        );
                    })}
                </ul>
            :   <p className="empty-message">No classes scheduled this week.</p>
            }
        </section>
    );
}
