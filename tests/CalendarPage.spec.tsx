import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { CalendarPage } from "../src/components/CalendarPage";
import { loadCourses } from "../src/components/CoursesPage";

type User = ReturnType<typeof userEvent.setup>;

// Switching semesters jumps to the semester's first month, so reselecting
// Fall 2026 gives a fixed starting point regardless of today's date.
async function showOctober2026(user: User) {
    const semester = screen.getByRole("combobox", { name: "Semester" });
    await user.selectOptions(semester, "Spring 2027");
    await user.selectOptions(semester, "Fall 2026");
    await user.click(screen.getByRole("button", { name: "Next month" }));
}

// The calendar opens on All Courses; these tests are about a single course.
async function chooseCourse(user: User, code = "CISC 275") {
    await user.selectOptions(
        screen.getByRole("combobox", { name: "Course" }),
        code,
    );
}

function getDay(label: string) {
    return screen.getByRole("cell", { name: label });
}

describe("CalendarPage", () => {
    beforeEach(() => {
        localStorage.clear();
    });

    test.each([
        {
            semester: "Fall 2027",
            startDate: "2027-10-04",
            endDate: "2027-10-08",
            month: "October 2027",
            meeting: "Monday, October 4, 2027",
        },
        {
            semester: "Fall 2027",
            month: "September 2027",
            meeting: "Wednesday, September 1, 2027",
        },
        {
            semester: "Spring 2028",
            month: "February 2028",
            meeting: "Wednesday, February 9, 2028",
        },
    ])(
        "includes saved $semester courses in the semester dropdown ($month)",
        async ({ semester, startDate, endDate, month, meeting }) => {
            const user = userEvent.setup();
            const course = {
                ...loadCourses()[0],
                semester,
                startDate,
                endDate,
                schedule: "Mon / Wed / Fri 1:50 PM - 2:45 PM",
            };
            localStorage.setItem(
                "semester-planner-courses-v1",
                JSON.stringify([
                    course,
                    { ...course, id: "other-section", section: "010" },
                ]),
            );
            render(<CalendarPage />);
            const semesters = screen.getByRole("combobox", {
                name: "Semester",
            });
            expect(
                within(semesters).getAllByRole("option", { name: semester }),
            ).toHaveLength(1);
            expect(
                within(semesters).getByRole("option", { name: "Fall 2026" }),
            ).toBeInTheDocument();
            expect(
                within(semesters).getByRole("option", { name: "Spring 2027" }),
            ).toBeInTheDocument();
            await user.selectOptions(semesters, semester);
            expect(
                screen.getByRole("heading", { name: month }),
            ).toBeInTheDocument();
            await chooseCourse(user);
            expect(
                screen.getByRole("combobox", { name: "Course" }),
            ).toHaveValue("CISC 275");
            expect(
                within(getDay(meeting)).getByText("Class Meeting"),
            ).toBeInTheDocument();
            expect(
                screen.getByRole("button", { name: "+ Add Activity" }),
            ).toBeEnabled();
        },
    );

    test("limits recurring class meetings to the inclusive course date range", async () => {
        const user = userEvent.setup();
        localStorage.setItem(
            "semester-planner-courses-v1",
            JSON.stringify([
                {
                    ...loadCourses()[0],
                    schedule: "Mon / Wed / Fri 1:50 PM - 2:45 PM",
                    startDate: "2026-10-12",
                    endDate: "2026-10-16",
                },
            ]),
        );
        render(<CalendarPage />);
        await showOctober2026(user);
        for (const date of [
            "Monday, October 12, 2026",
            "Wednesday, October 14, 2026",
            "Friday, October 16, 2026",
        ]) {
            expect(
                within(getDay(date)).getByText("Class Meeting"),
            ).toBeInTheDocument();
        }
        for (const date of [
            "Friday, October 9, 2026",
            "Monday, October 19, 2026",
        ]) {
            expect(
                within(getDay(date)).queryByText("Class Meeting"),
            ).not.toBeInTheDocument();
        }
    });

    test("keeps created topics after the page reloads", async () => {
        const user = userEvent.setup();
        const { unmount } = render(<CalendarPage />);

        await user.click(
            screen.getByRole("button", { name: "+ Create Topic" }),
        );
        await user.type(
            screen.getByRole("textbox", { name: "Topic name" }),
            "React Hooks{Enter}",
        );
        unmount();
        render(<CalendarPage />);

        expect(screen.getByText("React Hooks")).toBeInTheDocument();
    });

    test("falls back to the sample data when saved data is unreadable", () => {
        localStorage.setItem("semester-planner:calendar-items", "not json");
        render(<CalendarPage />);

        expect(screen.getByText("Forms")).toBeInTheDocument();
    });

    test.each(["not json", "{}"])(
        "uses default courses when saved courses are invalid: %s",
        (stored) => {
            localStorage.setItem("semester-planner-courses-v1", stored);
            render(<CalendarPage />);

            const courseSelect = screen.getByRole("combobox", {
                name: "Course",
            });
            expect(courseSelect).toHaveDisplayValue("All Courses");
            expect(
                within(courseSelect).getByRole("option", { name: "CISC 320" }),
            ).toBeInTheDocument();
            expect(screen.getByText("Forms")).toBeInTheDocument();
        },
    );

    test("assigns legacy items to their semester without discarding saved data", async () => {
        const user = userEvent.setup();
        const course = loadCourses()[0];
        localStorage.setItem(
            "semester-planner-courses-v1",
            JSON.stringify([
                course,
                { ...course, id: "spring275", semester: "Spring 2027" },
            ]),
        );
        localStorage.setItem(
            "semester-planner:calendar-items",
            JSON.stringify([
                {
                    id: "legacy-topic",
                    course: "CISC 275",
                    kind: "topic",
                    title: "Legacy unscheduled topic",
                },
                {
                    id: "legacy-spring",
                    course: "CISC 275",
                    kind: "activity",
                    title: "Legacy spring activity",
                    date: "2027-02-09",
                },
            ]),
        );

        render(<CalendarPage />);
        expect(
            screen.getByText("Legacy unscheduled topic"),
        ).toBeInTheDocument();
        expect(
            screen.queryByText("Legacy spring activity"),
        ).not.toBeInTheDocument();

        await user.selectOptions(
            screen.getByRole("combobox", { name: "Semester" }),
            "Spring 2027",
        );
        expect(
            screen.getByRole("group", { name: "Legacy spring activity" }),
        ).toBeInTheDocument();
        expect(
            screen.queryByText("Legacy unscheduled topic"),
        ).not.toBeInTheDocument();
        expect(
            JSON.parse(
                localStorage.getItem("semester-planner:calendar-items")!,
            ),
        ).toEqual([
            {
                id: "legacy-topic",
                course: "CISC 275",
                kind: "topic",
                title: "Legacy unscheduled topic",
                semester: "Fall 2026",
            },
            {
                id: "legacy-spring",
                course: "CISC 275",
                kind: "activity",
                title: "Legacy spring activity",
                date: "2027-02-09",
                semester: "Spring 2027",
            },
        ]);
    });

    test("isolates schedules and new topics by semester for the same course section", async () => {
        const user = userEvent.setup();
        const fallCourse = {
            ...loadCourses()[0],
            id: "fall010",
            section: "010",
            schedule: "Tue / Thu 9:00 - 10:15 AM",
        };
        const springCourse = {
            ...fallCourse,
            id: "spring010",
            semester: "Spring 2027",
        };
        localStorage.setItem(
            "semester-planner-courses-v1",
            JSON.stringify([fallCourse, springCourse]),
        );
        localStorage.setItem(
            "semester-planner:calendar-items",
            JSON.stringify([
                {
                    id: "fall-topic",
                    course: "CISC 275 - Section 010",
                    semester: "Fall 2026",
                    kind: "topic",
                    title: "Fall topic",
                },
                {
                    id: "spring-topic",
                    course: "CISC 275 - Section 010",
                    semester: "Spring 2027",
                    kind: "topic",
                    title: "Spring topic",
                },
            ]),
        );

        const view = render(<CalendarPage />);
        await showOctober2026(user);
        expect(screen.getByRole("combobox", { name: "Course" })).toHaveValue(
            "CISC 275 - Section 010",
        );
        expect(
            screen.queryByRole("option", { name: "CISC 320" }),
        ).not.toBeInTheDocument();
        expect(
            within(getDay("Tuesday, October 13, 2026")).getByText(
                "Class Meeting",
            ),
        ).toBeInTheDocument();
        expect(
            within(getDay("Monday, October 12, 2026")).queryByText(
                "Class Meeting",
            ),
        ).not.toBeInTheDocument();
        expect(screen.getByText("Fall topic")).toBeInTheDocument();
        expect(screen.queryByText("Spring topic")).not.toBeInTheDocument();

        await user.selectOptions(
            screen.getByRole("combobox", { name: "Semester" }),
            "Spring 2027",
        );
        expect(screen.getByRole("combobox", { name: "Course" })).toHaveValue(
            "CISC 275 - Section 010",
        );
        expect(screen.getByText("Spring topic")).toBeInTheDocument();
        expect(screen.queryByText("Fall topic")).not.toBeInTheDocument();

        await user.click(
            screen.getByRole("button", { name: "+ Create Topic" }),
        );
        await user.type(
            screen.getByRole("textbox", { name: "Topic name" }),
            "New spring topic{Enter}",
        );
        expect(
            JSON.parse(
                localStorage.getItem("semester-planner:calendar-items")!,
            ),
        ).toContainEqual(
            expect.objectContaining({
                title: "New spring topic",
                course: "CISC 275 - Section 010",
                semester: "Spring 2027",
            }),
        );

        view.unmount();
        render(<CalendarPage />);
        expect(screen.getByText("New spring topic")).toBeInTheDocument();
        expect(screen.queryByText("Fall topic")).not.toBeInTheDocument();
        await user.selectOptions(
            screen.getByRole("combobox", { name: "Semester" }),
            "Fall 2026",
        );
        expect(screen.getByText("Fall topic")).toBeInTheDocument();
        expect(screen.queryByText("New spring topic")).not.toBeInTheDocument();
    });

    test("keeps topics and class meetings separate for sections of the same course", async () => {
        const user = userEvent.setup();
        const base = loadCourses()[0];
        localStorage.setItem(
            "semester-planner-courses-v1",
            JSON.stringify([
                {
                    ...base,
                    id: "section010",
                    section: "010",
                    schedule: "Mon / Wed / Fri 1:50 PM - 2:45 PM",
                },
                {
                    ...base,
                    id: "section011",
                    section: "011",
                    schedule: "Tue / Thu 9:00 AM - 10:15 AM",
                },
            ]),
        );
        localStorage.setItem(
            "semester-planner:calendar-items",
            JSON.stringify([
                {
                    id: "topic010",
                    course: "CISC 275 - Section 010",
                    semester: "Fall 2026",
                    kind: "topic",
                    title: "Section 010 topic",
                },
                {
                    id: "topic011",
                    course: "CISC 275 - Section 011",
                    semester: "Fall 2026",
                    kind: "topic",
                    title: "Section 011 topic",
                },
            ]),
        );

        render(<CalendarPage />);
        await showOctober2026(user);
        await chooseCourse(user, "CISC 275 - Section 010");
        const courseSelect = screen.getByRole("combobox", { name: "Course" });
        // Both sections, plus All Courses.
        expect(within(courseSelect).getAllByRole("option")).toHaveLength(3);
        expect(screen.getByText("Section 010 topic")).toBeInTheDocument();
        expect(screen.queryByText("Section 011 topic")).not.toBeInTheDocument();
        expect(
            within(getDay("Monday, October 12, 2026")).getByText(
                "Class Meeting",
            ),
        ).toBeInTheDocument();
        expect(
            within(getDay("Tuesday, October 13, 2026")).queryByText(
                "Class Meeting",
            ),
        ).not.toBeInTheDocument();

        await user.click(
            screen.getByRole("button", { name: "+ Create Topic" }),
        );
        await user.type(
            screen.getByRole("textbox", { name: "Topic name" }),
            "Unfinished topic",
        );
        await user.selectOptions(courseSelect, "CISC 275 - Section 011");
        expect(
            screen.queryByRole("textbox", { name: "Topic name" }),
        ).not.toBeInTheDocument();
        expect(screen.getByText("Section 011 topic")).toBeInTheDocument();
        expect(screen.queryByText("Section 010 topic")).not.toBeInTheDocument();
        expect(
            within(getDay("Tuesday, October 13, 2026")).getByText(
                "Class Meeting",
            ),
        ).toBeInTheDocument();
        expect(
            within(getDay("Monday, October 12, 2026")).queryByText(
                "Class Meeting",
            ),
        ).not.toBeInTheDocument();
    });

    test("shows every course in time order under All Courses and moves topics between them", async () => {
        const user = userEvent.setup();
        const base = loadCourses()[0];
        localStorage.setItem(
            "semester-planner-courses-v1",
            JSON.stringify([
                {
                    ...base,
                    id: "section010",
                    section: "010",
                    schedule: "Mon / Wed 1:50 PM - 2:45 PM",
                },
                {
                    ...base,
                    id: "section011",
                    section: "011",
                    schedule: "Wed 9:00 - 10:15 AM",
                },
            ]),
        );
        localStorage.setItem(
            "semester-planner:calendar-items",
            JSON.stringify([
                {
                    id: "misplaced",
                    course: "CISC 275 - Section 010",
                    semester: "Fall 2026",
                    kind: "topic",
                    title: "Misplaced topic",
                    date: "2026-10-14",
                },
            ]),
        );

        render(<CalendarPage />);
        await showOctober2026(user);
        await user.selectOptions(
            screen.getByRole("combobox", { name: "Course" }),
            "All Courses",
        );

        const wednesday = getDay("Wednesday, October 14, 2026");
        const [morning, afternoon] = within(wednesday).getAllByRole("button", {
            name: /class meeting on/,
        });
        expect(morning).toHaveAccessibleName(
            "CISC 275 - Section 011 class meeting on Wednesday, October 14, 2026, 9:00 - 10:15 AM",
        );
        expect(afternoon).toHaveTextContent("1:50 PM - 2:45 PM");
        expect(
            within(afternoon.parentElement as HTMLElement).getByText(
                "Misplaced topic",
            ),
        ).toBeInTheDocument();

        fireEvent.dragStart(screen.getByText("Misplaced topic"), {
            dataTransfer: { setData: jest.fn() },
        });
        fireEvent.dragOver(morning);
        fireEvent.drop(morning);

        expect(
            within(morning.parentElement as HTMLElement).getByText(
                "Misplaced topic",
            ),
        ).toBeInTheDocument();

        // A topic created here has no course until it is dragged onto one.
        await user.click(
            screen.getByRole("button", { name: "+ Create Topic" }),
        );
        expect(
            screen.queryByRole("combobox", { name: "Topic course" }),
        ).not.toBeInTheDocument();
        await user.type(
            screen.getByRole("textbox", { name: "Topic name" }),
            "New topic{Enter}",
        );
        const notAssigned = screen.getByRole("heading", {
            name: "Not assigned yet",
        });
        expect(
            within(notAssigned.parentElement as HTMLElement).getByText(
                "New topic",
            ),
        ).toBeInTheDocument();
        fireEvent.dragStart(screen.getByText("New topic"), {
            dataTransfer: { setData: jest.fn() },
        });
        fireEvent.dragOver(morning);
        fireEvent.drop(morning);
        expect(
            within(morning.parentElement as HTMLElement).getByText("New topic"),
        ).toBeInTheDocument();
        expect(
            screen.queryByRole("heading", { name: "Not assigned yet" }),
        ).not.toBeInTheDocument();

        await user.selectOptions(
            screen.getByRole("combobox", { name: "Course" }),
            "CISC 275 - Section 011",
        );
        expect(screen.getByText("Misplaced topic")).toBeInTheDocument();
    });

    test.each([
        { code: "CISC 275", section: "010" },
        { code: "MATH 241", section: "" },
    ])(
        "does not invent class meetings for an unscheduled $code section '$section'",
        async ({ code, section }) => {
            const user = userEvent.setup();
            localStorage.setItem(
                "semester-planner-courses-v1",
                JSON.stringify([
                    { ...loadCourses()[0], code, section, schedule: "" },
                ]),
            );

            render(<CalendarPage />);
            await showOctober2026(user);

            expect(
                screen.getByRole("combobox", { name: "Course" }),
            ).toBeEnabled();
            expect(
                screen.getByRole("button", { name: "+ Add Activity" }),
            ).toBeEnabled();
            expect(
                screen.queryByRole("button", { name: /Class meeting on/ }),
            ).not.toBeInTheDocument();
        },
    );

    test("moves between months", async () => {
        const user = userEvent.setup();
        render(<CalendarPage />);
        await showOctober2026(user);

        expect(
            screen.getByRole("heading", { name: "October 2026" }),
        ).toBeInTheDocument();

        await user.click(screen.getByRole("button", { name: "Next month" }));
        expect(
            screen.getByRole("heading", { name: "November 2026" }),
        ).toBeInTheDocument();

        await user.click(
            screen.getByRole("button", { name: "Previous month" }),
        );
        await user.click(
            screen.getByRole("button", { name: "Previous month" }),
        );
        expect(
            screen.getByRole("heading", { name: "September 2026" }),
        ).toBeInTheDocument();
    });

    test("jumps to the start of the selected semester", async () => {
        const user = userEvent.setup();
        render(<CalendarPage />);

        await user.selectOptions(
            screen.getByRole("combobox", { name: "Semester" }),
            "Spring 2027",
        );
        expect(
            screen.getByRole("heading", { name: "February 2027" }),
        ).toBeInTheDocument();
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

        await user.selectOptions(
            screen.getByRole("combobox", { name: "Semester" }),
            "Fall 2026",
        );
        expect(
            screen.queryByText(/No courses in this semester/),
        ).not.toBeInTheDocument();
        expect(
            screen.getByRole("combobox", { name: "Course" }),
        ).toHaveDisplayValue("All Courses");
        expect(screen.getByRole("combobox", { name: "Course" })).toBeEnabled();
        expect(
            screen.getByRole("button", { name: "+ Add Activity" }),
        ).toBeEnabled();
        expect(
            screen.getByRole("button", { name: "+ Create Topic" }),
        ).toBeEnabled();
    });

    test("shows class meetings, topics and activities for the course", async () => {
        const user = userEvent.setup();
        render(<CalendarPage />);
        await showOctober2026(user);
        await chooseCourse(user);

        const monday = getDay("Monday, October 12, 2026");
        expect(within(monday).getByText("Class Meeting")).toBeInTheDocument();
        expect(within(monday).getByText("Immutability")).toBeInTheDocument();
        expect(
            within(getDay("Friday, October 16, 2026")).getByText(
                "Practice Test",
            ),
        ).toBeInTheDocument();
        expect(
            within(getDay("Tuesday, October 13, 2026")).queryByText(
                "Class Meeting",
            ),
        ).not.toBeInTheDocument();

        await user.selectOptions(
            screen.getByRole("combobox", { name: "Course" }),
            "CISC 320",
        );
        expect(
            within(getDay("Tuesday, October 13, 2026")).getByText(
                "Dynamic Programming",
            ),
        ).toBeInTheDocument();
        expect(screen.queryByText("Immutability")).not.toBeInTheDocument();
    });

    test("schedules a topic by dragging it onto a class meeting", async () => {
        const user = userEvent.setup();
        render(<CalendarPage />);
        await showOctober2026(user);
        await chooseCourse(user);

        const unscheduled = screen.getByRole("complementary", {
            name: "Unscheduled topics",
        });
        const wednesday = getDay("Wednesday, October 14, 2026");

        fireEvent.dragStart(within(unscheduled).getByText("Forms"), {
            dataTransfer: { setData: jest.fn() },
        });
        fireEvent.dragOver(wednesday);
        fireEvent.drop(wednesday);

        expect(within(wednesday).getByText("Forms")).toBeInTheDocument();
        expect(
            within(unscheduled).queryByText("Forms"),
        ).not.toBeInTheDocument();
    });

    test("selecting a week in the monthly view highlights it without leaving the month view", async () => {
        const user = userEvent.setup();
        render(<CalendarPage />);
        await showOctober2026(user);
        const strip = screen.getByRole("navigation", {
            name: "Semester weeks",
        });

        // Week 5 (September 27 – October 3) is already on the October grid.
        await user.click(within(strip).getByRole("button", { name: "5" }));
        expect(
            screen.getByRole("heading", { name: "October 2026" }),
        ).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Monthly" })).toHaveAttribute(
            "aria-pressed",
            "true",
        );
        expect(getDay("Thursday, October 1, 2026")).toHaveClass(
            "is-selected-week",
        );
        expect(getDay("Sunday, October 4, 2026")).not.toHaveClass(
            "is-selected-week",
        );

        // Week 11 isn't, so the calendar moves to November to show it.
        await user.click(within(strip).getByRole("button", { name: "11" }));
        expect(
            screen.getByRole("heading", { name: "November 2026" }),
        ).toBeInTheDocument();
        expect(getDay("Wednesday, November 11, 2026")).toHaveClass(
            "is-selected-week",
        );
        expect(
            screen.getByRole("button", { name: "Select week 11" }),
        ).toHaveAttribute("aria-pressed", "true");

        // The weekly view opens on the selected week.
        await user.click(screen.getByRole("button", { name: "Weekly" }));
        expect(
            screen.getByRole("heading", {
                name: "Week of: November 8–14, 2026",
            }),
        ).toBeInTheDocument();

        // Back in the monthly view, choosing the week again clears it.
        await user.click(screen.getByRole("button", { name: "Monthly" }));
        await user.click(within(strip).getByRole("button", { name: "11" }));
        expect(getDay("Wednesday, November 11, 2026")).not.toHaveClass(
            "is-selected-week",
        );
    });

    describe("weekly view", () => {
        beforeEach(() => {
            jest.useFakeTimers({ now: new Date(2026, 9, 14) });
        });

        afterEach(() => {
            jest.useRealTimers();
        });

        function setupUser() {
            return userEvent.setup({
                advanceTimers: (ms) => jest.advanceTimersByTime(ms),
            });
        }

        test("keeps a weekly reflection and shows its plan the next week", async () => {
            const user = setupUser();
            const view = render(<CalendarPage />);
            await chooseCourse(user);
            await user.click(screen.getByRole("button", { name: "Weekly" }));

            await user.click(screen.getByText("Reflect on week 7"));
            await user.click(screen.getByRole("button", { name: "Shaky" }));
            await user.type(
                screen.getByRole("textbox", {
                    name: "What will you do differently next week?",
                }),
                "Start the reading earlier",
            );
            expect(
                screen.getByRole("button", { name: "Shaky" }),
            ).toHaveAttribute("aria-pressed", "true");
            const strip = screen.getByRole("navigation", {
                name: "Semester weeks",
            });
            expect(
                within(strip).getByRole("button", { name: "7" }),
            ).toHaveClass("has-reflection");

            // The plan comes back the following week, and survives a reload.
            view.unmount();
            render(<CalendarPage />);
            await chooseCourse(user);
            await user.click(screen.getByRole("button", { name: "Weekly" }));
            await user.click(screen.getByRole("button", { name: "Next week" }));
            expect(
                screen.getByText("Last week you planned to:"),
            ).toBeInTheDocument();
            expect(
                screen.getByText("Start the reading earlier"),
            ).toBeInTheDocument();

            // Clearing everything removes the reflection.
            await user.click(
                screen.getByRole("button", { name: "Previous week" }),
            );
            await user.click(screen.getByRole("button", { name: "Shaky" }));
            await user.clear(
                screen.getByRole("textbox", {
                    name: "What will you do differently next week?",
                }),
            );
            expect(
                within(
                    screen.getByRole("navigation", { name: "Semester weeks" }),
                ).getByRole("button", { name: "7" }),
            ).not.toHaveClass("has-reflection");
        });

        test("clears a weekly reflection with the Clear button", async () => {
            const user = setupUser();
            render(<CalendarPage />);
            await chooseCourse(user);
            await user.click(screen.getByRole("button", { name: "Weekly" }));
            await user.click(screen.getByText("Reflect on week 7"));

            // There is nothing to clear until something has been entered.
            expect(
                screen.queryByRole("button", { name: "Clear" }),
            ).not.toBeInTheDocument();

            const planField = screen.getByRole("textbox", {
                name: "What will you do differently next week?",
            });
            await user.click(screen.getByRole("button", { name: "Shaky" }));
            await user.type(planField, "Start the reading earlier");
            await user.click(screen.getByRole("button", { name: "Clear" }));

            expect(planField).toHaveValue("");
            expect(
                screen.getByRole("button", { name: "Shaky" }),
            ).toHaveAttribute("aria-pressed", "false");
            expect(
                within(
                    screen.getByRole("navigation", { name: "Semester weeks" }),
                ).getByRole("button", { name: "7" }),
            ).not.toHaveClass("has-reflection");
            expect(
                screen.queryByRole("button", { name: "Clear" }),
            ).not.toBeInTheDocument();
        });

        test("words the weekly reflection for professors", async () => {
            const user = setupUser();
            render(<CalendarPage role="professor" />);
            await chooseCourse(user);
            await user.click(screen.getByRole("button", { name: "Weekly" }));

            expect(
                screen.getByRole("textbox", {
                    name: "Where did students struggle?",
                }),
            ).toBeInTheDocument();
        });

        test("highlights the current week in the monthly view to start", () => {
            render(<CalendarPage />);

            expect(getDay("Sunday, October 11, 2026")).toHaveClass(
                "is-selected-week",
            );
            expect(getDay("Saturday, October 17, 2026")).toHaveClass(
                "is-selected-week",
            );
            expect(getDay("Sunday, October 18, 2026")).not.toHaveClass(
                "is-selected-week",
            );
            expect(
                screen.getByRole("button", { name: "Select week 7" }),
            ).toHaveAttribute("aria-pressed", "true");
        });

        test("opens on the current week and lays out class days", async () => {
            const user = setupUser();
            render(<CalendarPage />);
            await chooseCourse(user);

            await user.click(screen.getByRole("button", { name: "Weekly" }));
            expect(
                screen.getByRole("heading", {
                    name: "Week of: October 11–17, 2026",
                }),
            ).toBeInTheDocument();
            expect(
                screen.getByRole("button", { name: "Weekly" }),
            ).toHaveAttribute("aria-pressed", "true");

            expect(
                within(getDay("Tuesday, October 13, 2026")).getByText(
                    "Nothing Planned",
                ),
            ).toBeInTheDocument();
            // Sunday has no class but does have an activity due.
            expect(
                within(getDay("Sunday, October 11, 2026")).queryByText(
                    "Nothing Planned",
                ),
            ).not.toBeInTheDocument();
            expect(
                within(getDay("Wednesday, October 14, 2026")).getByText(
                    "No Topics or Activities Scheduled",
                ),
            ).toBeInTheDocument();
            const friday = getDay("Friday, October 16, 2026");
            expect(
                within(friday).getByText("Class Meeting"),
            ).toBeInTheDocument();
            expect(
                within(friday).getByText("Practice Test"),
            ).toBeInTheDocument();
        });

        test("moves a week at a time and switches back to the month", async () => {
            const user = setupUser();
            render(<CalendarPage />);

            await user.click(screen.getByRole("button", { name: "Weekly" }));
            await user.click(
                screen.getByRole("button", { name: "Previous week" }),
            );
            await user.click(
                screen.getByRole("button", { name: "Previous week" }),
            );
            expect(
                screen.getByRole("heading", {
                    name: "Week of: September 27 – October 3, 2026",
                }),
            ).toBeInTheDocument();

            await user.click(screen.getByRole("button", { name: "Monthly" }));
            expect(
                screen.getByRole("heading", { name: "September 2026" }),
            ).toBeInTheDocument();
        });
    });

    test("ignores drops on days without a class meeting", async () => {
        const user = userEvent.setup();
        render(<CalendarPage />);
        await showOctober2026(user);
        await chooseCourse(user);

        const tuesday = getDay("Tuesday, October 13, 2026");
        fireEvent.dragStart(screen.getByText("Forms"), {
            dataTransfer: { setData: jest.fn() },
        });
        fireEvent.dragOver(tuesday);
        fireEvent.drop(tuesday);

        expect(within(tuesday).queryByText("Forms")).not.toBeInTheDocument();
    });

    describe("adding activities and topics", () => {
        beforeEach(() => {
            jest.useFakeTimers({ now: new Date(2026, 9, 14) });
        });

        afterEach(() => {
            jest.useRealTimers();
        });

        function setupUser() {
            return userEvent.setup({
                advanceTimers: (ms) => jest.advanceTimersByTime(ms),
            });
        }

        test("adds an activity from the dialog", async () => {
            const user = setupUser();
            render(<CalendarPage />);
            await chooseCourse(user);

            await user.click(
                screen.getByRole("button", { name: "+ Add Activity" }),
            );
            const dialog = screen.getByRole("dialog", { name: "Add Activity" });
            expect(dialog).toHaveTextContent("October 2026");

            await user.type(
                within(dialog).getByLabelText("Activity name"),
                "Quiz 3",
            );
            await user.click(
                within(dialog).getByRole("button", {
                    name: "Wednesday, October 21, 2026",
                }),
            );
            fireEvent.change(within(dialog).getByLabelText("Time"), {
                target: { value: "13:30" },
            });
            await user.click(
                within(dialog).getByRole("button", { name: "Save Activity" }),
            );

            expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
            const wednesday = getDay("Wednesday, October 21, 2026");
            expect(within(wednesday).getByText("Quiz 3")).toBeInTheDocument();
            expect(
                within(wednesday).getByText("Due 1:30 PM"),
            ).toBeInTheDocument();
        });

        test("asks for every missing field before saving", async () => {
            const user = setupUser();
            render(<CalendarPage />);

            await user.click(
                screen.getByRole("button", { name: "+ Add Activity" }),
            );
            await user.click(
                screen.getByRole("button", { name: "Save Activity" }),
            );

            expect(screen.getByRole("alert")).toHaveTextContent(
                "Add a name, a date, and a time to save this activity.",
            );
            expect(screen.getByRole("dialog")).toBeInTheDocument();
        });

        test("saves new activities under the selected custom course section and semester", async () => {
            const user = setupUser();
            localStorage.setItem(
                "semester-planner-courses-v1",
                JSON.stringify([
                    {
                        ...loadCourses()[0],
                        id: "math010",
                        code: "MATH 241",
                        section: "010",
                        semester: "Spring 2027",
                        schedule: "Tue / Thu 9:00 AM - 10:15 AM",
                    },
                ]),
            );
            localStorage.setItem("semester-planner:calendar-items", "[]");
            const view = render(<CalendarPage />);
            await user.selectOptions(
                screen.getByRole("combobox", { name: "Semester" }),
                "Spring 2027",
            );
            await user.click(
                screen.getByRole("button", { name: "+ Add Activity" }),
            );
            const dialog = screen.getByRole("dialog", { name: "Add Activity" });
            expect(dialog).toHaveTextContent("MATH 241 - Section 010");
            await user.type(
                within(dialog).getByLabelText("Activity name"),
                "Spring quiz",
            );
            await user.click(
                within(dialog).getByRole("button", {
                    name: "Tuesday, February 9, 2027",
                }),
            );
            fireEvent.change(within(dialog).getByLabelText("Time"), {
                target: { value: "09:30" },
            });
            await user.click(
                within(dialog).getByRole("button", { name: "Save Activity" }),
            );

            expect(
                within(getDay("Tuesday, February 9, 2027")).getByRole("group", {
                    name: "Spring quiz",
                }),
            ).toBeInTheDocument();
            expect(
                JSON.parse(
                    localStorage.getItem("semester-planner:calendar-items")!,
                ),
            ).toEqual([
                expect.objectContaining({
                    course: "MATH 241 - Section 010",
                    semester: "Spring 2027",
                    kind: "activity",
                    title: "Spring quiz",
                    date: "2027-02-09",
                    detail: "Due 9:30 AM",
                }),
            ]);

            view.unmount();
            render(<CalendarPage />);
            expect(
                screen.getByRole("group", { name: "Spring quiz" }),
            ).toBeInTheDocument();
            await user.selectOptions(
                screen.getByRole("combobox", { name: "Semester" }),
                "Fall 2026",
            );
            expect(
                screen.queryByRole("group", { name: "Spring quiz" }),
            ).not.toBeInTheDocument();
        });

        test("closes the dialog with Escape", async () => {
            const user = setupUser();
            render(<CalendarPage />);
            const addButton = screen.getByRole("button", {
                name: "+ Add Activity",
            });

            await user.click(addButton);
            await user.keyboard("{Escape}");

            expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
            expect(addButton).toHaveFocus();
        });

        test("creates a topic that can be dragged onto a class meeting", async () => {
            const user = setupUser();
            render(<CalendarPage />);
            await chooseCourse(user);
            const unscheduled = screen.getByRole("complementary", {
                name: "Unscheduled topics",
            });

            await user.click(
                within(unscheduled).getByRole("button", {
                    name: "+ Create Topic",
                }),
            );
            await user.type(
                within(unscheduled).getByRole("textbox", {
                    name: "Topic name",
                }),
                "React Hooks{Enter}",
            );

            const topic = within(unscheduled).getByText("React Hooks");
            const wednesday = getDay("Wednesday, October 14, 2026");
            fireEvent.dragStart(topic, {
                dataTransfer: { setData: jest.fn() },
            });
            fireEvent.dragOver(wednesday);
            fireEvent.drop(wednesday);

            expect(
                within(wednesday).getByText("React Hooks"),
            ).toBeInTheDocument();
        });

        test("adds topics to an existing activity and deletes them", async () => {
            const user = setupUser();
            render(<CalendarPage />);
            await chooseCourse(user);
            const unscheduled = screen.getByRole("complementary", {
                name: "Unscheduled topics",
            });
            const practiceTest = screen.getByRole("group", {
                name: "Practice Test",
            });

            fireEvent.dragStart(within(unscheduled).getByText("Forms"), {
                dataTransfer: { setData: jest.fn() },
            });
            fireEvent.dragOver(practiceTest);
            fireEvent.drop(practiceTest);

            expect(within(practiceTest).getByText("Forms")).toBeInTheDocument();
            expect(
                within(unscheduled).queryByText("Forms"),
            ).not.toBeInTheDocument();

            await user.click(
                within(practiceTest).getByRole("button", {
                    name: "Delete Forms",
                }),
            );
            expect(screen.queryByText("Forms")).not.toBeInTheDocument();
        });

        test("deletes an activity and returns its topics", async () => {
            const user = setupUser();
            render(<CalendarPage />);
            await chooseCourse(user);
            const unscheduled = screen.getByRole("complementary", {
                name: "Unscheduled topics",
            });
            const practiceTest = screen.getByRole("group", {
                name: "Practice Test",
            });
            fireEvent.dragStart(within(unscheduled).getByText("Forms"), {
                dataTransfer: { setData: jest.fn() },
            });
            fireEvent.dragOver(practiceTest);
            fireEvent.drop(practiceTest);

            await user.click(
                screen.getByRole("button", { name: "Delete Practice Test" }),
            );

            expect(screen.queryByText("Practice Test")).not.toBeInTheDocument();
            expect(within(unscheduled).getByText("Forms")).toBeInTheDocument();
        });

        test("moves a scheduled topic into a new activity on a non-class day", async () => {
            const user = setupUser();
            render(<CalendarPage />);
            await chooseCourse(user);

            await user.click(
                screen.getByRole("button", { name: "+ Add Activity" }),
            );
            const dialog = screen.getByRole("dialog");
            await user.type(
                within(dialog).getByLabelText("Activity name"),
                "Review Session",
            );
            await user.click(
                within(dialog).getByRole("button", {
                    name: "Tuesday, October 20, 2026",
                }),
            );
            fireEvent.change(within(dialog).getByLabelText("Time"), {
                target: { value: "18:00" },
            });
            await user.click(
                within(dialog).getByRole("button", { name: "Save Activity" }),
            );

            const review = screen.getByRole("group", {
                name: "Review Session",
            });
            const monday = getDay("Monday, October 12, 2026");
            fireEvent.dragStart(within(monday).getByText("Immutability"), {
                dataTransfer: { setData: jest.fn() },
            });
            fireEvent.dragOver(review);
            fireEvent.drop(review);

            expect(
                within(review).getByText("Immutability"),
            ).toBeInTheDocument();
            expect(
                within(monday).queryByText("Immutability"),
            ).not.toBeInTheDocument();
        });

        test("deletes a topic from a class meeting", async () => {
            const user = setupUser();
            render(<CalendarPage />);
            await chooseCourse(user);

            await user.click(
                within(getDay("Monday, October 12, 2026")).getByRole("button", {
                    name: "Delete Immutability",
                }),
            );

            expect(screen.queryByText("Immutability")).not.toBeInTheDocument();
            expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
        });

        test("cancels a class and can undo it", async () => {
            const user = setupUser();
            render(<CalendarPage />);
            await chooseCourse(user);
            const unscheduled = screen.getByRole("complementary", {
                name: "Unscheduled topics",
            });

            await user.click(
                screen.getByRole("button", {
                    name: "Class meeting on Monday, October 12, 2026",
                }),
            );
            const dialog = screen.getByRole("dialog", {
                name: "Class Meeting",
            });
            expect(dialog).toHaveTextContent("2 topics");
            await user.click(
                within(dialog).getByRole("button", {
                    name: "Mark as Cancelled",
                }),
            );
            const choices = screen.getByRole("dialog", {
                name: "Cancel Class",
            });
            expect(choices).toHaveTextContent("Immutability");
            await user.click(
                within(choices).getByRole("button", { name: /^Just cancel/ }),
            );

            const monday = getDay("Monday, October 12, 2026");
            expect(
                within(monday).queryByText("Class Meeting"),
            ).not.toBeInTheDocument();
            expect(
                within(unscheduled).getByText("Immutability"),
            ).toBeInTheDocument();
            expect(screen.getByRole("status")).toHaveTextContent(
                "CISC 275 class on Monday, October 12, 2026 cancelled. Topics moved to Unscheduled topics.",
            );

            await user.click(screen.getByRole("button", { name: "Undo" }));
            expect(
                within(getDay("Monday, October 12, 2026")).getByText(
                    "Immutability",
                ),
            ).toBeInTheDocument();
            expect(screen.queryByRole("status")).not.toBeInTheDocument();
        });

        // Opens Monday's class and asks to cancel it, which brings up the
        // choices for its topics.
        async function startCancellingMonday(user: User) {
            await user.click(
                screen.getByRole("button", {
                    name: "Class meeting on Monday, October 12, 2026",
                }),
            );
            await user.click(
                screen.getByRole("button", { name: "Mark as Cancelled" }),
            );
            return screen.getByRole("dialog", { name: "Cancel Class" });
        }

        test("pushes a cancelled class's plans back one class, shifting later ones until an empty class", async () => {
            const user = setupUser();
            localStorage.setItem(
                "semester-planner:calendar-items",
                JSON.stringify(
                    [
                        ["Immutability", "2026-10-12"],
                        ["State", "2026-10-14"],
                        ["Testing", "2026-10-19"],
                    ].map(([title, date]) => ({
                        id: title,
                        course: "CISC 275",
                        semester: "Fall 2026",
                        kind: "topic",
                        title,
                        date,
                    })),
                ),
            );
            render(<CalendarPage />);
            await chooseCourse(user);

            const choices = await startCancellingMonday(user);
            await user.click(
                within(choices).getByRole("button", {
                    name: /^Push plans back one class/,
                }),
            );

            // Friday had nothing planned, so it takes State and the shift
            // stops there: Testing stays on the next Monday.
            expect(
                within(getDay("Wednesday, October 14, 2026")).getByText(
                    "Immutability",
                ),
            ).toBeInTheDocument();
            expect(
                within(getDay("Friday, October 16, 2026")).getByText("State"),
            ).toBeInTheDocument();
            expect(
                within(getDay("Monday, October 19, 2026")).getByText("Testing"),
            ).toBeInTheDocument();
            expect(screen.getByRole("status")).toHaveTextContent(
                "Plans pushed back one class.",
            );

            await user.click(screen.getByRole("button", { name: "Undo" }));
            expect(
                within(getDay("Monday, October 12, 2026")).getByText(
                    "Immutability",
                ),
            ).toBeInTheDocument();
            expect(
                within(getDay("Wednesday, October 14, 2026")).getByText(
                    "State",
                ),
            ).toBeInTheDocument();
        });

        test("moves a cancelled class's topics to the next class", async () => {
            const user = setupUser();
            render(<CalendarPage />);
            await chooseCourse(user);

            const choices = await startCancellingMonday(user);
            await user.click(
                within(choices).getByRole("button", {
                    name: /^Move to the next class/,
                }),
            );

            const wednesday = getDay("Wednesday, October 14, 2026");
            expect(within(wednesday).getByText("Immutability")).toBeVisible();
            expect(
                within(wednesday).getByText("Higher Order Array Methods"),
            ).toBeVisible();
            expect(screen.getByRole("status")).toHaveTextContent(
                "Topics moved to Wednesday, October 14, 2026.",
            );
        });

        test("reschedules a cancelled class's topics to a chosen class", async () => {
            const user = setupUser();
            render(<CalendarPage />);
            await chooseCourse(user);

            const choices = await startCancellingMonday(user);
            await user.selectOptions(
                within(choices).getByRole("combobox", {
                    name: /^Reschedule to another class/,
                }),
                "Monday, October 19, 2026",
            );
            await user.click(
                within(choices).getByRole("button", { name: "Move Here" }),
            );

            expect(
                within(getDay("Monday, October 19, 2026")).getByText(
                    "Immutability",
                ),
            ).toBeInTheDocument();
            expect(
                within(getDay("Wednesday, October 14, 2026")).queryByText(
                    "Immutability",
                ),
            ).not.toBeInTheDocument();
        });

        test("offers rescheduling only up to one month ahead", async () => {
            const user = setupUser();
            render(<CalendarPage />);
            await chooseCourse(user);

            const choices = await startCancellingMonday(user);
            const options = within(
                within(choices).getByRole("combobox", {
                    name: /^Reschedule to another class/,
                }),
            )
                .getAllByRole("option")
                .map((option) => option.textContent);

            // A month after Monday, October 12 is Thursday, November 12.
            expect(options.at(0)).toBe("Wednesday, October 14, 2026");
            expect(options.at(-1)).toBe("Wednesday, November 11, 2026");
            expect(options).not.toContain("Friday, November 13, 2026");
        });

        test("goes back from the cancel choices without cancelling", async () => {
            const user = setupUser();
            render(<CalendarPage />);
            await chooseCourse(user);

            const choices = await startCancellingMonday(user);
            await user.click(
                within(choices).getByRole("button", { name: "Back" }),
            );

            expect(
                screen.getByRole("dialog", { name: "Class Meeting" }),
            ).toBeInTheDocument();
            expect(screen.queryByRole("status")).not.toBeInTheDocument();
        });

        test("shows what is left on a cancelled class day in the week view", async () => {
            const user = setupUser();
            render(<CalendarPage />);
            await chooseCourse(user);
            await user.click(screen.getByRole("button", { name: "Weekly" }));

            for (const day of [
                "Wednesday, October 14, 2026",
                "Friday, October 16, 2026",
            ]) {
                await user.click(
                    screen.getByRole("button", {
                        name: `Class meeting on ${day}`,
                    }),
                );
                await user.click(
                    screen.getByRole("button", { name: "Mark as Cancelled" }),
                );
            }

            expect(
                within(getDay("Wednesday, October 14, 2026")).getByText(
                    "Nothing Planned",
                ),
            ).toBeInTheDocument();
            const friday = getDay("Friday, October 16, 2026");
            expect(
                within(friday).getByText("Practice Test"),
            ).toBeInTheDocument();
            expect(
                within(friday).queryByText("Nothing Planned"),
            ).not.toBeInTheDocument();
        });

        test("remembers cancelled classes after a reload", async () => {
            const user = setupUser();
            const { unmount } = render(<CalendarPage />);
            await chooseCourse(user);

            await user.click(
                screen.getByRole("button", {
                    name: "Class meeting on Wednesday, October 14, 2026",
                }),
            );
            await user.click(
                screen.getByRole("button", { name: "Mark as Cancelled" }),
            );
            unmount();
            render(<CalendarPage />);
            await chooseCourse(user);

            expect(
                within(getDay("Wednesday, October 14, 2026")).queryByText(
                    "Class Meeting",
                ),
            ).not.toBeInTheDocument();
        });

        test("greys out past dates when picking an activity date", async () => {
            const user = setupUser();
            render(<CalendarPage />);

            await user.click(
                screen.getByRole("button", { name: "+ Add Activity" }),
            );
            const dialog = screen.getByRole("dialog");

            expect(
                within(dialog).getByRole("button", {
                    name: "Tuesday, October 13, 2026",
                }),
            ).toBeDisabled();
            expect(
                within(dialog).getByRole("button", {
                    name: "Wednesday, October 14, 2026",
                }),
            ).toBeEnabled();
        });

        test("opens the date picker on this month when an earlier month is shown", async () => {
            const user = setupUser();
            render(<CalendarPage />);

            await user.click(
                screen.getByRole("button", { name: "Previous month" }),
            );
            await user.click(
                screen.getByRole("button", { name: "+ Add Activity" }),
            );

            expect(screen.getByRole("dialog")).toHaveTextContent(
                "October 2026",
            );
        });
    });
});
