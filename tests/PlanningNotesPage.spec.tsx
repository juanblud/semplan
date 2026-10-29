import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { PlanningNotesPage } from "../src/components/PlanningNotesPage";

describe("PlanningNotesPage", () => {
    beforeEach(() => localStorage.clear());

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
            "profplan-planning-notes",
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
            "profplan-planning-notes",
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
