import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { CalendarPage } from "../src/components/CalendarPage";

type User = ReturnType<typeof userEvent.setup>;

// Switching semesters jumps to the semester's first month, so reselecting
// Fall 2026 gives a fixed starting point regardless of today's date.
async function showOctober2026(user: User) {
    const semester = screen.getByRole("combobox", { name: "Semester" });
    await user.selectOptions(semester, "Spring 2027");
    await user.selectOptions(semester, "Fall 2026");
    await user.click(screen.getByRole("button", { name: "Next month" }));
}

function getDay(label: string) {
    return screen.getByRole("cell", { name: label });
}

describe("CalendarPage", () => {
    beforeEach(() => {
        localStorage.clear();
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
    });

    test("shows class meetings, topics and activities for the course", async () => {
        const user = userEvent.setup();
        render(<CalendarPage />);
        await showOctober2026(user);

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

        test("opens on the current week and lays out class days", async () => {
            const user = setupUser();
            render(<CalendarPage />);

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

            const monday = getDay("Monday, October 12, 2026");
            expect(
                within(monday).queryByText("Class Meeting"),
            ).not.toBeInTheDocument();
            expect(
                within(unscheduled).getByText("Immutability"),
            ).toBeInTheDocument();
            expect(screen.getByRole("status")).toHaveTextContent(
                "CISC 275 class on Monday, October 12, 2026 cancelled.",
            );

            await user.click(screen.getByRole("button", { name: "Undo" }));
            expect(
                within(getDay("Monday, October 12, 2026")).getByText(
                    "Immutability",
                ),
            ).toBeInTheDocument();
            expect(screen.queryByRole("status")).not.toBeInTheDocument();
        });

        test("shows what is left on a cancelled class day in the week view", async () => {
            const user = setupUser();
            render(<CalendarPage />);
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
