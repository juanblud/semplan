import { useEffect, useState } from "react";
import "./App.css";
import semPlanLogo from "./assets/sem-plan-logo.png";
import semPlanLogoBw from "./assets/sem-plan-logo-bw.png";
import semPlanLogoGreen from "./assets/sem-plan-logo-green.png";
import semPlanLogoRed from "./assets/sem-plan-logo-red.png";
import { CalendarPage } from "./components/CalendarPage";
import { CoursesPage, loadCourses } from "./components/CoursesPage";
import type { CalendarCourseSelection } from "./components/CoursesPage";
import { HomePage } from "./components/HomePage";
import { PlanningNotesPage } from "./components/PlanningNotesPage";
import { SettingsDialog } from "./components/SettingsPage";
import type { ColorScheme, Role, Settings } from "./components/SettingsPage";
import { TaskViewPage } from "./components/TaskViewPage";
import { WelcomeRoleDialog } from "./components/WelcomeRoleDialog";

import { initialTasks } from "./tasks";
import type { Task } from "./tasks";

type Page = "home" | "courses" | "calendar" | "planning-notes" | "tasks";
const SETTINGS_KEY = "semplan:settings";
const logos: Record<ColorScheme, string> = {
    ud: semPlanLogo,
    "black-white": semPlanLogoBw,
    red: semPlanLogoRed,
    green: semPlanLogoGreen,
};

function isColorScheme(value: string | undefined): value is ColorScheme {
    return (
        value === "ud" ||
        value === "black-white" ||
        value === "red" ||
        value === "green"
    );
}

function loadSettings(): Settings {
    try {
        const saved = JSON.parse(
            localStorage.getItem(SETTINGS_KEY) ?? "null",
        ) as Partial<Settings> | null;
        return {
            darkMode: saved?.darkMode === true,
            colorScheme:
                isColorScheme(saved?.colorScheme) ? saved.colorScheme : "ud",
            largeFont: saved?.largeFont === true,
            role: saved?.role === "professor" ? "professor" : "student",
            roleSelected: saved?.roleSelected === true,
        };
    } catch {
        return {
            darkMode: false,
            colorScheme: "ud",
            largeFont: false,
            role: "student",
            roleSelected: false,
        };
    }
}

interface NavigationItem {
    id: Page;
    label: string;
    icon: string;
    // The page's URL after the site's base path, e.g. "Calendar".
    path: string;
}

const navigation: NavigationItem[] = [
    { id: "home", label: "Home", icon: "🏠", path: "Home" },
    { id: "courses", label: "Courses", icon: "📖", path: "Courses" },
    { id: "calendar", label: "Calendar", icon: "📅", path: "Calendar" },
    {
        id: "planning-notes",
        label: "Planning Notes",
        icon: "✏️",
        path: "Planning-Notes",
    },
    { id: "tasks", label: "Task View", icon: "📋", path: "Task-View" },
];

// Vite serves the site from "/" locally and "/<repo>/" on GitHub Pages.
const BASE_URL = (import.meta.env.BASE_URL as string | undefined) ?? "/";

function getPageUrl(page: Page): string {
    const item = navigation.find((option) => option.id === page);
    return BASE_URL + (item?.path ?? "");
}

// The URL decides the page, so a refresh stays put. Matching ignores case and
// a trailing slash; anything unknown falls back to Home.
function getPageFromUrl(role: Role): Page {
    const path = decodeURIComponent(
        window.location.pathname.slice(BASE_URL.length),
    )
        .replace(/\/+$/, "")
        .toLowerCase();
    const requested = navigation.find(
        (item) => item.path.toLowerCase() === path,
    )?.id;
    return requested === "tasks" && role === "professor" ?
            "home"
        :   (requested ?? "home");
}

export function App({
    startingTasks = initialTasks,
}: {
    startingTasks?: Task[];
}) {
    const [settings, setSettings] = useState(loadSettings);
    const [tasks, setTasks] = useState(startingTasks);
    const [courses, setCourses] = useState(loadCourses);
    const [calendarCourse, setCalendarCourse] =
        useState<CalendarCourseSelection | null>(null);
    const [calendarReflectionOpen, setCalendarReflectionOpen] = useState(false);
    const [collapsed, setCollapsed] = useState<boolean>(false);
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [chosenPage, setPage] = useState<Page>(() =>
        settings.roleSelected ? getPageFromUrl(settings.role) : "home",
    );
    // Settings open over the page, so switching to Professor there can leave
    // Task View chosen; professors don't get Task View, so they see Home.
    const page =
        chosenPage === "tasks" && settings.role === "professor" ?
            "home"
        :   chosenPage;

    useEffect(() => {
        try {
            localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
        } catch {
            // Settings still work for this visit if storage is unavailable.
        }
    }, [settings]);

    // Show the page's own URL, e.g. "/" or "/calendar/" becomes "/Calendar".
    useEffect(() => {
        const url = getPageUrl(page);
        if (window.location.pathname !== url) {
            window.history.replaceState(null, "", url);
        }
    }, [page]);

    // The browser's back and forward buttons change the URL, not the state.
    useEffect(() => {
        function syncWithUrl() {
            const next =
                settings.roleSelected ? getPageFromUrl(settings.role) : "home";
            if (window.location.pathname !== getPageUrl(next)) {
                window.history.replaceState(null, "", getPageUrl(next));
            }
            setPage(next);
        }
        window.addEventListener("popstate", syncWithUrl);
        return () => window.removeEventListener("popstate", syncWithUrl);
    }, [settings.role, settings.roleSelected]);

    function navigate(next: Page) {
        if (next === "tasks" && settings.role === "professor") return;
        setCalendarCourse(null);
        setCalendarReflectionOpen(false);
        if (next !== page) {
            window.history.pushState(null, "", getPageUrl(next));
        }
        setPage(next);
    }

    function selectInitialRole(role: Role) {
        setSettings((current) => ({ ...current, role, roleSelected: true }));
    }

    return (
        <div
            className={`app-shell theme-${settings.colorScheme}${collapsed ? " is-collapsed" : ""}${settings.darkMode ? " is-dark" : ""}${settings.largeFont ? " is-large-font" : ""}`}
        >
            <aside className="sidebar" aria-label="Sidebar">
                <div className="sidebar-top">
                    {!collapsed && (
                        // The logo takes you home, as on most sites.
                        <a
                            className="brand"
                            href={getPageUrl("home")}
                            aria-label="SemPlan home"
                            title="Go to Home"
                            onClick={(event) => {
                                // Ctrl/Cmd-click still opens a new tab.
                                if (event.ctrlKey || event.metaKey) return;
                                event.preventDefault();
                                navigate("home");
                            }}
                        >
                            <img
                                className="brand-logo"
                                src={logos[settings.colorScheme]}
                                alt="SemPlan"
                            />
                        </a>
                    )}
                    <button
                        className="sidebar-toggle"
                        type="button"
                        aria-label={
                            collapsed ? "Expand sidebar" : "Collapse sidebar"
                        }
                        onClick={() => setCollapsed(!collapsed)}
                    >
                        {collapsed ? "›" : "‹"}
                    </button>
                </div>
                <nav className="sidebar-nav" aria-label="Main navigation">
                    {navigation
                        .filter(
                            (item) =>
                                item.id !== "tasks" ||
                                settings.role === "student",
                        )
                        .map((item) => (
                            <a
                                key={item.id}
                                href={getPageUrl(item.id)}
                                className={`nav-link${page === item.id ? " active" : ""}`}
                                aria-label={item.label}
                                aria-current={
                                    page === item.id ? "page" : undefined
                                }
                                title={collapsed ? item.label : undefined}
                                onClick={(event) => {
                                    event.preventDefault();
                                    navigate(item.id);
                                }}
                            >
                                <span className="nav-icon" aria-hidden="true">
                                    {item.icon}
                                </span>
                                <span className="nav-label">{item.label}</span>
                            </a>
                        ))}
                    <button
                        type="button"
                        className={`nav-link${settingsOpen ? " active" : ""}`}
                        aria-label="Settings"
                        aria-haspopup="dialog"
                        title={collapsed ? "Settings" : undefined}
                        onClick={() => setSettingsOpen(true)}
                    >
                        <span className="nav-icon" aria-hidden="true">
                            ⚙️
                        </span>
                        <span className="nav-label">Settings</span>
                    </button>
                </nav>
            </aside>

            <main className="main-content">
                {page === "home" ?
                    <HomePage
                        courses={courses}
                        tasks={tasks}
                        role={settings.role}
                        showTasks={settings.role === "student"}
                        onToggleTask={(id) =>
                            setTasks((current) =>
                                current.map((task) =>
                                    task.id === id ?
                                        {
                                            ...task,
                                            completed: !task.completed,
                                        }
                                    :   task,
                                ),
                            )
                        }
                        onOpenCourse={(course) => {
                            navigate("calendar");
                            setCalendarCourse(course);
                            setCalendarReflectionOpen(true);
                        }}
                        onPlanCourse={(course) => {
                            navigate("calendar");
                            setCalendarCourse(course);
                        }}
                        onEditCourses={() => navigate("courses")}
                    />
                : page === "courses" ?
                    <CoursesPage
                        courses={courses}
                        onCoursesChange={setCourses}
                        tasks={tasks}
                        role={settings.role}
                        onPlanInCalendar={(course) => {
                            navigate("calendar");
                            setCalendarCourse(course);
                        }}
                    />
                : page === "calendar" ?
                    <CalendarPage
                        role={settings.role}
                        initialCourse={calendarCourse ?? undefined}
                        initialReflectionOpen={calendarReflectionOpen}
                    />
                : page === "planning-notes" ?
                    <PlanningNotesPage courses={courses} />
                :   <TaskViewPage
                        courses={courses}
                        tasks={tasks}
                        setTasks={setTasks}
                    />
                }
            </main>
            {settingsOpen && (
                <SettingsDialog
                    settings={settings}
                    onChange={setSettings}
                    onClose={() => setSettingsOpen(false)}
                />
            )}
            {!settings.roleSelected && (
                <WelcomeRoleDialog onSelect={selectInitialRole} />
            )}
        </div>
    );
}

export default App;
