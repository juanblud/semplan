import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CalendarPage } from "../src/components/CalendarPage";
import { formatWeekRange } from "../src/components/calendarDates";

test("week buttons display arrows and navigate with a readable date range", async () => {
    const user = userEvent.setup();
    render(<CalendarPage />);
    const previous = screen.getByRole("button", { name: "Previous week" });
    const next = screen.getByRole("button", { name: "Next week" });
    expect(previous).toHaveTextContent("<");
    expect(next).toHaveTextContent(">");
    expect(
        screen.getByRole("heading", { name: "Week of: October 11-17, 2026" }),
    ).toBeInTheDocument();
    await user.click(previous);
    expect(
        screen.getByRole("heading", { name: "Week of: October 4-10, 2026" }),
    ).toBeInTheDocument();
    await user.click(next);
    expect(
        screen.getByRole("heading", { name: "Week of: October 11-17, 2026" }),
    ).toBeInTheDocument();
});

test("week ranges include both months and years when needed", () => {
    expect(formatWeekRange(new Date(2026, 9, 25), new Date(2026, 10, 1))).toBe(
        "October 25 - November 1, 2026",
    );
    expect(formatWeekRange(new Date(2026, 11, 27), new Date(2027, 0, 2))).toBe(
        "December 27, 2026 - January 2, 2027",
    );
});

test("shared tasks appear outside meetings and completion syncs with Task View", async () => {
    const { App } = await import("../src/App");
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: "Calendar" }));
    const title = "Make copies of the homework I will assign today";
    const task = screen.getByRole("checkbox", { name: title });
    expect(task.closest(".calendar-class-meeting")).toBeNull();
    expect(task.closest(".calendar-tasks")).not.toBeNull();
    expect(task.closest(".calendar-day")).toHaveAttribute(
        "aria-label",
        "Friday, 2026-10-16",
    );
    await user.click(task);
    await user.click(screen.getByRole("button", { name: "Task View" }));
    expect(screen.getByRole("checkbox", { name: title })).toBeChecked();
});

test("activity dialog stays open until canceled or saved", async () => {
    // jsdom does not implement the browser's native dialog API.
    if (!("showModal" in HTMLDialogElement.prototype)) {
        Object.defineProperty(HTMLDialogElement.prototype, "showModal", {
            configurable: true,
            writable: true,
            value() {},
        });
    }
    const showModal = jest
        .spyOn(HTMLDialogElement.prototype, "showModal")
        .mockImplementation(function (this: HTMLDialogElement) {
            this.setAttribute("open", "");
        });
    try {
        const user = userEvent.setup();
        render(<CalendarPage />);
        await user.click(
            screen.getByRole("button", { name: "+ Add Activity" }),
        );
        expect(
            screen.getByRole("dialog", { name: "Add activity" }),
        ).toBeInTheDocument();
        await user.click(screen.getByRole("button", { name: "Cancel" }));
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
        await user.click(
            screen.getByRole("button", { name: "+ Add Activity" }),
        );
        await user.type(
            screen.getByRole("textbox", { name: "Title" }),
            "Homework 7",
        );
        await user.click(screen.getByRole("button", { name: "Save activity" }));
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
        expect(
            screen.getByRole("heading", { name: "Homework 7" }),
        ).toBeInTheDocument();
    } finally {
        showModal.mockRestore();
    }
});

test("Add Topic schedules an existing topic only on a class meeting date", async () => {
    const showModal = jest
        .spyOn(HTMLDialogElement.prototype, "showModal")
        .mockImplementation(function (this: HTMLDialogElement) {
            this.setAttribute("open", "");
        });
    try {
        const user = userEvent.setup();
        render(<CalendarPage />);
        await user.click(screen.getByRole("button", { name: "+ Add Topic" }));
        expect(
            screen.getByRole("dialog", { name: "Add topic to class meeting" }),
        ).toBeInTheDocument();
        await user.selectOptions(
            screen.getByRole("combobox", { name: "Available topic" }),
            "5",
        );
        const dates = screen.getByRole<HTMLSelectElement>("combobox", {
            name: "Class meeting date",
        });
        expect(
            Array.from(dates.options).every((option) =>
                [1, 3, 5].includes(
                    new Date(`${option.value}T12:00:00`).getDay(),
                ),
            ),
        ).toBe(true);
        await user.selectOptions(dates, "2026-10-14");
        await user.click(screen.getByRole("button", { name: "Save topic" }));
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
        const topic = screen.getByRole("heading", {
            name: "React Introduction",
        });
        expect(topic.closest(".calendar-class-meeting")).not.toBeNull();
        expect(topic.closest(".calendar-day")).toHaveAttribute(
            "aria-label",
            "Wednesday, 2026-10-14",
        );
        expect(
            screen.queryByRole("button", { name: "React Introduction" }),
        ).not.toBeInTheDocument();
        await user.click(screen.getByRole("button", { name: "+ Add Topic" }));
        await user.selectOptions(
            screen.getByRole("combobox", { name: "Available topic" }),
            "6",
        );
        await user.click(screen.getByRole("button", { name: "Cancel" }));
        expect(
            screen.getByRole("button", { name: "What is SE?" }),
        ).toBeInTheDocument();
    } finally {
        showModal.mockRestore();
    }
});
