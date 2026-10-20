// ============================================================================
// !!! TEMPORARY TEST FEATURE: EXPORT / IMPORT !!!
// ============================================================================
// Lets a user download their saved planner data as a .json file and load it
// back (e.g. in an incognito window or another browser). Works entirely in the
// browser; no backend.
//
// TO REMOVE THIS FEATURE:
//   1. Delete this file.
//   2. Delete tests/DataTransferTEST.spec.tsx.
//   3. In src/components/CalendarPage.tsx, delete the two blocks marked
//      "EXPORT/IMPORT TEST".
// ============================================================================

import { useRef } from "react";
import type { ChangeEvent } from "react";

// Every key the planner saves in localStorage starts with this.
const STORAGE_PREFIX = "semester-planner:";

interface DataTransferTESTProps {
    // Called after an import is saved. The page reloads so every component
    // reads the imported data; tests pass their own function instead.
    onImported?: () => void;
}

// FileReader rather than file.text() so it also runs under the test setup.
function readText(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error("Could not read file"));
        reader.readAsText(blob);
    });
}

function collectSavedData(): Record<string, string> {
    const data: Record<string, string> = {};
    for (let index = 0; index < localStorage.length; index++) {
        const key = localStorage.key(index);
        if (key?.startsWith(STORAGE_PREFIX)) {
            data[key] = localStorage.getItem(key) ?? "";
        }
    }
    return data;
}

export function DataTransferTEST({
    onImported = () => window.location.reload(),
}: DataTransferTESTProps) {
    const fileInput = useRef<HTMLInputElement>(null);

    function exportData() {
        const blob = new Blob([JSON.stringify(collectSavedData(), null, 2)], {
            type: "application/json",
        });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `semester-planner-backup-${new Date().toISOString().slice(0, 10)}.json`;
        link.click();
        URL.revokeObjectURL(url);
    }

    async function importData(event: ChangeEvent<HTMLInputElement>) {
        const file = event.target.files?.[0];
        event.target.value = "";
        if (!file) {
            return;
        }
        try {
            const parsed = JSON.parse(await readText(file)) as Record<
                string,
                string
            > | null;
            const entries = Object.entries(parsed ?? {}).filter(
                ([key, value]) =>
                    key.startsWith(STORAGE_PREFIX) && typeof value === "string",
            );
            if (entries.length === 0) {
                window.alert("That file doesn't contain any planner data.");
                return;
            }
            if (
                !window.confirm(
                    "Replace the calendar data in this browser with the file's data?",
                )
            ) {
                return;
            }
            for (const [key, value] of entries) {
                localStorage.setItem(key, value);
            }
            onImported();
        } catch {
            window.alert("That file couldn't be read as planner data.");
        }
    }

    return (
        <>
            <button type="button" onClick={exportData}>
                Export Data (TEST)
            </button>
            <button type="button" onClick={() => fileInput.current?.click()}>
                Import Data (TEST)
            </button>
            <input
                ref={fileInput}
                type="file"
                accept="application/json,.json"
                aria-label="Import data file"
                hidden
                onChange={(event) => void importData(event)}
            />
        </>
    );
}
// ============================================================================
// !!! END TEMPORARY TEST FEATURE: EXPORT / IMPORT !!!
// ============================================================================
