import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

// What counts as one item in a day: events, classes, topics, activities and
// tasks. Topics inside an activity go with that activity.
const ITEM_SELECTOR = [
    ".calendar-event",
    ".calendar-meeting-label",
    ".calendar-topic:not(.calendar-activity .calendar-topic)",
    ".calendar-activity",
    ".calendar-task",
].join(", ");

// Room kept at the bottom of a clipped day for its "+N more" button.
const MORE_BUTTON_SPACE = 26;

interface ClippedDayProps {
    // The day, for the button's accessible name, e.g. "Tuesday, November 10".
    label: string;
    onShowAll: () => void;
    children: ReactNode;
}

// A month-view day that shows what fits and a "+N more" button for the
// rest, instead of scrolling inside the cell. The button opens the whole day.
export function ClippedDay({ label, onShowAll, children }: ClippedDayProps) {
    const box = useRef<HTMLDivElement>(null);
    const content = useRef<HTMLDivElement>(null);
    const [hidden, setHidden] = useState(0);

    // Re-counts whenever the day's contents or the cell's size change.
    useEffect(() => {
        const boxElement = box.current;
        const contentElement = content.current;
        if (
            !boxElement ||
            !contentElement ||
            typeof ResizeObserver === "undefined"
        ) {
            return;
        }
        function measure() {
            if (!boxElement || !contentElement) {
                return;
            }
            const boxRect = boxElement.getBoundingClientRect();
            if (contentElement.scrollHeight <= boxElement.clientHeight + 1) {
                setHidden(0);
                return;
            }
            const visibleBottom = boxRect.bottom - MORE_BUTTON_SPACE;
            const items = [
                ...contentElement.querySelectorAll(ITEM_SELECTOR),
            ].filter(
                (item) => item.getBoundingClientRect().bottom > visibleBottom,
            );
            setHidden(Math.max(1, items.length));
        }
        const observer = new ResizeObserver(measure);
        observer.observe(boxElement);
        observer.observe(contentElement);
        return () => observer.disconnect();
    }, []);

    return (
        <div
            ref={box}
            className={`calendar-day-content is-clipped${hidden > 0 ? " has-more" : ""}`}
        >
            <div ref={content} className="calendar-day-items">
                {children}
            </div>
            {hidden > 0 && (
                <button
                    type="button"
                    className="calendar-day-more"
                    aria-label={`Show everything on ${label} (${hidden} more)`}
                    onClick={onShowAll}
                >
                    +{hidden} more
                </button>
            )}
        </div>
    );
}
