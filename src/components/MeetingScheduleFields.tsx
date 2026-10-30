import type { ReactNode } from "react";

export interface MeetingTime {
    hour: string;
    minute: string;
    period: string;
}

export interface MeetingSchedule {
    days: string[];
    start: MeetingTime;
    end: MeetingTime;
}

const weekdays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const hours = Array.from({ length: 12 }, (_, index) => String(index + 1));
const minutes = Array.from({ length: 60 }, (_, index) =>
    String(index).padStart(2, "0"),
);

export function MeetingScheduleFields({
    value,
    onChange,
    onClear,
    children,
}: {
    value: MeetingSchedule;
    onChange: (value: MeetingSchedule) => void;
    onClear: () => void;
    children: ReactNode;
}) {
    return (
        <fieldset className="meeting-schedule" aria-describedby="meeting-help">
            <legend>Meets on</legend>
            <p id="meeting-help">
                Choose meeting days and times, or leave blank to add them later.
            </p>
            <fieldset className="meeting-days">
                <legend>Days</legend>
                <div className="meeting-day-options">
                    {weekdays.map((day) => (
                        <label key={day}>
                            <input
                                type="checkbox"
                                checked={value.days.includes(day)}
                                onChange={(event) => {
                                    const days =
                                        event.target.checked ?
                                            [...value.days, day]
                                        :   value.days.filter(
                                                (item) => item !== day,
                                            );
                                    onChange({
                                        ...value,
                                        days: weekdays.filter((item) =>
                                            days.includes(item),
                                        ),
                                    });
                                }}
                            />
                            {day}
                        </label>
                    ))}
                </div>
            </fieldset>
            <div className="meeting-times">
                {(["start", "end"] as const).map((key) => {
                    const title = key === "start" ? "Start time" : "End time";
                    return (
                        <fieldset className="meeting-time" key={key}>
                            <legend>{title}</legend>
                            <div className="meeting-time-selects">
                                {(
                                    [
                                        ["hour", "Hour", hours],
                                        ["minute", "Minute", minutes],
                                        ["period", "AM/PM", ["AM", "PM"]],
                                    ] as const
                                ).map(([part, label, options]) => (
                                    <label key={part}>
                                        {label}
                                        <select
                                            aria-label={`${title} ${label.toLowerCase()}`}
                                            value={value[key][part]}
                                            onChange={(event) =>
                                                onChange({
                                                    ...value,
                                                    [key]: {
                                                        ...value[key],
                                                        [part]: event.target
                                                            .value,
                                                    },
                                                })
                                            }
                                        >
                                            <option value="">—</option>
                                            {options.map((option) => (
                                                <option key={option}>
                                                    {option}
                                                </option>
                                            ))}
                                        </select>
                                    </label>
                                ))}
                            </div>
                        </fieldset>
                    );
                })}
            </div>
            {children}
            <button type="button" className="meeting-clear" onClick={onClear}>
                Clear meeting details
            </button>
        </fieldset>
    );
}
