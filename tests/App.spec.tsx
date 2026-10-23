import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { App } from "../src/App";

describe("App", () => {
    beforeAll(() => {
        HTMLDialogElement.prototype.showModal = function () {
            this.setAttribute("open", "");
        };
        HTMLDialogElement.prototype.close = function () {
            this.removeAttribute("open");
        };
    });
    beforeEach(() => {
        window.history.replaceState(null, "", "/");
        localStorage.clear();
    });

    test("gives each sidebar page its own URL", async () => {
        const user = userEvent.setup();
        render(<App />);
        expect(window.location.pathname).toBe("/Home");

        await user.click(screen.getByRole("link", { name: "Calendar" }));
        expect(window.location.pathname).toBe("/Calendar");

        await user.click(screen.getByRole("link", { name: "Planning Notes" }));
        expect(window.location.pathname).toBe("/Planning-Notes");
        await user.click(screen.getByRole("link", { name: "Task View" }));
        expect(window.location.pathname).toBe("/Task-View");
        expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
            "Task View",
        );
        expect(screen.getByRole("link", { name: "Courses" })).toHaveAttribute(
            "href",
            "/Courses",
        );
    });

    test("opens the page in the URL, as after a refresh", () => {
        window.history.replaceState(null, "", "/Calendar");
        render(<App />);

        expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
            "Calendar",
        );
        expect(screen.getByRole("link", { name: "Calendar" })).toHaveAttribute(
            "aria-current",
            "page",
        );
    });

    test("deleted courses stay removed from Calendar, including after all courses are deleted", async () => {
        const user = userEvent.setup();
        localStorage.setItem(
            "semester-planner:cancelled-classes",
            JSON.stringify(["CISC 275|2026-10-12"]),
        );
        const view = render(<App />);
        await user.click(screen.getByRole("link", { name: "Calendar" }));
        expect(screen.getByRole("combobox", { name: "Course" })).toHaveValue(
            "CISC 275",
        );
        const calendarItems = localStorage.getItem(
            "semester-planner:calendar-items",
        );
        const cancelledClasses = localStorage.getItem(
            "semester-planner:cancelled-classes",
        );

        await user.click(screen.getByRole("link", { name: "Courses" }));
        await user.click(
            screen.getByRole("button", { name: "Delete CISC 275" }),
        );
        await user.click(
            within(screen.getByRole("dialog")).getByRole("button", {
                name: "Delete course",
            }),
        );
        await user.click(screen.getByRole("link", { name: "Calendar" }));

        const courseSelect = screen.getByRole("combobox", { name: "Course" });
        expect(
            within(courseSelect).queryByRole("option", { name: "CISC 275" }),
        ).not.toBeInTheDocument();
        expect(courseSelect).toHaveValue("CISC 320");
        expect(screen.queryByText("Forms")).not.toBeInTheDocument();
        expect(screen.getByText("Graph Search")).toBeInTheDocument();

        await user.click(screen.getByRole("link", { name: "Courses" }));
        await user.click(
            screen.getByRole("button", { name: "Delete CISC 320" }),
        );
        await user.click(
            within(screen.getByRole("dialog")).getByRole("button", {
                name: "Delete course",
            }),
        );
        await user.click(screen.getByRole("link", { name: "Calendar" }));

        expect(
            screen.getByText(/No courses in this semester/),
        ).toBeInTheDocument();
        expect(screen.getByRole("combobox", { name: "Course" })).toBeDisabled();
        expect(
            screen.getByRole("button", { name: "+ Add Activity" }),
        ).toBeDisabled();
        expect(
            screen.queryByRole("button", { name: "+ Create Topic" }),
        ).not.toBeInTheDocument();

        view.unmount();
        render(<App />);
        expect(
            screen.getByText(/No courses in this semester/),
        ).toBeInTheDocument();
        expect(
            screen.queryByRole("option", { name: /CISC/ }),
        ).not.toBeInTheDocument();
        expect(
            screen.queryByRole("button", { name: /Class meeting on/ }),
        ).not.toBeInTheDocument();
        expect(localStorage.getItem("semester-planner:calendar-items")).toBe(
            calendarItems,
        );
        expect(localStorage.getItem("semester-planner:cancelled-classes")).toBe(
            cancelledClasses,
        );
    });

    test("deleting one section preserves other sections and semesters in Calendar", async () => {
        const user = userEvent.setup();
        const course = {
            id: "fall010",
            code: "CISC 275",
            section: "010",
            title: "Software Engineering",
            semester: "Fall 2026",
            instructor: "Austin Cory Bart",
            schedule: "Mon / Wed / Fri 1:50 PM - 2:45 PM",
            location: "Colburn Lab 115",
            color: "#00539f",
        };
        localStorage.setItem(
            "semester-planner-courses-v1",
            JSON.stringify([
                course,
                { ...course, id: "fall011", section: "011" },
                { ...course, id: "spring010", semester: "Spring 2027" },
            ]),
        );
        window.history.replaceState(null, "", "/Courses");
        render(<App />);

        await user.click(
            screen.getByRole("button", {
                name: "Delete CISC 275 - Section 010",
            }),
        );
        await user.click(
            within(screen.getByRole("dialog")).getByRole("button", {
                name: "Delete course",
            }),
        );
        await user.click(screen.getByRole("link", { name: "Calendar" }));
        const courseSelect = screen.getByRole("combobox", { name: "Course" });
        expect(courseSelect).toHaveValue("CISC 275 - Section 011");
        expect(within(courseSelect).getAllByRole("option")).toHaveLength(1);

        await user.selectOptions(
            screen.getByRole("combobox", { name: "Semester" }),
            "Spring 2027",
        );
        expect(courseSelect).toHaveValue("CISC 275 - Section 010");
        expect(within(courseSelect).getAllByRole("option")).toHaveLength(1);
    });

    test("opens Task View directly from its URL", () => {
        window.history.replaceState(null, "", "/Task-View");
        render(<App />);

        expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
            "Task View",
        );
        expect(screen.getByRole("link", { name: "Task View" })).toHaveAttribute(
            "aria-current",
            "page",
        );
    });

    test("matches URLs regardless of case and tidies them", () => {
        window.history.replaceState(null, "", "/planning-notes/");
        render(<App />);

        expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
            "Planning Notes",
        );
        expect(window.location.pathname).toBe("/Planning-Notes");
    });

    test("falls back to Home for unknown URLs", () => {
        window.history.replaceState(null, "", "/not-a-page");
        render(<App />);

        expect(
            screen.getByRole("heading", { name: "ProfPlan" }),
        ).toBeInTheDocument();
        expect(window.location.pathname).toBe("/Home");
    });

    test("follows the browser back button", async () => {
        const user = userEvent.setup();
        render(<App />);
        await user.click(screen.getByRole("link", { name: "Courses" }));

        window.history.replaceState(null, "", "/Home");
        fireEvent(window, new PopStateEvent("popstate"));

        expect(
            screen.getByRole("heading", { name: "ProfPlan" }),
        ).toBeInTheDocument();
    });

    test("opens a course plan on the Courses URL", async () => {
        const user = userEvent.setup();
        render(<App />);

        await user.click(
            screen.getAllByRole("button", { name: "Open Course Plan" })[0],
        );
        expect(window.location.pathname).toBe("/Courses");
    });

    test("saves course edits before opening the Calendar page", async () => {
        const user = userEvent.setup();
        window.history.replaceState(null, "", "/Courses");
        render(<App />);

        await user.click(screen.getByRole("button", { name: "Create Course" }));
        fireEvent.change(screen.getByLabelText("Course code *"), {
            target: { value: "MATH 241" },
        });
        fireEvent.change(screen.getByLabelText("Course name *"), {
            target: { value: "Calculus" },
        });
        await user.click(screen.getByRole("button", { name: "Save course" }));

        await user.click(screen.getByRole("button", { name: "Edit MATH 241" }));
        fireEvent.change(screen.getByLabelText("Meets"), {
            target: { value: "Tue / Thu 9:00 - 10:15 AM" },
        });
        await user.click(
            screen.getByRole("button", { name: "Plan in Calender View" }),
        );

        expect(window.location.pathname).toBe("/Calendar");
        expect(screen.getByRole("combobox", { name: "Course" })).toHaveValue(
            "CISC 275",
        );
        expect(screen.getByRole("combobox", { name: "Semester" })).toHaveValue(
            "Fall 2026",
        );
        expect(localStorage.getItem("semester-planner-courses-v1")).toContain(
            "Tue / Thu 9:00 - 10:15 AM",
        );
        const semester = screen.getByRole("combobox", { name: "Semester" });
        await user.selectOptions(semester, "Spring 2027");
        await user.selectOptions(semester, "Fall 2026");
        await user.click(screen.getByRole("button", { name: "Next month" }));
        await user.selectOptions(
            screen.getByRole("combobox", { name: "Course" }),
            "MATH 241",
        );
        expect(
            within(
                screen.getByRole("cell", { name: "Tuesday, October 13, 2026" }),
            ).getByText("Class Meeting"),
        ).toBeInTheDocument();
        expect(
            within(
                screen.getByRole("cell", { name: "Monday, October 12, 2026" }),
            ).queryByText("Class Meeting"),
        ).not.toBeInTheDocument();
    });

    test("renders the sidebar and home layout", () => {
        render(<App />);

        expect(
            screen.getByRole("heading", { name: "ProfPlan" }),
        ).toBeInTheDocument();
        for (const label of [
            "Home",
            "Courses",
            "Calendar",
            "Planning Notes",
            "Task View",
        ]) {
            expect(
                screen.getByRole("link", { name: label }),
            ).toBeInTheDocument();
        }
        expect(
            screen.getByRole("heading", { name: "Current courses" }),
        ).toBeInTheDocument();
    });

    test("collapses and expands the sidebar", async () => {
        const user = userEvent.setup();
        const { container } = render(<App />);

        expect(
            screen.getByRole("img", { name: "ProfPlan" }),
        ).toBeInTheDocument();
        await user.click(
            screen.getByRole("button", { name: "Collapse sidebar" }),
        );
        expect(container.firstChild).toHaveClass("is-collapsed");
        expect(
            screen.queryByRole("img", { name: "ProfPlan" }),
        ).not.toBeInTheDocument();
        expect(
            screen.getByRole("link", { name: "Calendar" }),
        ).toBeInTheDocument();

        await user.click(
            screen.getByRole("button", { name: "Expand sidebar" }),
        );
        expect(container.firstChild).not.toHaveClass("is-collapsed");
        expect(
            screen.getByRole("img", { name: "ProfPlan" }),
        ).toBeInTheDocument();
    });

    test("keeps the sidebar open or closed when switching pages", async () => {
        const user = userEvent.setup();
        const { container } = render(<App />);

        await user.click(screen.getByRole("link", { name: "Calendar" }));
        expect(container.firstChild).not.toHaveClass("is-collapsed");

        await user.click(
            screen.getByRole("button", { name: "Collapse sidebar" }),
        );
        await user.click(screen.getByRole("link", { name: "Home" }));
        expect(container.firstChild).toHaveClass("is-collapsed");
        await user.click(screen.getByRole("link", { name: "Courses" }));
        expect(container.firstChild).toHaveClass("is-collapsed");
    });

    test("navigates to a sidebar section", async () => {
        const user = userEvent.setup();
        render(<App />);

        await user.click(screen.getByRole("link", { name: "Planning Notes" }));
        expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
            "Planning Notes",
        );
        expect(
            screen.getByRole("link", { name: "Planning Notes" }),
        ).toHaveAttribute("aria-current", "page");
    });

    test("finds courses with or without spaces in the search", async () => {
        const user = userEvent.setup();
        render(<App />);
        const search = screen.getByRole("searchbox", {
            name: "Search by course code or title",
        });

        await user.type(search, "CISC275");
        expect(
            screen.getByRole("heading", { name: "CISC 275" }),
        ).toBeInTheDocument();
        expect(
            screen.queryByRole("heading", { name: "CISC 320" }),
        ).not.toBeInTheDocument();

        await user.clear(search);
        await user.type(search, "CISC 275");
        expect(
            screen.getByRole("heading", { name: "CISC 275" }),
        ).toBeInTheDocument();

        await user.clear(search);
        await user.type(search, "SoftwareEngineering");
        expect(
            screen.getByRole("heading", { name: "CISC 275" }),
        ).toBeInTheDocument();
    });
});
