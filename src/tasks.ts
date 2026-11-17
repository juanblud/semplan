export interface Task {
    id: number;
    title: string;
    course: string;
    semester: string;
    startDate: string;
    finishDate: string;
    completed: boolean;
    // A task due at a class rather than on a date: the class it was set for.
    // If that class is cancelled, the task is due at the next class instead.
    dueClass?: string;
    // Worked out from dueClass when shown, never saved: the cancelled class
    // the task was due at before it moved.
    movedFrom?: string;
}

const TASKS_KEY = "semplan:tasks";

function withoutMovedFrom(task: Task): Task {
    const saved = { ...task };
    delete saved.movedFrom;
    return saved;
}

function isTask(value: Partial<Task> | null): value is Task {
    return (
        value !== null &&
        typeof value === "object" &&
        typeof value.id === "number" &&
        typeof value.title === "string" &&
        typeof value.course === "string" &&
        typeof value.semester === "string" &&
        typeof value.startDate === "string" &&
        typeof value.finishDate === "string" &&
        typeof value.completed === "boolean" &&
        (value.dueClass === undefined || typeof value.dueClass === "string")
    );
}

export function loadTasks(): Task[] {
    try {
        const saved = JSON.parse(
            localStorage.getItem(TASKS_KEY) ?? "[]",
        ) as Array<Partial<Task> | null>;
        return Array.isArray(saved) ?
                saved.filter(isTask).map(withoutMovedFrom)
            :   [];
    } catch {
        return [];
    }
}

export function saveTasks(tasks: Task[]) {
    try {
        localStorage.setItem(
            TASKS_KEY,
            JSON.stringify(tasks.map(withoutMovedFrom)),
        );
    } catch {
        // Tasks still work for this visit if storage is unavailable.
    }
}
