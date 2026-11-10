import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { PlanningNotesPage } from "../src/components/PlanningNotesPage";
import { loadCourses } from "../src/components/CoursesPage";

describe("PlanningNotesPage", () => {
    beforeAll(() => {
        HTMLDialogElement.prototype.showModal = function () {
            this.setAttribute("open", "");
        };
        HTMLDialogElement.prototype.close = function () {
            this.removeAttribute("open");
        };
    });
    beforeEach(() => localStorage.clear());

    test("opens a Markdown guide with syntax and formatted examples, then restores focus", async () => {
        const user = userEvent.setup();
        render(<PlanningNotesPage />);
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
        const guideButton = screen.getByRole("button", {
            name: "Markdown Guide",
        });
        await user.click(guideButton);
        const dialog = screen.getByRole("dialog", { name: "Markdown Guide" });
        const guide = within(dialog);
        expect(dialog).toHaveAttribute("aria-modal", "true");
        expect(guide.getByRole("button", { name: "Close" })).toHaveFocus();
        expect(guide.getByText("**Due on Friday**")).toBeInTheDocument();
        expect(guide.getByText("Due on Friday").tagName).toBe("STRONG");
        expect(guide.getByText("Optional reading").tagName).toBe("EM");
        expect(
            guide.getByRole("heading", { name: "Week plan", level: 1 }),
        ).toBeInTheDocument();
        expect(guide.getAllByRole("listitem")).toHaveLength(4);
        expect(
            guide.getByRole("link", {
                name: "Markdown Guide basic syntax cheat sheet",
            }),
        ).toHaveAttribute(
            "href",
            "https://www.markdownguide.org/cheat-sheet/#basic-syntax",
        );
        await user.click(guide.getByRole("button", { name: "Close" }));
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
        expect(guideButton).toHaveFocus();
        await user.click(guideButton);
        expect(
            screen.getByRole("dialog", { name: "Markdown Guide" }),
        ).toBeInTheDocument();
    });

    test("dismisses the guide with the native Escape action without changing a draft", async () => {
        const user = userEvent.setup();
        render(<PlanningNotesPage />);
        await user.click(screen.getByRole("button", { name: "Add Note" }));
        await user.type(
            screen.getByRole("textbox", { name: "Title" }),
            "Draft plan",
        );
        fireEvent.change(screen.getByRole("textbox", { name: "Note" }), {
            target: { value: "**Keep this draft**" },
        });
        await user.selectOptions(
            screen.getByRole("combobox", { name: "Course" }),
            "cisc275",
        );
        await user.click(
            screen.getByRole("button", { name: "Markdown Guide" }),
        );
        fireEvent(
            screen.getByRole("dialog", { name: "Markdown Guide" }),
            new Event("cancel", { cancelable: true }),
        );
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
        expect(screen.getByRole("textbox", { name: "Title" })).toHaveValue(
            "Draft plan",
        );
        expect(screen.getByRole("textbox", { name: "Note" })).toHaveValue(
            "**Keep this draft**",
        );
        expect(screen.getByRole("combobox", { name: "Course" })).toHaveValue(
            "cisc275",
        );
        expect(localStorage.getItem("semplan-planning-notes")).toBe("[]");
        await user.click(screen.getByRole("button", { name: "Save note" }));
        expect(screen.getByText("Keep this draft").tagName).toBe("STRONG");
    });

    test("assigns courses in the editor and on cards, and remembers assignments", async () => {
        const user = userEvent.setup();
        const view = render(<PlanningNotesPage />);
        await user.click(screen.getByRole("button", { name: "Add Note" }));
        await user.type(
            screen.getByRole("textbox", { name: "Title" }),
            "Lecture",
        );
        await user.selectOptions(
            screen.getByRole("combobox", { name: "Course" }),
            "cisc275",
        );
        await user.click(screen.getByRole("button", { name: "Save note" }));
        expect(
            screen.getByRole("combobox", { name: "Course for Lecture" }),
        ).toHaveValue("cisc275");

        await user.selectOptions(
            screen.getByRole("combobox", { name: "Course for Lecture" }),
            "cisc320",
        );
        view.unmount();
        render(<PlanningNotesPage />);
        expect(
            screen.getByRole("combobox", { name: "Course for Lecture" }),
        ).toHaveValue("cisc320");

        await user.click(screen.getByRole("button", { name: "Edit Lecture" }));
        expect(screen.getByRole("combobox", { name: "Course" })).toHaveValue(
            "cisc320",
        );
        await user.selectOptions(
            screen.getByRole("combobox", { name: "Course" }),
            "",
        );
        await user.click(screen.getByRole("button", { name: "Save changes" }));
        expect(
            screen.getByRole("combobox", { name: "Course for Lecture" }),
        ).toHaveValue("");
    });

    test("filters by course or unassigned, preserves sorting, and creates notes for the filtered course", async () => {
        const base = loadCourses()[0];
        const courses = [
            { ...base, id: "fall-010", section: "010" },
            { ...base, id: "fall-011", section: "011" },
            {
                ...base,
                id: "spring-010",
                section: "010",
                semester: "Spring 2027",
            },
        ];
        localStorage.setItem(
            "semplan-planning-notes",
            JSON.stringify([
                {
                    id: "1-old",
                    title: "Earlier",
                    body: "A",
                    courseId: "fall-010",
                    createdAt: 1,
                    updatedAt: 4,
                },
                {
                    id: "2-new",
                    title: "Later",
                    body: "B",
                    courseId: "fall-010",
                    createdAt: 2,
                    updatedAt: 2,
                },
                {
                    id: "3-other",
                    title: "Other section",
                    body: "C",
                    courseId: "fall-011",
                },
                { id: "4-free", title: "General", body: "D" },
            ]),
        );
        const user = userEvent.setup();
        render(<PlanningNotesPage courses={courses} />);
        const filter = screen.getByRole("combobox", {
            name: "Filter by course",
        });
        await user.selectOptions(filter, "fall-010");
        const headings = () =>
            screen
                .getAllByRole("heading", { level: 2 })
                .map((item) => item.textContent);
        expect(headings()).toEqual(["Earlier", "Later"]);
        await user.selectOptions(
            screen.getByRole("combobox", { name: "Sort by" }),
            "createdAt",
        );
        expect(headings()).toEqual(["Later", "Earlier"]);

        await user.selectOptions(filter, "fall-011");
        expect(headings()).toEqual(["Other section"]);
        await user.selectOptions(filter, "");
        expect(headings()).toEqual(["General"]);
        await user.selectOptions(filter, "spring-010");
        expect(
            screen.getByText("No notes for this course"),
        ).toBeInTheDocument();
        await user.click(screen.getByRole("button", { name: "Add Note" }));
        expect(screen.getByRole("combobox", { name: "Course" })).toHaveValue(
            "spring-010",
        );
        await user.type(
            screen.getByRole("textbox", { name: "Title" }),
            "Spring plan",
        );
        await user.click(screen.getByRole("button", { name: "Save note" }));
        expect(headings()).toEqual(["Spring plan"]);

        await user.selectOptions(
            screen.getByRole("combobox", { name: "Course for Spring plan" }),
            "fall-010",
        );
        expect(
            screen.getByText("No notes for this course"),
        ).toBeInTheDocument();
        await user.selectOptions(filter, "all");
        expect(headings()).toHaveLength(5);
    });

    test("keeps notes from deleted courses accessible with no courses available", async () => {
        localStorage.setItem(
            "semplan-planning-notes",
            JSON.stringify([
                {
                    id: "1-abc",
                    title: "Old plan",
                    body: "Keep this",
                    courseId: "deleted-course",
                },
            ]),
        );
        const user = userEvent.setup();
        render(<PlanningNotesPage courses={[]} />);
        expect(
            screen.getByRole("combobox", { name: "Course for Old plan" }),
        ).toHaveValue("");
        await user.selectOptions(
            screen.getByRole("combobox", { name: "Filter by course" }),
            "",
        );
        expect(screen.getByText("Keep this")).toBeInTheDocument();
        await user.click(screen.getByRole("button", { name: "Edit Old plan" }));
        expect(screen.getByRole("combobox", { name: "Course" })).toHaveValue(
            "",
        );
        await user.click(screen.getByRole("button", { name: "Save changes" }));
        expect(screen.getByText("Keep this")).toBeInTheDocument();
    });

    test("creates, edits, persists, and deletes a plain text note", async () => {
        const user = userEvent.setup();
        const { unmount } = render(<PlanningNotesPage />);

        await user.click(screen.getByRole("button", { name: "Add Note" }));
        await user.type(
            screen.getByRole("textbox", { name: "Title" }),
            "Week 1",
        );
        await user.type(
            screen.getByRole("textbox", { name: "Note" }),
            "Prepare the first lecture.",
        );
        await user.click(screen.getByRole("button", { name: "Save note" }));

        expect(
            screen.getByRole("heading", { name: "Week 1" }),
        ).toBeInTheDocument();
        expect(
            screen.getByText("Prepare the first lecture."),
        ).toBeInTheDocument();

        await user.click(screen.getByRole("button", { name: "Edit Week 1" }));
        await user.clear(screen.getByRole("textbox", { name: "Note" }));
        await user.type(
            screen.getByRole("textbox", { name: "Note" }),
            "Prepare the syllabus.",
        );
        await user.click(screen.getByRole("button", { name: "Save changes" }));
        expect(screen.getByText("Prepare the syllabus.")).toBeInTheDocument();

        unmount();
        render(<PlanningNotesPage />);
        expect(screen.getByText("Prepare the syllabus.")).toBeInTheDocument();

        await user.click(screen.getByRole("button", { name: "Delete Week 1" }));
        expect(
            screen.queryByRole("heading", { name: "Week 1" }),
        ).not.toBeInTheDocument();
        expect(
            screen.getByText("Your notes will appear here"),
        ).toBeInTheDocument();
    });

    test("renders saved Markdown and restores its plain source for editing", async () => {
        const user = userEvent.setup();
        const source = [
            "## Lecture plan",
            "",
            "**Important** and *flexible*",
            "",
            "- Read the [guide](https://example.com)",
            "- Review `code`",
            "",
            "> Bring examples",
        ].join("\n");
        const view = render(<PlanningNotesPage />);

        await user.click(screen.getByRole("button", { name: "Add Note" }));
        await user.type(
            screen.getByRole("textbox", { name: "Title" }),
            "Week 2",
        );
        fireEvent.change(screen.getByRole("textbox", { name: "Note" }), {
            target: { value: source },
        });
        expect(screen.getByRole("textbox", { name: "Note" })).toHaveValue(
            source,
        );
        await user.click(screen.getByRole("button", { name: "Save note" }));

        expect(
            screen.getByRole("heading", { name: "Lecture plan" }),
        ).toBeInTheDocument();
        expect(screen.getByText("Important").tagName).toBe("STRONG");
        expect(screen.getByText("flexible").tagName).toBe("EM");
        expect(screen.getAllByRole("listitem")[0]).toHaveTextContent(
            "Read the guide",
        );
        expect(screen.getByRole("link", { name: "guide" })).toHaveAttribute(
            "href",
            "https://example.com",
        );
        expect(screen.getByText("code").tagName).toBe("CODE");
        expect(
            screen.getByText("Bring examples").closest("blockquote"),
        ).toBeInTheDocument();

        await user.click(screen.getByRole("button", { name: "Edit Week 2" }));
        expect(screen.getByRole("textbox", { name: "Note" })).toHaveValue(
            source,
        );
        await user.click(screen.getByRole("button", { name: "Cancel" }));

        view.unmount();
        render(<PlanningNotesPage />);
        expect(screen.getByText("Important").tagName).toBe("STRONG");
    });

    test("sorts notes by edited or added time", async () => {
        localStorage.setItem(
            "semplan-planning-notes",
            JSON.stringify([
                {
                    id: "first",
                    title: "First",
                    body: "A",
                    createdAt: 100,
                    updatedAt: 300,
                },
                {
                    id: "second",
                    title: "Second",
                    body: "B",
                    createdAt: 300,
                    updatedAt: 200,
                },
                {
                    id: "third",
                    title: "Third",
                    body: "C",
                    createdAt: 200,
                    updatedAt: 100,
                },
            ]),
        );
        const user = userEvent.setup();
        render(<PlanningNotesPage />);

        expect(
            screen
                .getAllByRole("heading", { level: 2 })
                .map((item) => item.textContent),
        ).toEqual(["First", "Second", "Third"]);

        await user.selectOptions(
            screen.getByRole("combobox", { name: "Sort by" }),
            "createdAt",
        );
        expect(
            screen
                .getAllByRole("heading", { level: 2 })
                .map((item) => item.textContent),
        ).toEqual(["Second", "Third", "First"]);

        await user.click(screen.getByRole("button", { name: "Edit Third" }));
        await user.type(
            screen.getByRole("textbox", { name: "Note" }),
            " updated",
        );
        await user.click(screen.getByRole("button", { name: "Save changes" }));
        await user.selectOptions(
            screen.getByRole("combobox", { name: "Sort by" }),
            "updatedAt",
        );
        expect(
            screen
                .getAllByRole("heading", { level: 2 })
                .map((item) => item.textContent),
        ).toEqual(["Third", "First", "Second"]);
    });

    test("keeps notes saved before timestamps were introduced", () => {
        localStorage.setItem(
            "semplan-planning-notes",
            JSON.stringify([
                { id: "100-abc", title: "Earlier", body: "Old note" },
                { id: "200-def", title: "Later", body: "Another old note" },
            ]),
        );

        render(<PlanningNotesPage />);
        expect(
            screen
                .getAllByRole("heading", { level: 2 })
                .map((item) => item.textContent),
        ).toEqual(["Later", "Earlier"]);
        expect(screen.getByText("Old note")).toBeInTheDocument();
    });
});
