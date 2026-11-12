import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { App } from "../src/App";
import { HomePage } from "../src/components/HomePage";
import { ITEMS_KEY } from "../src/components/calendarStorage";
import type { CalendarItem } from "../src/components/scheduleTemplate";
import { initialTasks } from "../src/tasks";

beforeEach(() => {
    localStorage.clear();
    window.history.replaceState(null, "", "/Home");
});

test("To-Do & Reminders updates assignments and its date at local midnight without a refresh", () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(2026, 10, 3, 23, 59, 59));
    const activity: CalendarItem = {
        id: "today",
        course: "CISC 275",
        semester: "Fall 2026",
        kind: "activity",
        title: "Today's assignment",
        date: "2026-11-03",
    };
    localStorage.setItem(
        ITEMS_KEY,
        JSON.stringify([
            activity,
            {
                ...activity,
                id: "tomorrow",
                title: "Tomorrow's assignment",
                date: "2026-11-04",
            },
        ]),
    );
    try {
        render(
            <HomePage
                courses={[]}
                tasks={[]}
                showTasks
                onToggleTask={jest.fn()}
                onOpenCourse={jest.fn()}
            />,
        );
        expect(
            screen.getByRole("heading", {
                name: "To-Do & Reminders: 11/3/2026",
            }),
        ).toBeInTheDocument();
        expect(
            screen.getByRole("checkbox", { name: "Today's assignment" }),
        ).toBeInTheDocument();
        expect(
            screen.queryByRole("checkbox", { name: "Tomorrow's assignment" }),
        ).not.toBeInTheDocument();

        act(() => jest.advanceTimersByTime(1000));

        expect(
            screen.getByRole("heading", {
                name: "To-Do & Reminders: 11/4/2026",
            }),
        ).toBeInTheDocument();
        expect(
            screen.queryByRole("checkbox", { name: "Today's assignment" }),
        ).not.toBeInTheDocument();
        expect(
            screen.getByRole("checkbox", { name: "Tomorrow's assignment" }),
        ).toBeInTheDocument();

        act(() => jest.advanceTimersByTime(24 * 60 * 60 * 1000));
        expect(
            screen.getByRole("heading", {
                name: "To-Do & Reminders: 11/5/2026",
            }),
        ).toBeInTheDocument();
        expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
        expect(
            screen.getByText("No tasks scheduled for today."),
        ).toBeInTheDocument();
    } finally {
        jest.useRealTimers();
    }
});

test("assignments with the same name keep independent completion and do not toggle manual tasks", async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(2026, 10, 3, 12));
    const activity: CalendarItem = {
        id: "1",
        course: "MATH 241",
        semester: "Fall 2026",
        kind: "activity",
        title: initialTasks[0].title,
        date: "2026-11-03",
    };
    localStorage.setItem(
        ITEMS_KEY,
        JSON.stringify([
            activity,
            { ...activity, id: "2", course: "PHYS 207" },
        ]),
    );
    try {
        const user = userEvent.setup({
            advanceTimers: jest.advanceTimersByTime,
        });
        const onToggleTask = jest.fn();
        const view = render(
            <HomePage
                courses={[]}
                tasks={initialTasks}
                showTasks
                onToggleTask={onToggleTask}
                onOpenCourse={jest.fn()}
            />,
        );
        const math = within(
            screen.getByRole("row", { name: `MATH 241 ${activity.title}` }),
        ).getByRole("checkbox");
        const physics = within(
            screen.getByRole("row", { name: `PHYS 207 ${activity.title}` }),
        ).getByRole("checkbox");
        const manual = within(
            screen.getByRole("row", {
                name: `${initialTasks[0].course} ${activity.title}`,
            }),
        ).getByRole("checkbox");

        await user.click(math);
        expect(math).toBeChecked();
        expect(physics).not.toBeChecked();
        expect(manual).not.toBeChecked();
        expect(onToggleTask).not.toHaveBeenCalled();

        await user.click(manual);
        expect(onToggleTask).toHaveBeenCalledWith(initialTasks[0].id);
        view.unmount();
        render(
            <HomePage
                courses={[]}
                tasks={initialTasks}
                showTasks
                onToggleTask={onToggleTask}
                onOpenCourse={jest.fn()}
            />,
        );
        expect(
            within(
                screen.getByRole("row", { name: `MATH 241 ${activity.title}` }),
            ).getByRole("checkbox"),
        ).toBeChecked();
        expect(
            within(
                screen.getByRole("row", { name: `PHYS 207 ${activity.title}` }),
            ).getByRole("checkbox"),
        ).not.toBeChecked();
    } finally {
        jest.useRealTimers();
    }
});

test.each(["invalid JSON", "storage full"])(
    "assignment checkboxes remain usable with %s",
    async (failure) => {
        jest.useFakeTimers();
        jest.setSystemTime(new Date(2026, 10, 3, 12));
        const activity: CalendarItem = {
            id: "assignment",
            course: "CISC 275",
            semester: "Fall 2026",
            kind: "activity",
            title: "Homework",
            date: "2026-11-03",
        };
        localStorage.setItem(ITEMS_KEY, JSON.stringify([activity]));
        if (failure === "invalid JSON") {
            localStorage.setItem("semplan:completed-activities", "{broken");
        }
        const storage =
            failure === "storage full" ?
                jest
                    .spyOn(Storage.prototype, "setItem")
                    .mockImplementation(() => {
                        throw new Error("Storage full");
                    })
            :   undefined;
        try {
            const user = userEvent.setup({
                advanceTimers: jest.advanceTimersByTime,
            });
            render(
                <HomePage
                    courses={[]}
                    tasks={[]}
                    showTasks
                    onToggleTask={jest.fn()}
                    onOpenCourse={jest.fn()}
                />,
            );
            const checkbox = screen.getByRole("checkbox", {
                name: activity.title,
            });
            expect(checkbox).not.toBeChecked();
            await user.click(checkbox);
            expect(checkbox).toBeChecked();
            await user.click(checkbox);
            expect(checkbox).not.toBeChecked();
        } finally {
            storage?.mockRestore();
            jest.useRealTimers();
        }
    },
);

test("To-Do & Reminders includes today's activities alongside tasks, filtered by semester and kind", async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(2026, 10, 3, 12));
    const activity: CalendarItem = {
        id: "assignment",
        course: "CISC 275 - Section 010",
        semester: "Fall 2026",
        kind: "activity",
        title: "Today's assignment",
        date: "2026-11-03",
    };
    localStorage.setItem(
        ITEMS_KEY,
        JSON.stringify([
            activity,
            { ...activity, id: "topic", kind: "topic", title: "Lecture" },
            { ...activity, id: "past", title: "Past", date: "2026-11-02" },
            { ...activity, id: "future", title: "Future", date: "2026-11-04" },
            { ...activity, id: "undated", title: "Undated", date: undefined },
            {
                ...activity,
                id: "spring",
                title: "Spring assignment",
                semester: "Spring 2027",
            },
        ]),
    );
    try {
        const user = userEvent.setup({
            advanceTimers: jest.advanceTimersByTime,
        });
        render(
            <HomePage
                courses={[]}
                tasks={initialTasks}
                showTasks
                onToggleTask={jest.fn()}
                onOpenCourse={jest.fn()}
            />,
        );
        const todo = screen.getByRole("region", {
            name: "To-Do & Reminders: 11/3/2026",
        });
        expect(within(todo).getAllByRole("checkbox")).toHaveLength(2);
        expect(
            within(todo).getByRole("row", {
                name: "CISC 275 - Section 010 Today's assignment",
            }),
        ).toBeInTheDocument();
        expect(within(todo).queryByText("Lecture")).not.toBeInTheDocument();
        expect(within(todo).queryByText("Past")).not.toBeInTheDocument();
        expect(within(todo).queryByText("Future")).not.toBeInTheDocument();
        expect(within(todo).queryByText("Undated")).not.toBeInTheDocument();
        expect(
            within(todo).queryByText("Spring assignment"),
        ).not.toBeInTheDocument();
        await user.selectOptions(
            screen.getByLabelText("Semester"),
            "Spring 2027",
        );
        expect(within(todo).getAllByRole("checkbox")).toHaveLength(1);
        expect(
            within(todo).getByRole("checkbox", { name: "Spring assignment" }),
        ).toBeInTheDocument();
    } finally {
        jest.useRealTimers();
    }
});

test("calendar assignments appear in To-Do & Reminders, remember completion, and disappear when deleted", async () => {
    localStorage.setItem(
        "semplan:settings",
        JSON.stringify({ role: "student", roleSelected: true }),
    );
    localStorage.setItem(ITEMS_KEY, "[]");
    jest.useFakeTimers();
    jest.setSystemTime(new Date(2026, 10, 3, 12));
    try {
        const user = userEvent.setup({
            advanceTimers: jest.advanceTimersByTime,
        });
        const view = render(<App startingTasks={[]} />);
        expect(
            screen.getByText("No tasks scheduled for today."),
        ).toBeInTheDocument();
        await user.click(screen.getByRole("link", { name: "Calendar" }));
        await user.click(
            screen.getByRole("button", { name: "+ Add Activity" }),
        );
        const dialog = screen.getByRole("dialog", { name: "Add Activity" });
        await user.type(
            within(dialog).getByLabelText("Activity name"),
            "New assignment",
        );
        await user.click(
            within(dialog).getByRole("button", {
                name: "Tuesday, November 3, 2026",
            }),
        );
        fireEvent.change(within(dialog).getByLabelText("Time"), {
            target: { value: "23:59" },
        });
        await user.click(
            within(dialog).getByRole("button", { name: "Save Activity" }),
        );
        await user.click(screen.getByRole("link", { name: "Home" }));
        expect(
            screen.queryByText("No tasks scheduled for today."),
        ).not.toBeInTheDocument();
        await user.click(
            screen.getByRole("checkbox", { name: "New assignment" }),
        );
        await user.click(screen.getByRole("link", { name: "Calendar" }));
        expect(
            screen.getByRole("button", { name: "Delete New assignment" }),
        ).toBeInTheDocument();
        await user.click(screen.getByRole("link", { name: "Home" }));
        expect(
            screen.getByRole("checkbox", { name: "New assignment" }),
        ).toBeChecked();
        view.unmount();
        render(<App startingTasks={[]} />);
        expect(
            screen.getByRole("checkbox", { name: "New assignment" }),
        ).toBeChecked();
        await user.click(
            screen.getByRole("checkbox", { name: "New assignment" }),
        );
        await user.click(screen.getByRole("link", { name: "Calendar" }));
        await user.click(screen.getByRole("link", { name: "Home" }));
        expect(
            screen.getByRole("checkbox", { name: "New assignment" }),
        ).not.toBeChecked();
        await user.click(screen.getByRole("link", { name: "Calendar" }));
        await user.click(
            screen.getByRole("button", { name: "Delete New assignment" }),
        );
        await user.click(screen.getByRole("link", { name: "Home" }));
        expect(
            screen.queryByRole("checkbox", { name: "New assignment" }),
        ).not.toBeInTheDocument();
        expect(
            screen.getByText("No tasks scheduled for today."),
        ).toBeInTheDocument();
    } finally {
        jest.useRealTimers();
    }
});

test("home shows today's scheduled tasks and shares changes with Task View", async () => {
    localStorage.setItem(
        "semplan:settings",
        JSON.stringify({
            darkMode: false,
            largeFont: false,
            role: "student",
            roleSelected: true,
        }),
    );
    jest.useFakeTimers();
    jest.setSystemTime(new Date(2026, 10, 3, 12));
    try {
        const user = userEvent.setup({
            advanceTimers: jest.advanceTimersByTime,
        });
        render(<App />);
        expect(
            screen.getByRole("heading", {
                name: "To-Do & Reminders: 11/3/2026",
            }),
        ).toBeInTheDocument();
        const original = initialTasks[0].title;
        expect(screen.getByText(original)).toBeInTheDocument();
        expect(screen.getAllByRole("checkbox")).toHaveLength(1);
        await user.click(screen.getByRole("checkbox", { name: original }));
        await user.click(screen.getByRole("link", { name: "Task View" }));
        expect(screen.getByRole("checkbox", { name: original })).toBeChecked();
        await user.type(
            screen.getByLabelText("Task"),
            "Prepare today's lecture",
        );
        await user.type(screen.getByLabelText("Start date"), "2026-11-02");
        await user.type(screen.getByLabelText("Finish date"), "2026-11-04");
        await user.click(screen.getByRole("button", { name: "Add task" }));
        await user.click(screen.getByRole("link", { name: "Home" }));
        expect(screen.getByText("Prepare today's lecture")).toBeInTheDocument();
        await user.click(screen.getByRole("link", { name: "Task View" }));
        await user.click(
            screen.getByRole("button", {
                name: "Delete Prepare today's lecture",
            }),
        );
        await user.click(screen.getByRole("link", { name: "Home" }));
        expect(
            screen.queryByText("Prepare today's lecture"),
        ).not.toBeInTheDocument();
        expect(screen.getByRole("checkbox", { name: original })).toBeChecked();
    } finally {
        jest.useRealTimers();
    }
});

test.each([
    [14, false],
    [15, true],
    [16, true],
    [17, true],
    [18, false],
])("today's tasks on October %i include a date range: %s", (day, visible) => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(2026, 9, day, 12));
    try {
        render(
            <HomePage
                courses={[]}
                tasks={[
                    {
                        ...initialTasks[0],
                        startDate: "2026-10-15",
                        finishDate: "2026-10-17",
                    },
                ]}
                showTasks
                onToggleTask={jest.fn()}
                onOpenCourse={jest.fn()}
            />,
        );
        expect(
            screen.queryByRole("checkbox", { name: initialTasks[0].title }) !==
                null,
        ).toBe(visible);
    } finally {
        jest.useRealTimers();
    }
});

test("Home keeps today's tasks separate by the selected semester", async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(2026, 10, 3, 12));
    try {
        const user = userEvent.setup({
            advanceTimers: jest.advanceTimersByTime,
        });
        render(
            <HomePage
                courses={[]}
                tasks={[
                    { ...initialTasks[0], title: "Fall homework" },
                    {
                        ...initialTasks[0],
                        id: 2,
                        semester: "Spring 2027",
                        title: "Spring homework",
                    },
                ]}
                showTasks
                onToggleTask={jest.fn()}
                onOpenCourse={jest.fn()}
            />,
        );
        expect(
            screen.getByRole("checkbox", { name: "Fall homework" }),
        ).toBeInTheDocument();
        expect(
            screen.queryByRole("checkbox", { name: "Spring homework" }),
        ).not.toBeInTheDocument();
        await user.selectOptions(
            screen.getByLabelText("Semester"),
            "Spring 2027",
        );
        expect(
            screen.getByRole("checkbox", { name: "Spring homework" }),
        ).toBeInTheDocument();
        expect(
            screen.queryByRole("checkbox", { name: "Fall homework" }),
        ).not.toBeInTheDocument();
    } finally {
        jest.useRealTimers();
    }
});
