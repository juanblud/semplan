import { useState } from "react";
import { semesters } from "./calendarStorage";

const SELECTED_SEMESTER_KEY = "semester-planner:selected-semester";

function loadSelectedSemester(): string | null {
    try {
        return localStorage.getItem(SELECTED_SEMESTER_KEY);
    } catch {
        return null;
    }
}

// The semester chosen on any page, which every page then opens on. A page that
// doesn't offer that semester shows the default without forgetting the choice.
export function useSelectedSemester(
    available: string[],
    initialSemester?: string,
): [string, (name: string) => void] {
    const [saved, setSaved] = useState(
        () => initialSemester ?? loadSelectedSemester(),
    );

    function select(name: string) {
        setSaved(name);
        try {
            localStorage.setItem(SELECTED_SEMESTER_KEY, name);
        } catch {
            // Storage is blocked; the choice lasts until the page changes.
        }
    }

    return [
        saved && available.includes(saved) ? saved : semesters[0].name,
        select,
    ];
}
