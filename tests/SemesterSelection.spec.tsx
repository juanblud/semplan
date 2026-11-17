import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { App } from "../src/App";
import { CalendarPage } from "../src/components/CalendarPage";
import { loadCourses } from "../src/components/CoursesPage";

type User = ReturnType<typeof userEvent.setup>;

function useRole(role: "student" | "professor") {
    localStorage.setItem(
        "semplan:settings",
        JSON.stringify({
            darkMode: false,
            largeFont: false,
            role,
            roleSelected: true,
        }),
    );
}

function semesterSelect() {
    return screen.getByRole("combobox", { name: "Semester" });
}

async function openTab(user: User, name: string) {
    await user.click(screen.getByRole("link", { name }));
}

interface SemesterFields {
    season?: string;
    year?: string;
    start?: string;
    end?: string;
    gradingEnd?: string;
}

async function addSemester(
    user: User,
    { season, year, start, end, gradingEnd }: SemesterFields,
) {
    await user.click(screen.getByRole("button", { name: "Add semester" }));
    const dialog = screen.getByRole("dialog", { name: "Add Semester" });
    if (season) {
        await user.selectOptions(
            within(dialog).getByLabelText("Season"),
            season,
        );
    }
    for (const [label, value] of [
        ["Year", year],
        ["Start date", start],
        ["End date", end],
        ["Grading period end date (optional)", gradingEnd],
    ]) {
        if (value) {
            fireEvent.change(within(dialog).getByLabelText(label as string), {
                target: { value },
            });
        }
    }
    await user.click(
        within(dialog).getByRole("button", { name: "Add Semester" }),
    );
}

beforeAll(() => {
    // jsdom doesn't implement these, and the Courses page's form uses them.
    HTMLDialogElement.prototype.showModal = function () {
        this.setAttribute("open", "");
    };
    HTMLDialogElement.prototype.close = function () {
        this.removeAttribute("open");
    };
});

describe("selected semester", () => {
    beforeEach(() => {
        localStorage.clear();
        window.history.replaceState(null, "", "/");
        useRole("student");
    });

    test("stays selected when changing tabs and after a reload", async () => {
        const user = userEvent.setup();
        const view = render(<App />);

        await user.selectOptions(semesterSelect(), "Spring 2027");

        for (const tab of ["Courses", "Calendar", "Task View", "Home"]) {
            await openTab(user, tab);
            expect(semesterSelect()).toHaveValue("Spring 2027");
        }

        await openTab(user, "Calendar");
        expect(
            screen.getByRole("heading", { name: "February 2027" }),
        ).toBeInTheDocument();

        await user.selectOptions(semesterSelect(), "Fall 2026");
        await openTab(user, "Courses");
        expect(semesterSelect()).toHaveValue("Fall 2026");

        await user.selectOptions(semesterSelect(), "Spring 2027");
        view.unmount();
        render(<App />);
        expect(semesterSelect()).toHaveValue("Spring 2027");
    });

    test("falls back to the default when the saved semester no longer exists", () => {
        localStorage.setItem(
            "semester-planner:selected-semester",
            "Summer 1999",
        );
        render(<App />);

        expect(semesterSelect()).toHaveValue("Fall 2026");
    });
});

describe("adding a semester", () => {
    beforeEach(() => {
        localStorage.clear();
        window.history.replaceState(null, "", "/");
        useRole("student");
    });

    test("selects the new semester and offers it on every tab", async () => {
        const user = userEvent.setup();
        const view = render(<App />);

        await addSemester(user, {
            season: "Winter",
            year: "2030",
            start: "2030-01-07",
            end: "2030-01-25",
        });

        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
        expect(semesterSelect()).toHaveValue("Winter 2030");
        expect(
            screen.getByRole("button", { name: "Add semester" }),
        ).toHaveFocus();

        for (const tab of ["Courses", "Task View", "Calendar"]) {
            await openTab(user, tab);
            expect(semesterSelect()).toHaveValue("Winter 2030");
        }
        expect(
            screen.getByRole("heading", { name: "January 2030" }),
        ).toBeInTheDocument();
        expect(
            screen.getByText("Winter 2030 runs Jan 7 – Jan 25, 2030"),
        ).toBeInTheDocument();

        view.unmount();
        render(<App />);
        expect(
            within(semesterSelect()).getByRole("option", {
                name: "Winter 2030",
            }),
        ).toBeInTheDocument();
    });

    test("jumps the calendar to a semester added from the Calendar tab", async () => {
        const user = userEvent.setup();
        render(<CalendarPage />);

        await addSemester(user, {
            season: "Summer",
            year: "2031",
            start: "2031-06-02",
            end: "2031-07-25",
        });

        expect(semesterSelect()).toHaveValue("Summer 2031");
        expect(
            screen.getByRole("heading", { name: "June 2031" }),
        ).toBeInTheDocument();
    });

    test.each([
        [
            "missing dates",
            { year: "2030" },
            "Add a four-digit year, a start date, and an end date.",
        ],
        [
            "a bad year",
            { year: "30", start: "2030-01-07", end: "2030-01-25" },
            "Add a four-digit year, a start date, and an end date.",
        ],
        [
            "an end before the start",
            { year: "2030", start: "2030-02-01", end: "2030-01-25" },
            "The end date can't be before the start date.",
        ],
        [
            "a semester that already exists",
            { year: "2026", start: "2026-09-01", end: "2026-12-14" },
            "Fall 2026 already exists.",
        ],
    ])("rejects %s", async (_name, fields, message) => {
        const user = userEvent.setup();
        render(<App />);

        await addSemester(user, fields);

        expect(screen.getByRole("alert")).toHaveTextContent(message);
        expect(screen.getByRole("dialog")).toBeInTheDocument();
    });

    test("doesn't submit the task form it sits inside on Task View", async () => {
        const user = userEvent.setup();
        render(<App />);
        await openTab(user, "Task View");
        await user.type(screen.getByLabelText("Task"), "Unsaved task");

        await addSemester(user, {
            year: "2030",
            start: "2030-09-01",
            end: "2030-12-14",
        });

        expect(semesterSelect()).toHaveValue("Fall 2030");
        expect(screen.getByLabelText("Task")).toHaveValue("Unsaved task");
    });

    test("only asks students for the semester dates", async () => {
        const user = userEvent.setup();
        render(<App />);

        await user.click(screen.getByRole("button", { name: "Add semester" }));

        expect(
            screen.queryByLabelText("Grading period end date (optional)"),
        ).not.toBeInTheDocument();
    });

    test("shows professors the grading period end on the calendar", async () => {
        useRole("professor");
        const user = userEvent.setup();
        render(<App />);

        await addSemester(user, {
            season: "Winter",
            year: "2030",
            start: "2030-01-07",
            end: "2030-01-25",
            gradingEnd: "2030-01-30",
        });
        // The calendar grid only appears once the semester has a course.
        await openTab(user, "Courses");
        await user.click(screen.getByRole("button", { name: "Create Course" }));
        fireEvent.change(screen.getByLabelText("Course code *"), {
            target: { value: "MATH 241" },
        });
        fireEvent.change(screen.getByLabelText("Course name *"), {
            target: { value: "Calculus" },
        });
        await user.click(screen.getByRole("button", { name: "Save course" }));
        await openTab(user, "Calendar");

        expect(
            within(
                screen.getByRole("cell", {
                    name: "Wednesday, January 30, 2030",
                }),
            ).getByText("Grading period ends"),
        ).toBeInTheDocument();
    });

    test("rejects a grading period ending before the semester does", async () => {
        useRole("professor");
        const user = userEvent.setup();
        render(<App />);

        await addSemester(user, {
            year: "2030",
            start: "2030-09-01",
            end: "2030-12-14",
            gradingEnd: "2030-12-01",
        });

        expect(screen.getByRole("alert")).toHaveTextContent(
            "The grading period can't end before the end date.",
        );
    });
});

describe("calendar defaults and colors", () => {
    beforeEach(() => {
        localStorage.clear();
    });

    test("opens on All Courses, and returns to it on a semester change", async () => {
        const user = userEvent.setup();
        render(<CalendarPage />);
        const course = screen.getByRole("combobox", { name: "Course" });

        expect(course).toHaveDisplayValue("All Courses");

        await user.selectOptions(course, "CISC 320");
        await user.selectOptions(semesterSelect(), "Spring 2027");
        await user.selectOptions(semesterSelect(), "Fall 2026");

        expect(
            screen.getByRole("combobox", { name: "Course" }),
        ).toHaveDisplayValue("All Courses");
    });

    test("colors class blocks and activities with their course's color", async () => {
        const user = userEvent.setup();
        const base = loadCourses()[0];
        localStorage.setItem(
            "semester-planner-courses-v1",
            JSON.stringify([
                {
                    ...base,
                    id: "one",
                    code: "CISC 101",
                    schedule: "Tue 9:00 AM - 9:50 AM",
                    color: "#ff0000",
                },
                {
                    ...base,
                    id: "two",
                    code: "CISC 102",
                    schedule: "Tue 10:00 AM - 10:50 AM",
                    color: "#00ff00",
                },
            ]),
        );
        localStorage.setItem(
            "semester-planner:calendar-items",
            JSON.stringify([
                {
                    id: "quiz",
                    course: "CISC 102",
                    semester: "Fall 2026",
                    kind: "activity",
                    title: "Quiz",
                    // A Wednesday, so it sits outside any class block.
                    date: "2026-09-02",
                },
            ]),
        );
        render(<CalendarPage />);
        await user.selectOptions(semesterSelect(), "Spring 2027");
        await user.selectOptions(semesterSelect(), "Fall 2026");

        const courseColor = (element: HTMLElement) =>
            element.style.getPropertyValue("--course-color");
        const blockFor = (code: string) =>
            screen
                .getByRole("button", {
                    name: new RegExp(
                        `^${code} class meeting on Tuesday, September 1,`,
                    ),
                })
                .closest(".calendar-meeting") as HTMLElement;

        expect(courseColor(blockFor("CISC 101"))).toBe("#ff0000");
        expect(courseColor(blockFor("CISC 102"))).toBe("#00ff00");
        expect(
            courseColor(screen.getByRole("group", { name: "CISC 102: Quiz" })),
        ).toBe("#00ff00");
    });
});
