import { useState } from "react";
import "./App.css";
import { CalendarPage } from "./components/CalendarPage";
import { CoursesPage } from "./components/CoursesPage";
import { HomePage } from "./components/HomePage";
import { PlanningNotesPage } from "./components/PlanningNotesPage";

type Page = "home" | "courses" | "calendar" | "planning-notes";

interface NavigationItem {
    id: Page;
    label: string;
    icon: string;
}

const navigation: NavigationItem[] = [
    { id: "home", label: "Home", icon: "🏠" },
    { id: "courses", label: "Courses", icon: "📋" },
    { id: "calendar", label: "Calendar", icon: "📅" },
    { id: "planning-notes", label: "Planning Notes", icon: "✏️" },
];

export function App() {
    const [collapsed, setCollapsed] = useState<boolean>(false);
    const [page, setPage] = useState<Page>("home");

    return (
        <div className={`app-shell${collapsed ? " is-collapsed" : ""}`}>
            <aside className="sidebar" aria-label="Sidebar">
                <div className="sidebar-top">
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
                        <button
                            key={item.id}
                            type="button"
                            className={`nav-link${page === item.id ? " active" : ""}`}
                            aria-label={item.label}
                            aria-current={page === item.id ? "page" : undefined}
                            title={collapsed ? item.label : undefined}
                            onClick={() => setPage(item.id)}
                        >
                            <span className="nav-icon" aria-hidden="true">
                                {item.icon}
                            </span>
                            <span className="nav-label">{item.label}</span>
                        </button>
                    ))}
                </nav>
            </aside>

            <main className="main-content">
                {page === "home" ?
                    <HomePage onOpenCourse={() => setPage("courses")} />
                : page === "courses" ?
                    <CoursesPage />
                : page === "calendar" ?
                    <CalendarPage />
                :   <PlanningNotesPage />}
            </main>
        </div>
    );
}

export default App;
