import { fireEvent, render, screen } from "@testing-library/react";
import { ClippedDay } from "../src/components/ClippedDay";

// The test browser has no layout, so these give each element a fixed box:
// the day is 190px tall and each item is 50px, stacked from the top.
const DAY_HEIGHT = 190;
const ITEM_HEIGHT = 50;

function rect(top: number, height: number): DOMRect {
    return {
        top,
        bottom: top + height,
        left: 0,
        right: 100,
        width: 100,
        height,
        x: 0,
        y: top,
        toJSON: () => ({}),
    };
}

beforeAll(() => {
    // Measures straight away, as a browser does when observing starts.
    globalThis.ResizeObserver = class {
        callback: ResizeObserverCallback;
        constructor(callback: ResizeObserverCallback) {
            this.callback = callback;
        }
        observe() {
            this.callback([], this);
        }
        unobserve() {}
        disconnect() {}
    };
});

beforeEach(() => {
    jest.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(
        function (this: Element) {
            if (this.classList.contains("calendar-day-content")) {
                return rect(0, DAY_HEIGHT);
            }
            const items = [...document.querySelectorAll(".calendar-task")];
            return rect(items.indexOf(this) * ITEM_HEIGHT, ITEM_HEIGHT);
        },
    );
});

afterEach(() => {
    jest.restoreAllMocks();
});

function renderDay(itemCount: number, onShowAll = jest.fn()) {
    const height = itemCount * ITEM_HEIGHT;
    jest.spyOn(HTMLElement.prototype, "scrollHeight", "get").mockReturnValue(
        height,
    );
    jest.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(
        DAY_HEIGHT,
    );
    render(
        <ClippedDay label="Monday, November 2, 2026" onShowAll={onShowAll}>
            {Array.from({ length: itemCount }, (_, index) => (
                <div key={index} className="calendar-task">
                    Item {index + 1}
                </div>
            ))}
        </ClippedDay>,
    );
    return onShowAll;
}

test("a day that fits shows no button", () => {
    renderDay(3);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
});

test("counts what doesn't fit above the button and opens the whole day", () => {
    // Items end at 50, 100, 150, 200, 250, 300; the button covers the last
    // 26px, so only the first three fit.
    const onShowAll = renderDay(6);

    const more = screen.getByRole("button", {
        name: "Show everything on Monday, November 2, 2026 (3 more)",
    });
    expect(more).toHaveTextContent("+3 more");
    fireEvent.click(more);
    expect(onShowAll).toHaveBeenCalled();
});
