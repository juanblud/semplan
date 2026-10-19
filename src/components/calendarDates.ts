export function formatWeekRange(start: Date, end: Date) {
    const month = (date: Date) =>
        date.toLocaleDateString("en-US", { month: "long" });
    if (start.getFullYear() !== end.getFullYear()) {
        return `${month(start)} ${start.getDate()}, ${start.getFullYear()} - ${month(end)} ${end.getDate()}, ${end.getFullYear()}`;
    }
    if (start.getMonth() !== end.getMonth()) {
        return `${month(start)} ${start.getDate()} - ${month(end)} ${end.getDate()}, ${end.getFullYear()}`;
    }
    return `${month(start)} ${start.getDate()}-${end.getDate()}, ${end.getFullYear()}`;
}
