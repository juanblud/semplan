import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { App } from "../src/App";

describe("App", () => {
    beforeEach(() => {
        window.history.replaceState(null, "", "/");
        localStorage.clear();
    });

    test("gives each sidebar page its own URL", async () => {
        const user = userEvent.setup();
        render(<App />);
        expect(window.location.pathname).toBe("/Home");

        await user.click(screen.getByRole("link", { name: "Calendar" }));
        expect(window.location.pathname).toBe("/Calendar");

        await user.click(screen.getByRole("link", { name: "Planning Notes" }));
        expect(window.location.pathname).toBe("/Planning-Notes");
        await user.click(screen.getByRole("link", { name: "Task View" }));
        expect(window.location.pathname).toBe("/Task-View");
        expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
            "Task View",
        );
        expect(screen.getByRole("link", { name: "Courses" })).toHaveAttribute(
            "href",
            "/Courses",
        );
    });

    test("opens the page in the URL, as after a refresh", () => {
        window.history.replaceState(null, "", "/Calendar");
        render(<App />);

        expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
            "Calendar",
        );
        expect(screen.getByRole("link", { name: "Calendar" })).toHaveAttribute(
            "aria-current",
            "page",
        );
    });

    test("opens Task View directly from its URL", () => {
        window.history.replaceState(null, "", "/Task-View");
        render(<App />);

        expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
            "Task View",
        );
        expect(screen.getByRole("link", { name: "Task View" })).toHaveAttribute(
            "aria-current",
            "page",
        );
    });

    test("matches URLs regardless of case and tidies them", () => {
        window.history.replaceState(null, "", "/planning-notes/");
        render(<App />);

        expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
            "Planning Notes",
        );
        expect(window.location.pathname).toBe("/Planning-Notes");
    });

    test("falls back to Home for unknown URLs", () => {
        window.history.replaceState(null, "", "/not-a-page");
        render(<App />);

        expect(
            screen.getByRole("heading", { name: /semester planning tool/i }),
        ).toBeInTheDocument();
        expect(window.location.pathname).toBe("/Home");
    });

    test("follows the browser back button", async () => {
        const user = userEvent.setup();
        render(<App />);
        await user.click(screen.getByRole("link", { name: "Courses" }));

        window.history.replaceState(null, "", "/Home");
        fireEvent(window, new PopStateEvent("popstate"));

        expect(
            screen.getByRole("heading", { name: /semester planning tool/i }),
        ).toBeInTheDocument();
    });

    test("opens a course plan on the Courses URL", async () => {
        const user = userEvent.setup();
        render(<App />);

        await user.click(
            screen.getAllByRole("button", { name: "Open Course Plan" })[0],
        );
        expect(window.location.pathname).toBe("/Courses");
    });

    test("renders the sidebar and home layout", () => {
        render(<App />);

        expect(
            screen.getByRole("heading", { name: /semester planning tool/i }),
        ).toBeInTheDocument();
        for (const label of [
            "Home",
            "Courses",
            "Calendar",
            "Planning Notes",
            "Task View",
        ]) {
            expect(
                screen.getByRole("link", { name: label }),
            ).toBeInTheDocument();
        }
        expect(
            screen.getByRole("heading", { name: "Current courses" }),
        ).toBeInTheDocument();
    });

    test("collapses and expands the sidebar", async () => {
        const user = userEvent.setup();
        const { container } = render(<App />);

        await user.click(
            screen.getByRole("button", { name: "Collapse sidebar" }),
        );
        expect(container.firstChild).toHaveClass("is-collapsed");
        expect(
            screen.getByRole("link", { name: "Calendar" }),
        ).toBeInTheDocument();

        await user.click(
            screen.getByRole("button", { name: "Expand sidebar" }),
        );
        expect(container.firstChild).not.toHaveClass("is-collapsed");
    });

    test("navigates to a sidebar section", async () => {
        const user = userEvent.setup();
        render(<App />);

        await user.click(screen.getByRole("link", { name: "Planning Notes" }));
        expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
            "Planning Notes",
        );
        expect(
            screen.getByRole("link", { name: "Planning Notes" }),
        ).toHaveAttribute("aria-current", "page");
    });

    test("finds courses with or without spaces in the search", async () => {
        const user = userEvent.setup();
        render(<App />);
        const search = screen.getByRole("searchbox", {
            name: "Search by course code or title",
        });

        await user.type(search, "CISC275");
        expect(
            screen.getByRole("heading", { name: "CISC 275" }),
        ).toBeInTheDocument();
        expect(
            screen.queryByRole("heading", { name: "CISC 320" }),
        ).not.toBeInTheDocument();

        await user.clear(search);
        await user.type(search, "CISC 275");
        expect(
            screen.getByRole("heading", { name: "CISC 275" }),
        ).toBeInTheDocument();

        await user.clear(search);
        await user.type(search, "SoftwareEngineering");
        expect(
            screen.getByRole("heading", { name: "CISC 275" }),
        ).toBeInTheDocument();
    });
});
