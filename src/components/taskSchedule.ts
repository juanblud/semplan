import type { Task } from "../tasks";
import { getCalendarSemesters } from "./calendarStorage";
import { getClassesFrom, toScheduledCourse } from "./courseSchedule";

interface TaskCourse {
    code: string;
    section?: string;
    semester: string;
    schedule: string;
    startDate?: string;
    endDate?: string;
}

// Tasks name their class as "CISC275": upper case, no spaces.
export function normalizeCourseCode(code: string): string {
    return code.toUpperCase().replace(/\s+/g, "");
}

// The saved course a task belongs to, if it names one.
export function findTaskCourse<T extends TaskCourse>(
    task: Pick<Task, "course" | "semester">,
    courses: T[],
): T | undefined {
    return courses.find(
        (course) =>
            course.semester === task.semester &&
            normalizeCourseCode(course.code) === task.course,
    );
}

// Tasks due at a class get that class's date, or, if it was cancelled, the
// date of the next class still on, with `movedFrom` saying which one it was.
export function resolveTaskDates(
    tasks: Task[],
    courses: TaskCourse[],
    cancelledClasses: string[],
): Task[] {
    const semesters = getCalendarSemesters(courses);
    return tasks.map((task) => {
        const { dueClass } = task;
        const course = dueClass && findTaskCourse(task, courses);
        const semester = semesters.find((term) => term.name === task.semester);
        if (!dueClass || !course || !semester) {
            return task;
        }
        const [due] = getClassesFrom(
            dueClass,
            toScheduledCourse(course),
            semester,
            cancelledClasses,
            1,
        );
        return due && due !== dueClass ?
                { ...task, finishDate: due, movedFrom: dueClass }
            :   { ...task, finishDate: dueClass, movedFrom: undefined };
    });
}
