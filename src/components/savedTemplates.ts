import type { CalendarItem, Semester } from "./scheduleTemplate";

export interface SavedTemplate {
    course: string;
    section?: string;
    semester: Semester;
    meetingDays: number[];
    cancelled: string[];
    items: CalendarItem[];
    details?: {
        title: string;
        section?: string;
        instructor: string;
        schedule: string;
        location: string;
        color: string;
        startDate?: string;
        endDate?: string;
    };
}

export const TEMPLATE_KEY = "semester-planner:schedule-templates";
