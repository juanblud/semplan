import { useState } from "react";
import "./App.css";

/**
 * The root component of your application.
 *
 * Replace the contents of this file with your own project. The counter below
 * is only here so that the template has some state to test; delete it once
 * you have real features.
 */
export function App() {
    const [count, setCount] = useState(0);

    return (
        <main className="app">
            <h1>Final Project</h1>
            <p className="subtitle">
                Edit <code>src/App.tsx</code> to get started.
            </p>
            <section className="card" aria-label="Example counter">
                <button type="button" onClick={() => setCount(count + 1)}>
                    Clicked {count} {count === 1 ? "time" : "times"}
                </button>
            </section>
            <span>Juan Rodriguez</span>
            <span>Brandon Gable</span>
        </main>
    );
}

export default App;
