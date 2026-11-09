import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
import { addPlaceholderData, placeholderTasks } from "./placeholderData";
import { initialTasks } from "./tasks";

// Placeholder data for designing the site; see placeholderData.ts.
addPlaceholderData();

createRoot(document.getElementById("root")!).render(
    <StrictMode>
        <App startingTasks={[...initialTasks, ...placeholderTasks]} />
    </StrictMode>,
);
