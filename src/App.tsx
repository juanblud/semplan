import { useEffect, useState } from "react";
import "./App.css";
import profPlanLogo from "./assets/prof-plan-logo.png";
import { CalendarPage } from "./components/CalendarPage";
import { CoursesPage } from "./components/CoursesPage";
import { HomePage } from "./components/HomePage";
import { PlanningNotesPage } from "./components/PlanningNotesPage";
import { TaskViewPage } from "./components/TaskViewPage";

import { initialTasks } from "./tasks";

type Page = "home" | "courses" | "calendar" | "planning-notes" | "tasks";

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
function getPageFromUrl(): Page {
    const path = decodeURIComponent(
        window.location.pathname.slice(BASE_URL.length),
    )
        .replace(/\/+$/, "")
        .toLowerCase();
    return (
        navigation.find((item) => item.path.toLowerCase() === path)?.id ??
        "home"
    );
}

export function App() {
    const [tasks, setTasks] = useState(initialTasks);
    const [collapsed, setCollapsed] = useState<boolean>(false);
    const [page, setPage] = useState<Page>(getPageFromUrl);

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
            setPage(getPageFromUrl());
        }
        window.addEventListener("popstate", syncWithUrl);
        return () => window.removeEventListener("popstate", syncWithUrl);
    }, []);

    function navigate(next: Page) {
        if (next !== page) {
            window.history.pushState(null, "", getPageUrl(next));
        }
        setPage(next);
    }

    return (
        <div className={`app-shell${collapsed ? " is-collapsed" : ""}`}>
            <aside className="sidebar" aria-label="Sidebar">
                <div className="sidebar-top">
                    {!collapsed && (
                        <div className="brand">
                            <img
                                className="brand-logo"
                                src={profPlanLogo}
                                alt="ProfPlan"
                            />
                        </div>
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
                    {navigation.map((item) => (
                        <a
                            key={item.id}
                            href={getPageUrl(item.id)}
                            className={`nav-link${page === item.id ? " active" : ""}`}
                            aria-label={item.label}
                            aria-current={page === item.id ? "page" : undefined}
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
                </nav>
            </aside>

            <main className="main-content">
                {page === "home" ?
                    <HomePage
                        tasks={tasks}
                        onToggleTask={(id) =>
                            setTasks((current) =>
                                current.map((task) =>
                                    task.id === id ?
                                        { ...task, completed: !task.completed }
                                    :   task,
                                ),
                            )
                        }
                        onOpenCourse={() => navigate("courses")}
                    />
                : page === "courses" ?
                    <CoursesPage
                        tasks={tasks}
                        onPlanInCalendar={() => navigate("calendar")}
                    />
                : page === "calendar" ?
                    <CalendarPage />
                : page === "planning-notes" ?
                    <PlanningNotesPage />
                :   <TaskViewPage tasks={tasks} setTasks={setTasks} />}
            </main>
        </div>
    );
}

export default App;
