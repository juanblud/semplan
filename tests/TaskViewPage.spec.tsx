import { useState } from "react";
import { initialTasks } from "./fixtures/tasks";
import type { Task } from "../src/tasks";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TaskViewPage } from "../src/components/TaskViewPage";
import { loadCourses } from "../src/components/CoursesPage";
import type { Course } from "../src/components/CoursesPage";

const taskCourses = loadCourses().map((course) => ({
    ...course,
    section: course.code === "CISC 320" ? "011" : "010",
}));

function TaskViewHarness({
    startingTasks = initialTasks,
    courses = taskCourses,
}: { startingTasks?: Task[]; courses?: Course[] } = {}) {
    const [tasks, setTasks] = useState(startingTasks);
    return <TaskViewPage courses={courses} tasks={tasks} setTasks={setTasks} />;
}

test("edits scheduled task details and preserves completion", async () => {
    const user = userEvent.setup();
    render(<TaskViewHarness />);
    const original = initialTasks[0].title;
    await user.click(screen.getByRole("checkbox", { name: original }));
    await user.click(screen.getByRole("button", { name: `Edit ${original}` }));
    await user.clear(screen.getByRole("textbox", { name: "Task" }));
    await user.type(
        screen.getByRole("textbox", { name: "Task" }),
        "Prepare slides",
    );
    await user.selectOptions(screen.getByLabelText("Class"), "CISC320");
    await user.clear(screen.getByLabelText("Due date"));
    await user.type(screen.getByLabelText("Due date"), "2026-11-03");
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    const checkbox = screen.getByRole("checkbox", { name: "Prepare slides" });
    expect(checkbox).toBeChecked();
    const row = checkbox.closest("li")!;
    expect(within(row).getByText("CISC320")).toBeInTheDocument();
    expect(within(row).getByText("11/03/2026")).toBeInTheDocument();
    await user.click(
        screen.getByRole("button", { name: "Edit Prepare slides" }),
    );
    expect(screen.getByLabelText("Due date")).toHaveValue("2026-11-03");
    expect(screen.queryByText(original)).not.toBeInTheDocument();
});

test("requires a due date and allows same-day tasks", async () => {
    const user = userEvent.setup();
    render(<TaskViewHarness />);
    await user.type(screen.getByLabelText("Task"), "Read chapter 1");
    await user.click(screen.getByRole("button", { name: "Add task" }));
    expect(
        screen.queryByRole("checkbox", { name: "Read chapter 1" }),
    ).not.toBeInTheDocument();
    await user.type(screen.getByLabelText("Due date"), "2026-11-03");
    await user.click(screen.getByRole("button", { name: "Add task" }));
    const row = screen
        .getByRole("checkbox", { name: "Read chapter 1" })
        .closest("li")!;
    expect(within(row).getByText("11/03/2026")).toBeInTheDocument();
    expect(screen.getByLabelText("Due date")).toHaveValue("");
});

test("cancels edits and deletes the task being edited", async () => {
    const user = userEvent.setup();
    render(<TaskViewHarness />);
    const original = initialTasks[0].title;
    await user.click(screen.getByRole("button", { name: `Edit ${original}` }));
    await user.clear(screen.getByLabelText("Task"));
    await user.type(screen.getByLabelText("Task"), "Discard this change");
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.getByText(original)).toBeInTheDocument();
    expect(screen.queryByText("Discard this change")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: `Edit ${original}` }));
    await user.click(
        screen.getByRole("button", { name: `Delete ${original}` }),
    );
    expect(screen.queryByText(original)).not.toBeInTheDocument();
    expect(
        screen.getByRole("button", { name: "Add task" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Task")).toHaveValue("");
    expect(screen.queryAllByRole("checkbox")).toHaveLength(0);
});

test("moves tasks between active and completed sections", async () => {
    const user = userEvent.setup();
    render(<TaskViewHarness />);
    const title = initialTasks[0].title;
    const active = screen.getByRole("region", { name: "Active Tasks" });
    const completed = screen.getByRole("region", { name: "Completed Tasks" });
    expect(
        within(completed).getByText("No completed tasks yet."),
    ).toBeInTheDocument();
    await user.click(within(active).getByRole("checkbox", { name: title }));
    expect(
        within(active).queryByRole("checkbox", { name: title }),
    ).not.toBeInTheDocument();
    expect(
        within(completed).getByRole("checkbox", { name: title }),
    ).toBeChecked();
    await user.click(within(completed).getByRole("checkbox", { name: title }));
    expect(
        within(active).getByRole("checkbox", { name: title }),
    ).not.toBeChecked();
    expect(
        within(completed).getByText("No completed tasks yet."),
    ).toBeInTheDocument();
});

test("keeps tasks for identical courses separate by semester", async () => {
    const user = userEvent.setup();
    const fallCourse = taskCourses[0];
    const springCourse = {
        ...fallCourse,
        id: "spring275",
        semester: "Spring 2027",
    };
    render(<TaskViewHarness courses={[...taskCourses, springCourse]} />);

    await user.selectOptions(screen.getByLabelText("Semester"), "Spring 2027");
    expect(
        screen.queryByRole("checkbox", { name: "Task 4 HW" }),
    ).not.toBeInTheDocument();
    expect(
        within(screen.getByLabelText("Class")).queryByRole("option", {
            name: "CISC320",
        }),
    ).not.toBeInTheDocument();
    await user.type(screen.getByLabelText("Task"), "Task 4 HW");
    await user.selectOptions(screen.getByLabelText("Class"), "CISC275");
    await user.type(screen.getByLabelText("Due date"), "2027-03-07");
    await user.click(screen.getByRole("button", { name: "Add task" }));
    await user.click(screen.getByRole("checkbox", { name: "Task 4 HW" }));
    const springRow = screen
        .getByRole("checkbox", { name: "Task 4 HW" })
        .closest("li")!;
    expect(within(springRow).getByText("Spring 2027")).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText("Semester"), "Fall 2026");
    expect(
        screen.getByRole("checkbox", { name: "Task 4 HW" }),
    ).not.toBeChecked();
    expect(screen.getByText("11/07/2026")).toBeInTheDocument();
    expect(screen.queryByText("03/07/2027")).not.toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText("Semester"), "Spring 2027");
    expect(screen.getByRole("checkbox", { name: "Task 4 HW" })).toBeChecked();
    await user.click(screen.getByRole("button", { name: "Edit Task 4 HW" }));
    expect(screen.getByLabelText("Class")).toHaveValue("CISC275");
    await user.clear(screen.getByLabelText("Task"));
    await user.type(screen.getByLabelText("Task"), "Spring homework");
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    expect(
        screen.getByRole("checkbox", { name: "Spring homework" }),
    ).toBeChecked();

    await user.click(
        screen.getByRole("button", { name: "Edit Spring homework" }),
    );
    await user.selectOptions(screen.getByLabelText("Semester"), "Fall 2026");
    expect(screen.getByLabelText("Task")).toHaveValue("Spring homework");
    expect(screen.getByLabelText("Due date")).toHaveValue("2027-03-07");
    expect(screen.getByLabelText("Class")).toHaveValue("All");
    expect(
        screen.getByRole("button", { name: "Save changes" }),
    ).toBeInTheDocument();
    expect(
        screen.getByRole("checkbox", { name: "Task 4 HW" }),
    ).not.toBeChecked();
    await user.selectOptions(screen.getByLabelText("Class"), "CISC275");
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    const movedRow = screen
        .getByRole("checkbox", { name: "Spring homework" })
        .closest("li")!;
    expect(within(movedRow).getByText("Fall 2026")).toBeInTheDocument();
    expect(within(movedRow).getByRole("checkbox")).toBeChecked();
    await user.selectOptions(screen.getByLabelText("Semester"), "Spring 2027");
    expect(
        screen.queryByRole("checkbox", { name: "Spring homework" }),
    ).not.toBeInTheDocument();
});

test("includes custom course semesters", async () => {
    const user = userEvent.setup();
    const course = { ...taskCourses[0], semester: "Fall 2027", section: "020" };
    render(<TaskViewHarness startingTasks={[]} courses={[course]} />);
    await user.selectOptions(screen.getByLabelText("Semester"), "Fall 2027");
    expect(
        within(screen.getByLabelText("Class")).getByRole("option", {
            name: "CISC275",
        }),
    ).toBeInTheDocument();
});
