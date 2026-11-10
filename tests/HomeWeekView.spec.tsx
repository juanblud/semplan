import { fireEvent, render, screen, within } from "@testing-library/react";
import type { Course } from "../src/components/CoursesPage";
import { HomePage } from "../src/components/HomePage";

const baseCourse: Course = {
    id: "cisc320",
    code: "CISC 320",
    section: "010",
    title: "Algorithms",
    semester: "Fall 2026",
    instructor: "",
    schedule: "Tue / Thu 2:00 PM - 3:15 PM",
    location: "",
    color: "#00539f",
};

function renderHome(courses: Course[]) {
    render(
        <HomePage
            courses={courses}
            tasks={[]}
            showTasks={false}
            onToggleTask={jest.fn()}
            onOpenCourse={jest.fn()}
        />,
    );
}

function dayHeadings(weekTitle: string): (string | null)[] {
    return within(screen.getByRole("region", { name: weekTitle }))
        .queryAllByRole("heading", { level: 3 })
        .map((heading) => heading.textContent);
}

describe("Home week view", () => {
    beforeEach(() => {
        localStorage.clear();
        // Tuesday, November 3, 2026.
        jest.useFakeTimers({ now: new Date(2026, 10, 3, 12) });
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    test("only shows the days a class meets", () => {
        renderHome([baseCourse]);

        expect(dayHeadings("This week")).toEqual([
            "Tuesday Nov 3",
            "Thursday Nov 5",
        ]);
        expect(screen.getByText("November 1–7, 2026")).toBeInTheDocument();
        expect(screen.getAllByText("2:00 PM - 3:15 PM").length).toBeGreaterThan(
            0,
        );
    });

    test("marks today's column", () => {
        renderHome([baseCourse]);

        const week = screen.getByRole("region", { name: "This week" });
        const tuesday = within(week)
            .getByRole("heading", { name: "Tuesday Nov 3" })
            .closest("li");
        expect(tuesday).toHaveAttribute("aria-current", "date");
        const thursday = within(week)
            .getByRole("heading", { name: "Thursday Nov 5" })
            .closest("li");
        expect(thursday).not.toHaveAttribute("aria-current");
    });

    test("combines courses and orders each day by start time", () => {
        renderHome([
            baseCourse,
            {
                ...baseCourse,
                id: "cisc275",
                code: "CISC 275",
                schedule: "Tue / Fri 9:00 AM - 9:50 AM",
            },
        ]);

        expect(dayHeadings("This week")).toEqual([
            "Tuesday Nov 3",
            "Thursday Nov 5",
            "Friday Nov 6",
        ]);
        const tuesday = within(
            screen.getByRole("region", { name: "This week" }),
        )
            .getByRole("heading", { name: "Tuesday Nov 3" })
            .closest("li") as HTMLElement;
        expect(
            within(tuesday)
                .getAllByRole("listitem")
                .map((item) => item.querySelector("strong")?.textContent),
        ).toEqual(["CISC 275 - Section 010", "CISC 320 - Section 010"]);
    });

    test("drops a day whose only class is cancelled", () => {
        localStorage.setItem(
            "semester-planner:cancelled-classes",
            JSON.stringify(["CISC 320 - Section 010|2026-11-05"]),
        );
        renderHome([baseCourse]);

        expect(dayHeadings("This week")).toEqual(["Tuesday Nov 3"]);
    });

    test("leaves out a course outside its own date range", () => {
        renderHome([
            baseCourse,
            {
                ...baseCourse,
                id: "ended",
                code: "CISC 108",
                schedule: "Mon 9:00 AM - 9:50 AM",
                endDate: "2026-10-30",
            },
        ]);

        expect(dayHeadings("This week")).toEqual([
            "Tuesday Nov 3",
            "Thursday Nov 5",
        ]);
    });

    test("shows a message when no classes are scheduled", () => {
        renderHome([{ ...baseCourse, schedule: "" }]);

        expect(
            screen.getByText("No classes scheduled this week."),
        ).toBeInTheDocument();
    });

    test("shows the first week of a semester that hasn't started", () => {
        renderHome([
            baseCourse,
            { ...baseCourse, id: "spring", semester: "Spring 2027" },
        ]);

        fireEvent.change(screen.getByRole("combobox", { name: "Semester" }), {
            target: { value: "Spring 2027" },
        });

        expect(dayHeadings("Week 1")).toEqual([
            "Tuesday Feb 9",
            "Thursday Feb 11",
        ]);
    });

    test("is hidden when the semester has no courses", () => {
        renderHome([]);

        expect(
            screen.queryByRole("region", { name: "This week" }),
        ).not.toBeInTheDocument();
    });
});
