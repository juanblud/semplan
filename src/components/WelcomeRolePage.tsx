import type { Role } from "./SettingsPage";

interface WelcomeRolePageProps {
    onSelect: (role: Role) => void;
}

export function WelcomeRolePage({ onSelect }: WelcomeRolePageProps) {
    return (
        <section
            className="welcome-role-page"
            aria-labelledby="welcome-role-title"
        >
            <div className="welcome-role-card">
                <p className="welcome-role-kicker">
                    Juan&apos;s Semester Planner
                </p>
                <h1 id="welcome-role-title">Welcome!</h1>
                <p className="welcome-role-prompt">
                    Tell us how you plan to use the planner.
                </p>
                <div className="welcome-role-options">
                    <button type="button" onClick={() => onSelect("professor")}>
                        I&apos;m an instructor
                    </button>
                    <button type="button" onClick={() => onSelect("student")}>
                        I&apos;m a student
                    </button>
                </div>
            </div>
        </section>
    );
}
