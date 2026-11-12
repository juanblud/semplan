import type { CalendarItem } from "../src/components/scheduleTemplate";
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CoursesPage, loadCourses } from "../src/components/CoursesPage";
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

test("course controls omit search and show all courses in the selected semester", async () => {
    const user = userEvent.setup();
    const [first, second] = loadCourses();
    const spring = {
        ...first,
        id: "spring-course",
        code: "MATH 241",
        title: "Calculus",
        semester: "Spring 2027",
    };
    render(<CoursesPage courses={[first, second, spring]} />);

    expect(screen.queryByRole("searchbox")).not.toBeInTheDocument();
    expect(
        screen.queryByPlaceholderText("Search courses"),
    ).not.toBeInTheDocument();
    expect(
        screen.queryByText("Search by course code or title"),
    ).not.toBeInTheDocument();
    expect(
        screen.getByRole("button", { name: "Create Course" }),
    ).toBeInTheDocument();
    expect(
        screen.getByRole("button", { name: "Add semester" }),
    ).toBeInTheDocument();
    expect(
        screen.getByRole("heading", { name: first.code }),
    ).toBeInTheDocument();
    expect(
        screen.getByRole("heading", { name: second.code }),
    ).toBeInTheDocument();
    expect(
        screen.queryByRole("heading", { name: spring.code }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(
        "2 courses in Fall 2026",
    );

    await user.selectOptions(screen.getByLabelText("Semester"), "Spring 2027");
    expect(
        screen.getByRole("heading", { name: spring.code }),
    ).toBeInTheDocument();
    expect(
        screen.queryByRole("heading", { name: first.code }),
    ).not.toBeInTheDocument();
    expect(
        screen.queryByRole("heading", { name: second.code }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(
        "1 course in Spring 2027",
    );

    await user.selectOptions(screen.getByLabelText("Semester"), "Fall 2026");
    expect(
        screen.getByRole("heading", { name: first.code }),
    ).toBeInTheDocument();
    expect(
        screen.getByRole("heading", { name: second.code }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("searchbox")).not.toBeInTheDocument();
});

test("corrects the saved CISC 275 instructor without changing other course details", () => {
    const courses = loadCourses().map((course) => ({
        ...course,
        instructor:
            course.code === "CISC 275" ? "Cory Bart" : "Other Instructor",
        location: "Colburn Lab 115",
        schedule: "Mon / Wed / Fri 1:50 PM - 2:45 PM",
    }));
    localStorage.setItem(
        "semester-planner-courses-v1",
        JSON.stringify(courses),
    );

    const view = render(<CoursesPage />);

    expect(screen.getByText("Austin Cory Bart")).toBeInTheDocument();
    expect(screen.queryByText("Cory Bart")).not.toBeInTheDocument();
    expect(screen.getByText("Other Instructor")).toBeInTheDocument();
    expect(
        JSON.parse(localStorage.getItem("semester-planner-courses-v1")!),
    ).toEqual(
        courses.map((course) => ({
            ...course,
            instructor:
                course.code === "CISC 275" ?
                    "Austin Cory Bart"
                :   course.instructor,
        })),
    );

    view.unmount();
    const reloaded = render(<CoursesPage />);
    expect(screen.getByText("Austin Cory Bart")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Edit CISC 275" }));
    expect(screen.getByLabelText("Instructor(s)")).toHaveValue(
        "Austin Cory Bart",
    );
    fireEvent.change(screen.getByLabelText("Instructor(s)"), {
        target: { value: "New Instructor" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save course" }));

    reloaded.unmount();
    render(<CoursesPage />);
    expect(screen.getByText("New Instructor")).toBeInTheDocument();
    expect(screen.queryByText("Austin Cory Bart")).not.toBeInTheDocument();
});

test.each(["cisc275", " CISC 275 "])(
    "corrects the saved instructor for normalized course code %s",
    (code) => {
        const course = { ...loadCourses()[0], code, instructor: " Cory Bart " };
        localStorage.setItem(
            "semester-planner-courses-v1",
            JSON.stringify([course]),
        );

        expect(loadCourses()).toEqual([
            { ...course, instructor: "Austin Cory Bart" },
        ]);
    },
);

test.each([
    ["CISC 275", "Austin Cory Bart"],
    ["CISC 275", "Other Instructor"],
    ["CISC 275", ""],
    ["CISC 320", "Cory Bart"],
])("preserves %s instructor value %j", (code, instructor) => {
    const course = { ...loadCourses()[0], code, instructor };
    const stored = JSON.stringify([course]);
    localStorage.setItem("semester-planner-courses-v1", stored);

    expect(loadCourses()).toEqual([course]);
    expect(localStorage.getItem("semester-planner-courses-v1")).toBe(stored);
});

test("shows the corrected instructor even when browser storage cannot save it", () => {
    const course = {
        ...loadCourses()[0],
        instructor: "Cory Bart",
        location: "Colburn Lab 115",
    };
    const stored = JSON.stringify([course]);
    localStorage.setItem("semester-planner-courses-v1", stored);
    const storage = jest
        .spyOn(Storage.prototype, "setItem")
        .mockImplementation(() => {
            throw new Error("Storage full");
        });
    try {
        render(<CoursesPage />);

        expect(screen.getByText("Austin Cory Bart")).toBeInTheDocument();
        expect(screen.getByText("Colburn Lab 115")).toBeInTheDocument();
        expect(localStorage.getItem("semester-planner-courses-v1")).toBe(
            stored,
        );
    } finally {
        storage.mockRestore();
    }
});

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
    fireEvent.click(
        screen.getByRole("button", { name: "Edit MATH 241 - Section 010" }),
    );
    fireEvent.change(screen.getByLabelText("Location"), {
        target: { value: "Gore 103" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save course" }));
    view.unmount();
    render(<CoursesPage />);
    expect(screen.getByText("Gore 103")).toBeInTheDocument();
    expect(screen.getByText("010")).toBeInTheDocument();
    fireEvent.click(
        screen.getByRole("button", { name: "Delete MATH 241 - Section 010" }),
    );
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

test.each([
    ["2026-09-01", "2026-12-14"],
    ["2026-10-12", "2026-10-12"],
])(
    "creates and restores the course date range %s to %s",
    (startDate, endDate) => {
        const view = render(<CoursesPage />);
        fireEvent.click(screen.getByRole("button", { name: "Create Course" }));
        const meetingFields = screen.getByRole("group", { name: "Meets on" });
        expect(
            within(meetingFields).getByLabelText("Start date"),
        ).toBeInTheDocument();
        expect(
            within(meetingFields).getByLabelText("End date"),
        ).toBeInTheDocument();
        expect(
            screen.queryByRole("group", { name: "Course dates" }),
        ).not.toBeInTheDocument();
        fireEvent.change(screen.getByLabelText("Course code *"), {
            target: { value: "MATH 241" },
        });
        fireEvent.change(screen.getByLabelText("Course name *"), {
            target: { value: "Calculus" },
        });
        fireEvent.change(screen.getByLabelText("Start date"), {
            target: { value: startDate },
        });
        fireEvent.change(screen.getByLabelText("End date"), {
            target: { value: endDate },
        });
        expect(screen.getByLabelText("Start date")).toHaveAttribute(
            "max",
            endDate,
        );
        expect(screen.getByLabelText("End date")).toHaveAttribute(
            "min",
            startDate,
        );
        fireEvent.click(screen.getByRole("button", { name: "Save course" }));
        expect(
            loadCourses().find((course) => course.code === "MATH 241"),
        ).toMatchObject({ startDate, endDate });
        view.unmount();
        render(<CoursesPage />);
        fireEvent.click(screen.getByRole("button", { name: "Edit MATH 241" }));
        expect(screen.getByLabelText("Start date")).toHaveValue(startDate);
        expect(screen.getByLabelText("End date")).toHaveValue(endDate);
        fireEvent.click(
            screen.getByRole("button", { name: "Clear meeting details" }),
        );
        fireEvent.click(screen.getByRole("button", { name: "Save course" }));
        expect(
            loadCourses().find((course) => course.code === "MATH 241"),
        ).toMatchObject({ startDate: "", endDate: "" });
    },
);

test.each([
    ["2026-09-01", "", "Choose both a start date and an end date"],
    ["", "2026-12-14", "Choose both a start date and an end date"],
    ["2026-12-14", "2026-09-01", "End date must be on or after the start date"],
])(
    "rejects an incomplete or reversed date range: %s to %s",
    (startDate, endDate, message) => {
        render(<CoursesPage />);
        fireEvent.click(screen.getByRole("button", { name: "Edit CISC 275" }));
        fireEvent.change(screen.getByLabelText("Start date"), {
            target: { value: startDate },
        });
        fireEvent.change(screen.getByLabelText("End date"), {
            target: { value: endDate },
        });
        fireEvent.submit(
            screen
                .getByRole("button", { name: "Save course" })
                .closest("form")!,
        );
        expect(screen.getByRole("alert")).toHaveTextContent(message);
        expect(localStorage.getItem("semester-planner-courses-v1")).toBeNull();
    },
);

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

test("course card buttons do not open the calendar", async () => {
    const user = userEvent.setup();
    const onPlanInCalendar = jest.fn();
    render(<CoursesPage onPlanInCalendar={onPlanInCalendar} />);
    const card = screen.getByRole("link", {
        name: "View CISC 275 in calendar",
    });

    const edit = within(card).getByRole("button", { name: "Edit CISC 275" });
    edit.focus();
    await user.keyboard("{Enter}");
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    await user.click(
        within(card).getByRole("button", { name: "Delete CISC 275" }),
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    await user.click(
        within(card).getByRole("button", { name: "Save schedule template" }),
    );
    expect(within(card).getByRole("status")).toHaveTextContent(
        "Schedule template saved for CISC 275",
    );
    expect(onPlanInCalendar).not.toHaveBeenCalled();
});

test("allows planning a course in a newly created semester", () => {
    const onPlanInCalendar = jest.fn();
    render(<CoursesPage onPlanInCalendar={onPlanInCalendar} />);
    fireEvent.click(screen.getByRole("button", { name: "Edit CISC 275" }));
    fireEvent.change(screen.getByLabelText("Semester *"), {
        target: { value: "Fall 2027" },
    });
    fireEvent.click(
        screen.getByRole("button", { name: "Plan in Calendar View" }),
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(onPlanInCalendar).toHaveBeenCalledWith(
        expect.objectContaining({ semester: "Fall 2027" }),
    );
    expect(
        loadCourses().find((course) => course.code === "CISC 275")?.semester,
    ).toBe("Fall 2027");
});

test("shows only the selected semester's tasks for matching courses and sections", async () => {
    const user = userEvent.setup();
    const fallCourse = { ...loadCourses()[0], section: "010" };
    const springCourse = {
        ...fallCourse,
        id: "spring275",
        semester: "Spring 2027",
    };
    render(
        <CoursesPage
            courses={[fallCourse, springCourse]}
            tasks={[
                { ...initialTasks[0], title: "Fall homework" },
                {
                    ...initialTasks[0],
                    id: 2,
                    semester: "Spring 2027",
                    title: "Spring homework",
                },
            ]}
        />,
    );
    expect(screen.getByText(/Fall homework - Due/)).toBeInTheDocument();
    expect(screen.queryByText(/Spring homework - Due/)).not.toBeInTheDocument();
    expect(screen.getByText("1 pending task")).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText("Semester"), "Spring 2027");
    expect(screen.getByText(/Spring homework - Due/)).toBeInTheDocument();
    expect(screen.queryByText(/Fall homework - Due/)).not.toBeInTheDocument();
    expect(screen.getByText("1 pending task")).toBeInTheDocument();
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
        screen.getByRole("heading", { name: "CISC 275", level: 2 }),
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
        screen.getByRole("heading", { name: "CISC 275", level: 2 }),
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
])("loads existing meeting schedules into the selectors: %s", (schedule) => {
    localStorage.setItem(
        "semester-planner-courses-v1",
        JSON.stringify([{ ...loadCourses()[0], schedule }]),
    );
    render(<CoursesPage />);
    fireEvent.click(screen.getByRole("button", { name: "Edit CISC 275" }));
    const [
        days,
        startHour,
        startMinute,
        startPeriod,
        endHour,
        endMinute,
        endPeriod,
    ] = schedule
        .match(/^(.*?) (\d+):(\d+)(?: (AM|PM))? - (\d+):(\d+) (AM|PM)$/)!
        .slice(1);
    for (const day of days.split(" / ")) {
        expect(screen.getByRole("checkbox", { name: day })).toBeChecked();
    }
    expect(screen.getByLabelText("Start time hour")).toHaveValue(startHour);
    expect(screen.getByLabelText("Start time minute")).toHaveValue(startMinute);
    expect(screen.getByLabelText("Start time am/pm")).toHaveValue(
        startPeriod || endPeriod,
    );
    expect(screen.getByLabelText("End time hour")).toHaveValue(endHour);
    expect(screen.getByLabelText("End time minute")).toHaveValue(endMinute);
    expect(screen.getByLabelText("End time am/pm")).toHaveValue(endPeriod);
    fireEvent.click(screen.getByRole("button", { name: "Save course" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(
        screen.getByText(
            `${days} ${startHour}:${startMinute} ${startPeriod || endPeriod} - ${endHour}:${endMinute} ${endPeriod}`,
        ),
    ).toBeInTheDocument();
});

function selectMeetingTimes(
    start = ["1", "50", "PM"],
    end = ["2", "45", "PM"],
) {
    for (const [title, time] of [
        ["Start", start],
        ["End", end],
    ] as const) {
        for (const [index, part] of ["hour", "minute", "am/pm"].entries()) {
            fireEvent.change(screen.getByLabelText(`${title} time ${part}`), {
                target: { value: time[index] },
            });
        }
    }
}

test("creates a course with selected days and times and restores them when editing", () => {
    render(<CoursesPage />);
    fireEvent.click(screen.getByRole("button", { name: "Create Course" }));
    fireEvent.change(screen.getByLabelText("Course code *"), {
        target: { value: "MATH 241" },
    });
    fireEvent.change(screen.getByLabelText("Course name *"), {
        target: { value: "Calculus" },
    });
    for (const day of ["Fri", "Wed", "Mon", "Tue", "Thu", "Sat", "Sun"]) {
        fireEvent.click(screen.getByRole("checkbox", { name: day }));
    }
    fireEvent.click(screen.getByRole("checkbox", { name: "Sun" }));
    selectMeetingTimes(["11", "37", "AM"], ["12", "52", "PM"]);
    fireEvent.click(screen.getByRole("button", { name: "Save course" }));
    const schedule = "Mon / Tue / Wed / Thu / Fri / Sat 11:37 AM - 12:52 PM";
    expect(screen.getByText(schedule)).toBeInTheDocument();
    expect(localStorage.getItem("semester-planner-courses-v1")).toContain(
        schedule,
    );
    fireEvent.click(screen.getByRole("button", { name: "Edit MATH 241" }));
    expect(screen.getByRole("checkbox", { name: "Sat" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Sun" })).not.toBeChecked();
    expect(screen.getByLabelText("Start time minute")).toHaveValue("37");
    expect(screen.getByLabelText("End time am/pm")).toHaveValue("PM");
});

test.each(["days only", "times only", "missing minute"])(
    "rejects incomplete meeting details: %s",
    (scenario) => {
        render(<CoursesPage />);
        fireEvent.click(screen.getByRole("button", { name: "Edit CISC 275" }));
        if (scenario !== "times only")
            fireEvent.click(screen.getByRole("checkbox", { name: "Mon" }));
        if (scenario !== "days only") selectMeetingTimes();
        if (scenario === "missing minute")
            fireEvent.change(screen.getByLabelText("End time minute"), {
                target: { value: "" },
            });
        fireEvent.click(screen.getByRole("button", { name: "Save course" }));
        expect(screen.getByRole("alert")).toHaveTextContent(
            "Choose at least one meeting day and a complete start and end time.",
        );
        expect(screen.getByRole("dialog")).toBeInTheDocument();
        expect(localStorage.getItem("semester-planner-courses-v1")).toBeNull();
    },
);

test.each([
    [
        ["1", "00", "PM"],
        ["12", "00", "PM"],
    ],
    [
        ["9", "00", "AM"],
        ["9", "00", "AM"],
    ],
    [
        ["12", "00", "PM"],
        ["12", "30", "AM"],
    ],
])(
    "rejects an end time before or equal to the start time: %j to %j",
    (start, end) => {
        render(<CoursesPage />);
        fireEvent.click(screen.getByRole("button", { name: "Edit CISC 275" }));
        fireEvent.click(screen.getByRole("checkbox", { name: "Mon" }));
        selectMeetingTimes(start, end);
        fireEvent.click(screen.getByRole("button", { name: "Save course" }));
        expect(screen.getByRole("alert")).toHaveTextContent(
            "End time must be later than start time.",
        );
    },
);

test("clears meeting details and resets cancelled changes when opening a new course", () => {
    render(<CoursesPage />);
    fireEvent.click(screen.getByRole("button", { name: "Edit CISC 275" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Mon" }));
    selectMeetingTimes();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    fireEvent.click(screen.getByRole("button", { name: "Create Course" }));
    expect(screen.getByRole("checkbox", { name: "Mon" })).not.toBeChecked();
    expect(screen.getByLabelText("Start time hour")).toHaveValue("");
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    fireEvent.click(screen.getByRole("button", { name: "Edit CISC 275" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Mon" }));
    selectMeetingTimes();
    fireEvent.click(screen.getByRole("button", { name: "Save course" }));
    fireEvent.click(screen.getByRole("button", { name: "Edit CISC 275" }));
    fireEvent.click(
        screen.getByRole("button", { name: "Clear meeting details" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Save course" }));
    expect(loadCourses()[0].schedule).toBe("");
});

test("Add Course creates a spring course with the selected saved schedule", () => {
    localStorage.setItem(
        "semester-planner-courses-v1",
        JSON.stringify([
            {
                ...loadCourses()[0],
                schedule: "Mon / Wed / Fri 1:50 PM - 2:45 PM",
            },
        ]),
    );
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
    expect(within(dialog).getByRole("checkbox", { name: "Mon" })).toBeChecked();
    expect(within(dialog).getByRole("checkbox", { name: "Wed" })).toBeChecked();
    expect(within(dialog).getByRole("checkbox", { name: "Fri" })).toBeChecked();
    expect(within(dialog).getByLabelText("Start time hour")).toHaveValue("1");
    expect(within(dialog).getByLabelText("End time minute")).toHaveValue("45");
    fireEvent.click(
        within(dialog).getByRole("button", { name: "Save course" }),
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(
        screen.getByRole("heading", { name: "CISC 275", level: 2 }),
    ).toBeInTheDocument();
    expect(
        screen.getByText("Mon / Wed / Fri 1:50 PM - 2:45 PM"),
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
