import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { App } from "../src/App";
import { loadCourses } from "../src/components/CoursesPage";

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
        localStorage.setItem(
            "semplan:settings",
            JSON.stringify({
                darkMode: false,
                largeFont: false,
                role: "student",
                roleSelected: true,
            }),
        );
    });

    test("asks first-time visitors to choose a role and remembers Professor", async () => {
        const user = userEvent.setup();
        localStorage.removeItem("semplan:settings");
        window.history.replaceState(null, "", "/Task-View");
        const view = render(<App />);

        const chooser = screen.getByRole("dialog", {
            name: "Select Default Settings",
        });
        expect(within(chooser).getByText("I am a:")).toBeInTheDocument();
        expect(window.location.pathname).toBe("/Home");
        expect(
            document.querySelector(".main-content .home-header h1"),
        ).toHaveTextContent("SemPlan");
        await user.click(
            within(chooser).getByRole("button", { name: "Professor" }),
        );

        expect(
            screen.queryByRole("dialog", { name: "Select Default Settings" }),
        ).not.toBeInTheDocument();
        expect(window.location.pathname).toBe("/Home");
        expect(
            screen.queryByRole("link", { name: "Task View" }),
        ).not.toBeInTheDocument();
        expect(
            JSON.parse(localStorage.getItem("semplan:settings") ?? "{}"),
        ).toMatchObject({
            role: "professor",
            roleSelected: true,
        });

        view.unmount();
        render(<App />);
        expect(
            screen.queryByRole("dialog", { name: "Select Default Settings" }),
        ).not.toBeInTheDocument();
    });

    test("Student choice enables Task View after opening over Home", async () => {
        const user = userEvent.setup();
        localStorage.removeItem("semplan:settings");
        window.history.replaceState(null, "", "/Task-View");
        render(<App />);

        expect(window.location.pathname).toBe("/Home");
        expect(
            document.querySelector(".main-content .home-header h1"),
        ).toHaveTextContent("SemPlan");

        await user.click(
            within(
                screen.getByRole("dialog", { name: "Select Default Settings" }),
            ).getByRole("button", { name: "Student" }),
        );
        expect(window.location.pathname).toBe("/Home");
        expect(
            screen.getByRole("link", { name: "Task View" }),
        ).toBeInTheDocument();
        await user.click(screen.getByRole("link", { name: "Task View" }));
        expect(
            screen.getByRole("heading", { name: "Task View" }),
        ).toBeInTheDocument();
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
        expect(
            screen.getByRole("combobox", { name: "Course" }),
        ).toHaveDisplayValue("All Courses");
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

    test("Home reflects course creation, edits, and deletion, including after refresh", async () => {
        const user = userEvent.setup();
        const view = render(<App />);

        await user.click(screen.getByRole("link", { name: "Courses" }));
        await user.click(screen.getByRole("button", { name: "Create Course" }));
        fireEvent.change(screen.getByLabelText("Course code *"), {
            target: { value: "MATH 241" },
        });
        fireEvent.change(screen.getByLabelText("Course name *"), {
            target: { value: "Calculus" },
        });
        await user.click(screen.getByRole("button", { name: "Save course" }));
        await user.click(screen.getByRole("button", { name: "Edit MATH 241" }));
        fireEvent.change(screen.getByLabelText("Course name *"), {
            target: { value: "Calculus I" },
        });
        await user.click(screen.getByRole("button", { name: "Save course" }));

        await user.click(screen.getByRole("link", { name: "Home" }));
        expect(
            screen.getByRole("heading", { name: "MATH 241" }),
        ).toBeInTheDocument();
        expect(screen.getByText("Calculus I")).toBeInTheDocument();
        await user.click(screen.getByRole("link", { name: "Courses" }));
        await user.click(
            screen.getByRole("button", { name: "Delete MATH 241" }),
        );
        await user.click(
            within(screen.getByRole("dialog")).getByRole("button", {
                name: "Delete course",
            }),
        );
        await user.click(screen.getByRole("link", { name: "Home" }));
        expect(
            screen.queryByRole("heading", { name: "MATH 241" }),
        ).not.toBeInTheDocument();

        view.unmount();
        render(<App />);
        expect(
            screen.queryByRole("heading", { name: "MATH 241" }),
        ).not.toBeInTheDocument();
    });

    test.each(["Home", "Courses", "Calendar"])(
        "%s lists semesters chronologically by year and season",
        (page) => {
            const base = loadCourses()[0];
            const names = [
                "Fall 2028",
                "Summer 2027",
                "Winter 2027",
                "Fall 2027",
                "Spring 2028",
                "Fall 2025",
                "Spring 2027",
                "Fall 2027",
            ];
            localStorage.setItem(
                "semester-planner-courses-v1",
                JSON.stringify(
                    names.map((semester, index) => ({
                        ...base,
                        id: `course-${index}`,
                        section: String(index).padStart(3, "0"),
                        semester,
                        // A course's dates must not move Fall 2027 ahead of Spring 2027.
                        startDate: "2026-10-21",
                        endDate: "2026-12-24",
                    })),
                ),
            );
            window.history.replaceState(null, "", `/${page}`);
            render(<App />);
            const dropdown = screen.getByRole("combobox", { name: "Semester" });
            expect(
                within(dropdown)
                    .getAllByRole("option")
                    .map((option) => option.textContent),
            ).toEqual([
                "Fall 2025",
                "Fall 2026",
                "Winter 2027",
                "Spring 2027",
                "Summer 2027",
                "Fall 2027",
                "Spring 2028",
                "Fall 2028",
            ]);
            fireEvent.change(dropdown, { target: { value: "Fall 2027" } });
            expect(dropdown).toHaveValue("Fall 2027");
        },
    );

    test("Home displays saved sections and semesters from the Courses list", async () => {
        const user = userEvent.setup();
        const course = {
            id: "fall010",
            code: "CISC 275",
            section: "010",
            title: "Software Engineering",
            semester: "Fall 2026",
            instructor: "",
            schedule: "",
            location: "",
            color: "#00539f",
        };
        localStorage.setItem(
            "semester-planner-courses-v1",
            JSON.stringify([
                course,
                { ...course, id: "fall011", section: "011" },
                { ...course, id: "summer010", semester: "Summer 2027" },
            ]),
        );
        render(<App />);

        expect(
            screen.getAllByRole("heading", { name: "CISC 275" }),
        ).toHaveLength(2);
        expect(screen.getByText("Section 010 · Fall 2026")).toBeInTheDocument();
        expect(screen.getByText("Section 011 · Fall 2026")).toBeInTheDocument();
        expect(
            screen.queryByRole("heading", { name: "CISC 320" }),
        ).not.toBeInTheDocument();
        await user.selectOptions(
            screen.getByRole("combobox", { name: "Semester" }),
            "Summer 2027",
        );
        expect(
            screen.getAllByRole("heading", { name: "CISC 275" }),
        ).toHaveLength(1);
        expect(
            screen.getByText("Section 010 · Summer 2027"),
        ).toBeInTheDocument();
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

    test("settings persist appearance and control Task View access", async () => {
        const user = userEvent.setup();
        const view = render(<App />);

        await user.click(screen.getByRole("button", { name: "Settings" }));
        expect(
            screen.getByRole("dialog", { name: "Settings" }),
        ).toBeInTheDocument();
        const colorScheme = screen.getByRole("combobox", {
            name: "Color scheme",
        });
        expect(colorScheme).toHaveValue("ud");
        for (const scheme of ["black-white", "red", "green"] as const) {
            await user.selectOptions(colorScheme, scheme);
            expect(document.querySelector(".app-shell")).toHaveClass(
                `theme-${scheme}`,
            );
        }
        await user.click(screen.getByRole("checkbox", { name: /Dark Mode/ }));
        await user.click(screen.getByRole("checkbox", { name: /Large Font/ }));
        expect(document.querySelector(".app-shell")).toHaveClass(
            "theme-green",
            "is-dark",
            "is-large-font",
        );

        await user.click(screen.getByRole("button", { name: "Professor" }));
        expect(
            screen.getByRole("button", { name: "Professor" }),
        ).toHaveAttribute("aria-pressed", "true");
        expect(
            screen.queryByRole("link", { name: "Task View" }),
        ).not.toBeInTheDocument();

        view.unmount();
        window.history.replaceState(null, "", "/Task-View");
        const restored = render(<App />);
        expect(window.location.pathname).toBe("/Home");
        expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
            "SemPlan",
        );
        expect(
            screen.queryByRole("link", { name: "Task View" }),
        ).not.toBeInTheDocument();
        expect(document.querySelector(".app-shell")).toHaveClass(
            "theme-green",
            "is-dark",
            "is-large-font",
        );
        expect(
            JSON.parse(localStorage.getItem("semplan:settings") ?? "{}"),
        ).toMatchObject({ colorScheme: "green", darkMode: true });

        await user.click(screen.getByRole("button", { name: "Settings" }));
        await user.click(screen.getByRole("button", { name: "Student" }));
        expect(
            screen.getByRole("link", { name: "Task View" }),
        ).toBeInTheDocument();
        await user.click(
            screen.getByRole("button", { name: "Close settings" }),
        );
        await user.click(screen.getByRole("link", { name: "Task View" }));
        expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
            "Task View",
        );
        restored.unmount();
    });

    test("opens settings over the current page without leaving it", async () => {
        const user = userEvent.setup();
        window.history.replaceState(null, "", "/Calendar");
        render(<App />);

        await user.click(screen.getByRole("button", { name: "Settings" }));
        const dialog = screen.getByRole("dialog", { name: "Settings" });
        expect(window.location.pathname).toBe("/Calendar");
        expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
            "Calendar",
        );

        // Changes apply to the page behind straight away.
        await user.click(
            within(dialog).getByRole("checkbox", { name: /Dark Mode/ }),
        );
        expect(document.querySelector(".app-shell")).toHaveClass("is-dark");

        await user.click(
            within(dialog).getByRole("button", { name: "Close settings" }),
        );
        expect(
            screen.queryByRole("dialog", { name: "Settings" }),
        ).not.toBeInTheDocument();

        // Clicking the blurred area outside the panel closes it too.
        await user.click(screen.getByRole("button", { name: "Settings" }));
        await user.click(screen.getByRole("dialog", { name: "Settings" }));
        expect(
            screen.queryByRole("dialog", { name: "Settings" }),
        ).not.toBeInTheDocument();
        expect(window.location.pathname).toBe("/Calendar");
    });

    test("closes settings when the dialog is closed with Escape", async () => {
        const user = userEvent.setup();
        render(<App />);

        await user.click(screen.getByRole("button", { name: "Settings" }));
        // Browsers close a modal dialog on Escape and fire "close".
        fireEvent(
            screen.getByRole("dialog", { name: "Settings" }),
            new Event("close"),
        );

        expect(
            screen.queryByRole("dialog", { name: "Settings" }),
        ).not.toBeInTheDocument();
    });

    test("leaves Task View for Home when switching to Professor over it", async () => {
        const user = userEvent.setup();
        window.history.replaceState(null, "", "/Task-View");
        render(<App />);

        await user.click(screen.getByRole("button", { name: "Settings" }));
        await user.click(screen.getByRole("button", { name: "Professor" }));

        expect(window.location.pathname).toBe("/Home");
        expect(
            document.querySelector(".main-content .home-header h1"),
        ).toHaveTextContent("SemPlan");
        expect(
            screen.queryByRole("link", { name: "Task View" }),
        ).not.toBeInTheDocument();
    });

    test("uses the UD scheme for saved settings without a valid scheme", () => {
        localStorage.setItem(
            "semplan:settings",
            JSON.stringify({
                darkMode: true,
                colorScheme: "unknown",
                role: "student",
                roleSelected: true,
            }),
        );
        render(<App />);

        expect(document.querySelector(".app-shell")).toHaveClass(
            "theme-ud",
            "is-dark",
        );
    });

    test("falls back to Home for unknown URLs", () => {
        window.history.replaceState(null, "", "/not-a-page");
        render(<App />);

        expect(
            screen.getByRole("heading", { name: "SemPlan" }),
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
            screen.getByRole("heading", { name: "SemPlan" }),
        ).toBeInTheDocument();
    });

    test.each([
        { semester: "Fall 2026", index: 0 },
        { semester: "Spring 2027", index: 1 },
    ])(
        "opens Home course $index's weekly reflection for $semester",
        async ({ semester, index }) => {
            const user = userEvent.setup();
            const courses = loadCourses().map((course, i) => ({
                ...course,
                code: "CISC 275",
                section: i === 0 ? "010" : "011",
                semester,
            }));
            localStorage.setItem(
                "semester-planner-courses-v1",
                JSON.stringify(courses),
            );
            render(<App />);
            await user.selectOptions(
                screen.getByRole("combobox", { name: "Semester" }),
                semester,
            );
            expect(
                screen.queryByRole("button", { name: "Open Course Plan" }),
            ).not.toBeInTheDocument();
            const card = screen
                .getByText(courses[index].title)
                .closest("article")!;
            await user.click(
                within(card).getByRole("button", {
                    name: "Open Course Reflection",
                }),
            );

            expect(window.location.pathname).toBe("/Calendar");
            const selectedCourse = `CISC 275 - Section ${courses[index].section}`;
            expect(
                screen.getByRole("combobox", { name: "Course" }),
            ).toHaveDisplayValue(selectedCourse);
            expect(
                screen.getByRole("combobox", { name: "Semester" }),
            ).toHaveValue(semester);
            expect(
                screen.getByRole("button", { name: "Weekly" }),
            ).toHaveAttribute("aria-pressed", "true");
            const reflection = screen.getByRole("textbox", {
                name: "What do you understand well now?",
            });
            expect(reflection).toBeVisible();
            await user.type(reflection, "Course-specific reflection");
            expect(
                JSON.parse(
                    localStorage.getItem("semester-planner:week-reflections")!,
                ),
            ).toEqual([
                expect.objectContaining({
                    course: selectedCourse,
                    semester,
                    understood: "Course-specific reflection",
                }),
            ]);

            await user.click(screen.getByRole("link", { name: "Home" }));
            await user.click(screen.getByRole("link", { name: "Calendar" }));
            expect(
                screen.getByRole("button", { name: "Monthly" }),
            ).toHaveAttribute("aria-pressed", "true");
        },
    );

    test.each(["click", "Enter"])(
        "opens a course card's semester and section in Calendar using %s",
        async (action) => {
            const user = userEvent.setup();
            const course = {
                ...loadCourses()[0],
                id: "spring-section",
                semester: "Spring 2027",
                section: "011",
            };
            localStorage.setItem(
                "semester-planner-courses-v1",
                JSON.stringify([
                    ...loadCourses(),
                    { ...course, id: "other-section", section: "010" },
                    course,
                ]),
            );
            window.history.replaceState(null, "", "/Courses");
            render(<App />);
            await user.selectOptions(
                screen.getByRole("combobox", { name: "Semester" }),
                "Spring 2027",
            );
            const card = screen.getByRole("link", {
                name: "View CISC 275 - Section 011 in calendar",
            });
            if (action === "click") {
                await user.click(within(card).getByText(course.title));
            } else {
                card.focus();
                await user.keyboard("{Enter}");
            }

            expect(window.location.pathname).toBe("/Calendar");
            expect(
                screen.getByRole("combobox", { name: "Course" }),
            ).toHaveDisplayValue("CISC 275 - Section 011");
            expect(
                screen.getByRole("combobox", { name: "Semester" }),
            ).toHaveValue("Spring 2027");

            await user.click(screen.getByRole("link", { name: "Courses" }));
            await user.click(screen.getByRole("link", { name: "Calendar" }));
            expect(
                screen.getByRole("combobox", { name: "Course" }),
            ).toHaveDisplayValue("All Courses");
        },
    );

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
        await user.click(screen.getByRole("checkbox", { name: "Tue" }));
        await user.click(screen.getByRole("checkbox", { name: "Thu" }));
        for (const [label, value] of [
            ["Start time hour", "9"],
            ["Start time minute", "00"],
            ["Start time am/pm", "AM"],
            ["End time hour", "10"],
            ["End time minute", "15"],
            ["End time am/pm", "AM"],
        ]) {
            await user.selectOptions(screen.getByLabelText(label), value);
        }
        await user.click(
            screen.getByRole("button", { name: "Plan in Calendar View" }),
        );

        expect(window.location.pathname).toBe("/Calendar");
        expect(
            screen.getByRole("combobox", { name: "Course" }),
        ).toHaveDisplayValue("MATH 241");
        expect(screen.getByRole("combobox", { name: "Semester" })).toHaveValue(
            "Fall 2026",
        );
        expect(localStorage.getItem("semester-planner-courses-v1")).toContain(
            "Tue / Thu 9:00 AM - 10:15 AM",
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

    test("a newly created semester is available in Calendar and after reloading", async () => {
        const user = userEvent.setup();
        window.history.replaceState(null, "", "/Courses");
        const view = render(<App />);
        await user.click(screen.getByRole("button", { name: "Create Course" }));
        fireEvent.change(screen.getByLabelText("Course code *"), {
            target: { value: "MATH 241" },
        });
        fireEvent.change(screen.getByLabelText("Course name *"), {
            target: { value: "Calculus" },
        });
        fireEvent.change(screen.getByLabelText("Semester *"), {
            target: { value: "Fall 2027" },
        });
        await user.click(screen.getByRole("button", { name: "Save course" }));
        await user.click(screen.getByRole("link", { name: "Calendar" }));
        await user.selectOptions(
            screen.getByRole("combobox", { name: "Semester" }),
            "Fall 2027",
        );
        expect(screen.getByRole("combobox", { name: "Course" })).toHaveValue(
            "MATH 241",
        );
        expect(
            screen.getByRole("heading", { name: "September 2027" }),
        ).toBeInTheDocument();
        view.unmount();
        render(<App />);
        await user.selectOptions(
            screen.getByRole("combobox", { name: "Semester" }),
            "Fall 2027",
        );
        expect(screen.getByRole("combobox", { name: "Course" })).toHaveValue(
            "MATH 241",
        );
    });

    test("renders the sidebar and home layout", () => {
        render(<App />);

        expect(
            screen.getByRole("heading", { name: "SemPlan" }),
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
            screen.getByRole("img", { name: "SemPlan" }),
        ).toBeInTheDocument();
        await user.click(
            screen.getByRole("button", { name: "Collapse sidebar" }),
        );
        expect(container.firstChild).toHaveClass("is-collapsed");
        expect(
            screen.queryByRole("img", { name: "SemPlan" }),
        ).not.toBeInTheDocument();
        expect(
            screen.getByRole("link", { name: "Calendar" }),
        ).toBeInTheDocument();

        await user.click(
            screen.getByRole("button", { name: "Expand sidebar" }),
        );
        expect(container.firstChild).not.toHaveClass("is-collapsed");
        expect(
            screen.getByRole("img", { name: "SemPlan" }),
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
});
