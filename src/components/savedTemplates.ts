import type { CalendarItem, Semester } from "./scheduleTemplate";

export interface SavedTemplate {
    course: string;
    semester: Semester;
    meetingDays: number[];
    cancelled: string[];
    items: CalendarItem[];
    details?: {
        title: string;
        instructor: string;
        schedule: string;
        location: string;
        color: string;
    };
}

export const TEMPLATE_KEY = "semester-planner:schedule-templates";
