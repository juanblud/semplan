import { copySchedule } from "../src/components/scheduleTemplate";
import type { CalendarItem } from "../src/components/scheduleTemplate";

const fall = { name: "Fall 2026", start: "2026-09-01", end: "2026-12-14" };
const spring = { name: "Spring 2027", start: "2027-02-08", end: "2027-05-17" };
let nextId = 0;
const createId = () => `copy-${++nextId}`;

test("copies lecture order, activities and attachments with independent ids", () => {
    const items: CalendarItem[] = [
        {
            id: "lecture",
            course: "CISC 275",
            kind: "topic",
            title: "Introduction",
            date: "2026-09-02",
        },
        {
            id: "activity",
            course: "CISC 275",
            kind: "activity",
            title: "Quiz",
            date: "2026-09-04",
            detail: "Due 11:59 PM",
        },
        {
            id: "attached",
            course: "CISC 275",
            kind: "topic",
            title: "Review",
            date: "2026-09-04",
            activityId: "activity",
        },
        { id: "later", course: "CISC 275", kind: "topic", title: "Extra" },
    ];
    const copied = copySchedule(
        items,
        fall,
        spring,
        [1, 3, 5],
        [],
        "CISC 275",
        createId,
    );
    expect(copied[0].date).toBe("2027-02-08");
    expect(copied[1]).toMatchObject({
        date: "2027-02-11",
        detail: "Due 11:59 PM",
    });
    expect(copied[2]).toMatchObject({
        activityId: copied[1].id,
        date: copied[1].date,
    });
    expect(copied[3].date).toBeUndefined();
    expect(
        copied.every(
            (item) =>
                item.semester === spring.name &&
                !items.some((original) => original.id === item.id),
        ),
    ).toBe(true);
    expect(items[0].date).toBe("2026-09-02");
});

test("skips cancelled meetings and keeps overflow lectures unscheduled", () => {
    const target = { ...spring, end: "2027-02-10" };
    const items: CalendarItem[] = [
        {
            id: "first",
            course: "CISC 275",
            kind: "topic",
            title: "First",
            date: "2026-09-04",
        },
        {
            id: "second",
            course: "CISC 275",
            kind: "topic",
            title: "Second",
            date: "2026-09-07",
        },
    ];
    const copied = copySchedule(
        items,
        fall,
        target,
        [1, 3, 5],
        ["CISC 275|2026-09-02", "CISC 275|2027-02-08"],
        "CISC 275",
        createId,
    );
    expect(copied[0].date).toBe("2027-02-10");
    expect(copied[1].date).toBeUndefined();
});
