import { fireEvent, render, screen, within } from "@testing-library/react";
import { CalendarPage } from "../src/components/CalendarPage";
import { PlanningNotesPage } from "../src/components/PlanningNotesPage";
import { TaskViewPage } from "../src/components/TaskViewPage";
import { loadCourses } from "../src/components/CoursesPage";
import type { Course } from "../src/components/CoursesPage";
import { resolveTaskDates } from "../src/components/taskSchedule";
import { loadTasks, saveTasks } from "../src/tasks";
import type { Task } from "../src/tasks";

beforeAll(() => {
    HTMLDialogElement.prototype.showModal = function () {
        this.setAttribute("open", "");
    };
    HTMLDialogElement.prototype.close = function () {
        this.removeAttribute("open");
    };
});

beforeEach(() => {
    localStorage.clear();
    // Wednesday, October 14, 2026, in Fall 2026.
    jest.useFakeTimers({ now: new Date(2026, 9, 14, 9) });
});

afterEach(() => {
    jest.useRealTimers();
});

const cisc275: Course = {
    id: "cisc275",
    code: "CISC 275",
    section: "",
    title: "Software Engineering",
    semester: "Fall 2026",
    instructor: "",
    schedule: "Mon / Wed / Fri 9:05 AM - 9:55 AM",
    location: "",
    color: "#00539f",
};

// Due at Friday's class.
const dueFriday: Task = {
    id: 1,
    title: "Read chapter 4",
    course: "CISC275",
    semester: "Fall 2026",
    startDate: "2026-10-14",
    finishDate: "2026-10-16",
    completed: false,
    dueClass: "2026-10-16",
};

function getMeeting(day: string) {
    const meeting = screen
        .getByRole("button", {
            name: new RegExp(`^Class meeting on ${day}`),
        })
        .closest(".calendar-meeting");
    if (!meeting) throw new Error(`No class on ${day}`);
    return meeting as HTMLElement;
}

function openCalendar(tasks: Task[] = []) {
    render(
        <CalendarPage
            role="student"
            tasks={tasks}
            initialCourse={{
                code: "CISC 275",
                semester: "Fall 2026",
                schedule: "",
                focusDate: "2026-10-14",
            }}
        />,
    );
}

function cancelClass(day: string) {
    fireEvent.click(
        within(getMeeting(day)).getByRole("button", {
            name: /^Class meeting/,
        }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Mark as Cancelled" }));
}

describe("Tasks", () => {
    test("are saved, without the worked-out moved date", () => {
        saveTasks([{ ...dueFriday, movedFrom: "2026-10-14" }]);
        expect(loadTasks()).toEqual([dueFriday]);
    });

    test("due at a class move to the next class when it's cancelled", () => {
        expect(resolveTaskDates([dueFriday], [cisc275], [])).toEqual([
            { ...dueFriday, movedFrom: undefined },
        ]);
        expect(
            resolveTaskDates([dueFriday], [cisc275], ["CISC 275|2026-10-16"]),
        ).toEqual([
            { ...dueFriday, finishDate: "2026-10-19", movedFrom: "2026-10-16" },
        ]);
    });

    test("can be set due at an upcoming class in Task View", () => {
        render(
            <TaskViewPage
                courses={[cisc275]}
                tasks={[]}
                setTasks={(update) => {
                    const next =
                        typeof update === "function" ? update([]) : update;
                    expect(next).toEqual([
                        expect.objectContaining({
                            title: "Read chapter 4",
                            startDate: "2026-10-14",
                            finishDate: "2026-10-16",
                            dueClass: "2026-10-16",
                        }),
                    ]);
                }}
            />,
        );
        fireEvent.change(screen.getByLabelText("Task"), {
            target: { value: "Read chapter 4" },
        });
        fireEvent.change(screen.getByLabelText("Class"), {
            target: { value: "CISC275" },
        });
        // Today's class is "next class" until it's over; Friday is after it.
        const due = screen.getByLabelText("Due");
        expect(
            within(due).getByRole("option", {
                name: "Wed, Oct 14 · next class",
            }),
        ).toBeInTheDocument();
        fireEvent.change(due, { target: { value: "2026-10-16" } });
        // The class is the due date, so no finish date to pick.
        expect(screen.queryByLabelText("Finish date")).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "Add task" }));
        expect.assertions(3);
    });

    test("say so in the Calendar when cancelling moves them", () => {
        openCalendar([dueFriday]);
        cancelClass("Friday, October 16, 2026");
        expect(screen.getByRole("status")).toHaveTextContent(
            "1 task is now due at the next class.",
        );
    });
});

describe("Class notes", () => {
    test("'pick up next class' shows on the next class, and moves past a cancelled one", () => {
        openCalendar();
        fireEvent.click(
            within(getMeeting("Wednesday, October 14, 2026")).getByRole(
                "button",
                { name: /^Class meeting/ },
            ),
        );
        fireEvent.change(screen.getByLabelText("Class notes"), {
            target: { value: "Covered immutability" },
        });
        fireEvent.change(screen.getByLabelText("Pick up next class with"), {
            target: { value: "Start at slide 13" },
        });
        fireEvent.click(screen.getByRole("button", { name: "Close" }));

        expect(getMeeting("Friday, October 16, 2026")).toHaveTextContent(
            "Pick up: Start at slide 13",
        );
        // Wednesday shows it has notes.
        expect(
            screen.getByRole("button", {
                name: /^Class meeting on Wednesday, October 14, 2026.*has class notes$/,
            }),
        ).toBeInTheDocument();

        cancelClass("Friday, October 16, 2026");
        fireEvent.click(screen.getByRole("button", { name: "Next week" }));
        expect(getMeeting("Monday, October 19, 2026")).toHaveTextContent(
            "Pick up: Start at slide 13",
        );
    });

    test("show up in Planning Notes with the class they'll appear on", () => {
        localStorage.setItem(
            "semplan-planning-notes",
            JSON.stringify([
                {
                    id: "1",
                    title: "CISC 275 · Wed, Oct 14",
                    body: "Covered immutability",
                    courseId: "cisc275",
                    createdAt: 1,
                    updatedAt: 1,
                    classDate: "2026-10-14",
                    nextClass: "Start at slide 13",
                },
            ]),
        );
        render(<PlanningNotesPage courses={loadCourses()} />);
        const card = screen
            .getByRole("heading", { name: "CISC 275 · Wed, Oct 14" })
            .closest("article");
        expect(card).toHaveTextContent("Class on Wed, Oct 14");
        expect(card).toHaveTextContent(
            "Next class, Fri, Oct 16: Start at slide 13",
        );
    });
});
