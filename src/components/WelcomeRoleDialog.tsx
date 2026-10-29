import { useEffect, useRef } from "react";
import type { Role } from "./SettingsPage";

interface WelcomeRoleDialogProps {
    onSelect: (role: Role) => void;
}

export function WelcomeRoleDialog({ onSelect }: WelcomeRoleDialogProps) {
    const dialogRef = useRef<HTMLDialogElement>(null);

    useEffect(() => {
        const dialog = dialogRef.current;
        if (!dialog) return;
        if (typeof dialog.showModal === "function") {
            dialog.showModal();
        } else {
            dialog.setAttribute("open", "");
        }
        return () => {
            if (typeof dialog.close === "function") {
                dialog.close();
            } else {
                dialog.removeAttribute("open");
            }
        };
    }, []);

    return (
        <dialog
            ref={dialogRef}
            className="welcome-role-dialog"
            aria-labelledby="welcome-role-title"
            aria-modal="true"
            onCancel={(event) => event.preventDefault()}
        >
            <h1 id="welcome-role-title">Select Default Settings</h1>
            <p>I am a:</p>
            <div className="welcome-role-options">
                <button type="button" onClick={() => onSelect("professor")}>
                    Professor
                </button>
                <button type="button" onClick={() => onSelect("student")}>
                    Student
                </button>
            </div>
        </dialog>
    );
}
