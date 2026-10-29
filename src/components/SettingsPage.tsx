import type { Dispatch, SetStateAction } from "react";

export type Role = "professor" | "student";

export interface Settings {
    darkMode: boolean;
    largeFont: boolean;
    role: Role;
    roleSelected: boolean;
}

interface SettingsPageProps {
    settings: Settings;
    onChange: Dispatch<SetStateAction<Settings>>;
}

export function SettingsPage({ settings, onChange }: SettingsPageProps) {
    return (
        <section className="settings-page">
            <header className="page-header">
                <h1>Settings</h1>
            </header>

            <section
                className="settings-card"
                aria-labelledby="accessibility-title"
            >
                <h2 id="accessibility-title">Accessibility</h2>
                <label className="settings-row">
                    <span>
                        <strong>Dark Mode</strong>
                    </span>
                    <input
                        className="settings-switch"
                        type="checkbox"
                        checked={settings.darkMode}
                        onChange={(event) =>
                            onChange((current) => ({
                                ...current,
                                darkMode: event.target.checked,
                            }))
                        }
                    />
                </label>
                <label className="settings-row">
                    <span>
                        <strong>Large Font</strong>
                    </span>
                    <input
                        className="settings-switch"
                        type="checkbox"
                        checked={settings.largeFont}
                        onChange={(event) =>
                            onChange((current) => ({
                                ...current,
                                largeFont: event.target.checked,
                            }))
                        }
                    />
                </label>
            </section>

            <section
                className="settings-card"
                aria-labelledby="page-settings-title"
            >
                <h2 id="page-settings-title">Page Settings</h2>
                <div className="settings-roles" role="group" aria-label="Role">
                    <button
                        type="button"
                        aria-pressed={settings.role === "professor"}
                        onClick={() =>
                            onChange((current) => ({
                                ...current,
                                role: "professor",
                                roleSelected: true,
                            }))
                        }
                    >
                        Professor
                    </button>
                    <button
                        type="button"
                        aria-pressed={settings.role === "student"}
                        onClick={() =>
                            onChange((current) => ({
                                ...current,
                                role: "student",
                                roleSelected: true,
                            }))
                        }
                    >
                        Student
                    </button>
                </div>
                <p className="settings-role-hint">
                    {settings.role === "student" ?
                        "Task View is available in the sidebar."
                    :   "Task View is hidden for professors."}
                </p>
            </section>
        </section>
    );
}
