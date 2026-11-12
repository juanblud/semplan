import { useState } from "react";
import type { WeekReflection } from "./calendarStorage";
import type { Role } from "./SettingsPage";

type ReflectionText = "understood" | "struggled" | "plan";

interface RolePrompts {
    rating: string;
    levels: string[];
    questions: { field: ReflectionText; label: string }[];
    previousPlan: string;
}

// Students reflect on their learning, professors on their teaching.
const PROMPTS: Record<Role, RolePrompts> = {
    student: {
        rating: "How confident are you with this week's material?",
        levels: ["Lost", "Shaky", "Okay", "Solid", "Could teach it"],
        questions: [
            { field: "understood", label: "What do you understand well now?" },
            { field: "struggled", label: "What is still confusing?" },
            {
                field: "plan",
                label: "What will you do differently next week?",
            },
        ],
        previousPlan: "Last week you planned to:",
    },
    professor: {
        rating: "How well did this week's teaching go?",
        levels: ["Missed", "Rough", "Okay", "Good", "Landed"],
        questions: [
            { field: "understood", label: "What landed with students?" },
            { field: "struggled", label: "Where did students struggle?" },
            { field: "plan", label: "What will you change next week?" },
        ],
        previousPlan: "Last week you planned to change:",
    },
};

interface WeekReflectionPanelProps {
    role: Role;
    defaultOpen?: boolean;
    week: number;
    reflection?: WeekReflection;
    previousPlan: string;
    onChange: (
        changes: Partial<Pick<WeekReflection, "confidence" | ReflectionText>>,
    ) => void;
}

export function WeekReflectionPanel({
    role,
    defaultOpen = false,
    week,
    reflection,
    previousPlan,
    onChange,
}: WeekReflectionPanelProps) {
    const [open, setOpen] = useState(defaultOpen);
    const prompts = PROMPTS[role];
    return (
        <details
            className="calendar-reflection"
            open={open}
            onToggle={(event) => setOpen(event.currentTarget.open)}
        >
            <summary>
                Reflect on week {week}
                {reflection && <small>Saved</small>}
            </summary>
            {previousPlan && (
                <blockquote>
                    <strong>{prompts.previousPlan}</strong> {previousPlan}
                </blockquote>
            )}
            <fieldset>
                <legend>{prompts.rating}</legend>
                {prompts.levels.map((level, index) => {
                    const value = index + 1;
                    const selected = reflection?.confidence === value;
                    return (
                        <button
                            key={level}
                            type="button"
                            aria-pressed={selected}
                            onClick={() =>
                                onChange({
                                    confidence: selected ? undefined : value,
                                })
                            }
                        >
                            {level}
                        </button>
                    );
                })}
            </fieldset>
            <div className="calendar-reflection-questions">
                {prompts.questions.map(({ field, label }) => (
                    <label key={field}>
                        <span>{label}</span>
                        <textarea
                            rows={3}
                            value={reflection?.[field] ?? ""}
                            onChange={(event) =>
                                onChange({ [field]: event.target.value })
                            }
                        />
                    </label>
                ))}
            </div>
            {reflection && (
                <button
                    type="button"
                    className="calendar-reflection-clear"
                    onClick={() =>
                        onChange({
                            confidence: undefined,
                            understood: undefined,
                            struggled: undefined,
                            plan: undefined,
                        })
                    }
                >
                    Clear
                </button>
            )}
        </details>
    );
}
