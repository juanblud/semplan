export interface Task {
    id: number;
    title: string;
    course: string;
    semester: string;
    dueDate: string;
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

// Tasks saved before due dates replaced start and finish dates still load,
// due on their old finish date.
type StoredTask = Partial<Task> & { finishDate?: string };

function toTask(value: StoredTask | null): Task[] {
    if (value === null || typeof value !== "object") return [];
    const dueDate = value.dueDate ?? value.finishDate;
    if (
        typeof value.id !== "number" ||
        typeof value.title !== "string" ||
        typeof value.course !== "string" ||
        typeof value.semester !== "string" ||
        typeof dueDate !== "string" ||
        typeof value.completed !== "boolean"
    ) {
        return [];
    }
    return [
        {
            id: value.id,
            title: value.title,
            course: value.course,
            semester: value.semester,
            dueDate,
            completed: value.completed,
            ...(typeof value.dueClass === "string" && {
                dueClass: value.dueClass,
            }),
        },
    ];
}

export function loadTasks(): Task[] {
    try {
        const saved = JSON.parse(
            localStorage.getItem(TASKS_KEY) ?? "[]",
        ) as Array<StoredTask | null>;
        return Array.isArray(saved) ? saved.flatMap(toTask) : [];
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
