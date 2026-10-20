import type { CalendarItem } from "../src/components/scheduleTemplate";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { CoursesPage } from "../src/components/CoursesPage";
import { initialTasks } from "../src/tasks";

beforeAll(() => {
    HTMLDialogElement.prototype.showModal = function () {
        this.setAttribute("open", "");
    };
    HTMLDialogElement.prototype.close = function () {
        this.removeAttribute("open");
    };
});
beforeEach(() => localStorage.clear());

test("creates, edits, persists, and deletes a course", () => {
    const view = render(<CoursesPage />);
    fireEvent.click(screen.getByRole("button", { name: "Create Course" }));
    fireEvent.change(screen.getByLabelText("Course code *"), {
        target: { value: "MATH 241" },
    });
    fireEvent.change(screen.getByLabelText("Course name *"), {
        target: { value: "Calculus" },
    });
    fireEvent.change(screen.getByLabelText("Section"), {
        target: { value: "010" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save course" }));
    expect(
        screen.getByRole("heading", { name: "MATH 241" }),
    ).toBeInTheDocument();
    expect(screen.getByText("010")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Edit MATH 241" }));
    fireEvent.change(screen.getByLabelText("Location"), {
        target: { value: "Gore 103" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save course" }));
    view.unmount();
    render(<CoursesPage />);
    expect(screen.getByText("Gore 103")).toBeInTheDocument();
    expect(screen.getByText("010")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Delete MATH 241" }));
    fireEvent.click(
        within(screen.getByRole("dialog")).getByRole("button", {
            name: "Delete course",
        }),
    );
    expect(
        screen.queryByRole("heading", { name: "MATH 241" }),
    ).not.toBeInTheDocument();
});

test("rejects a section that is not exactly three digits", () => {
    render(<CoursesPage />);
    fireEvent.click(screen.getByRole("button", { name: "Create Course" }));
    fireEvent.change(screen.getByLabelText("Course code *"), {
        target: { value: "MATH 241" },
    });
    fireEvent.change(screen.getByLabelText("Course name *"), {
        target: { value: "Calculus" },
    });
    fireEvent.change(screen.getByLabelText("Section"), {
        target: { value: "10A" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save course" }));
    expect(screen.getByRole("alert")).toHaveTextContent(
        "Section must be exactly three digits",
    );
    expect(
        screen.queryByRole("heading", { name: "MATH 241" }),
    ).not.toBeInTheDocument();
});

test("rejects duplicate codes and filters semesters", () => {
    render(<CoursesPage />);
    fireEvent.click(screen.getByRole("button", { name: "Create Course" }));
    fireEvent.change(screen.getByLabelText("Course code *"), {
        target: { value: "cisc275" },
    });
    fireEvent.change(screen.getByLabelText("Course name *"), {
        target: { value: "Duplicate" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save course" }));
    expect(screen.getByRole("alert")).toHaveTextContent(
        "course code and section already exist",
    );
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    fireEvent.change(screen.getByLabelText("Semester"), {
        target: { value: "Spring 2027" },
    });
    expect(
        screen.getByText(/No courses in this semester yet/),
    ).toBeInTheDocument();
});

test("allows the same course code in different sections of one semester", () => {
    render(<CoursesPage tasks={initialTasks} />);
    for (const section of ["010", "011"]) {
        fireEvent.click(screen.getByRole("button", { name: "Create Course" }));
        fireEvent.change(screen.getByLabelText("Course code *"), {
            target: { value: "CISC 275" },
        });
        fireEvent.change(screen.getByLabelText("Course name *"), {
            target: { value: "Software Engineering" },
        });
        fireEvent.change(screen.getByLabelText("Section"), {
            target: { value: section },
        });
        fireEvent.click(screen.getByRole("button", { name: "Save course" }));
    }
    expect(screen.getAllByRole("heading", { name: "CISC 275" })).toHaveLength(
        3,
    );
    expect(
        screen.getByRole("button", { name: "Edit CISC 275 - Section 010" }),
    ).toBeInTheDocument();
    expect(
        screen.getByRole("button", { name: "Edit CISC 275 - Section 011" }),
    ).toBeInTheDocument();
    expect(
        within(
            screen
                .getByRole("button", { name: "Edit CISC 275 - Section 010" })
                .closest("article")!,
        ).getByText("1 pending task"),
    ).toBeInTheDocument();
    expect(
        within(
            screen
                .getByRole("button", { name: "Edit CISC 275" })
                .closest("article")!,
        ).getByText("0 pending tasks"),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Create Course" }));
    fireEvent.change(screen.getByLabelText("Course code *"), {
        target: { value: "CISC 275" },
    });
    fireEvent.change(screen.getByLabelText("Course name *"), {
        target: { value: "Software Engineering" },
    });
    fireEvent.change(screen.getByLabelText("Section"), {
        target: { value: "010" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save course" }));
    expect(screen.getByRole("alert")).toHaveTextContent(
        "course code and section already exist",
    );
});

test("saves a course template and applies the saved snapshot to spring", () => {
    const view = render(<CoursesPage />);
    const card = screen
        .getByRole("heading", { name: "CISC 275" })
        .closest("article")!;
    fireEvent.click(
        within(card).getByRole("button", { name: "Save schedule template" }),
    );
    expect(within(card).getByRole("status")).toHaveTextContent(
        "Schedule template saved",
    );
    const templates = screen.getByRole("region", {
        name: "Saved course templates",
    });
    expect(within(templates).getByText("From Fall 2026")).toBeInTheDocument();
    expect(within(templates).getByText("7 planned items")).toBeInTheDocument();
    // Later edits to the original calendar must not change the saved template.
    localStorage.setItem(
        "semester-planner:calendar-items",
        JSON.stringify([
            {
                id: "changed",
                course: "CISC 275",
                semester: "Fall 2026",
                kind: "topic",
                title: "Changed fall topic",
                date: "2026-10-12",
            },
        ]),
    );
    view.unmount();
    render(<CoursesPage />);
    fireEvent.click(
        within(
            screen.getByRole("region", { name: "Saved course templates" }),
        ).getByRole("button", {
            name: "Create course from CISC 275 Fall 2026 template",
        }),
    );
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByLabelText("Saved templates")).toHaveValue("0");
    expect(within(dialog).getByLabelText("Semester *")).toHaveValue(
        "Spring 2027",
    );
    fireEvent.click(
        within(dialog).getByRole("button", { name: "Save course" }),
    );
    expect(screen.getByLabelText("Semester")).toHaveValue("Spring 2027");
    expect(
        screen.getByRole("heading", { name: "CISC 275" }),
    ).toBeInTheDocument();
    const saved = JSON.parse(
        localStorage.getItem("semester-planner:calendar-items")!,
    ) as CalendarItem[];
    expect(saved.find((item) => item.id === "changed")?.date).toBe(
        "2026-10-12",
    );
    expect(
        saved.find(
            (item) =>
                item.title === "Immutability" &&
                item.semester === "Spring 2027",
        )?.date,
    ).toBe("2027-03-19");
    expect(
        saved.filter((item) => item.title === "Changed fall topic"),
    ).toHaveLength(1);
});

test("deletes a saved template without removing its course", () => {
    render(<CoursesPage />);
    const card = screen
        .getByRole("heading", { name: "CISC 275" })
        .closest("article")!;
    fireEvent.click(
        within(card).getByRole("button", { name: "Save schedule template" }),
    );
    const templates = screen.getByRole("region", {
        name: "Saved course templates",
    });
    const deleteButton = () =>
        within(templates).getByRole("button", {
            name: "Delete CISC 275 Fall 2026 template",
        });
    fireEvent.click(deleteButton());
    fireEvent.click(
        within(screen.getByRole("dialog")).getByRole("button", {
            name: "Cancel",
        }),
    );
    expect(deleteButton()).toBeInTheDocument();
    fireEvent.click(deleteButton());
    fireEvent.click(
        within(screen.getByRole("dialog")).getByRole("button", {
            name: "Delete template",
        }),
    );
    expect(
        within(templates).getByText(/No saved templates yet/),
    ).toBeInTheDocument();
    expect(
        screen.getByRole("heading", { name: "CISC 275" }),
    ).toBeInTheDocument();
    expect(
        JSON.parse(
            localStorage.getItem("semester-planner:schedule-templates")!,
        ),
    ).toEqual([]);
});

test("reports template storage failure without claiming it was saved", () => {
    render(<CoursesPage />);
    const storage = jest
        .spyOn(Storage.prototype, "setItem")
        .mockImplementation(() => {
            throw new Error("Storage full");
        });
    try {
        const card = screen
            .getByRole("heading", { name: "CISC 275" })
            .closest("article")!;
        fireEvent.click(
            within(card).getByRole("button", {
                name: "Save schedule template",
            }),
        );
        expect(screen.getByRole("alert")).toHaveTextContent(
            "could not be saved",
        );
        expect(
            localStorage.getItem("semester-planner:schedule-templates"),
        ).toBeNull();
    } finally {
        storage.mockRestore();
    }
});

test.each([
    "Mon 1:50 - 2:45 PM",
    "Tue / Thu 9:00 - 10:15 AM",
    "Mon / Wed / Fri 1:50 - 2:45 PM",
    "Tue / Thu 12:45 PM - 2:05 PM",
    "Tue / Thu 9:00 AM - 10:15 AM",
])("accepts abbreviated meeting schedules: %s", (schedule) => {
    render(<CoursesPage />);
    fireEvent.click(screen.getByRole("button", { name: "Edit CISC 275" }));
    fireEvent.change(screen.getByLabelText("Meets"), {
        target: { value: schedule },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save course" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByText(schedule)).toBeInTheDocument();
});

test.each([
    "Monday / Wednesday 1:50 - 2:45 PM",
    "Mon, Wed 1:50 - 2:45 PM",
    "Mon/Wed 1:50 - 2:45 PM",
    "Mon / Wed / Fri / Sat 1:50 - 2:45 PM",
    "Mon / Mon 1:50 - 2:45 PM",
    "Mon 13:50 - 14:45 PM",
    "Mon 1:60 - 2:45 PM",
    "Mon 1:50 - 2:45 pm",
    "Tue / Thu 12:45 pm - 2:05 PM",
    "Tue / Thu 12:45 PM - 2:05 pm",
    "Mon 1:50-2:45 PM",
])("rejects invalid meeting schedules: %s", (schedule) => {
    render(<CoursesPage />);
    fireEvent.click(screen.getByRole("button", { name: "Edit CISC 275" }));
    fireEvent.change(screen.getByLabelText("Meets"), {
        target: { value: schedule },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save course" }));
    expect(screen.getByRole("alert")).toHaveTextContent(
        "Mon / Wed / Fri 1:50 PM - 2:45 PM",
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
        "after both 12-hour times",
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(localStorage.getItem("semester-planner-courses-v1")).toBeNull();
});

test("Add Course creates a spring course with the selected saved schedule", () => {
    render(<CoursesPage />);
    const card = screen
        .getByRole("heading", { name: "CISC 275" })
        .closest("article")!;
    fireEvent.click(
        within(card).getByRole("button", { name: "Save schedule template" }),
    );
    fireEvent.change(screen.getByLabelText("Semester"), {
        target: { value: "Spring 2027" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create Course" }));
    const dialog = screen.getByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("Saved templates"), {
        target: { value: "0" },
    });
    expect(within(dialog).getByLabelText("Course code *")).toHaveValue(
        "CISC 275",
    );
    expect(within(dialog).getByLabelText("Course name *")).toHaveValue(
        "Software Engineering",
    );
    expect(within(dialog).getByLabelText("Semester *")).toHaveValue(
        "Spring 2027",
    );
    fireEvent.click(
        within(dialog).getByRole("button", { name: "Save course" }),
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(
        screen.getByRole("heading", { name: "CISC 275" }),
    ).toBeInTheDocument();
    const items = JSON.parse(
        localStorage.getItem("semester-planner:calendar-items")!,
    ) as CalendarItem[];
    expect(
        items.find(
            (item) =>
                item.title === "Immutability" &&
                item.semester === "Spring 2027",
        )?.date,
    ).toBe("2027-03-19");
    expect(items.find((item) => item.id === "275-immutability")?.date).toBe(
        "2026-10-12",
    );
});

test("Add Course can cancel or deselect a template without copying calendar items", () => {
    render(<CoursesPage />);
    const card = screen
        .getByRole("heading", { name: "CISC 275" })
        .closest("article")!;
    fireEvent.click(
        within(card).getByRole("button", { name: "Save schedule template" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Create Course" }));
    let dialog = screen.getByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("Saved templates"), {
        target: { value: "0" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(localStorage.getItem("semester-planner:calendar-items")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Create Course" }));
    dialog = screen.getByRole("dialog");
    expect(within(dialog).getByLabelText("Saved templates")).toHaveValue("");
    fireEvent.change(within(dialog).getByLabelText("Saved templates"), {
        target: { value: "0" },
    });
    fireEvent.change(within(dialog).getByLabelText("Saved templates"), {
        target: { value: "" },
    });
    fireEvent.change(within(dialog).getByLabelText("Semester *"), {
        target: { value: "Spring 2027" },
    });
    fireEvent.click(
        within(dialog).getByRole("button", { name: "Save course" }),
    );
    expect(localStorage.getItem("semester-planner:calendar-items")).toBeNull();
    expect(screen.getByLabelText("Semester")).toHaveValue("Spring 2027");
});
