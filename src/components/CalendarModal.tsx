import { useEffect } from "react";
import type { ReactNode } from "react";

interface CalendarModalProps {
    // Id of the heading that names the dialog.
    labelledBy: string;
    onClose: () => void;
    children: ReactNode;
}

// Pop-up shared by the Calendar page's dialogs. Escape or a click on the
// dimmed backdrop closes it.
export function CalendarModal({
    labelledBy,
    onClose,
    children,
}: CalendarModalProps) {
    useEffect(() => {
        function closeOnEscape(event: KeyboardEvent) {
            if (event.key === "Escape") {
                onClose();
            }
        }
        document.addEventListener("keydown", closeOnEscape);
        return () => document.removeEventListener("keydown", closeOnEscape);
    }, [onClose]);

    return (
        <div
            className="calendar-dialog-backdrop"
            onMouseDown={(event) => {
                if (event.target === event.currentTarget) {
                    onClose();
                }
            }}
        >
            <div
                className="calendar-dialog"
                role="dialog"
                aria-modal="true"
                aria-labelledby={labelledBy}
            >
                {children}
            </div>
        </div>
    );
}
