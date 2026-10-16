import { useState } from "react";

interface Course {
    code: string;
    title: string;
    semester: string;
}

interface HomePageProps {
    onOpenCourse: () => void;
}

const exampleCourses: Course[] = [
    { code: "CISC 275", title: "Software Engineering", semester: "Fall 2026" },
    { code: "CISC 320", title: "Algorithms", semester: "Fall 2026" },
];

function normalizeSearchText(value: string): string {
    return value.toLowerCase().replace(/\s+/g, "");
}

export function HomePage({ onOpenCourse }: HomePageProps) {
    const [search, setSearch] = useState("");
    const [semester, setSemester] = useState("Fall 2026");
    const [checkedTasks, setCheckedTasks] = useState<number[]>([]);

    const normalizedSearch = normalizeSearchText(search);
    const visibleCourses = exampleCourses.filter(
        (course) =>
            course.semester === semester &&
            normalizeSearchText(`${course.code} ${course.title}`).includes(
                normalizedSearch,
            ),
    );

    function toggleTask(index: number) {
        setCheckedTasks((tasks) =>
            tasks.includes(index) ?
                tasks.filter((task) => task !== index)
            :   [...tasks, index],
        );
    }

    return (
        <>
            <header className="home-header">
                <h1>Semester Planning Tool</h1>
                <p>Your favorite place to plan as an Instructor!</p>
            </header>

            <section className="course-toolbar" aria-label="Course controls">
                <label className="semester-field">
                    <span>Semester</span>
                    <select
                        value={semester}
                        onChange={(event) => setSemester(event.target.value)}
                    >
                        <option>Fall 2026</option>
                        <option>Spring 2027</option>
                    </select>
                </label>
                <label className="search-field">
                    <span>Search by course code or title</span>
                    <input
                        type="search"
                        placeholder="Search"
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                    />
                </label>
                <button
                    className="create-course"
                    type="button"
                    disabled
                    title="Course creation is coming soon"
                >
                    +&nbsp; Create Course
                </button>
            </section>

            <section
                className="courses-section"
                aria-labelledby="courses-title"
            >
                <h2 id="courses-title">Current courses</h2>
                {visibleCourses.length > 0 ?
                    <div className="course-grid">
                        {visibleCourses.map((course) => (
                            <article className="course-card" key={course.code}>
                                <h3>{course.code}</h3>
                                <p>{course.title}</p>
                                <p>{course.semester}</p>
                                <button type="button" onClick={onOpenCourse}>
                                    Open Course Plan
                                </button>
                            </article>
                        ))}
                    </div>
                :   <p className="empty-message">
                        No courses match this selection.
                    </p>
                }
            </section>

            <section className="todo-section" aria-labelledby="todo-title">
                <h2 id="todo-title">Today&apos;s To Do List: 10/14/2026</h2>
                <div className="todo-table-wrap">
                    <table className="todo-table">
                        <thead>
                            <tr>
                                <th scope="col">Course</th>
                                <th scope="col">To Do</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <th scope="row">CISC 275</th>
                                <td>
                                    {[
                                        "Final task due today",
                                        "Issue practice test",
                                        "Finish grading the first practice test for feedback purposes",
                                    ].map((task, index) => (
                                        <label className="todo-item" key={task}>
                                            <input
                                                type="checkbox"
                                                checked={checkedTasks.includes(
                                                    index,
                                                )}
                                                onChange={() =>
                                                    toggleTask(index)
                                                }
                                            />
                                            <span>{task}</span>
                                        </label>
                                    ))}
                                </td>
                            </tr>
                            <tr>
                                <th scope="row">CISC 320</th>
                                <td>All up to Date!</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </section>
        </>
    );
}
