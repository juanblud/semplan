import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { App } from "../src/App";
import { HomePage } from "../src/components/HomePage";
import { initialTasks } from "../src/tasks";

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
            screen.getByRole("heading", { name: "Today's tasks: 11/3/2026" }),
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
