// ============================================================================
// !!! TEMPORARY TEST FEATURE: EXPORT / IMPORT !!!
// Delete this file along with src/components/DataTransferTEST.tsx.
// ============================================================================

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { DataTransferTEST } from "../src/components/DataTransferTEST";

const ITEMS_KEY = "semester-planner:calendar-items";

function readText(blob: Blob): Promise<string> {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.readAsText(blob);
    });
}

function backupFile(data: Record<string, string>): File {
    return new File([JSON.stringify(data)], "backup.json", {
        type: "application/json",
    });
}

describe("DataTransferTEST", () => {
    beforeEach(() => {
        localStorage.clear();
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    test("exports the saved planner data as a JSON download", async () => {
        const user = userEvent.setup();
        localStorage.setItem(ITEMS_KEY, "[]");
        localStorage.setItem("unrelated-key", "ignored");
        let exported: Blob | undefined;
        URL.createObjectURL = jest.fn((blob: Blob) => {
            exported = blob;
            return "blob:backup";
        });
        URL.revokeObjectURL = jest.fn();
        const click = jest
            .spyOn(HTMLAnchorElement.prototype, "click")
            .mockImplementation(() => undefined);
        render(<DataTransferTEST />);

        await user.click(
            screen.getByRole("button", { name: "Export Data (TEST)" }),
        );

        expect(click).toHaveBeenCalled();
        expect(JSON.parse(await readText(exported!))).toEqual({
            [ITEMS_KEY]: "[]",
        });
    });

    test("imports planner data from a backup file", async () => {
        const user = userEvent.setup();
        jest.spyOn(window, "confirm").mockReturnValue(true);
        const onImported = jest.fn();
        render(<DataTransferTEST onImported={onImported} />);

        await user.upload(
            screen.getByLabelText("Import data file"),
            backupFile({ [ITEMS_KEY]: "[]", "unrelated-key": "skipped" }),
        );

        expect(localStorage.getItem(ITEMS_KEY)).toBe("[]");
        expect(localStorage.getItem("unrelated-key")).toBeNull();
        expect(onImported).toHaveBeenCalled();
    });

    test("leaves data alone when the import is not confirmed", async () => {
        const user = userEvent.setup();
        jest.spyOn(window, "confirm").mockReturnValue(false);
        const onImported = jest.fn();
        render(<DataTransferTEST onImported={onImported} />);

        await user.upload(
            screen.getByLabelText("Import data file"),
            backupFile({ [ITEMS_KEY]: "[]" }),
        );

        expect(localStorage.getItem(ITEMS_KEY)).toBeNull();
        expect(onImported).not.toHaveBeenCalled();
    });

    test("rejects files without planner data", async () => {
        const user = userEvent.setup();
        const alert = jest
            .spyOn(window, "alert")
            .mockImplementation(() => undefined);
        render(<DataTransferTEST onImported={jest.fn()} />);

        await user.upload(
            screen.getByLabelText("Import data file"),
            new File(["not json"], "backup.json", {
                type: "application/json",
            }),
        );

        expect(alert).toHaveBeenCalledWith(
            "That file couldn't be read as planner data.",
        );
    });
});
// ============================================================================
// !!! END TEMPORARY TEST FEATURE: EXPORT / IMPORT !!!
// ============================================================================
