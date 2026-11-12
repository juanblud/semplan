import { fireEvent, render, screen, within } from "@testing-library/react";
import { CoursesPage, loadCourses } from "../src/components/CoursesPage";
import type { Course } from "../src/components/CoursesPage";
import { HomePage } from "../src/components/HomePage";
import { initialTasks } from "../src/tasks";

beforeAll(() => {
    HTMLDialogElement.prototype.showModal = function () {
        this.setAttribute("open", "");
    };
    HTMLDialogElement.prototype.close = function () {
        this.removeAttribute("open");
    };
});

beforeEach(() => {
    localStorage.clear();
    // Wednesday, October 14, 2026, in Fall 2026.
    jest.useFakeTimers({ now: new Date(2026, 9, 14, 9) });
});

afterEach(() => {
    jest.useRealTimers();
});

function getCard(code: string) {
    const card = screen.getByRole("heading", { name: code }).closest("article");
    if (!card) throw new Error(`No card for ${code}`);
    return card;
}

describe("Courses for professors", () => {
    test("shows the teaching plan instead of student tasks", () => {
        render(<CoursesPage role="professor" tasks={initialTasks} />);
        const card = getCard("CISC 275");

        expect(
            within(card).queryByText(/pending task/),
        ).not.toBeInTheDocument();
        // Wednesday's class is today; Friday's Practice Test is the only
        // upcoming class with something on it.
        expect(card).toHaveTextContent(/\d+ classes left · next Wed, Oct 14/);
        expect(
            within(card).getByRole("img", {
                name: /^1 of \d+ upcoming classes planned$/,
            }),
        ).toBeInTheDocument();
    });

    test("students still see their pending tasks", () => {
        render(<CoursesPage role="student" tasks={initialTasks} />);
        expect(getCard("CISC 275")).toHaveTextContent(/pending task/);
    });

    test("offers one link for blank details instead of 'Not added' rows", () => {
        render(<CoursesPage role="professor" />);
        const card = getCard("CISC 275");

        expect(within(card).queryByText("Not added")).not.toBeInTheDocument();
        expect(
            within(card).queryByText("Instructor(s)"),
        ).not.toBeInTheDocument();
        fireEvent.click(
            within(card).getByRole("button", {
                name: "+ Add instructor, meeting times and location",
            }),
        );
        expect(screen.getByLabelText("Course code *")).toHaveValue("CISC 275");
    });

    test("remembers a professor's name for their next course", () => {
        render(<CoursesPage role="professor" />);
        fireEvent.click(screen.getByRole("button", { name: "Create Course" }));
        fireEvent.change(screen.getByLabelText("Course code *"), {
            target: { value: "MATH 241" },
        });
        fireEvent.change(screen.getByLabelText("Course name *"), {
            target: { value: "Calculus" },
        });
        fireEvent.change(screen.getByLabelText("Instructor(s)"), {
            target: { value: "Dr. Rivera" },
        });
        fireEvent.click(screen.getByRole("button", { name: "Save course" }));

        fireEvent.click(screen.getByRole("button", { name: "Create Course" }));
        expect(screen.getByLabelText("Instructor(s)")).toHaveValue(
            "Dr. Rivera",
        );
    });

    test("doesn't pre-fill the instructor for students", () => {
        localStorage.setItem("semplan:last-instructor", "Dr. Rivera");
        render(<CoursesPage role="student" />);
        fireEvent.click(screen.getByRole("button", { name: "Create Course" }));
        expect(screen.getByLabelText("Instructor(s)")).toHaveValue("");
    });
});

describe("Home for professors", () => {
    const unscheduled: Course = {
        id: "math241",
        code: "MATH 241",
        section: "010",
        title: "Calculus",
        semester: "Fall 2026",
        instructor: "",
        schedule: "",
        location: "",
        color: "#c92a2a",
    };

    function renderHome(courses: Course[]) {
        const onPlanCourse = jest.fn();
        const onEditCourses = jest.fn();
        render(
            <HomePage
                courses={courses}
                tasks={[]}
                role="professor"
                showTasks={false}
                onToggleTask={jest.fn()}
                onOpenCourse={jest.fn()}
                onPlanCourse={onPlanCourse}
                onEditCourses={onEditCourses}
            />,
        );
        return { onPlanCourse, onEditCourses };
    }

    test("lists what needs planning, each linked to where it's fixed", () => {
        const [cisc275] = loadCourses();
        const { onPlanCourse, onEditCourses } = renderHome([
            cisc275,
            unscheduled,
        ]);
        const list = within(
            screen.getByRole("region", { name: "Needs attention" }),
        ).getAllByRole("listitem");

        // Today (Wed) and Monday the 19th have nothing; Friday has the
        // Practice Test.
        const empty = list.find((item) =>
            item.textContent.includes("has nothing planned"),
        );
        expect(empty).toHaveTextContent(
            "CISC 275 Wed, Oct 14 has nothing planned (+1 more this week)",
        );
        fireEvent.click(within(empty!).getByRole("button", { name: "Plan" }));
        expect(onPlanCourse).toHaveBeenCalledWith(cisc275);

        const noTimes = list.find((item) =>
            item.textContent.includes("No meeting times set"),
        );
        expect(noTimes).toHaveTextContent("MATH 241 (010)");
        fireEvent.click(
            within(noTimes!).getByRole("button", { name: "Add times" }),
        );
        expect(onEditCourses).toHaveBeenCalled();
    });

    test("says so when nothing needs attention", () => {
        renderHome([]);
        expect(
            screen.getByRole("region", { name: "Needs attention" }),
        ).toHaveTextContent("You're all set");
    });

    test("counts down to the grading deadline", () => {
        localStorage.setItem(
            "semester-planner:custom-semesters",
            JSON.stringify([
                {
                    name: "Winter 2026",
                    start: "2026-10-01",
                    end: "2026-10-30",
                    gradingEnd: "2026-11-01",
                },
            ]),
        );
        renderHome([{ ...unscheduled, semester: "Winter 2026" }]);
        fireEvent.change(screen.getByRole("combobox", { name: "Semester" }), {
            target: { value: "Winter 2026" },
        });

        expect(
            screen.getByRole("region", { name: "Needs attention" }),
        ).toHaveTextContent("Grades are due in 18 days (Sun, Nov 1).");
    });

    test("students don't get the list", () => {
        render(
            <HomePage
                courses={loadCourses()}
                tasks={[]}
                role="student"
                showTasks
                onToggleTask={jest.fn()}
                onOpenCourse={jest.fn()}
            />,
        );
        expect(
            screen.queryByRole("region", { name: "Needs attention" }),
        ).not.toBeInTheDocument();
    });
});
