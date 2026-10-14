import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { App } from "../src/App";

describe("App", () => {
    test("renders the page heading", () => {
        render(<App />);

        expect(
            screen.getByRole("heading", { name: /semester planning tool/i }),
        ).toBeInTheDocument();
    });

    test("counts button clicks", async () => {
        const user = userEvent.setup();
        render(<App />);

        const button = screen.getByRole("button", { name: /clicked 0 times/i });
        await user.click(button);
        expect(button).toHaveTextContent("Clicked 1 time");

        await user.click(button);
        expect(button).toHaveTextContent("Clicked 2 times");
    });
});
