import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { App } from "../src/App";

describe("App", () => {
    test("renders the sidebar and home layout", () => {
        render(<App />);

        expect(
            screen.getByRole("heading", { name: /semester planning tool/i }),
        ).toBeInTheDocument();
        for (const label of ["Home", "Courses", "Calendar", "Planning Notes"]) {
            expect(
                screen.getByRole("button", { name: label }),
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
            screen.getByRole("button", { name: "Calendar" }),
        ).toBeInTheDocument();

        await user.click(
            screen.getByRole("button", { name: "Expand sidebar" }),
        );
        expect(container.firstChild).not.toHaveClass("is-collapsed");
    });

    test("navigates to a sidebar section", async () => {
        const user = userEvent.setup();
        render(<App />);

        await user.click(
            screen.getByRole("button", { name: "Planning Notes" }),
        );
        expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
            "Planning Notes",
        );
        expect(
            screen.getByRole("button", { name: "Planning Notes" }),
        ).toHaveAttribute("aria-current", "page");
    });
});
