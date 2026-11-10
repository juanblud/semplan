import { useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";

const examples = [
    { name: "Headings", source: "# Week plan\n## Lecture topics\n### Reading" },
    { name: "Bold", source: "**Due on Friday**" },
    { name: "Italic", source: "*Optional reading*" },
    { name: "Blockquote", source: "> Bring your questions to class." },
    {
        name: "Numbered list",
        source: "1. Read chapter 2\n2. Review your notes",
    },
    { name: "Bulleted list", source: "- Prepare slides\n- Choose examples" },
    { name: "Inline code", source: "Use `console.log()` to check a value." },
    { name: "Code block", source: "```\nconst week = 1;\n```" },
];

export function MarkdownGuideDialog({ onClose }: { onClose: () => void }) {
    const dialogRef = useRef<HTMLDialogElement>(null);
    const closeButtonRef = useRef<HTMLButtonElement>(null);

    useEffect(() => {
        const dialog = dialogRef.current;
        if (!dialog) return;
        const opener = document.activeElement;
        if (typeof dialog.showModal === "function") {
            dialog.showModal();
        } else {
            dialog.setAttribute("open", "");
        }
        closeButtonRef.current?.focus();
        return () => {
            if (typeof dialog.close === "function") {
                dialog.close();
            } else {
                dialog.removeAttribute("open");
            }
            if (opener instanceof HTMLElement) opener.focus();
        };
    }, []);

    return (
        <dialog
            ref={dialogRef}
            className="markdown-guide-dialog"
            aria-labelledby="markdown-guide-title"
            aria-describedby="markdown-guide-intro"
            aria-modal="true"
            onCancel={(event) => {
                event.preventDefault();
                onClose();
            }}
        >
            <header className="markdown-guide-header">
                <h2 id="markdown-guide-title">Markdown Guide</h2>
                <button ref={closeButtonRef} type="button" onClick={onClose}>
                    Close
                </button>
            </header>
            <div className="markdown-guide-content">
                <p id="markdown-guide-intro">
                    Type these symbols in the Note field. When you save, your
                    note displays the formatting shown below.
                </p>
                <table
                    className="markdown-guide-table"
                    aria-label="Basic Markdown syntax"
                >
                    <thead>
                        <tr>
                            <th scope="col">What to type</th>
                            <th scope="col">Result</th>
                        </tr>
                    </thead>
                    <tbody>
                        {examples.map((example) => (
                            <tr key={example.name}>
                                <th scope="row">
                                    {example.name}
                                    <pre>
                                        <code>{example.source}</code>
                                    </pre>
                                </th>
                                <td>
                                    <div className="note-markdown">
                                        <ReactMarkdown skipHtml>
                                            {example.source}
                                        </ReactMarkdown>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                <p className="markdown-guide-tip">
                    Leave a blank line between paragraphs and before lists,
                    quotes, or code blocks. Put a backslash before a symbol,
                    like
                    <code>{" \\* "}</code>, to display it without formatting.
                </p>
                <p>
                    Source:{" "}
                    <a
                        href="https://www.markdownguide.org/cheat-sheet/#basic-syntax"
                        target="_blank"
                        rel="noreferrer"
                    >
                        Markdown Guide basic syntax cheat sheet
                    </a>
                    .
                </p>
            </div>
        </dialog>
    );
}
