export interface Task {
    id: number;
    title: string;
    course: string;
    semester: string;
    startDate: string;
    finishDate: string;
    completed: boolean;
}

export const initialTasks: Task[] = [
    {
        id: 1,
        title: "Task 4 HW",
        course: "CISC275",
        semester: "Fall 2026",
        startDate: "2026-11-01",
        finishDate: "2026-11-07",
        completed: false,
    },
];
