import { useEffect, useRef } from "react";
import type { Dispatch, SetStateAction } from "react";

export type Role = "professor" | "student";
export type ColorScheme = "ud" | "black-white" | "red" | "green";

export interface Settings {
    darkMode: boolean;
    colorScheme: ColorScheme;
    largeFont: boolean;
    role: Role;
    roleSelected: boolean;
}

interface SettingsDialogProps {
    settings: Settings;
    onChange: Dispatch<SetStateAction<Settings>>;
    onClose: () => void;
}

// Settings open over the current page, which blurs behind them, so changes
// such as dark mode show on that page straight away.
export function SettingsDialog({
    settings,
    onChange,
    onClose,
}: SettingsDialogProps) {
    const dialogRef = useRef<HTMLDialogElement>(null);

    // No cleanup closes it: unmounting removes it, and calling close() would
    // fire "close", which React's development double-run of effects would
    // take as the user closing it.
    useEffect(() => {
        const dialog = dialogRef.current;
        if (!dialog || dialog.open) return;
        if (typeof dialog.showModal === "function") {
            dialog.showModal();
        } else {
            dialog.setAttribute("open", "");
        }
    }, []);

    return (
        <dialog
            ref={dialogRef}
            className="settings-dialog"
            aria-labelledby="settings-title"
            // Escape closes the dialog natively; keep React's state in step.
            onClose={onClose}
            // A click on the blurred area outside the panel lands on the
            // dialog itself, since the panel fills it.
            onClick={(event) => {
                if (event.target === event.currentTarget) onClose();
            }}
        >
            <div className="settings-panel">
                <header className="settings-dialog-header">
                    <h2 id="settings-title">Settings</h2>
                    <button
                        type="button"
                        className="settings-close"
                        aria-label="Close settings"
                        onClick={onClose}
                    >
                        ×
                    </button>
                </header>

                <section
                    className="settings-card"
                    aria-labelledby="accessibility-title"
                >
                    <h3 id="accessibility-title">Accessibility</h3>
                    <label className="settings-row">
                        <span>
                            <strong>Color scheme</strong>
                        </span>
                        <select
                            className="settings-select"
                            value={settings.colorScheme}
                            onChange={(event) =>
                                onChange((current) => ({
                                    ...current,
                                    colorScheme: event.target
                                        .value as ColorScheme,
                                }))
                            }
                        >
                            <option value="ud">UD blue and gold</option>
                            <option value="black-white">Black and white</option>
                            <option value="red">Red</option>
                            <option value="green">Green</option>
                        </select>
                    </label>
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
                    <h3 id="page-settings-title">Page Settings</h3>
                    <div
                        className="settings-roles"
                        role="group"
                        aria-label="Role"
                    >
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
            </div>
        </dialog>
    );
}
